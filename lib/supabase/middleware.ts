import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresh the token via the auth server only when it expires within this window.
const REFRESH_MARGIN_S = 120;

// Reads the Supabase auth cookie (sb-<ref>-auth-token, possibly chunked into
// .0/.1/… parts) and returns the session's expires_at (unix seconds), or null
// when there is no parseable session. Purely local — no network.
function readSessionExpiry(request: NextRequest): number | null {
  const parts = request.cookies
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
    if (raw.startsWith("base64-")) {
      const b64 = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      raw = atob(b64);
    }
    const session = JSON.parse(raw) as { expires_at?: number };
    return typeof session.expires_at === "number" ? session.expires_at : null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Public routes: auth screens plus /offline (the service worker precaches it
  // as the no-connection fallback, so it must load signed-out).
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/forgot") ||
    path.startsWith("/reset") ||
    path.startsWith("/auth") ||
    path.startsWith("/offline");

  // Fast path: the session cookie is present and not close to expiry, so skip
  // the network round-trip to the auth server entirely. Data access is still
  // protected by RLS — this check only gates routing.
  const expiresAt = readSessionExpiry(request);
  const nowS = Math.floor(Date.now() / 1000);
  const hasFreshSession = expiresAt !== null && expiresAt - nowS > REFRESH_MARGIN_S;

  if (hasFreshSession) {
    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  if (expiresAt === null && !isAuthRoute) {
    // No session at all — straight to login, no network needed.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Slow path: token missing on an auth route, expired, or about to expire.
  // Run the full Supabase round-trip so the refresh token can rotate.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
