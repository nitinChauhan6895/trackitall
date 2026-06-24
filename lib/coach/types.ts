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

export const INJURIES = ["Shoulder", "Knee", "Lower Back"] as const;
export type Injury = (typeof INJURIES)[number];

export type Category =
  | "Primary Compound"
  | "Secondary Compound"
  | "Isolation"
  | "Finisher"
  | "Cardio";

export type LibraryExercise = {
  id: string;
  name: string;
  muscle_group: CoachGroup;
  category: Category;
  equipment: Equipment;
  difficulty: Experience;
  goal_tags: string[];
  alternative_exercise_ids: string[];
  estimated_duration_min: number;
  injury_flags: string[];
};

export type TemplateSlot = {
  category: Category;
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

// Equipment hierarchy: a user with a higher tier can perform lower-tier moves.
const EQUIP_RANK: Record<Equipment, number> = {
  Bodyweight: 0,
  "Dumbbells Only": 1,
  "Home Gym": 2,
  "Full Gym": 3,
};
export function equipmentAllows(user: Equipment, ex: Equipment): boolean {
  return EQUIP_RANK[ex] <= EQUIP_RANK[user];
}

export function goalTag(goal: Goal): string {
  return goal === "Muscle Growth" ? "Growth" : goal;
}
