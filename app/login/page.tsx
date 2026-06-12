"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidUsername, usernameToEmail } from "@/lib/auth";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

    setPending(true);
    const supabase = createClient();
    const email = usernameToEmail(username);

    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setPending(false);
      setError(friendlyError(error.message, mode));
      return;
    }

    if (!data.session) {
      // Happens if email confirmation is still enabled in Supabase.
      setPending(false);
      setError(
        "Account created, but the project still requires email confirmation. Disable 'Confirm email' in Supabase → Authentication → Providers → Email.",
      );
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">TrackItAll</h1>
        <p className="mt-2 text-neutral-400">Your workouts, one tap away.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="sr-only">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-brand"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-brand"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
        }}
        className="mt-6 text-center text-sm text-neutral-400 active:text-neutral-200"
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
    return "That username is taken. Try signing in instead.";
  }
  if (mode === "signup" && m.includes("password")) {
    return "Password must be at least 6 characters.";
  }
  return message;
}
