// Typo-tolerant search over a small, fixed corpus (the exercise library).
//
// Deliberately not fuse.js: the corpus is ~250 short, known strings, and this
// app is built for bad connections — a generic search dependency costs more
// bundle than the whole feature. The scoring below is tuned for how people
// actually type exercise names: dropped vowels ("benchpres"), abbreviations
// ("incln dumbel"), words out of order, and plain misspellings ("sqaut").
//
// Every match kind returns a score in a distinct band, so ordering is stable
// and predictable: exact > prefix > substring > all-tokens > squashed-typo.

/** Lowercase, punctuation-free, single-spaced. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Damerau-Levenshtein distance, abandoned as soon as it exceeds `max`.
 *
 * Transpositions count as ONE edit, not two — "sqaut" for "squat" is the most
 * common way to mistype a word, and plain Levenshtein scores it the same as
 * two unrelated substitutions, which pushes it out of tolerance.
 *
 * Bounding matters: it turns the worst case from O(n*m) into a narrow band,
 * and it's also what keeps "curl" from matching "crunch" — beyond a couple of
 * edits, two exercise names are simply different exercises.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Three rows: i-2 is needed to price a transposition.
  let prev2: number[] = [];
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    // Nothing in this row is within budget, and rows only grow.
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
    cur = new Array<number>(b.length + 1);
  }
  return prev[b.length];
}

/**
 * Are all of `q`'s characters present in `text`, in order, starting at its
 * first character? Catches dropped vowels and gym shorthand — "dl" for
 * deadlift, "rdl" for romanian deadlift, "ohp" for overhead press.
 *
 * Returns the span consumed (lower = tighter, better), or -1 for no match.
 */
function subsequenceSpan(q: string, text: string): number {
  if (q.length === 0 || text.length === 0) return -1;
  if (q[0] !== text[0]) return -1; // anchored: avoids matching mid-word noise
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    while (ti < text.length && text[ti] !== q[qi]) ti++;
    if (ti >= text.length) return -1;
    ti++;
  }
  return ti;
}

/** How many edits to forgive in a token of this length. */
function tolerance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/**
 * Score `text` against `query`. 0 means no match; higher is better.
 * Both are expected pre-normalized by the caller for speed.
 */
export function scoreMatch(queryNorm: string, textNorm: string): number {
  if (!queryNorm) return 0;
  if (textNorm === queryNorm) return 1000;

  // Whole-string prefix: "bench p" -> "bench press". Shorter wins, so an exact
  // stem outranks a longer name that merely starts the same way.
  if (textNorm.startsWith(queryNorm)) {
    return 900 - Math.min(textNorm.length, 99);
  }
  const at = textNorm.indexOf(queryNorm);
  if (at >= 0) return 800 - at - Math.min(textNorm.length, 50);

  const qTokens = queryNorm.split(" ").filter(Boolean);
  const tTokens = textNorm.split(" ").filter(Boolean);

  // Every query token must find a home in the name — order-independent, so
  // "curl hammer" still finds "Hammer Curl".
  let total = 0;
  const used = new Set<number>();
  for (const q of qTokens) {
    let best = 0;
    let bestIdx = -1;
    for (let i = 0; i < tTokens.length; i++) {
      if (used.has(i)) continue;
      const t = tTokens[i];
      let s = 0;
      if (t === q) s = 100;
      else if (t.startsWith(q)) s = 90 - (t.length - q.length);
      else if (t.includes(q) && q.length >= 3) s = 60;
      else {
        const tol = tolerance(Math.max(q.length, 3));
        if (tol > 0) {
          const d = editDistance(q, t, tol);
          if (d <= tol) s = 70 - d * 15;
          else if (t.length > q.length && q.length >= 4) {
            // Typo inside an abbreviation: "dumbel" vs "dumbbell".
            const d2 = editDistance(q, t.slice(0, q.length + tol), tol);
            if (d2 <= tol) s = 55 - d2 * 15;
          }
        }
        if (s === 0 && q.length >= 2) {
          // Shorthand: "dl" -> deadlift, "pushdwn" -> pushdown.
          const span = subsequenceSpan(q, t);
          if (span > 0) s = 45 - Math.min(span - q.length, 10);
        }
      }
      // Earlier words in the name are more identifying.
      if (s > 0) s -= i * 2;
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    }
    if (best <= 0) {
      total = 0;
      break;
    }
    used.add(bestIdx);
    total += best;
  }
  if (total > 0) {
    // Reward covering more of the name; "curl" shouldn't beat "hammer curl"
    // when the query was "hammer curl".
    const coverage = used.size / tTokens.length;
    return 300 + total / qTokens.length + coverage * 40;
  }

  // Last resort: spaces collapsed, so "benchpres" reaches "bench press".
  const qSquash = queryNorm.replace(/ /g, "");
  const tSquash = textNorm.replace(/ /g, "");
  if (tSquash.startsWith(qSquash)) return 250;
  if (tSquash.includes(qSquash)) return 200;
  if (qSquash.length >= 4) {
    const tol = tolerance(qSquash.length);
    // Compare against the same-length head; a query is usually a prefix of the
    // full name, not the whole thing.
    const head = tSquash.slice(0, qSquash.length + tol);
    const d = editDistance(qSquash, head, tol);
    if (d <= tol) return 150 - d * 20;
  }
  if (qSquash.length >= 2) {
    // "rdl" across word boundaries -> romaniandeadlift.
    const span = subsequenceSpan(qSquash, tSquash);
    if (span > 0) return 120 - Math.min(span - qSquash.length, 20);
  }
  return 0;
}

export type Scored<T> = { item: T; score: number };

/** Rank `items` by how well `textOf(item)` matches `query`. */
export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  textOf: (item: T) => string,
  limit = 30,
): Scored<T>[] {
  const q = normalize(query);
  if (!q) return [];
  const out: Scored<T>[] = [];
  for (const item of items) {
    const score = scoreMatch(q, normalize(textOf(item)));
    if (score > 0) out.push({ item, score });
  }
  out.sort((a, b) => b.score - a.score || textOf(a.item).localeCompare(textOf(b.item)));
  return out.slice(0, limit);
}
