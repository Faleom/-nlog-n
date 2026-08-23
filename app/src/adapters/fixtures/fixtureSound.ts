// Fixture SoundPort. No-op — plays nothing. Keeps the smoke harness (Node,
// no window, no AudioContext) able to construct a full AdapterRegistry
// without touching a real audio API.
import type { SoundPort } from '../ports';

export function createFixtureSound(): SoundPort {
  return {
    playClick() {
      // intentionally silent
    },
  };
}
