// In-memory StoragePort. Nothing persists across a reload — useful for
// tests and for building screens before F.001's real IndexedDbStorage
// adapter exists. Swap the registry line in adapters/registry.ts to switch.
import type { StoragePort } from '../ports';

export function createInMemoryStorage(): StoragePort {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}
