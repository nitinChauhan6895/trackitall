import Link from "next/link";
import {
  getMonthWorkoutSummary,
  getRecentPrs,
  getUsername,
  getWorkoutStats,
} from "@/lib/data";
import {
  buildCalendarGrid,
  monthLabel,
  monthParam,
  nextMonth,
  parseMonthParam,
  prevMonth,
  toDateKey,
} from "@/lib/date";
import { MUSCLE_GROUP_LABELS, formatPrValue, type Pr } from "@/lib/types";
import { signOut } from "@/app/actions";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const { year, month } = parseMonthParam(searchParams.m);
  const [name, stats, workoutSummary, recentPrs] = await Promise.all([
    getUsername(),
    getWorkoutStats(),
    getMonthWorkoutSummary(year, month),
    getRecentPrs(3),
  ]);

  const grid = buildCalendarGrid(year, month);
  const today = new Date();
  const todayKey = toDateKey(today);
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-start justify-between pb-2 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {name}</h1>
          <p className="mt-0.5 text-sm text-muted">{todayLabel}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg px-2 py-1 text-sm text-muted active:text-ink"
          >
            Sign out
          </button>
        </form>
      </header>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatCard value={stats.last7} label="last 7 days" />
        <StatCard value={stats.last14} label="last 14 days" />
        <StatCard value={stats.month} label="this month" />
      </div>

      {/* Calendar */}
      <section className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/?m=${monthParam(prev.year, prev.month)}`}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-black/5"
          >
            ‹
          </Link>
          <h2 className="text-base font-semibold">{monthLabel(year, month)}</h2>
          <Link
            href={`/?m=${monthParam(next.year, next.month)}`}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-black/5"
          >
            ›
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {grid.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === month - 1;
            const groups = workoutSummary.get(key) ?? [];
            const hasWorkout = groups.length > 0;
            const isToday = key === todayKey;

            if (!inMonth) return <div key={key} aria-hidden />;

            return (
              <div key={key} className="flex flex-col items-center gap-1 py-0.5">
                <Link
                  href={hasWorkout ? `/day/${key}` : `/log/${key}`}
                  title={
                    hasWorkout
                      ? groups.map((g) => MUSCLE_GROUP_LABELS[g]).join(", ")
                      : undefined
                  }
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm transition active:scale-95",
                    hasWorkout
                      ? "bg-orange font-semibold text-white"
                      : "border border-black/15 text-ink",
                    isToday && !hasWorkout ? "ring-2 ring-green" : "",
                    isToday && hasWorkout ? "ring-2 ring-green ring-offset-1" : "",
                  ].join(" ")}
                >
                  {d.getDate()}
                </Link>
                <div className="flex h-1.5 items-center gap-0.5">
                  {hasWorkout &&
                    groups.slice(0, 4).map((g) => (
                      <span
                        key={g}
                        className="h-1 w-1 rounded-full bg-orange"
                        aria-hidden
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PR corner preview */}
      <PrPreview prs={recentPrs} />

      {/* Log workout */}
      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-4 pb-5 pt-2 safe-bottom">
        <Link
          href={`/log/${todayKey}`}
          className="flex w-full items-center justify-center rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          + Log workout
        </Link>
      </div>
    </main>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-beige px-3 py-4 text-center">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-orange">{label}</div>
    </div>
  );
}

function PrPreview({ prs }: { prs: Pr[] }) {
  return (
    <section className="mt-4 rounded-2xl bg-beige-pr p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <span aria-hidden>🏆</span> PR corner
        </h2>
        <Link href="/prs" className="text-sm font-medium text-orange">
          View all →
        </Link>
      </div>
      {prs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No PRs yet. Add your bests in the PR corner.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {prs.map((pr) => (
            <li key={pr.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">{pr.exercise_name}</span>
              <span className="font-semibold text-orange">
                {formatPrValue(pr)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
