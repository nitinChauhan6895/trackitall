import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStreak, hasPerfectWeek, longestGapDays, longestStreak, maxWorkoutsInWindow } from "../lib/badges.ts";

test("longestStreak counts consecutive days", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05"]), 3);
  // across a month boundary
  assert.equal(longestStreak(["2026-01-31", "2026-02-01"]), 2);
});

test("currentStreak allows today not yet trained", () => {
  const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
  assert.equal(currentStreak(days, "2026-03-03"), 3);
  assert.equal(currentStreak(days, "2026-03-04"), 3);
  assert.equal(currentStreak(days, "2026-03-05"), 0);
});

test("window, gap and perfect week", () => {
  const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
  assert.equal(maxWorkoutsInWindow(days), 7);
  assert.equal(hasPerfectWeek(days), true); // Mon 2 Nov .. Sun 8 Nov
  assert.equal(hasPerfectWeek(days.slice(1)), false);
  assert.equal(longestGapDays(["2026-01-01", "2026-01-11"]), 10);
});
