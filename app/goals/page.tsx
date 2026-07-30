import { getGoalsData } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import GoalsClient from "./GoalsClient";

export default async function GoalsPage() {
  const goals = await getGoalsData();
  return <GoalsClient initial={goals} todayKey={toDateKey(new Date())} />;
}
