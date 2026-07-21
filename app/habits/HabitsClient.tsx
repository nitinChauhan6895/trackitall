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
  HABIT_COLORS,
  HABIT_CATEGORIES,
  HABIT_ICONS,
  KINDS,
  addDaysKey,
  applyLog,
  completeCount,
  countOn,
  formatDuration,
  nextCount,
  progressLabel,
  progressRatio,
  stepSize,
  habitStreak,
  isComplete,
  weekDays,
  weekOverview,
  weekProgress,
  type Cadence,
  type Habit,
  type HabitKind,
  type HabitsData,
} from "@/lib/habits";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_2 = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const INPUT =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-green";

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
    queryFn: loadHabitsAction,
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

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
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

      {view.name === "edit" && (
        <EditView
          habit={view.habitId ? habits.find((h) => h.id === view.habitId) : undefined}
          onDone={() => {
            setView({ name: "list" });
            refresh();
          }}
          onCancel={() => setView({ name: "list" })}
        />
      )}
    </main>
  );
}
// ---------------- today list ----------------

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
  const days = weekDays(date);
  const isPast = date !== today;

  return (
    <>
      <header className="flex items-center justify-between gap-3 pb-2 pt-5">
        <button
          type="button"
          onClick={() => onDate(today)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-bold transition",
            isPast ? "bg-orange text-white" : "bg-green/15 text-green",
          ].join(" ")}
        >
          {isPast ? "Back to today" : "Today"}
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          {isPast ? formatShortDate(date) : "Today"}
        </h1>
        <button
          type="button"
          onClick={onNew}
          aria-label="New habit"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-green text-2xl font-light text-ink-inverse active:scale-95"
        >
          +
        </button>
      </header>

      {/* Week strip — each day shows how much of that day was completed. */}
      <div className="mt-2 flex justify-between">
        {days.map((d, i) => {
          const sel = d === date;
          const future = d > today;
          const due = habits.filter((h) => h.cadence === "daily");
          const done = due.filter((h) => isComplete(h, logs, d)).length;
          const pct = due.length ? done / due.length : 0;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => onDate(d)}
              aria-label={`Show ${d}`}
              aria-pressed={sel}
              className="flex flex-1 flex-col items-center gap-1.5 disabled:opacity-30"
            >
              <span className="text-[11px] text-muted">{DOW_2[i]}</span>
              <span className="relative flex h-9 w-9 items-center justify-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                  {!future && pct > 0 && (
                    <circle
                      cx="18" cy="18" r="16" fill="none" stroke="#A8E830" strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 16}
                      strokeDashoffset={2 * Math.PI * 16 * (1 - pct)}
                    />
                  )}
                </svg>
                <span
                  className={[
                    "relative text-sm",
                    sel ? "font-bold text-ink" : "text-muted",
                  ].join(" ")}
                >
                  {Number(d.slice(8, 10))}
                </span>
                {sel && (
                  <span
                    aria-hidden
                    className="absolute -inset-1 rounded-full border-2 border-orange"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {categories.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={[
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                cat === c ? "bg-green text-ink-inverse" : "bg-white/[0.06] text-muted",
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {habits.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {shown.map((h) => (
            <li key={h.id}>
              <HabitCard
                habit={h}
                logs={logs}
                date={date}
                onOpen={() => onOpen(h.id)}
                onToggle={() => onToggle(h, date)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** A row whose background fills left-to-right with the day's progress. */
function HabitCard({
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
  const tone = habit.color ?? "#A8E830";
  const ratio = progressRatio(habit, logs, date);
  const done = isComplete(habit, logs, date);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface">
      {/* Progress fill behind the content. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${ratio * 100}%`, backgroundColor: `${tone}${done ? "" : "40"}` }}
      />
      <div className="relative flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-page/40 text-xl"
          >
            {habit.icon ?? "✅"}
          </span>
          <span className="min-w-0">
            <span
              className="block truncate font-semibold"
              style={{ color: done ? "#141807" : undefined }}
            >
              {habit.name}
            </span>
            <span
              className="mt-1 inline-block rounded-md bg-page/50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink"
            >
              {progressLabel(habit, logs, date)}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
          aria-pressed={done}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm transition active:scale-90"
          style={{
            backgroundColor: done ? "#141807" : "rgba(255,255,255,0.07)",
            color: done ? tone : "rgba(255,255,255,0.35)",
          }}
        >
          ✓
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
      <p className="text-3xl" aria-hidden>
        🌿
      </p>
      <p className="mt-3 font-semibold text-ink">No habits yet</p>
      <p className="mt-1 text-sm text-muted">
        Track the small things — creatine, water, stretching — and build streaks.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-5 rounded-2xl bg-green px-5 py-3 text-sm font-bold text-ink-inverse active:scale-95"
      >
        + Add your first habit
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
  const tone = habit.color ?? "#A8E830";
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
            <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-lg">
              <MenuItem label="Edit" onClick={() => { setMenu(false); onEdit(); }} />
              <MenuItem label="Share progress" onClick={() => { setMenu(false); onShare(); }} />
              <MenuItem label="Archive" onClick={() => { setMenu(false); onArchive(); }} />
              <MenuItem label="Delete" danger onClick={() => { setMenu(false); onDelete(); }} />
            </div>
          </>
        )}
      </header>

      {date !== today && (
        <p className="rounded-xl bg-orange-soft px-3 py-1.5 text-center text-xs font-medium text-orange">
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
            color: done ? "#141807" : "rgba(255,255,255,0.4)",
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
        danger ? "text-orange" : "text-ink",
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
  const tone = habit.color ?? "#A8E830";
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
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xl active:bg-white/10"
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
        <div className="rounded-2xl border border-white/10 bg-surface p-4 text-center">
          <p className="text-xl font-bold text-ink">
            {streak} <span aria-hidden>🔥</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {habit.cadence === "daily" ? "Day" : "Week"} streak
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4 text-center">
          <p className="text-xl font-bold text-ink">{pct}%</p>
          <p className="mt-0.5 text-xs text-muted">This week</p>
        </div>
      </div>

      <section className="mt-3 rounded-2xl border border-white/10 bg-surface p-4">
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
                    color: ok ? "#141807" : "transparent",
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
            <div className="rounded-2xl border border-white/10 bg-surface p-4">
              <p className="text-xs text-muted">Description</p>
              <p className="mt-1 text-sm text-ink">{habit.description}</p>
            </div>
          )}
          {habit.reminder_time && (
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface p-4">
              <span className="flex items-center gap-2 text-sm text-ink">
                <span aria-hidden>🔔</span> Reminder
              </span>
              <span className="text-sm text-muted">{habit.reminder_time}</span>
            </div>
          )}
        </section>
      )}

      <h2 className="mb-2 mt-5 text-sm font-semibold text-muted">History</h2>
      <section className="rounded-2xl border border-white/10 bg-surface p-4">
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
                    color: ok ? "#141807" : future ? "#5A6052" : "#F1F3EA",
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
              className="flex-1 rounded-2xl bg-orange px-4 py-3 text-sm font-bold text-white active:scale-95"
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
  const [icon, setIcon] = useState(habit?.icon ?? HABIT_ICONS[0]);
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[0]);
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

  return (
    <>
      <header className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xl active:bg-white/10"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">{habit ? "Edit habit" : "New habit"}</h1>
      </header>

      <div className="space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name (e.g. Take Creatine)"
          className={INPUT}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className={INPUT}
        />

        <div>
          <p className="mb-2 text-sm font-medium text-muted">Icon</p>
          <div className="flex flex-wrap gap-2">
            {HABIT_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                aria-label={`Icon ${ic}`}
                aria-pressed={icon === ic}
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-xl border text-xl",
                  icon === ic ? "border-green bg-green-tint" : "border-white/10 bg-surface",
                ].join(" ")}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">Colour</p>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid #F1F3EA" : "none",
                  outlineOffset: "2px",
                  color: "#141807",
                }}
              >
                {color === c ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">Track by</p>
          <div className="flex rounded-xl bg-white/[0.06] p-1">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={[
                  "flex-1 rounded-lg py-2 text-sm font-semibold transition",
                  kind === k ? "bg-green text-ink-inverse" : "text-muted",
                ].join(" ")}
              >
                {k === "count" ? "Counter" : "Timer"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">Category</p>
          <div className="flex flex-wrap gap-2">
            {HABIT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? "" : c)}
                aria-pressed={category === c}
                className={[
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                  category === c ? "bg-green text-ink-inverse" : "bg-white/[0.06] text-muted",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted">Repeats</p>
          <div className="flex rounded-xl bg-white/[0.06] p-1">
            {CADENCES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={[
                  "flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition",
                  cadence === c ? "bg-green text-ink-inverse" : "text-muted",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-muted">
              {kind === "timer"
                ? "Minutes per day"
                : cadence === "daily"
                  ? "Target per day"
                  : "Times per week"}
            </span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              type="number"
              inputMode="numeric"
              min={1}
              className={INPUT}
            />
          </label>
          {cadence === "daily" && kind === "count" && (
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-muted">Unit</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="glasses"
                className={INPUT}
              />
            </label>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-muted">Reminder (optional)</p>
          {cadence === "weekly" && (
            <>
              {/* A weekly habit needs a DAY as well as a time — "Sunday 09:00",
                  not just 09:00, which would fire every day of the week. */}
              <div className="mb-2 flex gap-1.5">
                {DOW.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReminderDow(reminderDow === i ? null : i)}
                    aria-pressed={reminderDow === i}
                    aria-label={DOW_LABELS[i]}
                    className={[
                      "h-9 flex-1 rounded-lg border text-xs font-semibold transition",
                      reminderDow === i
                        ? "border-green bg-green-tint text-green"
                        : "border-white/10 text-muted",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-xs text-muted">
                {reminderDow === null
                  ? "No day picked — the reminder won't fire. Choose one."
                  : `Every ${DOW_LABELS[reminderDow]}`}
              </p>
            </>
          )}
          <input
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            type="time"
            className={INPUT}
          />
        </div>

        {error && <p className="text-sm text-orange">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="w-full rounded-2xl bg-green px-4 py-3.5 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : habit ? "Save changes" : "Create habit"}
        </button>
      </div>
    </>
  );
}
