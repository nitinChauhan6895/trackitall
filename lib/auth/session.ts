import { createClient } from "@/lib/supabase/server";

export type RecoveryState = "none" | "recovery" | "normal";

function amrMethods(accessToken: string | undefined): string[] | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { amr?: { method?: string }[] };
    return Array.isArray(payload.amr) ? payload.amr.map((a) => a.method ?? "") : null;
  } catch {
    return null;
  }
}

/**
 * Whether the visitor holds a password-recovery session (signed in through a
 * reset link or reset code), an ordinary one, or none.
 *
 * Identity comes from getUser(), which the auth server verifies. The session's
 * AMR claim then only says HOW that verified user signed in; it can't widen
 * access. If the claim can't be read the session is treated as recovery, so a
 * genuine reset is never blocked.
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
  const methods = amrMethods(session?.access_token);
  if (!methods) return "recovery";
  return methods.includes("recovery") ? "recovery" : "normal";
}
