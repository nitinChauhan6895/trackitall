import { notFound } from "next/navigation";
import {
  getMyFoods,
  getRecentFoods,
  getSavedMeals,
  searchFoods,
} from "@/lib/data";
import { MEALS, type Meal } from "@/lib/nutrition";
import { toDateKey } from "@/lib/date";
import SearchClient from "./SearchClient";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { d?: string; meal?: string };
}) {
  const date =
    searchParams.d && DATE_RE.test(searchParams.d)
      ? searchParams.d
      : toDateKey(new Date());
  const meal: Meal = MEALS.includes(searchParams.meal as Meal)
    ? (searchParams.meal as Meal)
    : "Breakfast";
  if (!DATE_RE.test(date)) notFound();

  // Initial payloads for the tabs (search runs live client-side afterwards).
  const [initial, recent, myFoods, savedMeals] = await Promise.all([
    searchFoods("", 40),
    getRecentFoods(),
    getMyFoods(),
    getSavedMeals(),
  ]);

  return (
    <SearchClient
      date={date}
      meal={meal}
      initial={initial}
      recent={recent}
      myFoods={myFoods}
      savedMeals={savedMeals}
    />
  );
}
