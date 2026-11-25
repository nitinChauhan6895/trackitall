import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatPrValue, formatDurationShort, type PrSourceRow } from "../lib/prs.ts";

const set = (o: Partial<PrSourceRow["sets"][number]>) => ({
  reps: null, weight_kg: null, distance_km: null, distance_m: null, time_seconds: null, ...o,
});
const lift = (date: string, name: string, ...sets: [number, number][]): PrSourceRow => ({
  name, muscle_group: "chest", workout_date: date,
  sets: sets.map(([reps, kg]) => set({ reps, weight_kg: kg })),
});

test("first log is a baseline, not a PR event", () => {
  const { records, events } = computePrs([lift("2026-01-01", "Bench Press", [8, 40])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 40);
  assert.equal(records[0].delta, null);
});

test("beating the best records an event with the increment", () => {
  const { records, events } = computePrs([
    lift("2026-01-01", "Bench Press", [8, 40]),
    lift("2026-01-08", "Bench Press", [6, 42.5]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].delta, 2.5);
  assert.equal(events[0].reps, 6);
  assert.equal(records[0].improvements, 1);
});

test("decimal weights such as 2.25 and 3.75 kg count", () => {
  const { events } = computePrs([
    lift("2026-01-01", "Lateral Raise", [12, 2.25]),
    lift("2026-01-02", "Lateral Raise", [10, 3.75]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].delta, 1.5);
});

test("equal weight is not a PR; names are matched case/space-insensitively", () => {
  const { events, records } = computePrs([
    lift("2026-01-01", "Bench  press", [8, 40]),
    lift("2026-01-02", "bench press", [10, 40]),
  ]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "bench press"); // latest spelling
});

test("cardio tracks distance (metres converted) and duration; HIIT is ignored", () => {
  const rows: PrSourceRow[] = [
    { name: "Run", muscle_group: "cardio", workout_date: "2026-01-01", sets: [set({ distance_m: 3000, time_seconds: 900 })] },
    { name: "Run", muscle_group: "cardio", workout_date: "2026-01-03", sets: [set({ distance_km: 5, time_seconds: 1500 })] },
    { name: "Burpees", muscle_group: "hiit", workout_date: "2026-01-03", sets: [set({ reps: 20, weight_kg: 10 })] },
  ];
  const { events, records } = computePrs(rows);
  assert.deepEqual(events.map((e) => e.metric).sort(), ["distance", "duration"]);
  assert.equal(records.length, 2);
  const dist = events.find((e) => e.metric === "distance")!;
  assert.equal(dist.previous, 3);
  assert.equal(dist.value, 5);
});

test("formatting helpers", () => {
  assert.equal(formatPrValue("weight", 42.5), "42.5 kg");
  assert.equal(formatPrValue("distance", 5.123), "5.12 km");
  assert.equal(formatDurationShort(90), "1:30");
  assert.equal(formatDurationShort(3725), "1:02:05");
});
