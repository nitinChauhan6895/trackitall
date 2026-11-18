import { describe, expect, it } from "vitest";
import { computePrs, formatPrValue, type PrSourceRow } from "@/lib/prs";

const set = (weight_kg: number | null, reps: number | null = 5) => ({
  reps,
  weight_kg,
  distance_km: null,
  distance_m: null,
  time_seconds: null,
});

function lift(name: string, date: string, ...weights: number[]): PrSourceRow {
  return { name, muscle_group: "chest", workout_date: date, sets: weights.map((w) => set(w)) };
}

describe("computePrs", () => {
  it("treats the first log as a baseline, not a PR event", () => {
    const { records, events } = computePrs([lift("Bench Press", "2026-01-01", 40, 50)]);
    expect(events).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ metric: "weight", value: 50, delta: null, improvements: 0 });
  });

  it("records an event when a later workout beats the best", () => {
    const { records, events } = computePrs([
      lift("Bench Press", "2026-01-01", 50),
      lift("bench  press ", "2026-01-08", 52.5),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: "2026-01-08", value: 52.5, previous: 50, delta: 2.5 });
    expect(records[0]).toMatchObject({ value: 52.5, improvements: 1 });
  });

  it("handles quarter-kg increments (e.g. 3.75 kg)", () => {
    const { events } = computePrs([lift("Curl", "2026-01-01", 3.5), lift("Curl", "2026-01-02", 3.75)]);
    expect(events[0].delta).toBeCloseTo(0.25);
  });

  it("does not count matching (not beating) the best", () => {
    const { events } = computePrs([lift("Squat", "2026-01-01", 100), lift("Squat", "2026-01-05", 100)]);
    expect(events).toHaveLength(0);
  });

  it("ignores HIIT and bodyweight-only sets", () => {
    const { records } = computePrs([
      { name: "Burpees", muscle_group: "hiit", workout_date: "2026-01-01", sets: [set(10)] },
      lift("Push-up", "2026-01-01", 0),
    ]);
    expect(records).toHaveLength(0);
  });

  it("tracks cardio distance (metres converted to km) and duration", () => {
    const run = (date: string, km: number | null, m: number | null, secs: number): PrSourceRow => ({
      name: "Run",
      muscle_group: "cardio",
      workout_date: date,
      sets: [{ reps: null, weight_kg: null, distance_km: km, distance_m: m, time_seconds: secs }],
    });
    const { events } = computePrs([run("2026-01-01", 5, null, 1800), run("2026-01-03", null, 6000, 1700)]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ metric: "distance", value: 6, previous: 5 });
  });

  it("formats values", () => {
    expect(formatPrValue("weight", 3.75)).toBe("3.75 kg");
    expect(formatPrValue("duration", 3725)).toBe("1:02:05");
  });
});
