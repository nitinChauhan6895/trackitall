import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatDurationShort, formatPrValue, type PrSourceRow } from "../lib/prs.ts";

const set = (weight_kg: number | null, reps: number | null = 5) => ({
  reps,
  weight_kg,
  distance_km: null,
  distance_m: null,
  time_seconds: null,
});

const lift = (name: string, date: string, weights: number[]): PrSourceRow => ({
  name,
  muscle_group: "chest",
  workout_date: date,
  sets: weights.map((w) => set(w)),
});

test("first log is only a baseline, not a PR event", () => {
  const { records, events } = computePrs([lift("Bench Press", "2026-01-01", [40, 50])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 50);
  assert.equal(records[0].delta, null);
});

test("beating the best creates an event with the increment", () => {
  const { records, events } = computePrs([
    lift("Bench Press", "2026-01-01", [50]),
    lift("Bench Press", "2026-01-08", [47.5]),
    lift("Bench Press", "2026-01-15", [53.75]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-01-15");
  assert.equal(events[0].previous, 50);
  assert.ok(Math.abs(events[0].delta - 3.75) < 1e-9);
  assert.equal(records[0].value, 53.75);
  assert.equal(records[0].improvements, 1);
});

test("names are matched case- and whitespace-insensitively", () => {
  const { records, events } = computePrs([
    lift("bench  press", "2026-01-01", [50]),
    lift("Bench Press ", "2026-01-08", [55]),
  ]);
  assert.equal(records.length, 1);
  assert.equal(events.length, 1);
  assert.equal(records[0].name, "Bench Press");
});

test("HIIT and bodyweight-only sets don't count", () => {
  const { records } = computePrs([
    { ...lift("Burpees", "2026-01-01", [10]), muscle_group: "hiit" },
    lift("Push-up", "2026-01-01", [0]),
  ]);
  assert.equal(records.length, 0);
});

test("cardio tracks distance (km or m) and duration", () => {
  const run = (date: string, km: number | null, m: number | null, secs: number): PrSourceRow => ({
    name: "Run",
    muscle_group: "cardio",
    workout_date: date,
    sets: [{ reps: null, weight_kg: null, distance_km: km, distance_m: m, time_seconds: secs }],
  });
  const { records, events } = computePrs([run("2026-01-01", 5, null, 1800), run("2026-01-02", null, 6000, 1700)]);
  const dist = records.find((r) => r.metric === "distance")!;
  const dur = records.find((r) => r.metric === "duration")!;
  assert.equal(dist.value, 6);
  assert.equal(dur.value, 1800);
  assert.equal(events.length, 1);
});

test("formatting", () => {
  assert.equal(formatPrValue("weight", 3.75), "3.75 kg");
  assert.equal(formatPrValue("distance", 5.2), "5.2 km");
  assert.equal(formatDurationShort(1930), "32:10");
  assert.equal(formatDurationShort(3725), "1:02:05");
});
