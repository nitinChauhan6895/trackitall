import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysKey, mondayIndex, weekDays, weekStart } from "../lib/habits.ts";

test("addDaysKey crosses month, year and leap-day boundaries", () => {
  assert.equal(addDaysKey("2026-01-31", 1), "2026-02-01");
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysKey("2028-03-01", -1), "2028-02-29");
});

test("weeks start on Monday", () => {
  assert.equal(mondayIndex("2026-11-16"), 0); // Monday
  assert.equal(mondayIndex("2026-11-15"), 6); // Sunday
  assert.equal(weekStart("2026-11-15"), "2026-11-09");
  const w = weekDays("2026-11-11");
  assert.equal(w.length, 7);
  assert.equal(w[0], "2026-11-09");
  assert.equal(w[6], "2026-11-15");
});
