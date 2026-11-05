"use client";

import { formatShortDate } from "@/lib/dateFormat";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllPrs, qk } from "@/lib/browserData";
import {
  formatPrValue,
  formatSeconds,
  parseTimeToSeconds,
  splitPrValue,
  type Pr,
  type PrUnitType,
} from "@/lib/types";
import { groupPrs, type PrGroup } from "@/lib/prGroups";
import { toDateKey } from "@/lib/date";
import { deletePr, savePr } from "@/app/actions";
import { Sparkline } from "@/components/Sparkline";

// Locale-independent so the server-rendered HTML matches every device
// (see lib/dateFormat.ts).
const fmtDate = formatShortDate;

// Signed improvement of the latest attempt vs the previous best, e.g.
// "+2.5 kg". Only improvements are returned; a regression shows nothing.
function improvement(g: PrGroup): string | null {
  if (g.delta == null || g.delta === 0) return null;
  const unit = g.best.unit_type;
  const good = unit === "time" ? g.delta < 0 : g.delta > 0;
  if (!good) return null;
  const abs = Math.abs(g.delta);
  const amount =
    unit === "time"
      ? formatSeconds(abs)
      : `${Math.round(abs * 100) / 100} ${unit === "kg" ? "kg" : g.best.distance_unit ?? "m"}`;
  return `${unit === "time" ? "−" : "+"}${amount}`;
}

type Preset = { name: string; unit: PrUnitType; distance_unit: "m" | "km" | null };

const GLASS_BACK =
  "elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15";

export default function PrManager({ initialPrs }: { initialPrs: Pr[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Pr | null>(null);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);

  // Cache-backed: instant from IndexedDB on revisit, refreshed in the
  // background; saves/deletes invalidate this key.
  const { data: prs = initialPrs } = useQuery({
    queryKey: qk.prs(),
    queryFn: fetchAllPrs,
    initialData: initialPrs,
  });
  const groups = groupPrs(prs);

  function close() {
    setEditing(null);
    setAdding(false);
    setPreset(null);
  }
  function done() {
    close();
    queryClient.invalidateQueries({ queryKey: qk.prs() });
  }

  if (editing || adding) {
    return (
      <PrForm
        key={editing?.id ?? preset?.name ?? "new"}
        editing={editing}
        preset={preset}
        onDone={done}
        onCancel={close}
      />
    );
  }

  // Hero: the heaviest weight PR; falls back to the most recent record when
  // nothing is measured in kg.
  const kgBests = groups.filter((g) => g.best.unit_type === "kg");
  const top = kgBests.length
    ? kgBests.reduce((a, b) => (b.best.value > a.best.value ? b : a))
    : groups[0];
  const improving = groups.filter((g) => improvement(g) != null).length;

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <Link href="/" aria-label="Back" className={GLASS_BACK}>
          <BackArrow />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">PR corner</h1>
          <span className="text-[13px] text-muted">Your personal records</span>
        </div>
      </div>

      {top ? (
        <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">
              {top.best.unit_type === "kg" ? "TOP LIFT" : "LATEST RECORD"}
            </span>
            <PrValue pr={top.best} size="hero" />
            <span className="truncate text-[15px] text-[#D4D4D4]">{top.best.exercise_name}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat value={groups.length} label={groups.length === 1 ? "Exercise" : "Exercises"} />
            <MiniStat value={prs.length} label={prs.length === 1 ? "Entry" : "Entries"} />
            <MiniStat value={improving} label="Improving" green />
          </div>
        </section>
      ) : (
        <p className="rounded-[28px] border border-dashed border-white/15 px-4 py-10 text-center text-sm text-muted">
          No PRs yet. Tap Add PR to log your first personal best.
        </p>
      )}

      {groups.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-semibold">Records</h2>
            <span className="text-xs text-muted">best · reps</span>
          </div>
          <div className="elevation-1 flex flex-col rounded-3xl">
            {groups.map((g) => (
              <RecordRow
                key={g.key}
                g={g}
                onEditEntry={(pr) => setEditing(pr)}
                onAddEntry={() => {
                  setPreset({
                    name: g.best.exercise_name,
                    unit: g.best.unit_type,
                    distance_unit: g.best.distance_unit,
                  });
                  setAdding(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Floating glass action */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md justify-end px-4 pb-7 safe-bottom">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="elevation-3 pointer-events-auto h-[60px] rounded-full bg-green/[0.92] px-[26px] text-base font-semibold text-ink-inverse transition active:scale-95"
        >
          Add PR
        </button>
      </div>
    </main>
  );
}

// "60 kg × 8" with the unit and reps styled down.
function PrValue({ pr, size }: { pr: Pr; size: "hero" | "row" }) {
  const { value, unit } = splitPrValue(pr);
  if (size === "hero") {
    return (
      <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
        {value}
        {unit && <span className="text-xl font-semibold text-green"> {unit}</span>}
        {pr.reps != null && <span className="text-[22px] font-semibold text-muted"> × {pr.reps}</span>}
      </span>
    );
  }
  return (
    <span className="shrink-0 font-display text-[22px] font-semibold">
      {value}
      {(unit || pr.reps != null) && (
        <span className="text-[13px] text-muted">
          {unit && ` ${unit}`}
          {pr.reps != null && ` × ${pr.reps}`}
        </span>
      )}
    </span>
  );
}

function MiniStat({ value, label, green }: { value: number; label: string; green?: boolean }) {
  return (
    <div className="elevation-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-3">
      <span className={`font-display text-[22px] font-semibold ${green ? "text-green" : ""}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

// One exercise per row: its best, entry count and latest improvement. Tap to
// see the progress line and every attempt (tap an attempt to edit/delete it).
function RecordRow({
  g,
  onEditEntry,
  onAddEntry,
}: {
  g: PrGroup;
  onEditEntry: (pr: Pr) => void;
  onAddEntry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const best = g.best;
  const up = improvement(g);

  return (
    <div className="border-b border-surface-2 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-[18px] py-4 text-left active:bg-white/[0.04]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-base font-semibold">{best.exercise_name}</span>
          <span className="text-[13px] text-muted">
            {g.entries.length} {g.entries.length === 1 ? "entry" : "entries"}
            {up && (
              <>
                {" · "}
                <span className="font-semibold text-green">{up} vs last</span>
              </>
            )}
          </span>
        </span>
        <PrValue pr={best} size="row" />
      </button>

      {open && (
        <div className="px-[18px] pb-4">
          <div className="elevation-2 flex flex-col gap-2 rounded-2xl p-3">
            {g.series.length >= 2 && (
              <div className="h-14 w-full text-green">
                <Sparkline values={g.series} className="h-full w-full" />
              </div>
            )}
            <ul className="flex flex-col">
              {[...g.entries].reverse().map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onEditEntry(e)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left active:bg-white/[0.06]"
                  >
                    <span className="text-sm text-muted">
                      {e.achieved_date ? fmtDate(e.achieved_date) : "No date"}
                      {e.id === best.id && <span className="ml-2 text-xs font-semibold text-gold">Best</span>}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${e.id === best.id ? "text-green" : "text-ink"}`}>
                      {formatPrValue(e)}
                      {e.reps != null ? ` × ${e.reps}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={onAddEntry} className="self-start px-1 py-1 text-sm font-semibold text-green active:opacity-70">
              + Log new attempt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MEASURES: { value: PrUnitType; label: string }[] = [
  { value: "kg", label: "Weight" },
  { value: "time", label: "Time" },
  { value: "distance", label: "Distance" },
];

const FIELD_LABEL = "text-xs font-semibold tracking-[0.08em] text-muted";
const FIELD_INPUT =
  "elevation-2 h-[52px] rounded-2xl px-4 text-base text-ink outline-none placeholder:text-subtle focus:border-green/60";

function PrForm({
  editing,
  preset,
  onDone,
  onCancel,
}: {
  editing: Pr | null;
  preset: Preset | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.exercise_name ?? preset?.name ?? "");
  const [unit, setUnit] = useState<PrUnitType>(editing?.unit_type ?? preset?.unit ?? "kg");
  const [distanceUnit, setDistanceUnit] = useState<"m" | "km">(
    editing?.distance_unit ?? preset?.distance_unit ?? "m",
  );
  const [value, setValue] = useState(() => {
    if (!editing) return "";
    if (editing.unit_type === "time") return formatSeconds(editing.value);
    return String(editing.value);
  });
  const [reps, setReps] = useState(editing?.reps != null ? String(editing.reps) : "");
  const [date, setDate] = useState(editing?.achieved_date ?? toDateKey(new Date()));
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

    const repsNum = unit === "kg" && reps.trim() !== "" ? Number(reps) : null;
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

  const [line1, line2] = editing
    ? ["Edit this", "record"]
    : preset
      ? ["Log a new", "attempt"]
      : ["Log a new", "personal record"];

  return (
    <form onSubmit={submit} className="flex min-h-[100dvh] flex-1 flex-col gap-6 px-4 pb-10 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <button type="button" onClick={onCancel} aria-label="Back" className={GLASS_BACK}>
          <BackArrow />
        </button>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold">PR corner</span>
          <span className="truncate text-[13px] text-muted">
            {editing ? "Edit entry" : preset ? preset.name : "New record"}
          </span>
        </span>
      </div>

      <h1 className="px-1 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">
        {line1}
        <br />
        <span className="text-green">{line2}</span>
      </h1>

      <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] p-5">
        <label className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>EXERCISE</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exercise name" className={FIELD_INPUT} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>DATE ACHIEVED</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD_INPUT + " [color-scheme:dark]"} />
        </label>
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>MEASURED IN</span>
          <div role="radiogroup" aria-label="Measured in" className="elevation-2 grid grid-cols-3 gap-1 rounded-2xl p-1">
            {MEASURES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={unit === m.value}
                onClick={() => setUnit(m.value)}
                className={[
                  "h-11 rounded-xl text-sm transition",
                  unit === m.value ? "bg-[#3A3A3A] font-semibold text-ink" : "font-medium text-muted",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className={unit === "kg" ? "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2.5" : "flex flex-col"}>
          <label className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>{unit === "kg" ? "WEIGHT" : unit === "time" ? "TIME" : "DISTANCE"}</span>
            <span className="elevation-2 flex h-16 items-center gap-2 rounded-2xl px-4">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode={unit === "time" ? "text" : "decimal"}
                placeholder={unit === "time" ? "mm:ss" : "0"}
                className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-semibold text-ink outline-none placeholder:text-subtle"
              />
              {unit === "kg" && <span className="text-[15px] font-semibold text-green">kg</span>}
              {unit === "distance" && (
                <span className="flex shrink-0 gap-1">
                  {(["m", "km"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setDistanceUnit(u)}
                      aria-pressed={distanceUnit === u}
                      className={[
                        "h-9 rounded-lg px-3 text-sm font-semibold",
                        distanceUnit === u ? "bg-green text-ink-inverse" : "text-muted",
                      ].join(" ")}
                    >
                      {u}
                    </button>
                  ))}
                </span>
              )}
            </span>
          </label>
          {unit === "kg" && (
            <label className="flex flex-col gap-2">
              <span className={FIELD_LABEL}>REPS</span>
              <span className="elevation-2 flex h-16 items-center rounded-2xl px-4">
                <input
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  inputMode="numeric"
                  placeholder="—"
                  className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-semibold text-ink outline-none placeholder:text-subtle"
                />
              </span>
            </label>
          )}
        </div>
        {unit === "kg" && <span className="text-[13px] text-muted">Reps are optional, e.g. 120 kg × 5.</span>}
        {unit === "time" && <span className="text-[13px] text-muted">Enter as mm:ss, e.g. 28:40.</span>}
      </section>

      {error && <p className="text-center text-sm text-gold">{error}</p>}

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-14 rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : editing ? "Update entry" : "Save PR"}
        </button>
        {editing && (
          <button type="button" onClick={remove} disabled={busy} className="h-12 text-[15px] font-medium text-gold active:opacity-70">
            Delete entry
          </button>
        )}
        <button type="button" onClick={onCancel} disabled={busy} className="h-12 text-[15px] font-medium text-muted active:opacity-70">
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
