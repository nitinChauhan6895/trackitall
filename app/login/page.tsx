"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, isValidUsername, normalizeUsername } from "@/lib/auth";

type Mode = "signin" | "signup";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isValidUsername(username)) {
      setError(
        "Username must be 3–30 characters: letters, numbers, dot, dash or underscore.",
      );
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const supabase = createClient();

    if (mode === "signup") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      if (!isValidEmail(email)) {
        setError("Enter a valid email — it's used for password recovery.");
        return;
      }

      setPending(true);

      // Username must be unique (it's the login identifier).
      const { data: available, error: rpcErr } = await supabase.rpc(
        "username_available",
        { p_username: normalizeUsername(username) },
      );
      if (rpcErr) {
        setPending(false);
        setError(rpcErr.message);
        return;
      }
      if (available === false) {
        setPending(false);
        setError("That username is taken. Try another.");
        return;
      }

      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: normalizeUsername(username),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
          },
        },
      });

      if (signErr) {
        setPending(false);
        setError(friendlyError(signErr.message, mode));
        return;
      }
      if (!data.session) {
        setPending(false);
        setError(
          "Account created, but the project still requires email confirmation. Disable 'Confirm email' in Supabase → Authentication → Providers → Email.",
        );
        return;
      }

      router.replace("/");
      router.refresh();
      return;
    }

    // ----- Sign in (resolve username → email) -----
    setPending(true);
    const { data: resolvedEmail, error: rpcErr } = await supabase.rpc(
      "email_for_username",
      { p_username: normalizeUsername(username) },
    );
    if (rpcErr) {
      setPending(false);
      setError(rpcErr.message);
      return;
    }
    if (!resolvedEmail) {
      setPending(false);
      setError("No account found for that username.");
      return;
    }

    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: resolvedEmail as string,
      password,
    });
    if (signErr) {
      setPending(false);
      setError(friendlyError(signErr.message, mode));
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink">TrackItAll</h1>
        <p className="mt-2 text-muted">Your workouts, one tap away.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" && (
          <div className="flex gap-3">
            <input
              type="text"
              required
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              required
              autoComplete="family-name"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <input
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
        />

        <input
          type="password"
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        {mode === "signup" && (
          <input
            type="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
            placeholder="Email (for password recovery)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>

        {error && <p className="text-center text-sm text-orange">{error}</p>}
      </form>

      {mode === "signin" && (
        <Link
          href="/forgot"
          className="mt-4 text-center text-sm font-medium text-orange active:opacity-70"
        >
          Forgot password?
        </Link>
      )}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
        }}
        className="mt-6 text-center text-sm text-muted active:text-ink"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}

function friendlyError(message: string, mode: Mode): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Wrong username or password.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (mode === "signup" && m.includes("password")) {
    return "Password must be at least 6 characters.";
  }
  return message;
}
