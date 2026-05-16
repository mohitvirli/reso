/**
 * IndexedDB persistence for analysis results.
 * Keyed by SHA-256 of file bytes — survives page reloads.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AnalysisResult } from "./client";

interface ResoDB extends DBSchema {
  analyses: {
    key: string;
    value: AnalysisRecord;
  };
}

export interface AnalysisRecord extends AnalysisResult {
  hash: string;
  createdAt: number;
}

const DB_NAME = "reso-analysis-cache";
const DB_VERSION = 1;
const STORE = "analyses";

let dbPromise: Promise<IDBPDatabase<ResoDB>> | null = null;

/**
 * One-time cleanup of an earlier, broken DB name from prior dev iterations.
 * Safe no-op if it doesn't exist.
 */
let legacyCleaned = false;
function cleanupLegacy(): void {
  if (legacyCleaned || typeof indexedDB === "undefined") return;
  legacyCleaned = true;
  try {
    indexedDB.deleteDatabase("reso");
  } catch {
    /* ignore */
  }
}

function getDB(): Promise<IDBPDatabase<ResoDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  cleanupLegacy();
  if (!dbPromise) {
    dbPromise = openDB<ResoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function getCachedAnalysis(
  hash: string
): Promise<AnalysisRecord | null> {
  try {
    const db = await getDB();
    return (await db.get(STORE, hash)) ?? null;
  } catch (err) {
    console.warn("[analysis-cache] read failed", err);
    return null;
  }
}

export async function putCachedAnalysis(
  hash: string,
  result: AnalysisResult
): Promise<void> {
  const db = await getDB();
  const record: AnalysisRecord = {
    ...result,
    hash,
    createdAt: Date.now(),
  };
  await db.put(STORE, record, hash);
}

