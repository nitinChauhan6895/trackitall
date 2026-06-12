import Link from "next/link";
import { notFound } from "next/navigation";
import { getDayExercises } from "@/lib/data";
import { formatDayHeading, monthParam } from "@/lib/date";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  isCardio,
  type Exercise,
  type MuscleGroup,
} from "@/lib/types";
import { addSet } from "@/app/actions";
import SwipeSetRow from "./SwipeSetRow";
import SwipeExerciseHeader from "./SwipeExerciseHeader";

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
                    cardio={isCardio(group)}
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
  cardio,
}: {
  exercise: Exercise;
  date: string;
  cardio: boolean;
}) {
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
              right={
                cardio
                  ? `${fmt(s.distance_km)} km${s.speed_kmh != null ? ` · ${fmt(s.speed_kmh)} km/h` : ""}`
                  : `${s.reps ?? "–"} × ${fmt(s.weight_kg)} kg`
              }
            />
          ))}
        </div>
      )}

      <form action={addSet} className="mt-2 flex items-center gap-2">
        <input type="hidden" name="exercise_id" value={exercise.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="cardio" value={cardio ? "1" : "0"} />
        {cardio ? (
          <>
            <input
              name="distance"
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              placeholder="Distance (km)"
              className="w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green"
            />
            <input
              name="speed"
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              placeholder="Speed (km/h)"
              className="w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green"
            />
          </>
        ) : (
          <>
            <input
              name="reps"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Reps"
              className="w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green"
            />
            <input
              name="weight"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              placeholder="Weight (kg)"
              className="w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green"
            />
          </>
        )}
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

function fmt(n: number | null): string {
  if (n == null) return "–";
  return Number.isInteger(n) ? String(n) : String(n);
}
