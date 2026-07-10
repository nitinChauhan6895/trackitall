"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCustomFood,
  logFood,
  logSavedMeal,
  searchFoodsAction,
} from "@/app/actions";
import {
  MEALS,
  MEAL_ICON,
  macrosFor,
  perServingToPer100g,
  unitOptions,
  type Food,
  type FoodUnit,
  type Meal,
  type Portion,
  type SavedMeal,
} from "@/lib/nutrition";
import LabelScanner, { type ScanResult } from "./LabelScanner";

type Tab = "all" | "recent" | "my" | "meals";

export default function SearchClient({
  date,
  meal: initialMeal,
  initial,
  recent,
  myFoods,
  savedMeals,
}: {
  date: string;
  meal: Meal;
  initial: Food[];
  recent: Food[];
  myFoods: Food[];
  savedMeals: SavedMeal[];
}) {
  const router = useRouter();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>(initial);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Live search (debounced) for the All tab. An empty query reuses the
  // server-provided `initial` list — no redundant round-trip.
  useEffect(() => {
    if (tab !== "all") return;
    const term = query.trim();
    if (!term) {
      setResults(initial);
      setSearching(false);
      return;
    }
    clearTimeout(timer.current);
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchFoodsAction(term));
      } catch {
        /* keep previous results */
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [query, tab, initial]);

  const q = query.trim().toLowerCase();
  const filteredRecent = useMemo(
    () => (q ? recent.filter((f) => f.name.toLowerCase().includes(q)) : recent),
    [q, recent],
  );
  const filteredMine = useMemo(
    () => (q ? myFoods.filter((f) => f.name.toLowerCase().includes(q)) : myFoods),
    [q, myFoods],
  );
  const filteredMeals = useMemo(
    () => (q ? savedMeals.filter((m) => m.name.toLowerCase().includes(q)) : savedMeals),
    [q, savedMeals],
  );

  const shown = tab === "all" ? results : tab === "recent" ? filteredRecent : filteredMine;

  async function quickLogMeal(m: SavedMeal) {
    await logSavedMeal({ date, meal, savedMealId: m.id });
    router.push(`/nutrition?d=${date}`);
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-6 safe-top">
      <header className="flex items-center gap-3 py-4">
        <Link
          href={`/nutrition?d=${date}`}
          aria-label="Back to diary"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xl active:bg-white/10"
        >
          ←
        </Link>
        <h1 className="text-lg font-bold leading-tight">Add food</h1>
      </header>

      {/* Meal chooser */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            className={[
              "flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-xs font-semibold transition",
              m === meal
                ? "border-green bg-green-tint text-green"
                : "border-white/10 bg-surface text-muted",
            ].join(" ")}
          >
            <span aria-hidden className="text-base">
              {MEAL_ICON[m]}
            </span>
            {m}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods…"
          className="w-full rounded-2xl border border-white/10 bg-surface py-3 pl-10 pr-4 text-base text-ink outline-none placeholder:text-muted focus:border-green"
        />
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {([
          ["all", "All"],
          ["recent", "Recent"],
          ["my", "My foods"],
          ["meals", "Meals"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              tab === key ? "bg-green text-ink-inverse" : "bg-surface text-muted",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Create custom food entry */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="mb-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange/50 px-4 py-3 text-sm font-semibold text-orange active:bg-orange-soft"
      >
        + Create custom food
      </button>

      {/* Results */}
      {tab === "meals" ? (
        <SavedMealList meals={filteredMeals} onLog={quickLogMeal} />
      ) : (
        <ul className="space-y-2">
          {tab === "all" && searching && shown.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">Searching…</li>
          ) : shown.length === 0 ? (
            <li className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
              {tab === "recent"
                ? "No recently logged foods yet."
                : tab === "my"
                  ? "You haven't created any foods yet."
                  : "No foods found — create a custom food above."}
            </li>
          ) : (
            shown.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelected(f)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-surface px-4 py-3 text-left active:bg-white/10"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{f.name}</span>
                      {f.source === "custom" && (
                        <span className="shrink-0 rounded bg-orange-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange">
                          Custom
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {Math.round(f.calories_per_100g)} kcal · P{f.protein_per_100g} C
                      {f.carbs_per_100g} F{f.fat_per_100g} per 100{f.default_unit === "ml" ? "ml" : "g"}
                    </span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green text-lg font-bold text-ink-inverse">
                    +
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {selected && (
        <PortionSheet
          food={selected}
          meal={meal}
          date={date}
          onClose={() => setSelected(null)}
          onLogged={() => {
            router.push(`/nutrition?d=${date}`);
            router.refresh();
          }}
        />
      )}

      {creating && (
        <CustomFoodForm
          onClose={() => setCreating(false)}
          onCreated={(food) => {
            setCreating(false);
            setSelected(food);
          }}
        />
      )}
    </main>
  );
}

// ---------- Screen 3: portion & macros ----------

function PortionSheet({
  food,
  meal,
  date,
  onClose,
  onLogged,
}: {
  food: Food;
  meal: Meal;
  date: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const units = unitOptions(food);
  const initialUnit = food.default_unit === "piece" ? units[units.length > 1 ? 1 : 0] : units[0];
  const [unit, setUnit] = useState(initialUnit);
  const [qty, setQty] = useState(unit === "g" || unit === "ml" ? "100" : "1");
  const [busy, setBusy] = useState(false);

  const quantity = Number(qty) || 0;
  const macros = macrosFor(food, quantity, unit);

  async function add() {
    setBusy(true);
    try {
      await logFood({
        date,
        meal,
        food_id: food.id,
        food_name: food.name,
        quantity,
        unit,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      });
      onLogged();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Sheet title={food.name} onClose={onClose}>
      <div className="px-4 pb-5 pt-1">
        <p className="mb-3 text-xs text-muted">
          {Math.round(food.calories_per_100g)} kcal · P{food.protein_per_100g} C
          {food.carbs_per_100g} F{food.fat_per_100g} per 100
          {food.default_unit === "ml" ? "ml" : "g"}
        </p>

        {/* Portion chips */}
        {food.common_portions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {food.common_portions.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setUnit(p.label);
                  setQty("1");
                }}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  unit === p.label
                    ? "border-green bg-green-tint text-green"
                    : "border-white/10 bg-surface text-muted",
                ].join(" ")}
              >
                {p.label} ≈ {p.grams}g
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2.5">
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0}
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-base text-ink outline-none focus:border-green"
          />
          <select
            value={unit}
            onChange={(e) => {
              const u = e.target.value;
              setUnit(u);
              setQty(u === "g" || u === "ml" ? "100" : "1");
            }}
            className="shrink-0 rounded-xl border border-white/10 bg-surface-2 px-3 py-3 text-base text-ink outline-none focus:border-green"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* Live macros */}
        <div className="mt-3 flex items-center justify-around rounded-xl bg-white/[0.04] py-3 text-center">
          <Stat n={macros.calories} label="kcal" strong />
          <Stat n={macros.protein} label="protein" />
          <Stat n={macros.carbs} label="carbs" />
          <Stat n={macros.fat} label="fat" />
        </div>

        <button
          type="button"
          onClick={add}
          disabled={busy || quantity <= 0}
          className="mt-4 w-full rounded-xl bg-green px-4 py-3.5 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Adding…" : `Add to ${meal}`}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Custom food form (basis toggle + label OCR) ----------

function CustomFoodForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (food: Food) => void;
}) {
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<"per100" | "serving">("per100");
  const [servingG, setServingG] = useState("");
  const [cal, setCal] = useState("");
  const [pro, setPro] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [portionLabel, setPortionLabel] = useState("");
  const [portionGrams, setPortionGrams] = useState("");
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Values normalized to per-100g (what actually gets stored).
  const norm = useMemo(() => {
    const g = Number(servingG) || 0;
    const conv = (v: string) => {
      const n = Number(v) || 0;
      return basis === "serving" && g > 0 ? perServingToPer100g(n, g) : n;
    };
    return {
      calories: conv(cal),
      protein: conv(pro),
      carbs: conv(carb),
      fat: conv(fat),
    };
  }, [basis, servingG, cal, pro, carb, fat]);

  function applyScan(r: ScanResult) {
    if (r.calories != null) setCal(String(r.calories));
    if (r.protein != null) setPro(String(r.protein));
    if (r.carbs != null) setCarb(String(r.carbs));
    if (r.fat != null) setFat(String(r.fat));
    setScanned(true);
  }

  async function save() {
    setError("");
    if (!name.trim()) {
      setError("Enter a food name.");
      return;
    }
    if (basis === "serving" && (Number(servingG) || 0) <= 0) {
      setError("Enter the serving size in grams.");
      return;
    }
    const portions: Portion[] = [];
    if (portionLabel.trim() && Number(portionGrams) > 0)
      portions.push({ label: portionLabel.trim(), grams: Number(portionGrams) });

    setBusy(true);
    try {
      const food = await createCustomFood({
        name,
        calories_per_100g: norm.calories,
        protein_per_100g: norm.protein,
        carbs_per_100g: norm.carbs,
        fat_per_100g: norm.fat,
        default_unit: unit,
        common_portions: portions,
      });
      onCreated(food);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save.");
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

  return (
    <Sheet title="Create custom food" onClose={onClose} tall>
      <div className="space-y-3 overflow-y-auto px-4 pb-5 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Food name (e.g. Protein bar)"
          className={inputCls}
          autoFocus
        />

        <LabelScanner onScanned={applyScan} />
        {scanned && (
          <p className="rounded-lg bg-green-tint px-3 py-2 text-xs font-medium text-green">
            Scanned values filled in below — please check & correct them.
          </p>
        )}

        {/* Basis toggle */}
        <div className="flex gap-2">
          {([
            ["per100", "Per 100g/ml"],
            ["serving", "Per serving"],
          ] as ["per100" | "serving", string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasis(key)}
              className={[
                "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
                basis === key
                  ? "bg-green text-ink-inverse"
                  : "border border-white/10 bg-surface text-muted",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {basis === "serving" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Serving size (grams)
            </label>
            <input
              value={servingG}
              onChange={(e) => setServingG(e.target.value)}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="e.g. 40"
              className={inputCls}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Labeled label={`Calories ${basis === "serving" ? "/ serving" : "/ 100g"}`}>
            <input value={cal} onChange={(e) => setCal(e.target.value)} type="number" inputMode="decimal" min={0} className={inputCls} placeholder="kcal" />
          </Labeled>
          <Labeled label={`Protein ${basis === "serving" ? "/ serving" : "/ 100g"}`}>
            <input value={pro} onChange={(e) => setPro(e.target.value)} type="number" inputMode="decimal" min={0} className={inputCls} placeholder="g" />
          </Labeled>
          <Labeled label={`Carbs ${basis === "serving" ? "/ serving" : "/ 100g"}`}>
            <input value={carb} onChange={(e) => setCarb(e.target.value)} type="number" inputMode="decimal" min={0} className={inputCls} placeholder="g" />
          </Labeled>
          <Labeled label={`Fat ${basis === "serving" ? "/ serving" : "/ 100g"}`}>
            <input value={fat} onChange={(e) => setFat(e.target.value)} type="number" inputMode="decimal" min={0} className={inputCls} placeholder="g" />
          </Labeled>
        </div>

        {/* Per-100g sanity preview when entered per-serving */}
        {basis === "serving" && (Number(servingG) || 0) > 0 && (
          <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-muted">
            Stored as per 100g →{" "}
            <span className="font-semibold text-ink">{Math.round(norm.calories)} kcal</span>, P
            {norm.protein} C{norm.carbs} F{norm.fat}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Default unit</label>
          <div className="flex gap-2">
            {(["g", "ml", "piece"] as FoodUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={[
                  "flex-1 rounded-xl px-3 py-2 text-sm font-semibold",
                  unit === u ? "bg-green text-ink-inverse" : "border border-white/10 bg-surface text-muted",
                ].join(" ")}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Optional common portion */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Optional portion (e.g. “1 bar” = 40g)
          </label>
          <div className="flex gap-2.5">
            <input
              value={portionLabel}
              onChange={(e) => setPortionLabel(e.target.value)}
              placeholder="1 bar"
              className={`${inputCls} flex-1`}
            />
            <input
              value={portionGrams}
              onChange={(e) => setPortionGrams(e.target.value)}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="grams"
              className={`${inputCls} w-24`}
            />
          </div>
        </div>

        {error && <p className="text-sm text-orange">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="w-full rounded-xl bg-green px-4 py-3.5 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save & choose portion"}
        </button>
      </div>
    </Sheet>
  );
}

function SavedMealList({
  meals,
  onLog,
}: {
  meals: SavedMeal[];
  onLog: (m: SavedMeal) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (meals.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
        No saved meals yet. Log some foods, then save them as a meal for one-tap logging later.
      </p>
    );
  return (
    <ul className="space-y-2">
      {meals.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface px-4 py-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{m.name}</span>
            <span className="block truncate text-xs text-muted">
              {m.items.length} item{m.items.length === 1 ? "" : "s"} ·{" "}
              {Math.round(m.totals.calories)} kcal
            </span>
          </span>
          <button
            type="button"
            disabled={busyId === m.id}
            onClick={async () => {
              setBusyId(m.id);
              await onLog(m);
            }}
            className="shrink-0 rounded-lg bg-green px-3 py-1.5 text-sm font-bold text-ink-inverse active:scale-95 disabled:opacity-50"
          >
            {busyId === m.id ? "…" : "Log"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- shared bits ----------

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

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function Sheet({
  title,
  onClose,
  children,
  tall,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label={title}
        className={[
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col rounded-t-3xl bg-page shadow-xl safe-bottom",
          tall ? "max-h-[90vh]" : "max-h-[85vh]",
        ].join(" ")}
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
