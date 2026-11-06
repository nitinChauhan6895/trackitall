"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  cancelEmailChangeAction,
  changeEmailAction,
  changePasswordAction,
  resendEmailChangeAction,
  signOutEverywhereAction,
} from "@/app/auth/actions";
import { Field, PasswordField } from "@/components/auth/Field";
import FormMessage from "@/components/auth/FormMessage";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { useTurnstile } from "@/components/auth/Turnstile";
import { callAction } from "@/components/auth/callAction";
import { isStrongPassword, isValidEmail } from "@/lib/auth/validation";

const inputClass =
  "elevation-2 h-[52px] w-full rounded-2xl px-4 text-base text-ink outline-none placeholder:text-subtle focus:border-green/60";
const PRIMARY_BUTTON =
  "h-[52px] w-full rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60";

type View = "menu" | "edit" | "password" | "email" | "export";

export type AccountInfo = {
  email: string | null;
  verified: boolean;
  /** Address waiting for confirmation after a change, if any. */
  pendingEmail: string | null;
};

const TITLES: Record<Exclude<View, "menu">, string> = {
  edit: "Edit profile",
  password: "Change password",
  email: "Change email",
  export: "Export data",
};

export type ProfileSummary = {
  workouts: number;
  badgesEarned: number;
  badgesTotal: number;
  bestStreak: number;
};

export default function ProfileScreen({
  profile,
  summary,
  account,
  initialView = "menu",
}: {
  profile: Profile;
  summary: ProfileSummary | null;
  account: AccountInfo | null;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);

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
            {TITLES[view]}
          </h1>
        </div>
      )}

      {view === "menu" && (
        <Menu
          profile={profile}
          summary={summary}
          account={account}
          onEdit={() => setView("edit")}
          onPassword={() => setView("password")}
          onEmail={() => setView("email")}
          onExport={() => setView("export")}
        />
      )}
      {view === "edit" && <EditProfile profile={profile} onDone={() => setView("menu")} />}
      {view === "password" && <ChangePassword onDone={() => setView("menu")} />}
      {view === "email" && <ChangeEmail current={account?.email ?? profile.email} onDone={() => setView("menu")} />}
      {view === "export" && <ExportData />}
    </main>
  );
}

function Menu({
  profile,
  summary,
  account,
  onEdit,
  onPassword,
  onEmail,
  onExport,
}: {
  profile: Profile;
  summary: ProfileSummary | null;
  account: AccountInfo | null;
  onEdit: () => void;
  onPassword: () => void;
  onEmail: () => void;
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
        <EmailRow email={account?.email ?? profile.email} account={account} />
        <AccountButton label="Change email" onClick={onEmail} />
        <AccountButton label="Change password" onClick={onPassword} />
        <AccountButton label="Export data" onClick={onExport} />
      </SettingsGroup>

      <div className="flex flex-col items-center gap-3.5">
        <form action={signOut} className="w-full">
          <button type="submit" className="h-[52px] w-full rounded-full border border-white/[0.14] text-[15px] font-semibold active:bg-white/10">
            Sign out
          </button>
        </form>
        <form action={signOutEverywhereAction} className="w-full">
          <button type="submit" className="h-11 w-full text-[15px] font-semibold text-muted active:text-ink">
            Sign out of all devices
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

function EmailRow({ email, account }: { email: string | null; account: AccountInfo | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const pending = account?.pendingEmail;

  async function run(kind: "resend" | "cancel") {
    setBusy(true);
    setMessage(null);
    const res = await callAction(kind === "resend" ? resendEmailChangeAction : cancelEmailChangeAction);
    setBusy(false);
    if (!res.ok) return setMessage({ tone: "error", text: res.message });
    if (kind === "resend") setMessage({ tone: "success", text: "Confirmation emails sent again." });
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-surface-2 px-[18px] py-3.5">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-base font-semibold">Email</span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm text-muted">{email ?? "Not on file"}</span>
          {account?.verified && <span className="shrink-0 text-xs font-semibold text-green">Verified</span>}
        </span>
      </div>
      {pending && (
        <div className="flex flex-wrap items-center gap-x-1 text-[13px] text-muted">
          <span>
            Pending: <span className="text-ink">{pending}</span>
          </span>
          <span aria-hidden>·</span>
          <button type="button" disabled={busy} onClick={() => run("resend")} className="min-h-11 px-1 font-semibold text-green disabled:opacity-50">
            Resend
          </button>
          <span aria-hidden>·</span>
          <button type="button" disabled={busy} onClick={() => run("cancel")} className="min-h-11 px-1 font-semibold text-green disabled:opacity-50">
            Cancel
          </button>
        </div>
      )}
      <FormMessage tone={message?.tone}>{message?.text}</FormMessage>
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const captcha = useTurnstile();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{ current?: string; password?: string; confirm?: string }>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const errs: typeof fieldError = {};
    if (!current) errs.current = "Enter your current password.";
    if (!isStrongPassword(password)) errs.password = "Meet every rule below.";
    else if (password !== confirm) errs.confirm = "Passwords don't match.";
    setFieldError(errs);
    const first = (["current", "password", "confirm"] as const).find((k) => errs[k]);
    if (first) return document.getElementById(`pw-${first}`)?.focus();

    setBusy(true);
    const res = await callAction(() => changePasswordAction({ current, password, captchaToken: captcha.token }));
    captcha.reset();
    setBusy(false);
    if (!res.ok) {
      if (res.code === "invalid_credentials") {
        setFieldError({ current: res.message });
        document.getElementById("pw-current")?.focus();
      } else setError(res.message);
      return;
    }
    setDone(true);
    setTimeout(onDone, 1500);
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-4">
      <div className="elevation-1 flex flex-col gap-4 rounded-[28px] p-5">
        <PasswordField
          id="pw-current"
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={fieldError.current}
        />
        <PasswordField
          id="pw-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError.password}
        />
        <PasswordField
          id="pw-confirm"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldError.confirm}
          showCapsHint={false}
        />
        <PasswordChecklist password={password} confirm={confirm} />
        {captcha.widget}
      </div>
      <p className="px-1 text-[13px] text-muted">Other devices will be signed out.</p>
      <FormMessage tone={done ? "success" : "error"}>{done ? "Password updated." : error}</FormMessage>
      <button type="submit" disabled={busy || done} className={PRIMARY_BUTTON}>
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

function ChangeEmail({ current, onDone }: { current: string | null; onDone: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return document.getElementById("new-email")?.focus();
    }
    setBusy(true);
    const res = await callAction(() => changeEmailAction({ email }));
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return document.getElementById("new-email")?.focus();
    }
    setSentTo(email.trim());
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="elevation-1 flex flex-col gap-2 rounded-[28px] p-5">
          <span className="font-display text-xl font-semibold">Check both inboxes</span>
          <p className="text-[15px] leading-[1.45] text-muted">
            We sent confirmation links to {current ? <span className="text-ink">{current}</span> : "your current address"} and{" "}
            <span className="text-ink">{sentTo}</span>. Your email changes once both are confirmed.
          </p>
        </div>
        <button type="button" onClick={onDone} className={PRIMARY_BUTTON}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-4">
      <div className="elevation-1 flex flex-col gap-4 rounded-[28px] p-5">
        {current && (
          <p className="text-[13px] text-muted">
            Current: <span className="text-ink">{current}</span>
          </p>
        )}
        <Field
          id="new-email"
          label="New email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error || undefined}
        />
      </div>
      <p className="px-1 text-[13px] text-muted">For your security we confirm the change at both addresses.</p>
      <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? "Sending…" : "Send confirmation"}
      </button>
    </form>
  );
}
