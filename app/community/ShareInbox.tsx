"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptShare, declineShare } from "@/app/actions";
import { MUSCLE_GROUP_LABELS, type IncomingShare } from "@/lib/types";

function fmtDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ShareInbox({ shares }: { shares: IncomingShare[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (shares.length === 0) return null;

  function act(id: string, fn: (id: string) => Promise<void>) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn(id);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <section className="mt-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-base font-semibold">
        <span aria-hidden>📥</span> Shared with you
      </h2>
      <ul className="space-y-2.5">
        {shares.map((s) => {
          const busy = pending && busyId === s.id;
          return (
            <li
              key={s.id}
              className="rounded-2xl border border-black/5 bg-white p-4"
            >
              <p className="text-sm text-ink">
                <span className="font-semibold">{s.from_name}</span> shared{" "}
                <span className="font-semibold">{MUSCLE_GROUP_LABELS[s.muscle_group]}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {fmtDate(s.workout_date)} · {s.exercise_count}{" "}
                {s.exercise_count === 1 ? "exercise" : "exercises"} · {s.set_count} sets
              </p>
              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(s.id, acceptShare)}
                  className="flex-1 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? "…" : "Accept"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(s.id, declineShare)}
                  className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-muted active:bg-black/5 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
