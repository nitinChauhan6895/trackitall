import { describe, expect, it } from "vitest";
import { nextMonth, parseMonthParam, prevMonth, toDateKey } from "@/lib/date";

describe("date helpers", () => {
  it("toDateKey pads month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("parseMonthParam accepts YYYY-MM and rejects bad months", () => {
    expect(parseMonthParam("2026-11")).toEqual({ year: 2026, month: 11 });
    const now = new Date();
    expect(parseMonthParam("2026-13")).toEqual({ year: now.getFullYear(), month: now.getMonth() + 1 });
  });

  it("prev/nextMonth wrap the year", () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });
});
