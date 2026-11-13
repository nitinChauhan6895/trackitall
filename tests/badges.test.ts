import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentStreak, evaluateBadges, hasPerfectWeek, longestGapDays, longestStreak, maxWorkoutsInWindow, sortedByEarned,
  type BadgeStats,
} from "@/lib/badges";

test("longestStreak", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-01-01"]), 1);
  assert.equal(longestStreak(["2026-01-03", "2026-01-01", "2026-01-02", "2026-01-05"]), 3);
  // across a month boundary
  assert.equal(longestStreak(["2026-01-31", "2026-02-01"]), 2);
});

test("currentStreak counts back from today, or yesterday if today is untrained", () => {
  const days = ["2026-03-08", "2026-03-09", "2026-03-10"];
  assert.equal(currentStreak(days, "2026-03-10"), 3);
  assert.equal(currentStreak(days, "2026-03-11"), 3);
  assert.equal(currentStreak(days, "2026-03-12"), 0);
});

test("maxWorkoutsInWindow and longestGapDays", () => {
  const days = ["2026-01-01", "2026-01-02", "2026-01-07", "2026-01-08", "2026-01-20"];
  assert.equal(maxWorkoutsInWindow(days), 3); // 2nd..8th
  assert.equal(longestGapDays(days), 12);
});

test("hasPerfectWeek needs a full Mon–Sun week", () => {
  const monToSun = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  assert.equal(hasPerfectWeek(monToSun), true);
  // 7 consecutive days Wed..Tue span two calendar weeks
  const wedToTue = ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"];
  assert.equal(hasPerfectWeek(wedToTue), false);
});

test("evaluateBadges marks earned badges and keeps earned dates", () => {
  const stats = {
    totalWorkouts: 1, currentStreak: 1, longestStreak: 3, maxWorkoutsInWeek: 1, hasPerfectWeek: false,
    longestGapDays: 0, maxRunKm: 0, totalCardioKm: 0, maxDeadliftKg: 0, strengthSessions: 0,
    maxGroupsInDay: 1, cardioSessions: 0, pbBeaten: false,
  } as unknown as BadgeStats;
  const badges = evaluateBadges(stats, { streak3: "2026-01-03" });
  const byId = new Map(badges.map((b) => [b.id, b]));
  assert.equal(byId.get("streak3")?.earned, true);
  assert.equal(byId.get("streak3")?.earnedDate, "2026-01-03");
  assert.equal(byId.get("firstRep")?.earned, true);
  assert.equal(byId.get("streak5")?.earned, false);
  const sorted = sortedByEarned(badges);
  assert.ok(sorted.findIndex((b) => !b.earned) > sorted.findLastIndex((b) => b.earned));
});
