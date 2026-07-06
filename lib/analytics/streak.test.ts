import { describe, expect, it } from "vitest";
import { computeStreaks, trainingDayCounts } from "./streak";

/** Local-time date builder (streaks are local-time semantics). */
function at(y: number, m: number, d: number, h = 12): number {
  return new Date(y, m - 1, d, h, 0, 0, 0).getTime();
}

// 2026-07-05 is a Sunday; weeks start Monday in these tests.
const NOW = at(2026, 7, 5, 18);
const MON: 0 | 1 = 1;

describe("weekly streak", () => {
  it("empty history → 0/0", () => {
    expect(computeStreaks([], 3, MON, NOW)).toEqual({ weekStreak: 0, dayChain: 0 });
  });

  it("three consecutive weeks at target (3/week)", () => {
    const sessions = [
      // Week of Jun 15
      at(2026, 6, 15), at(2026, 6, 17), at(2026, 6, 19),
      // Week of Jun 22
      at(2026, 6, 22), at(2026, 6, 24), at(2026, 6, 26),
      // Week of Jun 29 (current week ends Sun Jul 5)
      at(2026, 6, 29), at(2026, 7, 1), at(2026, 7, 3),
    ];
    expect(computeStreaks(sessions, 3, MON, NOW).weekStreak).toBe(3);
  });

  it("current week below target does not break the chain, just doesn't extend it", () => {
    const sessions = [
      at(2026, 6, 22), at(2026, 6, 24), at(2026, 6, 26), // full prior week
      at(2026, 6, 29), // current week: only 1 of 3 so far
    ];
    expect(computeStreaks(sessions, 3, MON, NOW).weekStreak).toBe(1);
  });

  it("a completed week that missed target breaks the streak", () => {
    const sessions = [
      at(2026, 6, 8), at(2026, 6, 10), at(2026, 6, 12), // week -3: hit
      at(2026, 6, 17),                                   // week -2: missed (1/3)
      at(2026, 6, 29), at(2026, 7, 1), at(2026, 7, 3),   // current: hit
    ];
    expect(computeStreaks(sessions, 3, MON, NOW).weekStreak).toBe(1);
  });

  it("weeklyTarget of 1 counts any training week", () => {
    const sessions = [at(2026, 6, 24), at(2026, 7, 2)];
    expect(computeStreaks(sessions, 1, MON, NOW).weekStreak).toBe(2);
  });

  it("Sunday week start shifts the boundary", () => {
    // With weeks starting Sunday, Jul 5 (Sun) is its own new week.
    const sessions = [at(2026, 7, 5)];
    expect(computeStreaks(sessions, 1, 0, NOW).weekStreak).toBe(1);
    // Same session with Monday weeks: belongs to week of Jun 29.
    expect(computeStreaks(sessions, 1, MON, NOW).weekStreak).toBe(1);
  });

  it("nonsense target < 1 → zeros", () => {
    expect(computeStreaks([at(2026, 7, 4)], 0, MON, NOW)).toEqual({
      weekStreak: 0,
      dayChain: 0,
    });
  });
});

describe("day chain", () => {
  it("counts consecutive days ending today", () => {
    const sessions = [at(2026, 7, 3), at(2026, 7, 4), at(2026, 7, 5)];
    expect(computeStreaks(sessions, 3, MON, NOW).dayChain).toBe(3);
  });

  it("no session today: chain ending yesterday still counts", () => {
    const sessions = [at(2026, 7, 3), at(2026, 7, 4)];
    expect(computeStreaks(sessions, 3, MON, NOW).dayChain).toBe(2);
  });

  it("gap two days ago resets the chain", () => {
    const sessions = [at(2026, 7, 1), at(2026, 7, 4), at(2026, 7, 5)];
    expect(computeStreaks(sessions, 3, MON, NOW).dayChain).toBe(2);
  });

  it("last session three days ago → chain 0", () => {
    const sessions = [at(2026, 7, 2)];
    expect(computeStreaks(sessions, 3, MON, NOW).dayChain).toBe(0);
  });

  it("two sessions in one day count as one chain day", () => {
    const sessions = [at(2026, 7, 5, 9), at(2026, 7, 5, 18)];
    expect(computeStreaks(sessions, 3, MON, NOW).dayChain).toBe(1);
  });
});

describe("trainingDayCounts", () => {
  it("buckets sessions per local day", () => {
    const counts = trainingDayCounts([
      at(2026, 7, 5, 9),
      at(2026, 7, 5, 18),
      at(2026, 7, 4),
    ]);
    const day5 = new Date(2026, 6, 5).setHours(0, 0, 0, 0);
    const day4 = new Date(2026, 6, 4).setHours(0, 0, 0, 0);
    expect(counts.get(day5)).toBe(2);
    expect(counts.get(day4)).toBe(1);
  });
});
