"use server";

// Every auth mutation runs here, on the server, through the cookie-bound
// Supabase client — so sessions land in httpOnly-capable cookies and the
// service-role key never leaves the server.
//
// Where an answer could reveal whether an account exists (sign-up, password
// reset, code sign-in, resend), the result is the same either way.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authFailure,
  fail,
  type AuthResult,
} from "@/lib/auth/errors";
import {
  cleanCode,
  isStrongPassword,
  isValidEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "@/lib/auth/validation";
import { safeNext } from "@/lib/auth/next";
import { recoveryState } from "@/lib/auth/session";
import { settleEmailChange } from "@/lib/auth/emailChange";

/** The public origin used in email links: env override, else this request's host. */
function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.vesmo.in";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function confirmUrl(next: string): string {
  return `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/**
 * Resolve a legacy username to its account email, on the server only — the
 * email is never sent to the browser. Uses the service-role client when it's
 * configured (migration 023 limits email_for_username to it), else the
 * pre-023 anon RPC.
 */
async function emailForUsername(raw: string): Promise<string | null> {
  const username = normalizeUsername(raw);
  if (!isValidUsername(username)) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("email").eq("username", username).maybeSingle();
    return (data?.email as string | undefined) ?? null;
  } catch {
    const { data } = await createClient().rpc("email_for_username", { p_username: username });
    return typeof data === "string" && data ? data : null;
  }
}

// ---------- Log in ----------

export async function signInWithPasswordAction(input: {
  identifier: string;
  password: string;
  next?: string;
  captchaToken?: string;
}): Promise<AuthResult> {
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) return fail("validation_failed", "Enter your email and password.");

  const isEmail = identifier.includes("@");
  const email = isEmail ? normalizeEmail(identifier) : await emailForUsername(identifier);
  // Unknown username: the same answer as a wrong password.
  if (!email) return fail("invalid_credentials");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
    options: { captchaToken: input.captchaToken },
  });
  if (error) {
    const res = authFailure(error);
    // Only echo the email back when the person typed it themselves.
    if (res.code === "email_not_confirmed" && isEmail) res.email = email;
    return res;
  }
  return { ok: true, redirectTo: safeNext(input.next) };
}

/** "Email me a code instead". Never reveals whether the account exists. */
export async function requestLoginCodeAction(input: {
  email: string;
  captchaToken?: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return fail("email_address_invalid");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmUrl("/"),
      captchaToken: input.captchaToken,
    },
  });
  if (error) {
    const res = authFailure(error);
    // "No such user" must look like success; only limits and the captcha
    // are worth telling the person about.
    if (["rate_limited", "captcha_failed", "network"].includes(res.code)) return res;
  }
  return { ok: true };
}

/**
 * Verify a 6-digit email code typed into the app. This is the path that works
 * inside the iOS home-screen app, whose cookies Safari can't see.
 */
export async function verifyEmailCodeAction(input: {
  email: string;
  code: string;
  kind: "signup" | "login" | "recovery";
  next?: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const token = cleanCode(input.code);
  if (!isValidEmail(email)) return fail("email_address_invalid");
  if (token.length !== 6) return fail("otp_expired", "Enter the 6-digit code from the email.");

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: input.kind === "recovery" ? "recovery" : "email",
  });
  if (error) return authFailure(error);

  if (input.kind === "recovery") return { ok: true, redirectTo: "/reset-password" };
  if (input.kind === "signup") return { ok: true, redirectTo: "/?toast=verified" };
  return { ok: true, redirectTo: safeNext(input.next) };
}

// ---------- Sign up ----------

export async function signUpAction(input: {
  name: string;
  email: string;
  password: string;
  captchaToken?: string;
}): Promise<AuthResult> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const email = normalizeEmail(input.email);
  if (!name) return fail("validation_failed", "Enter your name.");
  if (!isValidEmail(email)) return fail("email_address_invalid");
  if (!isStrongPassword(input.password)) return fail("weak_password");

  const [first, ...rest] = name.split(" ");
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { name, first_name: first, last_name: rest.join(" ") || null },
      emailRedirectTo: confirmUrl("/"),
      captchaToken: input.captchaToken,
    },
  });

  const verify = `/verify-email?email=${encodeURIComponent(email)}`;
  if (error) {
    const res = authFailure(error);
    // An existing address gets the same "check your inbox" as a new one.
    if (["user_already_exists", "email_exists"].includes(res.code)) return { ok: true, redirectTo: verify };
    return res;
  }
  // "Confirm email" switched off in Supabase: the account is live already.
  if (data.session) return { ok: true, redirectTo: "/" };
  return { ok: true, redirectTo: verify };
}

export async function resendSignupCodeAction(input: {
  email: string;
  captchaToken?: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return fail("email_address_invalid");
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: confirmUrl("/"), captchaToken: input.captchaToken },
  });
  if (error) {
    const res = authFailure(error);
    if (["rate_limited", "captcha_failed", "network"].includes(res.code)) return res;
  }
  return { ok: true };
}

// ---------- Forgot / reset password ----------

export async function requestPasswordResetAction(input: {
  email: string;
  captchaToken?: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return fail("email_address_invalid");
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmUrl("/reset-password"),
    captchaToken: input.captchaToken,
  });
  if (error) {
    const res = authFailure(error);
    if (["rate_limited", "captcha_failed", "network"].includes(res.code)) return res;
  }
  return { ok: true };
}

/** Set a new password from a recovery session (reset link or reset code). */
export async function resetPasswordAction(input: { password: string }): Promise<AuthResult> {
  if (!isStrongPassword(input.password)) return fail("weak_password");

  const state = await recoveryState();
  if (state === "none") return { ok: false, code: "session_expired", message: "This reset session has expired. Request a new link." };
  if (state === "normal") return fail("validation_failed", "Use Profile › Change password while you're signed in.");

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return authFailure(error);

  // Anyone else holding the old password is now out.
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, redirectTo: "/?toast=password" };
}

// ---------- Profile › account security ----------

async function requireVerifiedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function changePasswordAction(input: {
  current: string;
  password: string;
  captchaToken?: string;
}): Promise<AuthResult> {
  const { supabase, user } = await requireVerifiedUser();
  if (!user?.email) return fail("session_expired");
  if (!input.current) return fail("validation_failed", "Enter your current password.");
  if (!isStrongPassword(input.password)) return fail("weak_password");

  // Prove the current password first. A fresh sign-in also satisfies
  // Supabase's "Secure password change" (recent sign-in) requirement.
  const check = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.current,
    options: { captchaToken: input.captchaToken },
  });
  if (check.error) {
    return authFailure(check.error, { invalid_credentials: "Your current password is incorrect." });
  }

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return authFailure(error);
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

export async function changeEmailAction(input: { email: string }): Promise<AuthResult> {
  const { supabase, user } = await requireVerifiedUser();
  if (!user) return fail("session_expired");
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return fail("email_address_invalid");
  if (email === user.email?.toLowerCase()) return fail("validation_failed", "That's already your email.");

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: confirmUrl("/profile") },
  );
  if (error) {
    return authFailure(error, {
      email_exists: "That email can't be used. Try a different one.",
      user_already_exists: "That email can't be used. Try a different one.",
    });
  }
  return { ok: true };
}

/**
 * Confirm an email change with a 6-digit code typed in the app. `email` is the
 * address the code was sent to: the new one, or (with "Secure email change")
 * the current one for the second confirmation.
 */
export async function verifyEmailChangeAction(input: { email: string; code: string }): Promise<AuthResult> {
  const { supabase, user } = await requireVerifiedUser();
  if (!user) return fail("session_expired");
  const email = normalizeEmail(input.email);
  const token = cleanCode(input.code);
  if (token.length !== 6) return fail("otp_expired", "Enter the 6-digit code from the email.");

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email_change" });
  if (error) return authFailure(error);

  const state = await settleEmailChange(supabase);
  if (state === "none") return fail("session_expired");
  return { ok: true, status: state };
}

export async function resendEmailChangeAction(): Promise<AuthResult> {
  const { supabase, user } = await requireVerifiedUser();
  const pending = (user as { new_email?: string } | null)?.new_email;
  if (!user || !pending) return fail("validation_failed", "There's no email change waiting.");
  const { error } = await supabase.auth.resend({
    type: "email_change",
    email: pending,
    options: { emailRedirectTo: confirmUrl("/profile") },
  });
  if (error) return authFailure(error);
  return { ok: true };
}

export async function cancelEmailChangeAction(): Promise<AuthResult> {
  const { supabase, user } = await requireVerifiedUser();
  if (!user) return fail("session_expired");
  // Supabase has no API to withdraw a pending change; migration 023 adds a
  // SECURITY DEFINER function that clears it for the caller only.
  const { error } = await supabase.rpc("cancel_email_change");
  if (error) return fail("unknown");
  return { ok: true };
}

export async function signOutEverywhereAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
