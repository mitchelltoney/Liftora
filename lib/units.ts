import type { Unit } from "./types";

/** Exact international avoirdupois pound. */
export const KG_PER_LB = 0.45359237;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

/** Convert canonical kg into the display unit. */
export function fromKg(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

/** Convert a display-unit value into canonical kg. */
export function toKg(value: number, unit: Unit): number {
  return unit === "kg" ? value : lbToKg(value);
}

/**
 * Round to a step (e.g. 0.5 lb, 0.25 kg). Guards float noise so that a
 * kg→lb→kg round trip re-displays exactly what the user typed.
 */
export function roundToStep(value: number, step: number): number {
  const inv = 1 / step;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * inv) / inv;
}

/** Display rounding used across the UI: 0.5 lb / 0.25 kg resolution. */
export function displayWeight(kg: number, unit: Unit): number {
  return unit === "kg" ? roundToStep(kg, 0.25) : roundToStep(kgToLb(kg), 0.5);
}

/** Format a display-unit number with no trailing ".0" noise (e.g. 225, 102.5). */
export function formatWeight(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Formatted weight in display unit from canonical kg, with unit suffix. */
export function formatKgAs(kg: number, unit: Unit): string {
  return `${formatWeight(displayWeight(kg, unit))} ${unit}`;
}
