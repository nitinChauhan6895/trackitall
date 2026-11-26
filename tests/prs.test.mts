import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatDurationShort, type PrSourceRow } from "../lib/prs.ts";

const set = (weight_kg: number | null, reps: number | null = 5) => ({
  reps,
  weight_kg,
  distance_km: null,
  distance_m: null,
  time_seconds: null,
});

const lift = (date: string, ...weights: number[]): PrSourceRow => ({
  name: "Bench Press",
  muscle_group: "chest",
  workout_date: date,
  sets: weights.map((w) => set(w)),
});

test("first log is only a baseline, not a PR event", () => {
  const { records, events } = computePrs([lift("2026-11-01", 60, 70)]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 70);
  assert.equal(records[0].delta, null);
});

test("a heavier later workout is a PR event with the increment", () => {
  const { records, events } = computePrs([lift("2026-11-01", 70), lift("2026-11-05", 72.5)]);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-11-05");
  assert.equal(events[0].previous, 70);
  assert.equal(events[0].delta, 2.5);
  assert.equal(records[0].value, 72.5);
  assert.equal(records[0].improvements, 1);
});

test("matching the best is not a PR; non-0.5 weights like 3.75 count", () => {
  const { events } = computePrs([lift("2026-11-01", 3.5), lift("2026-11-02", 3.5), lift("2026-11-03", 3.75)]);
  assert.equal(events.length, 1);
  assert.equal(events[0].value, 3.75);
});

test("names are matched case- and whitespace-insensitively", () => {
  const rows = [lift("2026-11-01", 50), { ...lift("2026-11-02", 55), name: "  bench   press " }];
  const { records, events } = computePrs(rows);
  assert.equal(records.length, 1);
  assert.equal(events.length, 1);
});

test("HIIT is ignored; cardio tracks distance and duration", () => {
  const cardio = (date: string, km: number, secs: number): PrSourceRow => ({
    name: "Run",
    muscle_group: "cardio",
    workout_date: date,
    sets: [{ reps: null, weight_kg: null, distance_km: km, distance_m: null, time_seconds: secs }],
  });
  const hiit: PrSourceRow = { ...lift("2026-11-01", 100), muscle_group: "hiit" };
  const { records } = computePrs([hiit, cardio("2026-11-01", 3, 1200), cardio("2026-11-03", 5, 1800)]);
  const metrics = records.map((r) => r.metric).sort();
  assert.deepEqual(metrics, ["distance", "duration"]);
  assert.equal(records.find((r) => r.metric === "distance")!.value, 5);
});

test("formatDurationShort", () => {
  assert.equal(typeof formatDurationShort(90), "string");
});
