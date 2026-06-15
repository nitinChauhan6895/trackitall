"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MEASUREMENT_FIELDS,
  type Measurement,
  type MeasurementField,
} from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { deleteMeasurement, saveMeasurement } from "@/app/actions";
import { MetricTile, metricIcon } from "@/components/Tiles";

// Latest non-null value recorded for each tracked metric (entries are newest-first).
function latestValues(entries: Measurement[]) {
  return MEASUREMENT_FIELDS.map((f) => {
    const hit = entries.find((m) => m[f.key] != null);
    return { field: f, value: hit ? hit[f.key] : null };
  });
}

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-orange";

function fmtDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MeasurementsManager({
  initial,
}: {
  initial: Measurement[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Measurement | null>(null);
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
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-black/5"
        >
          ←
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden>📏</span> Measurements
        </h1>
      </header>

      {editing || adding ? (
        <MeasurementForm
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
          {initial.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              {latestValues(initial)
                .filter((m) => m.value != null)
                .map(({ field, value }) => (
                  <MetricTile
                    key={field.key}
                    icon={metricIcon(field.key)}
                    label={field.label}
                    value={String(value)}
                    unit={field.unit}
                  />
                ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-4 w-full rounded-2xl bg-green px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            + Add entry
          </button>

          <h2 className="mb-2 text-sm font-semibold text-muted">History</h2>

          {initial.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-muted">
              No measurements yet. Add your first entry above.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {initial.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3.5 text-left active:bg-black/5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">
                        {fmtDate(m.entry_date)}
                      </span>
                      <span className="text-sm text-orange">Edit ›</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {MEASUREMENT_FIELDS.map((f) => {
                        const v = m[f.key];
                        if (v == null) return null;
                        return (
                          <span
                            key={f.key}
                            className="rounded-lg bg-beige px-2 py-1 text-xs text-ink"
                          >
                            {f.label} {v}
                            {f.unit}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function MeasurementForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: Measurement | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(editing?.entry_date ?? toDateKey(new Date()));
  const [values, setValues] = useState<Record<MeasurementField, string>>(() => {
    const init = {} as Record<MeasurementField, string>;
    for (const f of MEASUREMENT_FIELDS) {
      const v = editing?.[f.key];
      init[f.key] = v == null ? "" : String(v);
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function num(key: MeasurementField): number | null {
    const s = values[key].trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await saveMeasurement({
        id: editing?.id,
        entry_date: date,
        bodyweight: num("bodyweight"),
        body_fat_pct: num("body_fat_pct"),
        height: num("height"),
        age: num("age"),
        chest: num("chest"),
        shoulders: num("shoulders"),
        waist: num("waist"),
        navel: num("navel"),
        arms: num("arms"),
        thighs: num("thighs"),
      });
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not save.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteMeasurement(editing.id);
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not delete.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-muted">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MEASUREMENT_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm text-muted">
              {f.label} ({f.unit})
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={values[f.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              placeholder="—"
              className={inputClass}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-orange">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Saving…" : editing ? "Update entry" : "Save entry"}
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm text-muted active:bg-black/5"
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
            Delete entry
          </button>
        )}
      </div>
    </form>
  );
}
