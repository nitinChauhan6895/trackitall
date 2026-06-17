import { Suspense, cache } from "react";
import Link from "next/link";
import {
  getBadgeData,
  getMeasurements,
  getMonthWorkoutSummary,
  getProfile,
  getRecentPrs,
  getWorkoutStats,
} from "@/lib/data";
import {
  MEASUREMENT_FIELDS,
  displayName,
  type Measurement,
  type MeasurementField,
} from "@/lib/types";
import { evaluateBadges, sortedByEarned } from "@/lib/badges";
import {
  buildCalendarGrid,
  monthLabel,
  monthParam,
  nextMonth,
  parseMonthParam,
  prevMonth,
  toDateKey,
} from "@/lib/date";
import { Badge } from "@/components/Badge";
import { MeasurementCard, PrCard } from "@/components/HomeCards";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Deduped per request: the streak pill and the badges row share one query.
const loadBadges = cache(getBadgeData);

// Oldest→newest values for a metric, plus this-month delta vs. last month.
function metricSeries(measurements: Measurement[], key: MeasurementField) {
  const asc = measurements.filter((m) => m[key] != null).slice().reverse();
  const values = asc.map((m) => m[key] as number);
  const latest = values.length ? values[values.length - 1] : null;

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  let baseline: number | null = null;
  for (const m of asc) {
    if (m.entry_date < firstOfMonth) baseline = m[key] as number;
    else break;
  }
  const delta =
    latest != null && baseline != null
      ? Math.round((latest - baseline) * 10) / 10
      : null;
  return { values, latest, delta };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const { year, month } = parseMonthParam(searchParams.m);

  // Above-the-fold shell only — keeps first paint off the heavy badge scan.
  const [profile, stats, workoutSummary] = await Promise.all([
    getProfile(),
    getWorkoutStats(),
    getMonthWorkoutSummary(year, month),
  ]);

  const grid = buildCalendarGrid(year, month);
  const todayKey = toDateKey(new Date());
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const firstName = profile.first_name || displayName(profile);
  const todayLabel = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 pb-3 pt-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Hi, {firstName}! 👋</h1>
          <p className="mt-0.5 text-sm text-muted">{todayLabel}</p>
        </div>
        <Suspense fallback={<StreakPillSkeleton />}>
          <StreakPill />
        </Suspense>
      </header>

      {/* Calendar */}
      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{monthLabel(year, month)}</h2>
          <div className="flex items-center gap-1">
            <Link href={`/?m=${monthParam(prev.year, prev.month)}`} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-black/5">‹</Link>
            <Link href={`/?m=${monthParam(next.year, next.month)}`} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-black/5">›</Link>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="py-1">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {grid.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === month - 1;
            if (!inMonth) return <div key={key} aria-hidden />;
            const groups = workoutSummary.get(key) ?? [];
            const hasWorkout = groups.length > 0;
            const isToday = key === todayKey;
            return (
              <div key={key} className="flex flex-col items-center gap-1 py-0.5">
                <Link
                  href={hasWorkout ? `/day/${key}` : `/log/${key}`}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm transition active:scale-95",
                    isToday ? "bg-orange font-bold text-white ring-2 ring-green ring-offset-2" : "bg-black/[0.04] text-ink",
                  ].join(" ")}
                >
                  {d.getDate()}
                </Link>
                <div className="flex h-1.5 items-center gap-0.5">
                  {hasWorkout &&
                    groups.slice(0, 3).map((g, i) => (
                      <span key={g + i} className={["h-1 w-1 rounded-full", i % 2 === 0 ? "bg-green" : "bg-orange"].join(" ")} aria-hidden />
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <span aria-hidden>📊</span> {stats.month} Workouts this month
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span aria-hidden>🏆</span> Keep it up!
          </span>
        </div>
      </section>

      {/* Badges (streamed) */}
      <PreviewSection icon="🏅" title="Badges" href="/badges">
        <Suspense fallback={<BadgesSkeleton />}>
          <BadgesPreview />
        </Suspense>
      </PreviewSection>

      {/* PR corner (streamed) */}
      <PreviewSection icon="🏆" title="PR Corner" href="/prs">
        <Suspense fallback={<CardsSkeleton />}>
          <PrPreview />
        </Suspense>
      </PreviewSection>

      {/* Measurements (streamed) */}
      <PreviewSection icon="📏" title="Measurements" href="/measurements">
        <Suspense fallback={<CardsSkeleton />}>
          <MeasurementsPreview />
        </Suspense>
      </PreviewSection>
    </main>
  );
}

async function StreakPill() {
  const { stats } = await loadBadges();
  return (
    <Link
      href="/badges"
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange/30 bg-orange-soft px-3 py-2 text-sm font-semibold text-orange active:scale-95"
    >
      <span aria-hidden>🔥</span> {stats.currentStreak} Day Streak
      <span aria-hidden className="text-muted">›</span>
    </Link>
  );
}

function StreakPillSkeleton() {
  return <div className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-orange-soft" />;
}

async function BadgesPreview() {
  const { stats, earnedDates } = await loadBadges();
  const previewBadges = sortedByEarned(evaluateBadges(stats, earnedDates)).slice(0, 4);
  return (
    <div className="grid grid-cols-4 gap-2">
      {previewBadges.map((b) => (
        <Badge key={b.id} badge={b} size="sm" />
      ))}
    </div>
  );
}

function BadgesSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-black/5" />
      ))}
    </div>
  );
}

async function PrPreview() {
  const recentPrs = await getRecentPrs(2);
  if (recentPrs.length === 0)
    return <EmptyHint href="/prs">Add your first PR →</EmptyHint>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {recentPrs.map((pr) => (
        <PrCard key={pr.id} pr={pr} />
      ))}
    </div>
  );
}

async function MeasurementsPreview() {
  const measurements = await getMeasurements();
  const bw = metricSeries(measurements, "bodyweight");
  const bf = metricSeries(measurements, "body_fat_pct");
  const cards: React.ReactNode[] = [];
  if (bw.latest != null)
    cards.push(
      <MeasurementCard key="bw" icon="⚖️" label="Bodyweight" value={String(bw.latest)} unit="kg" delta={bw.delta} series={bw.values} colorClass="text-green" />,
    );
  if (bf.latest != null)
    cards.push(
      <MeasurementCard key="bf" icon="📊" label="Body fat" value={String(bf.latest)} unit="%" delta={bf.delta} series={bf.values} colorClass="text-[#3E7CC2]" />,
    );
  if (cards.length === 0)
    return <EmptyHint href="/measurements">Log your first measurement →</EmptyHint>;
  return <div className="grid grid-cols-2 gap-3">{cards}</div>;
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-[116px] animate-pulse rounded-2xl bg-black/5" />
      ))}
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
          View all ›
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-2xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-muted active:bg-black/5"
    >
      {children}
    </Link>
  );
}
