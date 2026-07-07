import type { Pr } from "@/lib/types";

// Groups raw `prs` rows (one row = one logged attempt) into one group per
// exercise, so the UI can show a single PR card with its full history.
// No schema change: history IS the existing rows.

const dateOf = (p: Pr) => p.achieved_date ?? p.created_at.slice(0, 10);

// True when `a` beats `b` (same unit type). Time: lower is better;
// kg/distance: higher is better, kg ties broken by reps.
export function isBetter(a: Pr, b: Pr): boolean {
  if (a.unit_type === "time") return a.value < b.value;
  if (a.value !== b.value) return a.value > b.value;
  return (a.reps ?? 0) > (b.reps ?? 0);
}

export type PrGroup = {
  key: string;
  best: Pr; // the PR
  latest: Pr; // most recent attempt
  entries: Pr[]; // chronological (oldest → newest)
  series: number[]; // values for the progress chart
  isNewPr: boolean; // the latest attempt set a new best
  delta: number | null; // latest.value − previous best value (raw, signed)
};

export function groupPrs(prs: Pr[]): PrGroup[] {
  const byKey = new Map<string, Pr[]>();
  for (const p of prs) {
    const key = `${p.exercise_name.trim().toLowerCase()}|${p.unit_type}`;
    const list = byKey.get(key);
    if (list) list.push(p);
    else byKey.set(key, [p]);
  }

  const groups: PrGroup[] = [];
  for (const [key, list] of byKey) {
    const entries = [...list].sort((a, b) => {
      const da = dateOf(a);
      const db = dateOf(b);
      if (da !== db) return da < db ? -1 : 1;
      return a.created_at < b.created_at ? -1 : 1;
    });

    let best = entries[0];
    for (const e of entries) if (isBetter(e, best)) best = e;

    const latest = entries[entries.length - 1];
    let prevBest: Pr | null = null;
    for (const e of entries.slice(0, -1))
      if (!prevBest || isBetter(e, prevBest)) prevBest = e;

    groups.push({
      key,
      best,
      latest,
      entries,
      series: entries.map((e) => e.value),
      isNewPr: prevBest != null && isBetter(latest, prevBest),
      delta: prevBest ? latest.value - prevBest.value : null,
    });
  }

  // Most recently active exercise first.
  groups.sort((a, b) => (dateOf(a.latest) > dateOf(b.latest) ? -1 : 1));
  return groups;
}
