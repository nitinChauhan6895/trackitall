import { test } from "node:test";
import assert from "node:assert/strict";
import {
  longestStreak, currentStreak, maxWorkoutsInWindow, longestGapDays, hasPerfectWeek, evaluateBadges, type BadgeStats,
} from "../lib/badges.ts";

test("longestStreak counts consecutive days and ignores duplicates", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-01-01", "2026-01-02", "2026-01-02", "2026-01-03", "2026-01-05"]), 3);
  assert.equal(longestStreak(["2026-02-28", "2026-03-01"]), 2); // month boundary
});

test("currentStreak allows today to be not-yet-trained", () => {
  const days = ["2026-01-08", "2026-01-09"];
  assert.equal(currentStreak(days, "2026-01-10"), 2);
  assert.equal(currentStreak(days, "2026-01-09"), 2);
  assert.equal(currentStreak(days, "2026-01-11"), 0);
});

test("window, gap and perfect week", () => {
  const week = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-11"]; // Mon..Sun
  assert.equal(maxWorkoutsInWindow(week), 7);
  assert.equal(hasPerfectWeek(week), true);
  assert.equal(hasPerfectWeek(week.slice(1).concat("2026-01-12")), false); // Tue..Mon spans two weeks
  assert.equal(longestGapDays(["2026-01-01", "2026-01-16"]), 15);
});

test("evaluateBadges marks earned when the target is met", () => {
  const s: BadgeStats = {
    totalWorkouts: 1, currentStreak: 1, longestStreak: 3, maxWorkoutsInWeek: 1, hasPerfectWeek: false,
    longestGapDays: 0, maxRunKm: 0, totalCardioKm: 0, cardioSessions: 0, strengthSessions: 0,
    maxDeadliftKg: 0, maxGroupsInDay: 1, pbBeaten: false, prCount: 0,
  };
  const byId = Object.fromEntries(evaluateBadges(s, { firstRep: "2026-01-01" }).map((b) => [b.id, b]));
  assert.equal(byId.firstRep.earned, true);
  assert.equal(byId.firstRep.earnedDate, "2026-01-01");
  assert.equal(byId.streak3.earned, true);
  assert.equal(byId.streak5.earned, false);
});
