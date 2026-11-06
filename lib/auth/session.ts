import { createClient } from "@/lib/supabase/server";

export type RecoveryState = "none" | "recovery" | "normal";

type AmrEntry = { method: string; timestamp: number };

function amrEntries(accessToken: string | undefined): AmrEntry[] | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { amr?: { method?: string; timestamp?: number }[] };
    if (!Array.isArray(payload.amr)) return null;
    return payload.amr.map((a) => ({ method: a.method ?? "", timestamp: Number(a.timestamp ?? 0) }));
  } catch {
    return null;
  }
}

// Ways of signing in that prove control of the inbox: a reset link ("recovery"),
// or a typed 6-digit code / email link ("otp", "magiclink"). Supabase records a
// reset done with the typed code as "otp", not "recovery".
const EMAIL_PROOF_METHODS = new Set(["recovery", "otp", "magiclink", "email/signup"]);
// How long after that proof the password can be set without the current one.
const RECOVERY_WINDOW_S = 15 * 60;

/**
 * Whether the visitor may set a new password without the current one: they
 * proved control of their email within the last 15 minutes (reset link or
 * code). Otherwise "normal" (signed in, must use Change password) or "none".
 *
 * Identity comes from getUser(), which the auth server verifies. The session's
 * AMR claim then only says HOW and WHEN that verified user signed in; it can't
 * widen access. If the claim can't be read the session is treated as
 * recovery, so a genuine reset is never blocked.
 */
export async function recoveryState(): Promise<RecoveryState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "none";
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const entries = amrEntries(session?.access_token);
  if (!entries) return "recovery";
  const now = Math.floor(Date.now() / 1000);
  const recent = entries.some(
    (e) => EMAIL_PROOF_METHODS.has(e.method) && (!e.timestamp || now - e.timestamp <= RECOVERY_WINDOW_S),
  );
  return recent ? "recovery" : "normal";
}
