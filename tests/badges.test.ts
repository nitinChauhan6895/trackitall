import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStreak, hasPerfectWeek, longestGapDays, longestStreak, maxWorkoutsInWindow } from "@/lib/badges";

test("longestStreak counts consecutive days, ignoring order and duplicates", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-01-03", "2026-01-01", "2026-01-02", "2026-01-02", "2026-01-05"]), 3);
  // across a month boundary
  assert.equal(longestStreak(["2026-01-31", "2026-02-01"]), 2);
});

test("currentStreak allows today to be untrained yet", () => {
  const days = ["2026-05-10", "2026-05-11", "2026-05-12"];
  assert.equal(currentStreak(days, "2026-05-12"), 3);
  assert.equal(currentStreak(days, "2026-05-13"), 3);
  assert.equal(currentStreak(days, "2026-05-14"), 0);
});

test("maxWorkoutsInWindow / longestGapDays / hasPerfectWeek", () => {
  assert.equal(maxWorkoutsInWindow(["2026-01-01", "2026-01-07", "2026-01-08"]), 2);
  assert.equal(longestGapDays(["2026-01-01", "2026-01-11", "2026-01-12"]), 10);
  // 2026-01-05 is a Monday
  const week = ["05", "06", "07", "08", "09", "10", "11"].map((d) => `2026-01-${d}`);
  assert.equal(hasPerfectWeek(week), true);
  assert.equal(hasPerfectWeek(week.slice(1).concat("2026-01-12")), false);
});
