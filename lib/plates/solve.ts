import type { Unit } from "../types";

/**
 * Plate-loading solver.
 *
 * Physical accuracy is non-negotiable: the 3D scenes render exactly what
 * this module returns. All math happens in the DISPLAY unit (lb math for a
 * 45 lb bar, kg math for a 20 kg bar) to avoid float drift from canonical-kg
 * conversion; callers convert first via lib/units.
 */

export interface PlateSpec {
  /** Face value in the set's unit (45 lb, 25 kg, …). */
  value: number;
  /** Outer diameter in millimetres (drives 3D geometry + floor contact). */
  diameterMm: number;
  /** Thickness in millimetres. */
  thicknessMm: number;
  /** Render color (competition kg / classic iron lb). */
  color: string;
}

export interface BarSpec {
  unit: Unit;
  /** Bar weight in the set's unit. */
  weight: number;
  /** Standard plate denominations, descending. */
  plates: PlateSpec[];
}

/** Classic iron look for lb mode; diameters follow common cast-iron sizing. */
export const LB_BAR: BarSpec = {
  unit: "lb",
  weight: 45,
  plates: [
    { value: 45, diameterMm: 450, thicknessMm: 37, color: "#3a3f47" },
    { value: 35, diameterMm: 358, thicknessMm: 33, color: "#363b42" },
    { value: 25, diameterMm: 273, thicknessMm: 32, color: "#32373e" },
    { value: 10, diameterMm: 228, thicknessMm: 22, color: "#2e333a" },
    { value: 5, diameterMm: 202, thicknessMm: 17, color: "#2a2f36" },
    { value: 2.5, diameterMm: 162, thicknessMm: 13, color: "#262b32" },
  ],
};

/** IPF competition colors for kg mode. */
export const KG_BAR: BarSpec = {
  unit: "kg",
  weight: 20,
  plates: [
    { value: 25, diameterMm: 450, thicknessMm: 27, color: "#dc2626" },
    { value: 20, diameterMm: 450, thicknessMm: 22, color: "#2563eb" },
    { value: 15, diameterMm: 400, thicknessMm: 22, color: "#eab308" },
    { value: 10, diameterMm: 325, thicknessMm: 22, color: "#16a34a" },
    { value: 5, diameterMm: 228, thicknessMm: 26, color: "#f8fafc" },
    { value: 2.5, diameterMm: 190, thicknessMm: 19, color: "#171717" },
    { value: 1.25, diameterMm: 160, thicknessMm: 12, color: "#a3a3a3" },
  ],
};

export function barSpecFor(unit: Unit): BarSpec {
  return unit === "kg" ? KG_BAR : LB_BAR;
}

export type PlateSolution =
  | {
      kind: "loaded";
      /** Plates for ONE side, inboard → outboard (largest first). */
      perSide: PlateSpec[];
      /** The weight actually built (bar + 2 × side). */
      achievedTotal: number;
      /** Requested total in the same unit. */
      requestedTotal: number;
      /** True when achievedTotal differs from requestedTotal. */
      isApproximate: boolean;
      barWeight: number;
      unit: Unit;
    }
  | {
      kind: "below-bar";
      /** Requested total was under the empty bar. */
      requestedTotal: number;
      barWeight: number;
      unit: Unit;
    };

const EPS = 1e-6;

/**
 * Greedy per-side loadout for `total` (display unit).
 *
 * Greedy is exact for both standard sets above because each denomination
 * divides cleanly into the ones above it (verified exhaustively in tests
 * across the full 0.25-step range up to 1000).
 */
export function solvePlates(total: number, unit: Unit): PlateSolution {
  const bar = barSpecFor(unit);
  // Snap away float noise from unit conversion before comparing.
  const requested = Math.round(total * 1000) / 1000;

  if (requested < bar.weight - EPS) {
    return {
      kind: "below-bar",
      requestedTotal: requested,
      barWeight: bar.weight,
      unit,
    };
  }

  let perSideTarget = (requested - bar.weight) / 2;
  const perSide: PlateSpec[] = [];
  for (const plate of bar.plates) {
    while (perSideTarget >= plate.value - EPS) {
      perSide.push(plate);
      perSideTarget -= plate.value;
    }
  }

  const loadedPerSide = perSide.reduce((sum, p) => sum + p.value, 0);
  const achieved = Math.round((bar.weight + loadedPerSide * 2) * 1000) / 1000;

  return {
    kind: "loaded",
    perSide,
    achievedTotal: achieved,
    requestedTotal: requested,
    isApproximate: Math.abs(achieved - requested) > EPS,
    barWeight: bar.weight,
    unit,
  };
}

/** "2×45 + 25 per side" — the caption under the 3D viewport. */
export function describeLoadout(solution: PlateSolution): string {
  if (solution.kind === "below-bar") {
    return `Below ${solution.barWeight} ${solution.unit} bar`;
  }
  if (solution.perSide.length === 0) return "Empty bar";
  const counts = new Map<number, number>();
  for (const p of solution.perSide) {
    counts.set(p.value, (counts.get(p.value) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([value, n]) =>
    n > 1 ? `${n}×${value}` : `${value}`,
  );
  return `${parts.join(" + ")} per side`;
}
