import { getGoalsData, getBadgeData } from "@/lib/data";
import { evaluateBadges } from "@/lib/badges";
import { toDateKey } from "@/lib/date";
import GoalsClient from "./GoalsClient";

export default async function GoalsPage() {
  const [goals, badgeData] = await Promise.all([getGoalsData(), getBadgeData()]);
  const badges = evaluateBadges(badgeData.stats, badgeData.earnedDates);
  return (
    <GoalsClient initial={goals} badges={badges} todayKey={toDateKey(new Date())} />
  );
}
