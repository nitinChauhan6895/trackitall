"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MUSCLE_GROUPS,
  PR_UNIT_TYPES,
  parseTimeToSeconds,
  type CardioType,
  type MuscleGroup,
  type PrUnitType,
  type ShareableUser,
} from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

// ---------- Per-exercise save/edit (Log workout wizard) ----------
// Persists a single exercise + its sets immediately so nothing is lost mid-session.
// Pass `id` to edit an existing exercise (its sets are replaced).
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

  // NOTE: deliberately no revalidatePath here. This action is called mid-flow
  // from the log wizard; revalidating would refresh the /log route, re-suspend
  // its async parent (getCircuits) and remount the wizard, dropping its state.
  // Freshness is handled by router.refresh() when the wizard navigates away.
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

export async function deleteMeasurement(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("measurements").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/measurements");
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
