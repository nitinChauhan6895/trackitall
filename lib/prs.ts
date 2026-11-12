// Automatic personal records, computed from the workout log.
//
// Rules (agreed with the user):
// - Weights: heaviest weight lifted for an exercise.
// - Cardio: longest distance and longest duration per activity.
// - HIIT and bodyweight-only sets don't count.
// - The first time an exercise is logged only sets the baseline. A PR "event"
//   happens when a later workout BEATS the previous best; that's what the day
//   view celebrates, with the increment.
//
// Pure functions: the server (Home, badges) and the browser (PR corner, day
// view) feed them the same rows, so every screen agrees.

export type PrMetric = "weight" | "distance" | "duration";

/** One logged exercise with the set fields PRs care about. */
export type PrSourceRow = {
  name: string;
  muscle_group: string;
  workout_date: string; // YYYY-MM-DD
  created_at?: string | null;
  sets: {
    reps: number | null;
    weight_kg: number | null;
    distance_km: number | null;
    distance_m: number | null;
    time_seconds: number | null;
  }[];
};

/** A beaten best on a given day. */
export type PrEvent = {
  key: string;
  name: string;
  metric: PrMetric;
  date: string;
  value: number; // kg, km or seconds
  previous: number;
  delta: number;
  /** Weights: reps done at the new best weight. */
  reps: number | null;
};

/** The current best for one exercise + metric. */
export type PrRecord = {
  key: string;
  name: string;
  metric: PrMetric;
  value: number;
  reps: number | null;
  /** When the current best was first reached. */
  date: string;
  /** Size of the last improvement; null while it's still the baseline. */
  delta: number | null;
  /** How many times the best has been beaten. */
  improvements: number;
};

export const PR_SELECT =
  "name, muscle_group, workout_date, created_at, sets(reps, weight_kg, distance_km, distance_m, time_seconds)";

const EPS = 1e-6;

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

type DayBest = { name: string; metric: PrMetric; date: string; value: number; reps: number | null; order: string };

/** Each exercise-day's best value per metric. */
function dayBests(rows: PrSourceRow[]): Map<string, DayBest[]> {
  const byKeyDay = new Map<string, DayBest>();
  for (const r of rows) {
    if (!r.name?.trim() || r.muscle_group === "hiit") continue;
    const base = normalise(r.name);
    const cardio = r.muscle_group === "cardio";
    const candidates: { metric: PrMetric; value: number; reps: number | null }[] = [];
    for (const s of r.sets ?? []) {
      if (cardio) {
        const km = s.distance_km != null ? Number(s.distance_km) : s.distance_m != null ? Number(s.distance_m) / 1000 : 0;
        if (km > 0) candidates.push({ metric: "distance", value: km, reps: null });
        const secs = Number(s.time_seconds ?? 0);
        if (secs > 0) candidates.push({ metric: "duration", value: secs, reps: null });
      } else {
        const kg = Number(s.weight_kg ?? 0);
        if (kg > 0) candidates.push({ metric: "weight", value: kg, reps: s.reps != null ? Number(s.reps) : null });
      }
    }
    for (const c of candidates) {
      const k = `${base}|${c.metric}|${r.workout_date}`;
      const prev = byKeyDay.get(k);
      const better =
        !prev ||
        c.value > prev.value + EPS ||
        // Same weight, more reps: keep the better set's reps.
        (Math.abs(c.value - prev.value) <= EPS && (c.reps ?? 0) > (prev.reps ?? 0));
      if (better) {
        byKeyDay.set(k, {
          name: r.name.trim(),
          metric: c.metric,
          date: r.workout_date,
          value: c.value,
          reps: c.reps,
          order: `${r.workout_date}|${r.created_at ?? ""}`,
        });
      }
    }
  }
  const byKey = new Map<string, DayBest[]>();
  byKeyDay.forEach((d, k) => {
    const key = k.slice(0, k.lastIndexOf("|"));
    const list = byKey.get(key) ?? [];
    list.push(d);
    byKey.set(key, list);
  });
  byKey.forEach((list) => list.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0)));
  return byKey;
}

/** Every exercise's current best, and every time a best was beaten. */
export function computePrs(rows: PrSourceRow[]): { records: PrRecord[]; events: PrEvent[] } {
  const records: PrRecord[] = [];
  const events: PrEvent[] = [];
  dayBests(rows).forEach((days, key) => {
    let best: DayBest | null = null;
    let delta: number | null = null;
    let improvements = 0;
    for (const d of days) {
      if (!best) {
        best = d; // baseline: not a PR event
        continue;
      }
      if (d.value > best.value + EPS) {
        const diff = d.value - best.value;
        events.push({ key, name: d.name, metric: d.metric, date: d.date, value: d.value, previous: best.value, delta: diff, reps: d.reps });
        delta = diff;
        improvements++;
        best = d;
      }
    }
    if (best) {
      // Show the most recent spelling of the exercise name.
      const latestName = days[days.length - 1].name;
      records.push({ key, name: latestName, metric: best.metric, value: best.value, reps: best.reps, date: best.date, delta, improvements });
    }
  });
  records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name)));
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { records, events };
}

/**
 * Exercises (lower-cased names) whose best was beaten within the last `days`
 * days, counting from `todayKey` (YYYY-MM-DD). Baselines don't count, matching
 * what the day view celebrates. The Coach uses this to favour exercises the
 * user is progressing on.
 */
export function recentPrNames(events: PrEvent[], todayKey: string, days: number): Set<string> {
  const today = keyToUtcMs(todayKey);
  const names = new Set<string>();
  for (const e of events) {
    const age = Math.round((today - keyToUtcMs(e.date)) / 86_400_000);
    if (age >= 0 && age <= days) names.add(e.name.trim().toLowerCase());
  }
  return names;
}

function keyToUtcMs(k: string): number {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// ---------- presentation ----------

function trim(n: number, dp: number): string {
  return String(Number(n.toFixed(dp)));
}

export function formatDurationShort(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "45 kg", "5.2 km", "32:10". */
export function formatPrValue(metric: PrMetric, value: number): string {
  if (metric === "weight") return `${trim(value, 2)} kg`;
  if (metric === "distance") return `${trim(value, 2)} km`;
  return formatDurationShort(value);
}

/** The increment chip text: "2.5 kg", "0.4 km", "1:30". */
export function formatPrDelta(metric: PrMetric, delta: number): string {
  return formatPrValue(metric, delta);
}

export function prTitle(metric: PrMetric): string {
  if (metric === "weight") return "Heaviest lift!";
  if (metric === "distance") return "Longest distance!";
  return "Longest session!";
}

export function prMetricLabel(metric: PrMetric): string {
  if (metric === "weight") return "Heaviest";
  if (metric === "distance") return "Distance";
  return "Duration";
}
