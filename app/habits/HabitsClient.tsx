"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadHabitsAction,
  saveHabit,
  setHabitCount,
  deleteHabit,
  setHabitArchived,
} from "@/app/actions";
import { qk } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatShortDate } from "@/lib/dateFormat";
import {
  CADENCES,
  DOW_LABELS,
  habitColor,
  HABIT_CATEGORIES,
  HABIT_ICONS,
  KINDS,
  addDaysKey,
  applyLog,
  completeCount,
  countOn,
  formatDuration,
  nextCount,
  progressParts,
  progressRatio,
  stepSize,
  habitStreak,
  isComplete,
  isDueOn,
  weekDays,
  weekProgress,
  type Cadence,
  type Habit,
  type HabitKind,
  type HabitsData,
} from "@/lib/habits";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

type View =
  | { name: "list" }
  | { name: "logger"; habitId: string }
  | { name: "detail"; habitId: string }
  | { name: "edit"; habitId?: string };

export default function HabitsClient({
  initial,
  todayKey,
}: {
  initial: HabitsData;
  /** The SERVER's date. Seeding state from it keeps the SSR and the first
   *  client render identical; the device's real date is applied on mount. */
  todayKey: string;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: qk.habits(),
    // Wrapped: React Query passes a context object (with an AbortSignal) to
    // queryFn, and a server action can't serialise it — the call would throw
    // before reaching the server, so new habits only showed after a reload.
    queryFn: () => loadHabitsAction(),
    initialData: initial,
  });
  const habits = data?.habits ?? [];
  const logs = data?.logs ?? [];

  // "Today" must ultimately come from the device — the server runs in UTC,
  // which is still yesterday for an IST user until 05:30 — but computing it
  // during render would make the server and client disagree and break
  // hydration. Seed from the server, correct after mount.
  const [today, setToday] = useState(todayKey);
  useEffect(() => setToday(toDateKey(new Date())), []);

  const [view, setView] = useState<View>({ name: "list" });
  const [selectedDay, setSelectedDay] = useState(today);
  useEffect(() => setSelectedDay(today), [today]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.habits() });

  /** Optimistically change a habit-day.
   *
   *  mode "done"  -> fill or clear the whole period in one tap (default)
   *  mode "step"  -> +1, for the counter control
   *  a number     -> set exactly (the -/+ stepper) */
  async function bump(habit: Habit, date: string, next?: number | "step") {
    const value =
      typeof next === "number"
        ? next
        : next === "step"
          ? nextCount(habit, logs, date)
          : completeCount(habit, logs, date);

    queryClient.setQueryData<HabitsData>(qk.habits(), (prev) =>
      prev ? { ...prev, logs: applyLog(prev.logs, habit.id, date, value) } : prev,
    );
    try {
      await setHabitCount({ habitId: habit.id, date, count: value });
    } finally {
      refresh();
    }
  }

  const detail = view.name === "detail" ? habits.find((h) => h.id === view.habitId) : null;
  const logging = view.name === "logger" ? habits.find((h) => h.id === view.habitId) : null;

  /** Share a habit's progress through the OS share sheet, clipboard otherwise. */
  async function share(habit: Habit) {
    const streak = habitStreak(habit, logs, today);
    const text = `${habit.icon ?? ""} ${habit.name} — ${streak} ${
      habit.cadence === "daily" ? "day" : "week"
    } streak on TrackItAll`.trim();
    try {
      const nav = navigator as any;
      if (nav?.share) await nav.share({ text });
      else await nav?.clipboard?.writeText(text);
    } catch {
      // User dismissed the sheet — nothing to report.
    }
  }

  if (view.name === "edit") {
    return (
      // A full-screen layer over the tab bar; the form has its own sticky action.
      <main className="fixed inset-0 z-40 mx-auto flex w-full max-w-md flex-col overflow-y-auto bg-page px-4 pb-36 safe-top">
        <EditView
          habit={view.habitId ? habits.find((h) => h.id === view.habitId) : undefined}
          onDone={() => {
            setView({ name: "list" });
            refresh();
          }}
          onCancel={() => setView({ name: "list" })}
        />
      </main>
    );
  }

  return (
    <main className={`flex flex-1 flex-col px-4 pb-36 safe-top ${view.name === "list" ? "gap-5" : ""}`}>
      {view.name === "list" && (
        <TodayView
          habits={habits}
          logs={logs}
          today={today}
          date={selectedDay}
          onDate={setSelectedDay}
          onOpen={(id) => setView({ name: "logger", habitId: id })}
          onNew={() => setView({ name: "edit" })}
          onToggle={(h, d) => bump(h, d)}
        />
      )}

      {view.name === "logger" && logging && (
        <LoggerView
          habit={logging}
          logs={logs}
          today={today}
          date={selectedDay}
          onBack={() => setView({ name: "list" })}
          onSetCount={(c) => bump(logging, selectedDay, c)}
          onEdit={() => setView({ name: "edit", habitId: logging.id })}
          onShare={() => share(logging)}
          onArchive={async () => {
            await setHabitArchived(logging.id, true);
            setView({ name: "list" });
            refresh();
          }}
          onDelete={() => setView({ name: "detail", habitId: logging.id })}
        />
      )}

      {view.name === "detail" && detail && (
        <DetailView
          habit={detail}
          logs={logs}
          today={today}
          onBack={() => setView({ name: "logger", habitId: detail.id })}
          onEdit={() => setView({ name: "edit", habitId: detail.id })}
          onToggle={() => bump(detail, today)}
          onToggleDay={(d) => bump(detail, d)}
          onDeleted={() => {
            setView({ name: "list" });
            refresh();
          }}
        />
      )}

    </main>
  );
}
// ---------------- today list ----------------

const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Friday, 6 November" — locale-free so SSR and client agree. */
function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return `${WEEKDAY_LONG[dow]}, ${d} ${MONTH_LONG[m - 1]}`;
}

// The list is date-aware: the week strip picks the day everything below acts
// on, which folds the old separate "daily" screen into one screen and makes
// back-dating the same gesture as logging today.
function TodayView({
  habits,
  logs,
  today,
  date,
  onDate,
  onOpen,
  onNew,
  onToggle,
}: {
  habits: Habit[];
  logs: HabitsData["logs"];
  today: string;
  date: string;
  onDate: (d: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onToggle: (h: Habit, date: string) => void;
}) {
  const [cat, setCat] = useState<string>("All");

  const categories = [
    "All",
    ...Array.from(new Set(habits.map((h) => h.category).filter(Boolean) as string[])),
  ];
  const shown = habits.filter((h) => cat === "All" || h.category === cat);
  const due = shown.filter((h) => isDueOn(h, date));
  const doneCount = due.filter((h) => isComplete(h, logs, date)).length;
  const allDone = due.length > 0 && doneCount === due.length;
  const days = weekDays(date);
  const isPast = date !== today;

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-1 pt-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Habits</h1>
          <p className="text-sm text-muted">
            {longDate(date)}
            {isPast && (
              <>
                {" · "}
                <button type="button" onClick={() => onDate(today)} className="font-semibold text-green active:opacity-70">
                  Back to today
                </button>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="elevation-3 h-11 shrink-0 rounded-full bg-white/[0.08] px-[18px] text-sm font-semibold text-green active:bg-white/15"
        >
          New habit
        </button>
      </header>

      {habits.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <>
          {/* Hero: the selected day's due habits, then the week. */}
          <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-[0.08em] text-muted">
                  {isPast ? `DUE ${formatShortDate(date).toUpperCase()}` : "DUE TODAY"}
                </span>
                <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
                  {doneCount}
                  <span className="text-2xl text-subtle"> / {due.length}</span>
                </span>
                <span className="text-[15px] text-[#D4D4D4]">
                  {due.length === 0
                    ? "Nothing scheduled"
                    : allDone
                      ? "done — nice work"
                      : `done · ${due.length - doneCount} to go`}
                </span>
              </div>
              {allDone && (
                <span className="rounded-lg bg-green px-[9px] py-[5px] text-xs font-bold tracking-[0.06em] text-ink-inverse">
                  ALL DONE
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-[#2C2C2C]">
              {doneCount > 0 && (
                <div className="h-2 rounded-full bg-green" style={{ width: `${(doneCount / Math.max(1, due.length)) * 100}%` }} />
              )}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                const sel = d === date;
                const future = d > today;
                const dueThatDay = habits.filter((h) => isDueOn(h, d));
                const complete = dueThatDay.length > 0 && dueThatDay.every((h) => isComplete(h, logs, d));
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={future}
                    onClick={() => onDate(d)}
                    aria-label={`Show ${longDate(d)}`}
                    aria-pressed={sel}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className={`text-[11px] ${sel ? "font-semibold text-green" : "text-subtle"}`}>{DOW[i]}</span>
                    <span
                      className={[
                        "box-border flex h-9 w-9 items-center justify-center rounded-full text-sm",
                        complete
                          ? "bg-green font-semibold text-ink-inverse"
                          : future
                            ? "border border-dashed border-[#3A3A3A] text-subtle"
                            : sel
                              ? "font-semibold text-ink"
                              : "bg-surface-2 text-muted",
                        sel ? (complete ? "ring-2 ring-green ring-offset-2 ring-offset-surface" : "border-2 border-green") : "",
                      ].join(" ")}
                    >
                      {Number(d.slice(8, 10))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {categories.length > 1 && (
            <div role="tablist" aria-label="Category" className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={cat === c}
                  onClick={() => setCat(c)}
                  className={[
                    "h-10 shrink-0 rounded-full px-[18px] text-sm transition",
                    cat === c ? "bg-ink font-semibold text-ink-inverse" : "elevation-1 font-medium text-[#D4D4D4]",
                  ].join(" ")}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Due on the selected day: every daily habit, plus weekly habits
              whose chosen weekday is this one. */}
          <section className="flex flex-col gap-3">
            <SectionHeader title={isPast ? `Due ${formatShortDate(date)}` : "Due today"} count={due.length} />
            {due.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
                Nothing scheduled for this day.
              </p>
            ) : (
              <div className="elevation-1 flex flex-col rounded-3xl">
                {due.map((h) => (
                  <HabitRow key={h.id} habit={h} logs={logs} date={date} onOpen={() => onOpen(h.id)} onToggle={() => onToggle(h, date)} />
                ))}
              </div>
            )}
          </section>

          {/* Everything, so weekly habits stay reachable on their off-days. */}
          <section className="flex flex-col gap-3">
            <SectionHeader title="All habits" count={shown.length} />
            <div className="elevation-1 flex flex-col rounded-3xl">
              {shown.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onOpen(h.id)}
                  className="flex min-h-14 items-center justify-between gap-3 border-b border-surface-2 px-[18px] text-left last:border-0 active:bg-white/[0.04]"
                >
                  <span className="truncate text-base font-semibold">{h.name}</span>
                  <span className="shrink-0 text-[13px] text-muted">{progressText(h, logs, date)}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <span className="text-sm text-muted">{count}</span>
    </div>
  );
}

// "10 / 10 g", "4 / 10 min"
function progressText(habit: Habit, logs: HabitsData["logs"], date: string): string {
  const { current, target, unit } = progressParts(habit, logs, date);
  return `${current} / ${target}${unit ? ` ${unit}` : ""}`;
}

/** A due habit: name, progress and bar; the pill completes or undoes the day. */
function HabitRow({
  habit,
  logs,
  date,
  onOpen,
  onToggle,
}: {
  habit: Habit;
  logs: HabitsData["logs"];
  date: string;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const ratio = progressRatio(habit, logs, date);
  const done = isComplete(habit, logs, date);
  const { current, target, unit } = progressParts(habit, logs, date);

  return (
    <div className="flex items-center gap-3.5 border-b border-surface-2 px-[18px] py-4 last:border-0">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-2 text-left">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-base font-semibold">{habit.name}</span>
          <span className="shrink-0 text-[13px] text-muted">
            <span className={`font-semibold ${current > 0 ? "text-green" : "text-ink"}`}>{current}</span> / {target}
            {unit ? ` ${unit}` : ""}
          </span>
        </span>
        <span className="block h-1.5 rounded-full bg-[#2C2C2C]">
          {ratio > 0 && (
            <span className="block h-1.5 rounded-full bg-green transition-[width] duration-300" style={{ width: `${ratio * 100}%` }} />
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        aria-pressed={done}
        className={[
          "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95",
          done ? "bg-green text-ink-inverse" : "elevation-2 text-green",
        ].join(" ")}
      >
        Done
      </button>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[28px] border border-dashed border-white/15 px-5 py-10 text-center">
      <p className="font-display text-lg font-semibold text-ink">No habits yet</p>
      <p className="text-sm text-muted">Track the small things — creatine, water, stretching — and build streaks.</p>
      <button type="button" onClick={onNew} className="mt-3 h-11 rounded-full bg-green px-5 text-sm font-semibold text-ink-inverse active:scale-95">
        Add your first habit
      </button>
    </div>
  );
}

// ---------------- logger (counter / timer) ----------------

function LoggerView({
  habit,
  logs,
  today,
  date,
  onBack,
  onSetCount,
  onEdit,
  onArchive,
  onDelete,
  onShare,
}: {
  habit: Habit;
  logs: HabitsData["logs"];
  today: string;
  date: string;
  onBack: () => void;
  onSetCount: (count: number) => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const tone = habitColor(habit.color);
  const cur = countOn(logs, habit.id, date);
  const target = habit.target_per_period;
  const ratio = Math.min(1, target > 0 ? cur / target : 0);
  const done = cur >= target;
  const [menu, setMenu] = useState(false);

  // Timer: ticks locally and only persists when paused or completed, so a
  // running timer doesn't write a row every second.
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const shown = habit.kind === "timer" ? cur + elapsed : cur;
  const shownRatio = Math.min(1, target > 0 ? shown / target : 0);

  function stopTimer() {
    setRunning(false);
    if (elapsed > 0) {
      onSetCount(cur + elapsed);
      setElapsed(0);
    }
  }

  const R = 92;
  const C = 2 * Math.PI * R;

  return (
    <>
      <header className="relative flex items-center justify-between py-4">
        <button
          type="button"
          onClick={() => {
            if (running) stopTimer();
            onBack();
          }}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink active:bg-white/10"
        >
          ←
        </button>
        <h1 className="flex min-w-0 flex-1 flex-col items-center px-2">
          <span className="flex max-w-full items-center gap-2 text-base font-bold">
            <span aria-hidden>{habit.icon ?? "✅"}</span>
            <span className="truncate">{habit.name}</span>
          </span>
          {habit.description && (
            <span className="max-w-full truncate text-xs font-normal text-muted">
              {habit.description}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-label="Habit options"
          aria-expanded={menu}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-muted active:bg-white/10"
        >
          ⋯
        </button>

        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
            <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden elevation-3 rounded-xl bg-surface py-1">
              <MenuItem label="Edit" onClick={() => { setMenu(false); onEdit(); }} />
              <MenuItem label="Share progress" onClick={() => { setMenu(false); onShare(); }} />
              <MenuItem label="Archive" onClick={() => { setMenu(false); onArchive(); }} />
              <MenuItem label="Delete" danger onClick={() => { setMenu(false); onDelete(); }} />
            </div>
          </>
        )}
      </header>

      {date !== today && (
        <p className="rounded-xl bg-gold-soft px-3 py-1.5 text-center text-xs font-medium text-gold">
          Logging for {formatShortDate(date)}
        </p>
      )}

      {/* Big progress dial */}
      <div className="flex flex-1 items-center justify-center py-6">
        <div className="relative h-[220px] w-[220px]">
          <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
            <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            <circle
              cx="110" cy="110" r={R} fill="none" stroke={tone} strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - shownRatio)}
              style={{ transition: "stroke-dashoffset 300ms" }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl" aria-hidden>
              {habit.icon ?? "✅"}
            </span>
            {habit.kind === "timer" ? (
              <span className="mt-1 text-4xl font-bold tabular-nums text-ink">
                {formatDuration(Math.max(0, target - shown))}
              </span>
            ) : (
              <span className="mt-1 flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => onSetCount(Math.max(0, cur - 1))}
                  aria-label="Decrease"
                  className="text-2xl text-muted active:text-ink"
                >
                  −
                </button>
                <span className="text-4xl font-bold tabular-nums text-ink">{cur}</span>
                <button
                  type="button"
                  onClick={() => onSetCount(cur + 1)}
                  aria-label="Increase"
                  className="text-2xl text-muted active:text-ink"
                >
                  +
                </button>
              </span>
            )}
            <span className="mt-1 text-sm text-muted">
              {habit.kind === "timer"
                ? `${Math.round(target / 60)} min goal`
                : `/${target}${habit.unit ? ` ${habit.unit}` : ""}`}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-5 pb-2">
        <button
          type="button"
          onClick={() => { setElapsed(0); setRunning(false); onSetCount(0); }}
          aria-label="Reset"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-lg text-muted active:scale-95"
        >
          ↺
        </button>

        {habit.kind === "timer" ? (
          <button
            type="button"
            onClick={() => (running ? stopTimer() : setRunning(true))}
            className="flex h-14 min-w-[140px] items-center justify-center rounded-full text-base font-bold text-ink-inverse active:scale-95"
            style={{ backgroundColor: tone }}
          >
            {running ? "❚❚ Pause" : "▶ Start"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSetCount(cur + stepSize(habit))}
            className="flex h-14 min-w-[140px] items-center justify-center rounded-full text-base font-bold text-ink-inverse active:scale-95"
            style={{ backgroundColor: tone }}
          >
            Add
          </button>
        )}

        <button
          type="button"
          onClick={() => { setElapsed(0); setRunning(false); onSetCount(done ? 0 : target); }}
          aria-label={done ? "Mark not done" : "Mark complete"}
          aria-pressed={done}
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg active:scale-95"
          style={{
            backgroundColor: done ? tone : "rgba(255,255,255,0.06)",
            color: done ? "#111111" : "rgba(255,255,255,0.4)",
          }}
        >
          ✓
        </button>
      </div>
    </>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full px-4 py-2.5 text-left text-sm font-medium active:bg-white/10",
        danger ? "text-gold" : "text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ---------------- detail ----------------

function DetailView({
  habit,
  logs,
  today,
  onBack,
  onEdit,
  onToggle,
  onToggleDay,
  onDeleted,
}: {
  habit: Habit;
  logs: HabitsData["logs"];
  today: string;
  onBack: () => void;
  onEdit: () => void;
  onToggle: () => void;
  /** Toggle any past day straight from the week strip or the calendar. */
  onToggleDay: (date: string) => void;
  onDeleted: () => void;
}) {
  const tone = habitColor(habit.color);
  const streak = habitStreak(habit, logs, today);
  const days = weekDays(today);
  const doneThisWeek = days.filter((d) => d <= today && isComplete(habit, logs, d)).length;
  const elapsed = days.filter((d) => d <= today).length;
  const pct = elapsed === 0 ? 0 : Math.round((doneThisWeek / elapsed) * 100);
  const done = isComplete(habit, logs, today);
  const [confirm, setConfirm] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  // Month grid for the history calendar.
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;

  return (
    <>
      <header className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="elevation-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xl active:bg-white/10"
        >
          ←
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted active:bg-white/10"
        >
          Edit
        </button>
      </header>

      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
          style={{ backgroundColor: `${tone}1F` }}
        >
          {habit.icon ?? "✅"}
        </span>
        <h1 className="mt-3 text-xl font-bold text-ink">{habit.name}</h1>
        <p className="text-sm capitalize text-muted">{habit.cadence} habit</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl elevation-1 p-4 text-center">
          <p className="text-xl font-bold text-ink">
            {streak} <span aria-hidden>🔥</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {habit.cadence === "daily" ? "Day" : "Week"} streak
          </p>
        </div>
        <div className="rounded-2xl elevation-1 p-4 text-center">
          <p className="text-xl font-bold text-ink">{pct}%</p>
          <p className="mt-0.5 text-xs text-muted">This week</p>
        </div>
      </div>

      <section className="mt-3 rounded-2xl elevation-1 p-4">
        <p className="text-center text-sm font-semibold text-ink">This Week</p>
        <div className="mt-3 flex justify-between">
          {days.map((d, i) => {
            const ok = isComplete(habit, logs, d);
            const future = d > today;
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                onClick={() => {
                  setPicked(d);
                  onToggleDay(d);
                }}
                aria-label={`${habit.name} on ${d}`}
                aria-pressed={ok}
                className="flex flex-col items-center gap-1.5 disabled:opacity-25"
              >
                <span className="text-[11px] text-muted">{DOW[i]}</span>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs"
                  style={{
                    backgroundColor: ok ? tone : "transparent",
                    border: ok ? "none" : "1px solid rgba(255,255,255,0.15)",
                    color: ok ? "#111111" : "transparent",
                    outline: picked === d ? `2px solid ${tone}` : "none",
                    outlineOffset: "2px",
                  }}
                  aria-hidden
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {(habit.description || habit.reminder_time) && (
        <section className="mt-3 space-y-2">
          <h2 className="text-sm font-semibold text-muted">About this habit</h2>
          {habit.description && (
            <div className="rounded-2xl elevation-1 p-4">
              <p className="text-xs text-muted">Description</p>
              <p className="mt-1 text-sm text-ink">{habit.description}</p>
            </div>
          )}
          {habit.reminder_time && (
            <div className="flex items-center justify-between rounded-2xl elevation-1 p-4">
              <span className="flex items-center gap-2 text-sm text-ink">
                <span aria-hidden>🔔</span> Reminder
              </span>
              <span className="text-sm text-muted">{habit.reminder_time}</span>
            </div>
          )}
        </section>
      )}

      <h2 className="mb-2 mt-5 text-sm font-semibold text-muted">History</h2>
      <section className="rounded-2xl elevation-1 p-4">
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {DOW.map((d, i) => (
            <span key={i} className="text-[11px] text-muted">
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const key = addDaysKey(first, i);
            const ok = isComplete(habit, logs, key);
            const isToday = key === today;
            const future = key > today;
            return (
              <span key={key} className="flex justify-center">
                <button
                  type="button"
                  disabled={future}
                  onClick={() => {
                    setPicked(key);
                    onToggleDay(key);
                  }}
                  aria-label={`${habit.name} on ${key}`}
                  aria-pressed={ok}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs active:scale-90"
                  style={{
                    backgroundColor: ok ? tone : "transparent",
                    color: ok ? "#111111" : future ? "#5C5C5C" : "#F2F2F2",
                    border: isToday && !ok ? `1.5px solid ${tone}` : "none",
                    outline: picked === key ? `2px solid ${tone}` : "none",
                    outlineOffset: "1px",
                    fontWeight: ok || isToday ? 700 : 400,
                  }}
                >
                  {i + 1}
                </button>
              </span>
            );
          })}
        </div>
      </section>

      <div className="mt-5 space-y-2.5">
        {picked && picked !== today && (
          <p
            className="rounded-xl px-3 py-2 text-center text-xs"
            style={{ backgroundColor: `${tone}1F`, color: tone }}
          >
            <strong>{formatShortDate(picked)}</strong>{" "}
            {isComplete(habit, logs, picked) ? "marked done" : "cleared"} — tap it
            again to undo
          </p>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={[
            "w-full rounded-2xl px-4 py-3.5 text-base font-bold transition active:scale-[0.98]",
            done ? "border border-white/15 text-ink" : "bg-green text-ink-inverse",
          ].join(" ")}
        >
          {done ? "✓ Done today — tap to undo" : "✓ Mark as Done"}
        </button>
        {confirm ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await deleteHabit(habit.id);
                onDeleted();
              }}
              className="flex-1 rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink-inverse active:scale-95"
            >
              Delete habit
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="flex-1 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-ink active:bg-white/10"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-muted active:bg-white/10"
          >
            Delete habit
          </button>
        )}
      </div>
    </>
  );
}

// ---------------- create / edit ----------------

const FIELD =
  "elevation-2 h-[52px] w-full rounded-2xl px-4 text-base text-ink outline-none placeholder:text-subtle focus:border-green/60";
const LABEL = "px-0.5 text-xs font-semibold tracking-[0.08em] text-muted";

function Step({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="flex items-baseline gap-2.5 px-1">
        <span className="font-display text-sm font-semibold text-green">{n}</span>
        <span className="text-xs font-semibold tracking-[0.08em] text-muted">{label}</span>
      </span>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{label}</span>
      <div role="radiogroup" aria-label={label} className="elevation-2 grid grid-cols-2 gap-1 rounded-2xl p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={[
              "h-11 rounded-xl text-sm transition",
              value === o.value ? "bg-[#3A3A3A] font-semibold text-ink" : "font-medium text-muted",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditView({
  habit,
  onDone,
  onCancel,
}: {
  habit?: Habit;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  // Icon and colour aren't edited in the redesigned form; existing habits
  // keep theirs and new ones get the defaults.
  const icon = habit?.icon ?? HABIT_ICONS[0];
  const color = habitColor(habit?.color);
  const [cadence, setCadence] = useState<Cadence>(habit?.cadence ?? "daily");
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? "count");
  const [category, setCategory] = useState(habit?.category ?? "");
  // Timer targets are stored in seconds; the form talks in minutes.
  const [target, setTarget] = useState(
    String(
      habit
        ? habit.kind === "timer"
          ? Math.round(habit.target_per_period / 60)
          : habit.target_per_period
        : 1,
    ),
  );
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [reminder, setReminder] = useState(habit?.reminder_time ?? "");
  const [reminderDow, setReminderDow] = useState<number | null>(habit?.reminder_dow ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) return setError("Give the habit a name.");
    setBusy(true);
    setError("");
    try {
      const n = Math.max(1, Number(target) || 1);
      await saveHabit({
        id: habit?.id,
        name,
        description,
        icon,
        color,
        cadence,
        kind,
        category: category || null,
        target_per_period: kind === "timer" ? n * 60 : n,
        unit: kind === "timer" ? "min" : unit,
        reminder_time: reminder || null,
        reminder_dow: cadence === "weekly" ? reminderDow : null,
      });
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save.");
      setBusy(false);
    }
  }

  const targetLabel = kind === "timer" ? "MINUTES / DAY" : cadence === "daily" ? "TARGET / DAY" : "TIMES / WEEK";
  const showUnit = cadence === "daily" && kind === "count";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back"
          className="elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex flex-col gap-px">
          <span className="text-[15px] font-semibold">Habits</span>
          <span className="text-[13px] text-muted">{habit ? "Edit habit" : "New habit"}</span>
        </span>
      </div>

      <h1 className="px-1 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">
        {habit ? "Edit your" : "Build a"}
        <br />
        <span className="text-green">{habit ? "habit" : "new habit"}</span>
      </h1>

      <Step n="01" label="WHAT">
        <div className="elevation-1 flex flex-col gap-2.5 rounded-3xl p-3.5">
          <label>
            <span className="sr-only">Habit name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit name, e.g. Take Creatine" className={FIELD} />
          </label>
          <label>
            <span className="sr-only">Short description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              className={FIELD}
            />
          </label>
          <div className="flex flex-col gap-2 px-0.5 pb-0.5 pt-1.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">CATEGORY</span>
            <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
              {HABIT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(category === c ? "" : c)}
                  className={[
                    "h-10 rounded-full px-4 text-sm transition",
                    category === c ? "bg-green font-semibold text-ink-inverse" : "elevation-2 font-medium text-[#D4D4D4]",
                  ].join(" ")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Step>

      <Step n="02" label="HOW YOU TRACK IT">
        <div className="elevation-1 flex flex-col gap-3.5 rounded-3xl p-3.5">
          <Segmented
            label="TRACK BY"
            value={kind}
            options={KINDS.map((k) => ({ value: k, label: k === "count" ? "Counter" : "Timer" }))}
            onChange={setKind}
          />
          <Segmented
            label="REPEATS"
            value={cadence}
            options={CADENCES.map((c) => ({ value: c, label: c === "daily" ? "Daily" : "Weekly" }))}
            onChange={setCadence}
          />
          <div className={showUnit ? "grid grid-cols-2 gap-2.5" : "flex flex-col"}>
            <label className="flex flex-col gap-2">
              <span className={LABEL}>{targetLabel}</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="10"
                className="elevation-2 h-[60px] w-full rounded-2xl px-4 font-display text-[26px] font-semibold text-ink outline-none placeholder:text-subtle focus:border-green/60"
              />
            </label>
            {showUnit && (
              <label className="flex flex-col gap-2">
                <span className={LABEL}>UNIT</span>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, min, glasses" className={FIELD + " h-[60px]"} />
              </label>
            )}
          </div>
        </div>
      </Step>

      <Step n="03" label="REMINDER · OPTIONAL">
        <div className="elevation-1 flex flex-col gap-3 rounded-[20px] p-3.5">
          <label className="flex h-11 items-center justify-between gap-3 px-1">
            <span className="text-base font-semibold">Reminder time</span>
            <input
              type="time"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              aria-label="Reminder time"
              className="bg-transparent text-right text-sm font-medium text-muted outline-none [color-scheme:dark]"
            />
          </label>
          {cadence === "weekly" && (
            <>
              {/* A weekly habit needs a DAY as well as a time — "Sunday 09:00",
                  not just 09:00, which would fire every day of the week. */}
              <div className="flex gap-1.5">
                {DOW.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReminderDow(reminderDow === i ? null : i)}
                    aria-pressed={reminderDow === i}
                    aria-label={DOW_LABELS[i]}
                    className={[
                      "h-10 flex-1 rounded-xl text-xs font-semibold transition",
                      reminderDow === i ? "bg-green text-ink-inverse" : "elevation-2 text-muted",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="px-1 text-xs text-muted">
                {reminderDow === null
                  ? "No day picked — the reminder won't fire. Choose one."
                  : `Every ${DOW_LABELS[reminderDow]}`}
              </p>
            </>
          )}
        </div>
      </Step>

      {error && <p className="text-center text-sm text-gold">{error}</p>}

      {/* Sticky glass action */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-4 pb-7 safe-bottom">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="elevation-3 pointer-events-auto h-[60px] w-full rounded-full bg-green/[0.92] text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Saving…" : habit ? "Save changes" : "Create habit"}
        </button>
      </div>
    </div>
  );
}
