"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatPrValue,
  formatSeconds,
  parseTimeToSeconds,
  type Pr,
  type PrUnitType,
} from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { deletePr, savePr } from "@/app/actions";
import { PrCard } from "@/components/HomeCards";

function fmtDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const UNIT_OPTIONS: { value: PrUnitType; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "time", label: "time (mm:ss)" },
  { value: "distance", label: "distance" },
];

export default function PrManager({ initialPrs }: { initialPrs: Pr[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Pr | null>(null);
  const [adding, setAdding] = useState(false);

  function done() {
    setEditing(null);
    setAdding(false);
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-16 safe-top">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-white/10"
        >
          ←
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden>🏆</span> PR corner
        </h1>
      </header>

      {editing || adding ? (
        <PrForm
          key={editing?.id ?? "new"}
          editing={editing}
          onDone={done}
          onCancel={() => {
            setEditing(null);
            setAdding(false);
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-4 w-full rounded-2xl bg-orange px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            + Add PR
          </button>

          {initialPrs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-muted">
              No PRs yet. Add your personal bests above.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {initialPrs.map((pr) => (
                  <PrCard key={pr.id} pr={pr} />
                ))}
              </div>

              <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">
                History
              </h2>
              <ul className="space-y-2.5">
                {initialPrs.map((pr) => (
                  <li key={pr.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(pr)}
                      className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3.5 text-left active:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">
                          {pr.exercise_name}
                        </span>
                        <span className="shrink-0 rounded-lg bg-orange-soft px-2.5 py-1 text-sm font-semibold text-orange">
                          {formatPrValue(pr)}
                          {pr.reps != null ? ` ×${pr.reps}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {pr.achieved_date
                          ? fmtDate(pr.achieved_date)
                          : "No date"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

function PrForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: Pr | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.exercise_name ?? "");
  const [unit, setUnit] = useState<PrUnitType>(editing?.unit_type ?? "kg");
  const [distanceUnit, setDistanceUnit] = useState<"m" | "km">(
    editing?.distance_unit ?? "m",
  );
  const [value, setValue] = useState(() => {
    if (!editing) return "";
    if (editing.unit_type === "time") return formatSeconds(editing.value);
    return String(editing.value);
  });
  const [reps, setReps] = useState(
    editing?.reps != null ? String(editing.reps) : "",
  );
  const [date, setDate] = useState(
    editing?.achieved_date ?? toDateKey(new Date()),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter an exercise name.");
      return;
    }

    let numeric: number | null;
    if (unit === "time") {
      numeric = parseTimeToSeconds(value);
      if (numeric == null) {
        setError("Enter time as mm:ss (e.g. 28:40).");
        return;
      }
    } else {
      numeric = value.trim() === "" ? null : Number(value);
      if (numeric == null || !Number.isFinite(numeric) || numeric < 0) {
        setError("Enter a valid value.");
        return;
      }
    }

    const repsNum =
      unit === "kg" && reps.trim() !== "" ? Number(reps) : null;
    if (repsNum != null && (!Number.isFinite(repsNum) || repsNum < 0)) {
      setError("Enter valid reps.");
      return;
    }

    setBusy(true);
    try {
      await savePr({
        id: editing?.id,
        exercise_name: name,
        unit_type: unit,
        value: numeric,
        distance_unit: unit === "distance" ? distanceUnit : null,
        reps: repsNum,
        achieved_date: date,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not save PR.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deletePr(editing.id);
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not delete PR.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="mb-2 text-sm font-semibold text-muted">
        {editing ? "Edit PR" : "Add a new PR"}
      </h2>

      <div className="space-y-2.5">
        <div>
          <label className="mb-1 block text-sm text-muted">Date achieved</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none focus:border-orange"
          />
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange"
        />

        <div className="flex gap-2.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={unit === "time" ? "text" : "decimal"}
            placeholder={unit === "time" ? "mm:ss" : "Value"}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange"
          />
          {unit === "kg" && (
            <input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              inputMode="numeric"
              placeholder="Reps"
              className="w-20 shrink-0 rounded-xl border border-white/10 bg-surface px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange"
            />
          )}
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as PrUnitType)}
            className="shrink-0 rounded-xl border border-white/10 bg-surface px-3 py-3 text-base text-ink outline-none focus:border-orange"
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {unit === "kg" && (
          <p className="text-xs text-muted">Reps optional (e.g. 120 kg × 5).</p>
        )}

        {unit === "distance" && (
          <div className="flex gap-2">
            {(["m", "km"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDistanceUnit(u)}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-medium",
                  distanceUnit === u
                    ? "bg-orange text-white"
                    : "border border-white/10 bg-surface text-ink",
                ].join(" ")}
              >
                {u}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-orange">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-orange px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : editing ? "Update PR" : "Save PR"}
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted active:bg-white/10"
          >
            Cancel
          </button>
          {editing && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-orange active:bg-orange-soft"
            >
              Delete PR
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
