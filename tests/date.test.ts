import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendarGrid, monthParam, nextMonth, parseMonthParam, prevMonth, toDateKey } from "@/lib/date";
import { formatDayMonth, formatMonthYear, formatShortDate, formatWeekdayDayMonth } from "@/lib/dateFormat";

test("toDateKey pads month and day", () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("month navigation wraps years", () => {
  assert.deepEqual(prevMonth(2026, 1), { year: 2025, month: 12 });
  assert.deepEqual(nextMonth(2026, 12), { year: 2027, month: 1 });
  assert.equal(monthParam(2026, 3), "2026-03");
  assert.deepEqual(parseMonthParam("2026-11"), { year: 2026, month: 11 });
  const fallback = parseMonthParam("2026-13");
  assert.ok(fallback.month >= 1 && fallback.month <= 12);
});

test("calendar grid is 6x7 and starts on a Monday", () => {
  const grid = buildCalendarGrid(2026, 11);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 1);
  assert.ok(grid.some((d) => toDateKey(d) === "2026-11-01"));
});

test("locale-independent formatting", () => {
  assert.equal(formatShortDate("2026-08-13"), "13 Aug 2026");
  assert.equal(formatDayMonth("2026-08-13"), "13 Aug");
  assert.equal(formatMonthYear(2026, 8), "August 2026");
  assert.equal(formatWeekdayDayMonth("2026-08-13"), "Thu, 13 Aug");
  assert.equal(formatShortDate("bad"), "bad");
});
