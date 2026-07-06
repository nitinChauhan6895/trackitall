import Link from "next/link";
import { getStatsData } from "@/lib/data";
import { toDateKey } from "@/lib/date";
import StatsView from "./StatsView";

export default async function StatsPage() {
  const stats = await getStatsData();

  if (!stats.hasAnyData) {
    const today = toDateKey(new Date());
    return (
      <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
        <header className="pb-1 pt-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span aria-hidden>📊</span> Stats
          </h1>
          <p className="mt-0.5 text-sm text-muted">Your progress at a glance</p>
        </header>
        <div className="mt-6 rounded-2xl border border-white/10 bg-surface p-6 text-center">
          <span aria-hidden className="text-4xl">📈</span>
          <p className="mt-3 text-base font-semibold text-ink">
            No workouts logged yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Start logging to see your stats here!
          </p>
          <Link
            href={`/log/${today}`}
            className="mt-4 inline-flex rounded-xl bg-green px-5 py-2.5 text-sm font-semibold text-ink-inverse active:scale-95"
          >
            + Log workout
          </Link>
        </div>
      </main>
    );
  }

  return <StatsView stats={stats} />;
}
