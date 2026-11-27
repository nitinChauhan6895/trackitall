import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentStreak,
  hasPerfectWeek,
  longestGapDays,
  longestStreak,
  maxWorkoutsInWindow,
} from "../lib/badges.ts";

test("longestStreak counts consecutive days, ignoring order and duplicates", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-11-03", "2026-11-01", "2026-11-02", "2026-11-05"]), 3);
  assert.equal(longestStreak(["2026-02-28", "2026-03-01"]), 2); // month boundary
});

test("currentStreak allows today not yet trained", () => {
  const days = ["2026-11-23", "2026-11-24", "2026-11-25"];
  assert.equal(currentStreak(days, "2026-11-25"), 3);
  assert.equal(currentStreak(days, "2026-11-26"), 3);
  assert.equal(currentStreak(days, "2026-11-27"), 0);
});

test("maxWorkoutsInWindow uses a rolling 7-day window", () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-07", "2026-11-08", "2026-11-09"];
  assert.equal(maxWorkoutsInWindow(days), 4);
});

test("longestGapDays", () => {
  assert.equal(longestGapDays(["2026-11-01"]), 0);
  assert.equal(longestGapDays(["2026-11-01", "2026-11-16", "2026-11-17"]), 15);
});

test("hasPerfectWeek needs Mon–Sun of one calendar week", () => {
  // 2026-11-16 is a Monday.
  const week = Array.from({ length: 7 }, (_, i) => `2026-11-${16 + i}`);
  assert.equal(hasPerfectWeek(week), true);
  // Tue→Mon spans two calendar weeks.
  const shifted = Array.from({ length: 7 }, (_, i) => `2026-11-${17 + i}`);
  assert.equal(hasPerfectWeek(shifted), false);
});
