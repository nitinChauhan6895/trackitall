"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/Field";
import { PrimaryButton } from "@/components/auth/Buttons";
import FormMessage from "@/components/auth/FormMessage";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { callAction } from "@/components/auth/callAction";
import { resetPasswordAction } from "@/app/auth/actions";
import { isStrongPassword } from "@/lib/auth/validation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{ password?: string; confirm?: string }>({});
  const pwRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const errs: typeof fieldError = {};
    if (!isStrongPassword(password)) errs.password = "Meet every rule below.";
    else if (confirm !== password) errs.confirm = "Passwords don't match.";
    setFieldError(errs);
    if (errs.password) return pwRef.current?.focus();
    if (errs.confirm) return confirmRef.current?.focus();

    setPending(true);
    const res = await callAction(() => resetPasswordAction({ password }));
    if (res.ok) {
      router.replace(res.redirectTo ?? "/");
      router.refresh();
      return;
    }
    if (res.code === "session_expired") {
      router.replace("/auth/error?reason=expired&flow=recovery");
      return;
    }
    setPending(false);
    setError(res.message);
    pwRef.current?.focus();
  }

  return (
    <AuthShell line1="Choose a new" line2="password." subtitle="You'll use it the next time you log in.">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          ref={pwRef}
          label="New password"
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError.password}
        />
        <PasswordField
          ref={confirmRef}
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldError.confirm}
          showCapsHint={false}
        />
        <PasswordChecklist password={password} confirm={confirm} />
        <PrimaryButton type="submit" loading={pending} loadingLabel="Updating…">
          Update password
        </PrimaryButton>
        <FormMessage>{error}</FormMessage>
      </form>
    </AuthShell>
  );
}
