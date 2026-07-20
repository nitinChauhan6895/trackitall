"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCustomFood,
  logFood,
  logSavedMeal,
  saveMeal,
  searchFoodsAction,
} from "@/app/actions";
import {
  MEALS,
  gramsFor,
  macrosFor,
  perServingToPer100g,
  unitOptions,
  type Food,
  type FoodUnit,
  type Meal,
  type Portion,
  type SavedMeal,
  type SavedMealItem,
} from "@/lib/nutrition";
import LabelScanner, { type ScanResult } from "./LabelScanner";

type Tab = "all" | "recent" | "my" | "meals";

// One ingredient in the meal builder (macros already computed for its weight).
type BuilderItem = {
  food_id: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

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
  const [quickAdd, setQuickAdd] = useState(false);
  const [building, setBuilding] = useState(false);
  // Local copy so a freshly-built meal shows immediately (router.refresh alone
  // doesn't reliably re-seed an already-mounted client prop).
  const [meals, setMeals] = useState<SavedMeal[]>(savedMeals);
  const [loggingMeal, setLoggingMeal] = useState<SavedMeal | null>(null);
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
    () => (q ? meals.filter((m) => m.name.toLowerCase().includes(q)) : meals),
    [q, meals],
  );

  const shown = tab === "all" ? results : tab === "recent" ? filteredRecent : filteredMine;

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
              "rounded-xl border px-1 py-2.5 text-sm font-semibold transition",
              m === meal
                ? "border-green bg-green-tint text-green"
                : "border-white/10 bg-surface text-muted",
            ].join(" ")}
          >
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

      {/* Create custom food + quick-add macros */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange/50 px-3 py-3 text-sm font-semibold text-orange active:bg-orange-soft"
        >
          + Custom food
        </button>
        <button
          type="button"
          onClick={() => setQuickAdd(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-green/50 px-3 py-3 text-sm font-semibold text-green active:bg-green-tint"
        >
          ✎ Quick add
        </button>
      </div>

      {/* Results */}
      {tab === "meals" ? (
        <>
          <button
            type="button"
            onClick={() => setBuilding(true)}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-green px-4 py-3 text-sm font-bold text-ink-inverse active:scale-[0.98]"
          >
            🍳 Build a meal from ingredients
          </button>
          <SavedMealList meals={filteredMeals} onLog={setLoggingMeal} />
        </>
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

      {quickAdd && (
        <QuickAddSheet
          meal={meal}
          date={date}
          onClose={() => setQuickAdd(false)}
          onLogged={() => {
            router.push(`/nutrition?d=${date}`);
            router.refresh();
          }}
        />
      )}

      {building && (
        <MealBuilder
          initialFoods={initial}
          onClose={() => setBuilding(false)}
          onSaved={(newMeal) => {
            setMeals((prev) => [newMeal, ...prev]);
            setBuilding(false);
            setTab("meals");
            router.refresh();
          }}
        />
      )}

      {loggingMeal && (
        <SavedMealLogSheet
          savedMeal={loggingMeal}
          meal={meal}
          date={date}
          onClose={() => setLoggingMeal(null)}
          onLogged={() => {
            router.push(`/nutrition?d=${date}`);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

// ---------- Log a saved meal (with a servings amount), portion-style UI ----------

function SavedMealLogSheet({
  savedMeal,
  meal,
  date,
  onClose,
  onLogged,
}: {
  savedMeal: SavedMeal;
  meal: Meal;
  date: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [amount, setAmount] = useState("1");
  const [selMeal, setSelMeal] = useState<Meal>(meal);
  const [busy, setBusy] = useState(false);

  const servings = Number(amount) || 0;
  const t = savedMeal.totals;
  const scaled = {
    calories: Math.round(t.calories * servings),
    protein: Math.round(t.protein * servings),
    carbs: Math.round(t.carbs * servings),
    fat: Math.round(t.fat * servings),
    fiber: Math.round(t.fiber * servings),
  };

  async function add() {
    setBusy(true);
    try {
      await logSavedMeal({ date, meal: selMeal, savedMealId: savedMeal.id, servings });
      onLogged();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Log meal" onClose={onClose} tall>
      <div className="flex max-h-[82dvh] flex-col overflow-y-auto px-4 pb-5 pt-1">
        <h2 className="text-center text-xl font-bold text-ink">{savedMeal.name}</h2>
        <p className="mb-4 text-center text-sm text-muted">
          {savedMeal.items.length} item{savedMeal.items.length === 1 ? "" : "s"} ·{" "}
          {Math.round(t.calories)} kcal per serving
        </p>

        {/* Servings amount */}
        <label className="mb-1.5 block text-sm font-semibold text-ink">Servings</label>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAmount(String(Math.max(0.5, Math.round((servings - 0.5) * 2) / 2)))}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-surface-2 text-2xl text-ink active:bg-white/10"
          >
            −
          </button>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            className="min-w-0 flex-1 rounded-2xl border border-orange/50 bg-surface-2 px-4 py-3 text-center text-2xl font-bold text-ink outline-none focus:border-green"
          />
          <button
            type="button"
            onClick={() => setAmount(String(Math.round((servings + 0.5) * 2) / 2))}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-surface-2 text-2xl text-ink active:bg-white/10"
          >
            +
          </button>
        </div>

        {/* Live macros */}
        <p className="mb-2 mt-4 text-sm text-muted">
          {trimNum(servings)} serving{servings === 1 ? "" : "s"}
        </p>
        <div className="grid grid-cols-4 gap-2">
          <MacroCard value={String(scaled.calories)} label="kcal" accent />
          <MacroCard value={`${scaled.protein}g`} label="protein" />
          <MacroCard value={`${scaled.carbs}g`} label="carbs" />
          <MacroCard value={`${scaled.fat}g`} label="fat" />
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          + <span className="font-semibold text-ink">{scaled.fiber}g</span> fibre
        </p>

        {/* Meal picker */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelMeal(m)}
              className={[
                "rounded-xl border px-1 py-2.5 text-sm font-semibold transition",
                m === selMeal
                  ? "border-orange bg-orange-soft text-orange"
                  : "border-white/10 bg-surface text-muted",
              ].join(" ")}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={add}
          disabled={busy || servings <= 0}
          className="mt-5 w-full rounded-2xl bg-green px-4 py-4 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Adding…" : `Add to ${selMeal}`}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Meal builder: combine ingredients → save as a reusable meal ----------

function MealBuilder({
  initialFoods,
  onClose,
  onSaved,
}: {
  initialFoods: Food[];
  onClose: () => void;
  onSaved: (meal: SavedMeal) => void;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>(initialFoods);
  const [picking, setPicking] = useState<Food | null>(null);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(initialFoods);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchFoodsAction(term));
      } catch {
        /* keep previous results visible */
      }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [query, initialFoods]);

  const totals = items.reduce(
    (a, it) => ({
      calories: a.calories + it.calories,
      protein: a.protein + it.protein,
      carbs: a.carbs + it.carbs,
      fat: a.fat + it.fat,
      fiber: a.fiber + it.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  async function save() {
    setError("");
    if (!name.trim()) {
      setError("Name your meal.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    setBusy(true);
    try {
      const { id } = await saveMeal({ name, items });
      const savedItems: SavedMealItem[] = items.map((it) => ({
        food_id: it.food_id,
        food_name: it.food_name,
        quantity: it.quantity,
        unit: it.unit,
        computed_calories: it.calories,
        computed_protein: it.protein,
        computed_carbs: it.carbs,
        computed_fat: it.fat,
        computed_fiber: it.fiber,
      }));
      onSaved({ id, name: name.trim(), items: savedItems, totals });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save.");
      setBusy(false);
    }
  }

  // Fixed-height panel so the layout never reflows as search results change.
  return (
    <Sheet title="Build a meal" onClose={onClose} tall>
      <div className="flex h-[78dvh] flex-col px-4 pb-4 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meal name (e.g. My egg breakfast)"
          className="mb-2 w-full shrink-0 rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green"
          autoFocus
        />

        {/* Running total */}
        <div className="mb-2 flex shrink-0 items-center justify-around rounded-xl bg-white/[0.04] py-2.5 text-center">
          <Stat n={Math.round(totals.calories)} label="kcal" strong />
          <Stat n={Math.round(totals.protein)} label="P" />
          <Stat n={Math.round(totals.carbs)} label="C" />
          <Stat n={Math.round(totals.fat)} label="F" />
          <Stat n={Math.round(totals.fiber)} label="Fib" />
        </div>

        {/* Selected ingredients (name + quantity) */}
        <p className="mb-1 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
          {items.length === 0 ? "No ingredients yet" : `Added · ${items.length}`}
        </p>
        <ul className="mb-2 max-h-28 shrink-0 space-y-1 overflow-y-auto">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{it.food_name}</span>
                <span className="block truncate text-xs text-muted">
                  {trimNum(it.quantity)} {it.unit} · {Math.round(it.calories)} kcal
                </span>
              </span>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="shrink-0 px-1 text-lg text-muted active:text-orange"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        {/* Ingredient search */}
        <div className="relative mb-2 shrink-0">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search to add an ingredient…"
            className="w-full rounded-xl border border-white/10 bg-surface py-2.5 pl-9 pr-3 text-base text-ink outline-none placeholder:text-muted focus:border-green"
          />
        </div>

        {/* Results — the only region that scrolls; height stays constant */}
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {results.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted">No foods found.</li>
          ) : (
            results.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setPicking(f)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-left active:bg-white/10"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted">{Math.round(f.calories_per_100g)} kcal/100g</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green text-base font-bold text-ink-inverse">+</span>
                </button>
              </li>
            ))
          )}
        </ul>

        {error && <p className="mt-2 shrink-0 text-sm text-orange">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-2 w-full shrink-0 rounded-xl bg-green px-4 py-3 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : `Save meal${items.length ? ` · ${Math.round(totals.calories)} kcal` : ""}`}
        </button>
      </div>

      {picking && (
        <PortionSheet
          food={picking}
          meal="Breakfast"
          date=""
          onClose={() => setPicking(null)}
          onLogged={() => {}}
          onAddToBuilder={(item) => {
            setItems((prev) => [...prev, item]);
            setPicking(null);
          }}
        />
      )}
    </Sheet>
  );
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// ---------- Screen 3: portion & macros ----------

function PortionSheet({
  food,
  meal,
  date,
  onClose,
  onLogged,
  onAddToBuilder,
}: {
  food: Food;
  meal: Meal;
  date: string;
  onClose: () => void;
  onLogged: () => void;
  onAddToBuilder?: (item: BuilderItem) => void;
}) {
  const units = unitOptions(food);
  const baseUnit = food.default_unit === "ml" ? "ml" : "g";
  const initialUnit = food.default_unit === "piece" ? units[units.length > 1 ? 1 : 0] : units[0];
  const [unit, setUnit] = useState(initialUnit);
  const [qty, setQty] = useState(unit === "g" || unit === "ml" ? "100" : "1");
  const [selMeal, setSelMeal] = useState<Meal>(meal);
  const [busy, setBusy] = useState(false);

  const quantity = Number(qty) || 0;
  const grams = gramsFor(food, quantity, unit);
  const macros = macrosFor(food, quantity, unit);
  const per100Label = food.default_unit === "ml" ? "ml" : "g";

  async function add() {
    // Builder mode: accumulate into the draft meal instead of logging to a day.
    if (onAddToBuilder) {
      onAddToBuilder({
        food_id: food.id,
        food_name: food.name,
        quantity,
        unit,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
      });
      onClose();
      return;
    }
    setBusy(true);
    try {
      await logFood({
        date,
        meal: selMeal,
        food_id: food.id,
        food_name: food.name,
        quantity,
        unit,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
      });
      onLogged();
    } catch {
      setBusy(false);
    }
  }

  const setBaseQty = (n: number) => {
    setUnit(baseUnit);
    setQty(String(n));
  };

  return (
    <Sheet title="Add food" onClose={onClose} tall>
      <div className="flex max-h-[82dvh] flex-col overflow-y-auto px-4 pb-5 pt-1">
        {/* Food identity */}
        <h2 className="text-center text-xl font-bold text-ink">{food.name}</h2>
        <p className="mb-4 text-center text-sm text-muted">
          {Math.round(food.calories_per_100g)} kcal · P{food.protein_per_100g} C
          {food.carbs_per_100g} F{food.fat_per_100g} per 100{per100Label}
        </p>

        {/* Quantity + unit */}
        <div className="flex gap-2.5">
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0}
            autoFocus
            className="min-w-0 flex-[1.6] rounded-2xl border border-orange/50 bg-surface-2 px-4 py-3.5 text-center text-2xl font-bold text-ink outline-none focus:border-green"
          />
          <select
            value={unit}
            onChange={(e) => {
              const u = e.target.value;
              setUnit(u);
              setQty(u === "g" || u === "ml" ? "100" : "1");
            }}
            className="flex-1 rounded-2xl border border-white/10 bg-surface-2 px-3 py-3.5 text-base text-ink outline-none focus:border-green"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u === "g" ? "grams" : u === "ml" ? "ml" : u}
              </option>
            ))}
          </select>
        </div>

        {/* Quick portion chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {food.default_unit !== "piece" && (
            <>
              <PortionChip on={unit === baseUnit && quantity === 50} onClick={() => setBaseQty(50)}>
                50{baseUnit}
              </PortionChip>
              <PortionChip on={unit === baseUnit && quantity === 100} onClick={() => setBaseQty(100)}>
                100{baseUnit}
              </PortionChip>
            </>
          )}
          {food.common_portions.map((p) => (
            <PortionChip
              key={p.label}
              on={unit === p.label}
              onClick={() => {
                setUnit(p.label);
                setQty("1");
              }}
            >
              {p.label} ≈ {p.grams}g
            </PortionChip>
          ))}
        </div>

        {/* Live macros for this serving */}
        <p className="mb-2 mt-4 text-sm text-muted">This serving ({trimNum(grams)}g)</p>
        <div className="grid grid-cols-4 gap-2">
          <MacroCard value={String(macros.calories)} label="kcal" accent />
          <MacroCard value={`${macros.protein}g`} label="protein" />
          <MacroCard value={`${macros.carbs}g`} label="carbs" />
          <MacroCard value={`${macros.fat}g`} label="fat" />
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          + <span className="font-semibold text-ink">{macros.fiber}g</span> fibre
        </p>

        {/* Meal picker (hidden in builder mode) */}
        {!onAddToBuilder && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {MEALS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelMeal(m)}
                className={[
                  "rounded-xl border px-1 py-2.5 text-sm font-semibold transition",
                  m === selMeal
                    ? "border-orange bg-orange-soft text-orange"
                    : "border-white/10 bg-surface text-muted",
                ].join(" ")}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={add}
          disabled={busy || quantity <= 0}
          className="mt-5 w-full rounded-2xl bg-green px-4 py-4 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Adding…" : onAddToBuilder ? "Add to meal" : `Add to ${selMeal}`}
        </button>
      </div>
    </Sheet>
  );
}

function PortionChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-xs font-semibold",
        on ? "border-green bg-green-tint text-green" : "border-white/10 bg-surface text-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MacroCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 py-3 text-center">
      <div className={`text-lg font-bold tabular-nums ${accent ? "text-green" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

// ---------- Quick add: type macros directly (no food item) ----------

function QuickAddSheet({
  meal,
  date,
  onClose,
  onLogged,
}: {
  meal: Meal;
  date: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [label, setLabel] = useState("");
  const [cal, setCal] = useState("");
  const [pro, setPro] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");
  const [fib, setFib] = useState("");
  const [selMeal, setSelMeal] = useState<Meal>(meal);
  const [busy, setBusy] = useState(false);

  const num = (s: string) => Math.max(0, Number(s) || 0);
  const anyValue = [cal, pro, carb, fat, fib].some((v) => num(v) > 0);

  async function add() {
    setBusy(true);
    try {
      await logFood({
        date,
        meal: selMeal,
        food_id: null,
        food_name: label.trim() || "Quick add",
        quantity: 1,
        unit: "serving",
        calories: num(cal),
        protein: num(pro),
        carbs: num(carb),
        fat: num(fat),
        fiber: num(fib),
      });
      onLogged();
    } catch {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

  return (
    <Sheet title="Quick add" onClose={onClose} tall>
      <div className="flex max-h-[82dvh] flex-col overflow-y-auto px-4 pb-5 pt-1">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional, e.g. Restaurant meal)"
          className={`${inputCls} mb-3`}
          autoFocus
        />

        <Labeled label="Calories (kcal)">
          <input
            value={cal}
            onChange={(e) => setCal(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0"
            className={`${inputCls} text-center text-xl font-bold`}
          />
        </Labeled>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <Labeled label="Protein (g)">
            <input value={pro} onChange={(e) => setPro(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className={`${inputCls} text-center`} />
          </Labeled>
          <Labeled label="Carbs (g)">
            <input value={carb} onChange={(e) => setCarb(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className={`${inputCls} text-center`} />
          </Labeled>
          <Labeled label="Fat (g)">
            <input value={fat} onChange={(e) => setFat(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className={`${inputCls} text-center`} />
          </Labeled>
          <Labeled label="Fibre (g)">
            <input value={fib} onChange={(e) => setFib(e.target.value)} type="number" inputMode="decimal" min={0} placeholder="0" className={`${inputCls} text-center`} />
          </Labeled>
        </div>

        {/* Meal picker */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelMeal(m)}
              className={[
                "rounded-xl border px-1 py-2.5 text-sm font-semibold transition",
                m === selMeal
                  ? "border-orange bg-orange-soft text-orange"
                  : "border-white/10 bg-surface text-muted",
              ].join(" ")}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={add}
          disabled={busy || !anyValue}
          className="mt-5 w-full rounded-2xl bg-green px-4 py-4 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Adding…" : `Add to ${selMeal}`}
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
  const [fib, setFib] = useState("");
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
      fiber: conv(fib),
    };
  }, [basis, servingG, cal, pro, carb, fat, fib]);

  function applyScan(r: ScanResult) {
    if (r.calories != null) setCal(String(r.calories));
    if (r.protein != null) setPro(String(r.protein));
    if (r.carbs != null) setCarb(String(r.carbs));
    if (r.fat != null) setFat(String(r.fat));
    if (r.fiber != null) setFib(String(r.fiber));
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
        fiber_per_100g: norm.fiber,
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
          <Labeled label={`Fibre ${basis === "serving" ? "/ serving" : "/ 100g"}`}>
            <input value={fib} onChange={(e) => setFib(e.target.value)} type="number" inputMode="decimal" min={0} className={inputCls} placeholder="g" />
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
            onClick={() => onLog(m)}
            className="shrink-0 rounded-lg bg-green px-3 py-1.5 text-sm font-bold text-ink-inverse active:scale-95"
          >
            Log
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
          tall ? "max-h-[90dvh]" : "max-h-[85dvh]",
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
