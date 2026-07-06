import { describe, expect, it } from "vitest";
import { describeLoadout, KG_BAR, LB_BAR, solvePlates } from "./solve";

function perSideValues(total: number, unit: "lb" | "kg"): number[] {
  const s = solvePlates(total, unit);
  if (s.kind !== "loaded") throw new Error(`expected loaded, got ${s.kind}`);
  return s.perSide.map((p) => p.value);
}

describe("solvePlates — lb", () => {
  it("135 → one 45 per side", () => {
    expect(perSideValues(135, "lb")).toEqual([45]);
  });

  it("225 → two 45s per side", () => {
    expect(perSideValues(225, "lb")).toEqual([45, 45]);
  });

  it("315 → three 45s per side", () => {
    expect(perSideValues(315, "lb")).toEqual([45, 45, 45]);
  });

  it("405 → four 45s per side", () => {
    expect(perSideValues(405, "lb")).toEqual([45, 45, 45, 45]);
  });

  it("empty bar: 45 → no plates, exact", () => {
    const s = solvePlates(45, "lb");
    expect(s.kind).toBe("loaded");
    if (s.kind === "loaded") {
      expect(s.perSide).toEqual([]);
      expect(s.achievedTotal).toBe(45);
      expect(s.isApproximate).toBe(false);
      expect(describeLoadout(s)).toBe("Empty bar");
    }
  });

  it("185 → 45 + 25 per side", () => {
    expect(perSideValues(185, "lb")).toEqual([45, 25]);
  });

  it("full denomination spread: 210 → 45 + 35 + 2.5", () => {
    expect(perSideValues(210, "lb")).toEqual([45, 35, 2.5]);
  });

  it("152.5 lb is not loadable (needs a 1.25 plate) → nearest 150", () => {
    const s = solvePlates(152.5, "lb");
    expect(s.kind).toBe("loaded");
    if (s.kind === "loaded") {
      expect(s.achievedTotal).toBe(150);
      expect(s.isApproximate).toBe(true);
    }
  });

  it("non-loadable 137 → nearest 135, flagged approximate", () => {
    const s = solvePlates(137, "lb");
    expect(s.kind).toBe("loaded");
    if (s.kind === "loaded") {
      expect(s.achievedTotal).toBe(135);
      expect(s.isApproximate).toBe(true);
      expect(s.perSide.map((p) => p.value)).toEqual([45]);
    }
  });

  it("sub-bar weight → below-bar warning", () => {
    const s = solvePlates(30, "lb");
    expect(s.kind).toBe("below-bar");
    if (s.kind === "below-bar") {
      expect(s.barWeight).toBe(45);
      expect(describeLoadout(s)).toBe("Below 45 lb bar");
    }
  });

  it("plates ordered largest-inboard → smallest-outboard", () => {
    const values = perSideValues(302.5, "lb"); // 128.75/side → 45,45,25,10,2.5... check
    const sorted = [...values].sort((a, b) => b - a);
    expect(values).toEqual(sorted);
  });
});

describe("solvePlates — kg", () => {
  it("60 → one 20 per side", () => {
    expect(perSideValues(60, "kg")).toEqual([20]);
  });

  it("100 → 25 + 15 per side", () => {
    expect(perSideValues(100, "kg")).toEqual([25, 15]);
  });

  it("102.5 → 25 + 15 + 1.25 per side (greedy, exact: 41.25/side)", () => {
    // NOTE: the product spec illustrated 102.5 kg as 25+10+5+1.25 — that sums
    // correctly but is not what its own greedy algorithm (nor a real lifter
    // minimizing plates) produces. Greedy is normative.
    expect(perSideValues(102.5, "kg")).toEqual([25, 15, 1.25]);
    const s = solvePlates(102.5, "kg");
    if (s.kind === "loaded") expect(s.isApproximate).toBe(false);
  });

  it("140 → 25 + 25 + 10 per side", () => {
    expect(perSideValues(140, "kg")).toEqual([25, 25, 10]);
  });

  it("empty kg bar: 20 → no plates", () => {
    const s = solvePlates(20, "kg");
    expect(s.kind).toBe("loaded");
    if (s.kind === "loaded") expect(s.perSide).toEqual([]);
  });

  it("sub-bar: 15 kg → below-bar", () => {
    expect(solvePlates(15, "kg").kind).toBe("below-bar");
  });

  it("competition colors: 25 red, 20 blue, 15 yellow, 10 green", () => {
    const byValue = new Map(KG_BAR.plates.map((p) => [p.value, p.color]));
    expect(byValue.get(25)).toBe("#dc2626");
    expect(byValue.get(20)).toBe("#2563eb");
    expect(byValue.get(15)).toBe("#eab308");
    expect(byValue.get(10)).toBe("#16a34a");
  });
});

describe("solvePlates — greedy exactness (exhaustive)", () => {
  it("lb: every 5-step from 45 to 1000 builds exactly (min pair = 2×2.5)", () => {
    for (let total = 45; total <= 1000; total += 5) {
      const s = solvePlates(total, "lb");
      expect(s.kind).toBe("loaded");
      if (s.kind === "loaded") {
        expect(s.isApproximate, `lb total ${total}`).toBe(false);
        expect(s.achievedTotal).toBeCloseTo(total, 6);
      }
    }
  });

  it("lb: every x.5/x7.5 total between steps is flagged approximate", () => {
    for (let total = 47.5; total <= 500; total += 5) {
      const s = solvePlates(total, "lb");
      expect(s.kind).toBe("loaded");
      if (s.kind === "loaded") {
        expect(s.isApproximate, `lb total ${total}`).toBe(true);
        // Nearest loadable is always 2.5 below the request here.
        expect(s.achievedTotal).toBeCloseTo(total - 2.5, 6);
      }
    }
  });

  it("kg: every 2.5-step from 20 to 500 builds exactly", () => {
    for (let total = 20; total <= 500; total += 2.5) {
      const s = solvePlates(total, "kg");
      expect(s.kind).toBe("loaded");
      if (s.kind === "loaded") {
        expect(s.isApproximate, `kg total ${total}`).toBe(false);
      }
    }
  });

  it("odd 5s in lb (145, 155, …) build exactly via the 2.5 pair", () => {
    for (const total of [145, 155, 165, 195, 265, 335]) {
      const s = solvePlates(total, "lb");
      if (s.kind === "loaded") expect(s.isApproximate, `lb ${total}`).toBe(false);
      else throw new Error("expected loaded");
    }
  });

  it("float-noise input (unit-converted 225.00000000000003) still exact", () => {
    const s = solvePlates(225.00000000000003, "lb");
    expect(s.kind).toBe("loaded");
    if (s.kind === "loaded") {
      expect(s.achievedTotal).toBe(225);
      expect(s.isApproximate).toBe(false);
    }
  });
});

describe("describeLoadout", () => {
  it("groups duplicate plates: 225 lb → '2×45 per side'", () => {
    expect(describeLoadout(solvePlates(225, "lb"))).toBe("2×45 per side");
  });

  it("mixed: 102.5 kg → '25 + 15 + 1.25 per side'", () => {
    expect(describeLoadout(solvePlates(102.5, "kg"))).toBe(
      "25 + 15 + 1.25 per side",
    );
  });
});

describe("plate specs", () => {
  it("lb plates strictly descending in value and diameter non-increasing", () => {
    for (let i = 1; i < LB_BAR.plates.length; i++) {
      expect(LB_BAR.plates[i].value).toBeLessThan(LB_BAR.plates[i - 1].value);
      expect(LB_BAR.plates[i].diameterMm).toBeLessThanOrEqual(
        LB_BAR.plates[i - 1].diameterMm,
      );
    }
  });

  it("kg 25 and 20 share competition 450mm diameter", () => {
    expect(KG_BAR.plates[0].diameterMm).toBe(450);
    expect(KG_BAR.plates[1].diameterMm).toBe(450);
  });
});
