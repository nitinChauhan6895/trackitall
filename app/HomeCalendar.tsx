"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchMonthSummary, qk, type MonthSummary } from "@/lib/browserData";
import { refetchUnlessJustFetched } from "@/lib/seed";
import { buildCalendarGrid, monthId, monthLabel, nextMonth, prevMonth, toDateKey } from "@/lib/date";

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const VIEW_KEY = "trackitall:home-calendar-view";

type View = "week" | "month";
type YM = { year: number; month: number };

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function mondayOf(key: string): string {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateKey(d);
}

function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function ymOf(key: string): YM {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

/**
 * Home's merged calendar card (design: Home v2). Always shows this month's
 * workout count, the streak pill and "Log today's workout". The body is the
 * current week by default and grows in place into the month grid; the choice
 * is remembered on this device. Every day opens its day page.
 */
export default function HomeCalendar({
  todayKey,
  streak,
  initialSummaries,
  fetchedAt,
  initialMonth,
}: {
  /** The SERVER's today; corrected to the device's date after mount. */
  todayKey: string;
  streak: number;
  /** Month summaries rendered on the server, keyed by monthId(). */
  initialSummaries: Record<string, MonthSummary>;
  /** When the server fetched the summaries (ms). */
  fetchedAt: number;
  /** Month to show if the month view opens (e.g. back from a day page). */
  initialMonth?: YM;
}) {
  // Put the server's months into the cache (when newer than what's there) so
  // the queries below don't immediately fetch what the server just sent.
  const qc = useQueryClient();
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    for (const [id, data] of Object.entries(initialSummaries)) {
      const [y, m] = id.split("-").map(Number);
      const state = qc.getQueryState(qk.month(y, m));
      if (!state || (state.dataUpdatedAt ?? 0) < fetchedAt) qc.setQueryData(qk.month(y, m), data, { updatedAt: fetchedAt });
    }
  }

  const [today, setToday] = useState(todayKey);
  const [view, setView] = useState<View>("week");
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayKey));
  const [shownMonth, setShownMonth] = useState<YM>(initialMonth ?? ymOf(todayKey));
  const [animate, setAnimate] = useState(false);

  // Device date + remembered view, after mount (keeps hydration identical).
  useEffect(() => {
    const t = toDateKey(new Date());
    setToday(t);
    setWeekStart(mondayOf(t));
    if (!initialMonth) setShownMonth(ymOf(t));
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "month") setView("month");
    } catch {
      // Storage blocked: stay on the week view.
    }
    // Turn the height animation on only after the restored view has painted.
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  function toggle() {
    const next: View = view === "week" ? "month" : "week";
    if (next === "month") {
      // Open on the month the viewed week mostly sits in (its Thursday).
      setShownMonth(ymOf(addDays(weekStart, 3)));
    } else {
      const cur = ymOf(today);
      setWeekStart(
        shownMonth.year === cur.year && shownMonth.month === cur.month
          ? mondayOf(today)
          : mondayOf(monthId(shownMonth.year, shownMonth.month) + "-01"),
      );
    }
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered this time; harmless.
    }
  }

  // Months whose summaries this render needs.
  const weekEnd = addDays(weekStart, 6);
  const todayYM = ymOf(today);
  const needed: YM[] = [todayYM];
  const add = (ym: YM) => {
    if (!needed.some((n) => n.year === ym.year && n.month === ym.month)) needed.push(ym);
  };
  if (view === "week") {
    add(ymOf(weekStart));
    add(ymOf(weekEnd));
  } else {
    add(shownMonth);
  }

  const results = useQueries({
    queries: needed.map(({ year, month }) => ({
      queryKey: qk.month(year, month),
      queryFn: () => fetchMonthSummary(year, month),
      initialData: initialSummaries[monthId(year, month)],
      refetchOnMount: refetchUnlessJustFetched,
    })),
  });
  const summary: MonthSummary = Object.assign({}, ...results.map((r) => r.data ?? {}));

  const trained = (key: string) => (summary[key] ?? []).length > 0;
  const monthPrefix = `${monthId(todayYM.year, todayYM.month)}-`;
  const workouts = Object.keys(summary).filter((k) => k.startsWith(monthPrefix) && trained(k)).length;

  // Week label: "This week · 9 – 15 Nov"
  const ws = parseKey(weekStart);
  const we = parseKey(weekEnd);
  const range =
    ws.getMonth() === we.getMonth()
      ? `${ws.getDate()} – ${we.getDate()} ${SHORT_MONTHS[we.getMonth()]}`
      : `${ws.getDate()} ${SHORT_MONTHS[ws.getMonth()]} – ${we.getDate()} ${SHORT_MONTHS[we.getMonth()]}`;
  const thisWeek = mondayOf(today);
  const weekTitle =
    weekStart === thisWeek ? "This week" : weekStart === addDays(thisWeek, -7) ? "Last week" : weekStart === addDays(thisWeek, 7) ? "Next week" : "Week";

  return (
    <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-4 pt-[22px]">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted">{MONTHS[todayYM.month - 1]}</span>
          <span className="font-display text-[64px] font-bold leading-none tracking-[-0.03em]">{workouts}</span>
          <span className="text-[15px] text-[#D4D4D4]">workout{workouts === 1 ? "" : "s"} this month</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/[0.14] px-3 py-2 text-[13px] font-semibold text-gold">
          <FlameIcon size={14} />
          {streak > 0 ? `${streak} day streak` : "No streak yet"}
        </span>
      </div>

      <AnimatedHeight animate={animate}>
        {view === "week" ? (
          <div className="flex flex-col gap-2.5">
            <NavRow
              title={
                <>
                  {weekTitle} <span className="font-normal text-subtle">· {range}</span>
                </>
              }
              prevLabel="Previous week"
              nextLabel="Next week"
              onPrev={() => setWeekStart(addDays(weekStart, -7))}
              onNext={() => setWeekStart(addDays(weekStart, 7))}
            />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => {
                const key = addDays(weekStart, i);
                const isToday = key === today;
                return (
                  <div key={key} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[11px] ${isToday ? "font-semibold text-green" : "text-subtle"}`}>{WEEKDAYS[i]}</span>
                    <DayDot dateKey={key} today={today} trained={trained(key)} futureStyle="dashed" />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <MonthGrid
            ym={shownMonth}
            today={today}
            trained={trained}
            onPrev={() => setShownMonth(prevMonth(shownMonth.year, shownMonth.month))}
            onNext={() => setShownMonth(nextMonth(shownMonth.year, shownMonth.month))}
          />
        )}
      </AnimatedHeight>

      <Link
        href={`/log/${today}`}
        className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98] motion-reduce:transition-none"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Log today&apos;s workout
      </Link>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={view === "month"}
        className="-mx-2 -mt-1.5 flex h-11 items-center justify-center gap-1.5 border-t border-[#2C2C2C] text-[13px] font-semibold text-muted active:text-ink"
      >
        {view === "week" ? "Show month" : "Show week"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={view === "week" ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} />
        </svg>
      </button>
    </section>
  );
}

function MonthGrid({
  ym,
  today,
  trained,
  onPrev,
  onNext,
}: {
  ym: YM;
  today: string;
  trained: (key: string) => boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const grid = buildCalendarGrid(ym.year, ym.month);
  const rows: Date[][] = [];
  for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));
  const thisWeek = mondayOf(today);

  return (
    <div className="flex flex-col gap-2.5">
      <NavRow
        title={monthLabel(ym.year, ym.month)}
        prevLabel="Previous month"
        nextLabel="Next month"
        onPrev={onPrev}
        onNext={onNext}
      />
      <div className="grid grid-cols-7 text-center text-[11px] text-subtle" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {rows
          .filter((row) => row.some((d) => d.getMonth() === ym.month - 1))
          .map((row) => {
            const rowStart = toDateKey(row[0]);
            const current = rowStart === thisWeek;
            return (
              <div
                key={rowStart}
                className={`grid grid-cols-7 justify-items-center rounded-full ${current ? "bg-surface-2" : ""}`}
              >
                {row.map((d) => {
                  const key = toDateKey(d);
                  if (d.getMonth() !== ym.month - 1) return <span key={key} aria-hidden />;
                  return <DayDot key={key} dateKey={key} today={today} trained={trained(key)} futureStyle="plain" />;
                })}
              </div>
            );
          })}
      </div>
      <div className="flex gap-4 pt-1.5 text-xs text-muted">
        <Legend swatch="h-2 w-2 rounded-full bg-green">Workout</Legend>
        <Legend swatch="box-border h-2 w-2 rounded-full border-[1.5px] border-green">Today</Legend>
        <Legend swatch="h-2 w-3.5 rounded-full bg-[#3A3A3A]">This week</Legend>
      </div>
    </div>
  );
}

/**
 * One day. Workout = solid green; today = 2px green ring (both when trained
 * today); future = dashed ring in the week strip, plain in the month grid;
 * past rest days = grey number. Every day opens its day page.
 */
function DayDot({
  dateKey,
  today,
  trained,
  futureStyle,
}: {
  dateKey: string;
  today: string;
  trained: boolean;
  futureStyle: "dashed" | "plain";
}) {
  const isToday = dateKey === today;
  const future = dateKey > today;
  const day = Number(dateKey.slice(8));
  return (
    <Link
      href={`/day/${dateKey}`}
      aria-label={`${day}${trained ? ", workout" : ""}${isToday ? ", today" : ""}`}
      className={[
        "box-border flex h-[38px] w-[38px] items-center justify-center rounded-full text-sm transition active:scale-95 motion-reduce:transition-none",
        trained
          ? "bg-green font-semibold text-ink-inverse"
          : isToday
            ? "border-2 border-green font-semibold text-ink"
            : future
              ? futureStyle === "dashed"
                ? "border border-dashed border-[#3A3A3A] text-subtle"
                : "text-ink"
              : "text-muted",
        isToday && trained ? "ring-2 ring-green ring-offset-2 ring-offset-surface" : "",
      ].join(" ")}
    >
      {day}
    </Link>
  );
}

function NavRow({
  title,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  title: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-semibold">{title}</span>
      <div className="flex gap-1">
        <NavButton label={prevLabel} onClick={onPrev} d="M15 18l-6-6 6-6" />
        <NavButton label={nextLabel} onClick={onNext} d="M9 18l6-6-6-6" />
      </div>
    </div>
  );
}

function NavButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // 36px circle with a 44px tap area.
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-surface-2 text-[#D4D4D4] before:absolute before:-inset-1 before:content-[''] active:bg-white/10"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  );
}

function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={swatch} />
      {children}
    </span>
  );
}

/**
 * Animates its height (~250ms ease-out) whenever its content changes size.
 *
 * It clips only WHILE the height is changing: clipping all the time cut off
 * whatever reaches past the content box, like the bottom of today's ring.
 */
function AnimatedHeight({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      // Exact (fractional) height; offsetHeight rounds down and shaves pixels.
      const next = el.getBoundingClientRect().height;
      setHeight((prev) => {
        if (prev !== undefined && Math.abs(prev - next) > 0.5) {
          setMoving(true);
          clearTimeout(timer);
          timer = setTimeout(() => setMoving(false), 300);
        }
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={[
        animate ? "transition-[height] duration-[250ms] ease-out motion-reduce:transition-none" : "",
        moving ? "overflow-hidden" : "",
      ].join(" ")}
      style={{ height }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}

export function FlameIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-6 0-9z" />
    </svg>
  );
}
