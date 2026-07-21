"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  exportNutritionCsv,
  exportWorkoutsCsv,
  setShareToCommunity,
  updateProfile,
  signOut,
} from "@/app/actions";
import {
  checkPushSupport,
  isSubscribed,
  notificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushClient";
import { displayName, profileInitial, type Profile } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange";

type View = "menu" | "edit" | "password" | "export";

export default function ProfileScreen({ profile }: { profile: Profile }) {
  const [view, setView] = useState<View>("menu");

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 safe-top">
      <header className="flex items-center gap-3 py-4">
        {view !== "menu" && (
          <button
            type="button"
            onClick={() => setView("menu")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-muted active:bg-white/10"
          >
            ←
          </button>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          {view === "edit"
            ? "Edit profile"
            : view === "password"
              ? "Change password"
              : view === "export"
                ? "Export data"
                : "Profile"}
        </h1>
      </header>

      {view === "menu" && (
        <Menu
          profile={profile}
          onEdit={() => setView("edit")}
          onPassword={() => setView("password")}
          onExport={() => setView("export")}
        />
      )}
      {view === "edit" && <EditProfile profile={profile} onDone={() => setView("menu")} />}
      {view === "password" && <ChangePassword onDone={() => setView("menu")} />}
      {view === "export" && <ExportData />}
    </main>
  );
}

function Menu({
  profile,
  onEdit,
  onPassword,
  onExport,
}: {
  profile: Profile;
  onEdit: () => void;
  onPassword: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center pb-6 pt-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-beige text-3xl font-bold text-ink">
          {profileInitial(profile)}
        </div>
        <p className="mt-3 text-lg font-semibold text-ink">{displayName(profile)}</p>
        <p className="text-sm text-muted">@{profile.username}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
        <ShareRow initial={profile.share_to_community} />
        <Row icon="👤" label="Edit profile" onClick={onEdit} />
        <Row icon="✉️" label={profile.email ?? "No email on file"} muted />
        <Row icon="🔒" label="Change password" onClick={onPassword} />
        <Row icon="⬇️" label="Export data" onClick={onExport} />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-surface">
        <PushRow />
      </div>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange/40 px-4 py-3.5 text-base font-semibold text-orange active:bg-orange-soft"
        >
          <span aria-hidden>⎋</span> Sign out
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        TrackItAll · v{APP_VERSION}
      </p>
    </div>
  );
}

/** Habit reminders. A PWA can't schedule a notification for a future time, so
 *  these arrive as a push from the server — which needs permission first. */
function PushRow() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [support, setSupport] = useState<{ supported: boolean; reason?: string }>({
    supported: true,
  });

  useEffect(() => {
    setSupport(checkPushSupport());
    isSubscribed().then((s) => setOn(s && notificationPermission() === "granted"));
  }, []);

  async function toggle() {
    setBusy(true);
    setError("");
    if (on) {
      await unsubscribeFromPush();
      setOn(false);
    } else {
      const res = await subscribeToPush();
      if (res.ok) setOn(true);
      else setError(res.error);
    }
    setBusy(false);
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="text-lg">
            🔔
          </span>
          <span className="min-w-0">
            <span className="block text-base text-ink">Habit reminders</span>
            <span className="block text-xs text-muted">
              Get a nudge at each habit&rsquo;s reminder time
            </span>
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Habit reminders"
          disabled={busy || !support.supported}
          onClick={toggle}
          className={[
            "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40",
            on ? "bg-green" : "bg-white/15",
          ].join(" ")}
        >
          <span
            className={[
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
              on ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
      {!support.supported && support.reason && (
        <p className="mt-2 text-xs text-muted">{support.reason}</p>
      )}
      {error && <p className="mt-2 text-xs text-orange">{error}</p>}
    </div>
  );
}

function ShareRow({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      await setShareToCommunity(next);
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-white/10 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="w-5 text-center">👥</span>
        <span className="flex-1 text-base text-ink">Share with community</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Share with community"
          disabled={busy}
          onClick={toggle}
          className={[
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
            on ? "bg-green" : "bg-white/15",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
              on ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
      <p className="ml-8 mt-1 text-xs text-muted">
        {on
          ? "Your stats appear in Community, and you can see others'."
          : "Off — your stats stay private."}
      </p>
    </div>
  );
}

// Downloads a CSV built on the server. The BOM makes Excel read it as UTF-8
// instead of mangling any non-ASCII food or exercise names.
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function ExportData() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(kind: "workouts" | "nutrition") {
    setBusy(kind);
    setError("");
    setDone("");
    try {
      const csv =
        kind === "workouts" ? await exportWorkoutsCsv() : await exportNutritionCsv();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`trackitall-${kind}-${stamp}.csv`, csv);
      // A header-only file means there was nothing to export.
      const rows = csv.split("\r\n").length - 1;
      setDone(rows === 0 ? `No ${kind} logged yet.` : `Exported ${rows} rows.`);
    } catch (e: any) {
      setError(e?.message ?? "Export failed. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Download a copy of your data as CSV. Opens in Excel, Numbers or Google
        Sheets.
      </p>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run("workouts")}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-surface px-4 py-3.5 text-left active:bg-white/[0.06] disabled:opacity-50"
      >
        <span>
          <span className="block text-base font-semibold text-ink">Workouts</span>
          <span className="block text-xs text-muted">
            Every exercise and set, one row per set
          </span>
        </span>
        <span className="text-sm text-green">{busy === "workouts" ? "…" : "CSV"}</span>
      </button>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run("nutrition")}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-surface px-4 py-3.5 text-left active:bg-white/[0.06] disabled:opacity-50"
      >
        <span>
          <span className="block text-base font-semibold text-ink">Nutrition</span>
          <span className="block text-xs text-muted">
            Every logged food with its macros
          </span>
        </span>
        <span className="text-sm text-green">{busy === "nutrition" ? "…" : "CSV"}</span>
      </button>

      {done && <p className="text-sm text-green">{done}</p>}
      {error && <p className="text-sm text-orange">{error}</p>}
      <p className="text-xs text-muted">
        Needs a connection — exports are read fresh from the server.
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
  muted,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  const content = (
    <>
      <span aria-hidden className="w-5 text-center">{icon}</span>
      <span className={muted ? "truncate text-muted" : "text-ink"}>{label}</span>
    </>
  );
  if (!onClick) {
    return <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 text-base last:border-0">{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-white/10 px-4 py-4 text-left text-base last:border-0 active:bg-white/10"
    >
      {content}
    </button>
  );
}

function EditProfile({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const router = useRouter();
  const [first, setFirst] = useState(profile.first_name ?? "");
  const [last, setLast] = useState(profile.last_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateProfile({ first_name: first, last_name: last });
      router.refresh();
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 pt-2">
      <label className="block text-sm text-muted">First name</label>
      <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" className={inputClass} />
      <label className="block text-sm text-muted">Last name</label>
      <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" className={inputClass} />
      {error && <p className="text-sm text-orange">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message);
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setTimeout(onDone, 1200);
  }

  return (
    <form onSubmit={save} className="space-y-3 pt-2">
      <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={inputClass} />
      <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={inputClass} />
      {error && <p className="text-sm text-orange">{error}</p>}
      {done && <p className="text-sm text-green">Password updated.</p>}
      <button type="submit" disabled={busy || done} className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60">
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
