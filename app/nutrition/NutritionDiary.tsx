"use client";

import { formatWeekdayDayMonth } from "@/lib/dateFormat";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refetchUnlessJustFetched, useSeedQuery } from "@/lib/seed";
import {
  copyMeal,
  deleteFoodLog,
  saveMeal,
  saveTargets,
  updateFoodLog,
} from "@/app/actions";
import {
  MEALS,
  fraction,
  sumMacros,
  type FoodLogEntry,
  type Meal,
  type NutritionTargets,
} from "@/lib/nutrition";
import { fetchNutritionDiary, qk } from "@/lib/browserData";
import type { NutritionDiary as Diary } from "@/lib/data";
import { optimisticUpdate, tempId } from "@/lib/optimistic";

/** The diary with a new entry list, totals recomputed to match. */
function withEntries(d: Diary, entries: FoodLogEntry[]): Diary {
  return { ...d, entries, totals: sumMacros(entries) };
}

const MACRO_META = [
  { key: "protein", label: "Protein", color: "#FFC95C", targetKey: "daily_protein_g" },
  { key: "carbs", label: "Carbs", color: "#7FB2F0", targetKey: "daily_carbs_g" },
  { key: "fat", label: "Fat", color: "#3FAE8E", targetKey: "daily_fat_g" },
  { key: "fiber", label: "Fibre", color: "#5EA0EF", targetKey: "daily_fiber_g" },
] as const;

function shiftKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function heading(key: string, today: string): string {
  if (key === today) return "Today";
  if (key === shiftKey(today, -1)) return "Yesterday";
  if (key === shiftKey(today, 1)) return "Tomorrow";
  // Locale-independent so the server-rendered HTML matches every device.
  return formatWeekdayDayMonth(key);
}

export default function NutritionDiary({
  initialDiary,
  fetchedAt,
  today,
}: {
  initialDiary: Diary;
  /** When the server fetched `initialDiary` (ms). */
  fetchedAt: number;
  today: string;
}) {
  const queryClient = useQueryClient();
  // Cache-backed diary: instant from IndexedDB on re-open, reconciled in the
  // background; edits invalidate this key to refetch.
  useSeedQuery(qk.diary(initialDiary.date), initialDiary, fetchedAt);
  const { data: diary = initialDiary } = useQuery({
    queryKey: qk.diary(initialDiary.date),
    refetchOnMount: refetchUnlessJustFetched,
    queryFn: () => fetchNutritionDiary(initialDiary.date),
    initialData: initialDiary,
  });
  const diaryKey = qk.diary(initialDiary.date);

  // Every edit below shows on screen at once; the save runs in the background
  // and is undone (with a message) if it fails. See lib/optimistic.ts.
  function editEntry(entry: FoodLogEntry, patch: EntryPatch) {
    setEditing(null);
    const next: FoodLogEntry = {
      ...entry,
      quantity: patch.quantity,
      computed_calories: patch.calories,
      computed_protein: patch.protein,
      computed_carbs: patch.carbs,
      computed_fat: patch.fat,
      computed_fiber: patch.fiber,
    };
    void optimisticUpdate<Diary>(
      queryClient,
      diaryKey,
      (d) => withEntries(d, d.entries.map((e) => (e.id === entry.id ? next : e))),
      () => updateFoodLog({ id: entry.id, unit: entry.unit, ...patch }),
    );
  }
  function removeEntry(entry: FoodLogEntry) {
    setEditing(null);
    void optimisticUpdate<Diary>(
      queryClient,
      diaryKey,
      (d) => withEntries(d, d.entries.filter((e) => e.id !== entry.id)),
      () => deleteFoodLog(entry.id),
      "Couldn't remove it. The food is back.",
    );
  }
  function updateTargets(t: NutritionTargets) {
    setShowTargets(false);
    void optimisticUpdate<Diary>(
      queryClient,
      diaryKey,
      (d) => ({ ...d, targets: t, hasTargets: true }),
      () => saveTargets(t),
    );
  }
  function copyYesterday(meal: Meal) {
    // Show yesterday's foods straight away when they're already cached;
    // otherwise they appear when the save finishes.
    const from = shiftKey(date, -1);
    const source = queryClient.getQueryData<Diary>(qk.diary(from))?.entries.filter((e) => e.meal === meal) ?? [];
    void optimisticUpdate<Diary>(
      queryClient,
      diaryKey,
      (d) => withEntries(d, [...d.entries, ...source.map((e) => ({ ...e, id: tempId(), log_date: date }))]),
      () => copyMeal({ fromDate: from, toDate: date, meal }),
    );
  }
  const { date, entries, totals, targets, hasTargets } = diary;
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [savingMeal, setSavingMeal] = useState<{ meal: Meal; entries: FoodLogEntry[] } | null>(null);
  const [breakdown, setBreakdown] = useState<{ meal: Meal; entries: FoodLogEntry[] } | null>(null);

  const byMeal = (meal: Meal) => entries.filter((e) => e.meal === meal);
  const searchHref = (meal: Meal) =>
    `/nutrition/search?d=${date}&meal=${meal}`;

  const overCal = totals.calories > targets.daily_calories;

  const left = Math.round(targets.daily_calories - totals.calories);
  const loggedKcal = Math.round(totals.calories);

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <Link href="/" aria-label="Back" className={GLASS_BACK}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display text-[26px] font-bold tracking-[-0.02em]">Nutrition</h1>
        <button
          type="button"
          onClick={() => setShowTargets(true)}
          className="elevation-3 h-11 shrink-0 rounded-full bg-white/[0.08] px-[18px] text-sm font-semibold text-ink active:bg-white/15"
        >
          Targets
        </button>
      </div>

      {/* Day switcher */}
      <div className="elevation-1 flex h-12 items-center justify-between rounded-full px-1">
        <Link href={`/nutrition?d=${shiftKey(date, -1)}`} aria-label="Previous day" className="flex h-10 w-11 items-center justify-center rounded-full text-muted active:bg-white/10">
          <Chevron d="M15 18l-6-6 6-6" />
        </Link>
        <span className="truncate text-[15px] font-semibold">
          {heading(date, today)}
          {(date === today || date === shiftKey(today, -1)) && (
            <span className="font-normal text-muted"> · {formatWeekdayDayMonth(date)}</span>
          )}
          {date !== today && (
            <Link href={`/nutrition?d=${today}`} className="ml-2 text-xs font-semibold text-green">
              Today
            </Link>
          )}
        </span>
        <Link href={`/nutrition?d=${shiftKey(date, 1)}`} aria-label="Next day" className="flex h-10 w-11 items-center justify-center rounded-full text-muted active:bg-white/10">
          <Chevron d="M9 18l6-6-6-6" />
        </Link>
      </div>

      {/* Hero */}
      <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">{overCal ? "OVER TARGET" : "CALORIES LEFT"}</span>
            <span className={`font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em] ${overCal ? "text-gold" : ""}`}>
              {fmtThousands(Math.abs(left))}
            </span>
            <span className="text-[15px] text-[#D4D4D4]">
              of {fmtThousands(targets.daily_calories)} kcal · {fmtThousands(loggedKcal)} eaten
            </span>
          </div>
          <CalorieRing consumed={totals.calories} target={targets.daily_calories} over={overCal} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MACRO_META.map((m) => (
            <MacroTile key={m.key} label={m.label} consumed={Math.round(totals[m.key])} target={targets[m.targetKey]} />
          ))}
        </div>
        {!hasTargets && (
          <div className="flex items-center justify-between gap-3 border-t border-[#2C2C2C] pt-3.5">
            <span className="text-[13px] text-muted">Using default targets</span>
            <button type="button" onClick={() => setShowTargets(true)} className="text-[13px] font-semibold text-green active:opacity-70">
              Set your own
            </button>
          </div>
        )}
      </section>

      {/* Meals */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-xl font-semibold">Meals</h2>
          <span className="text-xs text-muted">{fmtThousands(loggedKcal)} kcal logged</span>
        </div>
        <div className="elevation-1 flex flex-col rounded-3xl">
          {MEALS.map((meal) => {
            const items = byMeal(meal);
            const sub = Math.round(items.reduce((n, e) => n + e.computed_calories, 0));
            return (
              <div key={meal} className="border-b border-surface-2 last:border-0">
                <div className="flex items-center gap-2.5 py-3.5 pl-[18px] pr-3.5">
                  <button
                    type="button"
                    disabled={items.length === 0}
                    onClick={() => setBreakdown({ meal, entries: items })}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 text-left disabled:cursor-default"
                  >
                    <span className="text-base font-semibold">{meal}</span>
                    <span className="text-[13px] text-subtle">
                      {items.length === 0 ? "Nothing logged" : `${items.length} ${items.length === 1 ? "item" : "items"} · ${sub} kcal`}
                    </span>
                  </button>
                  {items.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => copyYesterday(meal)}
                      className="h-9 shrink-0 px-2 text-[13px] font-medium text-muted active:text-ink disabled:opacity-50"
                    >
                      Copy yesterday
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSavingMeal({ meal, entries: items })}
                      className="h-9 shrink-0 px-2 text-[13px] font-medium text-muted active:text-ink"
                    >
                      Save meal
                    </button>
                  )}
                  <Link
                    href={searchHref(meal)}
                    className="elevation-2 flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold text-green active:bg-white/10"
                  >
                    Add food
                  </Link>
                </div>
                {items.length > 0 && (
                  <ul className="flex flex-col gap-1.5 px-3.5 pb-3.5">
                    {items.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          // A just-added food has no real id until its save lands.
                          disabled={e.id.startsWith("temp-")}
                          onClick={() => setEditing(e)}
                          className="elevation-2 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left active:bg-white/10"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.food_name}</span>
                            <span className="block truncate text-xs text-muted">
                              {trimQty(e.quantity)} {e.unit} · P {Math.round(e.computed_protein)} · C {Math.round(e.computed_carbs)} · F {Math.round(e.computed_fat)}
                            </span>
                          </span>
                          <span className="shrink-0 font-display text-[15px] font-semibold">{Math.round(e.computed_calories)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {editing && (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => editEntry(editing, patch)}
          onRemove={() => removeEntry(editing)}
        />
      )}

      {showTargets && (
        <TargetsSheet
          targets={targets}
          onClose={() => setShowTargets(false)}
          onSave={updateTargets}
        />
      )}

      {savingMeal && (
        <SaveMealSheet
          meal={savingMeal.meal}
          entries={savingMeal.entries}
          onClose={() => setSavingMeal(null)}
          onDone={() => setSavingMeal(null)}
        />
      )}

      {breakdown && (
        <MealBreakdownSheet
          meal={breakdown.meal}
          entries={breakdown.entries}
          onClose={() => setBreakdown(null)}
        />
      )}
    </main>
  );
}

// Per-meal macro breakdown: total kcal + P/C/F/fibre and each item's share.
function MealBreakdownSheet({
  meal,
  entries,
  onClose,
}: {
  meal: Meal;
  entries: FoodLogEntry[];
  onClose: () => void;
}) {
  const totals = sumMacros(entries);
  const rows: { label: string; value: string; color: string }[] = [
    { label: "Protein", value: `${Math.round(totals.protein)} g`, color: "#FFC95C" },
    { label: "Carbs", value: `${Math.round(totals.carbs)} g`, color: "#7FB2F0" },
    { label: "Fat", value: `${Math.round(totals.fat)} g`, color: "#3FAE8E" },
    { label: "Fibre", value: `${Math.round(totals.fiber)} g`, color: "#5EA0EF" },
  ];

  return (
    <Sheet title={meal} onClose={onClose}>
      <div className="px-4 pb-5 pt-1">
        <div className="mb-3 rounded-2xl bg-white/[0.04] p-4">
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums text-green">
              {Math.round(totals.calories)}
            </div>
            <div className="text-xs text-muted">kcal in this meal</div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {rows.map((r) => (
              <div key={r.label} className="text-center">
                <div className="text-base font-bold tabular-nums text-ink">{r.value}</div>
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                  {r.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </p>
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{e.food_name}</span>
                <span className="block truncate text-xs text-muted">
                  {trimQty(e.quantity)} {e.unit} · P{Math.round(e.computed_protein)} C
                  {Math.round(e.computed_carbs)} F{Math.round(e.computed_fat)} · Fib
                  {Math.round(e.computed_fiber)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {Math.round(e.computed_calories)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function SaveMealSheet({
  meal,
  entries,
  onClose,
  onDone,
}: {
  meal: Meal;
  entries: FoodLogEntry[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(`My ${meal}`);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveMeal({
        name,
        items: entries.map((e) => ({
          food_id: e.food_id,
          food_name: e.food_name,
          quantity: e.quantity,
          unit: e.unit,
          calories: e.computed_calories,
          protein: e.computed_protein,
          carbs: e.computed_carbs,
          fat: e.computed_fat,
          fiber: e.computed_fiber,
        })),
      });
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Save as meal" onClose={onClose}>
      <div className="px-4 pb-5 pt-2">
        <p className="mb-2 text-xs text-muted">
          Save these {entries.length} item{entries.length === 1 ? "" : "s"} as a reusable meal you
          can log in one tap.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-base text-ink outline-none focus:border-green"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="mt-3 w-full rounded-xl bg-green px-4 py-3 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save meal"}
        </button>
      </div>
    </Sheet>
  );
}

function trimQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// ---------- Calorie ring ----------

// 84px ring: green while under target, gold once over; a dot marks the start
// when nothing has been eaten yet.
function CalorieRing({
  consumed,
  target,
  over,
}: {
  consumed: number;
  target: number;
  over: boolean;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = fraction(consumed, target);
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${Math.round(consumed)} of ${target} kilocalories eaten`} className="shrink-0">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#2C2C2C" strokeWidth="9" />
      {frac > 0 ? (
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={over ? "#FFC95C" : "#22C55E"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform="rotate(-90 42 42)"
        />
      ) : (
        <circle cx="42" cy="8" r="4.5" fill="#22C55E" />
      )}
    </svg>
  );
}

function MacroTile({ label, consumed, target }: { label: string; consumed: number; target: number }) {
  const frac = fraction(consumed, target);
  const over = consumed > target;
  return (
    <div className="elevation-2 flex flex-col gap-2 rounded-2xl px-3.5 py-3">
      <span className="flex justify-between gap-2 text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">
          {consumed} / {target} g
        </span>
      </span>
      <span className="block h-[5px] rounded-full bg-[#3A3A3A]">
        {frac > 0 && (
          <span className={`block h-[5px] rounded-full ${over ? "bg-gold" : "bg-green"}`} style={{ width: `${frac * 100}%` }} />
        )}
      </span>
    </div>
  );
}

const GLASS_BACK =
  "elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15";

function Chevron({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Locale-free thousands grouping (SSR and client must match). */
function fmtThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------- Edit a logged entry (scale portion / remove) ----------

type EntryPatch = {
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

function EditEntrySheet({
  entry,
  onClose,
  onSave,
  onRemove,
}: {
  entry: FoodLogEntry;
  onClose: () => void;
  onSave: (patch: EntryPatch) => void;
  onRemove: () => void;
}) {
  const [qty, setQty] = useState(String(entry.quantity));

  // Macros scale linearly with quantity (same unit), so no food refetch needed.
  const factor =
    entry.quantity > 0 && Number(qty) > 0 ? Number(qty) / entry.quantity : 0;
  const scaled = {
    calories: Math.round(entry.computed_calories * factor),
    protein: Math.round(entry.computed_protein * factor),
    carbs: Math.round(entry.computed_carbs * factor),
    fat: Math.round(entry.computed_fat * factor),
    fiber: Math.round(entry.computed_fiber * factor),
  };

  function save() {
    onSave({
      quantity: Number(qty) || 0,
      calories: entry.computed_calories * factor,
      protein: entry.computed_protein * factor,
      carbs: entry.computed_carbs * factor,
      fat: entry.computed_fat * factor,
      fiber: entry.computed_fiber * factor,
    });
  }

  const remove = onRemove;

  return (
    <Sheet title={entry.food_name} onClose={onClose}>
      <div className="px-4 pb-5 pt-2">
        <label className="mb-1.5 block text-sm font-semibold text-ink">
          Quantity ({entry.unit})
        </label>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          type="number"
          inputMode="decimal"
          min={0}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-base text-ink outline-none focus:border-green"
        />

        <div className="mt-3 flex items-center justify-around rounded-xl bg-white/[0.04] py-3 text-center">
          <Stat n={scaled.calories} label="kcal" strong />
          <Stat n={scaled.protein} label="P" />
          <Stat n={scaled.carbs} label="C" />
          <Stat n={scaled.fat} label="F" />
          <Stat n={scaled.fiber} label="Fib" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={remove}
           
            className="flex-1 rounded-xl border border-gold/40 px-4 py-3 text-sm font-semibold text-gold active:bg-gold-soft disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={save}
            disabled={Number(qty) <= 0}
            className="flex-[1.6] rounded-xl bg-green px-4 py-3 text-sm font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function Stat({ n, label, strong }: { n: number; label: string; strong?: boolean }) {
  return (
    <div>
      <div className={`tabular-nums ${strong ? "text-lg font-bold text-green" : "text-base font-semibold text-ink"}`}>
        {n}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

// ---------- Targets editor ----------

function TargetsSheet({
  targets,
  onClose,
  onSave,
}: {
  targets: NutritionTargets;
  onClose: () => void;
  onSave: (t: NutritionTargets) => void;
}) {
  const [cal, setCal] = useState(String(targets.daily_calories));
  const [pro, setPro] = useState(String(targets.daily_protein_g));
  const [carb, setCarb] = useState(String(targets.daily_carbs_g));
  const [fat, setFat] = useState(String(targets.daily_fat_g));
  const [fib, setFib] = useState(String(targets.daily_fiber_g));

  function save() {
    // Whole numbers, as the server stores them.
    const n = (v: string) => Math.round(Number(v) || 0);
    onSave({
      daily_calories: n(cal),
      daily_protein_g: n(pro),
      daily_carbs_g: n(carb),
      daily_fat_g: n(fat),
      daily_fiber_g: n(fib),
    });
  }

  return (
    <Sheet title="Daily targets" onClose={onClose}>
      <div className="space-y-3 px-4 pb-5 pt-2">
        <TargetField label="Calories (kcal)" value={cal} onChange={setCal} />
        <div className="grid grid-cols-4 gap-2.5">
          <TargetField label="Protein (g)" value={pro} onChange={setPro} />
          <TargetField label="Carbs (g)" value={carb} onChange={setCarb} />
          <TargetField label="Fat (g)" value={fat} onChange={setFat} />
          <TargetField label="Fibre (g)" value={fib} onChange={setFib} />
        </div>
        <button
          type="button"
          onClick={save}
         
          className="w-full rounded-xl bg-green px-4 py-3 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          Save targets
        </button>
      </div>
    </Sheet>
  );
}

function TargetField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        inputMode="numeric"
        min={0}
        className="w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-base text-ink outline-none focus:border-green"
      />
    </div>
  );
}

// ---------- Shared bottom sheet ----------

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md elevation-3 rounded-t-3xl bg-page safe-bottom"
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <h3 className="truncate pr-3 text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:bg-white/10"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
