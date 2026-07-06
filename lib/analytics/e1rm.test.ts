import { describe, expect, it } from "vitest";
import { brzycki, epley, estimateE1RM } from "./e1rm";

describe("epley", () => {
  it("returns the weight itself at 1 rep", () => {
    expect(epley(100, 1)).toBe(100);
  });

  it("225 × 5 → 262.5", () => {
    expect(epley(225, 5)).toBeCloseTo(262.5, 6);
  });

  it("100 × 10 → 133.33…", () => {
    expect(epley(100, 10)).toBeCloseTo(133.3333, 3);
  });
});

describe("brzycki", () => {
  it("returns the weight itself at 1 rep", () => {
    expect(brzycki(100, 1)).toBe(100);
  });

  it("225 × 5 → 253.125", () => {
    expect(brzycki(225, 5)).toBeCloseTo(253.125, 6);
  });

  it("100 × 10 → 133.33…", () => {
    expect(brzycki(100, 10)).toBeCloseTo(133.3333, 3);
  });
});

describe("estimateE1RM", () => {
  it("normal set: both formulas, not low-confidence", () => {
    const est = estimateE1RM(140, 3);
    expect(est).not.toBeNull();
    expect(est!.epley).toBeCloseTo(154, 6);
    expect(est!.brzycki).toBeCloseTo((140 * 36) / 34, 6);
    expect(est!.lowConfidence).toBe(false);
    expect(est!.effectiveReps).toBe(3);
  });

  it("caps reps at 12 and flags low confidence above the cap", () => {
    const at12 = estimateE1RM(100, 12)!;
    const at20 = estimateE1RM(100, 20)!;
    expect(at20.epley).toBe(at12.epley);
    expect(at20.brzycki).toBe(at12.brzycki);
    expect(at12.lowConfidence).toBe(false);
    expect(at20.lowConfidence).toBe(true);
    expect(at20.effectiveReps).toBe(12);
  });

  it("rejects reps < 1", () => {
    expect(estimateE1RM(100, 0)).toBeNull();
    expect(estimateE1RM(100, -3)).toBeNull();
  });

  it("rejects non-positive load (fully assisted bodyweight work)", () => {
    expect(estimateE1RM(0, 5)).toBeNull();
    expect(estimateE1RM(-20, 5)).toBeNull();
  });

  it("rejects non-finite input", () => {
    expect(estimateE1RM(Number.NaN, 5)).toBeNull();
    expect(estimateE1RM(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("fractional reps floor before capping (defensive)", () => {
    expect(estimateE1RM(100, 5.9)!.effectiveReps).toBe(5);
  });
});
