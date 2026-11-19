import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentStreak,
  hasPerfectWeek,
  longestGapDays,
  longestStreak,
  maxWorkoutsInWindow,
} from "../lib/badges.ts";

test("longestStreak counts consecutive days, ignoring duplicates and order", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-03-03", "2026-03-01", "2026-03-02", "2026-03-05"]), 3);
  // Across a month boundary.
  assert.equal(longestStreak(["2026-02-27", "2026-02-28", "2026-03-01"]), 3);
});

test("currentStreak allows today to be not yet trained", () => {
  const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
  assert.equal(currentStreak(days, "2026-03-03"), 3);
  assert.equal(currentStreak(days, "2026-03-04"), 3);
  assert.equal(currentStreak(days, "2026-03-05"), 0);
});

test("maxWorkoutsInWindow and longestGapDays", () => {
  const days = ["2026-03-01", "2026-03-03", "2026-03-07", "2026-03-20"];
  assert.equal(maxWorkoutsInWindow(days, 7), 3);
  assert.equal(longestGapDays(days), 13);
});

test("hasPerfectWeek needs Monday to Sunday of one calendar week", () => {
  // 2026-03-02 is a Monday.
  const week = ["02", "03", "04", "05", "06", "07", "08"].map((d) => `2026-03-${d}`);
  assert.equal(hasPerfectWeek(week), true);
  // Seven days in a row that straddle two weeks don't count.
  const straddle = ["04", "05", "06", "07", "08", "09", "10"].map((d) => `2026-03-${d}`);
  assert.equal(hasPerfectWeek(straddle), false);
});
