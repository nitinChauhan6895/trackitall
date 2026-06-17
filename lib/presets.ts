import { type CardioType, type MuscleGroup } from "@/lib/types";
import { HIIT_EXERCISES } from "@/lib/hiit";
import { libraryExercisesFor } from "@/lib/library";

// "Add from library" presets. Tapping one prefills a new exercise card.
// Names come from the canonical EXERCISE_LIBRARY; HIIT stays its own builder.
export type LibraryItem = { name: string; cardioType?: CardioType };

// Cardio is driven by cardioType (which fields show). Map each JSON cardio name
// to the closest existing type so the right fields appear.
const CARDIO_NAME_TO_TYPE: Record<string, CardioType> = {
  Running: "running",
  Treadmill: "running",
  Cycling: "generic",
  "Air Bike": "generic",
  Rowing: "rowing",
  SkiErg: "skierg",
  "Stair Stepper": "generic",
  Elliptical: "elliptical",
  Walking: "generic",
  "Jump Rope": "generic",
};

export function libraryFor(group: MuscleGroup): LibraryItem[] {
  if (group === "hiit") {
    return HIIT_EXERCISES.map((e) => ({ name: e.name }));
  }
  const exercises = libraryExercisesFor(group);
  if (group === "cardio") {
    return exercises.map((e) => ({
      name: e.name,
      cardioType: CARDIO_NAME_TO_TYPE[e.name] ?? "generic",
    }));
  }
  return exercises.map((e) => ({ name: e.name }));
}
