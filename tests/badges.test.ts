// Unit tests for streak and badge helpers (lib/badges.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentStreak,
  hasPerfectWeek,
  longestGapDays,
  longestStreak,
  maxWorkoutsInWindow,
} from "../lib/badges.ts";

test("longestStreak counts consecutive days, across month ends", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-03"]), 3);
});

test("currentStreak allows today not trained yet", () => {
  const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
  assert.equal(currentStreak(days, "2026-03-03"), 3);
  assert.equal(currentStreak(days, "2026-03-04"), 3);
  assert.equal(currentStreak(days, "2026-03-05"), 0);
});

test("maxWorkoutsInWindow uses a rolling 7-day window", () => {
  const days = ["2026-01-01", "2026-01-02", "2026-01-07", "2026-01-08"];
  assert.equal(maxWorkoutsInWindow(days), 3);
});

test("longestGapDays", () => {
  assert.equal(longestGapDays(["2026-01-01", "2026-01-05", "2026-01-06"]), 4);
});

test("hasPerfectWeek needs every day of one Mon–Sun week", () => {
  // 2026-01-05 is a Monday.
  const week = ["05", "06", "07", "08", "09", "10", "11"].map((d) => `2026-01-${d}`);
  assert.equal(hasPerfectWeek(week), true);
  // Tue→Mon spans two calendar weeks.
  const shifted = ["06", "07", "08", "09", "10", "11", "12"].map((d) => `2026-01-${d}`);
  assert.equal(hasPerfectWeek(shifted), false);
});
