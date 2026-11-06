import { createClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";

// Why this exists: in a server action, ANY cookie write (even Supabase saving a
// PKCE "code verifier" before sending an email) makes Next.js re-render the
// page from the server, which remounts the client form and throws away its
// state — e.g. the "enter your code" step vanishes right after "Send code".
//
// Auth calls that only SEND an email, or that run on the user's behalf without
// changing their session, go through these clients instead: no storage, no
// cookies, implicit flow (our emails use token_hash links, so no verifier is
// needed).

const OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: "implicit" as const,
  },
};

export function createStatelessClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, OPTIONS);
}

/**
 * A cookie-free client carrying the signed-in user's CURRENT session, for
 * calls like updateUser({ email }) that must not write cookies. Null when
 * there's no usable session (or it's about to expire, in which case the
 * caller should fall back to the cookie client so a refresh is persisted).
 */
export async function createSessionClient() {
  const {
    data: { session },
  } = await createCookieClient().auth.getSession();
  if (!session?.access_token || !session.refresh_token) return null;
  const now = Math.floor(Date.now() / 1000);
  // Never let this copy refresh the token: that would rotate the refresh
  // token without saving it, and the cookie's copy would then be stale.
  if (!session.expires_at || session.expires_at - now < 120) return null;
  const client = createStatelessClient();
  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return error ? null : client;
}
