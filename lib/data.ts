import { createClient } from "@/lib/supabase/server";
import {
  MUSCLE_GROUPS,
  type Exercise,
  type Measurement,
  type MuscleGroup,
  type Pr,
  type Profile,
} from "@/lib/types";
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
