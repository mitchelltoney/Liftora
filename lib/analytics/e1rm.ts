/**
 * Estimated one-rep-max formulas.
 *
 * Rep contribution is capped at 12: past that, both formulas drift badly,
 * so we compute against 12 reps (a conservative, still-valid floor) and
 * flag the estimate as low-confidence.
 */

export const E1RM_REP_CAP = 12;

export interface E1RMEstimate {
  epley: number;
  brzycki: number;
  /** True when reps exceeded the cap and the estimate used 12. */
  lowConfidence: boolean;
  /** Reps actually used in the formula (min(reps, 12)). */
  effectiveReps: number;
}

/** Epley: w × (1 + r/30). At r=1 returns w. */
export function epley(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki: w × 36 / (37 − r). At r=1 returns w. */
export function brzycki(weight: number, reps: number): number {
  return (weight * 36) / (37 - reps);
}

/**
 * Full estimate for a set. `weight` must already include bodyweight for
 * bodyweight lifts (see totalLoadKg in volume.ts).
 *
 * Returns null for rep counts < 1 or non-positive loads (an assisted
 * pull-up with net load ≤ 0 has no meaningful 1RM).
 */
export function estimateE1RM(weight: number, reps: number): E1RMEstimate | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (reps < 1 || weight <= 0) return null;
  const effectiveReps = Math.min(Math.floor(reps), E1RM_REP_CAP);
  return {
    epley: epley(weight, effectiveReps),
    brzycki: brzycki(weight, effectiveReps),
    lowConfidence: reps > E1RM_REP_CAP,
    effectiveReps,
  };
}
