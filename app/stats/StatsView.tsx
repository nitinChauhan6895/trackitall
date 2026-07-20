"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStatsAction } from "@/app/actions";
import { qk } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatDayMonth } from "@/lib/dateFormat";
import { RANGE_KEYS, RANGE_LABELS, type RangeKey } from "@/lib/stats";
import type { HistorySession, SeriesPoint, StatsData, WeekStats } from "@/lib/stats";

const GREEN = "#A8E830";
const ORANGE = "#FF571F";
const TEAL_OLD = "#1F7D63";
const TEAL_NEW = "#3FAE8E";
const AMBER = "#E0A52A";

// An empty window, used when a cache entry predates the current shape.
const EMPTY_RANGE: WeekStats = {
  workoutDays: 0,
  totalSets: 0,
  totalReps: 0,
  totalVolumeKg: 0,
  cardioSeries: [],
  cardioLabels: [],
  cardioBucketDays: 1,
  muscles: [],
  neglected: [],
};

export type NutritionWeekSummary = {
  avgCalories: number;
  avgProtein: number;
  daysLogged: number;
  series: { key: string; label: string; calories: number; protein: number }[];
};

export default function StatsView({
  stats: initialStats,
  nutrition: initialNutrition,
}: {
  stats: StatsData;
  nutrition?: NutritionWeekSummary | null;
}) {
  // Stats are computed server-side; we cache the *result* so revisits paint
  // instantly from IndexedDB and refresh in the background.
  const { data } = useQuery({
    queryKey: qk.stats(),
    // Pass the device's "today": the server clock is UTC, which is yesterday
    // for IST users until 05:30, shifting every week/month boundary.
    queryFn: () => loadStatsAction(toDateKey(new Date())),
    initialData: { stats: initialStats, nutrition: initialNutrition ?? null },
  });
  const stats = (data?.stats ?? initialStats) as StatsData;
  const nutrition = (data?.nutrition ?? initialNutrition) as
    | NutritionWeekSummary
    | null
    | undefined;

  const [range, setRange] = useState<RangeKey>("thisWeek");
  // A StatsData cached by an older release has no `ranges` — fall back rather
  // than crash on a stale IndexedDB entry.
  const week = stats.ranges?.[range] ?? EMPTY_RANGE;
  const rangeLabel = RANGE_LABELS[range].toLowerCase();
  const [exercise, setExercise] = useState(stats.strengthExercises[0] ?? "");
  const series = stats.strengthSeries[exercise] ?? [];
  // Older releases cached a StatsData without history — tolerate its absence
  // rather than crashing on a stale IndexedDB entry.
  const history = stats.strengthHistory?.[exercise] ?? [];

  const vol = week.totalVolumeKg;
  const weightVal = vol >= 1000 ? (vol / 1000).toFixed(1) : String(Math.round(vol));
  const weightUnit = vol >= 1000 ? "t" : "kg";

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span aria-hidden>📊</span> Stats
        </h1>
        <p className="mt-0.5 text-sm text-muted">Your progress at a glance</p>
      </header>

      {/* Time range */}
      <label className="mt-4 block">
        <span className="sr-only">Time period</span>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:border-green"
        >
          {RANGE_KEYS.map((r) => (
            <option key={r} value={r}>
              {RANGE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      {/* Nutrition (last 7 days) */}
      {nutrition && (
        <>
          <SectionLabel>Nutrition · last 7 days</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <Card value={String(nutrition.avgCalories)} unit="kcal" label="Avg daily calories" />
            <Card value={String(nutrition.avgProtein)} unit="g" label="Avg daily protein" />
          </div>
          <div className="mt-2">
            <NutritionTrend series={nutrition.series} />
          </div>
        </>
      )}

      {/* Summary */}
      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <Card value={String(week.workoutDays)} unit="days" label={`Workouts · ${rangeLabel}`} />
        <Card green value={String(stats.monthTotal)} unit="sessions" label="This month total" />
        <Card value={String(week.totalSets)} unit="sets" label={`Total sets · ${week.totalReps} reps`} />
        <Card green value={weightVal} unit={weightUnit} label="Total weight lifted" />
      </div>

      {/* Streak */}
      <SectionLabel>Streak</SectionLabel>
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-orange-soft p-3">
          <div className="text-xl font-bold text-orange">{stats.currentStreak} 🔥</div>
          <div className="mt-0.5 text-[10px] text-orange/80">Current streak</div>
        </div>
        <div className="flex-1 rounded-xl bg-green-tint p-3">
          <div className="text-xl font-bold text-green">{stats.bestStreak}</div>
          <div className="mt-0.5 text-[10px] text-green/80">Best streak ever</div>
        </div>
      </div>

      {/* Strength progress */}
      <SectionLabel>Strength progress</SectionLabel>
      <ChartBox
        title={exercise ? `${exercise} — max weight` : "Strength progress"}
        hint="kg over time"
      >
        {stats.strengthExercises.length === 0 ? (
          <Empty>No weight-based exercises logged yet.</Empty>
        ) : (
          <>
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              className="mb-3 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-orange"
            >
              {stats.strengthExercises.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {series.length < 2 ? (
              <Empty>Log at least 2 sessions to see your trend.</Empty>
            ) : (
              <LineChart points={series} />
            )}
            <ExerciseHistory sessions={history} />
          </>
        )}
      </ChartBox>

      {/* Cardio progress — daily distance */}
      <SectionLabel>Cardio progress</SectionLabel>
      <ChartBox
        title={week.cardioBucketDays > 1 ? "Weekly distance" : "Daily distance"}
        hint="km"
      >
        <DailyCardio km={week.cardioSeries} labels={week.cardioLabels} />
      </ChartBox>

      {/* Muscle group breakdown */}
      <SectionLabel>Muscle group frequency</SectionLabel>
      {week.neglected.length > 0 && (
        <div className="mb-2 inline-flex flex-wrap items-center gap-1 rounded-lg bg-orange-soft px-3 py-1.5 text-xs text-orange">
          ⚠️ Neglected: <strong>{week.neglected.join(" · ")}</strong>
        </div>
      )}
      <MuscleBreakdown week={week} />
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

function Card({
  value,
  unit,
  label,
  green,
}: {
  value: string;
  unit: string;
  label: string;
  green?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${green ? "bg-green-tint" : "bg-beige"}`}>
      <div className={`text-[22px] font-bold leading-none ${green ? "text-green" : "text-[#E8B04B]"}`}>
        {value}{" "}
        <span className={`text-[11px] font-normal ${green ? "text-green" : "text-[#E8B04B]"}`}>
          {unit}
        </span>
      </div>
      <div className={`mt-1.5 text-[11px] ${green ? "text-green" : "text-[#E8B04B]"}`}>
        {label}
      </div>
    </div>
  );
}

function ChartBox({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface p-3">
      <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-ink">
        <span className="truncate">{title}</span>
        <span className="shrink-0 pl-2 font-normal text-muted">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted">{children}</p>;
}

// 7-day bar chart with a Calories/Protein toggle.
function NutritionTrend({
  series,
}: {
  series: { key: string; label: string; calories: number; protein: number }[];
}) {
  const [metric, setMetric] = useState<"calories" | "protein">("calories");
  const values = series.map((d) => (metric === "calories" ? d.calories : d.protein));
  const max = Math.max(...values, 0);
  const unit = metric === "calories" ? "kcal" : "g";
  const barColor = metric === "calories" ? GREEN : ORANGE;

  return (
    <ChartBox title="Intake trend" hint="last 7 days">
      <div className="mb-3 flex rounded-lg bg-white/[0.06] p-0.5">
        {(["calories", "protein"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={[
              "flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition",
              metric === m ? "bg-surface text-green shadow-sm" : "text-muted",
            ].join(" ")}
          >
            {m}
          </button>
        ))}
      </div>
      {max === 0 ? (
        <Empty>Nothing logged in the last 7 days.</Empty>
      ) : (
        <div className="flex h-[140px] items-end gap-1.5">
          {series.map((d, i) => {
            const v = values[i];
            return (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] font-semibold text-ink/70">{v > 0 ? v : ""}</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: v > 0 ? `${Math.max(6, (v / max) * 100)}%` : "2%",
                    background: v > 0 ? barColor : "#2A2D24",
                  }}
                />
                <span className="text-[9px] text-muted">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-center text-[10px] text-muted">Daily {metric} ({unit})</p>
    </ChartBox>
  );
}

function fmtKm(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function DailyCardio({ km, labels }: { km: number[]; labels: string[] }) {
  const max = Math.max(...km, 0);
  if (max === 0) return <Empty>No cardio logged in this window.</Empty>;
  return (
    <div className="flex h-[140px] items-end gap-1.5">
      {km.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[9px] font-semibold text-ink/70">
            {v > 0 ? fmtKm(v) : ""}
          </span>
          <div
            className="w-full rounded-t"
            style={{
              height: v > 0 ? `${Math.max(6, (v / max) * 100)}%` : "2%",
              background: v > 0 ? (i >= km.length - 2 ? TEAL_NEW : TEAL_OLD) : "#2A2D24",
            }}
          />
          <span className="text-[9px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points }: { points: SeriesPoint[] }) {
  const W = 300;
  const H = 70;
  const pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? W : (i / (points.length - 1)) * W;
    const y = H - pad - ((p.value - min) / range) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map((c) => c.join(",")).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const last = coords[coords.length - 1];

  const todayKey = toDateKey(new Date());
  const firstMs = new Date(points[0].date).getTime();
  const weeksAgo = Math.max(1, Math.round((Date.now() - firstMs) / (7 * 86400000)));
  const lastIsToday = points[points.length - 1].date === todayKey;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[70px] w-full">
        <defs>
          <linearGradient id="strengthFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ORANGE} stopOpacity="0.16" />
            <stop offset="1" stopColor={ORANGE} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={area} fill="url(#strengthFade)" stroke="none" />
        <polyline
          points={line}
          fill="none"
          stroke={ORANGE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={ORANGE} />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-muted">
        <span>{weeksAgo}w ago</span>
        <span className="font-semibold text-orange">{max} kg</span>
        <span>{lastIsToday ? "today" : shortDate(points[points.length - 1].date)}</span>
      </div>
    </>
  );
}

function MuscleBreakdown({ week }: { week: WeekStats }) {
  const max = Math.max(...week.muscles.map((m) => m.count), 1);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {week.muscles.map((m) => {
        // One colour for every group: the bar length already encodes the
        // ranking, so tinting by rank only made it harder to compare.
        const color = m.count === 0 ? "#33362C" : GREEN;
        return (
          <div key={m.group} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className={`font-medium ${m.count === 0 ? "text-muted" : "text-ink"}`}>
                {m.label}
              </span>
              <span className="text-muted">{m.count}×</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full" style={{ width: `${(m.count / max) * 100}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Locale-independent on purpose — see lib/dateFormat.ts.
const shortDate = formatDayMonth;

/** Trim pointless decimals: 40 -> "40", 42.5 -> "42.5". */
function fmtKg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

// Session-by-session detail for the selected exercise. The chart shows the
// shape of the progress; this shows what was actually lifted, so you know what
// to beat on the next session.
function ExerciseHistory({ sessions }: { sessions: HistorySession[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Previous sessions
      </p>
      <ul className="space-y-2">
        {sessions.map((s, i) => {
          // sessions are newest-first, so the next item is the older one.
          const prev = sessions[i + 1];
          const delta = prev ? s.topWeightKg - prev.topWeightKg : 0;
          const up = delta > 0;
          const down = delta < 0;
          return (
            <li key={s.date} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {shortDate(s.date)}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-ink">
                    {fmtKg(s.topWeightKg)}
                    <span className="text-xs font-normal text-muted"> kg top</span>
                  </span>
                  {prev && (
                    <span
                      className={[
                        "text-[11px] font-semibold",
                        up ? "text-green" : down ? "text-orange" : "text-muted",
                      ].join(" ")}
                    >
                      {up ? `▲ +${fmtKg(delta)}` : down ? `▼ ${fmtKg(delta)}` : "="}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {s.sets.map((set, j) => (
                  <span
                    key={j}
                    className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-muted"
                  >
                    {set.reps ?? "–"}
                    {set.weightKg != null ? ` × ${fmtKg(set.weightKg)}kg` : ""}
                  </span>
                ))}
              </div>
              {s.volumeKg > 0 && (
                <p className="mt-1 text-[10px] text-muted">
                  Volume {fmtKg(s.volumeKg)} kg
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
