import { describe, expect, it } from "vitest";
import {
  currentStreak,
  hasPerfectWeek,
  longestGapDays,
  longestStreak,
  maxWorkoutsInWindow,
} from "@/lib/badges";

describe("streak helpers", () => {
  it("longestStreak counts consecutive calendar days, across month ends", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-03"])).toBe(3);
  });

  it("currentStreak allows today to be not yet trained", () => {
    const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
    expect(currentStreak(days, "2026-03-03")).toBe(3);
    expect(currentStreak(days, "2026-03-04")).toBe(3);
    expect(currentStreak(days, "2026-03-05")).toBe(0);
  });

  it("maxWorkoutsInWindow uses a rolling 7-day window", () => {
    expect(maxWorkoutsInWindow(["2026-01-01", "2026-01-07", "2026-01-08"])).toBe(2);
  });

  it("longestGapDays and hasPerfectWeek", () => {
    expect(longestGapDays(["2026-01-01", "2026-01-11"])).toBe(10);
    // 2026-01-05 is a Monday.
    const week = Array.from({ length: 7 }, (_, i) => `2026-01-${String(5 + i).padStart(2, "0")}`);
    expect(hasPerfectWeek(week)).toBe(true);
    expect(hasPerfectWeek(week.slice(1))).toBe(false);
  });
});
