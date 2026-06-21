import { createClient } from "@/lib/supabase/server";
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
import { toDateKey } from "@/lib/date";

export async function getProfile(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

export async function getRecentPrs(limit = 3): Promise<Pr[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prs")
    .select("*")
    .order("achieved_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Pr[];
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

export async function getStatsData(): Promise<StatsData> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "workout_date, muscle_group, name, cardio_type, sets(reps, weight_kg, distance_km, distance_m)",
    );
  if (error) throw error;
  return computeStats((data ?? []) as any[], new Date());
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
