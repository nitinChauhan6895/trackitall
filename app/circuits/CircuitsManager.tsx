"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatSeconds, type Circuit } from "@/lib/types";
import { deleteCircuit } from "@/app/actions";

export default function CircuitsManager({ circuits }: { circuits: Circuit[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this circuit?")) return;
    setBusyId(id);
    try {
      await deleteCircuit(id);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-16 safe-top">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-black/5"
        >
          ←
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden>⚡</span> HIIT circuits
        </h1>
      </header>

      <Link
        href="/circuits/new"
        className="mb-5 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-green/50 px-4 py-6 text-center active:bg-green-tint"
      >
        <span aria-hidden className="text-2xl text-green">
          ⊕
        </span>
        <span className="text-base font-semibold text-green">
          Create Circuit
        </span>
        <span className="text-xs text-muted">Build your own HIIT circuit</span>
      </Link>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        My circuits
      </h2>

      {circuits.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-muted">
          No circuits yet. Create your first one above.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {circuits.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-black/5 bg-white"
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-green-tint text-lg"
                >
                  ⚡
                </span>
                <Link href={`/circuits/${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{c.name}</p>
                  <p className="truncate text-sm text-muted">
                    {c.exercises.length} exercise
                    {c.exercises.length === 1 ? "" : "s"} · {c.set_times.length}{" "}
                    set{c.set_times.length === 1 ? "" : "s"}
                  </p>
                  {c.set_times.length > 0 && (
                    <p className="truncate text-xs text-muted">
                      Set times: {c.set_times.map((s) => formatSeconds(s)).join(" / ")}
                    </p>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={busyId === c.id}
                  aria-label={`Delete ${c.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:text-orange disabled:opacity-40"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
