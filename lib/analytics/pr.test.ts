import { describe, expect, it } from "vitest";
import type { Lift, SetEntry } from "../types";
import { advancePRState, buildPRState, detectPRs, weightBucket } from "./pr";

const bench: Lift = {
  id: "bench",
  name: "Bench Press",
  category: "horizontal-press",
  isBodyweight: false,
  isCustom: false,
  usesBarbell: true,
  defaultIncrement: 5,
  scene: "bench",
  createdAt: 0,
};

const pullup: Lift = {
  ...bench,
  id: "pullup",
  name: "Pull-Ups",
  category: "bodyweight",
  isBodyweight: true,
  usesBarbell: false,
  scene: "pullup",
};

let setSeq = 0;
function makeSet(partial: Partial<SetEntry> & { weightKg: number; reps: number }): SetEntry {
  setSeq++;
  return {
    id: `set-${setSeq}`,
    sessionId: partial.sessionId ?? "hist-1",
    liftId: partial.liftId ?? "bench",
    rpe: null,
    note: "",
    orderIndex: setSeq,
    createdAt: setSeq * 1000,
    ...partial,
  };
}

describe("weight PR", () => {
  it("first-ever set is a weight PR with null previous", () => {
    const state = buildPRState([], bench, null);
    const set = makeSet({ weightKg: 100, reps: 5, sessionId: "live" });
    const prs = detectPRs(set, bench, state, null, 500);
    const weightPR = prs.find((p) => p.type === "weight");
    expect(weightPR).toBeDefined();
    expect(weightPR!.value).toBe(100);
    expect(weightPR!.previousValue).toBeNull();
  });

  it("heavier single beats historical best", () => {
    const history = [makeSet({ weightKg: 140, reps: 1 })];
    const state = buildPRState(history, bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 142.5, reps: 1, sessionId: "live" }),
      bench,
      state,
      null,
      142.5,
    );
    expect(prs.map((p) => p.type)).toContain("weight");
    expect(prs.find((p) => p.type === "weight")!.previousValue).toBe(140);
  });

  it("equal weight is NOT a PR", () => {
    const state = buildPRState([makeSet({ weightKg: 140, reps: 1 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 140, reps: 1, sessionId: "live" }),
      bench,
      state,
      null,
      140,
    );
    expect(prs.find((p) => p.type === "weight")).toBeUndefined();
  });
});

describe("rep PR at a given weight", () => {
  it("more reps at a previously-visited weight", () => {
    const state = buildPRState([makeSet({ weightKg: 100, reps: 5 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 100, reps: 7, sessionId: "live" }),
      bench,
      state,
      null,
      700,
    );
    const repPR = prs.find((p) => p.type === "reps");
    expect(repPR).toBeDefined();
    expect(repPR!.value).toBe(7);
    expect(repPR!.previousValue).toBe(5);
    expect(repPR!.atWeightKg).toBe(weightBucket(100));
  });

  it("no rep PR at a never-before-seen weight (that's the weight PR's job)", () => {
    const state = buildPRState([makeSet({ weightKg: 100, reps: 5 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 110, reps: 8, sessionId: "live" }),
      bench,
      state,
      null,
      880,
    );
    expect(prs.find((p) => p.type === "reps")).toBeUndefined();
  });

  it("fewer reps at a weight is not a PR", () => {
    const state = buildPRState([makeSet({ weightKg: 100, reps: 8 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 100, reps: 5, sessionId: "live" }),
      bench,
      state,
      null,
      500,
    );
    expect(prs.find((p) => p.type === "reps")).toBeUndefined();
  });
});

describe("e1rm PR", () => {
  it("rep improvement at same weight raises e1rm", () => {
    // 100×5 → Epley 116.67. New: 100×8 → 126.67.
    const state = buildPRState([makeSet({ weightKg: 100, reps: 5 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 100, reps: 8, sessionId: "live" }),
      bench,
      state,
      null,
      800,
    );
    const e1rmPR = prs.find((p) => p.type === "e1rm");
    expect(e1rmPR).toBeDefined();
    expect(e1rmPR!.value).toBeCloseTo(100 * (1 + 8 / 30), 6);
  });

  it("1-rep weight PR does not double-report as e1rm PR", () => {
    const state = buildPRState([makeSet({ weightKg: 100, reps: 1 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 105, reps: 1, sessionId: "live" }),
      bench,
      state,
      null,
      105,
    );
    expect(prs.find((p) => p.type === "weight")).toBeDefined();
    expect(prs.find((p) => p.type === "e1rm")).toBeUndefined();
  });

  it(">12-rep set competes with its capped (12-rep) value", () => {
    // History: 100×12 → cap value 140. New: 100×20 → also 140. Not a PR.
    const state = buildPRState([makeSet({ weightKg: 100, reps: 12 })], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 100, reps: 20, sessionId: "live" }),
      bench,
      state,
      null,
      2000,
    );
    expect(prs.find((p) => p.type === "e1rm")).toBeUndefined();
  });
});

describe("volume PR", () => {
  it("fires on the set that pushes session volume past the record", () => {
    const history = [
      makeSet({ weightKg: 100, reps: 5, sessionId: "old" }),
      makeSet({ weightKg: 100, reps: 5, sessionId: "old" }),
    ]; // record: 1000 kg
    const state = buildPRState(history, bench, null);
    const below = detectPRs(
      makeSet({ weightKg: 100, reps: 5, sessionId: "live" }),
      bench,
      state,
      null,
      500,
    );
    expect(below.find((p) => p.type === "volume")).toBeUndefined();

    const crossing = detectPRs(
      makeSet({ weightKg: 100, reps: 6, sessionId: "live" }),
      bench,
      state,
      null,
      1100,
    );
    const volPR = crossing.find((p) => p.type === "volume");
    expect(volPR).toBeDefined();
    expect(volPR!.value).toBe(1100);
    expect(volPR!.previousValue).toBe(1000);
  });

  it("no volume PR for a lift with no history (first session is baseline)", () => {
    const state = buildPRState([], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 100, reps: 5, sessionId: "live" }),
      bench,
      state,
      null,
      500,
    );
    expect(prs.find((p) => p.type === "volume")).toBeUndefined();
  });
});

describe("bodyweight lifts", () => {
  it("PRs compare total load (bw + added)", () => {
    // 80 bw + 10 added = 90 historical best.
    const state = buildPRState(
      [makeSet({ liftId: "pullup", weightKg: 10, reps: 5 })],
      pullup,
      80,
    );
    const prs = detectPRs(
      makeSet({ liftId: "pullup", weightKg: 15, reps: 3, sessionId: "live" }),
      pullup,
      state,
      80,
      285,
    );
    const weightPR = prs.find((p) => p.type === "weight");
    expect(weightPR).toBeDefined();
    expect(weightPR!.value).toBe(95);
    expect(weightPR!.previousValue).toBe(90);
  });

  it("fully-assisted set (net load 0) produces no load PRs", () => {
    const state = buildPRState([], pullup, 80);
    const prs = detectPRs(
      makeSet({ liftId: "pullup", weightKg: -80, reps: 10, sessionId: "live" }),
      pullup,
      state,
      80,
      0,
    );
    expect(prs).toEqual([]);
  });
});

describe("within-session state advancement", () => {
  it("same weight twice in one session only PRs once", () => {
    const state = buildPRState([], bench, null);
    const first = makeSet({ weightKg: 100, reps: 5, sessionId: "live" });
    const prs1 = detectPRs(first, bench, state, null, 500);
    expect(prs1.find((p) => p.type === "weight")).toBeDefined();
    advancePRState(state, first, bench, null, 500);

    const second = makeSet({ weightKg: 100, reps: 5, sessionId: "live" });
    const prs2 = detectPRs(second, bench, state, null, 1000);
    expect(prs2.find((p) => p.type === "weight")).toBeUndefined();
    expect(prs2.find((p) => p.type === "reps")).toBeUndefined();
  });

  it("a multi-PR set reports weight + e1rm + reps together when earned", () => {
    const history = [
      makeSet({ weightKg: 100, reps: 3 }),
      makeSet({ weightKg: 102.5, reps: 1 }),
    ];
    const state = buildPRState(history, bench, null);
    // 105×3: beats weight 102.5, e1rm (102.5 vs 115.5), no rep history at 105.
    const prs = detectPRs(
      makeSet({ weightKg: 105, reps: 3, sessionId: "live" }),
      bench,
      state,
      null,
      315,
    );
    expect(prs.map((p) => p.type).sort()).toEqual(["e1rm", "weight"]);
  });

  it("zero-rep set is ignored entirely", () => {
    const state = buildPRState([], bench, null);
    const prs = detectPRs(
      makeSet({ weightKg: 100, reps: 0, sessionId: "live" }),
      bench,
      state,
      null,
      0,
    );
    expect(prs).toEqual([]);
  });
});
