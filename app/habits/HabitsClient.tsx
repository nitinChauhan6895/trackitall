"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadHabitsAction, saveHabit, setHabitCount, deleteHabit } from "@/app/actions";
import { qk } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatShortDate } from "@/lib/dateFormat";
import {
  CADENCES,
  HABIT_COLORS,
  HABIT_ICONS,
  addDaysKey,
  applyLog,
  countOn,
  nextCount,
  habitStreak,
  isComplete,
  weekDays,
  weekOverview,
  weekProgress,
  type Cadence,
  type Habit,
  type HabitsData,
} from "@/lib/habits";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const INPUT =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-green";

type View =
  | { name: "list" }
  | { name: "day" }
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

  /** Toggle or step a habit's progress for a day, optimistically. */
  async function bump(habit: Habit, date: string, next?: number) {
    const value = next !== undefined ? next : nextCount(habit, logs, date);

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

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      {view.name === "list" && (
        <ListView
          habits={habits}
          logs={logs}
          today={today}
          onOpenDay={() => setView({ name: "day" })}
          onOpen={(id) => setView({ name: "detail", habitId: id })}
          onNew={() => setView({ name: "edit" })}
          onToggle={(h, d) => bump(h, d)}
          onSetCount={(h, d, c) => bump(h, d, c)}
        />
      )}

      {view.name === "day" && (
        <DayView
          habits={habits}
          logs={logs}
          today={today}
          date={selectedDay}
          onDate={setSelectedDay}
          onBack={() => setView({ name: "list" })}
          onOpen={(id) => setView({ name: "detail", habitId: id })}
          onToggle={(h) => bump(h, selectedDay)}
        />
      )}

      {view.name === "detail" && detail && (
        <DetailView
          habit={detail}
          logs={logs}
          today={today}
          onBack={() => setView({ name: "list" })}
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

// ---------------- list ----------------

function ListView({
  habits,
  logs,
  today,
  onOpen,
  onOpenDay,
  onNew,
  onToggle,
  onSetCount,
}: {
  habits: Habit[];
  logs: HabitsData["logs"];
  today: string;
  onOpen: (id: string) => void;
  onOpenDay: () => void;
  onNew: () => void;
  onToggle: (h: Habit, date: string) => void;
  onSetCount: (h: Habit, date: string, count: number) => void;
}) {
  const [filter, setFilter] = useState<"all" | Cadence>("all");
  const ov = weekOverview(habits, logs, today);
  const shown = habits.filter((h) => filter === "all" || h.cadence === filter);
  const daily = shown.filter((h) => h.cadence === "daily");
  const weekly = shown.filter((h) => h.cadence === "weekly");
  const maxDone = Math.max(1, ...ov.perDay.map((d) => d.done));

  return (
    <>
      <header className="flex items-start justify-between gap-3 pb-3 pt-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Habits <span aria-hidden>🌿</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted">Small habits, big changes.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenDay}
            aria-label="Today's habits"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-surface text-lg active:bg-white/10"
          >
            🗓
          </button>
          <button
            type="button"
            onClick={onNew}
            aria-label="New habit"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-green text-2xl font-light text-ink-inverse active:scale-95"
          >
            +
          </button>
        </div>
      </header>

      {habits.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <>
          {/* This week overview */}
          <section className="rounded-2xl border border-white/10 bg-surface p-4">
            <p className="text-sm font-medium text-ink">This Week Overview</p>
            <div className="mt-3 flex items-center gap-4">
              <Ring percent={ov.percent} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="flex items-center gap-2 text-sm">
                  <span className="text-green" aria-hidden>
                    ✓
                  </span>
                  <span className="font-bold text-ink">{ov.completed}</span>
                  <span className="text-muted">Completed</span>
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <span className="text-orange" aria-hidden>
                    ◷
                  </span>
                  <span className="font-bold text-ink">{ov.remaining}</span>
                  <span className="text-muted">Remaining</span>
                </p>
              </div>
              <div className="flex h-16 shrink-0 items-end gap-0.5">
                {ov.perDay.map((d, i) => (
                  <div key={d.key} className="flex w-2.5 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${d.future ? 4 : Math.max(4, (d.done / maxDone) * 44)}px`,
                        background: d.future
                          ? "#2A2D24"
                          : d.due > 0 && d.done >= d.due
                            ? "#A8E830"
                            : d.done > 0
                              ? "#FF6233"
                              : "#33362C",
                      }}
                    />
                    <span className="text-[9px] text-muted">{DOW[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Filters */}
          <div className="mt-4 flex rounded-xl bg-white/[0.06] p-1">
            {(["all", "daily", "weekly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={[
                  "flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition",
                  filter === f ? "bg-green text-ink-inverse" : "text-muted",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>

          {daily.length > 0 && (
            <>
              <h2 className="mb-2 mt-5 text-sm font-semibold text-muted">Daily Habits</h2>
              <ul className="space-y-2.5">
                {daily.map((h) => (
                  <li key={h.id}>
                    <HabitRow
                      habit={h}
                      logs={logs}
                      today={today}
                      onOpen={() => onOpen(h.id)}
                      onToggleDay={(d) => onToggle(h, d)}
                      onSetCount={(d, c) => onSetCount(h, d, c)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}

          {weekly.length > 0 && (
            <>
              <h2 className="mb-2 mt-5 text-sm font-semibold text-muted">Weekly Habits</h2>
              <ul className="space-y-2.5">
                {weekly.map((h) => (
                  <li key={h.id}>
                    <HabitRow
                      habit={h}
                      logs={logs}
                      today={today}
                      onOpen={() => onOpen(h.id)}
                      onToggleDay={(d) => onToggle(h, d)}
                      onSetCount={(d, c) => onSetCount(h, d, c)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}

function HabitRow({
  habit,
  logs,
  today,
  onOpen,
  onToggleDay,
  onSetCount,
}: {
  habit: Habit;
  logs: HabitsData["logs"];
  today: string;
  onOpen: () => void;
  onToggleDay: (date: string) => void;
  onSetCount: (date: string, count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const tone = habit.color ?? "#A8E830";
  const streak = habitStreak(habit, logs, today);
  const days = weekDays(today);
  const doneToday = isComplete(habit, logs, today);
  const cur = countOn(logs, habit.id, today);
  const multi = habit.cadence === "daily" && habit.target_per_period > 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-surface">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: `${tone}1F` }}
          >
            {habit.icon ?? "✅"}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{habit.name}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {streak > 0 ? (
                <>
                  <span aria-hidden>🔥</span> {streak}{" "}
                  {habit.cadence === "daily" ? "day" : "week"} streak
                </>
              ) : habit.cadence === "weekly" ? (
                `${weekProgress(habit, logs, today)} / ${habit.target_per_period} this week`
              ) : (
                "No streak yet"
              )}
            </span>
          </span>
        </button>

        {/* Today's action, always one tap away. */}
        {multi ? (
          <button
            type="button"
            onClick={() => onSetCount(today, cur >= habit.target_per_period ? 0 : cur + 1)}
            aria-label={`Add one to ${habit.name}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold tabular-nums active:scale-95"
            style={{ borderColor: `${tone}66`, color: tone }}
          >
            <span className="text-base leading-none">+</span>
            {cur}/{habit.target_per_period}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleDay(today)}
            aria-label={doneToday ? `Undo ${habit.name}` : `Mark ${habit.name} done`}
            aria-pressed={doneToday}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm active:scale-95"
            style={{
              backgroundColor: doneToday ? tone : "transparent",
              border: doneToday ? "none" : "1.5px solid rgba(255,255,255,0.25)",
              color: doneToday ? "#141807" : "transparent",
            }}
          >
            ✓
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} ${habit.name} week`}
          className="shrink-0 px-1 text-muted active:opacity-70"
        >
          {open ? "⌃" : "⌄"}
        </button>
      </div>

      {/* Expanded: tap any past day to mark it done or undo it. */}
      {open && (
        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex justify-between">
            {days.map((d, i) => {
              const done = isComplete(habit, logs, d);
              const future = d > today;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={future}
                  onClick={() => onToggleDay(d)}
                  aria-label={`${habit.name} on ${d}`}
                  aria-pressed={done}
                  className="flex flex-col items-center gap-1.5 disabled:opacity-25"
                >
                  <span className="text-[10px] text-muted">{DOW[i]}</span>
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs"
                    style={{
                      backgroundColor: done ? tone : "transparent",
                      border: done ? "none" : "1px solid rgba(255,255,255,0.2)",
                      color: done ? "#141807" : "transparent",
                    }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="text-[10px] text-muted">{Number(d.slice(8, 10))}</span>
                </button>
              );
            })}
          </div>
          {multi && (
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onSetCount(today, Math.max(0, cur - 1))}
                aria-label="Decrease"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg text-ink active:bg-white/10"
              >
                −
              </button>
              <span className="text-sm font-semibold tabular-nums text-ink">
                {cur} / {habit.target_per_period} {habit.unit ?? ""}
              </span>
              <button
                type="button"
                onClick={() => onSetCount(today, cur + 1)}
                aria-label="Increase"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg text-ink active:bg-white/10"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Ring({ percent }: { percent: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={R} fill="none" stroke="#2A2D24" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke="#A8E830"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * Math.min(100, percent)) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none text-ink">{percent}%</span>
        <span className="text-[9px] text-muted">Completed</span>
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

// ---------------- day ----------------

function DayView({
  habits,
  logs,
  today,
  date,
  onDate,
  onBack,
  onOpen,
  onToggle,
}: {
  habits: Habit[];
  logs: HabitsData["logs"];
  today: string;
  date: string;
  onDate: (d: string) => void;
  onBack: () => void;
  onOpen: (id: string) => void;
  onToggle: (h: Habit) => void;
}) {
  const days = weekDays(date);
  const due = habits.filter((h) => h.cadence === "daily");
  const doneCount = due.filter((h) => isComplete(h, logs, date)).length;
  const pct = due.length === 0 ? 0 : Math.round((doneCount / due.length) * 100);

  return (
    <>
      <header className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xl active:bg-white/10"
        >
          ←
        </button>
        <h1 className="flex-1 text-center text-lg font-bold">Daily</h1>
        <span className="h-9 w-9" />
      </header>

      <div className="flex justify-between gap-1">
        {days.map((d, i) => {
          const on = d === date;
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => onDate(d)}
              className={[
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition disabled:opacity-30",
                on ? "bg-green text-ink-inverse font-bold" : "text-muted active:bg-white/10",
              ].join(" ")}
            >
              <span>{DOW[i]}</span>
              <span className={on ? "" : "text-ink"}>{Number(d.slice(8, 10))}</span>
            </button>
          );
        })}
      </div>

      <h2 className="mt-5 text-base font-semibold text-ink">{formatShortDate(date)}</h2>
      <p className="mt-1 text-sm text-muted">
        {doneCount} of {due.length} habits completed
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-green" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-2.5">
        {due.map((h) => {
          const done = isComplete(h, logs, date);
          const tone = h.color ?? "#A8E830";
          const cur = countOn(logs, h.id, date);
          return (
            <li
              key={h.id}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-surface p-3"
            >
              <button
                type="button"
                onClick={() => onOpen(h.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ backgroundColor: `${tone}1F` }}
                >
                  {h.icon ?? "✅"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{h.name}</span>
                  {h.description && (
                    <span className="block truncate text-xs text-muted">
                      {h.description}
                    </span>
                  )}
                  {h.target_per_period > 1 && (
                    <span className="mt-0.5 block text-xs font-medium" style={{ color: tone }}>
                      {cur} / {h.target_per_period} {h.unit ?? ""}
                    </span>
                  )}
                  {h.reminder_time && (
                    <span className="block text-xs text-muted">{h.reminder_time}</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggle(h)}
                aria-label={done ? `Undo ${h.name}` : `Mark ${h.name} done`}
                aria-pressed={done}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                style={{
                  backgroundColor: done ? tone : "transparent",
                  border: done ? "none" : "1.5px solid rgba(255,255,255,0.25)",
                  color: done ? "#141807" : "transparent",
                }}
              >
                ✓
              </button>
            </li>
          );
        })}
      </ul>
      {due.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">No daily habits yet.</p>
      )}
    </>
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
                onClick={() => onToggleDay(d)}
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
                  onClick={() => onToggleDay(key)}
                  aria-label={`${habit.name} on ${key}`}
                  aria-pressed={ok}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs active:scale-90"
                  style={{
                    backgroundColor: ok ? tone : "transparent",
                    color: ok ? "#141807" : future ? "#5A6052" : "#F1F3EA",
                    border: isToday && !ok ? `1.5px solid ${tone}` : "none",
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
  const [target, setTarget] = useState(String(habit?.target_per_period ?? 1));
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [reminder, setReminder] = useState(habit?.reminder_time ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) return setError("Give the habit a name.");
    setBusy(true);
    setError("");
    try {
      await saveHabit({
        id: habit?.id,
        name,
        description,
        icon,
        color,
        cadence,
        target_per_period: Number(target) || 1,
        unit,
        reminder_time: reminder || null,
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
              {cadence === "daily" ? "Target per day" : "Times per week"}
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
          {cadence === "daily" && (
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

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            Reminder time (optional)
          </span>
          <input
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            type="time"
            className={INPUT}
          />
        </label>

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
