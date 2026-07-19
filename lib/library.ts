import type { MuscleGroup } from "@/lib/types";

// Canonical exercise library (source of truth for the "Add from library" picker).
// Metrics are kept for future use; the picker currently uses names only.
export type LibraryMetric =
  | "weight"
  | "reps"
  | "time"
  | "distance"
  | "calories"
  | "floors"
  | "height";

export type LibraryExercise = { name: string; metric: LibraryMetric[] };
export type LibraryCategory = { category: string; exercises: LibraryExercise[] };

// Maps a library category label to the app's muscle group. ("HIIT" has no
// category here — it stays the separate circuit builder.)
const CATEGORY_TO_GROUP: Record<string, MuscleGroup> = {
  Chest: "chest",
  Tricep: "tricep",
  Back: "back",
  Bicep: "bicep",
  Forearms: "forearms",
  Shoulders: "shoulders",
  Legs: "legs",
  Core: "core",
  Functional: "functional",
  Cardio: "cardio",
  "Olympic Lifting": "olympic",
};

export function groupForCategory(category: string): MuscleGroup | undefined {
  return CATEGORY_TO_GROUP[category];
}

export const EXERCISE_LIBRARY: LibraryCategory[] = [
  {
    category: "Chest",
    exercises: [
      { name: "Bench Press", metric: ["weight", "reps"] },
      { name: "Incline Bench Press", metric: ["weight", "reps"] },
      { name: "Decline Bench Press", metric: ["weight", "reps"] },
      { name: "Dumbbell Bench Press", metric: ["weight", "reps"] },
      { name: "Incline Dumbbell Press", metric: ["weight", "reps"] },
      { name: "Chest Fly", metric: ["weight", "reps"] },
      { name: "Pec Deck Fly", metric: ["weight", "reps"] },
      { name: "Cable Crossover", metric: ["weight", "reps"] },
      { name: "Push-ups", metric: ["reps"] },
      { name: "Dips (Chest Focus)", metric: ["reps", "weight"] },
    ],
  },
  {
    category: "Tricep",
    exercises: [
      { name: "Tricep Pushdown", metric: ["weight", "reps"] },
      { name: "Overhead Tricep Extension", metric: ["weight", "reps"] },
      { name: "Skull Crushers", metric: ["weight", "reps"] },
      { name: "Close Grip Bench Press", metric: ["weight", "reps"] },
      { name: "Dips", metric: ["reps", "weight"] },
      { name: "Rope Pushdown", metric: ["weight", "reps"] },
      { name: "Single Arm Cable Extension", metric: ["weight", "reps"] },
      { name: "Dumbbell Kickback", metric: ["weight", "reps"] },
      { name: "EZ Bar Extension", metric: ["weight", "reps"] },
      { name: "Diamond Push-ups", metric: ["reps"] },
    ],
  },
  {
    category: "Back",
    exercises: [
      { name: "Deadlift", metric: ["weight", "reps"] },
      { name: "Pull-ups", metric: ["reps", "weight"] },
      { name: "Lat Pulldown", metric: ["weight", "reps"] },
      { name: "Barbell Row", metric: ["weight", "reps"] },
      { name: "Seated Cable Row", metric: ["weight", "reps"] },
      { name: "T-Bar Row", metric: ["weight", "reps"] },
      { name: "One Arm Dumbbell Row", metric: ["weight", "reps"] },
      { name: "Machine Row", metric: ["weight", "reps"] },
      { name: "Straight Arm Pulldown", metric: ["weight", "reps"] },
      { name: "Rack Pull", metric: ["weight", "reps"] },
    ],
  },
  {
    category: "Bicep",
    exercises: [
      { name: "Barbell Curl", metric: ["weight", "reps"] },
      { name: "EZ Bar Curl", metric: ["weight", "reps"] },
      { name: "Dumbbell Curl", metric: ["weight", "reps"] },
      { name: "Hammer Curl", metric: ["weight", "reps"] },
      { name: "Incline Dumbbell Curl", metric: ["weight", "reps"] },
      { name: "Concentration Curl", metric: ["weight", "reps"] },
      { name: "Cable Curl", metric: ["weight", "reps"] },
      { name: "Preacher Curl", metric: ["weight", "reps"] },
      { name: "Machine Curl", metric: ["weight", "reps"] },
      { name: "Chin-ups", metric: ["reps", "weight"] },
    ],
  },
  {
    category: "Shoulders",
    exercises: [
      { name: "Overhead Press", metric: ["weight", "reps"] },
      { name: "Dumbbell Shoulder Press", metric: ["weight", "reps"] },
      { name: "Arnold Press", metric: ["weight", "reps"] },
      { name: "Lateral Raise", metric: ["weight", "reps"] },
      { name: "Cable Lateral Raise", metric: ["weight", "reps"] },
      { name: "Front Raise", metric: ["weight", "reps"] },
      { name: "Rear Delt Fly", metric: ["weight", "reps"] },
      { name: "Cable Rear Delt Fly", metric: ["weight", "reps"] },
      { name: "Face Pull", metric: ["weight", "reps"] },
      { name: "Upright Row", metric: ["weight", "reps"] },
      { name: "Machine Shoulder Press", metric: ["weight", "reps"] },
      { name: "Shrugs", metric: ["weight", "reps"] },
    ],
  },
  {
    category: "Legs",
    exercises: [
      { name: "Back Squat", metric: ["weight", "reps"] },
      { name: "Front Squat", metric: ["weight", "reps"] },
      { name: "Hack Squat", metric: ["weight", "reps"] },
      { name: "Leg Press", metric: ["weight", "reps"] },
      { name: "Romanian Deadlift", metric: ["weight", "reps"] },
      { name: "Walking Lunges", metric: ["weight", "reps"] },
      { name: "Weighted Lunges", metric: ["weight", "reps"] },
      { name: "Bulgarian Split Squat", metric: ["weight", "reps"] },
      { name: "Leg Extension", metric: ["weight", "reps"] },
      { name: "Leg Curl", metric: ["weight", "reps"] },
      { name: "Hip Abductors", metric: ["weight", "reps"] },
      { name: "Hip Thrust", metric: ["weight", "reps"] },
      { name: "Calf Raises", metric: ["weight", "reps"] },
    ],
  },
  {
    category: "Core",
    exercises: [
      { name: "Plank", metric: ["time"] },
      { name: "Side Plank", metric: ["time"] },
      { name: "Crunches", metric: ["reps"] },
      { name: "Hanging Leg Raise", metric: ["reps"] },
      { name: "Russian Twist", metric: ["reps"] },
      { name: "Bicycle Crunch", metric: ["reps"] },
      { name: "Cable Crunch", metric: ["weight", "reps"] },
      { name: "Mountain Climbers", metric: ["time"] },
      { name: "Ab Wheel Rollout", metric: ["reps"] },
      { name: "Toe Touches", metric: ["reps"] },
    ],
  },
  {
    category: "Forearms",
    exercises: [
      { name: "Wrist Curl", metric: ["weight", "reps"] },
      { name: "Reverse Wrist Curl", metric: ["weight", "reps"] },
      { name: "Reverse Curl", metric: ["weight", "reps"] },
      { name: "Wrist Roller", metric: ["weight", "reps"] },
      { name: "Dead Hang", metric: ["time"] },
      { name: "Plate Pinch Hold", metric: ["weight", "time"] },
    ],
  },
  {
    category: "Functional",
    exercises: [
      { name: "Farmers Carry", metric: ["weight", "distance"] },
      { name: "Sled Push", metric: ["weight", "distance"] },
      { name: "Sled Pull", metric: ["weight", "distance"] },
      { name: "Kettlebell Swing", metric: ["weight", "reps"] },
      { name: "Goblet Squat", metric: ["weight", "reps"] },
      { name: "Box Jumps", metric: ["height", "reps"] },
      { name: "Burpees", metric: ["reps"] },
      { name: "Wall Ball", metric: ["weight", "reps"] },
      { name: "Battle Ropes", metric: ["time"] },
      { name: "Walking Lunges", metric: ["weight", "reps"] },
    ],
  },
  {
    category: "Cardio",
    exercises: [
      { name: "Running", metric: ["distance", "time"] },
      { name: "Treadmill", metric: ["distance", "time"] },
      { name: "Cycling", metric: ["distance", "time"] },
      { name: "Air Bike", metric: ["calories", "time"] },
      { name: "Rowing", metric: ["distance", "time"] },
      { name: "SkiErg", metric: ["distance", "time"] },
      { name: "Stair Stepper", metric: ["floors", "time"] },
      { name: "Elliptical", metric: ["distance", "time"] },
      { name: "Walking", metric: ["distance", "time"] },
      { name: "Jump Rope", metric: ["reps", "time"] },
    ],
  },
  {
    category: "Olympic Lifting",
    exercises: [
      { name: "Snatch", metric: ["weight", "reps"] },
      { name: "Clean & Jerk", metric: ["weight", "reps"] },
      { name: "Power Clean", metric: ["weight", "reps"] },
      { name: "Power Snatch", metric: ["weight", "reps"] },
      { name: "Hang Clean", metric: ["weight", "reps"] },
      { name: "Hang Snatch", metric: ["weight", "reps"] },
      { name: "Push Press", metric: ["weight", "reps"] },
      { name: "Split Jerk", metric: ["weight", "reps"] },
      { name: "Front Squat", metric: ["weight", "reps"] },
      { name: "Overhead Squat", metric: ["weight", "reps"] },
    ],
  },
];

export function libraryExercisesFor(group: MuscleGroup): LibraryExercise[] {
  const cat = EXERCISE_LIBRARY.find((c) => groupForCategory(c.category) === group);
  return cat?.exercises ?? [];
}
