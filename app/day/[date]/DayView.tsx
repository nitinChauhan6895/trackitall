"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { monthParam } from "@/lib/date";
import { fetchDayExercises, qk } from "@/lib/browserData";
import { enqueue, isOffline, runOp, type OpType } from "@/lib/offlineQueue";
import {
  CARDIO_FIELDS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  formatSeconds,
  isCardio,
  parseDuration,
  parseTimeToSeconds,
  type CardioField,
  type CardioType,
  type Exercise,
  type MuscleGroup,
  type WorkoutSet,
} from "@/lib/types";
import { resolveHiitMetrics, type ResolvedMetric } from "@/lib/hiit";
import SharePicker from "@/components/SharePicker";
import { shareWholeDay } from "@/app/actions";
import DayExercise from "./DayExercise";
import GroupMenu from "./GroupMenu";

type SetKind = "cardio" | "hiit" | "strength";
type InputSpec = { name: string; placeholder: string; type: "number" | "text"; step?: string };

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

// Client-rendered day view: reads the day's exercises from the persisted query
// cache (instant on re-open, reconciled in the background); edits invalidate the
// day key to refetch.
export default function DayView({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  // Local-first: whatever is in the persisted (IndexedDB) cache renders
  // immediately; the network refresh is a background nicety. Offline with
  // nothing cached simply means an empty day, which is the truth.
  const { data: exercises = [] } = useQuery({
    queryKey: qk.day(date),
    queryFn: () => fetchDayExercises(date),
    retry: false,
  });
  const onChanged = () => queryClient.invalidateQueries({ queryKey: qk.day(date) });

  // Run an edit against the cached day. The optimistic update is applied first
  // so the UI responds instantly; if we're offline the op is queued and the
  // optimistic state simply stays put (a failed background refetch leaves the
  // last-good data in place) until the queue drains on reconnect.
  async function mutate(
    type: OpType,
    payload: any,
    optimistic?: (prev: Exercise[]) => Exercise[],
  ) {
    if (optimistic) {
      queryClient.setQueryData<Exercise[]>(qk.day(date), (prev) =>
        optimistic(prev ?? exercises),
      );
    }
    try {
      await runOp(type, payload);
      onChanged();
    } catch {
      if (isOffline()) await enqueue(type, payload);
      else onChanged(); // genuine failure — fall back to server truth
    }
  }

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

  const [y, m, dd] = date.split("-").map(Number);
  const backHref = `/?m=${monthParam(y, m)}`;
  const prevKey = shiftKey(date, -1);
  const nextKey = shiftKey(date, 1);
  // Deterministic (locale-free) so the SSR and client renders match exactly.
  const dt = new Date(y, m - 1, dd);
  const heading = `${WEEKDAYS_FULL[dt.getDay()]}, ${dd} ${MONTHS_FULL[m - 1].slice(0, 3)}`;

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      {/* Top controls (glass) */}
      <div className="flex items-center gap-2 pt-4">
        <Link href={backHref} aria-label="Back to calendar" className={GLASS_BUTTON}>
          <Chevron d="M19 12H5M12 19l-7-7 7-7" size={18} />
        </Link>
        <div className="flex-1" />
        <div className="elevation-3 flex h-11 rounded-full bg-white/[0.08]">
          <Link href={`/day/${prevKey}`} aria-label="Previous day" className="flex h-11 w-11 items-center justify-center rounded-l-full active:bg-white/10">
            <Chevron d="M15 18l-6-6 6-6" size={16} />
          </Link>
          <span aria-hidden className="my-3 w-px bg-white/[0.14]" />
          <Link href={`/day/${nextKey}`} aria-label="Next day" className="flex h-11 w-11 items-center justify-center rounded-r-full active:bg-white/10">
            <Chevron d="M9 18l6-6-6-6" size={16} />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          disabled={exercises.length === 0}
          aria-label="Share this workout"
          className={`${GLASS_BUTTON} disabled:opacity-40`}
        >
          <ShareIcon />
        </button>
      </div>

      {/* Title */}
      <header className="flex flex-col gap-1 px-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted">WORKOUT</span>
        <h1 suppressHydrationWarning className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">
          {heading}
        </h1>
        <p className="text-sm text-muted">
          {plural(exercises.length, "exercise")} · {plural(totalSets, "set")}
        </p>
      </header>

      {/* Hero stats */}
      <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">TOTAL VOLUME</span>
          <span suppressHydrationWarning className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
            {fmtNumber(totalVolume, 0)} <span className="text-xl font-semibold text-green">kg</span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={totalSets} label="Sets" />
          <Stat value={exercises.length} label="Exercises" />
          <Stat value={byGroup.size} label="Muscles" />
        </div>
      </section>

      {exercises.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/15 px-4 py-8 text-center text-sm text-muted">
          No workout saved for this day yet.
        </p>
      ) : (
        MUSCLE_GROUPS.filter((g) => byGroup.has(g)).map((group) => {
          const list = byGroup.get(group)!;
          const kind = kindOf(group);
          const groupSets = list.reduce((n, e) => n + e.sets.length, 0);
          return (
            // No overflow-hidden on the card: the ⋮ menu renders absolutely
            // inside it, and a one-exercise card is shorter than the menu —
            // clipping would crop it.
            <section
              key={group}
              className="elevation-1 relative flex flex-col gap-3.5 rounded-[28px] px-[18px] pb-5 pt-[18px]"
            >
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-lg font-semibold">{MUSCLE_GROUP_LABELS[group]}</h2>
                <span className="elevation-2 rounded-full px-2.5 py-1 text-xs font-medium text-muted">
                  {plural(list.length, "exercise")} · {plural(groupSets, "set")}
                </span>
                <div className="-my-2 -mr-2.5 ml-auto">
                  <GroupMenu
                    date={date}
                    group={group}
                    groupLabel={MUSCLE_GROUP_LABELS[group]}
                    onDeleteGroup={() =>
                      mutate("deleteGroup", { date, group }, (prev) =>
                        prev.filter((e) => e.muscle_group !== group),
                      )
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col divide-y divide-[#2C2C2C]">
                {list.map((ex, i) => (
                  <DayExercise
                    key={ex.id}
                    exerciseId={ex.id}
                    date={date}
                    name={ex.name}
                    index={i + 1}
                    volume={fmtNumber(exerciseVolume(ex))}
                    sets={ex.sets.map((s) => ({
                      id: s.id,
                      label: formatSavedSet(ex, kind, s),
                      isHard: s.is_hard === true,
                    }))}
                    inputs={inputsFor(ex, kind)}
                    timeUnitSelectable={kind === "cardio"}
                    onAddSet={(fields) =>
                      mutate(
                        "addSet",
                        {
                          ...fields,
                          exercise_id: ex.id,
                          date,
                          // Cardio durations are minutes; the server parses
                          // "time" with this so a bare "30" isn't 30 seconds.
                          time_unit: kind === "cardio" ? "minutes" : "seconds",
                        },
                        (prev) =>
                          prev.map((e) =>
                            e.id === ex.id
                              ? { ...e, sets: [...e.sets, synthSet(fields, kind)] }
                              : e,
                          ),
                      )
                    }
                    onDeleteSet={(setId) =>
                      mutate("deleteSet", { id: setId, date }, (prev) =>
                        prev.map((e) =>
                          e.id === ex.id
                            ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
                            : e,
                        ),
                      )
                    }
                    onDeleteExercise={() =>
                      mutate("deleteExercise", { id: ex.id, date }, (prev) =>
                        prev.filter((e) => e.id !== ex.id),
                      )
                    }
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* Floating glass action, bottom-right. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md justify-end px-4 pb-7 safe-bottom">
        <Link
          href={`/log/${date}`}
          className="pointer-events-auto flex h-[60px] items-center gap-2 elevation-3 rounded-full bg-green/[0.92] pl-5 pr-6 text-base font-semibold text-ink-inverse transition active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add exercise
        </Link>
      </div>

      {shareOpen && (
        <ShareDayModal date={date} onClose={() => setShareOpen(false)} />
      )}
    </main>
  );
}

const GLASS_BUTTON =
  "elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15";

function Chevron({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Weight moved by an exercise's strength sets (reps × kg); 0 for cardio.
function exerciseVolume(ex: Exercise): number {
  let v = 0;
  for (const s of ex.sets) if (s.reps != null && s.weight_kg != null) v += s.reps * s.weight_kg;
  return v;
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function ShareDayModal({ date, onClose }: { date: string; onClose: () => void }) {
  return (
    <SharePicker
      title="Share this workout"
      subtitle="Every muscle group from this day."
      onShare={(toUserId) => shareWholeDay({ toUserId, date })}
      onClose={onClose}
    />
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="elevation-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-3">
      <span suppressHydrationWarning className="font-display text-[22px] font-semibold">
        {value}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Locale-free thousands grouping (so SSR and client match), with at most
// `decimals` places and no trailing zeros.
function fmtNumber(v: number, decimals = 2): string {
  const [int, frac] = String(Number(v.toFixed(decimals))).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

// Builds the row the server would have created, so a set added offline renders
// immediately (and formats) exactly like a saved one.
function synthSet(fields: Record<string, string>, kind: SetKind): WorkoutSet {
  const n = (v?: string) => {
    if (v == null || v.trim() === "") return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    position: Number.MAX_SAFE_INTEGER,
    reps: n(fields.reps),
    weight_kg: n(fields.weight),
    distance_km: n(fields.distance_km),
    distance_m: n(fields.distance_m),
    speed_kmh: n(fields.speed),
    time_seconds: parseDuration(
      fields.time ?? "",
      fields.time_unit === "seconds"
        ? "seconds"
        : kind === "cardio"
          ? "minutes"
          : "seconds",
    ),
    calories: n(fields.calories),
    incline: n(fields.incline),
    resistance: n(fields.resistance),
    sets_count: n(fields.sets_count),
    height: n(fields.height),
    floors: n(fields.floors),
  } as WorkoutSet;
}

function shiftKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
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
  time: { name: "time", placeholder: "Minutes (e.g. 30)", type: "text" },
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
