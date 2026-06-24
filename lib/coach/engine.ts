import {
  equipmentAllows,
  goalTag,
  type Category,
  type CoachGroup,
  type CoachProfile,
  type GenItem,
  type GenerationResult,
  type LibraryExercise,
  type SlotCategory,
  type TemplateSlot,
  type WorkoutTemplate,
} from "@/lib/coach/types";

// Per-user history, precomputed by the data layer (all keys are lowercased names).
export type History = {
  lastWorkoutNames: Set<string>;
  prev2Names: Set<string>;
  freqByName: Map<string, number>;
  daysSince: Map<string, number>;
  prNames: Set<string>;
  lastPerf: Map<string, { topReps: number; weight: number }>;
  groupLastDays: Map<string, number | null>; // coach group → days since trained
  prevCardioNames: Set<string>;
  freqCutoff: number;
};

export type GenerateInput = {
  groups: CoachGroup[];
  profile: CoachProfile;
  template: WorkoutTemplate;
  library: LibraryExercise[];
  history: History;
};

const lc = (s: string) => s.trim().toLowerCase();
const isDumbbell = (ex: LibraryExercise) => /dumbbell/i.test(ex.name);
// Library has no explicit bodyweight tag, so detect common bodyweight moves by name.
const BW_RE =
  /push[\s-]?up|pull[\s-]?up|chin[\s-]?up|\bdip\b|plank|crunch|sit[\s-]?up|bodyweight|hanging|mountain climber|burpee|hollow|superman|glute bridge|nordic|pistol|leg raise/i;
const isBodyweight = (ex: LibraryExercise) => BW_RE.test(ex.name);
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

// Default per-exercise minutes when the library row has no estimate.
const EST_BY_CATEGORY: Record<Category, number> = {
  Compound: 12,
  Isolation: 8,
  Finisher: 6,
  Cardio: 12,
};
const estMin = (ex: LibraryExercise) =>
  ex.estimated_duration_min ?? EST_BY_CATEGORY[ex.category] ?? 10;

// A goal-template slot prescribes sets/reps per slot-category. Library exercises
// only carry Compound/Isolation/Finisher, so map the slot back to a library category.
const SLOT_TO_LIB: Record<SlotCategory, Category> = {
  "Primary Compound": "Compound",
  "Secondary Compound": "Compound",
  Isolation: "Isolation",
  Finisher: "Finisher",
  Cardio: "Cardio",
};
// Reverse mapping for the "Add exercise" pool, where we only know the library category.
const libToSlot = (c: Category): SlotCategory =>
  c === "Compound" ? "Secondary Compound" : c;

function eligible(ex: LibraryExercise, p: CoachProfile): boolean {
  return (
    equipmentAllows(p.equipment, ex.equipment) &&
    !p.excluded_exercise_ids.includes(ex.id) &&
    !ex.injury_flags.some((f) => p.injuries.includes(f))
  );
}

function scoreExercise(ex: LibraryExercise, p: CoachProfile, h: History): number {
  let s = 0;
  const key = lc(ex.name);
  if (p.preferred_exercise_ids.includes(ex.id)) s += 20;
  if (h.prNames.has(key)) s += 15;
  const f = h.freqByName.get(key) ?? 0;
  if (f > 0 && f >= h.freqCutoff) s += 10;
  const ds = h.daysSince.get(key);
  if (ds === undefined || ds >= 30) s += 5;
  if (h.lastWorkoutNames.has(key)) s -= 15;
  else if (h.prev2Names.has(key)) s -= 10;
  // tie-breaks
  if (ex.goal_tags.includes(goalTag(p.goal))) s += 2;
  if (ex.difficulty === p.experience) s += 1;
  return s;
}

function suggestWeight(
  ex: LibraryExercise,
  slot: TemplateSlot,
  h: History,
): { weight: number | null; note: string | null } {
  if (isBodyweight(ex) || slot.to_failure) return { weight: null, note: null };
  const perf = h.lastPerf.get(lc(ex.name));
  if (!perf) return { weight: null, note: "First time — pick a comfortable weight" };
  let w = perf.weight;
  if (perf.topReps >= slot.rep_max) w = perf.weight * 1.025; // +2.5%
  else if (perf.topReps >= slot.rep_min) w = perf.weight; // maintain
  else w = perf.weight * 0.95; // -5%
  const rounded = roundTo(w, isDumbbell(ex) ? 1.25 : 2.5);
  return { weight: rounded > 0 ? rounded : null, note: null };
}

function toItem(
  ex: LibraryExercise,
  slot: TemplateSlot,
  h: History,
  alternatives: GenItem[] = [],
): GenItem {
  const sw = suggestWeight(ex, slot, h);
  return {
    id: ex.id,
    name: ex.name,
    group: ex.muscle_group,
    category: ex.category,
    sets: slot.sets,
    repMin: slot.rep_min,
    repMax: slot.rep_max,
    toFailure: slot.to_failure,
    suggestedWeight: sw.weight,
    note: sw.note,
    isCardio: false,
    cardioMin: null,
    estDuration: estMin(ex),
    alternatives,
  };
}

function cardioItem(ex: LibraryExercise, mins: number, alternatives: GenItem[]): GenItem {
  return {
    id: ex.id,
    name: ex.name,
    group: "Cardio",
    category: "Cardio",
    sets: 0,
    repMin: 0,
    repMax: 0,
    toFailure: false,
    suggestedWeight: null,
    note: null,
    isCardio: true,
    cardioMin: mins,
    estDuration: mins,
    alternatives,
  };
}

function defaultSlot(category: SlotCategory, tpl: WorkoutTemplate): TemplateSlot {
  return (
    tpl.structure.find((s) => s.category === category) ?? {
      category,
      sets: 3,
      rep_min: 8,
      rep_max: 12,
      to_failure: false,
    }
  );
}

// Relative muscle "size" — larger groups get more exercises in a split.
const GROUP_SIZE: Record<CoachGroup, number> = {
  Chest: 3, Back: 3, Legs: 3, Shoulders: 2,
  Biceps: 1, Triceps: 1, Core: 1, Functional: 1, Cardio: 0,
};

// Preferred slot mix for K exercises in one muscle group.
function planForCount(k: number): SlotCategory[] {
  switch (k) {
    case 0: return [];
    case 1: return ["Primary Compound"];
    case 2: return ["Primary Compound", "Isolation"];
    case 3: return ["Primary Compound", "Secondary Compound", "Isolation"];
    case 4: return ["Primary Compound", "Secondary Compound", "Isolation", "Finisher"];
    case 5: return ["Primary Compound", "Secondary Compound", "Secondary Compound", "Isolation", "Finisher"];
    default: return ["Primary Compound", "Secondary Compound", "Secondary Compound", "Isolation", "Isolation", "Finisher"];
  }
}

// 1 group → 6, otherwise 7 exercises split across groups (bigger groups first).
function allocateCounts(ordered: CoachGroup[]): number[] {
  const n = ordered.length;
  if (n === 0) return [];
  const total = n === 1 ? 6 : 7;
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return ordered.map((_, i) => base + (i < rem ? 1 : 0));
}

export function generate(input: GenerateInput): GenerationResult {
  const { groups, profile, template, library, history } = input;
  const byId = new Map(library.map((e) => [e.id, e]));
  const strengthGroups: CoachGroup[] = groups.filter((g) => g !== "Cardio");

  // Order groups largest-muscle first so they receive the bigger share.
  const ordered = [...strengthGroups].sort(
    (a, b) => GROUP_SIZE[b] - GROUP_SIZE[a] || a.localeCompare(b),
  );
  const counts = allocateCounts(ordered);

  // Per-group eligible+scored pools.
  const poolByGroup = new Map<CoachGroup, { ex: LibraryExercise; score: number }[]>();
  for (const g of ordered) {
    poolByGroup.set(
      g,
      library
        .filter((ex) => ex.muscle_group === g && eligible(ex, profile))
        .map((ex) => ({ ex, score: scoreExercise(ex, profile, history) }))
        .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name)),
    );
  }

  const items: GenItem[] = [];
  const used = new Set<string>();

  // Fill each group's allocation: follow the slot plan, mapping each slot to a
  // library category. Prefer an unused muscle region for spread, and fall back to
  // any remaining exercise in the group when a category is missing (e.g. no finisher).
  ordered.forEach((g, gi) => {
    const groupPool = poolByGroup.get(g)!;
    const k = Math.min(counts[gi], groupPool.length);
    const usedRegions = new Set<string>();
    const pickFrom = (cands: { ex: LibraryExercise; score: number }[]) => {
      const free = cands.filter((s) => !used.has(s.ex.id));
      return (
        free.find((s) => !s.ex.muscle_region || !usedRegions.has(s.ex.muscle_region)) ??
        free[0]
      );
    };
    for (const slotCat of planForCount(k)) {
      const needLib = SLOT_TO_LIB[slotCat];
      let pick = pickFrom(groupPool.filter((s) => s.ex.category === needLib));
      if (!pick) pick = pickFrom(groupPool); // fallback: any remaining in group
      if (!pick) break;
      used.add(pick.ex.id);
      if (pick.ex.muscle_region) usedRegions.add(pick.ex.muscle_region);
      const slot = defaultSlot(slotCat, template);
      const alts = buildAlternatives(pick.ex, slot, groupPool, used, byId, profile, history);
      items.push(toItem(pick.ex, slot, history, alts));
    }
  });

  // Cardio: rotate to one not used in the previous workout (deterministic).
  const onlyCardio = strengthGroups.length === 0;
  const cardioPool = library.filter((ex) => ex.muscle_group === "Cardio" && eligible(ex, profile));
  const wantCardio = template.cardio_min > 0 || groups.includes("Cardio");
  if (cardioPool.length > 0 && wantCardio) {
    const cardioMin = groups.includes("Cardio")
      ? Math.max(template.cardio_min, onlyCardio ? 20 : 15)
      : template.cardio_min;
    const cScored = cardioPool
      .map((ex) => ({ ex, used: history.prevCardioNames.has(lc(ex.name)) }))
      .sort((a, b) => Number(a.used) - Number(b.used) || a.ex.name.localeCompare(b.ex.name));
    const choice = cScored[0].ex;
    const alts = cScored.slice(1).map((c) => cardioItem(c.ex, cardioMin, []));
    items.push(cardioItem(choice, cardioMin, alts));
  }

  const reasons = buildReasons(groups, items, history, profile);
  const durationMin = items.reduce((n, i) => n + i.estDuration, 0);

  // "Add exercise" pool: remaining eligible exercises across the selected groups.
  const poolItems: GenItem[] = [];
  for (const g of ordered) {
    for (const s of poolByGroup.get(g)!) {
      if (!used.has(s.ex.id))
        poolItems.push(toItem(s.ex, defaultSlot(libToSlot(s.ex.category), template), history));
    }
  }

  return { onboarded: true, groups, goal: profile.goal, durationMin, reasons, items, pool: poolItems };
}

function buildAlternatives(
  ex: LibraryExercise,
  slot: TemplateSlot,
  scored: { ex: LibraryExercise; score: number }[],
  used: Set<string>,
  byId: Map<string, LibraryExercise>,
  profile: CoachProfile,
  history: History,
): GenItem[] {
  const seen = new Set<string>([ex.id]);
  const result: GenItem[] = [];
  for (const id of ex.alternative_exercise_ids) {
    const a = byId.get(id);
    if (!a || seen.has(a.id) || used.has(a.id) || !eligible(a, profile)) continue;
    seen.add(a.id);
    result.push(toItem(a, slot, history));
  }
  const matchLib = SLOT_TO_LIB[slot.category];
  for (const s of scored) {
    if (s.ex.category !== matchLib) continue;
    if (seen.has(s.ex.id) || used.has(s.ex.id)) continue;
    seen.add(s.ex.id);
    result.push(toItem(s.ex, slot, history));
  }
  return result;
}

function buildReasons(
  groups: CoachGroup[],
  items: GenItem[],
  h: History,
  p: CoachProfile,
): string[] {
  const r: string[] = [];
  for (const group of groups.filter((g) => g !== "Cardio")) {
    const days = h.groupLastDays.get(group);
    if (days == null) r.push(`You haven't trained ${group} yet`);
    else if (days >= 3) r.push(`${group} not trained in the last ${days} days`);
    if (r.length >= 2) break;
  }

  const overload = items.find((i) => {
    const perf = h.lastPerf.get(lc(i.name));
    return perf && i.repMax > 0 && perf.topReps >= i.repMax;
  });
  if (overload) r.push(`Progressive overload opportunity on ${overload.name}`);

  const freqItem = items.find((i) => {
    const f = h.freqByName.get(lc(i.name)) ?? 0;
    return f > 0 && f >= h.freqCutoff;
  });
  if (freqItem) r.push(`You frequently perform ${freqItem.name}`);

  const fav = items.find((i) => p.preferred_exercise_ids.includes(i.id));
  if (fav) r.push(`Includes your favourite ${fav.name}`);

  if (r.length === 0)
    r.push(
      `A balanced ${groups.filter((g) => g !== "Cardio").join(" + ") || "cardio"} session for your ${p.goal.toLowerCase()} goal`,
    );
  return r.slice(0, 4);
}
