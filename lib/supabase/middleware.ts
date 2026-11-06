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

// Reachable without a session. Everything else needs one.
const PUBLIC_PREFIXES = ["/login", "/signup", "/verify-email", "/forgot", "/reset-password", "/reset", "/auth"];
// Pointless once signed in: bounce to Home.
const GUEST_ONLY = ["/login", "/signup"];

function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

function toLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  const target = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = "";
  // Come back to where they were after logging in (sanitised again on use).
  if (target !== "/") url.searchParams.set("next", target);
  return NextResponse.redirect(url);
}

function toHome(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // API routes authenticate themselves and answer with a status code. Bouncing
  // them to /login would hand a caller (the service worker's Background Sync
  // POST) a 200 HTML login page instead of a 401 it can act on.
  if (path.startsWith("/api/")) return NextResponse.next({ request });

  const isPublic = matches(path, PUBLIC_PREFIXES);
  const isGuestOnly = matches(path, GUEST_ONLY);

  // Fast path: the session cookie is present and not close to expiry, so skip
  // the network round-trip to the auth server. This only decides ROUTING:
  // pages and actions read data through Supabase, where the token is verified
  // and RLS applies, and auth-sensitive server code calls getUser().
  const expiresAt = readSessionExpiry(request);
  const nowS = Math.floor(Date.now() / 1000);
  const hasFreshSession = expiresAt !== null && expiresAt - nowS > REFRESH_MARGIN_S;

  if (hasFreshSession) {
    if (isGuestOnly) return toHome(request);
    return NextResponse.next({ request });
  }

  // No session at all: straight to login, no network needed.
  if (expiresAt === null && !isPublic) return toLogin(request);

  // Slow path: token expired or about to. Run the Supabase round-trip so the
  // refresh token rotates and fresh cookies go back with the response.
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) return toLogin(request);
  if (user && isGuestOnly) return toHome(request);

  return response;
}
