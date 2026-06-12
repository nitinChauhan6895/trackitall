"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  isCardio,
  type MuscleGroup,
} from "@/lib/types";
import { saveWorkout, type GroupInput } from "@/app/actions";
import SwipeToDelete from "@/components/SwipeToDelete";

type DraftSet = {
  id: string;
  reps: string;
  weight: string;
  distance: string;
  speed: string;
};
type DraftExercise = { id: string; name: string; sets: DraftSet[] };

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function shortDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default function LogWizard({ date }: { date: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<MuscleGroup[]>([]);
  const [byGroup, setByGroup] = useState<Record<string, DraftExercise[]>>({});
  const [saving, setSaving] = useState(false);

  function toggleGroup(g: MuscleGroup) {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function addExercise(g: MuscleGroup, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setByGroup((prev) => ({
      ...prev,
      [g]: [...(prev[g] ?? []), { id: uid(), name: trimmed, sets: [] }],
    }));
  }

  function removeExercise(g: MuscleGroup, exId: string) {
    setByGroup((prev) => ({
      ...prev,
      [g]: (prev[g] ?? []).filter((e) => e.id !== exId),
    }));
  }

  function addSet(g: MuscleGroup, exId: string, set: Omit<DraftSet, "id">) {
    setByGroup((prev) => ({
      ...prev,
      [g]: (prev[g] ?? []).map((e) =>
        e.id === exId ? { ...e, sets: [...e.sets, { id: uid(), ...set }] } : e,
      ),
    }));
  }

  function removeSet(g: MuscleGroup, exId: string, setId: string) {
    setByGroup((prev) => ({
      ...prev,
      [g]: (prev[g] ?? []).map((e) =>
        e.id === exId
          ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
          : e,
      ),
    }));
  }

  async function handleSave() {
    setSaving(true);
    const groups: GroupInput[] = selected.map((g) => ({
      muscle_group: g,
      exercises: (byGroup[g] ?? []).map((e) => ({
        name: e.name,
        sets: e.sets.map((s) =>
          isCardio(g)
            ? {
                distance_km: s.distance === "" ? null : Number(s.distance),
                speed_kmh: s.speed === "" ? null : Number(s.speed),
              }
            : {
                reps: s.reps === "" ? null : Number(s.reps),
                weight_kg: s.weight === "" ? null : Number(s.weight),
              },
        ),
      })),
    }));
    try {
      await saveWorkout(date, groups);
      // saveWorkout redirects to "/" on success.
    } catch (e) {
      setSaving(false);
      throw e;
    }
  }

  const heading = useMemo(
    () => selected.map((g) => MUSCLE_GROUP_LABELS[g]).join(" · "),
    [selected],
  );

  if (step === 1) {
    return (
      <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
        <Header title={`Log workout · ${shortDate(date)}`} onBack={() => router.push("/")} />
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
            onAddExercise={(name) => addExercise(g, name)}
            onRemoveExercise={(exId) => removeExercise(g, exId)}
            onAddSet={(exId, set) => addSet(g, exId, set)}
            onRemoveSet={(exId, setId) => removeSet(g, exId, setId)}
          />
        ))}
      </div>

      <BottomBar>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Saving…" : "✓ Save workout"}
        </button>
        <p className="mt-1 text-center text-xs text-muted">
          Saves everything and returns to home
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
  onAddExercise,
  onRemoveExercise,
  onAddSet,
  onRemoveSet,
}: {
  group: MuscleGroup;
  exercises: DraftExercise[];
  onAddExercise: (name: string) => void;
  onRemoveExercise: (exId: string) => void;
  onAddSet: (exId: string, set: Omit<DraftSet, "id">) => void;
  onRemoveSet: (exId: string, setId: string) => void;
}) {
  const [name, setName] = useState("");
  const cardio = isCardio(group);

  function submit() {
    onAddExercise(name);
    setName("");
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange">
        {MUSCLE_GROUP_LABELS[group]}
      </h2>

      <div className="space-y-4">
        {exercises.map((ex) => (
          <div key={ex.id}>
            <SwipeToDelete
              onDelete={() => onRemoveExercise(ex.id)}
              label="Delete exercise"
            >
              {(requestDelete) => (
                <div className="flex items-center justify-between bg-white py-0.5">
                  <h3 className="font-semibold">{ex.name}</h3>
                  <button
                    type="button"
                    onClick={requestDelete}
                    aria-label="Remove exercise"
                    className="text-muted active:text-orange"
                  >
                    ✕
                  </button>
                </div>
              )}
            </SwipeToDelete>
            <SetEditor
              cardio={cardio}
              sets={ex.sets}
              onAdd={(s) => onAddSet(ex.id, s)}
              onRemove={(setId) => onRemoveSet(ex.id, setId)}
            />
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`+ Add exercise${
            cardio ? " (e.g. Treadmill run)" : " (e.g. Bench press)"
          }`}
          className="w-full rounded-xl border border-black/10 bg-page/40 px-3 py-3 text-sm text-green outline-none placeholder:text-green/70 focus:border-green"
        />
      </form>
    </section>
  );
}

function SetEditor({
  cardio,
  sets,
  onAdd,
  onRemove,
}: {
  cardio: boolean;
  sets: DraftSet[];
  onAdd: (s: Omit<DraftSet, "id">) => void;
  onRemove: (setId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(""); // reps or distance
  const [b, setB] = useState(""); // weight or speed

  function add() {
    if (a === "" && b === "") return;
    if (cardio) {
      onAdd({ reps: "", weight: "", distance: a, speed: b });
    } else {
      onAdd({ reps: a, weight: b, distance: "", speed: "" });
    }
    setA("");
    setB("");
    setOpen(false);
  }

  return (
    <div className="mt-2">
      {sets.length > 0 && (
        <div className="space-y-1.5">
          {sets.map((s) => (
            <SwipeToDelete key={s.id} onDelete={() => onRemove(s.id)}>
              {(requestDelete) => (
                <div className="flex items-center justify-between bg-beige px-4 py-2.5 text-sm">
                  <span className="tabular-nums">
                    {cardio
                      ? `${s.distance || "–"} km${s.speed ? ` · ${s.speed} km/h` : ""}`
                      : `${s.reps || "–"} × ${s.weight || "–"} kg`}
                  </span>
                  <button
                    type="button"
                    onClick={requestDelete}
                    aria-label="Remove set"
                    className="text-muted active:text-orange"
                  >
                    ✕
                  </button>
                </div>
              )}
            </SwipeToDelete>
          ))}
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-sm font-medium text-green"
        >
          + {cardio ? "entry" : "set"}
        </button>
      )}

      {open && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode={cardio ? "decimal" : "numeric"}
            min={0}
            step={cardio ? "0.1" : "1"}
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder={cardio ? "Distance (km)" : "Reps"}
            className="w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green"
          />
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder={cardio ? "Speed (km/h)" : "Weight (kg)"}
            className="w-full rounded-lg border border-black/10 bg-page/40 px-3 py-2 text-sm outline-none focus:border-green"
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-lg bg-green px-3 py-2 text-sm font-semibold text-white active:scale-95"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
