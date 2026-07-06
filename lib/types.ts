/**
 * Core domain types for AetherForge.
 *
 * Weights are stored canonically in kilograms (`weightKg`). Display-unit
 * conversion happens at the edge (see lib/units.ts). This keeps analytics,
 * PR detection, and unit switching lossless.
 */

export type Unit = "lb" | "kg";

export type LiftCategory =
  | "horizontal-press"
  | "vertical-press"
  | "squat"
  | "hinge"
  | "pull"
  | "bodyweight"
  | "custom";

export interface Lift {
  id: string;
  name: string;
  category: LiftCategory;
  /** Bodyweight movement: `weightKg` on sets is added (+) or assistance (−) load. */
  isBodyweight: boolean;
  isCustom: boolean;
  /** Uses a barbell — drives the 3D plate-loading scene. */
  usesBarbell: boolean;
  /** Default stepper increment in the user's display unit. */
  defaultIncrement: number;
  /** Which 3D scene renders this lift. */
  scene: SceneKind;
  createdAt: number;
  isDemo?: boolean;
}

export type SceneKind =
  | "bench"
  | "squat"
  | "deadlift"
  | "ohp"
  | "row"
  | "pullup"
  | "dip"
  | "dumbbell"
  | "latpulldown"
  | "generic-bar";

export interface Session {
  id: string;
  startedAt: number;
  /** null while the session is live (enables resume after accidental close). */
  endedAt: number | null;
  notes: string;
  isDemo?: boolean;
}

export interface SetEntry {
  id: string;
  sessionId: string;
  liftId: string;
  /**
   * Canonical kg. For bodyweight lifts this is the ADDED load:
   * positive = weighted, negative = assisted, 0 = strict bodyweight.
   */
  weightKg: number;
  reps: number;
  /** RPE 1–10 in 0.5 steps, or null if not rated. */
  rpe: number | null;
  note: string;
  orderIndex: number;
  createdAt: number;
  isDemo?: boolean;
}

export type PRType = "weight" | "reps" | "e1rm" | "volume";

export interface PR {
  id: string;
  liftId: string;
  type: PRType;
  /** kg for weight/e1rm/volume; rep count for reps. */
  value: number;
  /** For rep PRs: the weight (kg) the reps were performed at. */
  atWeightKg?: number;
  /** Previous best value (same semantics as `value`); null if first ever. */
  previousValue: number | null;
  setEntryId: string;
  sessionId: string;
  achievedAt: number;
  isDemo?: boolean;
}

export interface Prefs {
  unit: Unit;
  /** Canonical kg; null until the user provides it (prompted once for bodyweight volume). */
  bodyweightKg: number | null;
  /** Sessions per week that keep the weekly streak alive. */
  weeklyTarget: number;
  /** Default rest timer, seconds. */
  restTimerDefault: number;
  reducedMotion: boolean;
  /** First day of week for streaks/heatmap: 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
}

export const DEFAULT_PREFS: Prefs = {
  unit: "lb",
  bodyweightKg: null,
  weeklyTarget: 3,
  restTimerDefault: 150,
  reducedMotion: false,
  weekStartsOn: 1,
};

/** A set joined with its lift — the shape most analytics functions consume. */
export interface SetWithLift {
  set: SetEntry;
  lift: Lift;
}
