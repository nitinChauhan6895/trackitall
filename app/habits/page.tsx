import { getHabitsData } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import HabitsClient from "./HabitsClient";

export default async function HabitsPage() {
  const initial = await getHabitsData();
  return <HabitsClient initial={initial} fetchedAt={Date.now()} todayKey={toDateKey(new Date())} />;
}
