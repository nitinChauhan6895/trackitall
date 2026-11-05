"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MonthSummary } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Top-of-home summary: this month's workout count, the streak pill, the
// current Monday-first week, and the main "log today" action. `summary` must
// cover every day of the current week and month (the server passes the
// previous month too when the week starts in it).
export default function HeroCard({
  summary,
  todayKey,
  streak,
}: {
  summary: MonthSummary;
  todayKey: string;
  streak: number;
}) {
  // The prop is the SERVER's today (UTC); re-derive on the device after mount,
  // as CalendarCard does, so early-morning IST doesn't show yesterday.
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    setToday(toDateKey(new Date()));
  }, [todayKey]);

  const [y, m, d] = today.split("-").map(Number);
  const monthPrefix = today.slice(0, 8);
  const workouts = Object.keys(summary).filter(
    (k) => k.startsWith(monthPrefix) && summary[k].length > 0,
  ).length;

  const now = new Date(y, m - 1, d);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });

  return (
    <section className="flex flex-col gap-[18px] rounded-[28px] bg-surface px-5 pb-5 pt-[22px]">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">
            {MONTHS[m - 1]}
          </span>
          <span className="font-display text-[64px] font-bold leading-none tracking-[-0.03em]">
            {workouts}
          </span>
          <span className="text-[15px] text-[#D4D4D4]">
            workout{workouts === 1 ? "" : "s"} this month
          </span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/[0.14] px-3 py-2 text-[13px] font-semibold text-gold">
          <FlameIcon size={14} />
          {streak > 0 ? `${streak} day streak` : "No streak yet"}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {week.map((day, i) => {
          const key = toDateKey(day);
          const isToday = key === today;
          const isFuture = key > today;
          const trained = (summary[key] ?? []).length > 0;
          return (
            <Link
              key={key}
              href={trained ? `/day/${key}` : `/log/${key}`}
              aria-label={`${day.getDate()}${trained ? " — trained" : ""}`}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`text-[11px] ${isToday ? "font-semibold text-green" : "text-subtle"}`}
              >
                {WEEKDAYS[i]}
              </span>
              <span
                className={[
                  "box-border flex h-9 w-9 items-center justify-center rounded-full text-sm transition active:scale-95",
                  // Trained today is filled and ringed, so both read at once.
                  trained
                    ? "bg-green font-semibold text-ink-inverse"
                    : isToday
                      ? "border-2 border-green font-semibold text-ink"
                      : isFuture
                        ? "border border-dashed border-[#3A3A3A] text-subtle"
                        : "bg-surface-2 text-muted",
                  isToday && trained ? "ring-2 ring-green ring-offset-2 ring-offset-surface" : "",
                ].join(" ")}
              >
                {day.getDate()}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href={`/log/${today}`}
        className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Log today&apos;s workout
      </Link>
    </section>
  );
}

export function FlameIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-6 0-9z" />
    </svg>
  );
}
