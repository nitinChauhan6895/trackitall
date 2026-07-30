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
    time_seconds?: number | null;
    is_hard?: boolean | null;
  }[];
};

export type MuscleCount = { group: MuscleGroup; label: string; count: number };

export type WeekStats = {
  workoutDays: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  /** km totals per bucket across the window (see cardioBucketDays). */
  cardioSeries: number[];
  /** Cardio minutes per bucket, aligned 1:1 with cardioSeries/cardioLabels. */
  cardioTimeSeries: number[];
  /** One label per bucket. */
  cardioLabels: string[];
  /** 1 for short windows; 7 once a per-day bar chart would be unreadable. */
  cardioBucketDays: number;
  muscles: MuscleCount[]; // every tracked group (incl. 0), desc by count
  neglected: string[]; // group labels with 0 sessions
  /** Per-group load, busiest first; groups with no work are omitted. */
  load: GroupLoad[];
};

/** Selectable windows, in the order they're offered. */
export const RANGE_KEYS = [
  "thisWeek",
  "last7",
  "thisMonth",
  "lastMonth",
  "last30",
  "last60",
] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  thisWeek: "This week",
  last7: "Last 7 days",
  thisMonth: "Current month",
  lastMonth: "Last month",
  last30: "Last 30 days",
  last60: "Last 60 days",
};

export type SeriesPoint = { date: string; value: number };

/** Training load for one muscle group over the selected window. */
export type GroupLoad = {
  group: MuscleGroup;
  label: string;
  sets: number;
  hardSets: number;
  volumeKg: number;
  /** Distinct exercise names trained in the window. */
  exercises: number;
};

/** Headline numbers for the current calendar month. */
export type MonthSummary = {
  sessions: number;
  sets: number;
  volumeKg: number;
  groups: number;
};

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
  ranges: Record<RangeKey, WeekStats>;
  month: MonthSummary;
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
  cardioSec: number;
};

function weekStats(
  startKey: string,
  byDate: Map<string, DayAgg>,
  days = 7,
  exs: RawStatsExercise[] = [],
): WeekStats {
  const dayKeys = Array.from({ length: days }, (_, i) => addDays(startKey, i));
  const inWindow = new Set(dayKeys);
  let workoutDays = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;

  // Past a fortnight, one bar per day is too thin to read (and 60 of them
  // overflow the card), so longer windows are bucketed by week.
  const cardioBucketDays = days <= 14 ? 1 : 7;
  const cardioSeries: number[] = [];
  const cardioTimeSeries: number[] = [];
  const cardioLabels: string[] = [];
  let bucketKm = 0;
  let bucketSec = 0;

  dayKeys.forEach((k, i) => {
    const a = byDate.get(k);
    bucketKm += a?.cardioKm ?? 0;
    bucketSec += a?.cardioSec ?? 0;
    const bucketStart = i - (i % cardioBucketDays) === i;
    if (bucketStart) {
      cardioLabels.push(
        cardioBucketDays === 1
          ? WEEKDAY_LETTER[keyToDate(k).getDay()]
          : // "13/7" — locale-independent by construction.
            `${Number(k.slice(8, 10))}/${Number(k.slice(5, 7))}`,
      );
    }
    const bucketEnd = i % cardioBucketDays === cardioBucketDays - 1 || i === days - 1;
    if (bucketEnd) {
      cardioSeries.push(Math.round(bucketKm * 10) / 10);
      cardioTimeSeries.push(Math.round(bucketSec / 60));
      bucketKm = 0;
      bucketSec = 0;
    }
    if (a) {
      workoutDays++;
      totalSets += a.sets;
      totalReps += a.reps;
      totalVolumeKg += a.volume;
    }
  });

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

  // Per-group training load. Built from the raw rows rather than the per-day
  // aggregate because sets, hard sets and distinct exercises are all
  // group-scoped, which the day rollup has already flattened away.
  const loadMap = new Map<
    MuscleGroup,
    { sets: number; hardSets: number; volumeKg: number; names: Set<string> }
  >();
  for (const e of exs) {
    if (!inWindow.has(e.workout_date)) continue;
    const g = e.muscle_group as MuscleGroup;
    let l = loadMap.get(g);
    if (!l) {
      l = { sets: 0, hardSets: 0, volumeKg: 0, names: new Set() };
      loadMap.set(g, l);
    }
    l.names.add(e.name);
    for (const st of e.sets ?? []) {
      l.sets++;
      if (st.is_hard) l.hardSets++;
      if (st.reps != null && st.weight_kg != null) l.volumeKg += st.reps * st.weight_kg;
    }
  }
  const load: GroupLoad[] = Array.from(loadMap.entries())
    .map(([group, l]) => ({
      group,
      label: MUSCLE_GROUP_LABELS[group],
      sets: l.sets,
      hardSets: l.hardSets,
      volumeKg: Math.round(l.volumeKg),
      exercises: l.names.size,
    }))
    .sort((a, b) => b.sets - a.sets || b.volumeKg - a.volumeKg);

  return {
    load,
    workoutDays,
    totalSets,
    totalReps,
    totalVolumeKg,
    cardioSeries,
    cardioTimeSeries,
    cardioLabels,
    cardioBucketDays,
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
      a = { groups: new Set(), sets: 0, reps: 0, volume: 0, cardioKm: 0, cardioSec: 0 };
      byDate.set(e.workout_date, a);
    }
    a.groups.add(e.muscle_group);
    const cardioish = isCardio(e.muscle_group as MuscleGroup);
    for (const s of e.sets ?? []) {
      a.sets++;
      if (s.reps != null) a.reps += s.reps;
      if (s.reps != null && s.weight_kg != null) a.volume += s.reps * s.weight_kg;
      if (cardioish) {
        a.cardioKm += (s.distance_km ?? 0) + (s.distance_m ?? 0) / 1000;
        a.cardioSec += s.time_seconds ?? 0;
      }
    }
  }

  const allDates = Array.from(byDate.keys());
  const dow = (today.getDay() + 6) % 7; // Mon = 0
  const thisMon = addDays(todayKey, -dow);
  const last7Start = addDays(todayKey, -6);

  // Calendar months. The current one runs up to today rather than to the end
  // of the month, so its totals aren't diluted by days that haven't happened.
  const y = today.getFullYear();
  const mo = today.getMonth(); // 0-based
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${y}-${pad2(mo + 1)}-01`;
  const daysSoFarThisMonth = today.getDate();
  const prev = new Date(y, mo - 1, 1);
  const prevMonthStart = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}-01`;
  // Day 0 of the following month = last day of that month.
  const prevMonthDays = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();

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

  // Whole calendar month to date: sessions, sets, volume and how many distinct
  // muscle groups were hit.
  let monthSets = 0;
  let monthVolume = 0;
  const monthGroups = new Set<string>();
  for (const e of exs) {
    if (!e.workout_date.startsWith(monthPrefix)) continue;
    monthGroups.add(e.muscle_group);
    for (const st of e.sets ?? []) {
      monthSets++;
      if (st.reps != null && st.weight_kg != null) monthVolume += st.reps * st.weight_kg;
    }
  }
  const monthSummary: MonthSummary = {
    sessions: monthTotal,
    sets: monthSets,
    volumeKg: Math.round(monthVolume),
    groups: monthGroups.size,
  };

  return {
    hasAnyData: exs.length > 0,
    monthTotal,
    currentStreak: currentStreak(allDates, todayKey),
    bestStreak: longestStreak(allDates),
    ranges: {
      thisWeek: weekStats(thisMon, byDate, 7, exs),
      last7: weekStats(last7Start, byDate, 7, exs),
      thisMonth: weekStats(monthStart, byDate, daysSoFarThisMonth, exs),
      lastMonth: weekStats(prevMonthStart, byDate, prevMonthDays, exs),
      last30: weekStats(addDays(todayKey, -29), byDate, 30, exs),
      last60: weekStats(addDays(todayKey, -59), byDate, 60, exs),
    },
    // Calendar-month headline, independent of the range filter.
    month: monthSummary,
    strengthExercises,
    strengthSeries,
    strengthHistory,
  };
}
