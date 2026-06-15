"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      // PKCE / default-template links arrive with ?code=…
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setStatus(session ? "ready" : "invalid");
    }

    // The recovery session may also be set asynchronously from the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setStatus("ready");
      else if (event === "SIGNED_OUT") setStatus("invalid");
    });

    init();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setPending(false);
      setError(updErr.message);
      return;
    }
    setStatus("done");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Set a new password
        </h1>
      </div>

      {status === "checking" && (
        <p className="text-center text-sm text-muted">Verifying your link…</p>
      )}

      {status === "invalid" && (
        <div className="rounded-2xl border border-black/5 bg-white p-5 text-center">
          <p className="text-sm text-ink">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot"
            className="mt-3 inline-block text-sm font-medium text-orange"
          >
            Request a new link
          </Link>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
          {error && <p className="text-center text-sm text-orange">{error}</p>}
        </form>
      )}

      {status === "done" && (
        <div className="rounded-2xl border border-black/5 bg-white p-5 text-center">
          <p className="text-sm text-ink">Your password has been updated.</p>
          <button
            type="button"
            onClick={() => {
              router.replace("/");
              router.refresh();
            }}
            className="mt-3 inline-block rounded-xl bg-green px-4 py-2 text-sm font-semibold text-white"
          >
            Go to home
          </button>
        </div>
      )}
    </main>
  );
}
