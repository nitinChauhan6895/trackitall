// Unit tests for automatic PRs (lib/prs.ts). Run with `npm test`
// (Node's built-in test runner; Node 22.18+ strips the TypeScript types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatDurationShort, formatPrValue, type PrSourceRow } from "../lib/prs.ts";

const set = (o: Partial<PrSourceRow["sets"][number]>) => ({
  reps: null,
  weight_kg: null,
  distance_km: null,
  distance_m: null,
  time_seconds: null,
  ...o,
});
const row = (name: string, date: string, sets: PrSourceRow["sets"], muscle_group = "chest"): PrSourceRow => ({
  name,
  muscle_group,
  workout_date: date,
  sets,
});

test("first log is a baseline, not a PR event", () => {
  const { records, events } = computePrs([row("Bench Press", "2026-01-01", [set({ reps: 5, weight_kg: 60 })])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 60);
  assert.equal(records[0].delta, null);
});

test("a heavier later workout is a PR event with the increment", () => {
  const { records, events } = computePrs([
    row("Bench Press", "2026-01-01", [set({ reps: 5, weight_kg: 60 })]),
    row("bench press ", "2026-01-08", [set({ reps: 3, weight_kg: 62.5 })]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-01-08");
  assert.equal(events[0].delta, 2.5);
  assert.equal(events[0].reps, 3);
  assert.equal(records[0].improvements, 1);
});

test("decimal weights such as 3.75 kg are tracked exactly", () => {
  const { events } = computePrs([
    row("Lateral Raise", "2026-01-01", [set({ reps: 12, weight_kg: 2.25 })]),
    row("Lateral Raise", "2026-01-05", [set({ reps: 10, weight_kg: 3.75 })]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].value, 3.75);
  assert.equal(events[0].delta, 1.5);
});

test("equal weight is not a new PR", () => {
  const { events } = computePrs([
    row("Squat", "2026-01-01", [set({ reps: 5, weight_kg: 100 })]),
    row("Squat", "2026-01-03", [set({ reps: 8, weight_kg: 100 })]),
  ]);
  assert.equal(events.length, 0);
});

test("cardio tracks distance (km or m) and duration; HIIT is ignored", () => {
  const { records, events } = computePrs([
    row("Run", "2026-01-01", [set({ distance_km: 5, time_seconds: 1800 })], "cardio"),
    row("Run", "2026-01-04", [set({ distance_m: 6000, time_seconds: 1700 })], "cardio"),
    row("Burpees", "2026-01-04", [set({ reps: 20, weight_kg: 10 })], "hiit"),
  ]);
  assert.equal(records.length, 2); // Run distance + Run duration
  assert.deepEqual(events.map((e) => e.metric), ["distance"]);
  assert.equal(events[0].value, 6);
});

test("formatting helpers", () => {
  assert.equal(formatPrValue("weight", 3.75), "3.75 kg");
  assert.equal(formatPrValue("distance", 5.2), "5.2 km");
  assert.equal(formatDurationShort(90), "1:30");
  assert.equal(formatDurationShort(3725), "1:02:05");
});
