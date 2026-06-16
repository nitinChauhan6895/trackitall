import Link from "next/link";
import { notFound } from "next/navigation";
import { getDayExercises } from "@/lib/data";
import { formatDayHeading, monthParam } from "@/lib/date";
import {
  CARDIO_FIELDS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  formatSeconds,
  isCardio,
  type CardioField,
  type CardioType,
  type Exercise,
  type MuscleGroup,
  type WorkoutSet,
} from "@/lib/types";
import { resolveHiitMetrics, type ResolvedMetric } from "@/lib/hiit";
import { addSet } from "@/app/actions";
import SwipeSetRow from "./SwipeSetRow";
import SwipeExerciseHeader from "./SwipeExerciseHeader";

type SetKind = "cardio" | "hiit" | "strength";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  params,
}: {
  params: { date: string };
}) {
  const date = params.date;
  if (!DATE_RE.test(date)) notFound();

  const exercises = await getDayExercises(date);

  const byGroup = new Map<MuscleGroup, Exercise[]>();
  for (const ex of exercises) {
    const list = byGroup.get(ex.muscle_group) ?? [];
    list.push(ex);
    byGroup.set(ex.muscle_group, list);
  }

  const [y, m] = date.split("-").map(Number);
  const backHref = `/?m=${monthParam(y, m)}`;

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center gap-3 py-4">
        <Link
          href={backHref}
          aria-label="Back to calendar"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-black/5"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold leading-tight">
          {formatDayHeading(date)}
        </h1>
      </header>

      {exercises.length === 0 ? (
        <p className="mb-6 rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-muted">
          No workout saved for this day yet.
        </p>
      ) : (
        <div className="space-y-4">
          {MUSCLE_GROUPS.filter((g) => byGroup.has(g)).map((group) => (
            <section
              key={group}
              className="rounded-2xl border border-black/5 bg-white p-4"
            >
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange">
                {MUSCLE_GROUP_LABELS[group]}
              </h2>
              <div className="space-y-4">
                {byGroup.get(group)!.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    date={date}
                    group={group}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-4 pb-5 pt-2 safe-bottom">
        <Link
          href={`/log/${date}`}
          className="flex w-full items-center justify-center rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98]"
        >
          + Add to this day
        </Link>
      </div>
    </main>
  );
}

function ExerciseRow({
  exercise,
  date,
  group,
}: {
  exercise: Exercise;
  date: string;
  group: MuscleGroup;
}) {
  const kind: SetKind =
    group === "hiit" ? "hiit" : isCardio(group) ? "cardio" : "strength";
  const cardioType: CardioType = exercise.cardio_type ?? "generic";

  const inputClass =
    "min-w-0 flex-1 rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green";

  // Build the add-set input specs for this exercise.
  let inputs: { name: string; placeholder: string; type: "number" | "text"; step?: string }[] =
    [];
  if (kind === "cardio") {
    inputs = CARDIO_FIELDS[cardioType].map((f) => FIELD_INPUTS[f]);
  } else if (kind === "hiit") {
    inputs = resolveHiitMetrics(exercise.name).map((m) => HIIT_INPUTS[m.draftKey]);
  } else {
    inputs = [
      { name: "reps", placeholder: "Reps", type: "number", step: "1" },
      { name: "weight", placeholder: "Weight (kg)", type: "number", step: "0.5" },
    ];
  }

  return (
    <div>
      <SwipeExerciseHeader id={exercise.id} date={date} name={exercise.name} />

      {exercise.sets.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {exercise.sets.map((s, i) => (
            <SwipeSetRow
              key={s.id}
              id={s.id}
              date={date}
              left={`Set ${i + 1}`}
              right={formatSavedSet(exercise, kind, s)}
            />
          ))}
        </div>
      )}

      <form action={addSet} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="exercise_id" value={exercise.id} />
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
            className={inputClass}
          />
        ))}
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-green px-3 py-2 text-sm font-semibold text-white active:scale-95"
        >
          + set
        </button>
      </form>
    </div>
  );
}

const HIIT_INPUTS: Record<
  ResolvedMetric["draftKey"],
  { name: string; placeholder: string; type: "number" | "text"; step?: string }
> = {
  reps: { name: "reps", placeholder: "Reps", type: "number", step: "1" },
  weight: { name: "weight", placeholder: "Weight (kg)", type: "number", step: "0.5" },
  distance_km: { name: "distance_km", placeholder: "Distance (km)", type: "number", step: "0.1" },
  distance_m: { name: "distance_m", placeholder: "Distance (m)", type: "number", step: "1" },
  time: { name: "time", placeholder: "Time (hh:mm:ss)", type: "text" },
  calories: { name: "calories", placeholder: "Calories (kcal)", type: "number", step: "1" },
  sets_count: { name: "sets_count", placeholder: "Sets", type: "number", step: "1" },
  height: { name: "height", placeholder: "Height (cm)", type: "number", step: "1" },
  floors: { name: "floors", placeholder: "Floors", type: "number", step: "1" },
};

const FIELD_INPUTS: Record<
  CardioField,
  { name: string; placeholder: string; type: "number" | "text"; step?: string }
> = {
  distance_km: { name: "distance_km", placeholder: "Distance (km)", type: "number", step: "0.1" },
  distance_m: { name: "distance_m", placeholder: "Distance (m)", type: "number", step: "1" },
  time: { name: "time", placeholder: "Duration (hh:mm:ss)", type: "text" },
  calories: { name: "calories", placeholder: "Calories (kcal)", type: "number", step: "1" },
  incline: { name: "incline", placeholder: "Incline", type: "number", step: "0.5" },
  resistance: { name: "resistance", placeholder: "Resistance", type: "number", step: "1" },
  weight: { name: "weight", placeholder: "Weight (kg)", type: "number", step: "0.5" },
};

function formatHiitSet(name: string, s: WorkoutSet): string {
  const parts: string[] = [];
  for (const m of resolveHiitMetrics(name)) {
    const v = s[m.dbColumn];
    if (v == null) continue;
    if (m.kind === "time") parts.push(formatSeconds(v));
    else parts.push(m.unit ? `${fmt(v)} ${m.unit}` : `${m.label} ${fmt(v)}`);
  }
  return parts.length ? parts.join(" · ") : "–";
}

function formatSavedSet(
  exercise: Exercise,
  kind: SetKind,
  s: WorkoutSet,
): string {
  if (kind === "hiit") return formatHiitSet(exercise.name, s);
  if (kind === "strength") {
    return `${s.reps ?? "–"} × ${fmt(s.weight_kg)} kg`;
  }
  const cardioType: CardioType = exercise.cardio_type ?? "generic";
  const parts: string[] = [];
  for (const f of CARDIO_FIELDS[cardioType]) {
    if (f === "distance_km" && s.distance_km != null)
      parts.push(`${fmt(s.distance_km)} km`);
    else if (f === "distance_m" && s.distance_m != null)
      parts.push(`${fmt(s.distance_m)} m`);
    else if (f === "time" && s.time_seconds != null)
      parts.push(formatSeconds(s.time_seconds));
    else if (f === "calories" && s.calories != null)
      parts.push(`${fmt(s.calories)} kcal`);
    else if (f === "incline" && s.incline != null)
      parts.push(`incline ${fmt(s.incline)}`);
    else if (f === "resistance" && s.resistance != null)
      parts.push(`resist ${fmt(s.resistance)}`);
    else if (f === "weight" && s.weight_kg != null)
      parts.push(`${fmt(s.weight_kg)} kg`);
  }
  // Legacy rows (pre-round-2) stored cardio as distance_km + speed_kmh.
  if (parts.length === 0) {
    if (s.distance_km != null) parts.push(`${fmt(s.distance_km)} km`);
    if (s.speed_kmh != null) parts.push(`${fmt(s.speed_kmh)} km/h`);
  }
  return parts.length ? parts.join(" · ") : "–";
}

function fmt(n: number | null): string {
  if (n == null) return "–";
  return String(n);
}
