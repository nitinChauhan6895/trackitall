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
  streak,
}: {
  initialYear: number;
  initialMonth: number;
  initialSummary: MonthSummary;
  todayKey: string;
  streak: number;
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
  const workouts = Object.keys(summary).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{monthLabel(year, month)}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setYM(prevMonth(year, month))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setYM(nextMonth(year, month))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted active:bg-white/10"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted">
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
          if (!inMonth) return <div key={key} aria-hidden />;
          const groups = summary[key] ?? [];
          const hasWorkout = groups.length > 0;
          const isToday = key === today;
          return (
            <div key={key} className="flex flex-col items-center py-0.5">
              <Link
                href={hasWorkout ? `/day/${key}` : `/log/${key}`}
                aria-label={
                  hasWorkout
                    ? `${d.getDate()} — trained: ${groups.join(", ")}`
                    : String(d.getDate())
                }
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm transition active:scale-95",
                  // A trained day is filled; today is just outlined, so the two
                  // read independently and a trained today shows both.
                  hasWorkout
                    ? "bg-green font-semibold text-ink-inverse"
                    : "bg-white/[0.05] text-ink",
                  isToday ? "ring-2 ring-green ring-offset-2 ring-offset-page" : "",
                ].join(" ")}
              >
                {d.getDate()}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <span aria-hidden>📊</span> {workouts} Workout{workouts === 1 ? "" : "s"} this month
        </span>
        <span className="flex items-center gap-1.5 font-medium text-orange">
          <span aria-hidden>🔥</span>
          {streak > 0
            ? `${streak} day streak`
            : "No streak yet"}
        </span>
      </div>
    </section>
  );
}
