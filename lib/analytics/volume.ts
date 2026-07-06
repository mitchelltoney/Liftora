import type { Lift, SetEntry } from "../types";

/**
 * Effective load moved in a set, in kg.
 *
 * Barbell/free-weight lifts: the entered weight.
 * Bodyweight lifts: bodyweight + added load (added can be negative for
 * assistance). Requires a stored bodyweight; callers must prompt for it
 * once before logging bodyweight work (bodyweightKg=null ⇒ added load only,
 * clamped at 0, so volume is never fabricated).
 */
export function totalLoadKg(
  set: Pick<SetEntry, "weightKg">,
  lift: Pick<Lift, "isBodyweight">,
  bodyweightKg: number | null,
): number {
  if (!lift.isBodyweight) return set.weightKg;
  const bw = bodyweightKg ?? 0;
  return Math.max(0, bw + set.weightKg);
}

/** Volume of one set in kg: load × reps. */
export function setVolumeKg(
  set: Pick<SetEntry, "weightKg" | "reps">,
  lift: Pick<Lift, "isBodyweight">,
  bodyweightKg: number | null,
): number {
  return totalLoadKg(set, lift, bodyweightKg) * set.reps;
}

/** Σ volume across sets (kg). */
export function totalVolumeKg(
  sets: ReadonlyArray<Pick<SetEntry, "weightKg" | "reps" | "liftId">>,
  liftById: ReadonlyMap<string, Pick<Lift, "isBodyweight">>,
  bodyweightKg: number | null,
): number {
  let sum = 0;
  for (const set of sets) {
    const lift = liftById.get(set.liftId);
    if (!lift) continue;
    sum += setVolumeKg(set, lift, bodyweightKg);
  }
  return sum;
}
