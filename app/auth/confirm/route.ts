import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/next";
import { authErrorCode, parseFlow } from "@/lib/auth/errors";

// Every auth email link lands here:
//   /auth/confirm?token_hash=…&type=email|signup|recovery|email_change|magiclink&next=/…
// verifyOtp runs with the cookie-bound server client, so the session is set
// in this browser. token_hash links need no PKCE verifier, so they work even
// when the email is opened on a different device or browser.
//
// A ?code= (PKCE) link from Supabase's default templates is accepted too.

const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "magiclink", "invite"];

const DEFAULT_NEXT: Partial<Record<EmailOtpType, string>> = {
  recovery: "/reset-password",
  email_change: "/profile",
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const rawType = searchParams.get("type");
  const type = TYPES.includes(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;
  const next = safeNext(searchParams.get("next"), DEFAULT_NEXT[type ?? "email"] ?? "/");
  const flow = parseFlow(type);

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(reason)}&flow=${flow}`);

  const supabase = createClient();
  let error: unknown = null;

  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    return fail("invalid");
  }

  if (error) return fail(authErrorCode(error) === "otp_expired" ? "expired" : "invalid");

  const dest = new URL(next, origin);
  // A verified sign-up lands on Home with a welcome toast.
  if ((type === "email" || type === "signup") && dest.pathname === "/") dest.searchParams.set("toast", "verified");
  return NextResponse.redirect(dest);
}
