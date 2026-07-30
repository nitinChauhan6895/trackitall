export const MUSCLE_GROUPS = [
  "chest",
  "tricep",
  "back",
  "bicep",
  "forearms",
  "shoulders",
  "legs",
  "core",
  "functional",
  "cardio",
  "hiit",
  "olympic",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  tricep: "Triceps",
  back: "Back",
  bicep: "Biceps",
  forearms: "Forearms",
  shoulders: "Shoulders",
  legs: "Legs",
  core: "Core",
  functional: "Functional",
  cardio: "Cardio",
  hiit: "HIIT",
  olympic: "Olympic lifting",
};

export function isCardio(group: MuscleGroup): boolean {
  return group === "cardio";
}

// ---- Cardio exercise types (per-exercise field sets) ----
export const CARDIO_TYPES = [
  "running",
  "walking",
  "cycling",
  "air_bike",
  "elliptical",
  "stair_climber",
  "skierg",
  "rowing",
  "swimming",
  "jump_rope",
  "sledge_push",
  "sledge_pull",
  "farmer_walk",
  "generic",
] as const;
export type CardioType = (typeof CARDIO_TYPES)[number];

export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
  running: "Running",
  walking: "Walking",
  cycling: "Cycling / Bike",
  air_bike: "Air / Assault bike",
  elliptical: "Elliptical",
  stair_climber: "Stair climber",
  skierg: "SkiErg",
  rowing: "Rowing",
  swimming: "Swimming",
  jump_rope: "Jump rope",
  sledge_push: "Sledge push",
  sledge_pull: "Sledge pull",
  farmer_walk: "Farmer walk",
  generic: "Other (time + distance)",
};

// Fields each cardio type collects, in display order.
export type CardioField =
  | "distance_km"
  | "distance_m"
  | "time"
  | "calories"
  | "incline"
  | "resistance"
  | "weight";

// Time is always the primary (required) metric for cardio, so it leads every
// list; distance comes second where it applies, then the remaining metrics.
export const CARDIO_FIELDS: Record<CardioType, CardioField[]> = {
  running: ["time", "distance_km", "incline", "calories"],
  walking: ["time", "distance_km", "incline", "calories"],
  cycling: ["time", "distance_km", "resistance", "calories"],
  air_bike: ["time", "resistance", "calories"],
  elliptical: ["time", "distance_km", "resistance", "calories"],
  stair_climber: ["time", "resistance", "calories"],
  skierg: ["time", "distance_m", "calories"],
  rowing: ["time", "distance_m", "calories"],
  swimming: ["time", "distance_m", "calories"],
  jump_rope: ["time", "calories"],
  sledge_push: ["time", "distance_m", "weight", "calories"],
  sledge_pull: ["time", "distance_m", "weight", "calories"],
  farmer_walk: ["time", "distance_m", "weight", "calories"],
  generic: ["time", "distance_km", "calories"],
};

// Short field label + unit suffix shown to the right of the input.
export const CARDIO_FIELD_META: Record<
  CardioField,
  { label: string; unit: string }
> = {
  distance_km: { label: "Distance", unit: "km" },
  distance_m: { label: "Distance", unit: "m" },
  time: { label: "Duration", unit: "" },
  calories: { label: "Calories", unit: "kcal" },
  incline: { label: "Incline", unit: "%" },
  resistance: { label: "Resistance", unit: "" },
  weight: { label: "Weight", unit: "kg" },
};

export function defaultCardioType(): CardioType {
  return "running";
}

export type WorkoutSet = {
  id: string;
  exercise_id: string;
  position: number;
  reps: number | null;
  weight_kg: number | null;
  distance_km: number | null;
  speed_kmh: number | null;
  // Round 2 cardio fields:
  time_seconds: number | null;
  incline: number | null;
  resistance: number | null;
  distance_m: number | null;
  // Round 4 cardio field:
  calories: number | null;
  // Round 5 HIIT fields:
  sets_count: number | null;
  height: number | null;
  floors: number | null;
  /** Taken to (or near) failure — counted separately in Load stats. */
  is_hard?: boolean | null;
};

export type Exercise = {
  id: string;
  user_id: string;
  workout_date: string;
  muscle_group: MuscleGroup;
  name: string;
  position: number;
  created_at: string;
  cardio_type: CardioType | null;
  sets: WorkoutSet[];
};

// ---- Profile ----
export type Profile = {
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  share_to_community: boolean;
};

export function displayName(p: Pick<Profile, "first_name" | "last_name" | "username">): string {
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.username;
}

export function profileInitial(p: Pick<Profile, "first_name" | "username">): string {
  const base = (p.first_name || p.username || "?").trim();
  return (base[0] || "?").toUpperCase();
}

// ---- Workout sharing ----
export type ShareableUser = {
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
};

export type IncomingShare = {
  id: string;
  from_name: string;
  workout_date: string;
  muscle_group: MuscleGroup;
  exercise_count: number;
  set_count: number;
};

// ---- Measurements ----
export type Measurement = {
  id: string;
  user_id: string;
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
  created_at: string;
};

export const MEASUREMENT_FIELDS = [
  { key: "bodyweight", label: "Bodyweight", unit: "kg" },
  { key: "height", label: "Height", unit: "cm" },
  { key: "age", label: "Age", unit: "yr" },
  { key: "body_fat_pct", label: "Body fat", unit: "%" },
  { key: "chest", label: "Chest", unit: "cm" },
  { key: "shoulders", label: "Shoulders", unit: "cm" },
  { key: "waist", label: "Waist", unit: "cm" },
  { key: "navel", label: "Navel", unit: "cm" },
  { key: "arms", label: "Arms", unit: "cm" },
  { key: "thighs", label: "Thighs", unit: "cm" },
] as const;
export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number]["key"];

// ---- HIIT circuits (reusable library) ----
export type CircuitExercise = {
  id: string;
  circuit_id: string;
  user_id: string;
  position: number;
  name: string;
  category: string | null;
  metrics: Record<string, string | number>;
  created_at: string;
};

export type Circuit = {
  id: string;
  user_id: string;
  name: string;
  set_times: number[]; // seconds per round
  created_at: string;
  updated_at: string;
  exercises: CircuitExercise[];
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
  reps: number | null; // optional, mainly for kg-type PRs (e.g. 120 kg x 5)
  achieved_date: string | null; // date the PR was set (YYYY-MM-DD)
  created_at: string;
  updated_at: string;
};

// Emoji icon for a PR tile, based on its unit type.
export function prIcon(pr: Pick<Pr, "unit_type">): string {
  if (pr.unit_type === "time") return "⏱️";
  if (pr.unit_type === "distance") return "📍";
  return "🏋️";
}

export function formatPrValue(pr: Pick<Pr, "unit_type" | "value" | "distance_unit">): string {
  if (pr.unit_type === "kg") return `${trimNum(pr.value)} kg`;
  if (pr.unit_type === "distance")
    return `${trimNum(pr.value)} ${pr.distance_unit ?? "m"}`;
  // time
  return formatSeconds(pr.value);
}

export function formatSeconds(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Parse a duration to whole seconds.
 *
 * Colon forms are unambiguous: "mm:ss" and "hh:mm:ss". A BARE number is the
 * trap — for a rest interval "45" means 45 seconds, but for cardio "30" means
 * 30 minutes (nobody logs "30 seconds of running"). `bareUnit` decides which,
 * so the cardio Duration field can take plain minutes while HIIT intervals stay
 * seconds.
 */
export function parseDuration(
  input: string,
  bareUnit: "seconds" | "minutes" = "seconds",
): number | null {
  const t = input.trim();
  if (t === "") return null;
  // Bare number (allow a decimal, e.g. "30.5" minutes).
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    return Math.round(bareUnit === "minutes" ? n * 60 : n);
  }
  const hms = t.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
  if (hms) {
    return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  }
  const ms = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  return null;
}

/** Back-compat: a bare number is seconds. */
export function parseTimeToSeconds(input: string): number | null {
  return parseDuration(input, "seconds");
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
