// Habit tracking: types plus the pure date/streak maths.
//
// Everything here is deliberately free of Date-now and locale calls so it can
// be unit-tested and so the server and the device always agree (the app is
// offline-first and renders cached HTML — see lib/dateFormat.ts).

export const CADENCES = ["daily", "weekly"] as const;
export type Cadence = (typeof CADENCES)[number];

/** A habit is either a tally or a duration. */
export const KINDS = ["count", "timer"] as const;
export type HabitKind = (typeof KINDS)[number];

/** Starter categories for the filter chips; users can type their own. */
export const HABIT_CATEGORIES = ["Health", "Diet", "Fitness", "Mind", "Work"];

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  cadence: Cadence;
  kind: HabitKind;
  category: string | null;
  /** Counter: units per period (8 glasses). Timer: SECONDS per period. */
  target_per_period: number;
  unit: string | null;
  reminder_time: string | null;
  /** Weekly habits only: 0 = Monday .. 6 = Sunday. null means any day. */
  reminder_dow: number | null;
  archived: boolean;
  position: number;
};

export type HabitLog = {
  habit_id: string;
  log_date: string; // YYYY-MM-DD
  count: number;
  note: string | null;
};

export type HabitsData = { habits: Habit[]; logs: HabitLog[] };

/** Palette offered when creating a habit (kept in sync with the dark theme). */
export const HABIT_COLORS = [
  "#A8E830",
  "#FF6233",
  "#3FAE8E",
  "#5A6FE0",
  "#C79BE8",
  "#E0A52A",
];

/** Reminder weekday labels, Monday-first to match the app's week strips. */
export const DOW_LABELS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export const HABIT_ICONS = [
  "💊", "💧", "🧘", "🏃", "📖", "🥗", "😴", "✍️", "🧴", "🦷", "🚭", "☀️",
];

// ---- date helpers (all operate on YYYY-MM-DD keys) ----

export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Day of week with Monday = 0, matching the M-T-W-T-F-S-S strips. */
export function mondayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  return addDaysKey(key, -mondayIndex(key));
}

/** The seven day-keys of the week containing `key`, Monday first. */
export function weekDays(key: string): string[] {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
}

/**
 * Is this habit due on `date`?
 *
 * Daily habits are due every day. A weekly habit is due only on its chosen
 * weekday (reminder_dow, Monday = 0); a weekly habit with no day set has no
 * fixed slot, so it's treated as always available to log.
 */
export function isDueOn(habit: Habit, date: string): boolean {
  if (habit.cadence === "daily") return true;
  if (habit.reminder_dow == null) return true;
  return mondayIndex(date) === habit.reminder_dow;
}

// ---- progress ----

/** Total logged for a habit on one day. */
export function countOn(logs: HabitLog[], habitId: string, date: string): number {
  for (const l of logs) {
    if (l.habit_id === habitId && l.log_date === date) return l.count;
  }
  return 0;
}

/**
 * Is the habit satisfied for the period containing `date`?
 * Daily -> that day's count reaches the target.
 * Weekly -> the number of days logged that week reaches the target.
 */
export function isComplete(habit: Habit, logs: HabitLog[], date: string): boolean {
  if (habit.cadence === "daily") {
    return countOn(logs, habit.id, date) >= habit.target_per_period;
  }
  return weekProgress(habit, logs, date) >= habit.target_per_period;
}

/** Days logged this week (weekly habits) — capped for display by the caller. */
export function weekProgress(habit: Habit, logs: HabitLog[], date: string): number {
  const days = new Set(weekDays(date));
  let n = 0;
  for (const l of logs) {
    if (l.habit_id === habit.id && l.count > 0 && days.has(l.log_date)) n++;
  }
  return n;
}

/**
 * Consecutive completed periods ending at `today`.
 *
 * A period that isn't finished yet doesn't break the streak: if today hasn't
 * been done, the streak is measured to yesterday. Otherwise every streak would
 * read zero each morning, which is exactly when people open the app.
 */
export function habitStreak(habit: Habit, logs: HabitLog[], today: string): number {
  const step = habit.cadence === "daily" ? 1 : 7;
  let cursor = today;
  if (!isComplete(habit, logs, cursor)) {
    cursor = addDaysKey(cursor, -step);
    if (!isComplete(habit, logs, cursor)) return 0;
  }
  let n = 0;
  // 1000 periods is ~3 years daily; far past any real streak, and it stops a
  // corrupt log set from spinning forever.
  while (n < 1000 && isComplete(habit, logs, cursor)) {
    n++;
    cursor = addDaysKey(cursor, -step);
  }
  return n;
}

export type WeekOverview = {
  /** 0-100, share of habit-days completed this week so far. */
  percent: number;
  completed: number;
  remaining: number;
  /** Per weekday (Mon..Sun): completed count, and how many were due. */
  perDay: { key: string; done: number; due: number; future: boolean }[];
};

/**
 * This week at a glance. Only counts days up to `today` — a Monday shouldn't
 * report 14% just because the rest of the week hasn't happened.
 */
export function weekOverview(
  habits: Habit[],
  logs: HabitLog[],
  today: string,
): WeekOverview {
  const days = weekDays(today);
  const daily = habits.filter((h) => h.cadence === "daily" && !h.archived);
  const weekly = habits.filter((h) => h.cadence === "weekly" && !h.archived);

  let completed = 0;
  let due = 0;
  const perDay = days.map((key) => {
    const future = key > today;
    let done = 0;
    if (!future) {
      for (const h of daily) if (isComplete(h, logs, key)) done++;
    }
    if (!future) {
      completed += done;
      due += daily.length;
    }
    return { key, done, due: future ? 0 : daily.length, future };
  });

  // Weekly habits count once for the whole week.
  for (const h of weekly) {
    due += 1;
    if (isComplete(h, logs, today)) completed += 1;
  }

  const percent = due === 0 ? 0 : Math.round((completed / due) * 100);
  return { percent, completed, remaining: Math.max(0, due - completed), perDay };
}

/**
 * Apply a habit-day change to a log list — the optimistic update behind every
 * tap. Pure so it can be tested directly; a count of 0 removes the day.
 */
export function applyLog(
  logs: HabitLog[],
  habitId: string,
  date: string,
  count: number,
  note: string | null = null,
): HabitLog[] {
  const rest = logs.filter((l) => !(l.habit_id === habitId && l.log_date === date));
  return count > 0
    ? [...rest, { habit_id: habitId, log_date: date, count, note }]
    : rest;
}

/**
 * What a tap should set the count to: cycle up to the target for multi-count
 * daily habits, otherwise toggle done/not-done.
 */
export function nextCount(habit: Habit, logs: HabitLog[], date: string): number {
  const cur = countOn(logs, habit.id, date);
  if (habit.cadence === "daily" && habit.target_per_period > 1) {
    return cur >= habit.target_per_period ? 0 : cur + 1;
  }
  return cur > 0 ? 0 : 1;
}

/**
 * Count for an explicit "mark as done" action: fill the period in one tap, or
 * clear it if it's already done.
 *
 * Distinct from nextCount, which steps by one for the "+" counter. A button
 * labelled "Mark as Done" must finish the habit outright — stepping would make
 * a 10-unit habit take ten taps to complete.
 *
 * A weekly habit's day counts as one occurrence, not the weekly target.
 */
export function completeCount(habit: Habit, logs: HabitLog[], date: string): number {
  if (isComplete(habit, logs, date)) return 0;
  return habit.cadence === "daily" ? habit.target_per_period : 1;
}


// ---- counter / timer presentation ----

/** "7:05", or "12:03:20" once it passes an hour. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** The "7/10 g" or "0/10min" badge under a habit's name. */
export function progressLabel(habit: Habit, logs: HabitLog[], date: string): string {
  const cur = countOn(logs, habit.id, date);
  if (habit.kind === "timer") {
    return `${Math.floor(cur / 60)}/${Math.round(habit.target_per_period / 60)}min`;
  }
  return `${cur}/${habit.target_per_period}${habit.unit ? ` ${habit.unit}` : ""}`;
}

/** 0..1 share of the period's target reached on `date`. */
export function progressRatio(habit: Habit, logs: HabitLog[], date: string): number {
  if (habit.cadence === "weekly") {
    return Math.min(1, weekProgress(habit, logs, date) / habit.target_per_period);
  }
  const cur = countOn(logs, habit.id, date);
  return Math.min(1, habit.target_per_period > 0 ? cur / habit.target_per_period : 0);
}

/** How much one tap of "+" adds: a minute for timers, one unit otherwise. */
export function stepSize(habit: Habit): number {
  return habit.kind === "timer" ? 60 : 1;
}
