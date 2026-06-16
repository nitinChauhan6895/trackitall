// HIIT circuit exercises. Each exercise records a fixed set of scalar metrics.
// Metrics map onto existing/added `sets` columns so they stay queryable.

export type HiitMetricKey =
  | "distance"
  | "duration"
  | "time"
  | "calories"
  | "weight"
  | "reps"
  | "sets"
  | "height"
  | "floors";

export type HiitExerciseDef = {
  name: string;
  metrics: HiitMetricKey[];
  distanceUnit?: "km" | "m";
};

export const HIIT_EXERCISES: HiitExerciseDef[] = [
  { name: "Running", metrics: ["distance", "duration", "calories"], distanceUnit: "km" },
  { name: "Cycling", metrics: ["distance", "duration", "calories"], distanceUnit: "km" },
  { name: "Rowing", metrics: ["distance", "duration", "calories"], distanceUnit: "m" },
  { name: "AirBike", metrics: ["calories", "duration", "distance"], distanceUnit: "km" },
  { name: "Farmers Carry", metrics: ["distance", "weight", "time"], distanceUnit: "m" },
  { name: "Sled Push", metrics: ["distance", "weight", "time"], distanceUnit: "m" },
  { name: "Sled Pull", metrics: ["distance", "weight", "time"], distanceUnit: "m" },
  { name: "Kettlebell Swing", metrics: ["sets", "reps", "weight"] },
  { name: "Goblet Squat", metrics: ["sets", "reps", "weight"] },
  { name: "Lunges", metrics: ["sets", "reps", "weight"] },
  { name: "Wall Ball", metrics: ["sets", "reps", "weight"] },
  { name: "Box Jumps", metrics: ["sets", "reps", "height"] },
  { name: "Burpees", metrics: ["reps", "duration", "calories"] },
  { name: "Stair Stepper", metrics: ["floors", "duration", "calories"] },
  { name: "SkiErg", metrics: ["distance", "duration", "calories"], distanceUnit: "m" },
];

export function hiitDef(name: string): HiitExerciseDef | undefined {
  return HIIT_EXERCISES.find((e) => e.name === name);
}

// A metric resolved for a specific exercise. `draftKey` is the client form key;
// `dbColumn` is the `sets` table column; `kind` drives input type & formatting.
export type ResolvedMetric = {
  metric: HiitMetricKey;
  label: string;
  unit: string;
  kind: "number" | "time";
  draftKey:
    | "reps"
    | "weight"
    | "distance_km"
    | "distance_m"
    | "time"
    | "calories"
    | "sets_count"
    | "height"
    | "floors";
  dbColumn:
    | "reps"
    | "weight_kg"
    | "distance_km"
    | "distance_m"
    | "time_seconds"
    | "calories"
    | "sets_count"
    | "height"
    | "floors";
};

export function resolveHiitMetrics(name: string): ResolvedMetric[] {
  const def = hiitDef(name);
  if (!def) return [];
  return def.metrics.map((m) => resolveMetric(m, def.distanceUnit ?? "km"));
}

function resolveMetric(
  m: HiitMetricKey,
  distanceUnit: "km" | "m",
): ResolvedMetric {
  switch (m) {
    case "distance":
      return distanceUnit === "m"
        ? { metric: m, label: "Distance", unit: "m", kind: "number", draftKey: "distance_m", dbColumn: "distance_m" }
        : { metric: m, label: "Distance", unit: "km", kind: "number", draftKey: "distance_km", dbColumn: "distance_km" };
    case "duration":
      return { metric: m, label: "Duration", unit: "", kind: "time", draftKey: "time", dbColumn: "time_seconds" };
    case "time":
      return { metric: m, label: "Time", unit: "", kind: "time", draftKey: "time", dbColumn: "time_seconds" };
    case "calories":
      return { metric: m, label: "Calories", unit: "kcal", kind: "number", draftKey: "calories", dbColumn: "calories" };
    case "weight":
      return { metric: m, label: "Weight", unit: "kg", kind: "number", draftKey: "weight", dbColumn: "weight_kg" };
    case "reps":
      return { metric: m, label: "Reps", unit: "", kind: "number", draftKey: "reps", dbColumn: "reps" };
    case "sets":
      return { metric: m, label: "Sets", unit: "", kind: "number", draftKey: "sets_count", dbColumn: "sets_count" };
    case "height":
      return { metric: m, label: "Height", unit: "cm", kind: "number", draftKey: "height", dbColumn: "height" };
    case "floors":
      return { metric: m, label: "Floors", unit: "", kind: "number", draftKey: "floors", dbColumn: "floors" };
  }
}
