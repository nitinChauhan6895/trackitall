"use client";

import { formatShortDate } from "@/lib/dateFormat";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMeasurements, qk } from "@/lib/browserData";
import { refetchUnlessJustFetched, useSeedQuery } from "@/lib/seed";
import {
  MEASUREMENT_FIELDS,
  type Measurement,
  type MeasurementField,
} from "@/lib/types";
import { toDateKey } from "@/lib/date";
import { deleteMeasurement, saveMeasurement } from "@/app/actions";
import { optimisticUpdate, tempId } from "@/lib/optimistic";

type MeasurementInput = Parameters<typeof saveMeasurement>[0];

// Newest first, as the server returns them.
function sortEntries(list: Measurement[]): Measurement[] {
  return [...list].sort((a, b) =>
    a.entry_date !== b.entry_date
      ? (a.entry_date < b.entry_date ? 1 : -1)
      : (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0),
  );
}

// Latest non-null value recorded for a metric (entries are newest-first).
function latest(entries: Measurement[], key: MeasurementField): number | null {
  const hit = entries.find((m) => m[key] != null);
  return hit ? (hit[key] as number) : null;
}

// Locale-independent so the server-rendered HTML matches every device
// (see lib/dateFormat.ts).
const fmtDate = formatShortDate;

// The form's body grid reads weight, fat, height, age (as in the design);
// everything else is a circumference.
const BODY_ORDER: string[] = ["bodyweight", "body_fat_pct", "height", "age"];
const BODY_FIELDS = MEASUREMENT_FIELDS.filter((f) => BODY_ORDER.includes(f.key)).sort(
  (a, b) => BODY_ORDER.indexOf(a.key) - BODY_ORDER.indexOf(b.key),
);
const CIRCUMFERENCE_FIELDS = MEASUREMENT_FIELDS.filter((f) => !BODY_ORDER.includes(f.key));

const GLASS_BACK =
  "elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15";

export default function MeasurementsManager({
  initial,
  fetchedAt,
}: {
  initial: Measurement[];
  /** When the server fetched `initial` (ms). */
  fetchedAt: number;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [adding, setAdding] = useState(false);

  // Cache-backed: instant on revisit, refreshed in the background.
  useSeedQuery(qk.measurements(), initial, fetchedAt);
  const { data: entries = initial } = useQuery({
    queryKey: qk.measurements(),
    refetchOnMount: refetchUnlessJustFetched,
    queryFn: fetchMeasurements,
    initialData: initial,
  });

  function close() {
    setEditing(null);
    setAdding(false);
  }
  // Both close the form at once and show the change straight away; the save
  // runs in the background and is undone (with a message) if it fails.
  function saveEntry(input: MeasurementInput) {
    const before = editing;
    close();
    const row: Measurement = {
      ...input,
      id: input.id ?? tempId(),
      user_id: before?.user_id ?? "",
      created_at: before?.created_at ?? new Date().toISOString(),
    };
    void optimisticUpdate<Measurement[]>(
      queryClient,
      qk.measurements(),
      (old) => sortEntries([...old.filter((m) => m.id !== row.id), row]),
      () => saveMeasurement(input),
    );
  }
  function removeEntry(id: string) {
    close();
    void optimisticUpdate<Measurement[]>(
      queryClient,
      qk.measurements(),
      (old) => old.filter((m) => m.id !== id),
      () => deleteMeasurement(id),
      "Couldn't delete. The entry is back.",
    );
  }

  if (editing || adding) {
    return (
      // A full-screen layer over the tab bar; the form has its own actions.
      <main className="fixed inset-0 z-40 mx-auto flex w-full max-w-md flex-col overflow-y-auto bg-page px-4 pb-10 safe-top">
        <MeasurementForm key={editing?.id ?? "new"} editing={editing} onSave={saveEntry} onDelete={removeEntry} onCancel={close} />
      </main>
    );
  }

  const weight = latest(entries, "bodyweight");

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <Link href="/" aria-label="Back" className={GLASS_BACK}>
          <BackArrow />
        </Link>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">Measurements</h1>
          <span className="text-[13px] text-muted">
            {entries.length ? `Last updated ${fmtDate(entries[0].entry_date)}` : "Track your body over time"}
          </span>
        </span>
      </div>

      <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">BODYWEIGHT</span>
          <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
            {weight ?? "—"}
            {weight != null && <span className="text-xl font-semibold text-green"> kg</span>}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat value={latest(entries, "height")} unit="cm" label="Height" />
          <MiniStat value={latest(entries, "body_fat_pct")} unit="%" label="Body fat" />
          <MiniStat value={latest(entries, "age")} unit="yr" label="Age" />
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-[52px] rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98]"
        >
          Add entry
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-xl font-semibold">History</h2>
          <span className="text-sm text-muted">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-muted">
            No measurements yet. Add your first entry above.
          </p>
        ) : (
          entries.map((m) => (
            <div key={m.id} className="elevation-1 flex flex-col gap-3 rounded-3xl px-[18px] pb-[18px] pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold">{fmtDate(m.entry_date)}</span>
                {m.id.startsWith("temp-") ? (
                  // Not saved yet: it has no real id to edit until the save lands.
                  <span className="text-sm text-subtle">Saving…</span>
                ) : (
                  <button type="button" onClick={() => setEditing(m)} className="text-sm font-semibold text-green active:opacity-70">
                    Edit
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MEASUREMENT_FIELDS.map((f) => {
                  const v = m[f.key];
                  if (v == null) return null;
                  return (
                    <span key={f.key} className="elevation-2 rounded-xl px-2.5 py-[7px] text-[13px]">
                      <span className="text-muted">{f.label}</span> {v} {f.unit}
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function MiniStat({ value, unit, label }: { value: number | null; unit: string; label: string }) {
  return (
    <div className="elevation-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-3">
      <span className="font-display text-[22px] font-semibold">
        {value ?? "—"}
        {value != null && <span className="text-xs text-muted"> {unit}</span>}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function MeasurementForm({
  editing,
  onSave,
  onDelete,
  onCancel,
}: {
  editing: Measurement | null;
  onSave: (input: MeasurementInput) => void;
  onDelete: (id: string) => void;
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
  const [error, setError] = useState("");

  const set = (key: MeasurementField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value.replace(/[^0-9.]/g, "") }));

  function num(key: MeasurementField): number | null {
    const s = values[key].trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick a date.");
      return;
    }
    onSave({
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
  }

  function remove() {
    if (editing) onDelete(editing.id);
  }

  return (
    <form onSubmit={submit} className="flex min-h-full flex-1 flex-col gap-6 [&>*]:shrink-0">
      <div className="flex items-center gap-3 pt-4">
        <button type="button" onClick={onCancel} aria-label="Back" className={GLASS_BACK}>
          <BackArrow />
        </button>
        <span className="flex flex-col gap-px">
          <span className="text-[15px] font-semibold">Measurements</span>
          <span className="text-[13px] text-muted">{editing ? "Edit entry" : "New entry"}</span>
        </span>
      </div>

      <h1 className="px-1 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">
        {editing ? "Edit your" : "Log your"}
        <br />
        <span className="text-green">measurements</span>
      </h1>

      <label className="elevation-1 flex h-14 items-center justify-between gap-3 rounded-[20px] px-[18px]">
        <span className="text-base font-semibold">Date</span>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-transparent text-right text-[15px] font-medium text-muted outline-none [color-scheme:dark]"
        />
      </label>

      <section className="flex flex-col gap-3">
        <span className="px-1 text-xs font-semibold tracking-[0.08em] text-muted">BODY</span>
        <div className="grid grid-cols-2 gap-2.5">
          {BODY_FIELDS.map((f) => (
            <label key={f.key} className="elevation-1 flex flex-col gap-1.5 rounded-[20px] px-4 py-3.5">
              <span className="text-[13px] text-muted">{f.label}</span>
              <span className="flex items-baseline gap-1.5">
                <input
                  inputMode="decimal"
                  value={values[f.key]}
                  onChange={set(f.key)}
                  placeholder="—"
                  className="w-full min-w-0 bg-transparent p-0 font-display text-[28px] font-semibold text-ink outline-none placeholder:text-subtle"
                />
                <span className="text-sm font-semibold text-green">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">CIRCUMFERENCE</span>
          <span className="text-xs text-subtle">all in cm · optional</span>
        </div>
        <div className="elevation-1 flex flex-col rounded-3xl">
          {CIRCUMFERENCE_FIELDS.map((f) => (
            <label
              key={f.key}
              className="flex min-h-[52px] items-center justify-between gap-3 border-b border-surface-2 px-[18px] last:border-0"
            >
              <span className="text-[15px] font-semibold">{f.label}</span>
              <input
                inputMode="decimal"
                value={values[f.key]}
                onChange={set(f.key)}
                placeholder="—"
                className="w-20 bg-transparent text-right font-display text-lg font-semibold text-ink outline-none placeholder:text-subtle"
              />
            </label>
          ))}
        </div>
      </section>

      {error && <p className="text-center text-sm text-gold">{error}</p>}

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="submit"
         
          className="h-14 rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98]"
        >
          {editing ? "Update entry" : "Save entry"}
        </button>
        {editing && (
          <button type="button" onClick={remove} className="h-12 text-[15px] font-medium text-gold active:opacity-70">
            Delete entry
          </button>
        )}
        <button type="button" onClick={onCancel} className="h-12 text-[15px] font-medium text-muted active:opacity-70">
          Cancel
        </button>
      </div>
    </form>
  );
}

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
