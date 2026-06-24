import {
  equipmentAllows,
  goalTag,
  type Category,
  type CoachGroup,
  type CoachProfile,
  type GenItem,
  type GenerationResult,
  type LibraryExercise,
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
const isDumbbell = (ex: LibraryExercise) =>
  ex.equipment === "Dumbbells Only" || /dumbbell/i.test(ex.name);
const isBodyweight = (ex: LibraryExercise) => ex.equipment === "Bodyweight";
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

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
    estDuration: ex.estimated_duration_min,
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

function defaultSlot(category: Category, tpl: WorkoutTemplate): TemplateSlot {
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

export function generate(input: GenerateInput): GenerationResult {
  const { groups, profile, template, library, history } = input;
  const byId = new Map(library.map((e) => [e.id, e]));
  const strengthGroups: CoachGroup[] = groups.filter((g) => g !== "Cardio");

  const pool = library.filter(
    (ex) => strengthGroups.includes(ex.muscle_group) && eligible(ex, profile),
  );
  const scored = pool
    .map((ex) => ({ ex, score: scoreExercise(ex, profile, history) }))
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));

  const items: GenItem[] = [];
  const used = new Set<string>();
  const usedGroups = new Set<string>();

  for (const slot of template.structure) {
    const candidates = scored.filter(
      (s) => s.ex.category === slot.category && !used.has(s.ex.id),
    );
    if (candidates.length === 0) continue;
    // Spread across selected groups: prefer a group not used yet, then by score.
    candidates.sort(
      (a, b) =>
        Number(usedGroups.has(a.ex.muscle_group)) -
          Number(usedGroups.has(b.ex.muscle_group)) ||
        b.score - a.score ||
        a.ex.name.localeCompare(b.ex.name),
    );
    const pick = candidates[0];
    used.add(pick.ex.id);
    usedGroups.add(pick.ex.muscle_group);
    const alts = buildAlternatives(pick.ex, slot, scored, used, byId, profile, history);
    items.push(toItem(pick.ex, slot, history, alts));
  }

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
  const poolItems = scored
    .filter((s) => !used.has(s.ex.id))
    .map((s) => toItem(s.ex, defaultSlot(s.ex.category, template), history));

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
  for (const s of scored) {
    if (s.ex.category !== slot.category) continue;
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
