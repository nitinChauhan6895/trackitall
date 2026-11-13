import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatDurationShort, formatPrValue, type PrSourceRow } from "@/lib/prs";

const set = (o: Partial<PrSourceRow["sets"][number]>) => ({
  reps: null, weight_kg: null, distance_km: null, distance_m: null, time_seconds: null, ...o,
});
const lift = (date: string, name: string, kgs: number[], reps = 5): PrSourceRow => ({
  name, muscle_group: "back", workout_date: date, sets: kgs.map((k) => set({ weight_kg: k, reps })),
});

test("first log is only the baseline, not a PR event", () => {
  const { records, events } = computePrs([lift("2026-01-01", "Deadlift", [80, 90])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 90);
  assert.equal(records[0].delta, null);
  assert.equal(records[0].improvements, 0);
});

test("beating the best creates an event with the increment", () => {
  const { records, events } = computePrs([
    lift("2026-01-01", "Deadlift", [90]),
    lift("2026-01-08", "Deadlift", [85]), // not a PR
    lift("2026-01-15", "deadlift ", [95], 3), // same exercise, different spelling
  ]);
  assert.equal(events.length, 1);
  assert.deepEqual(
    { date: events[0].date, value: events[0].value, previous: events[0].previous, delta: events[0].delta, reps: events[0].reps },
    { date: "2026-01-15", value: 95, previous: 90, delta: 5, reps: 3 },
  );
  assert.equal(records[0].value, 95);
  assert.equal(records[0].improvements, 1);
});

test("equal weight is not a PR", () => {
  const { events } = computePrs([lift("2026-01-01", "Squat", [100]), lift("2026-01-02", "Squat", [100])]);
  assert.equal(events.length, 0);
});

test("HIIT and bodyweight-only sets are ignored", () => {
  const { records } = computePrs([
    { name: "Burpees", muscle_group: "hiit", workout_date: "2026-01-01", sets: [set({ reps: 20, weight_kg: 10 })] },
    { name: "Push-ups", muscle_group: "chest", workout_date: "2026-01-01", sets: [set({ reps: 20 })] },
  ]);
  assert.equal(records.length, 0);
});

test("cardio tracks distance (metres converted) and duration", () => {
  const run = (date: string, o: Partial<PrSourceRow["sets"][number]>): PrSourceRow => ({
    name: "Running", muscle_group: "cardio", workout_date: date, sets: [set(o)],
  });
  const { events } = computePrs([
    run("2026-02-01", { distance_km: 3, time_seconds: 1200 }),
    run("2026-02-05", { distance_m: 5000, time_seconds: 1100 }),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].metric, "distance");
  assert.equal(events[0].value, 5);
  assert.equal(events[0].delta, 2);
});

test("value formatting", () => {
  assert.equal(formatPrValue("weight", 42.5), "42.5 kg");
  assert.equal(formatPrValue("distance", 5.234), "5.23 km");
  assert.equal(formatDurationShort(75), "1:15");
  assert.equal(formatDurationShort(3725), "1:02:05");
});
