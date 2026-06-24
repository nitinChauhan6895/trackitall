"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveCoachProfile,
  generateWorkout,
  logGeneratedWorkout,
} from "@/app/actions";
import {
  COACH_GROUPS,
  EQUIPMENTS,
  EXPERIENCES,
  GOALS,
  INJURIES,
  type CoachGroup,
  type CoachProfile,
  type Equipment,
  type Experience,
  type GenItem,
  type GenerationResult,
  type Goal,
} from "@/lib/coach/types";

type OnboardedResult = Extract<GenerationResult, { onboarded: true }>;

export default function CoachClient({
  profile,
  focus,
  today,
}: {
  profile: CoachProfile | null;
  focus: CoachGroup[];
  today: string;
}) {
  const [tab, setTab] = useState<"exercise" | "diet">("exercise");

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span aria-hidden>🧠</span> Coach
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Your personal training &amp; nutrition guide
        </p>
      </header>

      <div className="mt-4 flex rounded-xl bg-black/[0.05] p-1">
        {(["exercise", "diet"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition",
              tab === t ? "bg-white text-green shadow-sm" : "text-muted",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "exercise" ? (
        <ExerciseTab profile={profile} focus={focus} today={today} />
      ) : (
        <DietTab />
      )}
    </main>
  );
}

function ExerciseTab({
  profile,
  focus,
  today,
}: {
  profile: CoachProfile | null;
  focus: CoachGroup[];
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (!profile || editing) {
    return (
      <OnboardingForm
        profile={profile}
        onDone={() => {
          setEditing(false);
          router.refresh();
        }}
        onCancel={profile ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <Generator
      profile={profile}
      focus={focus}
      today={today}
      onEditPrefs={() => setEditing(true)}
    />
  );
}

function OnboardingForm({
  profile,
  onDone,
  onCancel,
}: {
  profile: CoachProfile | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? "Muscle Growth");
  const [experience, setExperience] = useState<Experience>(
    profile?.experience ?? "Beginner",
  );
  const [equipment, setEquipment] = useState<Equipment>(
    profile?.equipment ?? "Full Gym",
  );
  const [injuries, setInjuries] = useState<string[]>(profile?.injuries ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      await saveCoachProfile({ goal, experience, equipment, injuries });
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <p className="text-sm text-muted">
        Tell the coach about you so it can tailor your workouts.
      </p>

      <Choice label="Goal" options={GOALS} value={goal} onChange={setGoal} />
      <Choice label="Experience" options={EXPERIENCES} value={experience} onChange={setExperience} />
      <Choice label="Equipment" options={EQUIPMENTS} value={equipment} onChange={setEquipment} />

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Injuries (optional)</p>
        <div className="flex flex-wrap gap-2">
          {INJURIES.map((inj) => {
            const on = injuries.includes(inj);
            return (
              <button
                key={inj}
                type="button"
                onClick={() =>
                  setInjuries((prev) =>
                    prev.includes(inj) ? prev.filter((x) => x !== inj) : [...prev, inj],
                  )
                }
                className={chipClass(on)}
              >
                {inj}
              </button>
            );
          })}
        </div>
      </div>

      {err && <p className="text-sm text-orange">{err}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="w-full rounded-xl bg-green px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save preferences"}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm text-muted active:bg-black/5"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function Generator({
  profile,
  focus,
  today,
  onEditPrefs,
}: {
  profile: CoachProfile;
  focus: CoachGroup[];
  today: string;
  onEditPrefs: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CoachGroup[]>(focus.length ? [focus[0]] : []);
  const toggle = (g: CoachGroup) =>
    setSelected((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OnboardedResult | null>(null);
  const [slots, setSlots] = useState<{ options: GenItem[]; idx: number }[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [err, setErr] = useState("");

  const items = slots.map((s) => s.options[s.idx]);
  const duration = items.reduce((n, i) => n + i.estDuration, 0);
  const usedIds = new Set(items.map((i) => i.id));

  function gen() {
    if (selected.length === 0) return;
    setErr("");
    setResult(null);
    startTransition(async () => {
      try {
        const r = await generateWorkout(selected);
        if (!r.onboarded) {
          onEditPrefs();
          return;
        }
        setResult(r);
        setSlots(r.items.map((it) => ({ options: [it, ...it.alternatives], idx: 0 })));
      } catch (e: any) {
        setErr(e?.message ?? "Could not generate.");
      }
    });
  }

  async function accept() {
    if (items.length === 0) return;
    setAccepting(true);
    setErr("");
    try {
      await logGeneratedWorkout(today, items);
      router.push(`/day/${today}`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not log.");
      setAccepting(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Goal: <strong className="text-ink">{profile.goal}</strong>
        </p>
        <button type="button" onClick={onEditPrefs} className="text-xs font-semibold text-orange">
          Edit preferences
        </button>
      </div>

      {focus.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Suggested focus today
          </p>
          <div className="flex flex-wrap gap-2">
            {focus.map((g) => (
              <button key={g} type="button" onClick={() => toggle(g)} className={chipClass(selected.includes(g))}>
                ⚡ {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">
        Pick muscle groups
      </p>
      <div className="flex flex-wrap gap-2">
        {COACH_GROUPS.map((g) => (
          <button key={g} type="button" onClick={() => toggle(g)} className={chipClass(selected.includes(g))}>
            {g}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={selected.length === 0 || pending}
        onClick={gen}
        className="mt-4 w-full rounded-xl bg-orange px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {pending ? "Generating…" : "⚙️ Generate workout"}
      </button>

      {err && <p className="mt-3 text-center text-sm text-orange">{err}</p>}

      {result && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              Your {result.groups.join(" + ")} session
            </h2>
            <span className="text-xs text-muted">~{duration} min</span>
          </div>

          {result.reasons.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-2xl bg-green-tint p-3 text-xs text-ink">
              {result.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span aria-hidden className="text-green">✓</span> {r}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2.5">
            {items.map((it, i) => (
              <ItemCard
                key={`${it.id}-${i}`}
                item={it}
                canReplace={slots[i]?.options.length > 1}
                onReplace={() =>
                  setSlots((prev) =>
                    prev.map((s, j) =>
                      j === i && s.options.length > 1
                        ? { ...s, idx: (s.idx + 1) % s.options.length }
                        : s,
                    ),
                  )
                }
                onRemove={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-3 flex w-full items-center justify-center rounded-2xl border border-dashed border-orange/50 px-4 py-3 text-sm font-semibold text-orange active:bg-orange-soft"
          >
            + Add exercise
          </button>

          <button
            type="button"
            disabled={accepting || items.length === 0}
            onClick={accept}
            className="mt-4 w-full rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {accepting ? "Logging…" : "✓ Accept & Log to today"}
          </button>

          {addOpen && (
            <AddSheet
              pool={result.pool.filter((p) => !usedIds.has(p.id))}
              onPick={(it) => {
                setSlots((prev) => [...prev, { options: [it], idx: 0 }]);
                setAddOpen(false);
              }}
              onClose={() => setAddOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  canReplace,
  onReplace,
  onRemove,
}: {
  item: GenItem;
  canReplace: boolean;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const prescription = item.isCardio
    ? `${item.cardioMin} min`
    : item.toFailure
      ? `${item.sets} × to failure`
      : `${item.sets} × ${item.repMin}–${item.repMax}`;
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {item.group} · {prescription}
            {!item.isCardio && (
              <>
                {" · "}
                {item.suggestedWeight != null ? `${item.suggestedWeight} kg` : "—"}
              </>
            )}
          </p>
          {item.note && <p className="mt-1 text-[11px] italic text-orange">{item.note}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canReplace && (
            <button type="button" onClick={onReplace} aria-label="Replace" className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium text-ink active:bg-black/5">
              ⟳
            </button>
          )}
          <button type="button" onClick={onRemove} aria-label="Remove" className="rounded-lg border border-orange/30 px-2.5 py-1 text-xs text-orange active:bg-orange-soft">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function AddSheet({
  pool,
  onPick,
  onClose,
}: {
  pool: GenItem[];
  onPick: (it: GenItem) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[70vh] w-full max-w-md flex-col rounded-t-3xl bg-page shadow-xl safe-bottom">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h3 className="text-base font-semibold text-ink">Add exercise</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-black/5">
            ✕
          </button>
        </div>
        {pool.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No more options for this group.</p>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto px-4 pb-4 pt-1">
            {pool.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onPick(it)}
                  className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white px-4 py-3 text-left active:bg-black/5"
                >
                  <span className="font-medium text-ink">{it.name}</span>
                  <span className="text-xs text-muted">{it.category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function DietTab() {
  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-black/5 bg-white p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-tint text-2xl">🥗</div>
        <h2 className="mt-3 flex items-center gap-2 text-base font-bold text-ink">
          Personalised diet plans{" "}
          <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange">Soon</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Daily calorie &amp; macro targets and meal suggestions tailored to your goals and training load.
        </p>
      </section>
    </div>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} className={chipClass(value === o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function chipClass(on: boolean): string {
  return [
    "rounded-full border px-3 py-1.5 text-sm font-medium transition",
    on ? "border-orange bg-orange text-white" : "border-black/10 bg-white text-ink active:bg-black/5",
  ].join(" ");
}
