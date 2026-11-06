"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { PrimaryButton } from "@/components/auth/Buttons";
import CodeInput from "@/components/auth/CodeInput";
import FormMessage from "@/components/auth/FormMessage";
import ResendButton from "@/components/auth/ResendButton";
import { useTurnstile } from "@/components/auth/Turnstile";
import { callAction } from "@/components/auth/callAction";
import { requestPasswordResetAction, verifyEmailCodeAction } from "@/app/auth/actions";
import { isValidEmail } from "@/lib/auth/validation";

export default function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const captcha = useTurnstile();
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [emailError, setEmailError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function send(target = email): Promise<boolean> {
    setMessage(null);
    if (!isValidEmail(target)) {
      setEmailError("Enter a valid email address.");
      emailRef.current?.focus();
      return false;
    }
    setEmailError("");
    setPending(true);
    const res = await callAction(() => requestPasswordResetAction({ email: target, captchaToken: captcha.token }));
    captcha.reset();
    setPending(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: res.message });
      return false;
    }
    if (sentTo) setMessage({ tone: "success", text: "We've sent another link and code." });
    setSentTo(target.trim());
    setCode("");
    setTimeout(() => codeRef.current?.focus(), 50);
    return true;
  }

  async function verify(value = code) {
    if (!sentTo) return;
    setMessage(null);
    if (value.length !== 6) {
      setMessage({ tone: "error", text: "Enter the 6-digit code from the email." });
      return codeRef.current?.focus();
    }
    setPending(true);
    const res = await callAction(() => verifyEmailCodeAction({ email: sentTo, code: value, kind: "recovery" }));
    if (res.ok) {
      router.replace(res.redirectTo ?? "/reset-password");
      return;
    }
    setPending(false);
    setMessage({ tone: "error", text: res.message });
    setCode("");
    codeRef.current?.focus();
  }

  const footer = (
    <>
      <Link href="/login" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-green active:opacity-70">
        Back to log in
      </Link>
      <p className="max-w-[300px] text-center text-[13px] leading-[1.45] text-subtle">
        Signed up with only a username? Log in, then add your email in Profile so you can reset your password.
      </p>
    </>
  );

  if (sentTo) {
    return (
      <AuthShell
        line1="Reset your"
        line2="password."
        subtitle={
          <>
            If an account exists for <span className="font-semibold text-ink">{sentTo}</span>, we&apos;ve sent a reset
            link and code.
          </>
        }
        footer={footer}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="flex flex-col gap-4"
        >
          <CodeInput
            ref={codeRef}
            value={code}
            onChange={setCode}
            onComplete={(v) => verify(v)}
            error={message?.tone === "error"}
            disabled={pending}
            label="6-digit reset code"
          />
          <PrimaryButton type="submit" loading={pending} loadingLabel="Checking…">
            Continue
          </PrimaryButton>
          <FormMessage tone={message?.tone}>{message?.text}</FormMessage>
          {captcha.widget}
          <div className="flex justify-center">
            <ResendButton onResend={() => send(sentTo)} label="Resend" />
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      line1="Reset your"
      line2="password."
      subtitle="Enter your email and we'll send you a link and a code."
      footer={footer}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex flex-col gap-4"
      >
        <Field
          ref={emailRef}
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        {captcha.widget}
        <PrimaryButton type="submit" loading={pending} loadingLabel="Sending…">
          Send reset link
        </PrimaryButton>
        <FormMessage tone={message?.tone}>{message?.text}</FormMessage>
      </form>
    </AuthShell>
  );
}
