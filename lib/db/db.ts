import { openDB } from "idb";
import { DB_NAME, DB_VERSION, migrate, type AFDatabase } from "./schema";

let dbPromise: Promise<AFDatabase> | null = null;

/** Singleton connection. Browser-only — callers live behind "use client". */
export function getDB(): Promise<AFDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is unavailable in this environment"),
    );
  }
  dbPromise ??= openDB<import("./schema").AetherForgeDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      migrate(db, oldVersion);
    },
    blocked() {
      // Another tab holds an old connection during upgrade; nothing to do —
      // idb resolves once it closes.
    },
    blocking() {
      // A newer version wants to upgrade in another tab; release our handle.
      void dbPromise?.then((db) => db.close());
      dbPromise = null;
    },
  });
  return dbPromise;
}

/** Test hook: drop the cached connection (fake-indexeddb resets between tests). */
export function __resetDBForTests(): void {
  dbPromise = null;
}
