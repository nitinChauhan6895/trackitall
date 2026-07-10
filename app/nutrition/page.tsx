import { getNutritionDiary } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import NutritionDiary from "./NutritionDiary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  const date =
    searchParams.d && DATE_RE.test(searchParams.d)
      ? searchParams.d
      : toDateKey(new Date());
  const diary = await getNutritionDiary(date);
  return <NutritionDiary diary={diary} today={toDateKey(new Date())} />;
}
