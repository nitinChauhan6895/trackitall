import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysKey, habitStreak, isDueOn, mondayIndex, weekDays, weekStart, type Habit, type HabitLog } from "../lib/habits.ts";

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Water",
  description: null,
  icon: null,
  color: null,
  cadence: "daily",
  kind: "count",
  category: null,
  target_per_period: 1,
  unit: null,
  reminder_time: null,
  reminder_dow: null,
  archived: false,
  position: 0,
  ...over,
});
const log = (log_date: string, count = 1): HabitLog => ({ habit_id: "h1", log_date, count, note: null });

test("date helpers", () => {
  assert.equal(addDaysKey("2026-02-28", 1), "2026-03-01");
  assert.equal(addDaysKey("2026-01-01", -1), "2025-12-31");
  assert.equal(mondayIndex("2026-11-16"), 0); // Monday
  assert.equal(weekStart("2026-11-22"), "2026-11-16");
  assert.deepEqual(weekDays("2026-11-18")[6], "2026-11-22");
});

test("weekly habit is due only on its weekday", () => {
  const h = habit({ cadence: "weekly", reminder_dow: 2 }); // Wednesday
  assert.equal(isDueOn(h, "2026-11-18"), true);
  assert.equal(isDueOn(h, "2026-11-19"), false);
  assert.equal(isDueOn(habit(), "2026-11-19"), true);
});

test("daily streak ignores an unfinished today", () => {
  const logs = [log("2026-11-13"), log("2026-11-14"), log("2026-11-15")];
  assert.equal(habitStreak(habit(), logs, "2026-11-15"), 3);
  assert.equal(habitStreak(habit(), logs, "2026-11-16"), 3);
  assert.equal(habitStreak(habit(), logs, "2026-11-17"), 0);
});
