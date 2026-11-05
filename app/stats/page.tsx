import Link from "next/link";
import { getNutritionWeek, getStatsData } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import StatsView from "./StatsView";

export default async function StatsPage() {
  const [stats, nutrition] = await Promise.all([
    getStatsData(),
    getNutritionWeek(),
  ]);

  if (!stats.hasAnyData) {
    const today = toDateKey(new Date());
    return (
      <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
        <header className="flex flex-col gap-1 px-1 pt-5">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Stats</h1>
          <p className="text-sm text-muted">Your progress at a glance</p>
        </header>
        <div className="elevation-1 rounded-[28px] p-6 text-center">
          <p className="font-display text-lg font-semibold text-ink">
            No workouts logged yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Start logging to see your stats here!
          </p>
          <Link
            href={`/log/${today}`}
            className="mt-4 inline-flex rounded-full bg-green px-5 py-2.5 text-sm font-semibold text-ink-inverse active:scale-95"
          >
            + Log workout
          </Link>
        </div>
      </main>
    );
  }

  return <StatsView stats={stats} nutrition={nutrition} />;
}
