"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  copyMeal,
  deleteFoodLog,
  saveMeal,
  saveTargets,
  updateFoodLog,
} from "@/app/actions";
import {
  MEALS,
  MEAL_ICON,
  fraction,
  sumMacros,
  type FoodLogEntry,
  type Meal,
  type NutritionTargets,
} from "@/lib/nutrition";
import type { NutritionDiary as Diary } from "@/lib/data";

const MACRO_META = [
  { key: "protein", label: "Protein", color: "#FF6233", targetKey: "daily_protein_g" },
  { key: "carbs", label: "Carbs", color: "#E0A52A", targetKey: "daily_carbs_g" },
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
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function NutritionDiary({
  diary,
  today,
}: {
  diary: Diary;
  today: string;
}) {
  const router = useRouter();
  const { date, entries, totals, targets, hasTargets } = diary;
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [savingMeal, setSavingMeal] = useState<{ meal: Meal; entries: FoodLogEntry[] } | null>(null);
  const [breakdown, setBreakdown] = useState<{ meal: Meal; entries: FoodLogEntry[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const byMeal = (meal: Meal) => entries.filter((e) => e.meal === meal);
  const searchHref = (meal: Meal) =>
    `/nutrition/search?d=${date}&meal=${meal}`;

  const overCal = totals.calories > targets.daily_calories;

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center justify-between gap-2 py-4">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden>🍽️</span> Nutrition
        </h1>
        <button
          type="button"
          onClick={() => setShowTargets(true)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-surface px-3 py-1.5 text-sm font-medium text-muted active:bg-white/10"
        >
          ⚙︎ Targets
        </button>
      </header>

      {/* Date navigator */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-surface px-2 py-2">
        <Link
          href={`/nutrition?d=${shiftKey(date, -1)}`}
          aria-label="Previous day"
          className="flex h-9 w-10 items-center justify-center rounded-xl text-xl text-muted active:bg-white/10"
        >
          ‹
        </Link>
        <div className="text-center">
          <p className="text-base font-bold text-ink">{heading(date, today)}</p>
          {date !== today && (
            <Link href={`/nutrition?d=${today}`} className="text-xs font-medium text-green">
              Jump to today
            </Link>
          )}
        </div>
        <Link
          href={`/nutrition?d=${shiftKey(date, 1)}`}
          aria-label="Next day"
          className="flex h-9 w-10 items-center justify-center rounded-xl text-xl text-muted active:bg-white/10"
        >
          ›
        </Link>
      </div>

      {/* Calorie ring + macro bars */}
      <section className="mb-4 rounded-2xl border border-white/10 bg-surface p-4">
        <div className="flex items-center gap-4">
          <CalorieRing
            consumed={totals.calories}
            target={targets.daily_calories}
            over={overCal}
          />
          <div className="flex-1 space-y-2.5">
            {MACRO_META.map((m) => {
              const consumed = Math.round(totals[m.key]);
              const target = targets[m.targetKey];
              return (
                <MacroBar
                  key={m.key}
                  label={m.label}
                  color={m.color}
                  consumed={consumed}
                  target={target}
                />
              );
            })}
          </div>
        </div>
        {!hasTargets && (
          <button
            type="button"
            onClick={() => setShowTargets(true)}
            className="mt-3 w-full rounded-xl bg-green-tint px-3 py-2 text-xs font-medium text-green active:opacity-80"
          >
            Using default targets — tap to set your own →
          </button>
        )}
      </section>

      {/* Meals */}
      <div className="space-y-3">
        {MEALS.map((meal) => {
          const items = byMeal(meal);
          const sub = items.reduce((n, e) => n + e.computed_calories, 0);
          return (
            <section
              key={meal}
              className="overflow-hidden rounded-2xl border border-white/10 bg-surface"
            >
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setBreakdown({ meal, entries: items })}
                className="flex w-full items-center gap-2 px-4 pt-3.5 text-left disabled:cursor-default"
              >
                <span aria-hidden className="text-lg">
                  {MEAL_ICON[meal]}
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
                  {meal}
                </h2>
                {items.length > 0 && (
                  <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold tabular-nums text-muted">
                    {Math.round(sub)} kcal
                    <span aria-hidden className="text-xs">›</span>
                  </span>
                )}
              </button>

              <div className="px-4 pb-2 pt-1">
                {items.length === 0 ? (
                  <EmptyMeal
                    disabled={pending}
                    onCopyYesterday={() =>
                      startTransition(async () => {
                        await copyMeal({
                          fromDate: shiftKey(date, -1),
                          toDate: date,
                          meal,
                        });
                        router.refresh();
                      })
                    }
                  />
                ) : (
                  items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEditing(e)}
                      className="flex w-full items-center gap-3 border-b border-white/5 py-2.5 text-left last:border-0 active:opacity-70"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">
                          {e.food_name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {trimQty(e.quantity)} {e.unit} · P{Math.round(e.computed_protein)}
                          {" "}C{Math.round(e.computed_carbs)} F{Math.round(e.computed_fat)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                        {Math.round(e.computed_calories)}
                      </span>
                    </button>
                  ))
                )}

                <div className="mt-1 flex items-center justify-between">
                  <Link
                    href={searchHref(meal)}
                    className="flex items-center gap-1.5 py-2 text-sm font-semibold text-green active:opacity-70"
                  >
                    + Add food
                  </Link>
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSavingMeal({ meal, entries: items })}
                      className="py-2 text-xs font-medium text-muted active:text-ink"
                    >
                      Save as meal
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Primary CTA */}
      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-white/10 bg-page/95 px-4 pb-5 pt-3 backdrop-blur safe-bottom">
        <Link
          href={`/nutrition/search?d=${date}&meal=Breakfast`}
          className="flex w-full items-center justify-center rounded-2xl bg-green px-4 py-4 text-base font-bold text-ink-inverse transition active:scale-[0.98]"
        >
          + Log food
        </Link>
      </div>

      {editing && (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {showTargets && (
        <TargetsSheet
          targets={targets}
          onClose={() => setShowTargets(false)}
          onDone={() => {
            setShowTargets(false);
            router.refresh();
          }}
        />
      )}

      {savingMeal && (
        <SaveMealSheet
          meal={savingMeal.meal}
          entries={savingMeal.entries}
          onClose={() => setSavingMeal(null)}
          onDone={() => {
            setSavingMeal(null);
            router.refresh();
          }}
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
    { label: "Protein", value: `${Math.round(totals.protein)} g`, color: "#FF6233" },
    { label: "Carbs", value: `${Math.round(totals.carbs)} g`, color: "#E0A52A" },
    { label: "Fat", value: `${Math.round(totals.fat)} g`, color: "#3FAE8E" },
    { label: "Fibre", value: `${Math.round(totals.fiber)} g`, color: "#5EA0EF" },
  ];

  return (
    <Sheet title={`${MEAL_ICON[meal]}  ${meal}`} onClose={onClose}>
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

function CalorieRing({
  consumed,
  target,
  over,
}: {
  consumed: number;
  target: number;
  over: boolean;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const frac = fraction(consumed, target);
  const dash = c * frac;
  const remaining = Math.max(0, target - consumed);
  const color = over ? "#FF6233" : "#A8E830";

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {Math.round(consumed)}
        </span>
        <span className="text-[11px] text-muted">
          {over ? `+${Math.round(consumed - target)} over` : `${Math.round(remaining)} left`}
        </span>
        <span className="text-[10px] text-muted">of {target}</span>
      </div>
    </div>
  );
}

function MacroBar({
  label,
  color,
  consumed,
  target,
}: {
  label: string;
  color: string;
  consumed: number;
  target: number;
}) {
  const frac = fraction(consumed, target);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-muted">
          {consumed} / {target} g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${frac * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function EmptyMeal({
  disabled,
  onCopyYesterday,
}: {
  disabled: boolean;
  onCopyYesterday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <p className="text-sm italic text-muted">Nothing logged</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onCopyYesterday}
        className="shrink-0 text-xs font-medium text-muted underline-offset-2 active:underline disabled:opacity-50"
      >
        Copy yesterday
      </button>
    </div>
  );
}

// ---------- Edit a logged entry (scale portion / remove) ----------

function EditEntrySheet({
  entry,
  onClose,
  onDone,
}: {
  entry: FoodLogEntry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [qty, setQty] = useState(String(entry.quantity));
  const [busy, setBusy] = useState(false);

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

  async function save() {
    setBusy(true);
    try {
      await updateFoodLog({
        id: entry.id,
        quantity: Number(qty) || 0,
        unit: entry.unit,
        calories: entry.computed_calories * factor,
        protein: entry.computed_protein * factor,
        carbs: entry.computed_carbs * factor,
        fat: entry.computed_fat * factor,
        fiber: entry.computed_fiber * factor,
      });
      onDone();
    } catch {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteFoodLog(entry.id);
      onDone();
    } catch {
      setBusy(false);
    }
  }

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
            disabled={busy}
            className="flex-1 rounded-xl border border-orange/40 px-4 py-3 text-sm font-semibold text-orange active:bg-orange-soft disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || Number(qty) <= 0}
            className="flex-[1.6] rounded-xl bg-green px-4 py-3 text-sm font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
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
  onDone,
}: {
  targets: NutritionTargets;
  onClose: () => void;
  onDone: () => void;
}) {
  const [cal, setCal] = useState(String(targets.daily_calories));
  const [pro, setPro] = useState(String(targets.daily_protein_g));
  const [carb, setCarb] = useState(String(targets.daily_carbs_g));
  const [fat, setFat] = useState(String(targets.daily_fat_g));
  const [fib, setFib] = useState(String(targets.daily_fiber_g));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveTargets({
        daily_calories: Number(cal) || 0,
        daily_protein_g: Number(pro) || 0,
        daily_carbs_g: Number(carb) || 0,
        daily_fat_g: Number(fat) || 0,
        daily_fiber_g: Number(fib) || 0,
      });
      onDone();
    } catch {
      setBusy(false);
    }
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
          disabled={busy}
          className="w-full rounded-xl bg-green px-4 py-3 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save targets"}
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
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl bg-page shadow-xl safe-bottom"
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
