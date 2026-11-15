import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStreak, hasPerfectWeek, longestGapDays, longestStreak, maxWorkoutsInWindow } from "../lib/badges.ts";

test("longestStreak counts consecutive days, ignoring duplicates and order", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-01-03", "2026-01-01", "2026-01-02", "2026-01-02", "2026-01-05"]), 3);
  // Across a month boundary.
  assert.equal(longestStreak(["2026-01-31", "2026-02-01"]), 2);
});

test("currentStreak allows a not-yet-trained today", () => {
  const days = ["2026-05-08", "2026-05-09", "2026-05-10"];
  assert.equal(currentStreak(days, "2026-05-10"), 3);
  assert.equal(currentStreak(days, "2026-05-11"), 3);
  assert.equal(currentStreak(days, "2026-05-12"), 0);
});

test("window, gap and perfect-week helpers", () => {
  const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-20"];
  assert.equal(maxWorkoutsInWindow(days), 7);
  assert.equal(longestGapDays(days), 13);
  assert.equal(hasPerfectWeek(days), true); // 1–7 June 2026 is Mon–Sun
  assert.equal(hasPerfectWeek(days.slice(1)), false);
});
