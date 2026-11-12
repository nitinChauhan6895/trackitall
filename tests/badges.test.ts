import { describe, expect, it } from "vitest";
import {
  currentStreak,
  hasPerfectWeek,
  longestGapDays,
  longestStreak,
  maxWorkoutsInWindow,
} from "@/lib/badges";

describe("streaks", () => {
  const days = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-05", "2026-03-06"];

  it("longestStreak finds the longest consecutive run", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(days)).toBe(3);
    expect(longestStreak(["2026-02-28", "2026-03-01"])).toBe(2); // across month end
  });

  it("currentStreak counts back from today, or yesterday if today isn't logged", () => {
    expect(currentStreak(days, "2026-03-06")).toBe(2);
    expect(currentStreak(days, "2026-03-07")).toBe(2);
    expect(currentStreak(days, "2026-03-08")).toBe(0);
  });

  it("maxWorkoutsInWindow and longestGapDays", () => {
    expect(maxWorkoutsInWindow(days)).toBe(5);
    expect(maxWorkoutsInWindow(days, 2)).toBe(2);
    expect(longestGapDays(days)).toBe(2);
  });

  it("hasPerfectWeek needs all seven days of one Mon–Sun week", () => {
    const week = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"];
    expect(hasPerfectWeek(week)).toBe(true); // Mon 2 Mar – Sun 8 Mar
    expect(hasPerfectWeek(week.slice(1).concat("2026-03-09"))).toBe(false); // Tue–Mon spans two weeks
  });
});
