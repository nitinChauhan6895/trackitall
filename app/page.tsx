import Link from "next/link";
import {
  getMeasurements,
  getMonthWorkoutSummary,
  getProfile,
  getRecentPrs,
  getWorkoutStats,
} from "@/lib/data";
import { MEASUREMENT_FIELDS } from "@/lib/types";
import { MetricTile, PrTile, metricIcon } from "@/components/Tiles";
import {
  buildCalendarGrid,
  monthLabel,
  monthParam,
  nextMonth,
  parseMonthParam,
  prevMonth,
  toDateKey,
} from "@/lib/date";
import { MUSCLE_GROUP_LABELS, displayName } from "@/lib/types";
import ProfilePane from "@/components/ProfilePane";
import HomeTabs from "./HomeTabs";
import Community from "./Community";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const { year, month } = parseMonthParam(searchParams.m);
  const [profile, stats, workoutSummary, recentPrs, measurements] =
    await Promise.all([
      getProfile(),
      getWorkoutStats(),
      getMonthWorkoutSummary(year, month),
      getRecentPrs(2),
      getMeasurements(),
    ]);

  // Two headline measurement tiles: latest bodyweight + latest body-fat %.
  const measurementTiles = (["bodyweight", "body_fat_pct"] as const)
    .map((key) => {
      const field = MEASUREMENT_FIELDS.find((f) => f.key === key)!;
      const hit = measurements.find((m) => m[key] != null);
      return hit ? { field, value: hit[key]! } : null;
    })
    .filter((t): t is { field: (typeof MEASUREMENT_FIELDS)[number]; value: number } => t !== null);

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

  const firstName = profile.first_name || displayName(profile);

  const mySpace = (
    <>
      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
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
      <PreviewSection icon="🏆" title="PR corner" href="/prs">
        {recentPrs.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {recentPrs.map((pr) => (
              <PrTile key={pr.id} pr={pr} />
            ))}
          </div>
        ) : (
          <EmptyHint href="/prs">Add your first PR →</EmptyHint>
        )}
      </PreviewSection>

      {/* Measurements preview */}
      <PreviewSection icon="📏" title="Measurements" href="/measurements">
        {measurementTiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {measurementTiles.map(({ field, value }) => (
              <MetricTile
                key={field.key}
                icon={metricIcon(field.key)}
                label={field.label}
                value={String(value)}
                unit={field.unit}
              />
            ))}
          </div>
        ) : (
          <EmptyHint href="/measurements">Log your first measurement →</EmptyHint>
        )}
      </PreviewSection>

      {/* Log workout */}
      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-4 pb-5 pt-2 safe-bottom">
        <Link
          href={`/log/${todayKey}`}
          className="flex w-full items-center justify-center rounded-2xl bg-green px-4 py-4 text-base font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          + Log workout
        </Link>
      </div>
    </>
  );

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-start justify-between pb-1 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {firstName}</h1>
          <p className="mt-0.5 text-sm text-muted">{todayLabel}</p>
        </div>
        <ProfilePane profile={profile} />
      </header>

      <HomeTabs mySpace={mySpace} community={<Community />} />
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

function PreviewSection({
  icon,
  title,
  href,
  children,
}: {
  icon: string;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <span aria-hidden>{icon}</span> {title}
        </h2>
        <Link href={href} className="text-sm font-medium text-orange active:opacity-70">
          View all →
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-2xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-muted active:bg-black/5"
    >
      {children}
    </Link>
  );
}
