// Real StoragePort adapter — IndexedDB. F.001.
// See plan/engineering/TECH-DECISIONS.md "Local persistent storage".
//
// Deliberately dumb: a single object store keyed by string, storing whatever
// JSON-serialisable value is given. All domain logic (profiles, sessions,
// question cards) lives one layer up in src/engine/profileStore.ts — this
// file only knows about get/set/delete, per StoragePort.

import type { StoragePort } from '../ports';

const DB_NAME = 'app-guide-v3';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error as Error);
  });
}

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export function createIndexedDbStorage(): StoragePort {
  // Best-effort persistence request. Safari evicts IndexedDB after ~7 days
  // without site interaction — this reduces (never eliminates) that risk.
  // See TECH-DECISIONS.md "Local persistent storage".
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    void navigator.storage.persist();
  }

  return {
    async get<T>(key: string) {
      const db = await getDb();
      return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error as Error);
      });
    },

    async set<T>(key: string, value: T) {
      const db = await getDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
      });
    },

    async delete(key: string) {
      const db = await getDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
      });
    },
  };
}
