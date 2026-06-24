import type { MuscleGroup } from "@/lib/types";

export const COACH_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Legs",
  "Biceps",
  "Triceps",
  "Core",
  "Functional",
  "Cardio",
] as const;
export type CoachGroup = (typeof COACH_GROUPS)[number];

export const GOALS = [
  "Muscle Growth",
  "Fat Loss",
  "Maintenance",
  "Strength",
  "General Fitness",
] as const;
export type Goal = (typeof GOALS)[number];

export const EXPERIENCES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Experience = (typeof EXPERIENCES)[number];

export const EQUIPMENTS = ["Full Gym", "Home Gym", "Dumbbells Only", "Bodyweight"] as const;
export type Equipment = (typeof EQUIPMENTS)[number];

export const INJURIES = [
  "Shoulder",
  "Knee",
  "Lower Back",
  "Elbow",
  "Neck",
  "Hip Flexor",
] as const;
export type Injury = (typeof INJURIES)[number];

export const RECOVERY_LOADS = ["Low", "Medium", "High"] as const;
export type RecoveryLoad = (typeof RECOVERY_LOADS)[number];

// Library exercise categories (v1).
export type Category = "Compound" | "Isolation" | "Finisher" | "Cardio";

// Template slot categories — how the goal template prescribes sets/reps.
// (The first compound in a group maps to "Primary Compound", the rest to
// "Secondary Compound"; isolation/finisher map straight through.)
export type SlotCategory =
  | "Primary Compound"
  | "Secondary Compound"
  | "Isolation"
  | "Finisher"
  | "Cardio";

export type LibraryExercise = {
  id: string;
  name: string;
  muscle_group: CoachGroup;
  muscle_region: string | null;
  category: Category;
  equipment: string[]; // contexts: "gym", "home"
  difficulty: Experience;
  goal_tags: string[];
  alternative_exercise_ids: string[];
  recovery_load: RecoveryLoad | null;
  estimated_duration_min: number | null;
  injury_flags: string[];
};

export type TemplateSlot = {
  category: SlotCategory;
  sets: number;
  rep_min: number;
  rep_max: number;
  to_failure: boolean;
};

export type WorkoutTemplate = {
  id: string;
  goal: Goal;
  duration_min: number;
  structure: TemplateSlot[];
  cardio_min: number;
  cardio_optional: boolean;
};

export type CoachProfile = {
  user_id: string;
  goal: Goal;
  experience: Experience;
  equipment: Equipment;
  injuries: string[];
  preferred_exercise_ids: string[];
  excluded_exercise_ids: string[];
};

// A single generated/selectable item (plain & serializable for the client).
export type GenItem = {
  id: string;
  name: string;
  group: CoachGroup;
  category: Category;
  sets: number;
  repMin: number;
  repMax: number;
  toFailure: boolean;
  suggestedWeight: number | null;
  note: string | null;
  isCardio: boolean;
  cardioMin: number | null;
  estDuration: number;
  alternatives: GenItem[];
};

export type GenerationResult =
  | { onboarded: false }
  | {
      onboarded: true;
      groups: CoachGroup[];
      goal: Goal;
      durationMin: number;
      reasons: string[];
      items: GenItem[];
      pool: GenItem[]; // filtered+scored pool across selected groups, for "Add exercise"
    };

// Maps a coach muscle group to the app's logging muscle group key.
export const COACH_TO_APP: Record<CoachGroup, MuscleGroup> = {
  Chest: "chest",
  Back: "back",
  Shoulders: "shoulders",
  Legs: "legs",
  Biceps: "bicep",
  Triceps: "tricep",
  Core: "core",
  Functional: "functional",
  Cardio: "cardio",
};

// Library equipment is a set of contexts ("gym", "home"). A Full-Gym user can
// do anything; everyone else needs an exercise that's tagged "home".
export function equipmentAllows(user: Equipment, exContexts: string[]): boolean {
  if (!exContexts || exContexts.length === 0) return true;
  if (user === "Full Gym") return true;
  return exContexts.includes("home");
}

export function goalTag(goal: Goal): string {
  return goal === "Muscle Growth" ? "Growth" : goal;
}
