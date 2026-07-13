"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CARDIO_FIELDS,
  CARDIO_FIELD_META,
  CARDIO_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  defaultCardioType,
  formatSeconds,
  parseTimeToSeconds,
  type CardioField,
  type CardioType,
  type Circuit,
  type MuscleGroup,
} from "@/lib/types";
import {
  deleteExerciseById,
  upsertExercise,
  type SetInput,
} from "@/app/actions";
import { libraryFor, type LibraryItem } from "@/lib/presets";
import { HIIT_EXERCISES, resolveHiitMetrics } from "@/lib/hiit";
import MuscleIcon, { MUSCLE_TONE } from "@/components/MuscleIcon";

// Cardio "Exercise" dropdown options (JSON cardio names → field type).
const CARDIO_LIBRARY = libraryFor("cardio");

type Mode = "cardio" | "hiit" | "strength";
function modeFor(g: MuscleGroup): Mode {
  if (g === "cardio") return "cardio";
  if (g === "hiit") return "hiit";
  return "strength";
}

type FieldDesc = {
  draftKey: keyof DraftSet;
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
};

// Sync lifecycle: draft (local only / edited) → syncing → saved | error.
type SyncStatus = "draft" | "syncing" | "saved" | "error";

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

function shortDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cardioDesc(f: CardioField): FieldDesc {
  const meta = CARDIO_FIELD_META[f];
  return {
    draftKey: f as keyof DraftSet,
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

function setFromDraftKey(out: SetInput, key: keyof DraftSet, raw: string) {
  switch (key) {
    case "reps": out.reps = num(raw); break;
    case "weight": out.weight_kg = num(raw); break;
    case "distance_km": out.distance_km = num(raw); break;
    case "distance_m": out.distance_m = num(raw); break;
    case "time": out.time_seconds = parseTimeToSeconds(raw); break;
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
    return { reps: num(s.reps), weight_kg: num(s.weight) };
  }
  const out: SetInput = {};
  for (const d of fieldDescriptors(mode, ex)) {
    setFromDraftKey(out, d.draftKey, s[d.draftKey]);
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
      const secs = parseTimeToSeconds(v);
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
    if (k in base) (base as Record<string, string>)[k] = String(v);
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
  const [items, setItems] = useState<DraftExercise[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    setSheetOpen(false);
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
    const p = upsertExercise({
      id: ex.savedId,
      date,
      muscle_group: ex.group,
      cardio_type: mode === "cardio" ? ex.cardioType : null,
      name,
      sets: ex.sets.map((s) => toSetInput(mode, ex, s)),
    })
      .then(({ id: savedId }) => {
        update(id, { savedId, status: "saved" });
      })
      .catch(() => {
        update(id, { status: "error" });
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
    if (ex.savedId) deleteExerciseById(ex.savedId, date).catch(() => {});
  }

  async function finish() {
    setFinishing(true);
    setFinishError("");

    // Kick off any open card that still has content, then wait for everything.
    for (const ex of itemsRef.current) {
      if (ex.status !== "saved" && ex.status !== "syncing" && exerciseHasContent(ex)) {
        saveExercise(ex.id);
      }
    }
    await Promise.allSettled(Array.from(inflight.current.values()));

    if (itemsRef.current.some((e) => e.status === "error")) {
      setFinishError("Some exercises couldn't be saved — tap them to retry.");
      setFinishing(false);
      return;
    }
    const savedAny = itemsRef.current.some((e) => e.savedId);
    router.push(savedAny ? `/day/${date}` : "/");
    router.refresh();
  }

  // Group cards into sections following the canonical muscle-group order.
  const groupsInUse = MUSCLE_GROUPS.filter((g) => items.some((e) => e.group === g));

  return (
    <main className="flex flex-1 flex-col px-4 pb-32 safe-top">
      <header className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xl active:bg-white/10"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">Log workout</h1>
          <p className="text-sm text-muted">{shortDate(date)}</p>
        </div>
        {items.length > 0 && (
          <span className="rounded-full bg-green-tint px-3 py-1 text-sm font-semibold text-green">
            {items.length} {items.length === 1 ? "exercise" : "exercises"}
          </span>
        )}
      </header>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-green/40 bg-surface px-6 py-14 text-center active:bg-green-tint"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green text-3xl font-bold text-ink-inverse">
            +
          </span>
          <span className="text-lg font-bold text-ink">Add your first exercise</span>
          <span className="text-sm text-muted">
            Pick a muscle group, choose from the library or type your own
          </span>
        </button>
      ) : (
        <div className="space-y-5">
          {groupsInUse.map((g) => (
            <section key={g}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink">
                <span className="h-5 w-5" style={{ color: MUSCLE_TONE[g] }}>
                  <MuscleIcon group={g} />
                </span>
                {MUSCLE_GROUP_LABELS[g]}
              </h2>
              <div className="space-y-3">
                {items
                  .filter((e) => e.group === g)
                  .map((ex) => (
                    <ExerciseCard
                      key={ex.id}
                      ex={ex}
                      onChange={(patch) => update(ex.id, patch)}
                      onSave={() => saveExercise(ex.id)}
                      onRemove={() => removeExercise(ex)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-white/10 bg-page px-4 pb-5 pt-3 safe-bottom">
        {finishError && (
          <p className="mb-2 text-center text-sm font-medium text-orange">{finishError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-orange/60 px-4 py-4 text-base font-semibold text-orange transition active:scale-[0.98]"
          >
            + Add
          </button>
          <button
            type="button"
            disabled={finishing || items.length === 0}
            onClick={finish}
            className="flex flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-green px-4 py-4 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
          >
            {finishing ? "Finishing…" : "✓ Done"}
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-muted">
          Exercises save automatically in the background
        </p>
      </div>

      {sheetOpen && (
        <AddSheet
          circuits={circuits}
          onAdd={addExercises}
          onLoadCircuit={loadCircuit}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
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
  if (status === "error")
    return <span className="text-xs font-semibold text-orange">! Retry</span>;
  return null;
}

function ExerciseCard({
  ex,
  onChange,
  onSave,
  onRemove,
}: {
  ex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const mode = modeFor(ex.group);
  const expanded = !ex.collapsed;
  // Strength needs a typed name; cardio/HIIT derive their name automatically.
  const canSave =
    exerciseHasContent(ex) && (mode !== "strength" || ex.name.trim() !== "");

  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border bg-surface",
        ex.status === "error" ? "border-orange/60" : "border-white/10",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onChange({ collapsed: expanded })}
        className={[
          "flex w-full items-center gap-3 px-3 py-3 text-left",
          expanded ? "bg-green-tint/50" : "",
        ].join(" ")}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 p-1.5"
          style={{ color: MUSCLE_TONE[ex.group] }}
        >
          <MuscleIcon group={ex.group} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{cardTitle(ex)}</span>
          <span className="block truncate text-sm text-muted">{summarizeExercise(ex)}</span>
        </span>
        <StatusChip status={ex.status} />
        <span aria-hidden className="text-muted">
          {expanded ? "⌃" : "⌄"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4">
          <ExerciseForm mode={mode} ex={ex} onChange={onChange} />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onRemove}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-orange/40 px-3 py-2.5 text-sm font-semibold text-orange active:bg-orange-soft"
            >
              🗑 Delete
            </button>
            <button
              type="button"
              disabled={!canSave || ex.status === "syncing"}
              onClick={onSave}
              className="flex flex-[1.4] items-center justify-center rounded-xl bg-green px-3 py-2.5 text-sm font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
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
  "w-full appearance-none rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 pr-9 text-base text-ink outline-none focus:border-green";
const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

function ExerciseForm({
  mode,
  ex,
  onChange,
}: {
  mode: Mode;
  ex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
}) {
  // Cardio/HIIT keep a single inline entry bound to sets[0].
  const entry = ex.sets[0] ?? emptySet();
  function patchEntry(key: keyof DraftSet, value: string) {
    const next = { ...entry, [key]: value };
    onChange({ sets: [next, ...ex.sets.slice(1)], status: "draft" });
  }

  const descriptors = fieldDescriptors(mode, ex);

  return (
    <div className="space-y-3">
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
        />
      ) : (
        descriptors.map((d, i) => {
          const isTime = d.kind === "time";
          return (
            <Field key={d.draftKey} label={d.label} optional={i > 0}>
              <div className="relative">
                <input
                  value={entry[d.draftKey]}
                  onChange={(e) => patchEntry(d.draftKey, e.target.value)}
                  type={isTime ? "text" : "number"}
                  inputMode={isTime ? "text" : "decimal"}
                  min={isTime ? undefined : 0}
                  placeholder={isTime ? "00:45:00" : "0"}
                  className={`${INPUT_CLASS} ${d.unit ? "pr-12" : ""}`}
                />
                {d.unit && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    {d.unit}
                  </span>
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
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      >
        ▾
      </span>
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
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}

function StrengthSets({
  sets,
  onChange,
}: {
  sets: DraftSet[];
  onChange: (sets: DraftSet[]) => void;
}) {
  const inputClass =
    "min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

  function patch(id: string, key: keyof DraftSet, value: string) {
    onChange(sets.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  // One-tap repeat of the previous set's numbers.
  function duplicateLast() {
    const last = sets[sets.length - 1];
    const next = emptySet();
    if (last) {
      next.reps = last.reps;
      next.weight = last.weight;
    }
    onChange([...sets, next]);
  }

  return (
    <Field label="Sets">
      <div className="space-y-2">
        {sets.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs font-medium text-muted">
              {i + 1}
            </span>
            <input
              value={s.reps}
              onChange={(e) => patch(s.id, "reps", e.target.value)}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="reps"
              className={inputClass}
            />
            <input
              value={s.weight}
              onChange={(e) => patch(s.id, "weight", e.target.value)}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              placeholder="weight (kg)"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onChange(sets.filter((x) => x.id !== s.id))}
              aria-label="Remove set"
              className="shrink-0 px-1 text-muted active:text-orange"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChange([...sets, emptySet()])}
            className="text-sm font-semibold text-green active:opacity-70"
          >
            + Add set
          </button>
          {sets.some((s) => s.reps !== "" || s.weight !== "") && (
            <button
              type="button"
              onClick={duplicateLast}
              className="text-sm font-semibold text-muted active:opacity-70"
            >
              ⧉ Repeat last
            </button>
          )}
        </div>
      </div>
    </Field>
  );
}

// ---------- Add-exercise sheet (group → library/custom in one flow) ----------

function AddSheet({
  circuits,
  onAdd,
  onLoadCircuit,
  onClose,
}: {
  circuits: Circuit[];
  onAdd: (group: MuscleGroup, inits: Partial<DraftExercise>[]) => void;
  onLoadCircuit: (c: Circuit) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");

  const mode = group ? modeFor(group) : "strength";
  const items = group ? libraryFor(group) : [];

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function confirm() {
    if (!group) return;
    const inits: Partial<DraftExercise>[] = items
      .filter((i) => selected.has(i.name))
      .map((i) =>
        i.cardioType ? { name: i.name, cardioType: i.cardioType } : { name: i.name },
      );
    const customName = custom.trim();
    if (customName && mode === "strength") inits.push({ name: customName });
    if (inits.length === 0) return;
    onAdd(group, inits);
  }

  const count =
    selected.size + (custom.trim() && mode === "strength" ? 1 : 0);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Add exercise"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-page shadow-xl safe-bottom"
      >
        <div className="flex items-center gap-3 px-4 pb-2 pt-4">
          {group && (
            <button
              type="button"
              onClick={() => {
                setGroup(null);
                setSelected(new Set());
                setCustom("");
              }}
              aria-label="Back to muscle groups"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-white/10"
            >
              ←
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink">
              {group ? `${MUSCLE_GROUP_LABELS[group]}` : "What did you train?"}
            </h3>
            <p className="text-xs text-muted">
              {group ? "Tap to select one or more" : "Pick a muscle group"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-white/10"
          >
            ✕
          </button>
        </div>

        {!group ? (
          <div className="grid grid-cols-3 gap-2.5 overflow-y-auto px-4 pb-6 pt-1">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-surface px-2 py-4 transition active:scale-[0.97] active:border-green"
              >
                <span className="h-8 w-8" style={{ color: MUSCLE_TONE[g] }}>
                  <MuscleIcon group={g} />
                </span>
                <span className="text-sm font-semibold text-ink">
                  {MUSCLE_GROUP_LABELS[g]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-1">
              {mode === "hiit" && (
                <CircuitPanel circuits={circuits} onLoadCircuit={onLoadCircuit} />
              )}

              {mode === "strength" && (
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Custom exercise… (e.g. Bench press)"
                  className={INPUT_CLASS}
                />
              )}

              <ul className="space-y-2 pb-2">
                {items.map((item) => {
                  const on = selected.has(item.name);
                  return (
                    <li key={item.name}>
                      <button
                        type="button"
                        onClick={() => toggle(item.name)}
                        aria-pressed={on}
                        className={[
                          "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left",
                          on
                            ? "border-green bg-green-tint text-ink"
                            : "border-white/10 bg-surface text-ink active:bg-white/10",
                        ].join(" ")}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span
                          className={[
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                            on
                              ? "bg-green text-ink-inverse"
                              : "border border-white/20 text-transparent",
                          ].join(" ")}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-white/10 px-4 pb-5 pt-3">
              <button
                type="button"
                disabled={count === 0}
                onClick={confirm}
                className="w-full rounded-2xl bg-green px-4 py-3.5 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
              >
                {count === 0
                  ? "Select exercises"
                  : `Add ${count} ${count === 1 ? "exercise" : "exercises"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CircuitPanel({
  circuits,
  onLoadCircuit,
}: {
  circuits: Circuit[];
  onLoadCircuit: (c: Circuit) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-3">
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
