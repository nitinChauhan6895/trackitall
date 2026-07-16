import { Suspense, cache } from "react";
import Link from "next/link";
import {
  getBadgeData,
  getMeasurements,
  getMonthWorkoutSummary,
  getNutritionDiary,
  getProfile,
  getAllPrs,
  getRecentTraining,
} from "@/lib/data";
import CalendarCard from "./CalendarCard";
import { fraction } from "@/lib/nutrition";
import {
  MEASUREMENT_FIELDS,
  MUSCLE_GROUP_LABELS,
  displayName,
  profileInitial,
  type Measurement,
  type MeasurementField,
  type MuscleGroup,
} from "@/lib/types";
import MuscleIcon, { MUSCLE_TONE } from "@/components/MuscleIcon";
import { evaluateBadges, sortedByEarned } from "@/lib/badges";
import { groupPrs } from "@/lib/prGroups";
import { parseMonthParam, toDateKey } from "@/lib/date";
import { Badge } from "@/components/Badge";
import { MeasurementCard, PrCard } from "@/components/HomeCards";

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
  // The calendar's summary seeds the client CalendarCard (instant month nav).
  const [profile, workoutSummary] = await Promise.all([
    getProfile(),
    getMonthWorkoutSummary(year, month),
  ]);

  const todayKey = toDateKey(new Date());
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
        <Link
          href="/profile"
          aria-label="Profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-beige text-lg font-bold text-ink active:scale-95"
        >
          {profileInitial(profile)}
        </Link>
      </header>

      {/* Calendar — client component with instant, cache-backed month nav */}
      <CalendarCard
        initialYear={year}
        initialMonth={month}
        initialSummary={Object.fromEntries(workoutSummary)}
        todayKey={todayKey}
      />

      {/* Last 7 days trained (streamed) */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <span aria-hidden>💪</span> Last 7 days
          </h2>
          <Link href="/stats" className="text-sm font-medium text-orange active:opacity-70">
            Stats ›
          </Link>
        </div>
        <Suspense fallback={<RecentTrainingSkeleton />}>
          <RecentTraining />
        </Suspense>
      </section>

      {/* Nutrition (streamed) */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <span aria-hidden>🍽️</span> Nutrition
          </h2>
          <Link href="/nutrition" className="text-sm font-medium text-orange active:opacity-70">
            Open diary ›
          </Link>
        </div>
        <Suspense fallback={<NutritionSkeleton />}>
          <NutritionPreview date={todayKey} />
        </Suspense>
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

async function BadgesPreview() {
  const { stats, earnedDates } = await loadBadges();
  const previewBadges = sortedByEarned(evaluateBadges(stats, earnedDates)).slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-3">
      {previewBadges.map((b) => (
        <Badge key={b.id} badge={b} size="sm" />
      ))}
    </div>
  );
}

function BadgesSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-white/10" />
      ))}
    </div>
  );
}

async function PrPreview() {
  // One card per exercise (current best), most recently active first.
  const groups = groupPrs(await getAllPrs()).slice(0, 2);
  if (groups.length === 0)
    return <EmptyHint href="/prs">Add your first PR →</EmptyHint>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {groups.map((g) => (
        <PrCard key={g.key} pr={g.best} />
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
      <MeasurementCard key="bf" icon="📊" label="Body fat" value={String(bf.latest)} unit="%" delta={bf.delta} series={bf.values} colorClass="text-[#7FB2F0]" />,
    );
  if (cards.length === 0)
    return <EmptyHint href="/measurements">Log your first measurement →</EmptyHint>;
  return <div className="grid grid-cols-2 gap-3">{cards}</div>;
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-[116px] animate-pulse rounded-2xl bg-white/10" />
      ))}
    </div>
  );
}

async function NutritionPreview({ date }: { date: string }) {
  const { totals, targets, entries } = await getNutritionDiary(date);
  const kcal = Math.round(totals.calories);
  const over = kcal > targets.daily_calories;
  const frac = fraction(kcal, targets.daily_calories);
  const r = 26;
  const c = 2 * Math.PI * r;
  const macros: { label: string; v: number; t: number; color: string }[] = [
    { label: "P", v: totals.protein, t: targets.daily_protein_g, color: "#FF6233" },
    { label: "C", v: totals.carbs, t: targets.daily_carbs_g, color: "#E0A52A" },
    { label: "F", v: totals.fat, t: targets.daily_fat_g, color: "#3FAE8E" },
  ];

  return (
    <Link
      href="/nutrition"
      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-4 active:bg-white/[0.04]"
    >
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="7" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={over ? "#FF6233" : "#A8E830"}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${c * frac} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-ink">{kcal}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {entries.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged today — tap to start →</p>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">
              {kcal} <span className="text-muted">/ {targets.daily_calories} kcal</span>
            </p>
            <div className="mt-2 space-y-1.5">
              {macros.map((m) => (
                <div key={m.label} className="flex items-center gap-2">
                  <span className="w-3 text-[11px] font-semibold text-muted">{m.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${fraction(m.v, m.t) * 100}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

function NutritionSkeleton() {
  return <div className="h-[104px] animate-pulse rounded-2xl bg-white/10" />;
}

// Weekday label for a date key, relative for today/yesterday.
function dayLabels(key: string, isToday: boolean): { top: string; sub: string } {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const sub = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (isToday) return { top: "Today", sub };
  if (key === toDateKey(yest)) return { top: "Yesterday", sub };
  return { top: dt.toLocaleDateString(undefined, { weekday: "short" }), sub };
}

async function RecentTraining() {
  const days = await getRecentTraining(7);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
      {days.map((day) => {
        const { top, sub } = dayLabels(day.key, day.isToday);
        const href = day.groups.length ? `/day/${day.key}` : `/log/${day.key}`;
        return (
          <Link
            key={day.key}
            href={href}
            className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0 active:bg-white/[0.04]"
          >
            <div className="w-16 shrink-0">
              <p className="text-sm font-semibold text-ink">{top}</p>
              <p className="text-[11px] text-muted">{sub}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {day.groups.length === 0 ? (
                <span className="text-xs italic text-muted">Rest day</span>
              ) : (
                day.groups.map((g) => <MuscleChip key={g} group={g} />)
              )}
            </div>
            <span aria-hidden className="shrink-0 text-muted">
              ›
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function MuscleChip({ group }: { group: MuscleGroup }) {
  const tone = MUSCLE_TONE[group];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-2"
      style={{ backgroundColor: `${tone}22` }}
    >
      <span className="h-4 w-4" style={{ color: tone }}>
        <MuscleIcon group={group} />
      </span>
      <span className="text-[11px] font-medium text-ink">{MUSCLE_GROUP_LABELS[group]}</span>
    </span>
  );
}

function RecentTrainingSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-2xl border border-white/10 bg-surface">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <div className="h-8 w-16 shrink-0 animate-pulse rounded bg-white/10" />
          <div className="h-6 flex-1 animate-pulse rounded-full bg-white/10" />
        </div>
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
      className="flex items-center justify-center rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted active:bg-white/10"
    >
      {children}
    </Link>
  );
}
