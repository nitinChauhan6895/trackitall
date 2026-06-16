import { formatSeconds } from "@/lib/types";
import { HIIT_EXERCISES, resolveHiitMetrics, type ResolvedMetric } from "@/lib/hiit";

// Categories shown as filter chips in the "Add Exercise" sheet.
export type CircuitCategory = "cardio" | "machines" | "strength" | "other";

export const CIRCUIT_FILTERS: { key: "all" | CircuitCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cardio", label: "Cardio" },
  { key: "machines", label: "Machines" },
  { key: "strength", label: "Strength" },
  { key: "other", label: "Other" },
];

const CATEGORY: Record<string, CircuitCategory> = {
  Running: "cardio",
  Cycling: "cardio",
  Rowing: "machines",
  AirBike: "machines",
  SkiErg: "machines",
  "Stair Stepper": "machines",
  "Farmers Carry": "strength",
  "Sled Push": "strength",
  "Sled Pull": "strength",
  "Kettlebell Swing": "strength",
  "Goblet Squat": "strength",
  Lunges: "strength",
  "Wall Ball": "strength",
  "Box Jumps": "other",
  Burpees: "other",
};

export type CircuitLibraryItem = {
  name: string;
  category: CircuitCategory;
  metrics: ResolvedMetric[];
};

export function circuitLibrary(): CircuitLibraryItem[] {
  return HIIT_EXERCISES.map((e) => ({
    name: e.name,
    category: CATEGORY[e.name] ?? "other",
    metrics: resolveHiitMetrics(e.name),
  }));
}

export function categoryFor(name: string): CircuitCategory {
  return CATEGORY[name] ?? "other";
}

// One-line summary of an exercise's target metrics, e.g. "1 km" or "100 kg · 50 m".
export function summarizeCircuitExercise(
  name: string,
  metrics: Record<string, string | number>,
): string {
  const resolved = resolveHiitMetrics(name);
  const parts: string[] = [];
  // Known metrics first (with labels/units), then any leftover (manual) values.
  for (const m of resolved) {
    const v = metrics[m.draftKey];
    if (v == null || v === "") continue;
    if (m.kind === "time") {
      const secs = typeof v === "number" ? v : Number(v);
      parts.push(Number.isFinite(secs) ? formatSeconds(secs) : String(v));
    } else {
      parts.push(m.unit ? `${v} ${m.unit}` : `${m.label} ${v}`);
    }
  }
  return parts.length ? parts.join(" · ") : "No targets set";
}
