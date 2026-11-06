"use client";

import { useEffect, useRef, useState } from "react";
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
import { resendSignupCodeAction, verifyEmailCodeAction } from "@/app/auth/actions";
import { isValidEmail } from "@/lib/auth/validation";
import { clearLocalCaches } from "@/lib/localCache";

export default function VerifyEmailForm({ initialEmail, justSent }: { initialEmail: string; justSent: boolean }) {
  const router = useRouter();
  const captcha = useTurnstile();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [mobile, setMobile] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const knownEmail = isValidEmail(initialEmail);

  useEffect(() => {
    setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  async function verify(value = code) {
    setMessage(null);
    if (!isValidEmail(email)) {
      setMessage({ tone: "error", text: "Enter the email you signed up with." });
      return emailRef.current?.focus();
    }
    if (value.length !== 6) {
      setMessage({ tone: "error", text: "Enter the 6-digit code from the email." });
      return codeRef.current?.focus();
    }
    setPending(true);
    const res = await callAction(() => verifyEmailCodeAction({ email, code: value, kind: "signup" }));
    if (res.ok) {
      await clearLocalCaches();
      router.replace(res.redirectTo ?? "/");
      router.refresh();
      return;
    }
    setPending(false);
    setMessage({ tone: "error", text: res.message });
    setCode("");
    codeRef.current?.focus();
  }

  async function resend(): Promise<boolean> {
    setMessage(null);
    if (!isValidEmail(email)) {
      setMessage({ tone: "error", text: "Enter the email you signed up with." });
      emailRef.current?.focus();
      return false;
    }
    const res = await callAction(() => resendSignupCodeAction({ email, captchaToken: captcha.token }));
    captcha.reset();
    if (!res.ok) {
      setMessage({ tone: "error", text: res.message });
      return false;
    }
    setMessage({ tone: "success", text: "A new code is on its way." });
    return true;
  }

  return (
    <AuthShell
      line1="Check your"
      line2="inbox."
      subtitle={
        knownEmail ? (
          <>
            We sent a link and a 6-digit code to <span className="font-semibold text-ink">{initialEmail}</span>.
          </>
        ) : (
          "We sent a link and a 6-digit code to your email."
        )
      }
      footer={
        <>
          {mobile && (
            <div className="grid w-full grid-cols-2 gap-2.5">
              <MailAppLink app="gmail" />
              <MailAppLink app="outlook" />
            </div>
          )}
          <p className="text-[15px] text-muted">
            Wrong email?{" "}
            <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold text-green active:opacity-70">
              Start over
            </Link>
          </p>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="flex flex-col gap-4"
      >
        {!knownEmail && (
          <Field
            ref={emailRef}
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <CodeInput
          ref={codeRef}
          value={code}
          onChange={setCode}
          onComplete={(v) => verify(v)}
          error={message?.tone === "error"}
          disabled={pending}
        />
        <PrimaryButton type="submit" loading={pending} loadingLabel="Verifying…">
          Verify email
        </PrimaryButton>
        <FormMessage tone={message?.tone}>{message?.text}</FormMessage>
        {captcha.widget}
        <div className="flex justify-center">
          <ResendButton onResend={resend} startCooling={justSent && knownEmail} />
        </div>
      </form>
    </AuthShell>
  );
}

const MAIL_APPS = {
  gmail: { label: "Open Gmail", scheme: "googlegmail://", web: "https://mail.google.com/" },
  outlook: { label: "Open Outlook", scheme: "ms-outlook://", web: "https://outlook.live.com/mail/" },
};

/** Tries the native app; if the page is still in front shortly after, opens the web inbox. */
function MailAppLink({ app }: { app: keyof typeof MAIL_APPS }) {
  const { label, scheme, web } = MAIL_APPS[app];
  return (
    <a
      href={scheme}
      onClick={() => {
        const started = Date.now();
        setTimeout(() => {
          if (document.visibilityState === "visible" && Date.now() - started < 2500) {
            window.location.href = web;
          }
        }, 1200);
      }}
      className="flex h-[52px] items-center justify-center rounded-full border border-white/[0.12] text-[15px] font-semibold text-ink active:bg-white/[0.06]"
    >
      {label}
    </a>
  );
}
