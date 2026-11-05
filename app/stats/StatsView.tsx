"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStatsAction } from "@/app/actions";
import { qk } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatDayMonth } from "@/lib/dateFormat";
import { RANGE_KEYS, RANGE_LABELS, type RangeKey } from "@/lib/stats";
import type { GroupLoad, HistorySession, SeriesPoint, StatsData, WeekStats } from "@/lib/stats";

const GREEN = "#22C55E";
const GOLD = "#FFC95C";

// An empty window, used when a cache entry predates the current shape.
const EMPTY_RANGE: WeekStats = {
  workoutDays: 0,
  totalSets: 0,
  totalReps: 0,
  totalVolumeKg: 0,
  cardioSeries: [],
  cardioTimeSeries: [],
  cardioLabels: [],
  cardioBucketDays: 1,
  muscles: [],
  neglected: [],
  load: [],
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

  const [range, setRange] = useState<RangeKey>("last7");
  // A StatsData cached by an older release has no `ranges` — fall back rather
  // than crash on a stale IndexedDB entry.
  // A StatsData cached by an older release has `ranges` but its entries
  // predate newer fields (v7.2.4 added `load`). Merging against EMPTY_RANGE
  // fills the gaps — reading week.load directly crashed the whole page.
  const week: WeekStats = { ...EMPTY_RANGE, ...(stats.ranges?.[range] ?? {}) };
  const rangeLabel = RANGE_LABELS[range].toLowerCase();
  const [exercise, setExercise] = useState(stats.strengthExercises[0] ?? "");
  const series = stats.strengthSeries[exercise] ?? [];
  // Older releases cached a StatsData without history — tolerate its absence
  // rather than crashing on a stale IndexedDB entry.
  const history = stats.strengthHistory?.[exercise] ?? [];

  const hardSets = week.load.reduce((n, l) => n + l.hardSets, 0);
  const musclesTrained = week.muscles.filter((m) => m.count > 0).length;

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="flex items-center justify-between gap-3 px-1 pt-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Stats</h1>
          <p className="text-sm text-muted">Your progress at a glance</p>
        </div>
        {/* Glass pill; the native select sits on top of it (invisible) so the
            platform picker still opens. */}
        <label className="elevation-3 relative flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] pl-4 pr-3.5 text-sm font-semibold text-ink">
          {RANGE_LABELS[range]}
          <ChevronDown className="text-ink" />
          <select
            aria-label="Time period"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
          >
            {RANGE_KEYS.map((r) => (
              <option key={r} value={r}>
                {RANGE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* Hero: period summary */}
      <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Volume · {rangeLabel}
          </span>
          <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
            {fmtThousands(week.totalVolumeKg)} <span className="text-xl font-semibold text-green">kg</span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat value={week.totalSets} label="Sets" />
          <MiniStat value={musclesTrained} label="Muscles" />
          <MiniStat value={hardSets} label={hardSets === 1 ? "Hard set" : "Hard sets"} gold />
        </div>
      </section>

      {/* Streak bento */}
      <div className="grid grid-cols-2 gap-3">
        <StreakTile value={stats.currentStreak} label="Current streak" icon={<FlamePath />} />
        <StreakTile value={stats.bestStreak} label="Best streak ever" icon={<TrophyPath />} />
      </div>

      {/* Load by muscle */}
      <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] p-5">
        <CardTitle title="Load by muscle" hint="by volume" />
        <LoadStats load={week.load} />
      </section>

      {/* Strength progress */}
      <section className="elevation-1 flex flex-col gap-4 rounded-[28px] p-5">
        <div className="flex flex-col gap-2.5">
          <h2 className="font-display text-lg font-semibold">Strength progress</h2>
          {stats.strengthExercises.length > 0 && (
            <label className="elevation-2 relative flex h-11 items-center justify-between rounded-[14px] px-3.5 text-sm font-medium text-ink">
              <span className="truncate">{exercise}</span>
              <ChevronDown className="shrink-0 text-muted" />
              <select
                aria-label="Choose exercise"
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              >
                {stats.strengthExercises.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {stats.strengthExercises.length === 0 ? (
          <Empty>No weight-based exercises logged yet.</Empty>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Max weight · kg</span>
              {series.length > 0 && <LineChart points={series} />}
              {series.length < 2 && (
                <span className="text-[13px] text-muted">Log at least 2 sessions to see your trend.</span>
              )}
            </div>
            <ExerciseHistory sessions={history} />
          </>
        )}
      </section>

      {/* Cardio progress — time first (the primary cardio metric), then distance. */}
      <section className="flex flex-col gap-3">
        <h2 className="px-1 font-display text-xl font-semibold">Cardio progress</h2>
        <div className="grid grid-cols-2 gap-3">
          <CardioTile
            title={week.cardioBucketDays > 1 ? "Weekly time" : "Daily time"}
            unit="min"
            values={week.cardioTimeSeries}
            total={`${fmtMin(sum(week.cardioTimeSeries))} min`}
            empty="No cardio time logged in this window."
          />
          <CardioTile
            title={week.cardioBucketDays > 1 ? "Weekly distance" : "Daily distance"}
            unit="km"
            values={week.cardioSeries}
            total={`${fmtKm(sum(week.cardioSeries))} km`}
            empty="No cardio distance logged in this window."
          />
        </div>
      </section>

      {/* Muscle group frequency */}
      <MuscleBreakdown week={week} />

      {/* Nutrition (last 7 days) */}
      {nutrition && (
        <section className="elevation-1 flex flex-col gap-4 rounded-[28px] p-5">
          <CardTitle title="Nutrition" hint="last 7 days" />
          <div className="grid grid-cols-2 gap-2">
            <MiniStat value={nutrition.avgCalories} label="Avg kcal / day" />
            <MiniStat value={nutrition.avgProtein} label="Avg protein (g) / day" />
          </div>
          <NutritionTrend series={nutrition.series} />
        </section>
      )}
    </main>
  );
}

function LoadStats({ load }: { load?: GroupLoad[] }) {
  if (!load || load.length === 0) {
    return <Empty>Nothing logged in this window.</Empty>;
  }
  const byVolume = [...load].sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets);
  const maxVol = Math.max(...byVolume.map((l) => l.volumeKg), 1);
  return (
    <>
      {byVolume.map((l) => (
        <div key={l.group} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">{l.label}</span>
            <span className="font-display text-[17px] font-semibold">{fmtWeight(l.volumeKg)}</span>
          </div>
          <Bar frac={l.volumeKg / maxVol} />
          <span className="text-xs text-muted">
            {l.exercises} {l.exercises === 1 ? "exercise" : "exercises"} · {l.sets}{" "}
            {l.sets === 1 ? "set" : "sets"} ·{" "}
            <span className={l.hardSets > 0 ? "font-semibold text-gold" : ""}>{l.hardSets} hard</span>
          </span>
        </div>
      ))}
    </>
  );
}

function Bar({ frac }: { frac: number }) {
  return (
    <div className="h-2 rounded-full bg-[#2C2C2C]">
      {frac > 0 && (
        <div className="h-2 rounded-full bg-green" style={{ width: `${Math.min(100, frac * 100)}%` }} />
      )}
    </div>
  );
}

function MiniStat({ value, label, gold }: { value: number; label: string; gold?: boolean }) {
  return (
    <div className="elevation-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-3">
      <span className={`font-display text-[22px] font-semibold ${gold ? "text-gold" : ""}`}>
        {fmtThousands(value)}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function StreakTile({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="elevation-1 flex flex-col gap-3.5 rounded-3xl p-[18px]">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/[0.14] text-gold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {icon}
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-display text-[28px] font-semibold">
          {value} <span className="text-sm text-muted">{value === 1 ? "day" : "days"}</span>
        </span>
        <span className="text-[13px] text-muted">{label}</span>
      </span>
    </div>
  );
}

function FlamePath() {
  return <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-6 0-9z" />;
}
function TrophyPath() {
  return (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CardTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[13px] text-muted">{children}</p>;
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
  const barColor = metric === "calories" ? GREEN : GOLD;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-full bg-white/[0.06] p-0.5">
        {(["calories", "protein"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={[
              "flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition",
              metric === m ? "elevation-2 text-green" : "border border-transparent text-muted",
            ].join(" ")}
          >
            {m}
          </button>
        ))}
      </div>
      {max === 0 ? (
        <Empty>Nothing logged in the last 7 days.</Empty>
      ) : (
        <div className="flex h-[120px] items-end gap-1.5">
          {series.map((d, i) => {
            const v = values[i];
            return (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] font-semibold text-ink/70">{v > 0 ? v : ""}</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: v > 0 ? `${Math.max(6, (v / max) * 100)}%` : "2%",
                    background: v > 0 ? barColor : "#2C2C2C",
                  }}
                />
                <span className="text-[9px] text-muted">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-center text-[11px] text-muted">Daily {metric} ({unit})</p>
    </div>
  );
}

function fmtKm(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Half-width cardio tile: a compact bar per bucket, or a dashed baseline
 *  when nothing was logged. Shared by the time and distance tiles. */
function CardioTile({
  title,
  unit,
  values,
  total,
  empty,
}: {
  title: string;
  unit: string;
  values: number[];
  total: string;
  empty: string;
}) {
  const max = Math.max(...values, 0);
  return (
    <div className="elevation-1 flex flex-col gap-3 rounded-3xl p-[18px]">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-subtle">{unit}</span>
      </span>
      {max === 0 ? (
        <>
          <svg width="100%" height="36" viewBox="0 0 140 36" preserveAspectRatio="none" aria-hidden>
            <line x1="0" y1="34" x2="140" y2="34" stroke="#3A3A3A" strokeWidth="1" strokeDasharray="3 4" />
          </svg>
          <span className="text-xs leading-[1.4] text-muted">{empty}</span>
        </>
      ) : (
        <>
          <div className="flex h-9 items-end gap-[3px]" aria-hidden>
            {values.map((v, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-sm ${v > 0 ? "bg-green" : "bg-[#2C2C2C]"}`}
                style={{ height: v > 0 ? `${Math.max(10, (v / max) * 100)}%` : "6%" }}
              />
            ))}
          </div>
          <span className="text-xs leading-[1.4] text-muted">
            <span className="font-semibold text-ink">{total}</span> in this window
          </span>
        </>
      )}
    </div>
  );
}

/** "45" under an hour, "1h20" past it — kept short enough for a bar label. */
function fmtMin(n: number): string {
  if (n < 60) return String(n);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// Max-weight chart: three gridlines with value labels, one point per session
// (dashed to the right edge when there's only one), first/last dates below.
function LineChart({ points }: { points: SeriesPoint[] }) {
  const W = 316;
  const X0 = 60; // leaves room for the value labels
  const X1 = 300;
  const TOP = 14;
  const BOTTOM = 100;
  const values = points.map((p) => p.value);
  const ticks = gridTicks(Math.min(...values), Math.max(...values));
  const y = (v: number) => BOTTOM - ((v - ticks[0]) / (ticks[2] - ticks[0])) * (BOTTOM - TOP);
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? X0 : X0 + (i / (points.length - 1)) * (X1 - X0);
    return [x, y(p.value)] as const;
  });
  const first = points[0];
  const last = points[points.length - 1];
  const label = (p: SeriesPoint) => (p.date === toDateKey(new Date()) ? "Today" : shortDate(p.date));

  return (
    <svg
      viewBox={`0 0 ${W} 130`}
      className="h-auto w-full"
      role="img"
      aria-label={`Max weight: ${points.map((p) => `${fmtKg(p.value)} kg on ${shortDate(p.date)}`).join(", ")}`}
    >
      {ticks.map((t, i) => (
        <g key={t}>
          <line x1="28" y1={y(t)} x2={W} y2={y(t)} stroke={i === 0 ? "#3A3A3A" : "#2C2C2C"} strokeWidth="1" />
          <text x="0" y={y(t) + 4} fill="#8C8C8C" fontSize="11">
            {fmtKg(t)}
          </text>
        </g>
      ))}
      {coords.length === 1 ? (
        <line x1={X0} y1={coords[0][1]} x2={X1} y2={coords[0][1]} stroke={GREEN} strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" opacity="0.5" />
      ) : (
        <polyline points={coords.map((c) => c.join(",")).join(" ")} fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {coords.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === coords.length - 1 ? 5 : 3.5} fill={GREEN} />
      ))}
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="9" fill={GREEN} opacity="0.18" />
      <text x={coords[0][0]} y="124" textAnchor="middle" fill="#A6A6A6" fontSize="11">
        {label(first)}
      </text>
      {points.length > 1 && (
        <text x={X1} y="124" textAnchor="end" fill="#A6A6A6" fontSize="11">
          {label(last)}
        </text>
      )}
    </svg>
  );
}

/** Three evenly spaced, round gridline values that bracket [lo, hi]. */
function gridTicks(lo: number, hi: number): [number, number, number] {
  if (lo === hi) {
    const step = niceStep(Math.max(lo * 0.5, 1));
    return [lo - step, lo, lo + step];
  }
  let step = niceStep((hi - lo) / 2);
  let base = Math.floor(lo / step) * step;
  while (base + 2 * step < hi) {
    step = niceStep(step * 1.5);
    base = Math.floor(lo / step) * step;
  }
  return [base, base + step, base + 2 * step];
}

function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

function MuscleBreakdown({ week }: { week: WeekStats }) {
  const trained = week.muscles.filter((m) => m.count > 0);
  const neglected = week.muscles.filter((m) => m.count === 0);
  return (
    <section className="elevation-1 flex flex-col gap-4 rounded-[28px] p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Muscle group frequency</h2>
          <span className="text-[13px] text-muted">
            <span className="font-display text-[15px] font-semibold text-ink">{trained.length}</span> /{" "}
            {week.muscles.length} trained
          </span>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${week.muscles.length || 1}, 1fr)` }} aria-hidden>
          {[...trained, ...neglected].map((m) => (
            <span key={m.group} className={`h-1.5 rounded-full ${m.count > 0 ? "bg-green" : "bg-gold/[0.55]"}`} />
          ))}
        </div>
      </div>

      {trained.length > 0 && (
        <FrequencyGroup title="Trained" note="sessions" tone="text-green">
          {trained.map((m) => (
            <span key={m.group} className="elevation-2 flex h-11 items-center justify-between rounded-[14px] px-3.5 text-sm">
              {m.label}
              <span className="font-display font-semibold text-green">{m.count}×</span>
            </span>
          ))}
        </FrequencyGroup>
      )}

      {trained.length > 0 && neglected.length > 0 && <div className="h-px bg-[#2C2C2C]" />}

      {neglected.length > 0 && (
        <FrequencyGroup title="Neglected" note="not trained this period" tone="text-gold">
          {neglected.map((m) => (
            <span key={m.group} className="flex h-11 items-center justify-between rounded-[14px] border border-gold/20 bg-gold/[0.07] px-3.5 text-sm">
              {m.label}
              <span className="font-display font-semibold text-gold">0×</span>
            </span>
          ))}
        </FrequencyGroup>
      )}
    </section>
  );
}

function FrequencyGroup({
  title,
  note,
  tone,
  children,
}: {
  title: string;
  note: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${tone}`}>{title}</span>
        <span className="text-xs text-muted">{note}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
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
    <>
      <div className="h-px bg-[#2C2C2C]" />
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Previous sessions</span>
        {sessions.map((s, i) => {
          // sessions are newest-first, so the next item is the older one.
          const prev = sessions[i + 1];
          const delta = prev ? s.topWeightKg - prev.topWeightKg : 0;
          return (
            <div key={s.date} className="elevation-2 flex flex-col gap-2.5 rounded-[18px] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold">{shortDate(s.date)}</span>
                <span className="text-right text-[13px] text-muted">
                  Top <span className="font-semibold text-ink">{fmtKg(s.topWeightKg)} kg</span>
                  {delta !== 0 && (
                    <span className={`font-semibold ${delta > 0 ? "text-green" : "text-gold"}`}>
                      {" "}
                      {delta > 0 ? `▲${fmtKg(delta)}` : `▼${fmtKg(-delta)}`}
                    </span>
                  )}
                  {s.volumeKg > 0 && (
                    <>
                      {" "}· Volume <span className="font-semibold text-ink">{fmtKg(s.volumeKg)} kg</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.sets.map((set, j) => (
                  <span key={j} className="flex items-center gap-1.5 rounded-xl bg-surface px-2.5 py-[7px] text-[13px]">
                    <span className="text-[11px] font-semibold text-green">{j + 1}</span>
                    {set.reps ?? "–"}
                    {set.weightKg != null ? ` × ${fmtKg(set.weightKg)} kg` : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function sum(values: number[]): number {
  return values.reduce((n, v) => n + v, 0);
}

/** Locale-free thousands grouping (SSR and client must match). */
function fmtThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "920 kg" under a tonne, "1.1 t" from there. */
function fmtWeight(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}
