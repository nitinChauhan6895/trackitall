import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EmailOtpType = "recovery" | "signup" | "invite" | "email_change" | "email";

// Handles the password-recovery (and other OTP) email links when the Supabase
// email template points here with `token_hash` + `type`. On success the auth
// cookie is set, then we send the user to /reset to choose a new password.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset";

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=recovery`);
}
