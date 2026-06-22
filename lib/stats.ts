import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  isCardio,
  type MuscleGroup,
} from "@/lib/types";
import { currentStreak, longestStreak } from "@/lib/badges";
import { toDateKey } from "@/lib/date";

export type RawStatsExercise = {
  workout_date: string;
  muscle_group: string;
  name: string;
  cardio_type: string | null;
  sets: {
    reps: number | null;
    weight_kg: number | null;
    distance_km: number | null;
    distance_m: number | null;
  }[];
};

export type MuscleCount = { group: MuscleGroup; label: string; count: number };

export type WeekStats = {
  workoutDays: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  cardioPerDay: number[]; // 7 daily km totals across the window
  dayLabels: string[]; // weekday letter per day
  muscles: MuscleCount[]; // every tracked group (incl. 0), desc by count
  neglected: string[]; // group labels with 0 sessions
};

export type SeriesPoint = { date: string; value: number };

export type StatsData = {
  hasAnyData: boolean;
  monthTotal: number;
  currentStreak: number;
  bestStreak: number;
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  last7: WeekStats;
  strengthExercises: string[];
  strengthSeries: Record<string, SeriesPoint[]>;
};

// Muscle groups shown in the breakdown / neglected list (HIIT excluded).
const TRACKED_GROUPS = MUSCLE_GROUPS.filter((g) => g !== "hiit");
const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

function keyToDate(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(k: string, n: number): string {
  const d = keyToDate(k);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

type DayAgg = {
  groups: Set<string>;
  sets: number;
  reps: number;
  volume: number;
  cardioKm: number;
};

function weekStats(startKey: string, byDate: Map<string, DayAgg>): WeekStats {
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
  let workoutDays = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;
  const cardioPerDay: number[] = [];
  const dayLabels: string[] = [];

  for (const k of dayKeys) {
    const a = byDate.get(k);
    cardioPerDay.push(a ? Math.round(a.cardioKm * 10) / 10 : 0);
    dayLabels.push(WEEKDAY_LETTER[keyToDate(k).getDay()]);
    if (a) {
      workoutDays++;
      totalSets += a.sets;
      totalReps += a.reps;
      totalVolumeKg += a.volume;
    }
  }

  const counts = new Map<MuscleGroup, number>();
  for (const k of dayKeys) {
    const a = byDate.get(k);
    if (!a) continue;
    for (const g of a.groups) {
      const mg = g as MuscleGroup;
      counts.set(mg, (counts.get(mg) ?? 0) + 1);
    }
  }
  const muscles = TRACKED_GROUPS.map((g) => ({
    group: g,
    label: MUSCLE_GROUP_LABELS[g],
    count: counts.get(g) ?? 0,
  })).sort((a, b) => b.count - a.count);
  const neglected = muscles.filter((m) => m.count === 0).map((m) => m.label);

  return {
    workoutDays,
    totalSets,
    totalReps,
    totalVolumeKg,
    cardioPerDay,
    dayLabels,
    muscles,
    neglected,
  };
}

export function computeStats(exs: RawStatsExercise[], today: Date): StatsData {
  const todayKey = toDateKey(today);

  const byDate = new Map<string, DayAgg>();
  for (const e of exs) {
    let a = byDate.get(e.workout_date);
    if (!a) {
      a = { groups: new Set(), sets: 0, reps: 0, volume: 0, cardioKm: 0 };
      byDate.set(e.workout_date, a);
    }
    a.groups.add(e.muscle_group);
    const cardioish = isCardio(e.muscle_group as MuscleGroup);
    for (const s of e.sets ?? []) {
      a.sets++;
      if (s.reps != null) a.reps += s.reps;
      if (s.reps != null && s.weight_kg != null) a.volume += s.reps * s.weight_kg;
      if (cardioish) a.cardioKm += (s.distance_km ?? 0) + (s.distance_m ?? 0) / 1000;
    }
  }

  const allDates = Array.from(byDate.keys());
  const dow = (today.getDay() + 6) % 7; // Mon = 0
  const thisMon = addDays(todayKey, -dow);
  const lastMon = addDays(thisMon, -7);
  const last7Start = addDays(todayKey, -6);

  const monthPrefix = todayKey.slice(0, 7);
  const monthTotal = allDates.filter((d) => d.startsWith(monthPrefix)).length;

  // Strength series: max weight per session per exercise.
  const seriesMap = new Map<string, Map<string, number>>();
  for (const e of exs) {
    for (const s of e.sets ?? []) {
      if (s.weight_kg == null) continue;
      let m = seriesMap.get(e.name);
      if (!m) {
        m = new Map();
        seriesMap.set(e.name, m);
      }
      const cur = m.get(e.workout_date) ?? 0;
      if (s.weight_kg > cur) m.set(e.workout_date, s.weight_kg);
    }
  }
  const strengthExercises = Array.from(seriesMap.keys()).sort();
  const strengthSeries: Record<string, SeriesPoint[]> = {};
  for (const [name, m] of seriesMap) {
    strengthSeries[name] = Array.from(m.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  return {
    hasAnyData: exs.length > 0,
    monthTotal,
    currentStreak: currentStreak(allDates, todayKey),
    bestStreak: longestStreak(allDates),
    thisWeek: weekStats(thisMon, byDate),
    lastWeek: weekStats(lastMon, byDate),
    last7: weekStats(last7Start, byDate),
    strengthExercises,
    strengthSeries,
  };
}
