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
import { deletePr, savePr } from "@/app/actions";

const UNIT_OPTIONS: { value: PrUnitType; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "time", label: "time (mm:ss)" },
  { value: "distance", label: "distance" },
];

export default function PrManager({ initialPrs }: { initialPrs: Pr[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Pr | null>(null);

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
          <span aria-hidden>🏆</span> PR corner
        </h1>
      </header>

      {initialPrs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-muted">
          No PRs yet. Add your personal bests below.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {initialPrs.map((pr) => (
            <li key={pr.id}>
              <button
                type="button"
                onClick={() => setEditing(pr)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white px-4 py-3.5 text-left active:bg-black/5"
              >
                <span className="font-medium">{pr.exercise_name}</span>
                <PrBadge pr={pr} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PrForm
        key={editing?.id ?? "new"}
        editing={editing}
        onDone={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </main>
  );
}

function PrBadge({ pr }: { pr: Pr }) {
  const tone =
    pr.unit_type === "kg"
      ? "bg-orange-soft text-orange"
      : pr.unit_type === "time"
        ? "bg-green/10 text-green"
        : "bg-beige text-ink";
  return (
    <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tone}`}>
      {formatPrValue(pr)}
    </span>
  );
}

function PrForm({
  editing,
  onDone,
}: {
  editing: Pr | null;
  onDone: () => void;
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

    setBusy(true);
    try {
      await savePr({
        id: editing?.id,
        exercise_name: name,
        unit_type: unit,
        value: numeric,
        distance_unit: unit === "distance" ? distanceUnit : null,
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
    <form onSubmit={submit} className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-muted">
        {editing ? "Edit PR" : "Add a new PR"}
      </h2>

      <div className="space-y-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-orange"
        />

        <div className="flex gap-2.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={unit === "time" ? "text" : "decimal"}
            placeholder={unit === "time" ? "mm:ss" : "Value"}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-orange"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as PrUnitType)}
            className="shrink-0 rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-orange"
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

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
                    : "border border-black/10 bg-white text-ink",
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

        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="w-full rounded-xl px-4 py-2 text-sm text-muted active:text-orange"
          >
            Delete PR
          </button>
        )}
      </div>
    </form>
  );
}
