"use client";

import { useMemo, useState } from "react";
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

type DraftExercise = {
  id: string;
  savedId?: string;
  name: string;
  cardioType: CardioType;
  sets: DraftSet[];
  collapsed: boolean;
  saving: boolean;
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

// A fresh card for `group`. Cardio & HIIT cards carry a single inline entry.
function newExercise(
  group: MuscleGroup,
  init?: Partial<DraftExercise>,
): DraftExercise {
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
    name: defaultName,
    cardioType,
    sets: mode === "strength" ? [] : [emptySet()],
    collapsed: false,
    saving: false,
    ...init,
  };
}

function shortDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fieldKey(f: CardioField): keyof DraftSet {
  return f as keyof DraftSet;
}

function cardioDesc(f: CardioField): FieldDesc {
  const meta = CARDIO_FIELD_META[f];
  return {
    draftKey: fieldKey(f),
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

function exerciseHasContent(mode: Mode, ex: DraftExercise): boolean {
  if (ex.name.trim() !== "") return true;
  return ex.sets.some((s) => entryHasAny(mode, ex, s));
}

function cardTitle(mode: Mode, ex: DraftExercise): string {
  if (mode === "cardio") return ex.name.trim() || CARDIO_TYPE_LABELS[ex.cardioType];
  return ex.name.trim() || "New exercise";
}

// Compact one-line summary under the exercise title (e.g. "25 km · 100 kcal").
function summarizeExercise(mode: Mode, ex: DraftExercise): string {
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

export default function LogWizard({
  date,
  circuits = [],
}: {
  date: string;
  circuits?: Circuit[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<MuscleGroup[]>([]);
  const [byGroup, setByGroup] = useState<Record<string, DraftExercise[]>>({});
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  // Load a saved circuit's exercises into the HIIT section as draft cards.
  function loadCircuit(c: Circuit) {
    setByGroup((prev) => {
      const added = c.exercises.map((ce) =>
        newExercise("hiit", {
          name: ce.name,
          sets: [draftFromMetrics(ce.metrics)],
          collapsed: true,
        }),
      );
      return { ...prev, hiit: [...(prev.hiit ?? []), ...added] };
    });
  }

  function toggleGroup(g: MuscleGroup) {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function updateExercise(
    g: MuscleGroup,
    exId: string,
    patch: Partial<DraftExercise>,
  ) {
    setByGroup((prev) => ({
      ...prev,
      [g]: (prev[g] ?? []).map((e) => (e.id === exId ? { ...e, ...patch } : e)),
    }));
  }

  function addExerciseCard(g: MuscleGroup, init?: Partial<DraftExercise>) {
    setByGroup((prev) => ({
      ...prev,
      [g]: [...(prev[g] ?? []), newExercise(g, init)],
    }));
  }

  async function removeExercise(g: MuscleGroup, ex: DraftExercise) {
    if (ex.savedId) {
      try {
        await deleteExerciseById(ex.savedId, date);
      } catch {
        /* ignore — still remove locally */
      }
    }
    setByGroup((prev) => ({
      ...prev,
      [g]: (prev[g] ?? []).filter((e) => e.id !== ex.id),
    }));
  }

  async function saveExercise(g: MuscleGroup, ex: DraftExercise) {
    const mode = modeFor(g);
    const name =
      ex.name.trim() || (mode === "cardio" ? CARDIO_TYPE_LABELS[ex.cardioType] : "");
    if (!name) return;
    updateExercise(g, ex.id, { saving: true, name });
    try {
      const { id } = await upsertExercise({
        id: ex.savedId,
        date,
        muscle_group: g,
        cardio_type: mode === "cardio" ? ex.cardioType : null,
        name,
        sets: ex.sets.map((s) => toSetInput(mode, ex, s)),
      });
      updateExercise(g, ex.id, { savedId: id, collapsed: true, saving: false });
    } catch (e) {
      updateExercise(g, ex.id, { saving: false });
      throw e;
    }
  }

  async function finish() {
    setFinishing(true);
    setFinishError("");
    let failed = false;
    let savedAny = false;
    for (const g of selected) {
      const mode = modeFor(g);
      for (const ex of byGroup[g] ?? []) {
        // Save any card still open that has real content (await each so the
        // write + revalidation complete before we navigate away).
        if (!ex.collapsed && exerciseHasContent(mode, ex)) {
          try {
            await saveExercise(g, ex);
            savedAny = true;
          } catch {
            failed = true;
          }
        } else if (ex.savedId) {
          savedAny = true;
        }
      }
    }
    if (failed) {
      setFinishError("Some exercises couldn't be saved. Please try again.");
      setFinishing(false);
      return;
    }
    // Land on the day page so the freshly-saved exercises are visible.
    // refresh() busts the client router cache since saves no longer revalidate.
    router.push(savedAny ? `/day/${date}` : "/");
    router.refresh();
  }

  const heading = useMemo(
    () => selected.map((g) => MUSCLE_GROUP_LABELS[g]).join(" · "),
    [selected],
  );

  if (step === 1) {
    return (
      <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
        <Header
          title={`Log workout · ${shortDate(date)}`}
          onBack={() => router.push("/")}
        />

        <h2 className="text-2xl font-bold tracking-tight text-ink">
          What did you train?
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted">Select all that apply</p>

        <div className="grid grid-cols-2 gap-3">
          {MUSCLE_GROUPS.map((g) => {
            const on = selected.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                className={[
                  "relative flex flex-col items-center justify-center gap-3 rounded-2xl border px-3 py-6 transition active:scale-[0.98]",
                  on
                    ? "border-green bg-green-tint"
                    : "border-black/10 bg-white",
                ].join(" ")}
              >
                {on && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green text-sm text-white"
                  >
                    ✓
                  </span>
                )}
                <span
                  className="h-10 w-10"
                  style={{ color: MUSCLE_TONE[g] }}
                >
                  <MuscleIcon group={g} />
                </span>
                <span className="text-base font-semibold text-ink">
                  {MUSCLE_GROUP_LABELS[g]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-green-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden className="mt-0.5">
            ℹ️
          </span>
          <p>You can add exercises for each muscle group in the next step.</p>
        </div>

        <BottomBar>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => setStep(2)}
            className="flex w-full items-center justify-center rounded-2xl bg-orange px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            Continue
          </button>
        </BottomBar>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <Header title={heading} onBack={() => setStep(1)} />

      <div className="space-y-5">
        {selected.map((g) => (
          <GroupSection
            key={g}
            group={g}
            exercises={byGroup[g] ?? []}
            circuits={circuits}
            onLoadCircuit={loadCircuit}
            onAdd={(init) => addExerciseCard(g, init)}
            onChange={(exId, patch) => updateExercise(g, exId, patch)}
            onSave={(ex) => saveExercise(g, ex)}
            onRemove={(ex) => removeExercise(g, ex)}
          />
        ))}
      </div>

      <BottomBar>
        {finishError && (
          <p className="mb-2 text-center text-sm font-medium text-orange">
            {finishError}
          </p>
        )}
        <button
          type="button"
          disabled={finishing}
          onClick={finish}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {finishing ? "Finishing…" : "✓ Save workout"}
        </button>
        <p className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-muted">
          <span aria-hidden>🔒</span> Each exercise is saved as you go
        </p>
      </BottomBar>
    </main>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 py-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-black/5"
      >
        ←
      </button>
      <h1 className="text-lg font-semibold leading-tight">{title}</h1>
    </header>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-black/5 bg-page/95 px-4 pb-5 pt-3 backdrop-blur safe-bottom">
      {children}
    </div>
  );
}

function GroupSection({
  group,
  exercises,
  circuits,
  onLoadCircuit,
  onAdd,
  onChange,
  onSave,
  onRemove,
}: {
  group: MuscleGroup;
  exercises: DraftExercise[];
  circuits: Circuit[];
  onLoadCircuit: (c: Circuit) => void;
  onAdd: (init?: Partial<DraftExercise>) => void;
  onChange: (exId: string, patch: Partial<DraftExercise>) => void;
  onSave: (ex: DraftExercise) => void | Promise<void>;
  onRemove: (ex: DraftExercise) => void | Promise<void>;
}) {
  const mode = modeFor(group);
  const [libraryOpen, setLibraryOpen] = useState(false);

  function addFromLibrary(items: LibraryItem[]) {
    // When adding several at once, drop them in collapsed so they stack neatly;
    // a single pick stays expanded for immediate logging.
    const collapsed = items.length > 1;
    for (const item of items) {
      onAdd(
        item.cardioType
          ? { cardioType: item.cardioType, name: item.name, collapsed }
          : { name: item.name, collapsed },
      );
    }
    setLibraryOpen(false);
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <span className="h-6 w-6" style={{ color: MUSCLE_TONE[group] }}>
            <MuscleIcon group={group} />
          </span>
          {MUSCLE_GROUP_LABELS[group]}
          {exercises.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-soft px-1.5 text-xs font-semibold text-orange">
              {exercises.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="text-sm font-semibold text-orange active:opacity-70"
        >
          + Add from library
        </button>
      </div>

      {mode === "hiit" && (
        <CircuitPanel circuits={circuits} onLoadCircuit={onLoadCircuit} />
      )}

      <div className="space-y-3">
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            group={group}
            mode={mode}
            ex={ex}
            onChange={(patch) => onChange(ex.id, patch)}
            onSave={() => onSave(ex)}
            onRemove={() => onRemove(ex)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAdd()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-orange/50 px-4 py-3 text-sm font-semibold text-orange active:bg-orange-soft"
      >
        + Add another exercise
      </button>

      {libraryOpen && (
        <LibrarySheet
          group={group}
          onConfirm={addFromLibrary}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </section>
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
    <div className="mb-3 rounded-2xl border border-black/5 bg-white p-3">
      <Link
        href="/circuits/new"
        className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-green/50 px-4 py-4 text-center active:bg-green-tint"
      >
        <span aria-hidden className="text-xl text-green">
          ⊕
        </span>
        <span className="text-sm font-semibold text-green">Create Circuit</span>
        <span className="text-xs text-muted">Build a reusable HIIT circuit</span>
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
                className="flex items-center gap-3 rounded-xl bg-page/60 px-3 py-2.5"
              >
                <span aria-hidden className="text-lg">
                  ⚡
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {c.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {c.exercises.length} exercise
                    {c.exercises.length === 1 ? "" : "s"} · {c.set_times.length}{" "}
                    set{c.set_times.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadCircuit(c)}
                  className="shrink-0 rounded-lg bg-green px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/circuits"
            className="mt-2 inline-block text-xs font-medium text-orange active:opacity-70"
          >
            Manage circuits →
          </Link>
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  group,
  mode,
  ex,
  onChange,
  onSave,
  onRemove,
}: {
  group: MuscleGroup;
  mode: Mode;
  ex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
  onSave: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  const expanded = !ex.collapsed;
  // Strength needs a typed name; cardio/HIIT derive their name automatically.
  const canSave =
    exerciseHasContent(mode, ex) &&
    (mode !== "strength" || ex.name.trim() !== "");

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      {/* Header */}
      <div
        className={[
          "flex items-center gap-3 px-3 py-3",
          expanded ? "bg-green-tint/50" : "",
        ].join(" ")}
      >
        <GripDots />
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-tint p-1.5"
          style={{ color: MUSCLE_TONE[group] }}
        >
          <MuscleIcon group={group} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {cardTitle(mode, ex)}
          </p>
          <p className="truncate text-sm text-muted">
            {summarizeExercise(mode, ex)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ collapsed: false })}
          aria-label="Edit exercise"
          className="flex h-8 w-8 items-center justify-center rounded-full text-orange active:bg-black/5"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => onChange({ collapsed: expanded })}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-black/5"
        >
          {expanded ? "⌃" : "⌄"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-black/5 p-4">
          <ExerciseForm mode={mode} ex={ex} onChange={onChange} />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onRemove()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-orange/40 px-3 py-2.5 text-sm font-semibold text-orange active:bg-orange-soft"
            >
              🗑 Delete
            </button>
            <button
              type="button"
              disabled={!canSave || ex.saving}
              onClick={() => onSave()}
              className="flex flex-[1.4] items-center justify-center rounded-xl bg-orange px-3 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {ex.saving ? "Saving…" : "Save exercise"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SELECT_CLASS =
  "w-full appearance-none rounded-xl border border-black/10 bg-white px-3 py-2.5 pr-9 text-base text-ink outline-none focus:border-green";

function ExerciseForm({
  mode,
  ex,
  onChange,
}: {
  mode: Mode;
  ex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
}) {
  const inputClass =
    "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

  // Cardio/HIIT keep a single inline entry bound to sets[0].
  const entry = ex.sets[0] ?? emptySet();
  function patchEntry(key: keyof DraftSet, value: string) {
    const next = { ...entry, [key]: value };
    onChange({ sets: [next, ...ex.sets.slice(1)] });
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
              onChange({ name: v, cardioType: item?.cardioType ?? "generic" });
            }}
            options={CARDIO_LIBRARY.map((i) => ({ value: i.name, label: i.name }))}
          />
        ) : mode === "hiit" ? (
          <SelectField
            value={ex.name}
            onChange={(v) => onChange({ name: v })}
            options={HIIT_EXERCISES.map((e) => ({
              value: e.name,
              label: e.name,
            }))}
          />
        ) : (
          <input
            value={ex.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Bench press"
            className={inputClass}
          />
        )}
      </Field>

      {mode === "strength" ? (
        <StrengthSets sets={ex.sets} onChange={(sets) => onChange({ sets })} />
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
                  className={`${inputClass} ${d.unit ? "pr-12" : ""}`}
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
    "min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

  function patch(id: string, key: keyof DraftSet, value: string) {
    onChange(sets.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
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
        <button
          type="button"
          onClick={() => onChange([...sets, emptySet()])}
          className="text-sm font-semibold text-green active:opacity-70"
        >
          + Add set
        </button>
      </div>
    </Field>
  );
}

function LibrarySheet({
  group,
  onConfirm,
  onClose,
}: {
  group: MuscleGroup;
  onConfirm: (items: LibraryItem[]) => void;
  onClose: () => void;
}) {
  const items = libraryFor(group);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const chosen = items.filter((i) => selected.has(i.name));

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Exercise library"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[75vh] w-full max-w-md flex-col rounded-t-3xl bg-page shadow-xl safe-bottom"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div>
            <h3 className="text-base font-semibold text-ink">
              {MUSCLE_GROUP_LABELS[group]} library
            </h3>
            <p className="text-xs text-muted">Tap to select one or more</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-black/5"
          >
            ✕
          </button>
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-1">
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
                      ? "border-orange bg-orange-soft text-ink"
                      : "border-black/5 bg-white text-ink active:bg-black/5",
                  ].join(" ")}
                >
                  <span className="font-medium">{item.name}</span>
                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      on ? "bg-orange text-white" : "border border-black/20 text-transparent",
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

        <div className="border-t border-black/5 px-4 pb-5 pt-3">
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => onConfirm(chosen)}
            className="w-full rounded-2xl bg-orange px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {chosen.length === 0
              ? "Select exercises"
              : `Add ${chosen.length} ${chosen.length === 1 ? "exercise" : "exercises"}`}
          </button>
        </div>
      </div>
    </>
  );
}

function GripDots() {
  return (
    <span
      aria-hidden
      className="grid shrink-0 grid-cols-2 gap-0.5 text-muted/50"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-current" />
      ))}
    </span>
  );
}
