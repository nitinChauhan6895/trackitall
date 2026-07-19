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
  sets,
  inputs,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
}: {
  exerciseId: string;
  date: string;
  name: string;
  sets: { id: string; label: string }[];
  inputs: InputSpec[];
  onAddSet: (fields: Record<string, string>) => void;
  onDeleteSet: (setId: string) => void;
  onDeleteExercise: () => void;
}) {
  const [editing, setEditing] = useState(false);

  // The parent owns the mutation (optimistic cache update + queue when
  // offline); here we just collect the form fields.
  function submitAddSet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) fields[k] = String(v);
    form.reset();
    onAddSet(fields);
  }

  return (
    <div className="border-b border-white/10 py-1 last:border-0">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
        className="flex w-full items-center gap-3 py-3 text-left active:opacity-80"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{name}</span>
          {editing ? null : sets.length > 0 ? (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {sets.map((s, i) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-sm tabular-nums text-ink"
                >
                  <span className="text-[10px] font-semibold text-muted">{i + 1}</span>
                  {s.label}
                </span>
              ))}
            </span>
          ) : (
            <span className="mt-1 block text-sm italic text-muted">No sets yet</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-medium text-muted">
            {sets.length} {sets.length === 1 ? "set" : "sets"}
          </span>
          <span aria-hidden className="text-muted">
            {editing ? "⌃" : "⌄"}
          </span>
        </span>
      </button>

      {editing && (
        <div className="mb-3 space-y-2 rounded-xl bg-white/[0.04] p-3">
          {sets.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 tabular-nums text-ink">
                <span className="w-4 text-center text-[10px] font-semibold text-muted">
                  {i + 1}
                </span>
                {s.label}
              </span>
              <button
                type="button"
                onClick={() => onDeleteSet(s.id)}
                aria-label="Delete set"
                className="px-2 text-muted active:text-orange"
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
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-green"
              />
            ))}
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
              className="text-sm font-semibold text-orange active:opacity-70"
            >
              🗑 Delete exercise
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
