"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, normalizeUsername } from "@/lib/auth";

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange";

export default function ForgotPasswordPage() {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const raw = value.trim();
    if (!raw) {
      setError("Enter your email or username.");
      return;
    }

    setPending(true);
    const supabase = createClient();

    // Resolve to the real email — accept either an email or a username.
    let email = raw;
    if (!isValidEmail(raw)) {
      const { data, error: rpcErr } = await supabase.rpc("email_for_username", {
        p_username: normalizeUsername(raw),
      });
      if (rpcErr) {
        setPending(false);
        setError(rpcErr.message);
        return;
      }
      if (!data) {
        // Don't reveal whether an account exists — show the same success state.
        setPending(false);
        setSent(true);
        return;
      }
      email = data as string;
    }

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });

    setPending(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll email you a link to set a new password.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-black/5 bg-white p-5 text-center">
          <p className="text-sm text-ink">
            If an account matches that, a reset link is on its way. Check your
            inbox (and spam).
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Email or username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
          {error && <p className="text-center text-sm text-orange">{error}</p>}
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 text-center text-sm text-muted active:text-ink"
      >
        ← Back to sign in
      </Link>
    </main>
  );
}
