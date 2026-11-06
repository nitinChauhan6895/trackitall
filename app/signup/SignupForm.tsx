"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Field, PasswordField } from "@/components/auth/Field";
import { PrimaryButton } from "@/components/auth/Buttons";
import FormMessage from "@/components/auth/FormMessage";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { useTurnstile } from "@/components/auth/Turnstile";
import { callAction } from "@/components/auth/callAction";
import { signUpAction } from "@/app/auth/actions";
import { isStrongPassword, isValidEmail } from "@/lib/auth/validation";
import { clearLocalCaches } from "@/lib/localCache";

export default function SignupForm() {
  const router = useRouter();
  const captcha = useTurnstile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string; password?: string }>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const errs: typeof fieldError = {};
    if (!name.trim()) errs.name = "Enter your name.";
    if (!isValidEmail(email)) errs.email = "Enter a valid email address.";
    if (!isStrongPassword(password)) errs.password = "Meet every rule below.";
    setFieldError(errs);
    if (errs.name) return nameRef.current?.focus();
    if (errs.email) return emailRef.current?.focus();
    if (errs.password) return pwRef.current?.focus();

    setPending(true);
    const res = await callAction(() => signUpAction({ name, email, password, captchaToken: captcha.token }));
    captcha.reset();
    if (res.ok) {
      if (res.redirectTo === "/") await clearLocalCaches();
      router.replace(res.redirectTo ?? "/verify-email");
      return;
    }
    setPending(false);
    setError(res.message);
    if (res.code === "weak_password") pwRef.current?.focus();
    if (res.code === "email_address_invalid") emailRef.current?.focus();
  }

  return (
    <AuthShell
      line1="Start"
      line2="tracking."
      subtitle="Create your account. It takes a minute."
      footer={
        <p className="text-[15px] text-muted">
          Already have an account?{" "}
          <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-green active:opacity-70">
            Log in
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field
          ref={nameRef}
          label="Name"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldError.name}
          maxLength={80}
        />
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
          error={fieldError.email}
        />
        <PasswordField
          ref={pwRef}
          label="Password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError.password}
        />
        <PasswordChecklist password={password} />
        {captcha.widget}
        <PrimaryButton type="submit" loading={pending} loadingLabel="Creating account…">
          Create account
        </PrimaryButton>
        <FormMessage>{error}</FormMessage>
      </form>
    </AuthShell>
  );
}
