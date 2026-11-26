import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDayMonth, formatShortDate } from "../lib/dateFormat.ts";

test("formatShortDate is locale-independent", () => {
  assert.equal(formatShortDate("2026-08-13"), "13 Aug 2026");
  assert.equal(formatShortDate("garbage"), "garbage");
});

test("formatDayMonth", () => {
  assert.equal(formatDayMonth("2026-01-05"), "5 Jan");
});
