import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlaceholderEmail } from "@/lib/auth/validation";

/**
 * After one side of an email change is confirmed: is the change complete?
 * For accounts on an undeliverable placeholder address the other side can
 * never be confirmed, so it's completed here (migration 023).
 */
export async function settleEmailChange(supabase: SupabaseClient): Promise<"done" | "pending_current" | "none"> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "none";
  const pending = (user as { new_email?: string }).new_email;
  if (!pending) return "done";

  if (isPlaceholderEmail(user.email)) {
    const { data: completed } = await supabase.rpc("complete_placeholder_email_change");
    if (completed) {
      // New email into the session token right away.
      await supabase.auth.refreshSession();
      return "done";
    }
  }
  return "pending_current";
}
