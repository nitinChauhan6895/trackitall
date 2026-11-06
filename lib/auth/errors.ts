// Supabase Auth error codes → the copy people see. One place, so every screen
// says the same thing for the same problem and raw error strings never leak.

export const NETWORK_MESSAGE = "Can't reach TrackItAll. Check your connection.";
export const RATE_LIMIT_MESSAGE = "Too many attempts. Try again in a few minutes.";
export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export type AuthFailure = { ok: false; code: string; message: string; email?: string };
export type AuthOk = {
  ok: true;
  redirectTo?: string;
  /** Email change: "done", or still waiting on the code sent to the current address. */
  status?: "done" | "pending_current";
};
export type AuthResult = AuthOk | AuthFailure;

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Please verify your email first.",
  otp_expired: "That code is incorrect or has expired. Request a new one.",
  weak_password: "Use at least 8 characters with a letter and a number.",
  same_password: "Choose a password you haven't used here before.",
  captcha_failed: "Please complete the security check and try again.",
  email_address_invalid: "Enter a valid email address.",
  validation_failed: "Check the details and try again.",
  session_expired: "Your session has expired. Please start again.",
  reauthentication_needed: "For your security, log in again before changing this.",
  network: NETWORK_MESSAGE,
  rate_limited: RATE_LIMIT_MESSAGE,
};

const RATE_LIMIT_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "over_sms_send_rate_limit",
]);

type MaybeAuthError = {
  code?: string;
  status?: number;
  name?: string;
  message?: string;
  reasons?: string[];
};

/** The app's code for a Supabase error: its own code where it has one. */
export function authErrorCode(err: unknown): string {
  const e = (err ?? {}) as MaybeAuthError;
  if (e.name === "AuthRetryableFetchError" || /fetch failed|network/i.test(e.message ?? "")) {
    return "network";
  }
  if ((e.code && RATE_LIMIT_CODES.has(e.code)) || e.status === 429) return "rate_limited";
  if (e.code) return e.code;
  // Older servers send no code: fall back on the message.
  const m = (e.message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "invalid_credentials";
  if (m.includes("email not confirmed")) return "email_not_confirmed";
  if (m.includes("expired") || (m.includes("invalid") && m.includes("token"))) return "otp_expired";
  if (m.includes("captcha")) return "captcha_failed";
  return "unknown";
}

export function authMessage(code: string): string {
  return MESSAGES[code] ?? GENERIC_MESSAGE;
}

export function authFailure(err: unknown, overrides: Record<string, string> = {}): AuthFailure {
  const code = authErrorCode(err);
  const e = (err ?? {}) as MaybeAuthError;
  if (code === "weak_password" && e.reasons?.includes("pwned")) {
    return {
      ok: false,
      code,
      message: "That password has appeared in a data breach. Choose a different one.",
    };
  }
  return { ok: false, code, message: overrides[code] ?? authMessage(code) };
}

export function fail(code: string, message?: string): AuthFailure {
  return { ok: false, code, message: message ?? authMessage(code) };
}

export function isRateLimit(code: string): boolean {
  return code === "rate_limited";
}

/** Copy for the /auth/error screen, keyed by the email flow the link was for. */
export type AuthFlow = "email" | "signup" | "recovery" | "email_change" | "magiclink" | "oauth";

export function parseFlow(raw: string | null | undefined): AuthFlow {
  const flows: AuthFlow[] = ["email", "signup", "recovery", "email_change", "magiclink", "oauth"];
  return (flows as string[]).includes(raw ?? "") ? (raw as AuthFlow) : "email";
}
