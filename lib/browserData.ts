// Client-side data fetchers for React Query. These run in the browser against
// the user's own Supabase session (RLS-enforced) and return JSON-serializable
// shapes so the query cache can persist to IndexedDB.

import { getBrowserClient } from "@/lib/supabase/client";
import {
  MUSCLE_GROUPS,
  type Circuit,
  type Exercise,
  type Measurement,
  type MuscleGroup,
  type Pr,
} from "@/lib/types";
import {
  DEFAULT_TARGETS,
  sumMacros,
  type FoodLogEntry,
  type Macros,
  type Meal,
  type NutritionTargets,
} from "@/lib/nutrition";

// ---------- query keys ----------

export const qk = {
  day: (date: string) => ["day", date] as const,
  diary: (date: string) => ["diary", date] as const,
  month: (year: number, month: number) => ["month", year, month] as const,
  prs: () => ["prs"] as const,
  measurements: () => ["measurements"] as const,
  stats: () => ["stats"] as const,
  circuits: () => ["circuits"] as const,
  habits: () => ["habits"] as const,
  goals: () => ["goals"] as const,
  logContext: (date: string) => ["logContext", date] as const,
  favourites: () => ["favourites"] as const,
};

const pad = (n: number) => String(n).padStart(2, "0");
const isMissingTable = (err: { code?: string } | null) =>
  err?.code === "42P01" || err?.code === "PGRST205" || err?.code === "PGRST204";

// Returns the browser client only if it has a live session (read locally from
// cookies, no network). If there's no session we THROW rather than run a query
// that RLS would answer with empty rows — that keeps React Query's server-
// rendered initialData on screen instead of blanking it out.
async function authedClient() {
  const supabase = getBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No browser session");
  return supabase;
}

// ---------- month workout summary (home calendar) ----------

// Plain object (not a Map) so it survives JSON persistence.
export type MonthSummary = Record<string, MuscleGroup[]>;

export async function fetchMonthSummary(
  year: number,
  month: number,
): Promise<MonthSummary> {
  const supabase = await authedClient();
  const start = `${year}-${pad(month)}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${pad(month)}-${pad(endDate)}`;

  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date, muscle_group")
    .gte("workout_date", start)
    .lte("workout_date", end);
  if (error) throw error;

  const sets = new Map<string, Set<MuscleGroup>>();
  for (const row of data ?? []) {
    const key = row.workout_date as string;
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key)!.add(row.muscle_group as MuscleGroup);
  }

  const out: MonthSummary = {};
  for (const [key, groupSet] of sets) {
    out[key] = MUSCLE_GROUPS.filter((g) => groupSet.has(g));
  }
  return out;
}

// ---------- day exercises ----------

export async function fetchDayExercises(date: string): Promise<Exercise[]> {
  const supabase = await authedClient();
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

// ---------- log screen context ----------

export type LogContext = {
  /** Most recent workout date per muscle group, on or before the log date. */
  lastTrained: Partial<Record<MuscleGroup, string>>;
  /** The latest workout strictly before the log date, for Quick start. */
  previous: { date: string; exercises: Exercise[] } | null;
};

// What the logger needs beyond the day itself: when each muscle group was
// last trained (the same exercise rows Stats counts from) and the previous
// session to offer as a Repeat.
export async function fetchLogContext(date: string): Promise<LogContext> {
  const supabase = await authedClient();
  // Newest first, so the first row seen per group is its latest date. A
  // year back is plenty for "last trained"; older groups read as untrained.
  const since = new Date(date);
  since.setFullYear(since.getFullYear() - 1);
  const { data, error } = await supabase
    .from("exercises")
    .select("workout_date, muscle_group")
    .lte("workout_date", date)
    .gte("workout_date", since.toISOString().slice(0, 10))
    .order("workout_date", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const lastTrained: LogContext["lastTrained"] = {};
  let previousDate: string | null = null;
  for (const row of data ?? []) {
    const g = row.muscle_group as MuscleGroup;
    const d = row.workout_date as string;
    if (!lastTrained[g]) lastTrained[g] = d;
    if (!previousDate && d < date) previousDate = d;
  }
  const previous = previousDate
    ? { date: previousDate, exercises: await fetchDayExercises(previousDate) }
    : null;
  return { lastTrained, previous };
}

// ---------- circuits (HIIT templates used by the logger) ----------

export async function fetchCircuits(): Promise<Circuit[]> {
  const supabase = await authedClient();
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

// ---------- PRs & measurements ----------

export async function fetchAllPrs(): Promise<Pr[]> {
  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("prs")
    .select("*")
    .order("achieved_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Pr[];
}

export async function fetchMeasurements(): Promise<Measurement[]> {
  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Measurement[];
}

// ---------- nutrition diary ----------

export type NutritionDiaryData = {
  date: string;
  entries: FoodLogEntry[];
  totals: Macros;
  targets: NutritionTargets;
  hasTargets: boolean;
};

const mapLog = (r: any): FoodLogEntry => ({
  id: r.id,
  log_date: r.log_date,
  meal: r.meal as Meal,
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

export async function fetchNutritionDiary(date: string): Promise<NutritionDiaryData> {
  const supabase = await authedClient();
  const [logRes, targetRes] = await Promise.all([
    supabase
      .from("food_log")
      .select("*")
      .eq("log_date", date)
      .order("created_at", { ascending: true }),
    supabase.from("nutrition_targets").select("*").maybeSingle(),
  ]);

  if (logRes.error && isMissingTable(logRes.error)) {
    return {
      date,
      entries: [],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      targets: DEFAULT_TARGETS,
      hasTargets: false,
    };
  }
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

// ---------- favourite exercises ----------

export type FavouriteExercise = {
  muscle_group: MuscleGroup;
  name: string;
  cardio_type: string | null;
};

/** Stable key for matching a favourite: same group, same name ignoring case. */
export function favouriteKey(group: string, name: string): string {
  return `${group}:${name.trim().toLowerCase()}`;
}

/**
 * The user's favourites, oldest first (the order they were added). Returns
 * null when the table doesn't exist yet (migration 024 not run), so the UI
 * can hide the feature instead of failing.
 */
export async function fetchFavourites(): Promise<FavouriteExercise[] | null> {
  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("favourite_exercises")
    .select("muscle_group, name, cardio_type")
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return (data ?? []) as FavouriteExercise[];
}

export async function addFavourite(fav: FavouriteExercise): Promise<void> {
  const supabase = await authedClient();
  const { error } = await supabase
    .from("favourite_exercises")
    .upsert(
      { muscle_group: fav.muscle_group, name: fav.name.trim(), cardio_type: fav.cardio_type },
      { onConflict: "user_id,muscle_group,name", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function removeFavourite(group: MuscleGroup, name: string): Promise<void> {
  const supabase = await authedClient();
  const { error } = await supabase
    .from("favourite_exercises")
    .delete()
    .eq("muscle_group", group)
    .ilike("name", name.trim().replace(/[%_\\]/g, (c) => `\\${c}`));
  if (error) throw error;
}
