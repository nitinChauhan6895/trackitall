"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setShareToCommunity, updateProfile, signOut } from "@/app/actions";
import {
  displayName,
  profileInitial,
  type Profile,
} from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange";

type View = "menu" | "edit" | "password";

export default function ProfilePane({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");

  function close() {
    setOpen(false);
    // Reset to the menu after the slide-out finishes.
    setTimeout(() => setView("menu"), 250);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open profile"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-beige text-lg font-bold text-ink active:scale-95"
      >
        {profileInitial(profile)}
      </button>

      {/* Backdrop */}
      <div
        onClick={close}
        aria-hidden
        className={[
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* Pane */}
      <aside
        role="dialog"
        aria-label="Profile"
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-[84%] max-w-sm flex-col bg-page shadow-xl transition-transform duration-300 ease-out safe-top safe-bottom",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">
            {view === "edit"
              ? "Edit profile"
              : view === "password"
                ? "Change password"
                : "Profile"}
          </h2>
          <button
            type="button"
            onClick={view === "menu" ? close : () => setView("menu")}
            aria-label={view === "menu" ? "Close" : "Back"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-muted active:bg-white/10"
          >
            {view === "menu" ? "✕" : "←"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {view === "menu" && (
            <Menu profile={profile} onEdit={() => setView("edit")} onPassword={() => setView("password")} />
          )}
          {view === "edit" && (
            <EditProfile profile={profile} onDone={() => setView("menu")} />
          )}
          {view === "password" && (
            <ChangePassword onDone={() => setView("menu")} />
          )}
        </div>
      </aside>
    </>
  );
}

function Menu({
  profile,
  onEdit,
  onPassword,
}: {
  profile: Profile;
  onEdit: () => void;
  onPassword: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center pb-6 pt-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-beige text-3xl font-bold text-ink">
          {profileInitial(profile)}
        </div>
        <p className="mt-3 text-lg font-semibold text-ink">
          {displayName(profile)}
        </p>
        <p className="text-sm text-muted">@{profile.username}</p>
      </div>

      <ShareToggle initial={profile.share_to_community} />

      <div className="border-t border-white/10">
        <Row icon="👤" label="Edit profile" onClick={onEdit} />
        <Row icon="✉️" label={profile.email ?? "No email on file"} muted />
        <Row icon="🔒" label="Change password" onClick={onPassword} />
      </div>

      <div className="mt-auto border-t border-white/10 pt-2">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-1 py-4 text-left text-base font-medium text-orange active:opacity-70"
          >
            <span aria-hidden>⎋</span> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function ShareToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setBusy(true);
    try {
      await setShareToCommunity(next);
    } catch {
      setOn(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="my-2 rounded-2xl bg-green-tint p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-lg">
          👥
        </span>
        <span className="flex-1 font-medium text-ink">Share with community</span>
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
              "absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
              on ? "translate-x-[22px]" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {on
          ? "Your stats appear in Community, and you can see others'."
          : "Off — your stats stay private and Community stays hidden."}
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
      <span aria-hidden className="w-5 text-center">
        {icon}
      </span>
      <span className={muted ? "text-muted" : "text-ink"}>{label}</span>
    </>
  );
  if (!onClick) {
    return (
      <div className="flex items-center gap-3 px-1 py-4 text-base">{content}</div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-1 py-4 text-left text-base active:opacity-70"
    >
      {content}
    </button>
  );
}

function EditProfile({
  profile,
  onDone,
}: {
  profile: Profile;
  onDone: () => void;
}) {
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
      <input
        value={first}
        onChange={(e) => setFirst(e.target.value)}
        placeholder="First name"
        className={inputClass}
      />
      <label className="block text-sm text-muted">Last name</label>
      <input
        value={last}
        onChange={(e) => setLast(e.target.value)}
        placeholder="Last name"
        className={inputClass}
      />
      {error && <p className="text-sm text-orange">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60"
      >
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
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
      <input
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        className={inputClass}
      />
      <input
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        className={inputClass}
      />
      {error && <p className="text-sm text-orange">{error}</p>}
      {done && <p className="text-sm text-green">Password updated.</p>}
      <button
        type="submit"
        disabled={busy || done}
        className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
