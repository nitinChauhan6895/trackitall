"use client";

import { useState } from "react";

type InputSpec = {
  name: string;
  placeholder: string;
  type: "number" | "text";
  step?: string;
};

// One exercise row in the day view. The whole row is a disclosure: collapsed it
// shows the sets as chips; expanded it reveals per-set delete, an add-set row,
// and the delete-exercise action (server actions revalidate on submit).
export default function DayExercise({
  exerciseId,
  date,
  name,
  index,
  volume,
  sets,
  inputs,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
  timeUnitSelectable,
}: {
  exerciseId: string;
  date: string;
  name: string;
  /** 1-based position within its muscle group, shown as "01", "02", … */
  index: number;
  /** Strength volume, already formatted ("920"); "0" for cardio. */
  volume: string;
  sets: { id: string; label: string; isHard?: boolean }[];
  inputs: InputSpec[];
  onAddSet: (fields: Record<string, string>) => void;
  onDeleteSet: (setId: string) => void;
  onDeleteExercise: () => void;
  /** Cardio: show a min/sec picker for the duration field. */
  timeUnitSelectable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [hard, setHard] = useState(false);
  const [timeUnit, setTimeUnit] = useState<"minutes" | "seconds">("minutes");

  // The parent owns the mutation (optimistic cache update + queue when
  // offline); here we just collect the form fields.
  function submitAddSet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) fields[k] = String(v);
    if (hard) fields.is_hard = "1";
    if (timeUnitSelectable) fields.time_unit = timeUnit;
    form.reset();
    setHard(false);
    onAddSet(fields);
  }

  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
        className="flex w-full items-center gap-3 text-left active:opacity-80"
      >
        {/* Zero-padded index. */}
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green/[0.14] font-display text-sm font-semibold tabular-nums text-green"
        >
          {String(index).padStart(2, "0")}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold text-ink">{name}</span>
          <span className="text-xs text-muted">
            {sets.length} {sets.length === 1 ? "set" : "sets"}
            {volume !== "0" && ` · ${volume} kg`}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 text-subtle transition ${editing ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {editing ? null : sets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sets.map((s, i) => (
            <span
              key={s.id}
              className={[
                "elevation-2 flex items-center gap-2 rounded-[14px] text-sm tabular-nums text-ink",
                s.isHard ? "!border-gold/35 py-2 pl-3 pr-2" : "px-3 py-[9px]",
              ].join(" ")}
            >
              <span className="text-xs font-semibold text-green">{i + 1}</span>
              {s.label}
              {s.isHard && <HardBadge />}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm italic text-muted">No sets yet</span>
      )}

      {editing && (
        <div className="elevation-2 space-y-2 rounded-2xl p-3">
          {sets.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 tabular-nums text-ink">
                <span className="w-4 text-center text-xs font-semibold text-green">
                  {i + 1}
                </span>
                {s.label}
                {s.isHard && <HardBadge />}
              </span>
              <button
                type="button"
                onClick={() => onDeleteSet(s.id)}
                aria-label="Delete set"
                className="px-2 text-muted active:text-gold"
              >
                ✕
              </button>
            </div>
          ))}

          <form onSubmit={submitAddSet} className="flex flex-wrap items-center gap-2">
            {inputs.map((meta) => (
              <input
                key={meta.name}
                name={meta.name}
                type={meta.type}
                inputMode={meta.type === "number" ? "decimal" : "text"}
                min={meta.type === "number" ? 0 : undefined}
                step={meta.step}
                placeholder={meta.placeholder}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-green"
              />
            ))}
            {timeUnitSelectable && (
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/10">
                {(["minutes", "seconds"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setTimeUnit(u)}
                    aria-pressed={timeUnit === u}
                    aria-label={`Duration in ${u}`}
                    className={[
                      "px-2 py-2 text-xs font-bold transition",
                      timeUnit === u ? "bg-green text-ink-inverse" : "text-muted",
                    ].join(" ")}
                  >
                    {u === "minutes" ? "min" : "sec"}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setHard((v) => !v)}
              aria-pressed={hard}
              title="Hard set — taken to or near failure"
              className={[
                "shrink-0 rounded-lg border px-2 py-2 text-xs font-bold transition active:scale-95",
                hard ? "border-gold bg-gold-soft text-gold" : "border-white/10 text-muted",
              ].join(" ")}
            >
              HARD
            </button>
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-green px-3 py-2 text-sm font-bold text-ink-inverse active:scale-95"
            >
              + set
            </button>
          </form>

          <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
            <button
              type="button"
              onClick={onDeleteExercise}
              className="text-sm font-semibold text-gold active:opacity-70"
            >
              Delete exercise
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-ink active:bg-white/15"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HardBadge() {
  return (
    <span
      title="Hard set — taken to or near failure"
      className="rounded-lg bg-gold px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-ink-inverse"
    >
      HARD
    </span>
  );
}
