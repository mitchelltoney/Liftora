import { lbToKg } from "../units";
import type { Lift, Session, SetEntry } from "../types";
import { buildPRState, detectPRs, advancePRState, toPRRows } from "../analytics/pr";
import { setVolumeKg } from "../analytics/volume";
import { newId } from "../ids";
import { getDB } from "./db";
import { getPrefs } from "./repo";

/** The core lifts. Created/backfilled on launch; never demo-flagged. */
export const CORE_LIFTS: ReadonlyArray<Omit<Lift, "id" | "createdAt">> = [
  { name: "Bench Press", category: "horizontal-press", isBodyweight: false, isCustom: false, usesBarbell: true, defaultIncrement: 5, scene: "bench" },
  { name: "Squat", category: "squat", isBodyweight: false, isCustom: false, usesBarbell: true, defaultIncrement: 5, scene: "squat" },
  { name: "Deadlift", category: "hinge", isBodyweight: false, isCustom: false, usesBarbell: true, defaultIncrement: 5, scene: "deadlift" },
  { name: "Overhead Press", category: "vertical-press", isBodyweight: false, isCustom: false, usesBarbell: true, defaultIncrement: 2.5, scene: "ohp" },
  { name: "Bent-Over Row", category: "pull", isBodyweight: false, isCustom: false, usesBarbell: true, defaultIncrement: 5, scene: "row" },
  { name: "Pull-Ups", category: "bodyweight", isBodyweight: true, isCustom: false, usesBarbell: false, defaultIncrement: 2.5, scene: "pullup" },
  { name: "Dips", category: "bodyweight", isBodyweight: true, isCustom: false, usesBarbell: false, defaultIncrement: 2.5, scene: "dip" },
  { name: "Dumbbell Curl", category: "pull", isBodyweight: false, isCustom: false, usesBarbell: false, defaultIncrement: 5, scene: "dumbbell" },
  { name: "Lateral Raise", category: "vertical-press", isBodyweight: false, isCustom: false, usesBarbell: false, defaultIncrement: 5, scene: "dumbbell" },
  { name: "Lat Pulldown", category: "pull", isBodyweight: false, isCustom: false, usesBarbell: false, defaultIncrement: 10, scene: "latpulldown" },
];

/**
 * Idempotent AND additive: creates any core lift that doesn't exist yet
 * (matched by name), so databases created before a new core lift shipped
 * pick it up on next launch. Check + inserts share ONE readwrite
 * transaction, so concurrent callers cannot double-insert.
 */
export async function ensureCoreLifts(): Promise<Lift[]> {
  const db = await getDB();
  const now = Date.now();
  const tx = db.transaction("lifts", "readwrite");
  const existing = await tx.store.getAll();
  const existingNames = new Set(existing.map((l) => l.name));
  const missing = CORE_LIFTS.filter((l) => !existingNames.has(l.name));
  const rows: Lift[] = missing.map((lift, i) => ({
    ...lift,
    id: newId(),
    createdAt: now + i, // stable ordering
  }));
  for (const row of rows) await tx.store.put(row);
  await tx.done;
  return [...existing, ...rows];
}

/**
 * Demo data: 6 weeks of plausible training so History/Analytics/3D have
 * something to show before the user has history. Every row is flagged
 * isDemo and removable in one tap (clearDemoData). Weights are honest lb
 * values converted to canonical kg. PRs are derived by running the real
 * detection pipeline over the demo sets — never hand-invented.
 */
export async function seedDemoData(): Promise<void> {
  const db = await getDB();
  const lifts = await ensureCoreLifts();
  const byName = new Map(lifts.map((l) => [l.name, l]));
  const prefs = await getPrefs();
  const bodyweightKg = prefs.bodyweightKg ?? lbToKg(185);

  // Weekly plan: [lift name, top-set weight lb progression per week, reps]
  const plan: Array<{
    day: number; // 0=Mon offset within week
    entries: Array<{ lift: string; topLb: number[]; sets: number; reps: number }>;
  }> = [
    {
      day: 0,
      entries: [
        { lift: "Squat", topLb: [275, 285, 290, 295, 305, 315], sets: 4, reps: 5 },
        { lift: "Bench Press", topLb: [195, 200, 205, 210, 215, 225], sets: 4, reps: 5 },
        { lift: "Bent-Over Row", topLb: [155, 160, 165, 170, 175, 185], sets: 3, reps: 8 },
      ],
    },
    {
      day: 2,
      entries: [
        { lift: "Deadlift", topLb: [335, 345, 355, 365, 375, 385], sets: 3, reps: 5 },
        { lift: "Overhead Press", topLb: [115, 117.5, 120, 122.5, 125, 130], sets: 4, reps: 5 },
        { lift: "Pull-Ups", topLb: [0, 0, 5, 5, 10, 10], sets: 3, reps: 8 },
      ],
    },
    {
      day: 4,
      entries: [
        { lift: "Bench Press", topLb: [185, 190, 195, 200, 205, 210], sets: 5, reps: 8 },
        { lift: "Squat", topLb: [245, 255, 260, 265, 275, 285], sets: 3, reps: 8 },
        { lift: "Dips", topLb: [0, 5, 10, 15, 20, 25], sets: 3, reps: 10 },
      ],
    },
  ];

  const now = new Date();
  const sessions: Session[] = [];
  const sets: SetEntry[] = [];

  for (let week = 0; week < 6; week++) {
    for (const day of plan) {
      const start = new Date(now);
      start.setDate(start.getDate() - ((6 - week) * 7 - day.day) - 2);
      start.setHours(17, 30, 0, 0);
      const startedAt = start.getTime();
      // Skip demo sessions that would land in the future.
      if (startedAt > Date.now()) continue;
      const session: Session = {
        id: newId(),
        startedAt,
        endedAt: startedAt + (52 + week * 2) * 60 * 1000,
        notes: "",
        isDemo: true,
      };
      sessions.push(session);

      let order = 0;
      let setTime = startedAt + 5 * 60 * 1000;
      for (const entry of day.entries) {
        const lift = byName.get(entry.lift);
        if (!lift) continue;
        const topLb = entry.topLb[week];
        for (let s = 0; s < entry.sets; s++) {
          // First sets ramp up to the top set.
          const isTop = s === entry.sets - 1;
          const rampFactor = isTop ? 1 : 0.82 + 0.06 * s;
          const weightLb = lift.isBodyweight
            ? topLb // added load doesn't ramp
            : Math.round((topLb * rampFactor) / 5) * 5;
          sets.push({
            id: newId(),
            sessionId: session.id,
            liftId: lift.id,
            weightKg: lbToKg(weightLb),
            reps: entry.reps,
            rpe: isTop ? 8.5 : 7,
            note: "",
            orderIndex: order++,
            createdAt: setTime,
            isDemo: true,
          });
          setTime += 3 * 60 * 1000;
        }
      }
    }
  }

  // Derive PRs with the real pipeline, chronologically.
  sets.sort((a, b) => a.createdAt - b.createdAt);
  const prRows = [];
  const states = new Map<string, ReturnType<typeof buildPRState>>();
  const sessionVolumes = new Map<string, number>(); // `${sessionId}:${liftId}`
  for (const set of sets) {
    const lift = lifts.find((l) => l.id === set.liftId)!;
    let state = states.get(set.liftId);
    if (!state) {
      state = buildPRState([], lift, bodyweightKg);
      states.set(set.liftId, state);
    }
    const volKey = `${set.sessionId}:${set.liftId}`;
    const runningVolume =
      (sessionVolumes.get(volKey) ?? 0) + setVolumeKg(set, lift, bodyweightKg);
    sessionVolumes.set(volKey, runningVolume);
    const detected = detectPRs(set, lift, state, bodyweightKg, runningVolume);
    prRows.push(...toPRRows(detected, set, newId));
    advancePRState(state, set, lift, bodyweightKg, runningVolume);
  }

  const tx = db.transaction(["sessions", "sets", "prs", "kv"], "readwrite");
  for (const s of sessions) await tx.objectStore("sessions").put(s);
  for (const s of sets) await tx.objectStore("sets").put(s);
  for (const pr of prRows) await tx.objectStore("prs").put(pr);
  await tx.objectStore("kv").put(true, "demoDataSeeded");
  await tx.done;
}

let bootstrapPromise: Promise<void> | null = null;

/**
 * First launch: create the core lifts and load the labeled demo archive so
 * History/Analytics/3D demonstrate themselves. Runs exactly once — clearing
 * demo data afterwards never re-triggers it. Singleton-promised so every
 * caller in a tab awaits the SAME run; data hooks await this before reading.
 */
export function bootstrapOnFirstRun(): Promise<void> {
  bootstrapPromise ??= (async () => {
    const db = await getDB();
    const done = await db.get("kv", "bootstrapped");
    if (done) return;
    await ensureCoreLifts();
    await seedDemoData();
    await db.put("kv", true, "bootstrapped");
  })();
  return bootstrapPromise;
}

export async function hasSeededDemo(): Promise<boolean> {
  const db = await getDB();
  return Boolean(await db.get("kv", "demoDataSeeded"));
}

/** One-tap removal of everything demo-flagged. */
export async function clearDemoData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "sets", "prs", "kv"], "readwrite");
  for (const store of ["sessions", "sets", "prs"] as const) {
    const rows = await tx.objectStore(store).getAll();
    for (const row of rows) {
      if (row.isDemo) await tx.objectStore(store).delete(row.id);
    }
  }
  await tx.objectStore("kv").delete("demoDataSeeded");
  await tx.done;
}
