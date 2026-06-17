import Link from "next/link";
import { notFound } from "next/navigation";
import { getDayExercises } from "@/lib/data";
import { monthParam } from "@/lib/date";
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
import MuscleIcon, { MUSCLE_TONE } from "@/components/MuscleIcon";
import DayExercise from "./DayExercise";

type SetKind = "cardio" | "hiit" | "strength";
type InputSpec = { name: string; placeholder: string; type: "number" | "text"; step?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function kindOf(group: MuscleGroup): SetKind {
  return group === "hiit" ? "hiit" : isCardio(group) ? "cardio" : "strength";
}

function inputsFor(exercise: Exercise, kind: SetKind): InputSpec[] {
  if (kind === "cardio") {
    const t: CardioType = exercise.cardio_type ?? "generic";
    return CARDIO_FIELDS[t].map((f) => FIELD_INPUTS[f]);
  }
  if (kind === "hiit") {
    return resolveHiitMetrics(exercise.name).map((m) => HIIT_INPUTS[m.draftKey]);
  }
  return [
    { name: "reps", placeholder: "Reps", type: "number", step: "1" },
    { name: "weight", placeholder: "Weight (kg)", type: "number", step: "0.5" },
  ];
}

export default async function DayPage({ params }: { params: { date: string } }) {
  const date = params.date;
  if (!DATE_RE.test(date)) notFound();

  const exercises = await getDayExercises(date);

  const byGroup = new Map<MuscleGroup, Exercise[]>();
  for (const ex of exercises) {
    const list = byGroup.get(ex.muscle_group) ?? [];
    list.push(ex);
    byGroup.set(ex.muscle_group, list);
  }

  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  let totalVolume = 0;
  for (const e of exercises)
    for (const s of e.sets)
      if (s.reps != null && s.weight_kg != null) totalVolume += s.reps * s.weight_kg;

  const [y, m] = date.split("-").map(Number);
  const backHref = `/?m=${monthParam(y, m)}`;
  const heading = new Date(y, m - 1, Number(date.split("-")[2])).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center justify-between gap-2 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="Back to calendar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm active:bg-black/5"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">{heading}</h1>
            <p className="text-sm text-muted">
              {exercises.length} exercises · {totalSets} sets
            </p>
          </div>
        </div>
        <Link
          href="/stats"
          className="flex shrink-0 items-center gap-1 rounded-full border border-green/30 bg-green/5 px-3 py-1.5 text-sm font-semibold text-green active:scale-95"
        >
          📊 Summary
        </Link>
      </header>

      {exercises.length === 0 ? (
        <p className="mb-6 rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-muted">
          No workout saved for this day yet.
        </p>
      ) : (
        <>
          {/* Day summary stats */}
          <div className="mb-4 grid grid-cols-4 divide-x divide-black/5 rounded-2xl border border-black/5 bg-white py-3">
            <Stat icon="📋" tone="text-green" value={String(totalSets)} label="Total Sets" />
            <Stat icon="🏋️" tone="text-orange" value={String(exercises.length)} label="Exercises" />
            <Stat icon="💪" tone="text-[#9B5CC9]" value={String(byGroup.size)} label="Muscle Groups" />
            <Stat icon={<KettlebellIcon className="h-5 w-5" />} tone="text-green" value={fmtVolume(totalVolume)} label="Total Volume" unit="kg" />
          </div>

          <div className="space-y-4">
            {MUSCLE_GROUPS.filter((g) => byGroup.has(g)).map((group) => {
              const list = byGroup.get(group)!;
              const kind = kindOf(group);
              return (
                <section
                  key={group}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-white"
                  style={{ borderLeft: `4px solid ${MUSCLE_TONE[group]}` }}
                >
                  <div className="flex items-center gap-2 px-4 pt-4">
                    <span className="h-6 w-6" style={{ color: MUSCLE_TONE[group] }}>
                      <MuscleIcon group={group} />
                    </span>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
                      {MUSCLE_GROUP_LABELS[group]}
                    </h2>
                    <span className="rounded-full bg-orange-soft px-2 py-0.5 text-xs font-semibold text-orange">
                      {list.length} {list.length === 1 ? "Exercise" : "Exercises"}
                    </span>
                  </div>
                  <div className="px-4">
                    {list.map((ex) => (
                      <DayExercise
                        key={ex.id}
                        exerciseId={ex.id}
                        date={date}
                        name={ex.name}
                        sets={ex.sets.map((s) => ({
                          id: s.id,
                          label: formatSavedSet(ex, kind, s),
                        }))}
                        inputs={inputsFor(ex, kind)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
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

function Stat({
  icon,
  tone,
  value,
  label,
  unit,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center px-1 text-center">
      <span aria-hidden className={`flex h-5 items-center justify-center text-lg ${tone}`}>
        {icon}
      </span>
      <span className="mt-1 text-lg font-bold leading-none text-ink">
        {value}
        {unit && <span className="text-xs font-semibold text-muted"> {unit}</span>}
      </span>
      <span className="mt-1 text-[11px] leading-tight text-muted">{label}</span>
    </div>
  );
}

function fmtVolume(v: number): string {
  return Math.round(v).toLocaleString();
}

function KettlebellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.5 8.5V7a2.5 2.5 0 0 1 5 0v1.5" />
      <path d="M8 8.5h8c.7 1.4 2 3.1 2 5.5a6 6 0 0 1-12 0c0-2.4 1.3-4.1 2-5.5z" />
    </svg>
  );
}

const HIIT_INPUTS: Record<ResolvedMetric["draftKey"], InputSpec> = {
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

const FIELD_INPUTS: Record<CardioField, InputSpec> = {
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
  for (const mt of resolveHiitMetrics(name)) {
    const v = s[mt.dbColumn];
    if (v == null) continue;
    if (mt.kind === "time") parts.push(formatSeconds(v));
    else parts.push(mt.unit ? `${fmt(v)} ${mt.unit}` : `${mt.label} ${fmt(v)}`);
  }
  return parts.length ? parts.join(" · ") : "–";
}

function formatSavedSet(exercise: Exercise, kind: SetKind, s: WorkoutSet): string {
  if (kind === "hiit") return formatHiitSet(exercise.name, s);
  if (kind === "strength") return `${s.reps ?? "–"} × ${fmt(s.weight_kg)} kg`;

  const cardioType: CardioType = exercise.cardio_type ?? "generic";
  const parts: string[] = [];
  for (const f of CARDIO_FIELDS[cardioType]) {
    if (f === "distance_km" && s.distance_km != null) parts.push(`${fmt(s.distance_km)} km`);
    else if (f === "distance_m" && s.distance_m != null) parts.push(`${fmt(s.distance_m)} m`);
    else if (f === "time" && s.time_seconds != null) parts.push(formatSeconds(s.time_seconds));
    else if (f === "calories" && s.calories != null) parts.push(`${fmt(s.calories)} kcal`);
    else if (f === "incline" && s.incline != null) parts.push(`incline ${fmt(s.incline)}`);
    else if (f === "resistance" && s.resistance != null) parts.push(`resist ${fmt(s.resistance)}`);
    else if (f === "weight" && s.weight_kg != null) parts.push(`${fmt(s.weight_kg)} kg`);
  }
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
