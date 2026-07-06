import type { Lift, PR, PRType, SetEntry } from "../types";
import { estimateE1RM } from "./e1rm";
import { setVolumeKg, totalLoadKg } from "./volume";

/**
 * PR detection.
 *
 * Four PR types (exhaustive — see PRType):
 *  - weight:  heaviest load ever moved for the lift (any rep count ≥ 1)
 *  - reps:    most reps ever at a given weight (weight bucketed to 0.5 kg)
 *  - e1rm:    highest Epley estimate (rep-capped; low-confidence sets are
 *             still eligible because the capped value is a valid floor)
 *  - volume:  highest single-session volume for the lift; fires on the set
 *             that pushes the running session total past the old record
 *
 * All comparisons run in canonical kg. Bodyweight lifts compare TOTAL load
 * (bodyweight + added), so a bodyweight change legitimately shifts PRs —
 * that is physically honest.
 */

export interface LiftPRState {
  bestWeightKg: number | null;
  /** weight bucket (0.5 kg) → best reps at that weight. */
  bestRepsAtWeight: Map<number, number>;
  bestE1rmKg: number | null;
  /** Best single-session volume (kg) across completed history. */
  bestSessionVolumeKg: number | null;
}

export interface DetectedPR {
  type: PRType;
  value: number;
  previousValue: number | null;
  atWeightKg?: number;
}

/** Bucket a weight for rep-PR comparison (0.5 kg ≈ 1.1 lb resolution). */
export function weightBucket(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Fold history into the comparison state for one lift. */
export function buildPRState(
  historicalSets: ReadonlyArray<SetEntry>,
  lift: Lift,
  bodyweightKg: number | null,
): LiftPRState {
  const state: LiftPRState = {
    bestWeightKg: null,
    bestRepsAtWeight: new Map(),
    bestE1rmKg: null,
    bestSessionVolumeKg: null,
  };
  const sessionVolumes = new Map<string, number>();

  for (const set of historicalSets) {
    if (set.reps < 1) continue;
    const load = totalLoadKg(set, lift, bodyweightKg);
    if (load > 0) {
      if (state.bestWeightKg === null || load > state.bestWeightKg) {
        state.bestWeightKg = load;
      }
      const bucket = weightBucket(load);
      const bestReps = state.bestRepsAtWeight.get(bucket) ?? 0;
      if (set.reps > bestReps) state.bestRepsAtWeight.set(bucket, set.reps);

      const est = estimateE1RM(load, set.reps);
      if (est && (state.bestE1rmKg === null || est.epley > state.bestE1rmKg)) {
        state.bestE1rmKg = est.epley;
      }
    }
    sessionVolumes.set(
      set.sessionId,
      (sessionVolumes.get(set.sessionId) ?? 0) +
        setVolumeKg(set, lift, bodyweightKg),
    );
  }
  for (const volume of sessionVolumes.values()) {
    if (state.bestSessionVolumeKg === null || volume > state.bestSessionVolumeKg) {
      state.bestSessionVolumeKg = volume;
    }
  }
  return state;
}

const KG_TOLERANCE = 1e-6;

/**
 * Evaluate a just-saved set against the lift's PR state.
 *
 * `currentSessionVolumeKg` is the running total for this lift in the live
 * session INCLUDING the new set. Historical state must NOT include the
 * live session.
 *
 * Returns every PR type the set achieved (a heavy triple can take weight,
 * e1rm, and volume at once). Mutates nothing — persist via recordPRs.
 */
export function detectPRs(
  set: SetEntry,
  lift: Lift,
  state: LiftPRState,
  bodyweightKg: number | null,
  currentSessionVolumeKg: number,
): DetectedPR[] {
  if (set.reps < 1) return [];
  const prs: DetectedPR[] = [];
  const load = totalLoadKg(set, lift, bodyweightKg);

  if (load > 0) {
    if (state.bestWeightKg === null || load > state.bestWeightKg + KG_TOLERANCE) {
      prs.push({
        type: "weight",
        value: load,
        previousValue: state.bestWeightKg,
      });
    }

    const bucket = weightBucket(load);
    const bestReps = state.bestRepsAtWeight.get(bucket);
    // A rep PR needs prior history at this weight — more reps at a brand-new
    // weight is just the weight PR, not a separate rep record.
    if (bestReps !== undefined && set.reps > bestReps) {
      prs.push({
        type: "reps",
        value: set.reps,
        previousValue: bestReps,
        atWeightKg: bucket,
      });
    }

    const est = estimateE1RM(load, set.reps);
    if (
      est &&
      (state.bestE1rmKg === null || est.epley > state.bestE1rmKg + KG_TOLERANCE)
    ) {
      // Suppress the e1rm PR when it's just the weight PR restated: a
      // 1-rep weight PR always implies a new e1rm.
      const isRedundantWithWeight =
        set.reps === 1 && prs.some((p) => p.type === "weight");
      if (!isRedundantWithWeight) {
        prs.push({
          type: "e1rm",
          value: est.epley,
          previousValue: state.bestE1rmKg,
        });
      }
    }
  }

  if (
    state.bestSessionVolumeKg !== null &&
    currentSessionVolumeKg > state.bestSessionVolumeKg + KG_TOLERANCE
  ) {
    prs.push({
      type: "volume",
      value: currentSessionVolumeKg,
      previousValue: state.bestSessionVolumeKg,
    });
  }

  return prs;
}

/**
 * Advance PR state after a set (so subsequent sets in the same session
 * compare against it and can't re-trigger the same record).
 */
export function advancePRState(
  state: LiftPRState,
  set: SetEntry,
  lift: Lift,
  bodyweightKg: number | null,
  currentSessionVolumeKg: number,
): void {
  if (set.reps < 1) return;
  const load = totalLoadKg(set, lift, bodyweightKg);
  if (load > 0) {
    if (state.bestWeightKg === null || load > state.bestWeightKg) {
      state.bestWeightKg = load;
    }
    const bucket = weightBucket(load);
    const bestReps = state.bestRepsAtWeight.get(bucket) ?? 0;
    if (set.reps > bestReps) state.bestRepsAtWeight.set(bucket, set.reps);
    const est = estimateE1RM(load, set.reps);
    if (est && (state.bestE1rmKg === null || est.epley > state.bestE1rmKg)) {
      state.bestE1rmKg = est.epley;
    }
  }
  if (
    state.bestSessionVolumeKg !== null &&
    currentSessionVolumeKg > state.bestSessionVolumeKg
  ) {
    state.bestSessionVolumeKg = currentSessionVolumeKg;
  }
}

/** Materialize detections into PR rows for persistence. */
export function toPRRows(
  detections: DetectedPR[],
  set: SetEntry,
  idFactory: () => string,
): PR[] {
  return detections.map((d) => ({
    id: idFactory(),
    liftId: set.liftId,
    type: d.type,
    value: d.value,
    atWeightKg: d.atWeightKg,
    previousValue: d.previousValue,
    setEntryId: set.id,
    sessionId: set.sessionId,
    achievedAt: set.createdAt,
    isDemo: set.isDemo,
  }));
}
