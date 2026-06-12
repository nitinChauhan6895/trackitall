"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MUSCLE_GROUPS,
  PR_UNIT_TYPES,
  type MuscleGroup,
  type PrUnitType,
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
};
export type ExerciseInput = { name: string; sets: SetInput[] };
export type GroupInput = { muscle_group: MuscleGroup; exercises: ExerciseInput[] };

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
        .map((s, i) => ({
          exercise_id: inserted.id,
          user_id: user.id,
          position: i,
          reps: cleanInt(s.reps),
          weight_kg: cleanNum(s.weight_kg),
          distance_km: cleanNum(s.distance_km),
          speed_kmh: cleanNum(s.speed_kmh),
        }))
        .filter(
          (r) =>
            r.reps != null ||
            r.weight_kg != null ||
            r.distance_km != null ||
            r.speed_kmh != null,
        );

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
  const isCardio = String(formData.get("cardio") ?? "") === "1";

  const reps = cleanInt(numOrNull(formData.get("reps")));
  const weight_kg = cleanNum(numOrNull(formData.get("weight")));
  const distance_km = cleanNum(numOrNull(formData.get("distance")));
  const speed_kmh = cleanNum(numOrNull(formData.get("speed")));

  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("sets")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", exerciseId);

  const { error } = await supabase.from("sets").insert({
    exercise_id: exerciseId,
    user_id: user.id,
    position: count ?? 0,
    reps: isCardio ? null : reps,
    weight_kg: isCardio ? null : weight_kg,
    distance_km: isCardio ? distance_km : null,
    speed_kmh: isCardio ? speed_kmh : null,
  });
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
}) {
  const name = input.exercise_name.trim();
  if (!name) throw new Error("Exercise name is required");
  if (!PR_UNIT_TYPES.includes(input.unit_type))
    throw new Error("Invalid unit type");
  if (!Number.isFinite(input.value) || input.value < 0)
    throw new Error("Invalid value");

  const { supabase, user } = await requireUser();

  const payload = {
    user_id: user.id,
    exercise_name: name.slice(0, 120),
    unit_type: input.unit_type,
    value: input.value,
    distance_unit: input.unit_type === "distance" ? input.distance_unit : null,
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

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
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
