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
  "elevation-2 h-[52px] w-full rounded-2xl px-4 text-base text-ink outline-none placeholder:text-subtle focus:border-green/60";
const PRIMARY_BUTTON =
  "h-[52px] w-full rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60";

type View = "menu" | "edit" | "password" | "export";

export type ProfileSummary = {
  workouts: number;
  badgesEarned: number;
  badgesTotal: number;
  bestStreak: number;
};

export default function ProfileScreen({
  profile,
  summary,
}: {
  profile: Profile;
  summary: ProfileSummary | null;
}) {
  const [view, setView] = useState<View>("menu");

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-36 safe-top">
      {view === "menu" ? (
        <h1 className="px-1 pt-5 font-display text-[30px] font-bold tracking-[-0.02em]">Profile</h1>
      ) : (
        <div className="flex items-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => setView("menu")}
            aria-label="Back"
            className="elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-display text-[26px] font-bold tracking-[-0.02em]">
            {view === "edit" ? "Edit profile" : view === "password" ? "Change password" : "Export data"}
          </h1>
        </div>
      )}

      {view === "menu" && (
        <Menu
          profile={profile}
          summary={summary}
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
  summary,
  onEdit,
  onPassword,
  onExport,
}: {
  profile: Profile;
  summary: ProfileSummary | null;
  onEdit: () => void;
  onPassword: () => void;
  onExport: () => void;
}) {
  return (
    <>
      {/* Identity hero */}
      <section className="elevation-1 flex flex-col gap-5 rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex items-center gap-4">
          <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full bg-green font-display text-[30px] font-bold text-ink-inverse">
            {profileInitial(profile)}
          </span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="truncate font-display text-2xl font-bold tracking-[-0.02em]">{displayName(profile)}</span>
            <span className="truncate text-sm text-muted">@{profile.username}</span>
          </span>
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Workouts">{summary.workouts}</MiniStat>
            <MiniStat label="Badges">
              {summary.badgesEarned}
              <span className="text-sm text-subtle">/{summary.badgesTotal}</span>
            </MiniStat>
            <MiniStat label="Best streak" gold>
              {summary.bestStreak}
            </MiniStat>
          </div>
        )}
        <button type="button" onClick={onEdit} className="elevation-2 h-12 rounded-full text-[15px] font-semibold active:bg-white/10">
          Edit profile
        </button>
      </section>

      <SettingsGroup title="PREFERENCES">
        <ShareRow initial={profile.share_to_community} />
        <PushRow />
      </SettingsGroup>

      <SettingsGroup title="ACCOUNT">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-surface-2 px-[18px]">
          <span className="text-base font-semibold">Email</span>
          <span className="truncate text-sm text-muted">{profile.email ?? "Not on file"}</span>
        </div>
        <AccountButton label="Change password" onClick={onPassword} />
        <AccountButton label="Export data" onClick={onExport} />
      </SettingsGroup>

      <div className="flex flex-col items-center gap-3.5">
        <form action={signOut} className="w-full">
          <button type="submit" className="h-[52px] w-full rounded-full border border-white/[0.14] text-[15px] font-semibold active:bg-white/10">
            Sign out
          </button>
        </form>
        <p className="text-xs text-subtle">TrackItAll · v{APP_VERSION}</p>
      </div>
    </>
  );
}

function MiniStat({ label, gold, children }: { label: string; gold?: boolean; children: React.ReactNode }) {
  return (
    <div className="elevation-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-3">
      <span className={`font-display text-2xl font-semibold ${gold ? "text-gold" : ""}`}>{children}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className="px-1 text-xs font-semibold tracking-[0.08em] text-muted">{title}</span>
      <div className="elevation-1 flex flex-col rounded-3xl">{children}</div>
    </section>
  );
}

function AccountButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center justify-between border-b border-surface-2 px-[18px] text-left text-base font-semibold last:border-0 active:bg-white/[0.04]"
    >
      {label}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-subtle">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

// 52×32 switch from the redesign: green track with a light knob when on.
function Switch({
  on,
  label,
  disabled,
  onClick,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-8 w-[52px] flex-none items-center rounded-full p-0.5 transition-colors disabled:opacity-40",
        on ? "justify-end bg-green" : "justify-start bg-[#3A3A3A]",
      ].join(" ")}
    >
      <span className={`h-7 w-7 rounded-full ${on ? "bg-ink" : "bg-[#D4D4D4]"}`} />
    </button>
  );
}

function SettingRow({
  title,
  description,
  control,
  footer,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-surface-2 px-[18px] py-4 last:border-0">
      <div className="flex items-center gap-4">
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-base font-semibold">{title}</span>
          <span className="text-[13px] leading-[1.4] text-muted">{description}</span>
        </span>
        {control}
      </div>
      {footer}
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
    <SettingRow
      title="Habit reminders"
      description="Get a nudge at each habit’s reminder time."
      control={<Switch on={on} label="Habit reminders" disabled={busy || !support.supported} onClick={toggle} />}
      footer={
        <>
          {!support.supported && support.reason && <p className="text-xs text-muted">{support.reason}</p>}
          {error && <p className="text-xs text-gold">{error}</p>}
        </>
      }
    />
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
    <SettingRow
      title="Share with community"
      description={on ? "Your stats appear in Community, and you can see others'." : "Off: your stats stay private."}
      control={<Switch on={on} label="Share with community" disabled={busy} onClick={toggle} />}
    />
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
      <p className="px-1 text-sm text-muted">
        Download a copy of your data as CSV. Opens in Excel, Numbers or Google
        Sheets.
      </p>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run("workouts")}
        className="elevation-1 pressable flex w-full items-center justify-between rounded-3xl px-[18px] py-4 text-left disabled:opacity-50"
      >
        <span>
          <span className="block text-base font-semibold text-ink">Workouts</span>
          <span className="block text-xs text-muted">
            Every exercise and set, one row per set
          </span>
        </span>
        <span className="text-sm font-semibold text-green">{busy === "workouts" ? "…" : "CSV"}</span>
      </button>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run("nutrition")}
        className="elevation-1 pressable flex w-full items-center justify-between rounded-3xl px-[18px] py-4 text-left disabled:opacity-50"
      >
        <span>
          <span className="block text-base font-semibold text-ink">Nutrition</span>
          <span className="block text-xs text-muted">
            Every logged food with its macros
          </span>
        </span>
        <span className="text-sm font-semibold text-green">{busy === "nutrition" ? "…" : "CSV"}</span>
      </button>

      {done && <p className="text-sm text-green">{done}</p>}
      {error && <p className="text-sm text-gold">{error}</p>}
      <p className="text-xs text-muted">
        Needs a connection — exports are read fresh from the server.
      </p>
    </div>
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
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="elevation-1 flex flex-col gap-4 rounded-[28px] p-5">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">FIRST NAME</span>
          <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">LAST NAME</span>
          <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" className={inputClass} />
        </label>
      </div>
      {error && <p className="text-center text-sm text-gold">{error}</p>}
      <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
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
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="elevation-1 flex flex-col gap-2.5 rounded-[28px] p-5">
        <input type="password" autoComplete="new-password" aria-label="New password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={inputClass} />
        <input type="password" autoComplete="new-password" aria-label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={inputClass} />
      </div>
      {error && <p className="text-center text-sm text-gold">{error}</p>}
      {done && <p className="text-center text-sm text-green">Password updated.</p>}
      <button type="submit" disabled={busy || done} className={PRIMARY_BUTTON}>
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
