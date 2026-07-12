import { cookies } from "next/headers";

// The signed-in user's identity, read from the Supabase auth cookie WITHOUT a
// network round-trip to the auth server.
//
// Safety: the JWT signature is NOT verified here, so this must only be used to
// scope queries / fill user_id columns — never as an authorization check. All
// reads and writes still go to Supabase carrying the same token, where it IS
// verified and RLS enforces `auth.uid()`. A forged cookie can only produce
// empty results or RLS rejections, never another user's data.
export type LocalUser = { id: string; email: string | null };

function b64urlToString(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

export function getLocalUser(): LocalUser | null {
  // Auth cookie: sb-<ref>-auth-token, possibly chunked into .0/.1/… parts.
  const parts = cookies()
    .getAll()
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const ai = Number(a.name.split(".").pop());
      const bi = Number(b.name.split(".").pop());
      return (Number.isNaN(ai) ? 0 : ai) - (Number.isNaN(bi) ? 0 : bi);
    });
  if (parts.length === 0) return null;

  try {
    let raw = parts.map((p) => p.value).join("");
    if (raw.startsWith("base64-")) raw = b64urlToString(raw.slice(7));
    const session = JSON.parse(raw) as { access_token?: string };
    if (!session.access_token) return null;

    const payload = JSON.parse(
      b64urlToString(session.access_token.split(".")[1]),
    ) as { sub?: string; email?: string; exp?: number };

    // Middleware refreshes tokens close to expiry, so a live request should
    // always carry a valid one; treat anything expired as signed-out.
    if (!payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return { id: payload.sub, email: payload.email ?? null };
  } catch {
    return null;
  }
}
