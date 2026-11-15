import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatPrValue, formatDurationShort, type PrSourceRow } from "../lib/prs.ts";

const lift = (date: string, name: string, sets: [number, number][]): PrSourceRow => ({
  name,
  muscle_group: "chest",
  workout_date: date,
  sets: sets.map(([reps, kg]) => ({ reps, weight_kg: kg, distance_km: null, distance_m: null, time_seconds: null })),
});

test("first log is only a baseline, not a PR event", () => {
  const { records, events } = computePrs([lift("2026-01-01", "Bench Press", [[5, 60]])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 60);
  assert.equal(records[0].delta, null);
});

test("beating the best creates an event with the increment", () => {
  const { records, events } = computePrs([
    lift("2026-01-01", "Bench Press", [[5, 60]]),
    lift("2026-01-08", "bench  press ", [[3, 62.5], [8, 50]]),
    lift("2026-01-15", "Bench Press", [[5, 61]]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-01-08");
  assert.equal(events[0].delta, 2.5);
  assert.equal(events[0].reps, 3);
  assert.equal(events[0].key, "bench press|weight");
  assert.equal(records[0].value, 62.5);
  assert.equal(records[0].improvements, 1);
});

test("decimal weights such as 3.75 kg are handled", () => {
  const { events } = computePrs([
    lift("2026-02-01", "Lateral Raise", [[12, 2.25]]),
    lift("2026-02-08", "Lateral Raise", [[10, 3.75]]),
  ]);
  assert.equal(events[0].value, 3.75);
  assert.equal(events[0].delta, 1.5);
  assert.equal(formatPrValue("weight", 3.75), "3.75 kg");
});

test("HIIT and bodyweight-only sets don't count", () => {
  const hiit = { ...lift("2026-01-01", "Burpees", [[20, 10]]), muscle_group: "hiit" };
  const bw = lift("2026-01-01", "Push-ups", [[20, 0]]);
  assert.equal(computePrs([hiit, bw]).records.length, 0);
});

test("cardio tracks distance and duration", () => {
  const run = (date: string, km: number, secs: number): PrSourceRow => ({
    name: "Run",
    muscle_group: "cardio",
    workout_date: date,
    sets: [{ reps: null, weight_kg: null, distance_km: km, distance_m: null, time_seconds: secs }],
  });
  const { events } = computePrs([run("2026-03-01", 5, 1800), run("2026-03-05", 6, 2100)]);
  assert.deepEqual(events.map((e) => e.metric).sort(), ["distance", "duration"]);
  assert.equal(formatDurationShort(3725), "1:02:05");
});
