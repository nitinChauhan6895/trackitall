"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchMonthSummary, qk, type MonthSummary } from "@/lib/browserData";
import {
  buildCalendarGrid,
  monthLabel,
  nextMonth,
  prevMonth,
  toDateKey,
} from "@/lib/date";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Home calendar. Owns the viewed month in client state and reads each month's
// workout summary from the persisted query cache — so switching months is
// instant (served from cache, reconciled in the background). The initial month
// is seeded from the server render so the first paint has no loading state.
export default function CalendarCard({
  initialYear,
  initialMonth,
  initialSummary,
  todayKey,
  streakDays,
}: {
  initialYear: number;
  initialMonth: number;
  initialSummary: MonthSummary;
  todayKey: string;
  /** Date keys in the current streak, drawn gold instead of green. */
  streakDays: string[];
}) {
  const [{ year, month }, setYM] = useState({ year: initialYear, month: initialMonth });
  const isInitial = year === initialYear && month === initialMonth;

  // The prop is the SERVER's today (UTC) — for an IST user that's yesterday
  // until 05:30, ringing the wrong date. Re-derive on the device after mount;
  // starting from the prop keeps hydration consistent.
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    setToday(toDateKey(new Date()));
  }, [todayKey]);

  const { data: summary = {} } = useQuery({
    queryKey: qk.month(year, month),
    queryFn: () => fetchMonthSummary(year, month),
    initialData: isInitial ? initialSummary : undefined,
  });

  const grid = buildCalendarGrid(year, month);
  const streakSet = new Set(streakDays);

  return (
    <section className="flex flex-col gap-3.5 rounded-[28px] bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{monthLabel(year, month)}</h2>
        <div className="flex gap-2">
          <MonthButton label="Previous month" onClick={() => setYM(prevMonth(year, month))} d="M15 18l-6-6 6-6" />
          <MonthButton label="Next month" onClick={() => setYM(nextMonth(year, month))} d="M9 18l6-6-6-6" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center text-sm">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-1 text-[11px] text-subtle">
            {w}
          </div>
        ))}
        {grid.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === month - 1;
          if (!inMonth) return <div key={key} aria-hidden />;
          const groups = summary[key] ?? [];
          const hasWorkout = groups.length > 0;
          const isToday = key === today;
          const inStreak = hasWorkout && streakSet.has(key);
          return (
            <div key={key} className="flex justify-center">
              <Link
                href={hasWorkout ? `/day/${key}` : `/log/${key}`}
                aria-label={
                  hasWorkout
                    ? `${d.getDate()} — trained: ${groups.join(", ")}`
                    : String(d.getDate())
                }
                className={[
                  "box-border flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95",
                  // A trained day is filled (gold while it's part of the
                  // current streak); today is ringed, so a trained today
                  // shows both.
                  inStreak
                    ? "bg-gold font-semibold text-ink-inverse"
                    : hasWorkout
                      ? "bg-green font-semibold text-ink-inverse"
                      : key < today
                        ? "text-muted"
                        : "text-ink",
                  isToday
                    ? hasWorkout
                      ? "ring-2 ring-green ring-offset-2 ring-offset-surface"
                      : "border-2 border-green font-semibold"
                    : "",
                ].join(" ")}
              >
                {d.getDate()}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 border-t border-[#2C2C2C] pt-3 text-xs text-muted">
        <LegendDot className="bg-green">Workout</LegendDot>
        <LegendDot className="bg-gold">Streak</LegendDot>
        <LegendDot className="border-[1.5px] border-green">Today</LegendDot>
      </div>
    </section>
  );
}

function MonthButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-ink active:bg-white/10"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  );
}

function LegendDot({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`box-border h-2 w-2 rounded-full ${className}`} />
      {children}
    </span>
  );
}
