import {
  advancePRState,
  buildPRState,
  detectPRs,
  toPRRows,
} from "../analytics/pr";
import { setVolumeKg } from "../analytics/volume";
import { newId } from "../ids";
import {
  DEFAULT_PREFS,
  type Lift,
  type PR,
  type Prefs,
  type Session,
  type SetEntry,
} from "../types";
import { getDB } from "./db";

const KV_PREFS = "prefs";
const KV_ACTIVE_SESSION = "activeSessionId";

// ---------------------------------------------------------------- prefs ----

export async function getPrefs(): Promise<Prefs> {
  const db = await getDB();
  const stored = (await db.get("kv", KV_PREFS)) as Partial<Prefs> | undefined;
  return { ...DEFAULT_PREFS, ...stored };
}

export async function setPrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const db = await getDB();
  const next = { ...(await getPrefs()), ...patch };
  await db.put("kv", next, KV_PREFS);
  return next;
}

// ---------------------------------------------------------------- lifts ----

export async function getAllLifts(): Promise<Lift[]> {
  const db = await getDB();
  const lifts = await db.getAll("lifts");
  return lifts.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getLift(id: string): Promise<Lift | undefined> {
  const db = await getDB();
  return db.get("lifts", id);
}

export async function addLift(
  lift: Omit<Lift, "id" | "createdAt">,
): Promise<Lift> {
  const db = await getDB();
  const row: Lift = { ...lift, id: newId(), createdAt: Date.now() };
  await db.put("lifts", row);
  return row;
}

export async function putLift(lift: Lift): Promise<void> {
  const db = await getDB();
  await db.put("lifts", lift);
}

// ------------------------------------------------------------- sessions ----

export async function getActiveSession(): Promise<Session | null> {
  const db = await getDB();
  const id = (await db.get("kv", KV_ACTIVE_SESSION)) as string | undefined;
  if (!id) return null;
  const session = await db.get("sessions", id);
  if (!session || session.endedAt !== null) {
    await db.delete("kv", KV_ACTIVE_SESSION);
    return null;
  }
  return session;
}

/** Start a session, or resume the existing live one (survives reloads). */
export async function startOrResumeSession(): Promise<Session> {
  const existing = await getActiveSession();
  if (existing) return existing;
  const db = await getDB();
  const session: Session = {
    id: newId(),
    startedAt: Date.now(),
    endedAt: null,
    notes: "",
  };
  const tx = db.transaction(["sessions", "kv"], "readwrite");
  await tx.objectStore("sessions").put(session);
  await tx.objectStore("kv").put(session.id, KV_ACTIVE_SESSION);
  await tx.done;
  return session;
}

export async function endSession(
  sessionId: string,
  notes = "",
): Promise<Session> {
  const db = await getDB();
  const session = await db.get("sessions", sessionId);
  if (!session) throw new Error(`No session ${sessionId}`);
  const ended: Session = { ...session, endedAt: Date.now(), notes };
  const tx = db.transaction(["sessions", "kv"], "readwrite");
  await tx.objectStore("sessions").put(ended);
  await tx.objectStore("kv").delete(KV_ACTIVE_SESSION);
  await tx.done;
  return ended;
}

/** Discard a live session and everything logged in it. */
export async function discardSession(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "sets", "prs", "kv"], "readwrite");
  const sets = await tx.objectStore("sets").index("by-session").getAllKeys(sessionId);
  for (const key of sets) await tx.objectStore("sets").delete(key);
  const allPRs = await tx.objectStore("prs").getAll();
  for (const pr of allPRs) {
    if (pr.sessionId === sessionId) await tx.objectStore("prs").delete(pr.id);
  }
  await tx.objectStore("sessions").delete(sessionId);
  const activeId = (await tx.objectStore("kv").get(KV_ACTIVE_SESSION)) as
    | string
    | undefined;
  if (activeId === sessionId) await tx.objectStore("kv").delete(KV_ACTIVE_SESSION);
  await tx.done;
}

export async function getCompletedSessions(): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessions", "by-startedAt");
  return all.filter((s) => s.endedAt !== null);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get("sessions", id);
}

// ----------------------------------------------------------------- sets ----

export async function getSetsForSession(sessionId: string): Promise<SetEntry[]> {
  const db = await getDB();
  const sets = await db.getAllFromIndex("sets", "by-session", sessionId);
  return sets.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function getSetsForLift(liftId: string): Promise<SetEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("sets", "by-lift", liftId);
}

export async function getAllSets(): Promise<SetEntry[]> {
  const db = await getDB();
  return db.getAll("sets");
}

export interface SaveSetResult {
  set: SetEntry;
  prs: PR[];
}

/**
 * Save a set and detect PRs atomically.
 *
 * History = all sets for the lift from OTHER sessions (the live session
 * competes against the past, not itself; within-session escalation is
 * handled by comparing against already-saved live sets via advancePRState).
 */
export async function saveSet(input: {
  sessionId: string;
  liftId: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  note?: string;
}): Promise<SaveSetResult> {
  const db = await getDB();
  const lift = await db.get("lifts", input.liftId);
  if (!lift) throw new Error(`No lift ${input.liftId}`);
  const prefs = await getPrefs();

  const liftSets = await getSetsForLift(input.liftId);
  const historical = liftSets.filter((s) => s.sessionId !== input.sessionId);
  const liveSets = liftSets
    .filter((s) => s.sessionId === input.sessionId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const sessionSets = await getSetsForSession(input.sessionId);
  const nextOrder =
    sessionSets.length === 0
      ? 0
      : Math.max(...sessionSets.map((s) => s.orderIndex)) + 1;

  const set: SetEntry = {
    id: newId(),
    sessionId: input.sessionId,
    liftId: input.liftId,
    weightKg: input.weightKg,
    reps: input.reps,
    rpe: input.rpe,
    note: input.note ?? "",
    orderIndex: nextOrder,
    createdAt: Date.now(),
  };

  // Fold the live session's earlier sets into the comparison state so a
  // record set twice in one session only celebrates once.
  const state = buildPRState(historical, lift, prefs.bodyweightKg);
  let runningVolume = 0;
  for (const prior of liveSets) {
    runningVolume += setVolumeKg(prior, lift, prefs.bodyweightKg);
    advancePRState(state, prior, lift, prefs.bodyweightKg, runningVolume);
  }
  runningVolume += setVolumeKg(set, lift, prefs.bodyweightKg);

  const detected = detectPRs(set, lift, state, prefs.bodyweightKg, runningVolume);
  const prRows = toPRRows(detected, set, newId);

  const tx = db.transaction(["sets", "prs"], "readwrite");
  await tx.objectStore("sets").put(set);
  for (const pr of prRows) await tx.objectStore("prs").put(pr);
  await tx.done;

  return { set, prs: prRows };
}

export async function deleteSet(setId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sets", "prs"], "readwrite");
  await tx.objectStore("sets").delete(setId);
  // PRs earned by this set are no longer substantiated.
  const prs = await tx.objectStore("prs").getAll();
  for (const pr of prs) {
    if (pr.setEntryId === setId) await tx.objectStore("prs").delete(pr.id);
  }
  await tx.done;
}

/**
 * Persist a drag-reorder. `orderedSetIds` may be a SUBSET of the session's
 * sets (the per-lift list): the subset keeps the orderIndex slots it already
 * occupied, reassigned in the new order, so other lifts' sets are untouched.
 */
export async function reorderSets(
  sessionId: string,
  orderedSetIds: string[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("sets", "readwrite");
  const store = tx.objectStore("sets");
  const subset: SetEntry[] = [];
  for (const id of orderedSetIds) {
    const set = await store.get(id);
    if (set && set.sessionId === sessionId) subset.push(set);
  }
  const slots = subset.map((s) => s.orderIndex).sort((a, b) => a - b);
  const byId = new Map(subset.map((s) => [s.id, s]));
  let slot = 0;
  for (const id of orderedSetIds) {
    const set = byId.get(id);
    if (!set) continue;
    await store.put({ ...set, orderIndex: slots[slot] });
    slot++;
  }
  await tx.done;
}

// ------------------------------------------------------------------ PRs ----

export async function getPRsForLift(liftId: string): Promise<PR[]> {
  const db = await getDB();
  return db.getAllFromIndex("prs", "by-lift", liftId);
}

export async function getAllPRs(): Promise<PR[]> {
  const db = await getDB();
  return db.getAllFromIndex("prs", "by-time");
}
