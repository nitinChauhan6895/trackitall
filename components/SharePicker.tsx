"use client";

import { useEffect, useState } from "react";
import { loadShareableUsers } from "@/app/actions";
import { displayName, type ShareableUser } from "@/lib/types";

// People-picker sheet shared by "share this muscle group" and "share the whole
// day". The caller supplies only what to do per selected user, so both entry
// points stay in step (one modal to fix, one set of states to get right).
export default function SharePicker({
  title,
  subtitle,
  onShare,
  onClose,
}: {
  title: string;
  subtitle: string;
  /** Called once per selected recipient. Throwing surfaces the message. */
  onShare: (userId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<ShareableUser[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sharedCount, setSharedCount] = useState(0);

  useEffect(() => {
    loadShareableUsers()
      .then(setUsers)
      .catch(() => setError("Couldn't load people."));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      for (const id of selected) await onShare(id);
      setSharedCount(selected.size);
      setTimeout(onClose, 1300);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't share.");
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-40 bg-black/60" />
      <div
        role="dialog"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-page shadow-xl safe-bottom"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink">{title}</h3>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:bg-white/10"
          >
            ✕
          </button>
        </div>

        {sharedCount > 0 ? (
          <p className="px-4 py-10 text-center text-sm font-medium text-green">
            ✓ Shared with {sharedCount} {sharedCount === 1 ? "person" : "people"}!
          </p>
        ) : users === null ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No one is accepting shares yet. People who turn on “Share with
            community” in their profile will appear here.
          </p>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-1">
            {users.map((u) => {
              const on = selected.has(u.user_id);
              return (
                <li key={u.user_id}>
                  <button
                    type="button"
                    onClick={() => toggle(u.user_id)}
                    aria-pressed={on}
                    className={[
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left",
                      on
                        ? "border-orange bg-orange-soft"
                        : "border-white/10 bg-surface active:bg-white/10",
                    ].join(" ")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {displayName(u)}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        @{u.username}
                      </span>
                    </span>
                    <span
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                        on
                          ? "bg-orange text-white"
                          : "border border-white/20 text-transparent",
                      ].join(" ")}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {sharedCount === 0 && users && users.length > 0 && (
          <div className="border-t border-white/10 px-4 pb-5 pt-3">
            {error && <p className="mb-2 text-center text-sm text-orange">{error}</p>}
            <button
              type="button"
              disabled={selected.size === 0 || busy}
              onClick={submit}
              className="w-full rounded-2xl bg-orange px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {busy
                ? "Sharing…"
                : selected.size === 0
                  ? "Select people"
                  : `Share with ${selected.size}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
