import type { Lift, PR, Prefs, Session, SetEntry } from "../types";
import { DB_VERSION } from "./schema";
import { getDB, } from "./db";
import { getPrefs } from "./repo";

/**
 * Full-database export/import. A lifter's history must never be trapped:
 * the export is complete, versioned, and re-importable losslessly.
 */
export interface ExportFile {
  app: "liftora";
  schemaVersion: number;
  exportedAt: string;
  lifts: Lift[];
  sessions: Session[];
  sets: SetEntry[];
  prs: PR[];
  prefs: Prefs;
}

export async function exportAll(): Promise<ExportFile> {
  const db = await getDB();
  const [lifts, sessions, sets, prs, prefs] = await Promise.all([
    db.getAll("lifts"),
    db.getAll("sessions"),
    db.getAll("sets"),
    db.getAll("prs"),
    getPrefs(),
  ]);
  return {
    app: "liftora",
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    lifts,
    sessions,
    sets,
    prs,
    prefs,
  };
}

export class ImportError extends Error {}

function assertArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new ImportError(`Invalid export file: "${field}" is not an array`);
  }
}

/** Structural validation — enough to reject the wrong file, not a full schema. */
export function parseExportFile(json: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ImportError("Not valid JSON");
  }
  if (typeof data !== "object" || data === null) {
    throw new ImportError("Invalid export file: not an object");
  }
  const record = data as Record<string, unknown>;
  // Accept legacy exports written before the Liftora rename.
  if (record.app !== "liftora" && record.app !== "aetherforge") {
    throw new ImportError("Not a Liftora export file");
  }
  if (typeof record.schemaVersion !== "number") {
    throw new ImportError("Invalid export file: missing schemaVersion");
  }
  if (record.schemaVersion > DB_VERSION) {
    throw new ImportError(
      `Export is from a newer app version (schema ${record.schemaVersion} > ${DB_VERSION}) — update Liftora first`,
    );
  }
  assertArray(record.lifts, "lifts");
  assertArray(record.sessions, "sessions");
  assertArray(record.sets, "sets");
  assertArray(record.prs, "prs");
  if (typeof record.prefs !== "object" || record.prefs === null) {
    throw new ImportError('Invalid export file: missing "prefs"');
  }
  return record as unknown as ExportFile;
}

/** Replace the entire database with the export's contents (atomic). */
export async function importAll(file: ExportFile): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["lifts", "sessions", "sets", "prs", "kv"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("lifts").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("sets").clear(),
    tx.objectStore("prs").clear(),
    tx.objectStore("kv").clear(),
  ]);
  for (const lift of file.lifts) await tx.objectStore("lifts").put(lift);
  for (const session of file.sessions) {
    await tx.objectStore("sessions").put(session);
  }
  for (const set of file.sets) await tx.objectStore("sets").put(set);
  for (const pr of file.prs) await tx.objectStore("prs").put(pr);
  await tx.objectStore("kv").put(file.prefs, "prefs");
  await tx.done;
}
