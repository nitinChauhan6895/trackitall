import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendarGrid, monthId, monthParam, nextMonth, parseMonthParam, prevMonth, toDateKey } from "@/lib/date";

test("toDateKey pads month and day", () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("prev/next month wrap the year", () => {
  assert.deepEqual(prevMonth(2026, 1), { year: 2025, month: 12 });
  assert.deepEqual(nextMonth(2026, 12), { year: 2027, month: 1 });
  assert.deepEqual(nextMonth(2026, 5), { year: 2026, month: 6 });
});

test("parseMonthParam accepts YYYY-MM and rejects bad months", () => {
  assert.deepEqual(parseMonthParam("2026-02"), { year: 2026, month: 2 });
  const now = new Date();
  assert.deepEqual(parseMonthParam("2026-13"), { year: now.getFullYear(), month: now.getMonth() + 1 });
  assert.deepEqual(parseMonthParam(undefined), { year: now.getFullYear(), month: now.getMonth() + 1 });
});

test("monthParam / monthId", () => {
  assert.equal(monthParam(2026, 3), "2026-03");
  assert.equal(monthId(2026, 11), "2026-11");
});

test("calendar grid is 6x7 and starts on a Monday", () => {
  const grid = buildCalendarGrid(2026, 11); // 1 Nov 2026 is a Sunday
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 1);
  assert.equal(toDateKey(grid[0]), "2026-10-26");
  assert.equal(toDateKey(grid[6]), "2026-11-01");
});
