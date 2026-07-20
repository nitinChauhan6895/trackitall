"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { getLocalUser } from "@/lib/supabase/user";
import {
  MUSCLE_GROUPS,
  PR_UNIT_TYPES,
  parseTimeToSeconds,
  type CardioType,
  type MuscleGroup,
  type PrUnitType,
  type ShareableUser,
} from "@/lib/types";
import {
  getCoachLibrary,
  getCoachProfile,
  getCoachTemplates,
  buildCoachHistory,
  getNutritionWeek,
  getHabitsData,
  getStatsData,
  searchFoods,
} from "@/lib/data";
import Anthropic from "@anthropic-ai/sdk";
import { generate } from "@/lib/coach/engine";
import {
  COACH_TO_APP,
  EQUIPMENTS,
  EXPERIENCES,
  GOALS,
  INJURIES,
  type CoachGroup,
  type Equipment,
  type Experience,
  type GenItem,
  type GenerationResult,
  type Goal,
} from "@/lib/coach/types";
import {
  FOOD_UNITS,
  MEALS,
  type Food,
  type Meal,
  type NutritionTargets,
  type Portion,
} from "@/lib/nutrition";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser() {
  const supabase = createClient();
  // Local cookie decode — no auth-server round-trip. Every query/insert made
  // with this id is still verified by RLS on the database side.
  const user = getLocalUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// ---------- Bulk save from the Log workout wizard ----------

export type SetInput = {
  reps?: number | null;
  weight_kg?: number | null;
  distance_km?: number | null;
  speed_kmh?: number | null;
  time_seconds?: number | null;
  incline?: number | null;
  resistance?: number | null;
  distance_m?: number | null;
  calories?: number | null;
  sets_count?: number | null;
  height?: number | null;
  floors?: number | null;
};
export type ExerciseInput = { name: string; sets: SetInput[] };
export type GroupInput = { muscle_group: MuscleGroup; exercises: ExerciseInput[] };

function setHasValue(s: SetInput): boolean {
  return (
    cleanInt(s.reps) != null ||
    cleanNum(s.weight_kg) != null ||
    cleanNum(s.distance_km) != null ||
    cleanNum(s.speed_kmh) != null ||
    cleanInt(s.time_seconds) != null ||
    cleanNum(s.incline) != null ||
    cleanNum(s.resistance) != null ||
    cleanNum(s.distance_m) != null ||
    cleanNum(s.calories) != null ||
    cleanInt(s.sets_count) != null ||
    cleanNum(s.height) != null ||
    cleanNum(s.floors) != null
  );
}

function setRow(s: SetInput, exerciseId: string, userId: string, position: number) {
  return {
    exercise_id: exerciseId,
    user_id: userId,
    position,
    reps: cleanInt(s.reps),
    weight_kg: cleanNum(s.weight_kg),
    distance_km: cleanNum(s.distance_km),
    speed_kmh: cleanNum(s.speed_kmh),
    time_seconds: cleanInt(s.time_seconds),
    incline: cleanNum(s.incline),
    resistance: cleanNum(s.resistance),
    distance_m: cleanNum(s.distance_m),
    calories: cleanNum(s.calories),
    sets_count: cleanInt(s.sets_count),
    height: cleanNum(s.height),
    floors: cleanNum(s.floors),
  };
}

// ---------- Per-exercise save/edit (quick logger) ----------
// Persists a single exercise + its sets immediately so nothing is lost mid-session.
// Pass `id` to edit an existing exercise (its sets are replaced).
//
// Fast path: one save_exercise_with_sets RPC (single DB round-trip, RLS-enforced,
// no extra auth.getUser network call — the middleware gates the route and RLS
// guards the rows). Falls back to the legacy multi-query path until
// migration_012 has been run.
export async function upsertExercise(input: {
  id?: string;
  date: string;
  muscle_group: MuscleGroup;
  cardio_type?: CardioType | null;
  name: string;
  sets: SetInput[];
}): Promise<{ id: string }> {
  if (!DATE_RE.test(input.date)) throw new Error("Invalid date");
  if (!MUSCLE_GROUPS.includes(input.muscle_group))
    throw new Error("Invalid muscle group");
  const name = input.name.trim();
  if (!name) throw new Error("Exercise name is required");

  const supabase = createClient();
  const cleanSets = input.sets.filter(setHasValue).map((s) => ({
    reps: cleanInt(s.reps),
    weight_kg: cleanNum(s.weight_kg),
    distance_km: cleanNum(s.distance_km),
    speed_kmh: cleanNum(s.speed_kmh),
    time_seconds: cleanInt(s.time_seconds),
    incline: cleanNum(s.incline),
    resistance: cleanNum(s.resistance),
    distance_m: cleanNum(s.distance_m),
    calories: cleanNum(s.calories),
    sets_count: cleanInt(s.sets_count),
    height: cleanNum(s.height),
    floors: cleanNum(s.floors),
  }));

  const { data, error } = await supabase.rpc("save_exercise_with_sets", {
    payload: {
      id: input.id ?? null,
      date: input.date,
      muscle_group: input.muscle_group,
      name,
      cardio_type: input.cardio_type ?? null,
      sets: cleanSets,
    },
  });

  // PGRST202 = function missing (migration_012 not run yet) → legacy path.
  if (error && error.code !== "PGRST202") throw error;
  if (!error) return { id: data as string };
  return upsertExerciseLegacy(input, name);

  // NOTE: deliberately no revalidatePath here. This action is called mid-flow
  // from the logger; revalidating would refresh the /log route, re-suspend
  // its async parent (getCircuits) and remount the logger, dropping its state.
  // Freshness is handled by router.refresh() when the logger navigates away.
}

async function upsertExerciseLegacy(
  input: {
    id?: string;
    date: string;
    muscle_group: MuscleGroup;
    cardio_type?: CardioType | null;
    sets: SetInput[];
  },
  name: string,
): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  let exerciseId = input.id;

  if (exerciseId) {
    const { error } = await supabase
      .from("exercises")
      .update({ name: name.slice(0, 120), cardio_type: input.cardio_type ?? null })
      .eq("id", exerciseId);
    if (error) throw error;
    const { error: delErr } = await supabase
      .from("sets")
      .delete()
      .eq("exercise_id", exerciseId);
    if (delErr) throw delErr;
  } else {
    const { count } = await supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("workout_date", input.date);
    const { data, error } = await supabase
      .from("exercises")
      .insert({
        user_id: user.id,
        workout_date: input.date,
        muscle_group: input.muscle_group,
        name: name.slice(0, 120),
        cardio_type: input.cardio_type ?? null,
        position: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    exerciseId = data.id as string;
  }

  const rows = input.sets
    .filter(setHasValue)
    .map((s, i) => setRow(s, exerciseId!, user.id, i));
  if (rows.length > 0) {
    const { error } = await supabase.from("sets").insert(rows);
    if (error) throw error;
  }
  return { id: exerciseId! };
}

export async function deleteExerciseById(id: string, date: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
  // No revalidatePath — called from the log wizard (see upsertExercise note).
}

export async function saveWorkout(date: string, groups: GroupInput[]) {
  if (!DATE_RE.test(date)) throw new Error("Invalid date");
  const { supabase, user } = await requireUser();

  let exPos = 0;
  for (const group of groups) {
    if (!MUSCLE_GROUPS.includes(group.muscle_group)) continue;
    for (const ex of group.exercises) {
      const name = ex.name.trim();
      if (!name) continue;

      const { data: inserted, error: exErr } = await supabase
        .from("exercises")
        .insert({
          user_id: user.id,
          workout_date: date,
          muscle_group: group.muscle_group,
          name: name.slice(0, 120),
          position: exPos++,
        })
        .select("id")
        .single();
      if (exErr) throw exErr;

      const rows = ex.sets
        .filter(setHasValue)
        .map((s, i) => setRow(s, inserted.id as string, user.id, i));

      if (rows.length > 0) {
        const { error: setErr } = await supabase.from("sets").insert(rows);
        if (setErr) throw setErr;
      }
    }
  }

  revalidatePath("/");
  revalidatePath(`/day/${date}`);
  redirect("/");
}

// ---------- Incremental edits on the day view ----------

export async function addExercise(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const muscleGroup = String(formData.get("muscle_group") ?? "") as MuscleGroup;
  const name = String(formData.get("name") ?? "").trim();

  if (!DATE_RE.test(date)) throw new Error("Invalid date");
  if (!MUSCLE_GROUPS.includes(muscleGroup)) throw new Error("Invalid muscle group");
  if (!name) throw new Error("Exercise name is required");

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("exercises").insert({
    user_id: user.id,
    workout_date: date,
    muscle_group: muscleGroup,
    name: name.slice(0, 120),
  });
  if (error) throw error;

  revalidatePath(`/day/${date}`);
  revalidatePath("/");
}

export async function deleteExercise(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`/day/${date}`);
  revalidatePath("/");
}

export async function addSet(formData: FormData) {
  const exerciseId = String(formData.get("exercise_id") ?? "");
  const date = String(formData.get("date") ?? "");

  const input: SetInput = {
    reps: numOrNull(formData.get("reps")),
    weight_kg: numOrNull(formData.get("weight")),
    distance_km: numOrNull(formData.get("distance_km")),
    distance_m: numOrNull(formData.get("distance_m")),
    speed_kmh: numOrNull(formData.get("speed")),
    incline: numOrNull(formData.get("incline")),
    resistance: numOrNull(formData.get("resistance")),
    calories: numOrNull(formData.get("calories")),
    sets_count: numOrNull(formData.get("sets_count")),
    height: numOrNull(formData.get("height")),
    floors: numOrNull(formData.get("floors")),
    time_seconds: parseTimeToSeconds(String(formData.get("time") ?? "")),
  };

  if (!setHasValue(input)) {
    revalidatePath(`/day/${date}`);
    return;
  }

  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("sets")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", exerciseId);

  const { error } = await supabase
    .from("sets")
    .insert(setRow(input, exerciseId, user.id, count ?? 0));
  if (error) throw error;

  revalidatePath(`/day/${date}`);
}

export async function deleteSet(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("sets").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`/day/${date}`);
}

// ---------- PRs ----------

export async function savePr(input: {
  id?: string;
  exercise_name: string;
  unit_type: PrUnitType;
  value: number;
  distance_unit: "m" | "km" | null;
  reps?: number | null;
  achieved_date?: string | null;
}) {
  const name = input.exercise_name.trim();
  if (!name) throw new Error("Exercise name is required");
  if (!PR_UNIT_TYPES.includes(input.unit_type))
    throw new Error("Invalid unit type");
  if (!Number.isFinite(input.value) || input.value < 0)
    throw new Error("Invalid value");
  if (input.achieved_date && !DATE_RE.test(input.achieved_date))
    throw new Error("Invalid date");

  const { supabase, user } = await requireUser();

  const payload = {
    user_id: user.id,
    exercise_name: name.slice(0, 120),
    unit_type: input.unit_type,
    value: input.value,
    distance_unit: input.unit_type === "distance" ? input.distance_unit : null,
    // Reps only make sense for kg-type PRs; ignore for time/distance.
    reps: input.unit_type === "kg" ? cleanInt(input.reps) : null,
    achieved_date: input.achieved_date ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("prs")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("prs").insert(payload);
    if (error) throw error;
  }

  revalidatePath("/prs");
  revalidatePath("/");
}

export async function deletePr(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("prs").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/prs");
  revalidatePath("/");
}

// ---------- HIIT circuits (reusable library) ----------

export type CircuitExerciseInput = {
  name: string;
  category: string | null;
  metrics: Record<string, string>;
};

export async function saveCircuit(input: {
  id?: string;
  name: string;
  set_times: number[];
  exercises: CircuitExerciseInput[];
}): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Circuit name is required");
  const { supabase, user } = await requireUser();

  const setTimes = input.set_times.filter((t) => Number.isFinite(t) && t > 0);

  let circuitId = input.id;
  if (circuitId) {
    const { error } = await supabase
      .from("circuits")
      .update({ name: name.slice(0, 120), set_times: setTimes, updated_at: new Date().toISOString() })
      .eq("id", circuitId);
    if (error) throw error;
    const { error: delErr } = await supabase
      .from("circuit_exercises")
      .delete()
      .eq("circuit_id", circuitId);
    if (delErr) throw delErr;
  } else {
    const { data, error } = await supabase
      .from("circuits")
      .insert({ user_id: user.id, name: name.slice(0, 120), set_times: setTimes })
      .select("id")
      .single();
    if (error) throw error;
    circuitId = data.id as string;
  }

  const rows = input.exercises
    .filter((e) => e.name.trim())
    .map((e, i) => {
      // Drop blank metric values so summaries stay clean.
      const metrics: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.metrics)) {
        if (String(v).trim() !== "") metrics[k] = String(v).trim();
      }
      return {
        user_id: user.id,
        circuit_id: circuitId!,
        position: i,
        name: e.name.trim().slice(0, 120),
        category: e.category,
        metrics,
      };
    });

  if (rows.length > 0) {
    const { error } = await supabase.from("circuit_exercises").insert(rows);
    if (error) throw error;
  }

  revalidatePath("/circuits");
  return { id: circuitId! };
}

export async function deleteCircuit(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("circuits").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/circuits");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Profile ----------

export async function updateProfile(input: {
  first_name: string;
  last_name: string;
}) {
  const { supabase, user } = await requireUser();
  const first = input.first_name.trim().slice(0, 60);
  const last = input.last_name.trim().slice(0, 60);

  const { error } = await supabase
    .from("profiles")
    .update({ first_name: first || null, last_name: last || null })
    .eq("user_id", user.id);
  if (error) throw error;

  // Keep auth metadata in sync (used as a fallback display source).
  await supabase.auth.updateUser({
    data: { first_name: first, last_name: last },
  });

  revalidatePath("/");
}

export async function setShareToCommunity(share: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ share_to_community: share })
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/");
}

// ---------- Measurements ----------

export async function saveMeasurement(input: {
  id?: string;
  entry_date: string;
  bodyweight: number | null;
  body_fat_pct: number | null;
  height: number | null;
  age: number | null;
  chest: number | null;
  shoulders: number | null;
  waist: number | null;
  navel: number | null;
  arms: number | null;
  thighs: number | null;
}) {
  if (!DATE_RE.test(input.entry_date)) throw new Error("Invalid date");
  const { supabase, user } = await requireUser();

  const payload = {
    user_id: user.id,
    entry_date: input.entry_date,
    bodyweight: cleanNum(input.bodyweight),
    body_fat_pct: cleanNum(input.body_fat_pct),
    height: cleanNum(input.height),
    age: cleanNum(input.age),
    chest: cleanNum(input.chest),
    shoulders: cleanNum(input.shoulders),
    waist: cleanNum(input.waist),
    navel: cleanNum(input.navel),
    arms: cleanNum(input.arms),
    thighs: cleanNum(input.thighs),
  };

  if (input.id) {
    const { error } = await supabase
      .from("measurements")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("measurements").insert(payload);
    if (error) throw error;
  }

  revalidatePath("/measurements");
}

// ---------- Workout sharing ----------

export async function loadShareableUsers(): Promise<ShareableUser[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_shareable_users");
  if (error) throw error;
  return (data ?? []) as ShareableUser[];
}

export async function shareWorkout(input: {
  toUserId: string;
  date: string;
  group: MuscleGroup;
}) {
  if (!DATE_RE.test(input.date)) throw new Error("Invalid date");
  if (!MUSCLE_GROUPS.includes(input.group))
    throw new Error("Invalid muscle group");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("share_workout", {
    p_to: input.toUserId,
    p_date: input.date,
    p_group: input.group,
  });
  if (error) throw error;
}

export async function acceptShare(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("accept_workout_share", { p_share: id });
  if (error) throw error;
  revalidatePath("/community");
  revalidatePath("/");
}

export async function declineShare(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("decline_workout_share", { p_share: id });
  if (error) throw error;
  revalidatePath("/community");
}

export async function deleteGroup(date: string, group: MuscleGroup) {
  if (!MUSCLE_GROUPS.includes(group)) throw new Error("Invalid muscle group");
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("user_id", user.id)
    .eq("workout_date", date)
    .eq("muscle_group", group);
  if (error) throw error;
  revalidatePath(`/day/${date}`);
  revalidatePath("/");
}

// ---------- Coach: workout generator ----------

export async function saveCoachProfile(input: {
  goal: Goal;
  experience: Experience;
  equipment: Equipment;
  injuries: string[];
}) {
  if (!GOALS.includes(input.goal)) throw new Error("Invalid goal");
  if (!EXPERIENCES.includes(input.experience)) throw new Error("Invalid experience");
  if (!EQUIPMENTS.includes(input.equipment)) throw new Error("Invalid equipment");
  const injuries = input.injuries.filter((i) => (INJURIES as readonly string[]).includes(i));

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("coach_profiles").upsert(
    {
      user_id: user.id,
      goal: input.goal,
      experience: input.experience,
      equipment: input.equipment,
      injuries,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    if (error.code === "PGRST205")
      throw new Error("Coach isn't set up yet — run migration_010_coach.sql in Supabase.");
    throw new Error(error.message);
  }
  revalidatePath("/coach");
}

export async function setExercisePrefs(input: {
  preferred: string[];
  excluded: string[];
}) {
  const { supabase, user } = await requireUser();
  const clean = (a: string[]) =>
    Array.from(new Set(a.filter((s) => typeof s === "string"))).slice(0, 300);
  const { error } = await supabase
    .from("coach_profiles")
    .update({
      preferred_exercise_ids: clean(input.preferred),
      excluded_exercise_ids: clean(input.excluded),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/coach");
}

export async function generateWorkout(groups: CoachGroup[]): Promise<GenerationResult> {
  await requireUser();
  if (groups.length === 0) throw new Error("Pick at least one muscle group.");
  const profile = await getCoachProfile();
  if (!profile) return { onboarded: false };

  const [library, templates, history] = await Promise.all([
    getCoachLibrary(),
    getCoachTemplates(),
    buildCoachHistory(groups),
  ]);
  const template =
    templates.find((t) => t.goal === profile.goal) ?? templates[0];
  if (!template) throw new Error("No workout template found — run the seed migration.");

  return generate({ groups, profile, template, library, history });
}

// ---- AI refine: translate a free-text note into engine overrides ----
// The model only TRANSLATES intent into structured params; the deterministic
// engine still owns exercise selection and weights. Fails safe to no overrides.

type RefineOverrides = {
  equipment?: Equipment;
  addInjuries: string[];
  durationCapMin?: number;
  avoidExercises: string[];
  intensity: "easier" | "harder" | "same";
  summary?: string;
};

async function getRefineOverrides(
  note: string,
  currentEquipment: Equipment,
): Promise<RefineOverrides> {
  const empty: RefineOverrides = { addInjuries: [], avoidExercises: [], intensity: "same" };
  if (!process.env.ANTHROPIC_API_KEY || !note.trim()) return empty;

  try {
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      system:
        "You convert a gym user's short note into structured workout overrides for a deterministic workout generator. " +
        "Only set a field when the note clearly implies it. Map soreness/pain to addInjuries (Shoulder, Knee, Lower Back). " +
        "Map 'no equipment'/'at home'/'bodyweight'/'only dumbbells' to equipment. Map a time limit to durationCapMin. " +
        "Never invent exercises or weights — only fill the tool fields.",
      messages: [
        { role: "user", content: `Current equipment: ${currentEquipment}.\nNote: ${note}` },
      ],
      tools: [
        {
          name: "set_overrides",
          description: "Record the workout overrides implied by the user's note.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              equipment: { type: "string", enum: [...EQUIPMENTS] },
              addInjuries: { type: "array", items: { type: "string", enum: [...INJURIES] } },
              durationCapMin: { type: "integer" },
              avoidExercises: { type: "array", items: { type: "string" } },
              intensity: { type: "string", enum: ["easier", "harder", "same"] },
            },
            required: [],
          },
        },
      ],
      tool_choice: { type: "tool", name: "set_overrides" },
    });

    const block = resp.content.find((b) => b.type === "tool_use") as any;
    const raw = (block?.input ?? {}) as any;

    const equipment = (EQUIPMENTS as readonly string[]).includes(raw.equipment)
      ? (raw.equipment as Equipment)
      : undefined;
    const addInjuries = Array.isArray(raw.addInjuries)
      ? raw.addInjuries.filter((i: any) => (INJURIES as readonly string[]).includes(i))
      : [];
    const durationCapMin =
      typeof raw.durationCapMin === "number" && raw.durationCapMin >= 15 && raw.durationCapMin <= 180
        ? Math.round(raw.durationCapMin)
        : undefined;
    const avoidExercises = Array.isArray(raw.avoidExercises)
      ? raw.avoidExercises.filter((s: any) => typeof s === "string").slice(0, 10)
      : [];
    const intensity = ["easier", "harder", "same"].includes(raw.intensity)
      ? (raw.intensity as RefineOverrides["intensity"])
      : "same";

    const parts: string[] = [];
    if (equipment) parts.push(equipment);
    if (addInjuries.length) parts.push(`protect ${addInjuries.join(", ")}`);
    if (durationCapMin) parts.push(`≤ ${durationCapMin} min`);
    if (avoidExercises.length) parts.push(`avoid ${avoidExercises.join(", ")}`);
    if (intensity !== "same") parts.push(intensity);

    return {
      equipment,
      addInjuries,
      durationCapMin,
      avoidExercises,
      intensity,
      summary: parts.length ? `Adjusted: ${parts.join(" · ")}` : undefined,
    };
  } catch {
    return empty;
  }
}

function trimToDuration(items: GenItem[], cap: number): GenItem[] {
  // Higher = dropped first. Compounds are never dropped.
  const droppability = (i: GenItem): number => {
    if (i.category === "Compound") return -1;
    if (i.category === "Finisher") return 3;
    if (i.category === "Isolation") return 2;
    if (i.isCardio) return 1;
    return 0;
  };
  const kept = [...items];
  const total = () => kept.reduce((n, i) => n + i.estDuration, 0);
  while (total() > cap && kept.length > 1) {
    let idx = -1;
    let worst = 0;
    kept.forEach((it, j) => {
      const d = droppability(it);
      if (d > worst) {
        worst = d;
        idx = j;
      }
    });
    if (idx === -1) break; // nothing droppable left (only compounds)
    kept.splice(idx, 1);
  }
  return kept;
}

export async function refineWorkout(
  groups: CoachGroup[],
  note: string,
): Promise<GenerationResult> {
  await requireUser();
  if (groups.length === 0) throw new Error("Pick at least one muscle group.");
  const profile = await getCoachProfile();
  if (!profile) return { onboarded: false };

  const [library, templates, history] = await Promise.all([
    getCoachLibrary(),
    getCoachTemplates(),
    buildCoachHistory(groups),
  ]);
  const template = templates.find((t) => t.goal === profile.goal) ?? templates[0];
  if (!template) throw new Error("No workout template found — run the seed migration.");

  const ov = await getRefineOverrides(note, profile.equipment);

  // Resolve avoided exercise names to library ids.
  const avoidIds = library
    .filter((ex) =>
      ov.avoidExercises.some((term) => {
        const t = term.toLowerCase();
        const n = ex.name.toLowerCase();
        return n.includes(t) || t.includes(n);
      }),
    )
    .map((ex) => ex.id);

  const effectiveProfile = {
    ...profile,
    equipment: ov.equipment ?? profile.equipment,
    injuries: Array.from(new Set([...profile.injuries, ...ov.addInjuries])),
    excluded_exercise_ids: Array.from(new Set([...profile.excluded_exercise_ids, ...avoidIds])),
  };

  const result = generate({ groups, profile: effectiveProfile, template, library, history });
  if (!result.onboarded) return result;

  let items = result.items;
  if (ov.intensity === "easier") items = items.filter((i) => !i.toFailure);
  if (ov.durationCapMin) items = trimToDuration(items, ov.durationCapMin);

  const reasons = ov.summary ? [ov.summary, ...result.reasons].slice(0, 4) : result.reasons;
  const durationMin = items.reduce((n, i) => n + i.estDuration, 0);

  return { ...result, items, reasons, durationMin };
}

function cardioTypeFor(name: string): CardioType {
  const n = name.toLowerCase();
  if (/ski/.test(n)) return "skierg";
  if (/row/.test(n)) return "rowing";
  if (/run/.test(n)) return "running";
  if (/elliptical/.test(n)) return "elliptical";
  return "generic";
}

// Pre-populate today's log with the accepted session, then the user edits actuals.
export async function logGeneratedWorkout(date: string, items: GenItem[]) {
  if (!DATE_RE.test(date)) throw new Error("Invalid date");
  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("workout_date", date);
  let pos = count ?? 0;

  for (const item of items) {
    const muscle: MuscleGroup = item.isCardio ? "cardio" : COACH_TO_APP[item.group];
    const { data: ex, error: exErr } = await supabase
      .from("exercises")
      .insert({
        user_id: user.id,
        workout_date: date,
        muscle_group: muscle,
        name: item.name.slice(0, 120),
        cardio_type: item.isCardio ? cardioTypeFor(item.name) : null,
        position: pos++,
      })
      .select("id")
      .single();
    if (exErr) throw exErr;

    const rows: any[] = [];
    if (item.isCardio) {
      rows.push({
        exercise_id: ex.id,
        user_id: user.id,
        position: 0,
        time_seconds: item.cardioMin ? item.cardioMin * 60 : null,
      });
    } else {
      const reps = item.repMax > 0 ? item.repMax : null;
      for (let i = 0; i < Math.max(1, item.sets); i++) {
        rows.push({
          exercise_id: ex.id,
          user_id: user.id,
          position: i,
          reps,
          weight_kg: item.suggestedWeight,
        });
      }
    }
    const { error: setErr } = await supabase.from("sets").insert(rows);
    if (setErr) throw setErr;
  }

  revalidatePath("/");
  revalidatePath(`/day/${date}`);
}

export async function deleteMeasurement(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("measurements").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/measurements");
}

// ---------- Cached reads for the client query cache ----------

// Stats are computed server-side (heavy aggregation), so instead of porting the
// maths to the browser we expose the *result* as an action and let React Query
// cache it in IndexedDB — instant on revisit, refreshed in the background.
export async function loadStatsAction(todayKey?: string) {
  await requireUser();
  const [stats, nutrition] = await Promise.all([
    getStatsData(todayKey),
    getNutritionWeek(),
  ]);
  return { stats, nutrition };
}

// ---------- Nutrition ----------

// Live food search from the client (thin auth wrapper over the data layer).
export async function searchFoodsAction(query: string): Promise<Food[]> {
  await requireUser();
  return searchFoods(query, 40);
}

function sanitizePortions(portions: Portion[] | undefined): Portion[] {
  if (!Array.isArray(portions)) return [];
  return portions
    .filter((p) => p && typeof p.label === "string" && p.label.trim() !== "")
    .map((p) => ({
      label: p.label.trim().slice(0, 40),
      grams: Math.max(0, Number(p.grams) || 0),
    }))
    .filter((p) => p.grams > 0)
    .slice(0, 8);
}

export async function logFood(input: {
  date: string;
  meal: Meal;
  food_id: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}): Promise<{ id: string }> {
  if (!DATE_RE.test(input.date)) throw new Error("Invalid date");
  if (!MEALS.includes(input.meal)) throw new Error("Invalid meal");
  const name = input.food_name.trim();
  if (!name) throw new Error("Food name is required");

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("food_log")
    .insert({
      user_id: user.id,
      log_date: input.date,
      meal: input.meal,
      food_id: input.food_id,
      food_name: name.slice(0, 120),
      quantity: cleanNum(input.quantity) ?? 0,
      unit: input.unit.slice(0, 20),
      computed_calories: cleanNum(input.calories) ?? 0,
      computed_protein: cleanNum(input.protein) ?? 0,
      computed_carbs: cleanNum(input.carbs) ?? 0,
      computed_fat: cleanNum(input.fat) ?? 0,
      computed_fiber: cleanNum(input.fiber) ?? 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/nutrition");
  revalidatePath("/");
  return { id: data.id as string };
}

export async function updateFoodLog(input: {
  id: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("food_log")
    .update({
      quantity: cleanNum(input.quantity) ?? 0,
      unit: input.unit.slice(0, 20),
      computed_calories: cleanNum(input.calories) ?? 0,
      computed_protein: cleanNum(input.protein) ?? 0,
      computed_carbs: cleanNum(input.carbs) ?? 0,
      computed_fat: cleanNum(input.fat) ?? 0,
      computed_fiber: cleanNum(input.fiber) ?? 0,
    })
    .eq("id", input.id);
  if (error) throw error;
  revalidatePath("/nutrition");
  revalidatePath("/");
}

export async function deleteFoodLog(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("food_log").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/nutrition");
  revalidatePath("/");
}

export async function saveTargets(t: NutritionTargets) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("nutrition_targets").upsert({
    user_id: user.id,
    daily_calories: cleanInt(t.daily_calories) ?? 0,
    daily_protein_g: cleanInt(t.daily_protein_g) ?? 0,
    daily_carbs_g: cleanInt(t.daily_carbs_g) ?? 0,
    daily_fat_g: cleanInt(t.daily_fat_g) ?? 0,
    daily_fiber_g: cleanInt(t.daily_fiber_g) ?? 0,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/nutrition");
}

// Creates a custom food in the SHARED foods table (everyone can then use it).
// Values are already normalized to per-100g by the caller.
export async function createCustomFood(input: {
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  default_unit: string;
  common_portions: Portion[];
}): Promise<Food> {
  const name = input.name.trim();
  if (!name) throw new Error("Food name is required");
  const unit = FOOD_UNITS.includes(input.default_unit as any)
    ? (input.default_unit as (typeof FOOD_UNITS)[number])
    : "g";

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("foods")
    .insert({
      name: name.slice(0, 120),
      calories_per_100g: cleanNum(input.calories_per_100g) ?? 0,
      protein_per_100g: cleanNum(input.protein_per_100g) ?? 0,
      carbs_per_100g: cleanNum(input.carbs_per_100g) ?? 0,
      fat_per_100g: cleanNum(input.fat_per_100g) ?? 0,
      fiber_per_100g: cleanNum(input.fiber_per_100g) ?? 0,
      default_unit: unit,
      common_portions: sanitizePortions(input.common_portions),
      source: "custom",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    calories_per_100g: Number(data.calories_per_100g),
    protein_per_100g: Number(data.protein_per_100g),
    carbs_per_100g: Number(data.carbs_per_100g),
    fat_per_100g: Number(data.fat_per_100g),
    fiber_per_100g: Number(data.fiber_per_100g) || 0,
    default_unit: data.default_unit,
    common_portions: Array.isArray(data.common_portions) ? data.common_portions : [],
    source: "custom",
    created_by: data.created_by,
  };
}

// Save the current logged foods (or a passed set) as a reusable template.
export async function saveMeal(input: {
  name: string;
  items: {
    food_id: string | null;
    food_name: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }[];
}): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Meal name is required");
  if (input.items.length === 0) throw new Error("Add at least one food");

  const { supabase, user } = await requireUser();
  const { data: meal, error } = await supabase
    .from("saved_meals")
    .insert({ user_id: user.id, name: name.slice(0, 120) })
    .select("id")
    .single();
  if (error) throw error;

  const rows = input.items.map((it) => ({
    saved_meal_id: meal.id,
    user_id: user.id,
    food_id: it.food_id,
    food_name: it.food_name.slice(0, 120),
    quantity: cleanNum(it.quantity) ?? 0,
    unit: it.unit.slice(0, 20),
    computed_calories: cleanNum(it.calories) ?? 0,
    computed_protein: cleanNum(it.protein) ?? 0,
    computed_carbs: cleanNum(it.carbs) ?? 0,
    computed_fat: cleanNum(it.fat) ?? 0,
    computed_fiber: cleanNum(it.fiber) ?? 0,
  }));
  const { error: itErr } = await supabase.from("saved_meal_items").insert(rows);
  if (itErr) throw itErr;
  revalidatePath("/nutrition");
  revalidatePath("/nutrition/search");
  return { id: meal.id as string };
}

// Log every item of a saved meal into the given day + meal slot, scaled by
// `servings` (default 1 = the meal as saved).
export async function logSavedMeal(input: {
  date: string;
  meal: Meal;
  savedMealId: string;
  servings?: number;
}) {
  if (!DATE_RE.test(input.date)) throw new Error("Invalid date");
  if (!MEALS.includes(input.meal)) throw new Error("Invalid meal");
  const factor = input.servings && input.servings > 0 ? input.servings : 1;
  const { supabase, user } = await requireUser();

  const { data: items, error } = await supabase
    .from("saved_meal_items")
    .select("*")
    .eq("saved_meal_id", input.savedMealId);
  if (error) throw error;
  if (!items || items.length === 0) return;

  const rows = items.map((it) => ({
    user_id: user.id,
    log_date: input.date,
    meal: input.meal,
    food_id: it.food_id,
    food_name: it.food_name,
    quantity: Number(it.quantity) * factor,
    unit: it.unit,
    computed_calories: Number(it.computed_calories) * factor,
    computed_protein: Number(it.computed_protein) * factor,
    computed_carbs: Number(it.computed_carbs) * factor,
    computed_fat: Number(it.computed_fat) * factor,
    computed_fiber: (Number(it.computed_fiber) || 0) * factor,
  }));
  const { error: insErr } = await supabase.from("food_log").insert(rows);
  if (insErr) throw insErr;
  revalidatePath("/nutrition");
  revalidatePath("/");
}

export async function deleteSavedMeal(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("saved_meals").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/nutrition");
}

// Copy every entry of one meal from a source day into the same meal on today.
export async function copyMeal(input: {
  fromDate: string;
  toDate: string;
  meal: Meal;
}) {
  if (!DATE_RE.test(input.fromDate) || !DATE_RE.test(input.toDate))
    throw new Error("Invalid date");
  if (!MEALS.includes(input.meal)) throw new Error("Invalid meal");
  const { supabase, user } = await requireUser();

  const { data: src, error } = await supabase
    .from("food_log")
    .select("*")
    .eq("log_date", input.fromDate)
    .eq("meal", input.meal);
  if (error) throw error;
  if (!src || src.length === 0) return;

  const rows = src.map((r) => ({
    user_id: user.id,
    log_date: input.toDate,
    meal: input.meal,
    food_id: r.food_id,
    food_name: r.food_name,
    quantity: r.quantity,
    unit: r.unit,
    computed_calories: r.computed_calories,
    computed_protein: r.computed_protein,
    computed_carbs: r.computed_carbs,
    computed_fat: r.computed_fat,
    computed_fiber: r.computed_fiber ?? 0,
  }));
  const { error: insErr } = await supabase.from("food_log").insert(rows);
  if (insErr) throw insErr;
  revalidatePath("/nutrition");
  revalidatePath("/");
}

// ---------- helpers ----------

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function cleanInt(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.max(0, Math.round(v));
}
function cleanNum(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.max(0, v);
}

// ---------- Data export ----------
//
// Both exports stream the user's own rows only — RLS enforces that server-side
// regardless of what's asked for here.

export async function exportWorkoutsCsv(): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "workout_date, muscle_group, name, cardio_type, position, sets(position, reps, weight_kg, distance_km, distance_m, speed_kmh, time_seconds, incline, resistance, calories, sets_count, height, floors)",
    )
    .order("workout_date", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;

  const headers = [
    "Date", "Muscle group", "Exercise", "Cardio type", "Set",
    "Reps", "Weight (kg)", "Distance (km)", "Distance (m)", "Speed (km/h)",
    "Time (s)", "Incline", "Resistance", "Calories", "Sets count",
    "Height", "Floors",
  ];

  const rows: unknown[][] = [];
  for (const e of (data ?? []) as any[]) {
    const sets = [...(e.sets ?? [])].sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
    );
    // An exercise with no sets still gets a row, so nothing silently vanishes.
    if (sets.length === 0) {
      rows.push([e.workout_date, e.muscle_group, e.name, e.cardio_type ?? "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
      continue;
    }
    sets.forEach((s: any, i: number) => {
      rows.push([
        e.workout_date, e.muscle_group, e.name, e.cardio_type ?? "", i + 1,
        s.reps ?? "", s.weight_kg ?? "", s.distance_km ?? "", s.distance_m ?? "", s.speed_kmh ?? "",
        s.time_seconds ?? "", s.incline ?? "", s.resistance ?? "", s.calories ?? "", s.sets_count ?? "",
        s.height ?? "", s.floors ?? "",
      ]);
    });
  }
  return toCsv(headers, rows);
}

export async function exportNutritionCsv(): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("food_log")
    .select(
      "log_date, meal, food_name, quantity, unit, computed_calories, computed_protein, computed_carbs, computed_fat, computed_fiber",
    )
    .order("log_date", { ascending: true });
  if (error) throw error;

  const headers = [
    "Date", "Meal", "Food", "Quantity", "Unit",
    "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Fibre (g)",
  ];
  const rows = ((data ?? []) as any[]).map((r) => [
    r.log_date, r.meal, r.food_name, r.quantity, r.unit,
    r.computed_calories, r.computed_protein, r.computed_carbs, r.computed_fat, r.computed_fiber,
  ]);
  return toCsv(headers, rows);
}

/** Share every muscle group logged on `date` with one person.
 *
 *  Reuses the per-group RPC rather than adding a whole-day one: no schema
 *  change, and the recipient gets one inbox card per group so they can accept
 *  the parts they actually did. */
export async function shareWholeDay(input: { toUserId: string; date: string }) {
  if (!DATE_RE.test(input.date)) throw new Error("Invalid date");
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("exercises")
    .select("muscle_group")
    .eq("user_id", user.id)
    .eq("workout_date", input.date);
  if (error) throw error;

  const groups = Array.from(new Set((data ?? []).map((r) => r.muscle_group as MuscleGroup)));
  if (groups.length === 0) throw new Error("Nothing logged on this day");

  for (const group of groups) {
    const { error: e } = await supabase.rpc("share_workout", {
      p_to: input.toUserId,
      p_date: input.date,
      p_group: group,
    });
    if (e) throw e;
  }
}

// ---------- Habits ----------

const CADENCE_SET = new Set(["daily", "weekly"]);

export async function saveHabit(input: {
  id?: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  cadence: string;
  target_per_period: number;
  unit?: string | null;
  reminder_time?: string | null;
}): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (!CADENCE_SET.has(input.cadence)) throw new Error("Invalid cadence");
  const target = Math.max(1, Math.round(Number(input.target_per_period) || 1));

  const { supabase, user } = await requireUser();
  const row = {
    name: name.slice(0, 80),
    description: input.description?.trim().slice(0, 300) || null,
    icon: input.icon || null,
    color: input.color || null,
    cadence: input.cadence,
    target_per_period: target,
    unit: input.unit?.trim().slice(0, 20) || null,
    reminder_time: input.reminder_time || null,
  };

  if (input.id) {
    const { error } = await supabase.from("habits").update(row).eq("id", input.id);
    if (error) throw error;
    revalidatePath("/habits");
    return { id: input.id };
  }
  const { count } = await supabase
    .from("habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data, error } = await supabase
    .from("habits")
    .insert({ ...row, user_id: user.id, position: count ?? 0 })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/habits");
  return { id: data.id as string };
}

export async function deleteHabit(id: string) {
  const { supabase } = await requireUser();
  // habit_logs cascade on delete.
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/habits");
}

/** Set a habit's progress for one day. count 0 clears the day. */
export async function setHabitCount(input: {
  habitId: string;
  date: string;
  count: number;
  note?: string | null;
}) {
  if (!DATE_RE.test(input.date)) throw new Error("Invalid date");
  const { supabase, user } = await requireUser();
  const count = Math.max(0, Math.round(Number(input.count) || 0));

  if (count === 0 && !input.note) {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", input.habitId)
      .eq("log_date", input.date);
    if (error) throw error;
    revalidatePath("/habits");
    return;
  }
  // One row per habit per day — upsert on that pair.
  const { error } = await supabase.from("habit_logs").upsert(
    {
      habit_id: input.habitId,
      user_id: user.id,
      log_date: input.date,
      count,
      note: input.note?.trim().slice(0, 500) || null,
    },
    { onConflict: "habit_id,log_date" },
  );
  if (error) throw error;
  revalidatePath("/habits");
}

export async function loadHabitsAction() {
  await requireUser();
  return getHabitsData();
}
