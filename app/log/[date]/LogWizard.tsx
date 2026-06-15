"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CARDIO_FIELDS,
  CARDIO_TYPES,
  CARDIO_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  defaultCardioType,
  isCardio,
  parseTimeToSeconds,
  type CardioField,
  type CardioType,
  type MuscleGroup,
} from "@/lib/types";
import {
  deleteExerciseById,
  upsertExercise,
  type SetInput,
} from "@/app/actions";

type DraftSet = {
  id: string;
  reps: string;
  weight: string;
  distance_km: string;
  distance_m: string;
  time: string;
  incline: string;
  resistance: string;
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
  incline: "",
  resistance: "",
});

const newExercise = (): DraftExercise => ({
  id: uid(),
  name: "",
  cardioType: defaultCardioType(),
  sets: [],
  collapsed: false,
  saving: false,
});

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

function toSetInput(
  cardio: boolean,
  cardioType: CardioType,
  s: DraftSet,
): SetInput {
  if (!cardio) {
    return { reps: num(s.reps), weight_kg: num(s.weight) };
  }
  const out: SetInput = {};
  for (const f of CARDIO_FIELDS[cardioType]) {
    if (f === "distance_km") out.distance_km = num(s.distance_km);
    else if (f === "distance_m") out.distance_m = num(s.distance_m);
    else if (f === "time") out.time_seconds = parseTimeToSeconds(s.time);
    else if (f === "incline") out.incline = num(s.incline);
    else if (f === "resistance") out.resistance = num(s.resistance);
    else if (f === "weight") out.weight_kg = num(s.weight);
  }
  return out;
}

// True if a draft set has any value entered, for whichever exercise type.
function draftSetHasAny(
  s: DraftSet,
  cardio: boolean,
  cardioType: CardioType,
): boolean {
  if (!cardio) return s.reps !== "" || s.weight !== "";
  return CARDIO_FIELDS[cardioType].some((f) => s[FIELD_META[f].key] !== "");
}

// An exercise is saveable once it has a name OR at least one filled entry.
// (Cardio counts distance/time/incline/resistance/weight, not just reps/weight.)
function exerciseHasContent(ex: DraftExercise, cardio: boolean): boolean {
  if (ex.name.trim() !== "") return true;
  return ex.sets.some((s) => draftSetHasAny(s, cardio, ex.cardioType));
}

export default function LogWizard({ date }: { date: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<MuscleGroup[]>([]);
  const [byGroup, setByGroup] = useState<Record<string, DraftExercise[]>>({});
  const [finishing, setFinishing] = useState(false);

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

  function addExerciseCard(g: MuscleGroup) {
    setByGroup((prev) => ({
      ...prev,
      [g]: [...(prev[g] ?? []), newExercise()],
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
    const cardio = isCardio(g);
    // Cardio exercises can save without a typed name — fall back to the type
    // label (e.g. "Running") so the Save button isn't blocked on naming.
    const name =
      ex.name.trim() || (cardio ? CARDIO_TYPE_LABELS[ex.cardioType] : "");
    if (!name) return;
    updateExercise(g, ex.id, { saving: true, name });
    try {
      const { id } = await upsertExercise({
        id: ex.savedId,
        date,
        muscle_group: g,
        cardio_type: cardio ? ex.cardioType : null,
        name,
        sets: ex.sets.map((s) => toSetInput(cardio, ex.cardioType, s)),
      });
      updateExercise(g, ex.id, {
        savedId: id,
        collapsed: true,
        saving: false,
      });
    } catch (e) {
      updateExercise(g, ex.id, { saving: false });
      throw e;
    }
  }

  async function finish() {
    setFinishing(true);
    // Auto-save any still-open card that has real content, so nothing is lost.
    for (const g of selected) {
      const cardio = isCardio(g);
      for (const ex of byGroup[g] ?? []) {
        if (!ex.collapsed && exerciseHasContent(ex, cardio)) {
          try {
            await saveExercise(g, ex);
          } catch {
            /* keep going */
          }
        }
      }
    }
    router.push("/");
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
        <p className="mb-4 text-sm text-muted">
          What did you train? Select all that apply
        </p>

        <div className="grid grid-cols-2 gap-3">
          {MUSCLE_GROUPS.map((g) => {
            const on = selected.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                className={[
                  "flex items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-base font-medium transition active:scale-[0.98]",
                  on
                    ? "border-[1.5px] border-orange bg-orange-soft text-orange"
                    : "border border-black/15 bg-white text-ink",
                ].join(" ")}
              >
                {on && <span aria-hidden>✓</span>}
                {MUSCLE_GROUP_LABELS[g]}
              </button>
            );
          })}
        </div>

        <BottomBar>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => setStep(2)}
            className="flex w-full items-center justify-center rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            Continue{selected.length > 0 ? ` (${selected.length} selected)` : ""}
          </button>
        </BottomBar>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <Header title={heading} onBack={() => setStep(1)} />

      <div className="space-y-4">
        {selected.map((g) => (
          <GroupCard
            key={g}
            group={g}
            exercises={byGroup[g] ?? []}
            onAdd={() => addExerciseCard(g)}
            onChange={(exId, patch) => updateExercise(g, exId, patch)}
            onSave={(ex) => saveExercise(g, ex)}
            onRemove={(ex) => removeExercise(g, ex)}
          />
        ))}
      </div>

      <BottomBar>
        <button
          type="button"
          disabled={finishing}
          onClick={finish}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {finishing ? "Finishing…" : "✓ Save workout"}
        </button>
        <p className="mt-1 text-center text-xs text-muted">
          Each exercise is saved as you go. This returns to home.
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

function GroupCard({
  group,
  exercises,
  onAdd,
  onChange,
  onSave,
  onRemove,
}: {
  group: MuscleGroup;
  exercises: DraftExercise[];
  onAdd: () => void;
  onChange: (exId: string, patch: Partial<DraftExercise>) => void;
  onSave: (ex: DraftExercise) => void | Promise<void>;
  onRemove: (ex: DraftExercise) => void | Promise<void>;
}) {
  const cardio = isCardio(group);

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange">
        {MUSCLE_GROUP_LABELS[group]}
      </h2>

      <div className="space-y-3">
        {exercises.map((ex) =>
          ex.collapsed ? (
            <SavedCard
              key={ex.id}
              ex={ex}
              cardio={cardio}
              onEdit={() => onChange(ex.id, { collapsed: false })}
              onRemove={() => onRemove(ex)}
            />
          ) : (
            <EditingCard
              key={ex.id}
              ex={ex}
              cardio={cardio}
              onChange={(patch) => onChange(ex.id, patch)}
              onSave={() => onSave(ex)}
              onRemove={() => onRemove(ex)}
            />
          ),
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 text-sm font-medium text-green active:opacity-70"
      >
        + Add exercise
      </button>
    </section>
  );
}

function EditingCard({
  ex,
  cardio,
  onChange,
  onSave,
  onRemove,
}: {
  ex: DraftExercise;
  cardio: boolean;
  onChange: (patch: Partial<DraftExercise>) => void;
  onSave: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  const canSave = exerciseHasContent(ex, cardio);

  return (
    <div className="rounded-2xl border-[1.5px] border-orange/60 p-3">
      <input
        value={ex.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder={
          cardio ? "Exercise (e.g. Treadmill)" : "Exercise (e.g. Bench press)"
        }
        className="w-full bg-transparent text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted"
      />

      {cardio && (
        <select
          value={ex.cardioType}
          onChange={(e) => onChange({ cardioType: e.target.value as CardioType })}
          className="mt-2 w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm text-ink outline-none focus:border-green"
        >
          {CARDIO_TYPES.map((t) => (
            <option key={t} value={t}>
              {CARDIO_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      )}

      <SetEditor
        cardio={cardio}
        cardioType={ex.cardioType}
        sets={ex.sets}
        onChange={(sets) => onChange({ sets })}
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSave || ex.saving}
          onClick={() => onSave()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green px-3 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {ex.saving ? "Saving…" : "💾 Save exercise"}
        </button>
        <button
          type="button"
          onClick={() => onRemove()}
          aria-label="Remove exercise"
          className="rounded-xl px-3 py-2.5 text-sm text-muted active:text-orange"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function SavedCard({
  ex,
  cardio,
  onEdit,
  onRemove,
}: {
  ex: DraftExercise;
  cardio: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl bg-beige/60 p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-semibold text-ink">
          <span aria-hidden className="text-green">
            ✓
          </span>
          {ex.name}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit exercise"
            className="px-2 py-1 text-orange active:opacity-70"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove exercise"
            className="px-2 py-1 text-muted active:text-orange"
          >
            ✕
          </button>
        </div>
      </div>
      {(() => {
        const filled = ex.sets.filter((s) =>
          draftSetHasAny(s, cardio, ex.cardioType),
        );
        if (filled.length === 0) return null;
        return (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filled.map((s) => (
              <span
                key={s.id}
                className="rounded-lg bg-orange-soft px-2.5 py-1 text-xs font-medium text-orange"
              >
                {summarizeSet(cardio, ex.cardioType, s)}
              </span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function summarizeSet(
  cardio: boolean,
  cardioType: CardioType,
  s: DraftSet,
): string {
  if (!cardio) {
    return `${s.reps || "–"} × ${s.weight || "–"} kg`;
  }
  const parts: string[] = [];
  for (const f of CARDIO_FIELDS[cardioType]) {
    if (f === "distance_km" && s.distance_km) parts.push(`${s.distance_km} km`);
    else if (f === "distance_m" && s.distance_m) parts.push(`${s.distance_m} m`);
    else if (f === "time" && s.time) parts.push(s.time);
    else if (f === "incline" && s.incline) parts.push(`incline ${s.incline}`);
    else if (f === "resistance" && s.resistance)
      parts.push(`resist ${s.resistance}`);
    else if (f === "weight" && s.weight) parts.push(`${s.weight} kg`);
  }
  return parts.length ? parts.join(" · ") : "entry";
}

const FIELD_META: Record<
  CardioField,
  {
    key: keyof DraftSet;
    placeholder: string;
    type: "number" | "text";
    step?: string;
  }
> = {
  distance_km: { key: "distance_km", placeholder: "dist (km)", type: "number", step: "0.1" },
  distance_m: { key: "distance_m", placeholder: "dist (m)", type: "number", step: "1" },
  time: { key: "time", placeholder: "time (mm:ss)", type: "text" },
  incline: { key: "incline", placeholder: "incline", type: "number", step: "0.5" },
  resistance: { key: "resistance", placeholder: "resist.", type: "number", step: "1" },
  weight: { key: "weight", placeholder: "weight", type: "number", step: "0.5" },
};

// Inline-editable set/entry rows. Each row's inputs write straight into the
// exercise's `sets` array (no separate uncommitted draft), so cardio entries are
// never lost and the parent's "Save exercise" button sees them immediately.
function SetEditor({
  cardio,
  cardioType,
  sets,
  onChange,
}: {
  cardio: boolean;
  cardioType: CardioType;
  sets: DraftSet[];
  onChange: (sets: DraftSet[]) => void;
}) {
  const fields: CardioField[] = cardio ? CARDIO_FIELDS[cardioType] : [];

  function addRow() {
    onChange([...sets, emptySet()]);
  }
  function removeRow(id: string) {
    onChange(sets.filter((s) => s.id !== id));
  }
  function patchRow(id: string, key: keyof DraftSet, value: string) {
    onChange(sets.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  const inputClass =
    "min-w-0 flex-1 rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-green";

  return (
    <div className="mt-2 space-y-2">
      {sets.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center text-xs font-medium text-muted">
            {i + 1}
          </span>
          {cardio ? (
            fields.map((f) => {
              const meta = FIELD_META[f];
              return (
                <input
                  key={f}
                  type={meta.type}
                  inputMode={meta.type === "number" ? "decimal" : "text"}
                  min={meta.type === "number" ? 0 : undefined}
                  step={meta.step}
                  value={s[meta.key]}
                  onChange={(e) => patchRow(s.id, meta.key, e.target.value)}
                  placeholder={meta.placeholder}
                  className={inputClass}
                />
              );
            })
          ) : (
            <>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={s.reps}
                onChange={(e) => patchRow(s.id, "reps", e.target.value)}
                placeholder="reps"
                className={inputClass}
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={s.weight}
                onChange={(e) => patchRow(s.id, "weight", e.target.value)}
                placeholder="weight"
                className={inputClass}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => removeRow(s.id)}
            aria-label="Remove set"
            className="shrink-0 px-1 text-muted active:text-orange"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="text-sm font-medium text-green active:opacity-70"
      >
        + {cardio ? "entry" : "set"}
      </button>
    </div>
  );
}
