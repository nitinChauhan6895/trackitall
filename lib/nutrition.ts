// Nutrition domain: types + pure compute. No I/O here (see lib/data.ts + actions).

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_ICON: Record<Meal, string> = {
  Breakfast: "🌅",
  Lunch: "🍛",
  Dinner: "🌙",
  Snack: "🍎",
};

export const FOOD_UNITS = ["g", "ml", "piece"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

export type Portion = { label: string; grams: number };

export type Food = {
  id: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  default_unit: FoodUnit;
  common_portions: Portion[];
  source: "seeded" | "custom";
  created_by: string | null;
};

export type FoodLogEntry = {
  id: string;
  log_date: string;
  meal: Meal;
  food_id: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  computed_calories: number;
  computed_protein: number;
  computed_carbs: number;
  computed_fat: number;
};

export type NutritionTargets = {
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
};

export const DEFAULT_TARGETS: NutritionTargets = {
  daily_calories: 2000,
  daily_protein_g: 120,
  daily_carbs_g: 220,
  daily_fat_g: 65,
};

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type SavedMealItem = {
  food_id: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  computed_calories: number;
  computed_protein: number;
  computed_carbs: number;
  computed_fat: number;
};

export type SavedMeal = {
  id: string;
  name: string;
  items: SavedMealItem[];
  totals: Macros;
};

// ---------- Pure compute ----------

const round1 = (n: number) => Math.round(n * 10) / 10;

// How many grams a (quantity, unit) resolves to for a given food.
// "g"/"ml" are 1:1; "piece" (or any common-portion label) uses the portion grams.
export function gramsFor(food: Food, quantity: number, unit: string): number {
  if (unit === "g" || unit === "ml") return quantity;
  const p = food.common_portions.find((cp) => cp.label === unit);
  if (p) return quantity * p.grams;
  // "piece" with no explicit portion → assume the first common portion, else 100g.
  if (unit === "piece" && food.common_portions[0])
    return quantity * food.common_portions[0].grams;
  return quantity; // unknown unit: treat as grams
}

// Macros for a serving (quantity in the given unit) of a food.
export function macrosFor(food: Food, quantity: number, unit: string): Macros {
  const g = gramsFor(food, quantity, unit);
  const k = g / 100;
  return {
    calories: Math.round(food.calories_per_100g * k),
    protein: round1(food.protein_per_100g * k),
    carbs: round1(food.carbs_per_100g * k),
    fat: round1(food.fat_per_100g * k),
  };
}

// Selectable units for a food: base unit + each common-portion label.
export function unitOptions(food: Food): string[] {
  const base = food.default_unit === "ml" ? "ml" : "g";
  const labels = food.common_portions.map((p) => p.label);
  const units = [base, ...labels];
  if (food.default_unit === "piece" && !labels.length) units.push("piece");
  return Array.from(new Set(units));
}

// Convert user-entered per-serving values to per-100g for storage.
// e.g. label says "250 kcal per 40g serving" → per-100g = value * 100 / 40.
export function perServingToPer100g(value: number, servingGrams: number): number {
  if (!servingGrams || servingGrams <= 0) return value;
  return round1((value * 100) / servingGrams);
}

export function sumMacros(entries: { computed_calories: number; computed_protein: number; computed_carbs: number; computed_fat: number }[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => ({
      calories: acc.calories + e.computed_calories,
      protein: acc.protein + e.computed_protein,
      carbs: acc.carbs + e.computed_carbs,
      fat: acc.fat + e.computed_fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Clamp a 0..1 fraction for ring/bar fills.
export const fraction = (consumed: number, target: number) =>
  target <= 0 ? 0 : Math.min(consumed / target, 1);
