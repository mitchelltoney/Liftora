import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { lbToKg } from "../units";
import { __resetDBForTests } from "./db";
import { exportAll, importAll, parseExportFile, ImportError } from "./export";
import {
  deleteSet,
  discardSession,
  endSession,
  getActiveSession,
  getAllPRs,
  getCompletedSessions,
  getPrefs,
  getSetsForSession,
  reorderSets,
  saveSet,
  setPrefs,
  startOrResumeSession,
} from "./repo";
import { clearDemoData, CORE_LIFTS, ensureCoreLifts, hasSeededDemo, seedDemoData } from "./seed";

beforeEach(() => {
  // Fresh database per test.
  globalThis.indexedDB = new IDBFactory();
  __resetDBForTests();
});

describe("session lifecycle", () => {
  it("startOrResumeSession creates once and resumes the same live session", async () => {
    const first = await startOrResumeSession();
    const resumed = await startOrResumeSession();
    expect(resumed.id).toBe(first.id);
    expect(resumed.endedAt).toBeNull();
  });

  it("active session survives a 'reload' (fresh connection)", async () => {
    const live = await startOrResumeSession();
    __resetDBForTests(); // simulates page reload re-opening the DB
    const active = await getActiveSession();
    expect(active?.id).toBe(live.id);
  });

  it("endSession clears the active pointer and completes the session", async () => {
    const live = await startOrResumeSession();
    await endSession(live.id);
    expect(await getActiveSession()).toBeNull();
    const completed = await getCompletedSessions();
    expect(completed.map((s) => s.id)).toContain(live.id);
  });

  it("discardSession removes the session, its sets, and its PRs", async () => {
    const lifts = await ensureCoreLifts();
    const bench = lifts.find((l) => l.name === "Bench Press")!;
    const live = await startOrResumeSession();
    await saveSet({
      sessionId: live.id,
      liftId: bench.id,
      weightKg: lbToKg(225),
      reps: 5,
      rpe: 8,
    });
    expect((await getAllPRs()).length).toBeGreaterThan(0);
    await discardSession(live.id);
    expect(await getActiveSession()).toBeNull();
    expect(await getAllPRs()).toEqual([]);
    expect(await getSetsForSession(live.id)).toEqual([]);
  });
});

describe("saveSet + PR pipeline", () => {
  it("first heavy set earns a weight PR; repeat does not", async () => {
    const lifts = await ensureCoreLifts();
    const bench = lifts.find((l) => l.name === "Bench Press")!;
    const live = await startOrResumeSession();

    const first = await saveSet({
      sessionId: live.id,
      liftId: bench.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
    });
    expect(first.prs.map((p) => p.type)).toContain("weight");

    const repeat = await saveSet({
      sessionId: live.id,
      liftId: bench.id,
      weightKg: 100,
      reps: 5,
      rpe: 8.5,
    });
    expect(repeat.prs.find((p) => p.type === "weight")).toBeUndefined();
    expect(repeat.prs.find((p) => p.type === "reps")).toBeUndefined();
  });

  it("orderIndex increments across lifts within the session", async () => {
    const lifts = await ensureCoreLifts();
    const bench = lifts.find((l) => l.name === "Bench Press")!;
    const squat = lifts.find((l) => l.name === "Squat")!;
    const live = await startOrResumeSession();
    await saveSet({ sessionId: live.id, liftId: bench.id, weightKg: 100, reps: 5, rpe: null });
    await saveSet({ sessionId: live.id, liftId: squat.id, weightKg: 140, reps: 5, rpe: null });
    const sets = await getSetsForSession(live.id);
    expect(sets.map((s) => s.orderIndex)).toEqual([0, 1]);
  });

  it("deleteSet also revokes PRs earned by that set", async () => {
    const lifts = await ensureCoreLifts();
    const bench = lifts.find((l) => l.name === "Bench Press")!;
    const live = await startOrResumeSession();
    const { set } = await saveSet({
      sessionId: live.id,
      liftId: bench.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
    });
    await deleteSet(set.id);
    expect(await getAllPRs()).toEqual([]);
  });

  it("reorderSets persists the new order", async () => {
    const lifts = await ensureCoreLifts();
    const bench = lifts.find((l) => l.name === "Bench Press")!;
    const live = await startOrResumeSession();
    const a = (await saveSet({ sessionId: live.id, liftId: bench.id, weightKg: 100, reps: 5, rpe: null })).set;
    const b = (await saveSet({ sessionId: live.id, liftId: bench.id, weightKg: 102.5, reps: 3, rpe: null })).set;
    await reorderSets(live.id, [b.id, a.id]);
    const sets = await getSetsForSession(live.id);
    expect(sets.map((s) => s.id)).toEqual([b.id, a.id]);
  });
});

describe("prefs", () => {
  it("defaults, patch, persist", async () => {
    expect((await getPrefs()).unit).toBe("lb");
    await setPrefs({ unit: "kg", bodyweightKg: 84 });
    const prefs = await getPrefs();
    expect(prefs.unit).toBe("kg");
    expect(prefs.bodyweightKg).toBe(84);
    expect(prefs.weeklyTarget).toBe(3); // untouched default
  });
});

describe("export / import round trip", () => {
  it("is lossless across every store", async () => {
    await ensureCoreLifts();
    await seedDemoData();
    await setPrefs({ unit: "kg", bodyweightKg: 84, weeklyTarget: 4 });

    const exported = await exportAll();
    expect(exported.sets.length).toBeGreaterThan(50);
    expect(exported.prs.length).toBeGreaterThan(0);

    const json = JSON.stringify(exported);

    // Wipe: fresh database.
    globalThis.indexedDB = new IDBFactory();
    __resetDBForTests();
    expect((await exportAll()).sets).toEqual([]);

    const parsed = parseExportFile(json);
    await importAll(parsed);
    const reExported = await exportAll();

    expect(reExported.lifts).toEqual(exported.lifts);
    expect(reExported.sessions).toEqual(exported.sessions);
    expect(reExported.sets).toEqual(exported.sets);
    expect(reExported.prs).toEqual(exported.prs);
    expect(reExported.prefs).toEqual(exported.prefs);
  });

  it("rejects foreign or corrupt files with a useful error", () => {
    expect(() => parseExportFile("not json")).toThrow(ImportError);
    expect(() => parseExportFile('{"app":"other"}')).toThrow(/Not a Liftora/);
    expect(() =>
      parseExportFile('{"app":"aetherforge","schemaVersion":999,"lifts":[],"sessions":[],"sets":[],"prs":[],"prefs":{}}'),
    ).toThrow(/newer app version/);
  });
});

describe("demo data", () => {
  it("seeds flagged rows and clears them in one call", async () => {
    await seedDemoData();
    expect(await hasSeededDemo()).toBe(true);
    const before = await exportAll();
    expect(before.sessions.every((s) => s.isDemo)).toBe(true);

    await clearDemoData();
    expect(await hasSeededDemo()).toBe(false);
    const after = await exportAll();
    expect(after.sessions).toEqual([]);
    expect(after.sets).toEqual([]);
    expect(after.prs).toEqual([]);
    // Core lifts are NOT demo data and survive.
    expect(after.lifts.length).toBe(CORE_LIFTS.length);
  });

  it("demo PRs are derived by the real pipeline (weight PRs strictly increase)", async () => {
    await seedDemoData();
    const prs = await getAllPRs();
    const benchWeightPRs = prs
      .filter((p) => p.type === "weight")
      .sort((a, b) => a.achievedAt - b.achievedAt);
    for (let i = 1; i < benchWeightPRs.length; i++) {
      if (benchWeightPRs[i].liftId === benchWeightPRs[i - 1].liftId) {
        expect(benchWeightPRs[i].value).toBeGreaterThan(
          benchWeightPRs[i - 1].value,
        );
      }
    }
  });
});
