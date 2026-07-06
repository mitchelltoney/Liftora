import type { DBSchema, IDBPDatabase } from "idb";
import type { Lift, PR, Session, SetEntry } from "../types";

// Historical name kept so pre-rename local data survives the Liftora rebrand.
export const DB_NAME = "aetherforge";
export const DB_VERSION = 1;

/**
 * Versioned IndexedDB schema.
 *
 * kv holds prefs, the active-session pointer, and one-time flags — small,
 * schemaless keys that don't merit their own stores.
 */
export interface AetherForgeDB extends DBSchema {
  lifts: {
    key: string;
    value: Lift;
  };
  sessions: {
    key: string;
    value: Session;
    indexes: { "by-startedAt": number };
  };
  sets: {
    key: string;
    value: SetEntry;
    indexes: {
      "by-session": string;
      "by-lift": string;
      "by-lift-time": [string, number];
    };
  };
  prs: {
    key: string;
    value: PR;
    indexes: { "by-lift": string; "by-time": number };
  };
  kv: {
    key: string;
    value: unknown;
  };
}

export type AFDatabase = IDBPDatabase<AetherForgeDB>;

/**
 * Migration ladder. Each case builds the delta from that version to the
 * next; fallthrough applies them in order so any old version reaches
 * DB_VERSION. Add `case 1:` (v1 → v2) below when the schema next changes.
 */
export function migrate(
  db: IDBPDatabase<AetherForgeDB>,
  oldVersion: number,
): void {
  switch (oldVersion) {
    case 0: {
      db.createObjectStore("lifts", { keyPath: "id" });

      const sessions = db.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("by-startedAt", "startedAt");

      const sets = db.createObjectStore("sets", { keyPath: "id" });
      sets.createIndex("by-session", "sessionId");
      sets.createIndex("by-lift", "liftId");
      sets.createIndex("by-lift-time", ["liftId", "createdAt"]);

      const prs = db.createObjectStore("prs", { keyPath: "id" });
      prs.createIndex("by-lift", "liftId");
      prs.createIndex("by-time", "achievedAt");

      db.createObjectStore("kv");
    }
    // falls through
  }
}
