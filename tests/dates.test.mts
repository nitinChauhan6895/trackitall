import { test } from "node:test";
import assert from "node:assert/strict";
import { formatShortDate, formatDayMonth, formatMonthYear, formatWeekdayDayMonth } from "../lib/dateFormat.ts";
import { addDaysKey, mondayIndex, weekStart, weekDays, habitStreak, type Habit, type HabitLog } from "../lib/habits.ts";

test("locale-independent date formatting", () => {
  assert.equal(formatShortDate("2026-08-13"), "13 Aug 2026");
  assert.equal(formatDayMonth("2026-08-13"), "13 Aug");
  assert.equal(formatMonthYear(2026, 8), "August 2026");
  assert.equal(formatWeekdayDayMonth("2026-08-13"), "Thu, 13 Aug");
  assert.equal(formatShortDate("bad"), "bad");
});

test("day-key helpers cross month and year boundaries", () => {
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysKey("2026-03-01", -1), "2026-02-28");
  assert.equal(mondayIndex("2026-11-23"), 0); // Monday
  assert.equal(mondayIndex("2026-11-29"), 6); // Sunday
  assert.equal(weekStart("2026-11-25"), "2026-11-23");
  assert.deepEqual(weekDays("2026-11-25")[6], "2026-11-29");
});

const habit = (o: Partial<Habit> = {}): Habit => ({
  id: "h", name: "Water", description: null, icon: null, color: null, cadence: "daily", kind: "count",
  category: null, target_per_period: 1, unit: null, reminder_time: null, reminder_dow: null,
  archived: false, position: 0, ...o,
});
const log = (date: string, count = 1): HabitLog => ({ habit_id: "h", log_date: date, count, note: null });

test("habitStreak: an unfinished today doesn't break the streak", () => {
  const logs = [log("2026-11-23"), log("2026-11-24")];
  assert.equal(habitStreak(habit(), logs, "2026-11-25"), 2);
  assert.equal(habitStreak(habit(), [...logs, log("2026-11-25")], "2026-11-25"), 3);
  assert.equal(habitStreak(habit(), logs, "2026-11-27"), 0);
});

test("habitStreak: weekly habits count completed weeks", () => {
  const h = habit({ cadence: "weekly", target_per_period: 2 });
  const logs = [log("2026-11-10"), log("2026-11-12"), log("2026-11-17"), log("2026-11-18")];
  assert.equal(habitStreak(h, logs, "2026-11-25"), 2);
});
