// Fixture SoundPort. Plays nothing (no real audio); keeps the smoke
// harness (Node, no window, no AudioContext) able to construct a full
// AdapterRegistry without touching a real audio API. Records what it was
// asked to play in `calls`, same reasoning as every other fixture that
// stands in for something a test needs to observe: a smoke test for the
// favSound personalisation wiring can assert on the shape of the last
// call (`quiet`, `favSound`) without needing a real AudioContext.
import type { SoundPort } from '../ports';

export interface FixtureSoundCall {
  quiet?: boolean;
  favSound?: string;
}

export function createFixtureSound(): SoundPort & { calls: FixtureSoundCall[] } {
  const calls: FixtureSoundCall[] = [];
  return {
    calls,
    playClick(opts) {
      calls.push({ quiet: opts?.quiet, favSound: opts?.favSound });
    },
  };
}
