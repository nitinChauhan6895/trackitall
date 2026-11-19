import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatPrValue, formatDurationShort, type PrSourceRow } from "../lib/prs.ts";

const set = (o: Partial<PrSourceRow["sets"][number]>): PrSourceRow["sets"][number] => ({
  reps: null,
  weight_kg: null,
  distance_km: null,
  distance_m: null,
  time_seconds: null,
  ...o,
});

const lift = (date: string, name: string, ...sets: [number, number][]): PrSourceRow => ({
  name,
  muscle_group: "chest",
  workout_date: date,
  sets: sets.map(([reps, kg]) => set({ reps, weight_kg: kg })),
});

test("first log is only a baseline, not a PR event", () => {
  const { records, events } = computePrs([lift("2026-01-01", "Bench Press", [5, 60])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 60);
  assert.equal(records[0].delta, null);
});

test("beating the best creates an event with the increment", () => {
  const { records, events } = computePrs([
    lift("2026-01-01", "Bench Press", [5, 60]),
    lift("2026-01-08", "bench press ", [3, 62.5]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].previous, 60);
  assert.equal(events[0].value, 62.5);
  assert.equal(events[0].delta, 2.5);
  assert.equal(events[0].reps, 3);
  assert.equal(records[0].improvements, 1);
});

test("matching the best is not a PR; quarter-kg weights count", () => {
  const { events, records } = computePrs([
    lift("2026-01-01", "Curl", [10, 12.25]),
    lift("2026-01-02", "Curl", [12, 12.25]),
    lift("2026-01-03", "Curl", [8, 13.75]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].value, 13.75);
  assert.equal(records[0].value, 13.75);
});

test("HIIT is ignored and cardio tracks distance and duration", () => {
  const rows: PrSourceRow[] = [
    { name: "Burpees", muscle_group: "hiit", workout_date: "2026-01-01", sets: [set({ reps: 20, weight_kg: 10 })] },
    { name: "Run", muscle_group: "cardio", workout_date: "2026-01-01", sets: [set({ distance_km: 5, time_seconds: 1800 })] },
    { name: "Run", muscle_group: "cardio", workout_date: "2026-01-05", sets: [set({ distance_m: 6000, time_seconds: 1700 })] },
  ];
  const { records, events } = computePrs(rows);
  assert.ok(records.every((r) => r.name === "Run"));
  assert.deepEqual(events.map((e) => e.metric), ["distance"]);
  assert.equal(events[0].value, 6);
});

test("formatting", () => {
  assert.equal(formatPrValue("weight", 62.5), "62.5 kg");
  assert.equal(formatPrValue("distance", 5.2), "5.2 km");
  assert.equal(formatDurationShort(1930), "32:10");
  assert.equal(formatDurationShort(3725), "1:02:05");
});
