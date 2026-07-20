import { getHabitsData } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import HabitsClient from "./HabitsClient";

export default async function HabitsPage() {
  const initial = await getHabitsData();
  return <HabitsClient initial={initial} todayKey={toDateKey(new Date())} />;
}
