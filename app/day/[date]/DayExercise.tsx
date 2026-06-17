"use client";

import { useState } from "react";
import { addSet, deleteSet, deleteExercise } from "@/app/actions";

type InputSpec = {
  name: string;
  placeholder: string;
  type: "number" | "text";
  step?: string;
};

// One exercise row in the day view. Read-only until "Edit" reveals the
// add/remove-set controls (server actions revalidate on submit).
export default function DayExercise({
  exerciseId,
  date,
  name,
  sets,
  inputs,
}: {
  exerciseId: string;
  date: string;
  name: string;
  sets: { id: string; label: string }[];
  inputs: InputSpec[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="border-b border-black/5 py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{name}</p>
          <div className="mt-1 space-y-0.5 text-sm tabular-nums text-muted">
            {sets.length ? (
              sets.map((s) => <p key={s.id}>{s.label}</p>)
            ) : (
              <p className="italic">No sets yet</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 rounded-lg border border-green/40 px-3 py-1.5 text-sm font-semibold text-green active:bg-green/5"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 rounded-xl bg-page/70 p-3">
          {sets.map((s) => (
            <form
              key={s.id}
              action={deleteSet}
              className="flex items-center justify-between text-sm"
            >
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="date" value={date} />
              <span className="tabular-nums text-ink">{s.label}</span>
              <button type="submit" aria-label="Delete set" className="px-2 text-muted active:text-orange">
                ✕
              </button>
            </form>
          ))}

          <form action={addSet} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="exercise_id" value={exerciseId} />
            <input type="hidden" name="date" value={date} />
            {inputs.map((meta) => (
              <input
                key={meta.name}
                name={meta.name}
                type={meta.type}
                inputMode={meta.type === "number" ? "decimal" : "text"}
                min={meta.type === "number" ? 0 : undefined}
                step={meta.step}
                placeholder={meta.placeholder}
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-green"
              />
            ))}
            <button type="submit" className="shrink-0 rounded-lg bg-green px-3 py-2 text-sm font-semibold text-white active:scale-95">
              + set
            </button>
          </form>

          <form action={deleteExercise}>
            <input type="hidden" name="id" value={exerciseId} />
            <input type="hidden" name="date" value={date} />
            <button type="submit" className="text-sm font-medium text-orange active:opacity-70">
              🗑 Delete exercise
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
