"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Field, PasswordField } from "@/components/auth/Field";
import { PrimaryButton, TextButton } from "@/components/auth/Buttons";
import CodeInput from "@/components/auth/CodeInput";
import FormMessage from "@/components/auth/FormMessage";
import ResendButton from "@/components/auth/ResendButton";
import { useTurnstile } from "@/components/auth/Turnstile";
import { callAction } from "@/components/auth/callAction";
import {
  requestLoginCodeAction,
  signInWithPasswordAction,
  verifyEmailCodeAction,
} from "@/app/auth/actions";
import { isValidEmail } from "@/lib/auth/validation";
import { clearLocalCaches } from "@/lib/localCache";

type Step = "password" | "code";

export default function LoginForm({ next, initialEmail }: { next: string; initialEmail: string }) {
  const router = useRouter();
  const captcha = useTurnstile();

  const [step, setStep] = useState<Step>("password");
  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeEmail, setCodeEmail] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; email?: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ identifier?: string; password?: string }>({});
  // Wrong email/password: both fields outlined, one message under the form.
  const [credsInvalid, setCredsInvalid] = useState(false);

  const idRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function finish(redirectTo?: string) {
    // Drop any cached pages/data from a previous account on this device.
    await clearLocalCaches();
    router.replace(redirectTo ?? next);
    router.refresh();
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCredsInvalid(false);
    const errs: typeof fieldError = {};
    if (!identifier.trim()) errs.identifier = "Enter your email.";
    if (!password) errs.password = "Enter your password.";
    setFieldError(errs);
    if (errs.identifier) return idRef.current?.focus();
    if (errs.password) return pwRef.current?.focus();

    setPending(true);
    const res = await callAction(() =>
      signInWithPasswordAction({ identifier, password, next, captchaToken: captcha.token }),
    );
    captcha.reset();
    if (res.ok) return finish(res.redirectTo);
    setPending(false);
    setError(res);
    if (res.code === "invalid_credentials") {
      setCredsInvalid(true);
      pwRef.current?.focus();
      pwRef.current?.select();
    }
  }

  async function sendCode(): Promise<boolean> {
    setError(null);
    const email = identifier.trim();
    if (!isValidEmail(email)) {
      setFieldError({ identifier: "Enter your email address to get a code." });
      idRef.current?.focus();
      return false;
    }
    setPending(true);
    const res = await callAction(() => requestLoginCodeAction({ email, captchaToken: captcha.token }));
    captcha.reset();
    setPending(false);
    if (!res.ok && res.code !== "email_rate_limited") {
      setError(res);
      return false;
    }
    setFieldError({});
    setCodeEmail(email);
    setCode("");
    setStep("code");
    if (!res.ok) setError(res);
    setTimeout(() => codeRef.current?.focus(), 50);
    return res.ok;
  }

  async function submitCode(value = code) {
    setError(null);
    if (value.length !== 6) {
      setError({ code: "otp", message: "Enter the 6-digit code from the email." });
      return codeRef.current?.focus();
    }
    setPending(true);
    const res = await callAction(() =>
      verifyEmailCodeAction({ email: codeEmail, code: value, kind: "login", next }),
    );
    if (res.ok) return finish(res.redirectTo);
    setPending(false);
    setError(res);
    setCode("");
    codeRef.current?.focus();
  }

  if (step === "code") {
    return (
      <AuthShell
        line1="Welcome"
        line2="back."
        subtitle={
          <>
            If an account exists for <span className="font-semibold text-ink">{codeEmail}</span>, we&apos;ve sent a
            6-digit code.
          </>
        }
        footer={
          <TextButton
            onClick={() => {
              setStep("password");
              setError(null);
            }}
          >
            Use password instead
          </TextButton>
        }
        showVersion
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
          className="flex flex-col gap-4"
        >
          <CodeInput
            ref={codeRef}
            value={code}
            onChange={setCode}
            onComplete={(v) => submitCode(v)}
            error={!!error}
            disabled={pending}
          />
          <FormMessage>{error?.message}</FormMessage>
          <PrimaryButton type="submit" loading={pending} loadingLabel="Checking…">
            Log in
          </PrimaryButton>
          {captcha.widget}
          <div className="flex justify-center">
            <ResendButton onResend={sendCode} />
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      line1="Welcome"
      line2="back."
      footer={
        <>
          <TextButton onClick={sendCode} disabled={pending}>
            Email me a code instead
          </TextButton>
          <p className="text-[15px] text-muted">
            New here?{" "}
            <Link
              href={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
              className="inline-flex min-h-11 items-center font-semibold text-green active:opacity-70"
            >
              Create an account
            </Link>
          </p>
        </>
      }
      showVersion
    >
      <form noValidate onSubmit={submitPassword} className="flex flex-col gap-4">
        <Field
          ref={idRef}
          label="Email or username"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldError.identifier}
          invalid={credsInvalid}
        />
        <PasswordField
          ref={pwRef}
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError.password}
          invalid={credsInvalid}
          aside={
            <Link
              href={isValidEmail(identifier) ? `/forgot?email=${encodeURIComponent(identifier.trim())}` : "/forgot"}
              className="-my-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-green active:opacity-70"
            >
              Forgot?
            </Link>
          }
        />
        {captcha.widget}
        <PrimaryButton type="submit" loading={pending} loadingLabel="Logging in…">
          Log in
        </PrimaryButton>
        <FormMessage>
          {error && (
            <>
              <span>{error.message}</span>
              {error.code === "email_not_confirmed" && (
                <Link
                  href={`/verify-email?resend=1${error.email ? `&email=${encodeURIComponent(error.email)}` : ""}`}
                  className="font-semibold text-green"
                >
                  Resend verification
                </Link>
              )}
            </>
          )}
        </FormMessage>
      </form>
    </AuthShell>
  );
}
