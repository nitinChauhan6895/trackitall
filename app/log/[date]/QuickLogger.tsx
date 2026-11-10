"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CARDIO_FIELDS,
  CARDIO_FIELD_META,
  CARDIO_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  defaultCardioType,
  formatSeconds,
  parseDuration,
  parseTimeToSeconds,
  type CardioField,
  type CardioType,
  type Circuit,
  type Exercise,
  type MuscleGroup,
} from "@/lib/types";
import {
  deleteExerciseById,
  upsertExercise,
  type SetInput,
} from "@/app/actions";
import { libraryFor, type LibraryItem } from "@/lib/presets";
import { HIIT_EXERCISES, resolveHiitMetrics } from "@/lib/hiit";
import { enqueue, isOffline, removeQueuedOps } from "@/lib/offlineQueue";
import {
  addFavourite,
  favouriteKey,
  fetchFavourites,
  fetchLogContext,
  qk,
  removeFavourite,
  type FavouriteExercise,
  type MonthSummary,
} from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatWeekdayDayMonth } from "@/lib/dateFormat";
import { fuzzySearch } from "@/lib/fuzzy";

// Cardio "Exercise" dropdown options (JSON cardio names → field type).
const CARDIO_LIBRARY = libraryFor("cardio");

// Flat index over every group's presets for the add-sheet's global search.
// HIIT is excluded — it's a circuit builder, not a pickable exercise list.
const SEARCH_INDEX: { group: MuscleGroup; item: LibraryItem }[] =
  MUSCLE_GROUPS.filter((g) => g !== "hiit").flatMap((g) =>
    libraryFor(g).map((item) => ({ group: g, item })),
  );

type Mode = "cardio" | "hiit" | "strength";
function modeFor(g: MuscleGroup): Mode {
  if (g === "cardio") return "cardio";
  if (g === "hiit") return "hiit";
  return "strength";
}

/** DraftSet keys that hold a free-text value (excludes id and the hard flag). */
type DraftValueKey = Exclude<keyof DraftSet, "id" | "isHard" | "timeUnit">;

type FieldDesc = {
  draftKey: DraftValueKey;
  label: string;
  unit: string;
  kind: "number" | "time";
};

type DraftSet = {
  id: string;
  reps: string;
  weight: string;
  distance_km: string;
  distance_m: string;
  time: string;
  calories: string;
  incline: string;
  resistance: string;
  sets_count: string;
  height: string;
  floors: string;
  isHard: boolean;
  /** Unit for the `time` field. Cardio defaults to minutes; HIIT to seconds. */
  timeUnit: "seconds" | "minutes";
};

// Sync lifecycle: draft (local only / edited) → syncing → saved | error.
// "queued" = saved locally, waiting for the connection to sync (offline).
type SyncStatus = "draft" | "syncing" | "saved" | "error" | "queued";

type DraftExercise = {
  id: string;
  savedId?: string;
  group: MuscleGroup;
  name: string;
  cardioType: CardioType;
  sets: DraftSet[];
  collapsed: boolean;
  status: SyncStatus;
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptySet = (): DraftSet => ({
  id: uid(),
  reps: "",
  weight: "",
  distance_km: "",
  distance_m: "",
  time: "",
  calories: "",
  incline: "",
  resistance: "",
  sets_count: "",
  height: "",
  floors: "",
  isHard: false,
  timeUnit: "minutes",
});

// A fresh card for `group`. Strength starts with one empty set row;
// cardio & HIIT carry a single inline entry.
function newExercise(group: MuscleGroup, init?: Partial<DraftExercise>): DraftExercise {
  const mode = modeFor(group);
  const cardioType = init?.cardioType ?? defaultCardioType();
  const defaultName =
    mode === "cardio"
      ? CARDIO_TYPE_LABELS[cardioType]
      : mode === "hiit"
        ? HIIT_EXERCISES[0].name
        : "";
  return {
    id: uid(),
    group,
    name: defaultName,
    cardioType,
    sets: [emptySet()],
    collapsed: false,
    status: "draft",
    ...init,
  };
}

// Locale-independent: toLocaleDateString gave "Mon, Jul 20" on the server and
// "Mon 20 Jul" on the device, mismatching on hydration (see lib/dateFormat.ts).
const shortDate = formatWeekdayDayMonth;

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cardioDesc(f: CardioField): FieldDesc {
  const meta = CARDIO_FIELD_META[f];
  return {
    draftKey: f as DraftValueKey,
    label: meta.label,
    unit: meta.unit,
    kind: f === "time" ? "time" : "number",
  };
}

// Inline-entry field list for cardio/HIIT (strength uses set rows instead).
function fieldDescriptors(mode: Mode, ex: DraftExercise): FieldDesc[] {
  if (mode === "cardio") return CARDIO_FIELDS[ex.cardioType].map(cardioDesc);
  if (mode === "hiit")
    return resolveHiitMetrics(ex.name).map((m) => ({
      draftKey: m.draftKey,
      label: m.label,
      unit: m.unit,
      kind: m.kind,
    }));
  return [];
}

function setFromDraftKey(
  out: SetInput,
  key: DraftValueKey,
  raw: string,
  // Cardio durations are entered in minutes; HIIT interval times in seconds.
  timeBareUnit: "seconds" | "minutes",
) {
  switch (key) {
    case "reps": out.reps = num(raw); break;
    case "weight": out.weight_kg = num(raw); break;
    case "distance_km": out.distance_km = num(raw); break;
    case "distance_m": out.distance_m = num(raw); break;
    case "time": out.time_seconds = parseDuration(raw, timeBareUnit); break;
    case "calories": out.calories = num(raw); break;
    case "incline": out.incline = num(raw); break;
    case "resistance": out.resistance = num(raw); break;
    case "sets_count": out.sets_count = num(raw); break;
    case "height": out.height = num(raw); break;
    case "floors": out.floors = num(raw); break;
  }
}

function toSetInput(mode: Mode, ex: DraftExercise, s: DraftSet): SetInput {
  if (mode === "strength") {
    return { reps: num(s.reps), weight_kg: num(s.weight), is_hard: s.isHard };
  }
  const out: SetInput = {};
  // Cardio: the user picks min/sec (default minutes). HIIT intervals are seconds.
  const timeBareUnit = mode === "cardio" ? s.timeUnit : "seconds";
  for (const d of fieldDescriptors(mode, ex)) {
    setFromDraftKey(out, d.draftKey, s[d.draftKey], timeBareUnit);
  }
  return out;
}

function entryHasAny(mode: Mode, ex: DraftExercise, s: DraftSet): boolean {
  if (mode === "strength") return s.reps !== "" || s.weight !== "";
  return fieldDescriptors(mode, ex).some((d) => s[d.draftKey] !== "");
}

function exerciseHasContent(ex: DraftExercise): boolean {
  const mode = modeFor(ex.group);
  if (ex.name.trim() !== "") return true;
  return ex.sets.some((s) => entryHasAny(mode, ex, s));
}

function cardTitle(ex: DraftExercise): string {
  if (modeFor(ex.group) === "cardio")
    return ex.name.trim() || CARDIO_TYPE_LABELS[ex.cardioType];
  return ex.name.trim() || "New exercise";
}

// Compact one-line summary under the exercise title (e.g. "25 km · 100 kcal").
function summarizeExercise(ex: DraftExercise): string {
  const mode = modeFor(ex.group);
  if (mode === "strength") {
    const n = ex.sets.filter((s) => entryHasAny("strength", ex, s)).length;
    return n === 0 ? "No sets yet" : `${n} set${n === 1 ? "" : "s"}`;
  }
  const s = ex.sets[0];
  if (!s) return "Tap to add details";
  const parts: string[] = [];
  for (const d of fieldDescriptors(mode, ex)) {
    const v = s[d.draftKey];
    if (v === "") continue;
    if (d.kind === "time") {
      const secs = parseDuration(v, mode === "cardio" ? s.timeUnit : "seconds");
      parts.push(secs == null ? v : formatSeconds(secs));
    } else {
      parts.push(d.unit ? `${v} ${d.unit}` : `${d.label} ${v}`);
    }
  }
  return parts.length ? parts.join(" · ") : "Tap to add details";
}

// Build a draft set from a circuit exercise's stored target metrics.
function draftFromMetrics(metrics: Record<string, string | number>): DraftSet {
  const base = emptySet();
  for (const [k, v] of Object.entries(metrics)) {
    // Circuit metrics only ever carry the text fields; isHard is a per-set
    // judgement and must not come from a saved template.
    if (k === "isHard" || !(k in base)) continue;
    (base as unknown as Record<string, string>)[k] = String(v);
  }
  return base;
}

export default function QuickLogger({
  date,
  circuits = [],
}: {
  date: string;
  circuits?: Circuit[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DraftExercise[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  // Latest state for async callbacks + in-flight save promises.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const inflight = useRef(new Map<string, Promise<void>>());

  function update(id: string, patch: Partial<DraftExercise>) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function addExercises(group: MuscleGroup, inits: Partial<DraftExercise>[]) {
    const collapsed = inits.length > 1;
    setItems((prev) => [
      ...prev,
      ...inits.map((init) => newExercise(group, { collapsed, ...init })),
    ]);
  }

  // Search text and the open muscle group live here so the search bar can
  // narrow to that group's exercises while it's open.
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<MuscleGroup | null>(null);

  // Favourite exercises (per user). null = feature unavailable (migration 024
  // not run, or offline with nothing cached): the UI simply hides it.
  const { data: favourites } = useQuery({
    queryKey: qk.favourites(),
    queryFn: fetchFavourites,
    retry: false,
  });
  const favList = favourites ?? [];
  const favEnabled = Array.isArray(favourites);
  const favSet = new Set(favList.map((f) => favouriteKey(f.muscle_group, f.name)));

  async function toggleFavourite(group: MuscleGroup, name: string, cardioType?: string | null) {
    const key = favouriteKey(group, name);
    const on = favSet.has(key);
    const prev = queryClient.getQueryData<FavouriteExercise[] | null>(qk.favourites());
    queryClient.setQueryData<FavouriteExercise[] | null>(qk.favourites(), (old) => {
      const list = old ?? [];
      return on
        ? list.filter((f) => favouriteKey(f.muscle_group, f.name) !== key)
        : [...list, { muscle_group: group, name: name.trim(), cardio_type: cardioType ?? null }];
    });
    try {
      if (on) await removeFavourite(group, name);
      else await addFavourite({ muscle_group: group, name, cardio_type: cardioType ?? null });
    } catch {
      queryClient.setQueryData(qk.favourites(), prev);
    } finally {
      queryClient.invalidateQueries({ queryKey: qk.favourites() });
    }
  }

  // Last-trained dates and the previous session. Offline or signed out this
  // simply stays empty: tiles read "Not trained yet" and Quick start hides.
  const { data: context } = useQuery({
    queryKey: qk.logContext(date),
    queryFn: () => fetchLogContext(date),
    retry: false,
  });

  // Quick start: the previous session's exercises and sets become drafts the
  // user edits; nothing is saved until they save a card or tap Done.
  function repeatPrevious() {
    const prev = context?.previous;
    if (!prev) return;
    setItems((cur) => [...cur, ...prev.exercises.map(draftFromSaved)]);
  }

  // Load a saved circuit's exercises as HIIT draft cards.
  function loadCircuit(c: Circuit) {
    addExercises(
      "hiit",
      c.exercises.map((ce) => ({
        name: ce.name,
        sets: [draftFromMetrics(ce.metrics)],
        collapsed: true,
      })),
    );
  }

  // Optimistic save: collapse instantly, sync in the background.
  function saveExercise(id: string): Promise<void> | undefined {
    const ex = itemsRef.current.find((e) => e.id === id);
    if (!ex || ex.status === "syncing") return inflight.current.get(id);
    const mode = modeFor(ex.group);
    const name =
      ex.name.trim() || (mode === "cardio" ? CARDIO_TYPE_LABELS[ex.cardioType] : "");
    if (!name) return;

    update(id, { collapsed: true, status: "syncing", name });
    const payload = {
      id: ex.savedId,
      date,
      muscle_group: ex.group,
      cardio_type: mode === "cardio" ? ex.cardioType : null,
      name,
      sets: ex.sets.map((s) => toSetInput(mode, ex, s)),
    };
    const p = upsertExercise(payload)
      .then(({ id: savedId }) => {
        update(id, { savedId, status: "saved" });
      })
      .catch(async () => {
        // Offline → keep the write, sync on reconnect. Genuine error → surface.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          // replaceKey: saving this draft again while still offline must
          // REPLACE the queued op — the draft has no server id, so a second
          // queued upsert would insert a duplicate when the queue syncs.
          await enqueue("upsertExercise", payload, { replaceKey: ex.id });
          // Write it into the day's local cache too, so the day view shows the
          // exercise straight away instead of looking empty until it syncs.
          queryClient.setQueryData<Exercise[]>(qk.day(date), (prev) => {
            const pending: Exercise = {
              id: `pending-${ex.id}`,
              user_id: "",
              workout_date: date,
              muscle_group: ex.group,
              name,
              cardio_type: mode === "cardio" ? ex.cardioType : null,
              position: (prev?.length ?? 0) + 1,
              created_at: new Date().toISOString(),
              sets: payload.sets.map((s, i) => ({
                id: `pending-${ex.id}-${i}`,
                position: i,
                reps: s.reps ?? null,
                weight_kg: s.weight_kg ?? null,
                distance_km: s.distance_km ?? null,
                distance_m: s.distance_m ?? null,
                speed_kmh: s.speed_kmh ?? null,
                time_seconds: s.time_seconds ?? null,
                calories: s.calories ?? null,
                incline: s.incline ?? null,
                resistance: s.resistance ?? null,
                sets_count: s.sets_count ?? null,
                height: s.height ?? null,
                floors: s.floors ?? null,
              })),
            } as Exercise;
            const rest = (prev ?? []).filter((e) => e.id !== pending.id);
            return [...rest, pending];
          });
          // And the home calendar's month summary, so the day fills in even
          // before the queue syncs.
          const [yy, mm] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
          queryClient.setQueryData<MonthSummary>(qk.month(yy, mm), (prev) => {
            const cur = prev?.[date] ?? [];
            if (cur.includes(ex.group)) return prev;
            return { ...(prev ?? {}), [date]: [...cur, ex.group] };
          });
          update(id, { status: "queued" });
        } else {
          update(id, { status: "error" });
        }
      })
      .finally(() => {
        inflight.current.delete(id);
      });
    inflight.current.set(id, p);
    return p;
  }

  function removeExercise(ex: DraftExercise) {
    // Optimistic removal; the server delete runs in the background.
    setItems((prev) => prev.filter((e) => e.id !== ex.id));

    if (ex.status === "queued") {
      // Never reached the server — cancel the queued insert (or syncing would
      // resurrect it) and drop its pending entry from the day cache.
      removeQueuedOps(ex.id).catch(() => {});
      queryClient.setQueryData<Exercise[]>(qk.day(date), (prev) =>
        (prev ?? []).filter((e) => e.id !== `pending-${ex.id}`),
      );
    }

    if (ex.savedId) {
      deleteExerciseById(ex.savedId, date).catch(() => {
        // Offline: queue the delete, or the exercise comes back on next sync.
        if (isOffline()) {
          enqueue("deleteExercise", { id: ex.savedId, date }).catch(() => {});
        }
      });
    }
  }

  async function finish() {
    setFinishing(true);
    setFinishError("");

    // Kick off any open card that still has content, then wait for everything.
    const done = new Set<SyncStatus>(["saved", "syncing", "queued"]);
    for (const ex of itemsRef.current) {
      if (!done.has(ex.status) && exerciseHasContent(ex)) {
        saveExercise(ex.id);
      }
    }
    await Promise.allSettled(Array.from(inflight.current.values()));

    if (itemsRef.current.some((e) => e.status === "error")) {
      setFinishError("Some exercises couldn't be saved — tap them to retry.");
      setFinishing(false);
      return;
    }
    // Queued items count as saved — they'll sync on reconnect.
    const savedAny = itemsRef.current.some((e) => e.savedId || e.status === "queued");
    router.push(savedAny ? `/day/${date}` : "/");
    router.refresh();
  }

  // Group cards into sections following the canonical muscle-group order.
  const groupsInUse = MUSCLE_GROUPS.filter((g) => items.some((e) => e.group === g));
  const isToday = date === toDateKey(new Date());
  const previous = context?.previous ?? null;

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-12 safe-top">
      {/* Top bar */}
      <div className="flex items-center gap-3 pt-4">
        <button type="button" onClick={() => router.back()} aria-label="Back" className={GLASS_BUTTON + " w-11 shrink-0 text-ink"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold">Log workout</span>
          <span className="text-[13px] text-muted">{shortDate(date)}</span>
        </div>
        <button
          type="button"
          onClick={finish}
          disabled={finishing}
          className={GLASS_BUTTON + " px-[18px] text-[15px] font-semibold text-green disabled:opacity-60"}
        >
          {finishing ? "Saving…" : "Done"}
        </button>
      </div>
      {finishError && <p className="-mt-2 text-center text-sm font-medium text-gold">{finishError}</p>}

      {/* Headline */}
      <header className="flex flex-col gap-1.5 px-1 pt-1">
        <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">
          What did you
          <br />
          <span className="text-green">{isToday ? "train today?" : "train that day?"}</span>
        </h1>
        <p className="text-sm text-muted">Pick a muscle group or search the library.</p>
      </header>

      <ExerciseSearch
        query={query}
        onQuery={setQuery}
        scope={openGroup}
        onAdd={(g, init) => addExercises(g, [init])}
      />

      {/* Favourites: one tap adds the exercise to this log. Always shown (when
          the feature is available) so it's discoverable; empty -> a hint. */}
      {favEnabled && !query.trim() && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">FAVOURITES</span>
            {favList.length > 0 && <span className="text-xs text-subtle">tap to add</span>}
          </div>
          {favList.length === 0 ? (
            <p className="flex items-start gap-2.5 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-[13px] leading-[1.45] text-muted">
              <span aria-hidden className="mt-[5px] h-2 w-2 shrink-0 rounded-full border-[1.5px] border-[#6E6E6E]" />
              <span>
                Tap <span className="font-semibold text-ink">Add to favourites</span> on an exercise to pin it here for one-tap adding.
              </span>
            </p>
          ) : (
          <div className="flex flex-wrap gap-2">
            {favList.map((f) => (
              <button
                key={favouriteKey(f.muscle_group, f.name)}
                type="button"
                onClick={() =>
                  addExercises(f.muscle_group, [
                    f.cardio_type ? { name: f.name, cardioType: f.cardio_type as CardioType } : { name: f.name },
                  ])
                }
                aria-label={`Add ${f.name}`}
                className="elevation-1 pressable flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                {f.name}
              </button>
            ))}
          </div>
          )}
        </section>
      )}

      {/* Today's log */}
      {items.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-semibold">{isToday ? "Today's log" : "This day's log"}</h2>
            <span className="text-[13px] text-muted">
              {items.length} {items.length === 1 ? "exercise" : "exercises"}
            </span>
          </div>
          {groupsInUse.map((g) => (
            <div key={g} className="flex flex-col gap-3">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{MUSCLE_GROUP_LABELS[g]}</h3>
              {items
                .filter((e) => e.group === g)
                .map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    onChange={(patch) => update(ex.id, patch)}
                    onSave={() => saveExercise(ex.id)}
                    onRemove={() => removeExercise(ex)}
                    favourite={favSet.has(favouriteKey(ex.group, ex.name))}
                    onToggleFavourite={
                      favEnabled && modeFor(ex.group) !== "hiit" && ex.name.trim()
                        ? () => toggleFavourite(ex.group, ex.name, ex.cardioType)
                        : undefined
                    }
                  />
                ))}
            </div>
          ))}
        </section>
      )}

      {/* Quick start: repeat the previous session. Hidden once the log has
          exercises (it's a starting point) or when there's nothing to repeat. */}
      {previous && items.length === 0 && (
        <section className="elevation-1 flex items-center gap-3.5 rounded-3xl py-4 pl-[18px] pr-4">
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">QUICK START</span>
            <span className="text-base font-semibold">Repeat {shortDate(previous.date)}</span>
            <span className="text-[13px] text-muted">{sessionSummary(previous.exercises)}</span>
          </span>
          <button
            type="button"
            onClick={repeatPrevious}
            className="h-11 shrink-0 rounded-full bg-green px-[18px] text-sm font-semibold text-ink-inverse transition active:scale-95"
          >
            Repeat
          </button>
        </section>
      )}

      <MuscleGroups
        date={date}
        lastTrained={context?.lastTrained ?? {}}
        group={openGroup}
        onGroup={(g) => {
          setOpenGroup(g);
          setQuery("");
        }}
        query={query}
        favSet={favSet}
        circuits={circuits}
        onAdd={(g, init) => addExercises(g, [init])}
        onLoadCircuit={loadCircuit}
      />

      <p className="text-center text-xs text-subtle">Exercises save automatically</p>
    </main>
  );
}

const GLASS_BUTTON =
  "elevation-3 flex h-11 items-center justify-center rounded-full bg-white/[0.08] active:bg-white/15";

// "6 exercises · 16 sets · 5 muscles"
function sessionSummary(exercises: Exercise[]): string {
  const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const muscles = new Set(exercises.map((e) => e.muscle_group)).size;
  const p = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return `${p(exercises.length, "exercise")} · ${p(sets, "set")} · ${p(muscles, "muscle")}`;
}

// A saved exercise as an unsaved draft card, for Repeat. Every stored metric
// carries over; times come back in seconds so nothing is reinterpreted.
function draftFromSaved(e: Exercise): DraftExercise {
  const str = (v: number | null | undefined) => (v == null ? "" : String(v));
  const sets = e.sets.map((s) => ({
    ...emptySet(),
    reps: str(s.reps),
    weight: str(s.weight_kg),
    distance_km: str(s.distance_km),
    distance_m: str(s.distance_m),
    time: str(s.time_seconds),
    timeUnit: "seconds" as const,
    calories: str(s.calories),
    incline: str(s.incline),
    resistance: str(s.resistance),
    sets_count: str(s.sets_count),
    height: str(s.height),
    floors: str(s.floors),
  }));
  return newExercise(e.muscle_group, {
    name: e.name,
    cardioType: e.cardio_type ?? defaultCardioType(),
    sets: sets.length ? sets : [emptySet()],
    collapsed: true,
  });
}

// "Today", "Yesterday", "3 days ago"; a week or more is "Not this week".
function lastTrainedLabel(last: string | undefined, date: string): { text: string; stale: boolean } {
  if (!last) return { text: "Not trained yet", stale: true };
  const days = Math.round((Date.parse(date) - Date.parse(last)) / 86400000);
  if (days <= 0) return { text: "Today", stale: false };
  if (days === 1) return { text: "Yesterday", stale: false };
  if (days < 7) return { text: `${days} days ago`, stale: false };
  return { text: "Not this week", stale: true };
}

const SEARCH_CLASS =
  "elevation-1 flex h-14 items-center gap-3 rounded-[18px] px-[18px] focus-within:border-green/60";

// Library search across every group. A miss offers to add the text as a
// custom exercise under a chosen muscle group.
function ExerciseSearch({
  query,
  onQuery: setQuery,
  scope,
  onAdd,
}: {
  query: string;
  onQuery: (q: string) => void;
  /** An open muscle group: the search then filters that group's list below. */
  scope: MuscleGroup | null;
  onAdd: (group: MuscleGroup, init: Partial<DraftExercise>) => void;
}) {
  const [pickingGroup, setPickingGroup] = useState(false);
  const q = scope ? "" : query.trim();
  // Typo-tolerant: "benchpres", "sqaut" and "rdl" all find their exercise.
  const results = q ? fuzzySearch(SEARCH_INDEX, q, (e) => e.item.name, 30).map((r) => r.item) : [];

  function add(group: MuscleGroup, init: Partial<DraftExercise>) {
    onAdd(group, init);
    setQuery("");
    setPickingGroup(false);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label className={SEARCH_CLASS}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">{scope ? `Search ${MUSCLE_GROUP_LABELS[scope]} exercises` : "Search all exercises"}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPickingGroup(false);
          }}
          placeholder={scope ? `Search ${MUSCLE_GROUP_LABELS[scope]} exercises…` : "Search all exercises…"}
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
      </label>

      {q && (
        <ul className="flex flex-col gap-2.5">
          {results.length > 0 && (
            <li>
              <ul className="elevation-1 flex flex-col rounded-3xl">
                {results.map(({ group: g, item }) => (
                  <li key={`${g}:${item.name}`} className="border-b border-surface-2 last:border-0">
                    <button
                      type="button"
                      onClick={() => add(g, item.cardioType ? { name: item.name, cardioType: item.cardioType } : { name: item.name })}
                      className="flex w-full items-center gap-3 py-3 pl-[18px] pr-3 text-left active:bg-white/[0.04]"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="truncate text-[15px] font-semibold text-ink">{item.name}</span>
                        <span className="text-xs text-muted">{MUSCLE_GROUP_LABELS[g]}</span>
                      </span>
                      <span className="elevation-2 flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold text-green">
                        Add
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          )}
          {results.length === 0 && (
            <li className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPickingGroup((v) => !v)}
                aria-expanded={pickingGroup}
                className="elevation-1 pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
              >
                <span className="min-w-0 flex-1 text-[15px] text-ink">
                  Add <span className="font-semibold">“{q}”</span> as a custom exercise
                </span>
                <PlusMark />
              </button>
              {pickingGroup && (
                <div className="flex flex-col gap-2 px-1">
                  <span className="text-xs text-muted">Which muscle group?</span>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLE_GROUPS.filter((g) => modeFor(g) === "strength").map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => add(g, { name: q })}
                        className="elevation-2 rounded-full px-3.5 py-2 text-sm text-ink active:bg-white/10"
                      >
                        {MUSCLE_GROUP_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function PlusMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="shrink-0 text-green">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// Muscle-group tiles with how long ago each was trained. Tapping one shows
// its exercise library in place; each exercise adds with one tap.
function MuscleGroups({
  date,
  lastTrained,
  group,
  onGroup: setGroup,
  query,
  favSet,
  circuits,
  onAdd,
  onLoadCircuit,
}: {
  date: string;
  lastTrained: Partial<Record<MuscleGroup, string>>;
  group: MuscleGroup | null;
  onGroup: (g: MuscleGroup | null) => void;
  /** The search bar's text: narrows the open group's list. */
  query: string;
  favSet: Set<string>;
  circuits: Circuit[];
  onAdd: (group: MuscleGroup, init: Partial<DraftExercise>) => void;
  onLoadCircuit: (c: Circuit) => void;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());

  if (group) {
    const mode = modeFor(group);
    const q = query.trim();
    const library = libraryFor(group);
    // Typed text filters this group only; favourites come first either way.
    const matched = q ? fuzzySearch(library, q, (i) => i.name, 60).map((r) => r.item) : library;
    const list = [...matched].sort(
      (a, b) => Number(favSet.has(favouriteKey(group, b.name))) - Number(favSet.has(favouriteKey(group, a.name))),
    );
    const canAddCustom = mode === "strength" && q !== "" && !library.some((i) => i.name.toLowerCase() === q.toLowerCase());
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => {
              setGroup(null);
              setAdded(new Set());
            }}
            className="flex items-center gap-1 text-sm font-semibold text-green active:opacity-70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All groups
          </button>
        </div>
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-xl font-semibold">{MUSCLE_GROUP_LABELS[group]}</h2>
          <span className="text-xs text-muted">{q ? `${list.length} ${list.length === 1 ? "match" : "matches"}` : "tap to add"}</span>
        </div>
        {mode === "hiit" && !q && <CircuitPanel circuits={circuits} onLoadCircuit={onLoadCircuit} />}
        {list.length === 0 ? (
          !canAddCustom && (
            <p className="rounded-3xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
              No {MUSCLE_GROUP_LABELS[group]} exercises match &ldquo;{q}&rdquo;.
            </p>
          )
        ) : (
        <ul className="elevation-1 flex flex-col rounded-3xl">
          {list.map((item) => {
            const on = added.has(item.name);
            const fav = favSet.has(favouriteKey(group, item.name));
            return (
              <li key={item.name} className="border-b border-surface-2 last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    onAdd(group, item.cardioType ? { name: item.name, cardioType: item.cardioType } : { name: item.name });
                    setAdded((prev) => new Set(prev).add(item.name));
                  }}
                  className="flex w-full items-center justify-between gap-3 px-[18px] py-3.5 text-left active:bg-white/[0.04]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-ink">{item.name}</span>
                    {fav && <span role="img" aria-label="Favourite" className="h-[7px] w-[7px] shrink-0 rounded-full bg-gold" />}
                  </span>
                  {on ? <span className="shrink-0 text-xs font-semibold text-green">Added</span> : <PlusMark />}
                </button>
              </li>
            );
          })}
        </ul>
        )}
        {canAddCustom && (
          <button
            type="button"
            onClick={() => {
              onAdd(group, { name: q });
              setAdded((prev) => new Set(prev).add(q));
            }}
            className="elevation-1 pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <span className="min-w-0 flex-1 text-[15px] text-ink">
              Add <span className="font-semibold">&ldquo;{q}&rdquo;</span> as a custom {MUSCLE_GROUP_LABELS[group]} exercise
            </span>
            {added.has(q) ? <span className="shrink-0 text-xs font-semibold text-green">Added</span> : <PlusMark />}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl font-semibold">Muscle groups</h2>
        <span className="text-xs text-muted">last trained</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {MUSCLE_GROUPS.map((g) => {
          const { text, stale } = lastTrainedLabel(lastTrained[g], date);
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={[
                "elevation-1 pressable flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-[22px] p-4 text-left",
                // Not trained this week: gold border + faint gold tint.
                stale ? "!border-gold/40 !bg-gold-faint" : "",
              ].join(" ")}
            >
              <span className="font-display text-xl font-semibold leading-tight">{MUSCLE_GROUP_LABELS[g]}</span>
              <span className="text-xs text-muted">{text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Exercise card ----------

function StatusChip({ status }: { status: SyncStatus }) {
  if (status === "syncing")
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" /> Saving
      </span>
    );
  if (status === "saved")
    return <span className="text-xs font-semibold text-green">✓ Saved</span>;
  if (status === "queued")
    return <span className="text-xs font-semibold text-gold">◷ Offline</span>;
  if (status === "error")
    return <span className="text-xs font-semibold text-gold">! Retry</span>;
  return null;
}

function ExerciseCard({
  ex,
  onChange,
  onSave,
  onRemove,
  favourite = false,
  onToggleFavourite,
}: {
  ex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
  onSave: () => void;
  onRemove: () => void;
  favourite?: boolean;
  /** Absent when favourites aren't available for this card. */
  onToggleFavourite?: () => void;
}) {
  const mode = modeFor(ex.group);
  const favToggle = onToggleFavourite ? <FavouriteToggle on={favourite} onClick={onToggleFavourite} /> : null;
  const expanded = !ex.collapsed;
  // Strength needs a typed name; cardio/HIIT derive their name automatically.
  const canSave =
    exerciseHasContent(ex) && (mode !== "strength" || ex.name.trim() !== "");

  return (
    <div
      className={[
        "elevation-1 flex flex-col overflow-hidden rounded-3xl",
        ex.status === "error" ? "!border-gold/60" : expanded ? "!border-green/35" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onChange({ collapsed: expanded })}
        aria-expanded={expanded}
        className={["flex w-full items-center gap-3 pl-[18px] pr-4 pt-4 text-left", expanded ? "pb-3.5" : "pb-4"].join(" ")}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-xl font-semibold text-ink">{cardTitle(ex)}</span>
            {favourite && <span role="img" aria-label="Favourite" className="h-[7px] w-[7px] shrink-0 rounded-full bg-gold" />}
          </span>
          <span className="truncate text-[13px] text-muted">{summarizeExercise(ex)}</span>
        </span>
        <StatusChip status={ex.status} />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-muted">
          <path d={expanded ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3.5 px-4 pb-4">
          <ExerciseForm mode={mode} ex={ex} onChange={onChange} footerExtra={favToggle} />
          {mode !== "strength" && favToggle && <div className="-my-1 flex justify-end">{favToggle}</div>}

          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5 border-t border-white/[0.08] pt-3.5">
            <button
              type="button"
              onClick={onRemove}
              className="h-12 rounded-full border border-white/[0.12] text-[15px] font-semibold text-[#D4D4D4] active:bg-white/[0.06]"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={!canSave || ex.status === "syncing"}
              onClick={onSave}
              className="h-12 rounded-full bg-green text-[15px] font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
            >
              {ex.savedId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Entry form (shared with all modes) ----------

const SELECT_CLASS =
  "h-12 w-full appearance-none rounded-[14px] border border-white/[0.04] bg-surface-2 px-3.5 pr-9 text-base font-medium text-ink outline-none focus:border-green";
const INPUT_CLASS =
  "h-12 w-full rounded-[14px] border border-white/[0.04] bg-surface-2 px-3.5 text-base font-medium text-ink outline-none placeholder:text-subtle focus:border-green";

function ExerciseForm({
  mode,
  ex,
  onChange,
  footerExtra,
}: {
  mode: Mode;
  ex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
  /** Shown at the end of the Add set row (strength only). */
  footerExtra?: React.ReactNode;
}) {
  // Cardio/HIIT keep a single inline entry bound to sets[0].
  const entry = ex.sets[0] ?? emptySet();
  function patchEntry(key: DraftValueKey, value: string) {
    const next = { ...entry, [key]: value };
    onChange({ sets: [next, ...ex.sets.slice(1)], status: "draft" });
  }
  function setTimeUnit(timeUnit: "seconds" | "minutes") {
    onChange({ sets: [{ ...entry, timeUnit }, ...ex.sets.slice(1)], status: "draft" });
  }

  const descriptors = fieldDescriptors(mode, ex);

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Exercise">
        {mode === "cardio" ? (
          <SelectField
            value={ex.name}
            onChange={(v) => {
              const item = CARDIO_LIBRARY.find((i) => i.name === v);
              onChange({
                name: v,
                cardioType: item?.cardioType ?? "generic",
                status: "draft",
              });
            }}
            options={CARDIO_LIBRARY.map((i) => ({ value: i.name, label: i.name }))}
          />
        ) : mode === "hiit" ? (
          <SelectField
            value={ex.name}
            onChange={(v) => onChange({ name: v, status: "draft" })}
            options={HIIT_EXERCISES.map((e) => ({ value: e.name, label: e.name }))}
          />
        ) : (
          <input
            value={ex.name}
            onChange={(e) => onChange({ name: e.target.value, status: "draft" })}
            placeholder="e.g. Bench press"
            className={INPUT_CLASS}
          />
        )}
      </Field>

      {mode === "strength" ? (
        <StrengthSets
          sets={ex.sets}
          onChange={(sets) => onChange({ sets, status: "draft" })}
          footerExtra={footerExtra}
        />
      ) : (
        descriptors.map((d, i) => {
          const isTime = d.kind === "time";
          // Cardio duration gets an explicit min/sec selector so there's no
          // guessing about what a bare number means.
          const isCardioTime = isTime && mode === "cardio";
          return (
            <Field key={d.draftKey} label={d.label} optional={i > 0}>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                  <input
                    value={entry[d.draftKey]}
                    onChange={(e) => patchEntry(d.draftKey, e.target.value)}
                    type={isTime && !isCardioTime ? "text" : "number"}
                    inputMode={isTime && !isCardioTime ? "text" : "decimal"}
                    min={isTime && !isCardioTime ? undefined : 0}
                    placeholder={
                      isCardioTime
                        ? entry.timeUnit === "minutes"
                          ? "e.g. 30"
                          : "e.g. 90"
                        : isTime
                          ? "hh:mm:ss"
                          : "0"
                    }
                    className={`${INPUT_CLASS} ${d.unit ? "pr-12" : ""}`}
                  />
                  {d.unit && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                      {d.unit}
                    </span>
                  )}
                </div>
                {isCardioTime && (
                  <div className="flex shrink-0 overflow-hidden rounded-[14px] border border-white/10">
                    {(["minutes", "seconds"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setTimeUnit(u)}
                        aria-pressed={entry.timeUnit === u}
                        className={[
                          "px-3 text-sm font-semibold transition",
                          entry.timeUnit === u
                            ? "bg-green text-ink-inverse"
                            : "text-muted active:bg-white/10",
                        ].join(" ")}
                      >
                        {u === "minutes" ? "min" : "sec"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          );
        })
      )}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle">
        {label.toUpperCase()}
        {optional && <span className="font-normal normal-case tracking-normal"> (optional)</span>}
      </span>
      {children}
    </label>
  );
}

function StrengthSets({
  sets,
  onChange,
  footerExtra,
}: {
  sets: DraftSet[];
  onChange: (sets: DraftSet[]) => void;
  footerExtra?: React.ReactNode;
}) {
  const inputClass =
    "h-12 w-full min-w-0 rounded-xl border border-white/[0.04] bg-surface-2 px-3 font-display text-lg font-semibold text-ink outline-none placeholder:text-subtle focus:border-[1.5px] focus:border-green";

  function patch(id: string, key: keyof DraftSet, value: string | boolean) {
    onChange(sets.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  // One-tap repeat of the previous set's numbers.
  function duplicateLast() {
    const last = sets[sets.length - 1];
    const next = emptySet();
    if (last) {
      next.reps = last.reps;
      next.weight = last.weight;
      // isHard deliberately not copied: whether a set was taken to failure is
      // a judgement about that set, not a property of the template.
    }
    onChange([...sets, next]);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <div className={SET_GRID + " px-0.5 text-[11px] font-semibold tracking-[0.08em] text-subtle"} aria-hidden>
          <span>SET</span>
          <span>REPS</span>
          <span>KG</span>
          <span />
          <span />
        </div>
        {sets.map((s, i) => (
          <div key={s.id} className={SET_GRID + " items-center"}>
            <span className="text-center font-display text-[15px] font-semibold text-green">{i + 1}</span>
            <input
              value={s.reps}
              onChange={(e) => patch(s.id, "reps", e.target.value)}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              aria-label={`Set ${i + 1} reps`}
              className={inputClass}
            />
            <input
              value={s.weight}
              onChange={(e) => patch(s.id, "weight", e.target.value)}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              placeholder="0"
              aria-label={`Set ${i + 1} weight in kg`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => patch(s.id, "isHard", !s.isHard)}
              aria-pressed={s.isHard}
              aria-label={`Set ${i + 1}: ${s.isHard ? "hard set" : "mark as hard set"}`}
              title="Hard set — taken to or near failure"
              className={[
                "h-[34px] rounded-[10px] border text-[11px] font-bold tracking-[0.04em] transition active:scale-95",
                s.isHard ? "border-gold bg-gold-soft text-gold" : "border-white/10 text-muted",
              ].join(" ")}
            >
              HARD
            </button>
            <button
              type="button"
              onClick={() => onChange(sets.filter((x) => x.id !== s.id))}
              aria-label={`Remove set ${i + 1}`}
              className="flex h-11 w-8 items-center justify-center text-subtle active:text-gold"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([...sets, emptySet()])}
          className="elevation-2 h-10 rounded-full px-4 text-sm font-semibold text-green active:scale-95"
        >
          Add set
        </button>
        {sets.some((s) => s.reps !== "" || s.weight !== "") && (
          <button
            type="button"
            onClick={duplicateLast}
            className="h-10 rounded-full px-4 text-sm font-semibold text-muted active:opacity-70"
          >
            Repeat last
          </button>
        )}
        {footerExtra && <div className="ml-auto">{footerExtra}</div>}
      </div>
    </div>
  );
}

/** Quiet text toggle from the design: hollow grey dot when off, gold dot when on. */
function FavouriteToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={[
        "flex h-11 items-center gap-2 pl-2.5 pr-0.5 text-[13px] font-medium active:opacity-70",
        on ? "text-[#D4D4D4]" : "text-subtle",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "h-2 w-2 shrink-0 rounded-full",
          on ? "bg-gold" : "border-[1.5px] border-[#6E6E6E]",
        ].join(" ")}
      />
      {on ? "Favourite" : "Add to favourites"}
    </button>
  );
}

const SET_GRID = "grid grid-cols-[24px_1fr_1fr_58px_32px] gap-2";

function CircuitPanel({
  circuits,
  onLoadCircuit,
}: {
  circuits: Circuit[];
  onLoadCircuit: (c: Circuit) => void;
}) {
  return (
    <div className="rounded-2xl elevation-1 p-3">
      <Link
        href="/circuits/new"
        className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-green/50 px-4 py-3 text-center active:bg-green-tint"
      >
        <span aria-hidden className="text-xl text-green">
          ⊕
        </span>
        <span className="text-sm font-semibold text-green">Create Circuit</span>
      </Link>

      {circuits.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            My circuits
          </p>
          <ul className="space-y-2">
            {circuits.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5"
              >
                <span aria-hidden className="text-lg">
                  ⚡
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c.exercises.length} exercise
                    {c.exercises.length === 1 ? "" : "s"} · {c.set_times.length} set
                    {c.set_times.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadCircuit(c)}
                  className="shrink-0 rounded-lg bg-green px-3 py-1.5 text-sm font-bold text-ink-inverse active:scale-95"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
