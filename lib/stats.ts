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
    position?: number | null;
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

/** One logged set, as it appeared in a session. */
export type HistorySet = { reps: number | null; weightKg: number | null };

/** A past session of a single exercise, for progressive-overload context. */
export type HistorySession = {
  date: string;
  sets: HistorySet[];
  topWeightKg: number;
  /** reps x weight summed over the session. */
  volumeKg: number;
};

// How many past sessions per exercise to keep. The whole history would be sent
// to the browser and cached in IndexedDB; a few months of context is enough to
// judge whether you're progressing.
const HISTORY_LIMIT = 12;

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
  /** Most recent sessions first, capped at HISTORY_LIMIT per exercise. */
  strengthHistory: Record<string, HistorySession[]>;
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

  // Session-by-session set detail, so the chart can be read alongside what was
  // actually lifted. One exercise can appear as several rows on the same date
  // (e.g. logged under two groups), so sets are merged per name+date.
  const historyMap = new Map<string, Map<string, HistorySet[]>>();
  for (const e of exs) {
    if (!seriesMap.has(e.name)) continue; // weight-based exercises only
    let byDay = historyMap.get(e.name);
    if (!byDay) {
      byDay = new Map();
      historyMap.set(e.name, byDay);
    }
    const list = byDay.get(e.workout_date) ?? [];
    const ordered = [...(e.sets ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    for (const s of ordered) {
      list.push({ reps: s.reps, weightKg: s.weight_kg });
    }
    byDay.set(e.workout_date, list);
  }

  const strengthHistory: Record<string, HistorySession[]> = {};
  for (const [name, byDay] of historyMap) {
    strengthHistory[name] = Array.from(byDay.entries())
      .map(([date, sets]) => ({
        date,
        sets,
        topWeightKg: sets.reduce((mx, s) => Math.max(mx, s.weightKg ?? 0), 0),
        volumeKg: sets.reduce(
          (sum, s) => sum + (s.reps ?? 0) * (s.weightKg ?? 0),
          0,
        ),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
      .slice(0, HISTORY_LIMIT);
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
    strengthHistory,
  };
}
