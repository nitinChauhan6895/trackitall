export const MUSCLE_GROUPS = [
  "chest",
  "tricep",
  "back",
  "bicep",
  "shoulders",
  "legs",
  "core",
  "functional",
  "cardio",
  "olympic",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  tricep: "Tricep",
  back: "Back",
  bicep: "Bicep",
  shoulders: "Shoulders",
  legs: "Legs",
  core: "Core",
  functional: "Functional",
  cardio: "Cardio",
  olympic: "Olympic lifting",
};

export function isCardio(group: MuscleGroup): boolean {
  return group === "cardio";
}

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  position: number;
  reps: number | null;
  weight_kg: number | null;
  distance_km: number | null;
  speed_kmh: number | null;
};

export type Exercise = {
  id: string;
  user_id: string;
  workout_date: string;
  muscle_group: MuscleGroup;
  name: string;
  position: number;
  created_at: string;
  sets: WorkoutSet[];
};

// ---- PRs ----
export const PR_UNIT_TYPES = ["kg", "time", "distance"] as const;
export type PrUnitType = (typeof PR_UNIT_TYPES)[number];

export type Pr = {
  id: string;
  user_id: string;
  exercise_name: string;
  unit_type: PrUnitType;
  value: number; // kg amount, total seconds (time), or distance amount
  distance_unit: "m" | "km" | null;
  created_at: string;
  updated_at: string;
};

export function formatPrValue(pr: Pick<Pr, "unit_type" | "value" | "distance_unit">): string {
  if (pr.unit_type === "kg") return `${trimNum(pr.value)} kg`;
  if (pr.unit_type === "distance")
    return `${trimNum(pr.value)} ${pr.distance_unit ?? "m"}`;
  // time
  return formatSeconds(pr.value);
}

export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.round(total));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimeToSeconds(input: string): number | null {
  const t = input.trim();
  if (/^\d+$/.test(t)) return Number(t); // bare seconds
  const m = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
