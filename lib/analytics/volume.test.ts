import { describe, expect, it } from "vitest";
import { setVolumeKg, totalLoadKg, totalVolumeKg } from "./volume";

const barbell = { isBodyweight: false };
const bodyweight = { isBodyweight: true };

describe("totalLoadKg", () => {
  it("barbell lift: load is the entered weight, bodyweight ignored", () => {
    expect(totalLoadKg({ weightKg: 100 }, barbell, 80)).toBe(100);
    expect(totalLoadKg({ weightKg: 100 }, barbell, null)).toBe(100);
  });

  it("bodyweight lift: bodyweight + added load", () => {
    expect(totalLoadKg({ weightKg: 20 }, bodyweight, 80)).toBe(100);
  });

  it("assisted bodyweight (negative added) subtracts", () => {
    expect(totalLoadKg({ weightKg: -25 }, bodyweight, 80)).toBe(55);
  });

  it("assistance can never drive load below zero", () => {
    expect(totalLoadKg({ weightKg: -120 }, bodyweight, 80)).toBe(0);
  });

  it("missing bodyweight: only positive added load counts (never fabricates)", () => {
    expect(totalLoadKg({ weightKg: 20 }, bodyweight, null)).toBe(20);
    expect(totalLoadKg({ weightKg: -10 }, bodyweight, null)).toBe(0);
  });
});

describe("setVolumeKg", () => {
  it("weight × reps for barbell", () => {
    expect(setVolumeKg({ weightKg: 102.5, reps: 5 }, barbell, null)).toBeCloseTo(
      512.5,
      9,
    );
  });

  it("bodyweight pull-ups: (bw + added) × reps", () => {
    expect(setVolumeKg({ weightKg: 10, reps: 8 }, bodyweight, 80)).toBe(720);
  });
});

describe("totalVolumeKg", () => {
  it("sums across mixed lifts", () => {
    const lifts = new Map([
      ["bench", barbell],
      ["pullup", bodyweight],
    ]);
    const sets = [
      { liftId: "bench", weightKg: 100, reps: 5 },
      { liftId: "bench", weightKg: 100, reps: 5 },
      { liftId: "pullup", weightKg: 0, reps: 10 },
    ];
    // 500 + 500 + 80×10
    expect(totalVolumeKg(sets, lifts, 80)).toBe(1800);
  });

  it("skips sets whose lift is unknown rather than throwing", () => {
    const sets = [{ liftId: "ghost", weightKg: 100, reps: 5 }];
    expect(totalVolumeKg(sets, new Map(), 80)).toBe(0);
  });

  it("empty input → 0", () => {
    expect(totalVolumeKg([], new Map(), null)).toBe(0);
  });
});
