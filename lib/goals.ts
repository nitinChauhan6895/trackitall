// Exercise goals.
//
// A goal stores only its target. Progress is DERIVED from the exercises and
// sets already logged, never stored — so back-dating a workout updates its
// goals automatically and the two can't drift apart.
//
// Free of Date-now and locale calls so it can be unit-tested and so the server
// and device always agree (see lib/dateFormat.ts).

import { isCardio, type MuscleGroup } from "@/lib/types";

export const GOAL_METRICS = [
  "sets",
  "hard_sets",
  "frequency",
  "cardio_time",
  "running_distance",
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

export type GoalMetricMeta = {
  label: string;
  blurb: string;
  unit: string;
  icon: string;
  tone: string;
  /** Sensible quick-pick targets offered when creating the goal. */
  presets: number[];
  /** Which filter chip this belongs under. */
  group: "Strength" | "Cardio" | "Running";
};

export const GOAL_META: Record<GoalMetric, GoalMetricMeta> = {
  sets: {
    label: "Sets",
    blurb: "Total number of sets",
    unit: "sets",
    icon: "📊",
    tone: "#A8E830",
    presets: [50, 100, 120, 150, 200],
    group: "Strength",
  },
  hard_sets: {
    label: "Hard Sets",
    blurb: "Quality working sets",
    unit: "sets",
    icon: "🔥",
    tone: "#FF6233",
    presets: [20, 40, 60, 80, 100],
    group: "Strength",
  },
  frequency: {
    label: "Frequency",
    blurb: "Number of workouts",
    unit: "workouts",
    icon: "🗓",
    tone: "#C79BE8",
    presets: [3, 4, 5, 6, 7],
    group: "Strength",
  },
  cardio_time: {
    label: "Cardio Time",
    blurb: "Total time in cardio",
    unit: "min",
    icon: "❤️",
    tone: "#E0555A",
    presets: [60, 90, 120, 150, 200],
    group: "Cardio",
  },
  running_distance: {
    label: "Running Distance",
    blurb: "Total distance running",
    unit: "km",
    icon: "👟",
    tone: "#5A9BE0",
    presets: [5, 10, 15, 25, 40],
    group: "Running",
  },
};

export type Goal = {
  id: string;
  metric: GoalMetric;
  target: number;
  start_date: string;
  end_date: string;
  name: string | null;
  notes: string | null;
  archived: boolean;
};

/** The shape the goal maths needs out of a logged exercise. */
export type GoalExercise = {
  workout_date: string;
  muscle_group: string;
  cardio_type: string | null;
  sets: {
    reps: number | null;
    weight_kg: number | null;
    time_seconds: number | null;
    distance_km: number | null;
    distance_m: number | null;
    is_hard?: boolean | null;
  }[];
};

export type GoalProgress = {
  /** Progress in the metric's own unit. */
  value: number;
  target: number;
  /** 0-1, capped — a 130% week shouldn't overflow the ring. */
  ratio: number;
  percent: number;
  complete: boolean;
  /** Whole days remaining, 0 once the window has closed. */
  daysLeft: number;
  /** Per-day values across the window, for the bar chart. */
  perDay: { date: string; value: number }[];
};

function inWindow(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** What one exercise contributes to a metric. Frequency is counted per DAY, so
 *  it's handled by the caller rather than summed here. */
function contribution(metric: GoalMetric, e: GoalExercise): number {
  const cardioish = isCardio(e.muscle_group as MuscleGroup);
  let total = 0;
  for (const s of e.sets ?? []) {
    switch (metric) {
      // Sets and hard sets are STRENGTH metrics — a 40-minute run shouldn't
      // register as one set towards a 120-set week.
      case "sets":
        if (!cardioish) total += 1;
        break;
      case "hard_sets":
        if (!cardioish && s.is_hard) total += 1;
        break;
      case "cardio_time":
        // Minutes, and only from cardio work — counting a rest timer as cardio
        // would quietly inflate the goal.
        if (cardioish) total += (s.time_seconds ?? 0) / 60;
        break;
      case "running_distance":
        // Running specifically, not every cardio machine.
        if (cardioish && (e.cardio_type === "running" || e.cardio_type === null)) {
          total += (s.distance_km ?? 0) + (s.distance_m ?? 0) / 1000;
        }
        break;
      case "frequency":
        break;
    }
  }
  return total;
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Every date in the window, inclusive. */
export function windowDays(start: string, end: string): string[] {
  const n = Math.max(0, daysBetween(start, end));
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export function computeProgress(
  goal: Goal,
  exercises: GoalExercise[],
  today: string,
): GoalProgress {
  const days = windowDays(goal.start_date, goal.end_date);
  const perDayMap = new Map<string, number>(days.map((d) => [d, 0]));
  const trainedDays = new Set<string>();

  for (const e of exercises) {
    if (!inWindow(e.workout_date, goal.start_date, goal.end_date)) continue;
    if ((e.sets?.length ?? 0) > 0) trainedDays.add(e.workout_date);
    const add = contribution(goal.metric, e);
    if (add > 0) {
      perDayMap.set(e.workout_date, (perDayMap.get(e.workout_date) ?? 0) + add);
    }
  }

  if (goal.metric === "frequency") {
    // One per day trained, regardless of how much was done that day.
    for (const d of days) perDayMap.set(d, trainedDays.has(d) ? 1 : 0);
  }

  const perDay = days.map((date) => ({
    date,
    value: Math.round((perDayMap.get(date) ?? 0) * 10) / 10,
  }));
  const value = Math.round(perDay.reduce((n, d) => n + d.value, 0) * 10) / 10;

  const ratio = goal.target > 0 ? Math.min(1, value / goal.target) : 0;
  // Days left counts today as remaining — a goal ending today is not over yet.
  const daysLeft = Math.max(0, daysBetween(today, goal.end_date) + (today <= goal.end_date ? 1 : 0));

  return {
    value,
    target: goal.target,
    ratio,
    percent: Math.round(ratio * 100),
    complete: value >= goal.target,
    daysLeft: today > goal.end_date ? 0 : daysLeft,
    perDay,
  };
}

export function isActive(goal: Goal, today: string): boolean {
  return !goal.archived && today <= goal.end_date;
}

export function goalTitle(goal: Goal): string {
  return goal.name?.trim() || GOAL_META[goal.metric].label;
}

/** Format a value in the metric's unit, without pointless decimals. */
export function formatValue(metric: GoalMetric, value: number): string {
  const n = Math.round(value * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ---- window helpers for the create form ----

/** Monday-start week containing `date`. */
export function thisWeek(date: string): { start: string; end: string } {
  const d = new Date(date + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  const start = addDays(date, -dow);
  return { start, end: addDays(start, 6) };
}

export function thisMonth(date: string): { start: string; end: string } {
  const [y, m] = date.split("-").map(Number);
  const p = (v: number) => String(v).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${p(m)}-01`, end: `${y}-${p(m)}-${p(last)}` };
}
