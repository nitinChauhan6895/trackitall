import { describe, expect, it } from "vitest";
import { computePrs, formatPrValue, recentPrNames, type PrSourceRow } from "@/lib/prs";

const set = (o: Partial<PrSourceRow["sets"][number]>) => ({
  reps: null,
  weight_kg: null,
  distance_km: null,
  distance_m: null,
  time_seconds: null,
  ...o,
});

const lift = (name: string, date: string, kg: number, reps = 5): PrSourceRow => ({
  name,
  muscle_group: "chest",
  workout_date: date,
  sets: [set({ weight_kg: kg, reps })],
});

describe("computePrs", () => {
  it("treats the first log as a baseline, not a PR event", () => {
    const { records, events } = computePrs([lift("Bench Press", "2026-01-01", 60)]);
    expect(events).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ value: 60, delta: null, improvements: 0 });
  });

  it("records an event when a later workout beats the best", () => {
    const { records, events } = computePrs([
      lift("Bench Press", "2026-01-01", 60),
      lift("Bench Press", "2026-01-08", 57.5),
      lift("bench  press", "2026-01-15", 62.5, 3),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: "2026-01-15", value: 62.5, previous: 60, delta: 2.5, reps: 3 });
    expect(records[0]).toMatchObject({ value: 62.5, improvements: 1, date: "2026-01-15" });
  });

  it("ignores HIIT and bodyweight-only sets", () => {
    const { records } = computePrs([
      { name: "Burpees", muscle_group: "hiit", workout_date: "2026-01-01", sets: [set({ weight_kg: 10 })] },
      { name: "Push-ups", muscle_group: "chest", workout_date: "2026-01-01", sets: [set({ reps: 20 })] },
    ]);
    expect(records).toHaveLength(0);
  });

  it("tracks cardio distance (m or km) and duration separately", () => {
    const { records, events } = computePrs([
      { name: "Run", muscle_group: "cardio", workout_date: "2026-01-01", sets: [set({ distance_m: 5000, time_seconds: 1500 })] },
      { name: "Run", muscle_group: "cardio", workout_date: "2026-01-03", sets: [set({ distance_km: 5.5, time_seconds: 1400 })] },
    ]);
    const metrics = records.map((r) => r.metric).sort();
    expect(metrics).toEqual(["distance", "duration"]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ metric: "distance", value: 5.5 });
  });
});

describe("recentPrNames", () => {
  const { events } = computePrs([
    lift("Squat", "2026-01-01", 100),
    lift("Squat", "2026-02-20", 105),
    lift("Deadlift", "2025-10-01", 120),
    lift("Deadlift", "2025-11-01", 130),
  ]);

  it("returns lower-cased names of bests beaten within the window", () => {
    expect([...recentPrNames(events, "2026-03-01", 30)]).toEqual(["squat"]);
  });

  it("excludes events outside the window and in the future", () => {
    expect(recentPrNames(events, "2026-04-01", 30).size).toBe(0);
    expect(recentPrNames(events, "2026-02-19", 30).has("squat")).toBe(false);
  });
});

describe("formatPrValue", () => {
  it("formats each metric", () => {
    expect(formatPrValue("weight", 62.5)).toBe("62.5 kg");
    expect(formatPrValue("distance", 5.0)).toBe("5 km");
    expect(formatPrValue("duration", 3725)).toBe("1:02:05");
    expect(formatPrValue("duration", 90)).toBe("1:30");
  });
});
