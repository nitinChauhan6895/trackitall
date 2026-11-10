import { Suspense, cache } from "react";
import Link from "next/link";
import {
  getBadgeData,
  getMeasurements,
  getCurrentStreak,
  getMonthWorkoutSummary,
  getNutritionDiary,
  getProfile,
  getPrSources,
  getRecentTraining,
  getIncomingShares,
} from "@/lib/data";
import HomeCalendar, { FlameIcon } from "./HomeCalendar";
import type { MonthSummary } from "@/lib/browserData";
import { fraction } from "@/lib/nutrition";
import {
  MEASUREMENT_FIELDS,
  MUSCLE_GROUP_LABELS,
  displayName,
  profileInitial,
  type Measurement,
  type MeasurementField,
} from "@/lib/types";
import { evaluateBadges, sortedByEarned } from "@/lib/badges";
import { computePrs } from "@/lib/prs";
import PrTile from "@/components/PrTile";
import { monthId, parseMonthParam, prevMonth, toDateKey } from "@/lib/date";
import { Badge } from "@/components/Badge";
import { MeasurementCard } from "@/components/HomeCards";
import ShareInbox from "@/components/ShareInbox";

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
  const now = new Date();
  const todayKey = toDateKey(now);
  const cur = { year: now.getFullYear(), month: now.getMonth() + 1 };

  // The hero needs this whole month plus the current Monday-first week, which
  // can start in the previous month.
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStartsLastMonth = monday.getMonth() !== now.getMonth();
  const viewingCurrent = year === cur.year && month === cur.month;

  // Above-the-fold shell only — keeps first paint off the heavy badge scan.
  // The calendar's summary seeds the client CalendarCard (instant month nav).
  const [profile, viewedSummary, currentSummary, lastMonthSummary, streak] =
    await Promise.all([
      getProfile(),
      getMonthWorkoutSummary(year, month),
      viewingCurrent ? null : getMonthWorkoutSummary(cur.year, cur.month),
      weekStartsLastMonth
        ? getMonthWorkoutSummary(prevMonth(cur.year, cur.month).year, prevMonth(cur.year, cur.month).month)
        : null,
      getCurrentStreak(),
    ]);
  // Server-rendered month summaries seed the calendar card's query cache.
  const initialSummaries: Record<string, MonthSummary> = {
    [monthId(year, month)]: Object.fromEntries(viewedSummary),
  };
  initialSummaries[monthId(cur.year, cur.month)] = Object.fromEntries(currentSummary ?? viewedSummary);
  if (lastMonthSummary) {
    const pm = prevMonth(cur.year, cur.month);
    initialSummaries[monthId(pm.year, pm.month)] = Object.fromEntries(lastMonthSummary);
  }

  const firstName = profile.first_name || displayName(profile);
  // "Thursday, 5 November"
  const todayLabel = `${now.toLocaleDateString("en-GB", { weekday: "long" })}, ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-1 pt-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">
            Hi, {firstName}
          </h1>
          <p className="text-sm text-muted">{todayLabel}</p>
        </div>
        <Link
          href="/profile"
          aria-label="Profile"
          className="elevation-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-display text-[17px] font-semibold text-ink active:scale-95"
        >
          {profileInitial(profile)}
        </Link>
      </header>

      <HomeCalendar
        todayKey={todayKey}
        streak={streak}
        initialSummaries={initialSummaries}
        fetchedAt={Date.now()}
        // Back from a day page (/?m=YYYY-MM): the month view opens on that month.
        initialMonth={searchParams.m ? { year, month } : undefined}
      />

      {/* Bento tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/stats" className="elevation-1 pressable flex flex-col gap-3.5 rounded-3xl p-[18px] text-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/[0.14] text-gold">
            <FlameIcon size={20} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-[26px] font-semibold">
              {streak} <span className="text-sm text-muted">day{streak === 1 ? "" : "s"}</span>
            </span>
            <span className="text-[13px] text-muted">
              Streak · {streak > 0 ? "keep it going" : "start one today"}
            </span>
          </span>
        </Link>
        <Link href="/habits" className="elevation-1 pressable flex flex-col gap-3.5 rounded-3xl p-[18px] text-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/[0.14] text-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
              <path d="M5 19l7-7" />
            </svg>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-xl font-semibold">Habits</span>
            <span className="text-[13px] text-muted">Check in for today</span>
          </span>
        </Link>
      </div>

      {/* Last 7 days trained (streamed) */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Last 7 days" href="/stats" action="Stats ›" />
        <Suspense fallback={<RecentTrainingSkeleton />}>
          <RecentTraining />
        </Suspense>
      </section>

      {/* Nutrition (streamed) */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Nutrition" href="/nutrition" action="Open diary ›" />
        <Suspense fallback={<NutritionSkeleton />}>
          <NutritionPreview date={todayKey} />
        </Suspense>
      </section>

      {/* Badges (streamed) */}
      <PreviewSection title="Badges" href="/badges">
        <Suspense fallback={<BadgesSkeleton />}>
          <BadgesPreview />
        </Suspense>
      </PreviewSection>

      {/* PR corner (streamed) */}
      <PreviewSection title="PR Corner" href="/prs">
        <Suspense fallback={<CardsSkeleton />}>
          <PrPreview />
        </Suspense>
      </PreviewSection>

      {/* Measurements (streamed) */}
      <PreviewSection title="Measurements" href="/measurements">
        <Suspense fallback={<CardsSkeleton />}>
          <MeasurementsPreview />
        </Suspense>
      </PreviewSection>

      {/* Shared workouts — the accept inbox used to live on Community, which
          was removed from the nav; it renders nothing when there's nothing to
          accept, so it's invisible until a share arrives. */}
      <Suspense fallback={null}>
        <SharedWorkouts />
      </Suspense>
    </main>
  );
}

async function SharedWorkouts() {
  const shares = await getIncomingShares();
  return <ShareInbox shares={shares} />;
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
  // The two most recently set records, straight from the workout log.
  const { records } = computePrs(await getPrSources());
  const latest = records.slice(0, 2);
  if (latest.length === 0)
    return <EmptyHint href="/prs">Your records appear here as you log workouts →</EmptyHint>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {latest.map((r) => (
        <PrTile key={r.key} name={r.name} metric={r.metric} value={r.value} delta={r.delta} reps={r.reps} href="/prs" />
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
      <MeasurementCard key="bw" label="Bodyweight" value={String(bw.latest)} unit="kg" delta={bw.delta} series={bw.values} colorClass="text-green" />,
    );
  if (bf.latest != null)
    cards.push(
      <MeasurementCard key="bf" label="Body fat" value={String(bf.latest)} unit="%" delta={bf.delta} series={bf.values} colorClass="text-[#7FB2F0]" />,
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
    { label: "P", v: totals.protein, t: targets.daily_protein_g, color: "#FFC95C" },
    { label: "C", v: totals.carbs, t: targets.daily_carbs_g, color: "#7FB2F0" },
    { label: "F", v: totals.fat, t: targets.daily_fat_g, color: "#3FAE8E" },
  ];

  return (
    <Link
      href="/nutrition"
      className="elevation-1 pressable flex items-center gap-4 rounded-3xl p-[18px]"
    >
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="7" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={over ? "#FFC95C" : "#22C55E"}
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
  return <div className="h-[104px] animate-pulse rounded-3xl bg-white/10" />;
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
    <div className="elevation-1 flex flex-col overflow-hidden rounded-3xl">
      {days.map((day) => {
        const { top, sub } = dayLabels(day.key, day.isToday);
        const trained = day.groups.length > 0;
        const href = trained ? `/day/${day.key}` : `/log/${day.key}`;
        return (
          <Link
            key={day.key}
            href={href}
            className={[
              "flex gap-3 border-b border-surface-2 pl-[18px] pr-3.5 text-ink last:border-0 active:bg-white/[0.06]",
              trained ? "bg-green/[0.05] py-4" : "min-h-16 items-center",
            ].join(" ")}
          >
            <div className="flex w-[88px] shrink-0 flex-col">
              <span className="text-base font-semibold">{top}</span>
              <span className="text-[13px] text-muted">{sub}</span>
            </div>
            {trained ? (
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-green">WORKOUT</span>
                <div className="flex flex-wrap gap-1.5">
                  {day.groups.map((g) => (
                    <span key={g} className="elevation-2 rounded-full px-[11px] py-[5px] text-[13px]">
                      {MUSCLE_GROUP_LABELS[g]}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span className="flex-1 text-sm text-subtle">Rest day</span>
            )}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={["shrink-0 self-center", trained ? "text-subtle" : "text-white/30"].join(" ")}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}

function RecentTrainingSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-3xl bg-surface">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 px-[18px] py-3.5">
          <div className="h-8 w-16 shrink-0 animate-pulse rounded bg-white/10" />
          <div className="h-6 flex-1 animate-pulse rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function PreviewSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={title} href={href} action="View all ›" />
      {children}
    </section>
  );
}

function SectionHeader({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <Link href={href} className="text-[15px] font-semibold text-green active:opacity-70">
        {action}
      </Link>
    </div>
  );
}

function EmptyHint({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-3xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted active:bg-white/10"
    >
      {children}
    </Link>
  );
}
