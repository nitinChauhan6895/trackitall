import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrs, formatDurationShort, type PrSourceRow } from "@/lib/prs";

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

test("first log is only a baseline, not a PR event", () => {
  const { records, events } = computePrs([row("Bench Press", "2026-01-01", [set({ reps: 5, weight_kg: 60 })])]);
  assert.equal(events.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].value, 60);
  assert.equal(records[0].delta, null);
});

test("beating the best creates an event with the increment", () => {
  const { records, events } = computePrs([
    row("Bench Press", "2026-01-01", [set({ reps: 5, weight_kg: 60 })]),
    row("bench  press ", "2026-01-08", [set({ reps: 3, weight_kg: 62.5 }), set({ reps: 8, weight_kg: 50 })]),
    row("Bench Press", "2026-01-15", [set({ reps: 5, weight_kg: 62.5 })]), // tie: no event
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-01-08");
  assert.equal(events[0].previous, 60);
  assert.equal(events[0].delta, 2.5);
  assert.equal(events[0].reps, 3);
  assert.equal(records[0].improvements, 1);
});

test("decimal weights such as 3.75 kg count", () => {
  const { events } = computePrs([
    row("Lateral Raise", "2026-02-01", [set({ reps: 12, weight_kg: 2.25 })], "shoulders"),
    row("Lateral Raise", "2026-02-05", [set({ reps: 10, weight_kg: 3.75 })], "shoulders"),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].value, 3.75);
});

test("cardio tracks distance (km or m) and duration separately; HIIT is ignored", () => {
  const { records, events } = computePrs([
    row("Run", "2026-03-01", [set({ distance_km: 5, time_seconds: 1500 })], "cardio"),
    row("Run", "2026-03-03", [set({ distance_m: 6000, time_seconds: 1400 })], "cardio"),
    row("Burpees", "2026-03-03", [set({ reps: 20, weight_kg: 10 })], "hiit"),
  ]);
  assert.deepEqual(
    records.map((r) => r.metric).sort(),
    ["distance", "duration"],
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].metric, "distance");
  assert.equal(events[0].value, 6);
});

test("formatDurationShort", () => {
  assert.equal(typeof formatDurationShort(3725), "string");
  assert.notEqual(formatDurationShort(3725), "");
});
