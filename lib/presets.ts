import {
  CARDIO_TYPE_LABELS,
  CARDIO_TYPES,
  type CardioType,
  type MuscleGroup,
} from "@/lib/types";
import { HIIT_EXERCISES } from "@/lib/hiit";

// "Add from library" presets. Tapping one prefills a new exercise card.
// Cardio offers the cardio types, HIIT offers its circuit exercises, and every
// other group offers a hardcoded list of common exercise names.
export type LibraryItem = { name: string; cardioType?: CardioType };

const STRENGTH_PRESETS: Record<Exclude<MuscleGroup, "cardio" | "hiit">, string[]> = {
  chest: [
    "Bench press",
    "Incline bench press",
    "Dumbbell press",
    "Chest fly",
    "Cable crossover",
    "Push-up",
  ],
  tricep: [
    "Tricep pushdown",
    "Skull crusher",
    "Overhead extension",
    "Dips",
    "Close-grip bench press",
  ],
  back: [
    "Deadlift",
    "Pull-up",
    "Barbell row",
    "Lat pulldown",
    "Seated cable row",
    "T-bar row",
  ],
  bicep: [
    "Barbell curl",
    "Dumbbell curl",
    "Hammer curl",
    "Preacher curl",
    "Cable curl",
  ],
  shoulders: [
    "Overhead press",
    "Lateral raise",
    "Front raise",
    "Rear delt fly",
    "Arnold press",
    "Shrug",
  ],
  legs: [
    "Back squat",
    "Leg press",
    "Lunge",
    "Leg extension",
    "Leg curl",
    "Romanian deadlift",
    "Calf raise",
  ],
  core: [
    "Plank",
    "Crunch",
    "Hanging leg raise",
    "Russian twist",
    "Cable crunch",
  ],
  functional: [
    "Kettlebell swing",
    "Box jump",
    "Burpee",
    "Battle ropes",
    "Wall ball",
    "Farmer carry",
  ],
  olympic: [
    "Snatch",
    "Clean and jerk",
    "Power clean",
    "Clean",
    "Jerk",
    "Front squat",
    "Overhead squat",
  ],
};

export function libraryFor(group: MuscleGroup): LibraryItem[] {
  if (group === "cardio") {
    return CARDIO_TYPES.filter((t) => t !== "generic").map((t) => ({
      name: CARDIO_TYPE_LABELS[t],
      cardioType: t,
    }));
  }
  if (group === "hiit") {
    return HIIT_EXERCISES.map((e) => ({ name: e.name }));
  }
  return (STRENGTH_PRESETS[group] ?? []).map((name) => ({ name }));
}
