import { describe, expect, it } from "vitest";
import {
  displayWeight,
  formatKgAs,
  formatWeight,
  fromKg,
  kgToLb,
  lbToKg,
  roundToStep,
  toKg,
} from "./units";

describe("lb ↔ kg round trips", () => {
  it("every 2.5 lb step from 45 to 700 survives lb→kg→lb at 0.5 lb display", () => {
    for (let lb = 45; lb <= 700; lb += 2.5) {
      const kg = lbToKg(lb);
      expect(displayWeight(kg, "lb")).toBe(lb);
    }
  });

  it("every 1.25 kg step from 20 to 320 survives kg→display at 0.25 kg", () => {
    for (let kg = 20; kg <= 320; kg += 1.25) {
      expect(displayWeight(toKg(kg, "kg"), "kg")).toBe(kg);
    }
  });

  it("raw conversion is within float epsilon of exact", () => {
    expect(kgToLb(lbToKg(225))).toBeCloseTo(225, 9);
    expect(lbToKg(kgToLb(102.5))).toBeCloseTo(102.5, 9);
  });

  it("known anchors: 20 kg bar ≈ 44.09 lb, 45 lb bar ≈ 20.41 kg", () => {
    expect(kgToLb(20)).toBeCloseTo(44.0925, 3);
    expect(lbToKg(45)).toBeCloseTo(20.4117, 3);
  });
});

describe("roundToStep", () => {
  it("rounds to halves and quarters", () => {
    expect(roundToStep(224.99999999, 0.5)).toBe(225);
    expect(roundToStep(102.4999999, 0.25)).toBe(102.5);
    expect(roundToStep(8.24, 0.5)).toBe(8);
    expect(roundToStep(8.26, 0.5)).toBe(8.5);
  });

  it("handles negatives (assistance weights)", () => {
    expect(roundToStep(-24.999999, 0.5)).toBe(-25);
  });
});

describe("formatting", () => {
  it("drops trailing decimals on whole numbers", () => {
    expect(formatWeight(225)).toBe("225");
    expect(formatWeight(102.5)).toBe("102.5");
  });

  it("formatKgAs renders display unit with suffix", () => {
    expect(formatKgAs(lbToKg(225), "lb")).toBe("225 lb");
    expect(formatKgAs(102.5, "kg")).toBe("102.5 kg");
  });

  it("fromKg/toKg identity in kg mode", () => {
    expect(fromKg(102.5, "kg")).toBe(102.5);
    expect(toKg(102.5, "kg")).toBe(102.5);
  });
});
