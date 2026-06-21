"use client";

import { useState } from "react";
import { toDateKey } from "@/lib/date";
import type { DayCell, SeriesPoint, StatsData, WeekStats } from "@/lib/stats";

const GREEN = "#3B6D11";
const ORANGE = "#FF571F";
const TEAL_OLD = "#1F7D63";
const TEAL_NEW = "#3FAE8E";
const AMBER = "#E0A52A";
const GREY = "#E2DED7";
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function StatsView({ stats }: { stats: StatsData }) {
  const [range, setRange] = useState<"this" | "last">("this");
  const week = range === "this" ? stats.thisWeek : stats.lastWeek;
  const [exercise, setExercise] = useState(stats.strengthExercises[0] ?? "");
  const series = stats.strengthSeries[exercise] ?? [];

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

      {/* Time range toggle */}
      <div className="mt-4 flex rounded-xl bg-black/[0.05] p-1">
        {(["this", "last"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={[
              "flex-1 rounded-lg py-2 text-xs font-semibold transition",
              range === r ? "bg-white text-green shadow-sm" : "text-muted",
            ].join(" ")}
          >
            {r === "this" ? "This week" : "Last week"}
          </button>
        ))}
      </div>

      {/* Summary */}
      <SectionLabel>Summary</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <Card value={String(week.workoutDays)} unit="days" label={`Workouts ${range === "this" ? "this week" : "last week"}`} />
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

      {/* Workout frequency */}
      <SectionLabel>Workout frequency</SectionLabel>
      <ChartBox title="Sessions per day" hint="Mon → Sun">
        <FrequencyBars perDay={week.perDay} />
      </ChartBox>

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
              className="mb-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-orange"
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
          </>
        )}
      </ChartBox>

      {/* Cardio progress */}
      <SectionLabel>Cardio progress</SectionLabel>
      <ChartBox title="Weekly distance" hint="km">
        <CardioBars weeks={stats.cardio} />
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
      <div className={`text-[22px] font-bold leading-none ${green ? "text-[#27500A]" : "text-[#854F0B]"}`}>
        {value}{" "}
        <span className={`text-[11px] font-normal ${green ? "text-green" : "text-[#BA7517]"}`}>
          {unit}
        </span>
      </div>
      <div className={`mt-1.5 text-[11px] ${green ? "text-green" : "text-[#BA7517]"}`}>
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
    <div className="rounded-xl border border-black/5 bg-white p-3">
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

function FrequencyBars({ perDay }: { perDay: DayCell[] }) {
  const max = Math.max(...perDay.map((c) => c.value), 1);
  return (
    <div className="flex h-[70px] items-end gap-1.5">
      {perDay.map((c, i) => {
        let color = GREY;
        let height = 18;
        if (c.state === "workout") {
          color = GREEN;
          height = 30 + (c.value / max) * 70;
        } else if (c.state === "today") {
          color = ORANGE;
          height = 30 + (c.value / max) * 70;
        } else if (c.state === "future") {
          color = "#EFEBE4";
        }
        return (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t" style={{ height: `${height}%`, background: color }} />
            <span className="text-[9px] text-muted">{WEEKDAYS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function CardioBars({ weeks }: { weeks: { label: string; km: number }[] }) {
  const max = Math.max(...weeks.map((w) => w.km), 0);
  if (max === 0) return <Empty>No cardio logged yet.</Empty>;
  return (
    <div className="flex h-[70px] items-end gap-1.5">
      {weeks.map((w, i) => (
        <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t"
            style={{
              height: `${Math.max(6, (w.km / max) * 100)}%`,
              background: i >= weeks.length - 2 ? TEAL_NEW : TEAL_OLD,
            }}
          />
          <span className="text-[9px] text-muted">{w.label}</span>
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
  if (week.muscles.length === 0)
    return <Empty>No muscle groups trained this week.</Empty>;
  const max = week.muscles[0].count;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {week.muscles.map((m, i) => {
        let color = AMBER;
        if (m.group === "cardio") color = TEAL_OLD;
        else if (i < 2) color = ORANGE;
        else if (m.count <= 1) color = "#9A876F";
        return (
          <div key={m.group} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-ink">{m.label}</span>
              <span className="text-muted">{m.count}×</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${(m.count / max) * 100}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shortDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
