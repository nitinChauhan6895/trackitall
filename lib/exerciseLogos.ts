// Maps an exercise name to one of the illustrated logo files in
// /public/exercises/<name>.png. Order matters — first match wins.

export const EXERCISE_LOGO_NAMES = [
  "barbell",
  "bench-press",
  "dumbbells",
  "cable-machine",
  "pull-up",
  "grip",
  "running",
  "treadmill",
  "battle-ropes",
  "kettlebell",
  "box-jump",
  "sled",
  "rowing",
  "air-bike",
  "ski-erg",
  "rig",
] as const;

const RULES: [RegExp, string][] = [
  [/bench/, "bench-press"],
  [/pull[-\s]?up|chin[-\s]?up|lat\s?pulldown|pulldown/, "pull-up"],
  [/cable|crossover|\bfly\b|pec\s?deck|functional/, "cable-machine"],
  [/ski/, "ski-erg"],
  [/row/, "rowing"],
  [/air\s?bike|assault|cycl|\bbike\b|spin/, "air-bike"],
  [/treadmill|incline/, "treadmill"],
  [/run|sprint|jog/, "running"],
  [/kettlebell|\bswing\b|goblet/, "kettlebell"],
  [/box\s?jump|\bjump\b|plyo/, "box-jump"],
  [/sled|prowler|farmer/, "sled"],
  [/rope/, "battle-ropes"],
  [/ring|muscle\s?up|\bdip\b|rig|monkey/, "rig"],
  [/grip|carry|hold|plank|wall\s?ball|burpee/, "grip"],
  [/dumbbell|\bdb\b|hammer/, "dumbbells"],
  // Fallback: anything barbell-ish (squat, deadlift, press, curl, oly lifts…)
  [/.*/, "barbell"],
];

export function exerciseLogo(name: string): string {
  const n = name.toLowerCase();
  for (const [re, logo] of RULES) if (re.test(n)) return logo;
  return "barbell";
}

export function logoSrc(name: string): string {
  return `/exercises/${exerciseLogo(name)}.png`;
}
