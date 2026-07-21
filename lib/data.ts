import { createClient } from "@/lib/supabase/server";
import { getLocalUser } from "@/lib/supabase/user";
import {
  MUSCLE_GROUPS,
  type Circuit,
  type Exercise,
  type IncomingShare,
  type Measurement,
  type MuscleGroup,
  type Pr,
  type Profile,
} from "@/lib/types";
import {
  currentStreak,
  hasPerfectWeek,
  longestGapDays,
  longestStreak,
  maxWorkoutsInWindow,
  type BadgeStats,
} from "@/lib/badges";
import { computeStats, type StatsData } from "@/lib/stats";
import {
  COACH_GROUPS,
  COACH_TO_APP,
  type CoachGroup,
  type CoachProfile,
  type LibraryExercise,
  type WorkoutTemplate,
} from "@/lib/coach/types";
import { type History } from "@/lib/coach/engine";
import {
  DEFAULT_TARGETS,
  sumMacros,
  type Food,
  type FoodLogEntry,
  type Macros,
  type NutritionTargets,
  type SavedMeal,
} from "@/lib/nutrition";
import { toDateKey } from "@/lib/date";
import { type HabitsData } from "@/lib/habits";
import { type Goal, type GoalExercise } from "@/lib/goals";

export async function getProfile(): Promise<Profile> {
  const supabase = createClient();
  const user = getLocalUser(); // local cookie decode — no auth round-trip

  const fallbackUsername = (user?.email ?? "there").split("@")[0] || "there";

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, first_name, last_name, email, share_to_community")
      .eq("user_id", user.id)
      .single();
    if (data) return data as Profile;
  }

  // Profile row missing (e.g. a legacy account from before the round-2 migration).
  return {
    user_id: user?.id ?? "",
    username: fallbackUsername,
    first_name: null,
    last_name: null,
    email: user?.email ?? null,
    share_to_community: false,
  };
}

export async function getMonthWorkoutDays(
  year: number,
  month: number, // 1-12
): Promise<Set<string>> {
  const supabase = createClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date")
    .gte("workout_date", start)
    .lte("workout_date", end);

  if (error) throw error;
  return new Set((data ?? []).map((r) => r.workout_date as string));
}

// Map of dateKey -> distinct muscle groups trained that day (in canonical order).
export async function getMonthWorkoutSummary(
  year: number,
  month: number,
): Promise<Map<string, MuscleGroup[]>> {
  const supabase = createClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date, muscle_group")
    .gte("workout_date", start)
    .lte("workout_date", end);

  if (error) throw error;

  const sets = new Map<string, Set<MuscleGroup>>();
  for (const row of data ?? []) {
    const key = row.workout_date as string;
    const g = row.muscle_group as MuscleGroup;
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key)!.add(g);
  }

  const out = new Map<string, MuscleGroup[]>();
  for (const [key, groupSet] of sets) {
    out.set(
      key,
      MUSCLE_GROUPS.filter((g) => groupSet.has(g)),
    );
  }
  return out;
}

// Muscle groups trained on each of the last `days` days, most-recent first.
export type TrainingDay = { key: string; isToday: boolean; groups: MuscleGroup[] };

export async function getRecentTraining(days = 7): Promise<TrainingDay[]> {
  const supabase = createClient();
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));

  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date, muscle_group")
    .gte("workout_date", toDateKey(start))
    .lte("workout_date", toDateKey(today));
  if (error) throw error;

  const byDay = new Map<string, Set<MuscleGroup>>();
  for (const row of data ?? []) {
    const key = row.workout_date as string;
    if (!byDay.has(key)) byDay.set(key, new Set());
    byDay.get(key)!.add(row.muscle_group as MuscleGroup);
  }

  const todayKey = toDateKey(today);
  const out: TrainingDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateKey(d);
    const set = byDay.get(key);
    out.push({
      key,
      isToday: key === todayKey,
      groups: set ? MUSCLE_GROUPS.filter((g) => set.has(g)) : [],
    });
  }
  return out;
}

export type WorkoutStats = { last7: number; last14: number; month: number };

export async function getWorkoutStats(): Promise<WorkoutStats> {
  const supabase = createClient();
  const today = new Date();
  const todayKey = toDateKey(today);

  const start7 = new Date(today);
  start7.setDate(today.getDate() - 6);
  const start14 = new Date(today);
  start14.setDate(today.getDate() - 13);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Query wide enough to cover the rolling windows AND the whole calendar month
  // (which may extend past today if future workouts were logged).
  const queryStart = start14 < monthStart ? start14 : monthStart;
  const queryEnd = today > monthEnd ? today : monthEnd;

  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date")
    .gte("workout_date", toDateKey(queryStart))
    .lte("workout_date", toDateKey(queryEnd));

  if (error) throw error;

  const days = new Set((data ?? []).map((r) => r.workout_date as string));

  const key7 = toDateKey(start7);
  const key14 = toDateKey(start14);
  const keyMonthStart = toDateKey(monthStart);
  const keyMonthEnd = toDateKey(monthEnd);

  let last7 = 0;
  let last14 = 0;
  let month = 0;
  for (const key of days) {
    // Rolling windows end today; future-dated days don't count.
    if (key >= key7 && key <= todayKey) last7++;
    if (key >= key14 && key <= todayKey) last14++;
    // "This month" = the whole calendar month, including future days in it.
    if (key >= keyMonthStart && key <= keyMonthEnd) month++;
  }
  return { last7, last14, month };
}

export async function getDayExercises(date: string): Promise<Exercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*, sets(*)")
    .eq("workout_date", date)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    ...e,
    sets: (e.sets ?? []).sort((a: any, b: any) => a.position - b.position),
  })) as Exercise[];
}

export async function getAllPrs(): Promise<Pr[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prs")
    .select("*")
    .order("achieved_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pr[];
}

type DayAgg = {
  date: string;
  groups: Set<string>;
  cardio: boolean;
  strength: boolean;
  maxRunKm: number;
  cardioKm: number;
  maxDeadlift: number;
};

const DAY_MS = 86400000;
function keyToMs(k: string): number {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// Replays days in chronological order to find the date each badge was first earned.
function computeEarnedDates(
  dayList: DayAgg[],
  prs: any[],
): Record<string, string | null> {
  const earned: Record<string, string> = {};
  const set = (id: string, date: string) => {
    if (!earned[id]) earned[id] = date;
  };

  let workouts = 0;
  let strengthSessions = 0;
  let cardioSessions = 0;
  let cumCardioKm = 0;
  let maxRun = 0;
  let maxDl = 0;
  let run = 0;
  let prevMs: number | null = null;
  const dayMsSeen: number[] = [];
  const weeks = new Map<number, Set<number>>();

  for (const d of dayList) {
    const ms = keyToMs(d.date);
    workouts++;
    if (workouts === 1) set("firstRep", d.date);
    if (workouts === 50) set("halfCentury", d.date);
    if (workouts === 100) set("century", d.date);

    // Variety Master: 5 distinct muscle groups trained on a single day.
    if (d.groups.size >= 5) set("variety", d.date);

    if (d.strength && ++strengthSessions >= 10) set("ironRookie", d.date);
    if (d.cardio && ++cardioSessions >= 15) set("cardioKing", d.date);

    cumCardioKm += d.cardioKm;
    if (cumCardioKm >= 100) set("cardioCrusher", d.date);

    maxRun = Math.max(maxRun, d.maxRunKm);
    if (maxRun >= 3) set("run3k", d.date);
    if (maxRun >= 5) set("run5k", d.date);

    maxDl = Math.max(maxDl, d.maxDeadlift);
    if (maxDl >= 100) set("deadlift100", d.date);

    if (prevMs != null && (ms - prevMs) / DAY_MS >= 15) set("comeback", d.date);
    run = prevMs != null && ms - prevMs === DAY_MS ? run + 1 : 1;
    if (run >= 3) set("streak3", d.date);
    if (run >= 5) set("streak5", d.date);
    if (run >= 30) set("unstoppable", d.date);

    dayMsSeen.push(ms);
    if (dayMsSeen.filter((x) => x >= ms - 6 * DAY_MS && x <= ms).length >= 7)
      set("weekWarrior", d.date);

    const dow = new Date(ms).getUTCDay();
    const monday = ms - ((dow + 6) % 7) * DAY_MS;
    if (!weeks.has(monday)) weeks.set(monday, new Set());
    weeks.get(monday)!.add(ms);
    if (weeks.get(monday)!.size >= 7) set("perfectWeek", d.date);

    prevMs = ms;
  }

  let pbDate: string | null = null;
  for (const p of prs) {
    if (
      p.updated_at &&
      p.created_at &&
      new Date(p.updated_at).getTime() - new Date(p.created_at).getTime() > 60000
    ) {
      const k = toDateKey(new Date(p.updated_at));
      if (!pbDate || k < pbDate) pbDate = k;
    }
  }
  if (pbDate) earned["personalBest"] = pbDate;

  return earned;
}

export async function getBadgeData(): Promise<{
  stats: BadgeStats;
  earnedDates: Record<string, string | null>;
}> {
  const supabase = createClient();
  const [exRes, prRes] = await Promise.all([
    supabase
      .from("exercises")
      .select(
        "workout_date, muscle_group, name, cardio_type, sets(distance_km, distance_m, weight_kg)",
      ),
    supabase.from("prs").select("created_at, updated_at"),
  ]);

  const exs = (exRes.data ?? []) as any[];
  const days = exs.map((e) => e.workout_date as string);

  // Per-day aggregation (drives both totals and the chronological replay).
  const dayMap = new Map<string, DayAgg>();
  let maxRunKm = 0;
  let totalCardioKm = 0;
  let maxDeadliftKg = 0;

  for (const e of exs) {
    const date = e.workout_date as string;
    const g = e.muscle_group as string;
    const cardioish = g === "cardio" || g === "hiit";
    const isRun = /run/i.test(e.name ?? "") || e.cardio_type === "running";
    const isDeadlift = /deadlift/i.test(e.name ?? "");

    let agg = dayMap.get(date);
    if (!agg) {
      agg = { date, groups: new Set(), cardio: false, strength: false, maxRunKm: 0, cardioKm: 0, maxDeadlift: 0 };
      dayMap.set(date, agg);
    }
    agg.groups.add(g);
    if (cardioish) agg.cardio = true;
    else agg.strength = true;

    for (const s of e.sets ?? []) {
      if (isRun && s.distance_km != null) {
        maxRunKm = Math.max(maxRunKm, s.distance_km);
        agg.maxRunKm = Math.max(agg.maxRunKm, s.distance_km);
      }
      if (cardioish) {
        const km = (s.distance_km ?? 0) + (s.distance_m ?? 0) / 1000;
        totalCardioKm += km;
        agg.cardioKm += km;
      }
      if (isDeadlift && s.weight_kg != null) {
        maxDeadliftKg = Math.max(maxDeadliftKg, s.weight_kg);
        agg.maxDeadlift = Math.max(agg.maxDeadlift, s.weight_kg);
      }
    }
  }

  const cardioDays = new Set<string>();
  const strengthDays = new Set<string>();
  let maxGroupsInDay = 0;
  for (const a of dayMap.values()) {
    if (a.cardio) cardioDays.add(a.date);
    if (a.strength) strengthDays.add(a.date);
    maxGroupsInDay = Math.max(maxGroupsInDay, a.groups.size);
  }

  const prs = (prRes.data ?? []) as any[];
  const pbBeaten = prs.some(
    (p) =>
      p.updated_at &&
      p.created_at &&
      new Date(p.updated_at).getTime() - new Date(p.created_at).getTime() > 60000,
  );

  const stats: BadgeStats = {
    totalWorkouts: new Set(days).size,
    currentStreak: currentStreak(days, toDateKey(new Date())),
    longestStreak: longestStreak(days),
    maxWorkoutsInWeek: maxWorkoutsInWindow(days, 7),
    hasPerfectWeek: hasPerfectWeek(days),
    longestGapDays: longestGapDays(days),
    maxRunKm,
    totalCardioKm,
    cardioSessions: cardioDays.size,
    strengthSessions: strengthDays.size,
    maxDeadliftKg,
    maxGroupsInDay,
    pbBeaten,
    prCount: prs.length,
  };

  const dayList = Array.from(dayMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  return { stats, earnedDates: computeEarnedDates(dayList, prs) };
}

export async function getCircuits(): Promise<Circuit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("circuits")
    .select("*, circuit_exercises(*)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    ...c,
    set_times: c.set_times ?? [],
    exercises: (c.circuit_exercises ?? []).sort(
      (a: any, b: any) => a.position - b.position,
    ),
  })) as Circuit[];
}

export async function getCircuit(id: string): Promise<Circuit | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("circuits")
    .select("*, circuit_exercises(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as any),
    set_times: (data as any).set_times ?? [],
    exercises: ((data as any).circuit_exercises ?? []).sort(
      (a: any, b: any) => a.position - b.position,
    ),
  } as Circuit;
}

export async function getIncomingShares(): Promise<IncomingShare[]> {
  const supabase = createClient();
  const user = getLocalUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workout_shares")
    .select("id, from_name, workout_date, muscle_group, payload")
    .eq("to_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return [];

  return (data ?? []).map((r: any) => {
    const payload = Array.isArray(r.payload) ? r.payload : [];
    const setCount = payload.reduce(
      (n: number, ex: any) => n + (Array.isArray(ex.sets) ? ex.sets.length : 0),
      0,
    );
    return {
      id: r.id as string,
      from_name: r.from_name as string,
      workout_date: r.workout_date as string,
      muscle_group: r.muscle_group as MuscleGroup,
      exercise_count: payload.length,
      set_count: setCount,
    };
  });
}

// todayKey lets the CLIENT define "today". The server runs in UTC, which for
// an IST user is yesterday until 05:30 — computing week/month boundaries from
// the server clock put early-morning workouts in the wrong window.
// 42703 = undefined column. Selecting a column the database doesn't have yet
// fails the whole query, so a deploy that lands before its migration would
// take the entire Stats page down.
const isMissingColumn = (err: { code?: string } | null) => err?.code === "42703";

const STATS_SELECT = (withHard: boolean) =>
  `workout_date, muscle_group, name, cardio_type, sets(position, reps, weight_kg, distance_km, distance_m${
    withHard ? ", is_hard" : ""
  })`;

export async function getStatsData(todayKey?: string): Promise<StatsData> {
  const supabase = createClient();
  let { data, error } = await supabase.from("exercises").select(STATS_SELECT(true));
  if (error && isMissingColumn(error)) {
    // migration_018 not run yet — every set simply reads as not-hard.
    ({ data, error } = await supabase.from("exercises").select(STATS_SELECT(false)));
  }
  if (error) throw error;
  const today =
    todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey)
      ? new Date(
          Number(todayKey.slice(0, 4)),
          Number(todayKey.slice(5, 7)) - 1,
          Number(todayKey.slice(8, 10)),
        )
      : new Date();
  return computeStats((data ?? []) as any[], today);
}

// ---------- Coach ----------

export async function getCoachProfile(): Promise<CoachProfile | null> {
  const supabase = createClient();
  const user = getLocalUser();
  if (!user) return null;
  const { data } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!data || !data.goal || !data.experience || !data.equipment) return null;
  return data as CoachProfile;
}

export async function getCoachLibrary(): Promise<LibraryExercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("exercises_library").select("*");
  if (error) throw error;
  return (data ?? []) as LibraryExercise[];
}

export async function getCoachTemplates(): Promise<WorkoutTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("workout_templates").select("*");
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    structure: typeof t.structure === "string" ? JSON.parse(t.structure) : t.structure,
  })) as WorkoutTemplate[];
}

const dayDiff = (todayKey: string, dateKey: string) =>
  Math.round((keyMs(todayKey) - keyMs(dateKey)) / DAY_MS);
function keyMs(k: string): number {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// Per-user history that drives the engine's scoring & weight suggestions.
export async function buildCoachHistory(groups: CoachGroup[]): Promise<History> {
  const supabase = createClient();
  const todayKey = toDateKey(new Date());

  const [exRes, prRes] = await Promise.all([
    supabase
      .from("exercises")
      .select("workout_date, name, muscle_group, sets(reps, weight_kg)"),
    supabase.from("prs").select("exercise_name, achieved_date, updated_at"),
  ]);
  const exs = (exRes.data ?? []) as any[];
  const prs = (prRes.data ?? []) as any[];

  const dates = Array.from(new Set(exs.map((e) => e.workout_date as string))).sort(
    (a, b) => (a < b ? 1 : -1),
  ); // newest first
  const lastDate = dates[0];
  const prevDate = dates[1];

  const freqByName = new Map<string, number>();
  const freqDateSeen = new Set<string>();
  const daysSince = new Map<string, number>();
  const lastPerf = new Map<string, { topReps: number; weight: number }>();
  const lastWorkoutNames = new Set<string>();
  const prev2Names = new Set<string>();
  const prevCardioNames = new Set<string>();
  const lastDateByName = new Map<string, string>();

  for (const e of exs) {
    const key = String(e.name ?? "").trim().toLowerCase();
    const date = e.workout_date as string;
    // distinct-session frequency
    const fk = `${key}|${date}`;
    if (!freqDateSeen.has(fk)) {
      freqDateSeen.add(fk);
      freqByName.set(key, (freqByName.get(key) ?? 0) + 1);
    }
    // most recent date per exercise
    const prevSeen = lastDateByName.get(key);
    if (!prevSeen || date > prevSeen) {
      lastDateByName.set(key, date);
      // best set on its latest date
      let best: { topReps: number; weight: number } | null = null;
      for (const s of e.sets ?? []) {
        if (s.weight_kg == null) continue;
        if (!best || s.weight_kg > best.weight)
          best = { topReps: s.reps ?? 0, weight: s.weight_kg };
      }
      if (best) lastPerf.set(key, best);
    }
    if (date === lastDate) {
      lastWorkoutNames.add(key);
      if (e.muscle_group === "cardio") prevCardioNames.add(key);
    }
    if (date === prevDate) prev2Names.add(key);
  }
  for (const [key, date] of lastDateByName) daysSince.set(key, dayDiff(todayKey, date));

  // recent PRs (last 30 days)
  const prNames = new Set<string>();
  for (const p of prs) {
    const d = (p.achieved_date as string) ?? toDateKey(new Date(p.updated_at));
    if (d && dayDiff(todayKey, d) <= 30)
      prNames.add(String(p.exercise_name ?? "").trim().toLowerCase());
  }

  // days since each selected group was last trained
  const lastByApp = new Map<string, string>();
  for (const e of exs) {
    const prev = lastByApp.get(e.muscle_group);
    if (!prev || e.workout_date > prev) lastByApp.set(e.muscle_group, e.workout_date);
  }
  const groupLastDays = new Map<string, number | null>();
  for (const g of groups) {
    const last = lastByApp.get(COACH_TO_APP[g]);
    groupLastDays.set(g, last ? dayDiff(todayKey, last) : null);
  }

  const vals = [...freqByName.values()].sort((a, b) => b - a);
  const freqCutoff = vals.length ? vals[Math.min(Math.floor(vals.length / 3), vals.length - 1)] : Infinity;

  return {
    lastWorkoutNames,
    prev2Names,
    freqByName,
    daysSince,
    prNames,
    lastPerf,
    groupLastDays,
    prevCardioNames,
    freqCutoff,
  };
}

// 1–2 coach groups the user hasn't trained recently (for "Suggested focus").
export async function getSuggestedFocus(): Promise<CoachGroup[]> {
  const supabase = createClient();
  const todayKey = toDateKey(new Date());
  const { data } = await supabase.from("exercises").select("workout_date, muscle_group");
  const rows = (data ?? []) as any[];

  const lastByApp = new Map<string, string>();
  for (const r of rows) {
    const prev = lastByApp.get(r.muscle_group);
    if (!prev || r.workout_date > prev) lastByApp.set(r.muscle_group, r.workout_date);
  }

  const ranked = COACH_GROUPS.map((g) => {
    const last = lastByApp.get(COACH_TO_APP[g]);
    const days = last ? dayDiff(todayKey, last) : Infinity;
    return { g, days };
  })
    .filter((x) => x.days >= 3) // only genuinely neglected
    .sort((a, b) => b.days - a.days);

  return ranked.slice(0, 2).map((x) => x.g);
}

export async function getMeasurements(): Promise<Measurement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Measurement[];
}

// ---------- Nutrition ----------

function mapFood(row: any): Food {
  return {
    id: row.id,
    name: row.name,
    calories_per_100g: Number(row.calories_per_100g),
    protein_per_100g: Number(row.protein_per_100g),
    carbs_per_100g: Number(row.carbs_per_100g),
    fat_per_100g: Number(row.fat_per_100g),
    fiber_per_100g: Number(row.fiber_per_100g) || 0,
    default_unit: row.default_unit,
    common_portions: Array.isArray(row.common_portions)
      ? row.common_portions
      : typeof row.common_portions === "string"
        ? JSON.parse(row.common_portions)
        : [],
    source: row.source,
    created_by: row.created_by,
  };
}

const mapLog = (r: any): FoodLogEntry => ({
  id: r.id,
  log_date: r.log_date,
  meal: r.meal,
  food_id: r.food_id,
  food_name: r.food_name,
  quantity: Number(r.quantity),
  unit: r.unit,
  computed_calories: Number(r.computed_calories),
  computed_protein: Number(r.computed_protein),
  computed_carbs: Number(r.computed_carbs),
  computed_fat: Number(r.computed_fat),
  computed_fiber: Number(r.computed_fiber) || 0,
});

export type NutritionDiary = {
  date: string;
  entries: FoodLogEntry[];
  totals: Macros;
  targets: NutritionTargets;
  hasTargets: boolean;
};

// True when an error means the nutrition tables aren't created yet
// (migration_013 not run). Lets the app degrade gracefully pre-migration.
const isMissingTable = (err: { code?: string } | null) =>
  err?.code === "42P01" || err?.code === "PGRST205" || err?.code === "PGRST204";

// Diary + targets for one day, in a single parallel fetch.
export async function getNutritionDiary(date: string): Promise<NutritionDiary> {
  const supabase = createClient();
  const [logRes, targetRes] = await Promise.all([
    supabase
      .from("food_log")
      .select("*")
      .eq("log_date", date)
      .order("created_at", { ascending: true }),
    supabase.from("nutrition_targets").select("*").maybeSingle(),
  ]);
  if (logRes.error && isMissingTable(logRes.error))
    return {
      date,
      entries: [],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      targets: DEFAULT_TARGETS,
      hasTargets: false,
    };
  if (logRes.error) throw logRes.error;

  const entries = (logRes.data ?? []).map(mapLog);
  const t = targetRes.data;
  const targets: NutritionTargets = t
    ? {
        daily_calories: t.daily_calories,
        daily_protein_g: t.daily_protein_g,
        daily_carbs_g: t.daily_carbs_g,
        daily_fat_g: t.daily_fat_g,
        daily_fiber_g: t.daily_fiber_g ?? 30,
      }
    : DEFAULT_TARGETS;

  return { date, entries, totals: sumMacros(entries), targets, hasTargets: !!t };
}

export async function getNutritionTargets(): Promise<{
  targets: NutritionTargets;
  hasTargets: boolean;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nutrition_targets")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return {
    targets: data
      ? {
          daily_calories: data.daily_calories,
          daily_protein_g: data.daily_protein_g,
          daily_carbs_g: data.daily_carbs_g,
          daily_fat_g: data.daily_fat_g,
          daily_fiber_g: data.daily_fiber_g ?? 30,
        }
      : DEFAULT_TARGETS,
    hasTargets: !!data,
  };
}

// Live name search over the shared foods DB (custom foods first, then seeded).
export async function searchFoods(query: string, limit = 40): Promise<Food[]> {
  const supabase = createClient();
  let q = supabase.from("foods").select("*");
  const term = query.trim();
  if (term) q = q.ilike("name", `%${term}%`);
  const { data, error } = await q.order("name", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapFood);
}

// This user's most-recently-logged distinct foods (for the Recent tab).
// Single round-trip: the food row rides along on the log rows via the FK.
export async function getRecentFoods(limit = 25): Promise<Food[]> {
  const supabase = createClient();
  const { data: logs, error } = await supabase
    .from("food_log")
    .select("food_id, created_at, foods(*)")
    .not("food_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;

  const seen = new Set<string>();
  const out: Food[] = [];
  for (const l of logs ?? []) {
    const f = (l as any).foods;
    if (!l.food_id || !f || seen.has(l.food_id)) continue;
    seen.add(l.food_id);
    out.push(mapFood(f));
    if (out.length >= limit) break;
  }
  return out;
}

// Foods this user created.
export async function getMyFoods(): Promise<Food[]> {
  const supabase = createClient();
  const user = getLocalUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapFood);
}

export async function getSavedMeals(): Promise<SavedMeal[]> {
  const supabase = createClient();
  // Single round-trip: items ride along via the FK.
  const { data, error } = await supabase
    .from("saved_meals")
    .select("*, saved_meal_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((m: any) => {
    const rawItems = m.saved_meal_items ?? [];
    const items = rawItems.map((it: any) => ({
      food_id: it.food_id,
      food_name: it.food_name,
      quantity: Number(it.quantity),
      unit: it.unit,
      computed_calories: Number(it.computed_calories),
      computed_protein: Number(it.computed_protein),
      computed_carbs: Number(it.computed_carbs),
      computed_fat: Number(it.computed_fat),
      computed_fiber: Number(it.computed_fiber) || 0,
    }));
    return { id: m.id, name: m.name, items, totals: sumMacros(items) };
  });
}

export type NutritionDayPoint = {
  key: string; // YYYY-MM-DD
  label: string; // weekday initial
  calories: number;
  protein: number;
};

export type NutritionWeek = {
  avgCalories: number;
  avgProtein: number;
  daysLogged: number;
  series: NutritionDayPoint[]; // exactly 7, oldest → today
};

// Weekly nutrition rollup for the Stats page: 7-day series + averages.
export async function getNutritionWeek(): Promise<NutritionWeek | null> {
  const supabase = createClient();
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const { data, error } = await supabase
    .from("food_log")
    .select("log_date, computed_calories, computed_protein")
    .gte("log_date", toDateKey(start))
    .lte("log_date", toDateKey(today));
  if (error && isMissingTable(error)) return null;
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const byDay = new Map<string, { cal: number; pro: number }>();
  for (const r of rows) {
    const d = byDay.get(r.log_date) ?? { cal: 0, pro: 0 };
    d.cal += Number(r.computed_calories);
    d.pro += Number(r.computed_protein);
    byDay.set(r.log_date, d);
  }

  const WD = ["S", "M", "T", "W", "T", "F", "S"];
  const series: NutritionDayPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateKey(d);
    const v = byDay.get(key);
    series.push({
      key,
      label: WD[d.getDay()],
      calories: Math.round(v?.cal ?? 0),
      protein: Math.round(v?.pro ?? 0),
    });
  }

  const days = byDay.size;
  let cal = 0;
  let pro = 0;
  for (const v of byDay.values()) {
    cal += v.cal;
    pro += v.pro;
  }
  return {
    avgCalories: Math.round(cal / days),
    avgProtein: Math.round(pro / days),
    daysLogged: days,
    series,
  };
}

/** Current consecutive-day training streak.
 *
 *  Deliberately narrow: one indexed column over a bounded window, so it can sit
 *  in the above-the-fold home shell without dragging in the heavy badge scan.
 *  A streak longer than the window is reported as the window length, which is
 *  far beyond anything the pill needs to show. */
export async function getCurrentStreak(): Promise<number> {
  const supabase = createClient();
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 180);
  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date")
    .gte("workout_date", toDateKey(from))
    .lte("workout_date", toDateKey(today));
  if (error) throw error;
  const days = Array.from(new Set((data ?? []).map((r) => r.workout_date as string)));
  return currentStreak(days, toDateKey(today));
}

// ---------- Habits ----------

/** Habits plus a bounded window of logs (enough for streaks + the calendar). */
export async function getHabitsData(days = 200): Promise<HabitsData> {
  const supabase = createClient();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const [hRes, lRes] = await Promise.all([
    supabase
      .from("habits")
      .select("id, name, description, icon, color, cadence, kind, category, target_per_period, unit, reminder_time, reminder_dow, archived, position")
      .eq("archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("habit_logs")
      .select("habit_id, log_date, count, note")
      .gte("log_date", toDateKey(from)),
  ]);
  // Missing table (migration_016 not run yet) — degrade to an empty section
  // rather than crashing the whole page.
  if (hRes.error) {
    if (isMissingTable(hRes.error)) return { habits: [], logs: [] };
    throw hRes.error;
  }
  if (lRes.error && !isMissingTable(lRes.error)) throw lRes.error;
  return {
    habits: (hRes.data ?? []) as HabitsData["habits"],
    logs: (lRes.data ?? []) as HabitsData["logs"],
  };
}

// ---------- Goals ----------

/** Goals plus the exercise rows their progress is derived from.
 *
 *  One query for each: progress is never stored, so the goal window and the
 *  workouts behind it can't drift apart. */
export async function getGoalsData(): Promise<{
  goals: Goal[];
  exercises: GoalExercise[];
}> {
  const supabase = createClient();
  const [gRes, eRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, metric, target, start_date, end_date, name, notes, archived")
      .order("end_date", { ascending: false }),
    // Bounded window: goals older than this are history, and their progress
    // bars would be pulling a year of sets into the browser otherwise.
    supabase.from("exercises").select(GOAL_EXERCISE_SELECT(true)),
  ]);

  if (gRes.error) {
    if (isMissingTable(gRes.error)) return { goals: [], exercises: [] };
    throw gRes.error;
  }
  let exercises = eRes.data;
  if (eRes.error && isMissingColumn(eRes.error)) {
    const retry = await supabase.from("exercises").select(GOAL_EXERCISE_SELECT(false));
    exercises = retry.data;
  } else if (eRes.error) {
    throw eRes.error;
  }
  return {
    goals: (gRes.data ?? []) as Goal[],
    exercises: (exercises ?? []) as unknown as GoalExercise[],
  };
}

const GOAL_EXERCISE_SELECT = (withHard: boolean) =>
  `workout_date, muscle_group, cardio_type, sets(reps, weight_kg, time_seconds, distance_km, distance_m${
    withHard ? ", is_hard" : ""
  })`;
