"use client";

import { useState } from "react";
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
}: {
  initialYear: number;
  initialMonth: number;
  initialSummary: MonthSummary;
  todayKey: string;
}) {
  const [{ year, month }, setYM] = useState({ year: initialYear, month: initialMonth });
  const isInitial = year === initialYear && month === initialMonth;

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
          const isToday = key === todayKey;
          return (
            <div key={key} className="flex flex-col items-center gap-1 py-0.5">
              <Link
                href={hasWorkout ? `/day/${key}` : `/log/${key}`}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm transition active:scale-95",
                  isToday
                    ? "bg-orange font-bold text-white ring-2 ring-green ring-offset-2 ring-offset-page"
                    : "bg-white/[0.05] text-ink",
                ].join(" ")}
              >
                {d.getDate()}
              </Link>
              <div className="flex h-1.5 items-center gap-0.5">
                {hasWorkout &&
                  groups.slice(0, 3).map((g, i) => (
                    <span
                      key={g + i}
                      className={["h-1 w-1 rounded-full", i % 2 === 0 ? "bg-green" : "bg-orange"].join(" ")}
                      aria-hidden
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <span aria-hidden>📊</span> {workouts} Workout{workouts === 1 ? "" : "s"} this month
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span aria-hidden>🏆</span> Keep it up!
        </span>
      </div>
    </section>
  );
}
