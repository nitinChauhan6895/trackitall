import { describe, expect, it } from "vitest";
import { buildCalendarGrid, monthParam, nextMonth, parseMonthParam, prevMonth, toDateKey } from "@/lib/date";
import { formatDayMonth, formatMonthYear, formatShortDate } from "@/lib/dateFormat";
import { addDaysKey, mondayIndex, weekDays, weekStart } from "@/lib/habits";

describe("lib/date", () => {
  it("toDateKey pads month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("parseMonthParam accepts YYYY-MM and rejects bad months", () => {
    expect(parseMonthParam("2026-02")).toEqual({ year: 2026, month: 2 });
    const now = new Date();
    expect(parseMonthParam("2026-13")).toEqual({ year: now.getFullYear(), month: now.getMonth() + 1 });
  });

  it("prev/next month wrap the year", () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
    expect(monthParam(2026, 3)).toBe("2026-03");
  });

  it("buildCalendarGrid is 42 days starting on a Monday", () => {
    const grid = buildCalendarGrid(2026, 3);
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(toDateKey(grid[0])).toBe("2026-02-23");
  });
});

describe("lib/dateFormat", () => {
  it("formats keys without locale dependence", () => {
    expect(formatShortDate("2026-08-13")).toBe("13 Aug 2026");
    expect(formatDayMonth("2026-08-13")).toBe("13 Aug");
    expect(formatMonthYear(2026, 8)).toBe("August 2026");
  });
});

describe("habit day-key helpers", () => {
  it("addDaysKey crosses month and year boundaries", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("weeks start on Monday", () => {
    expect(mondayIndex("2026-03-02")).toBe(0); // Monday
    expect(mondayIndex("2026-03-08")).toBe(6); // Sunday
    expect(weekStart("2026-03-08")).toBe("2026-03-02");
    expect(weekDays("2026-03-04")).toEqual([
      "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08",
    ]);
  });
});
