// Fixture SpeechOutPort. No-op — resolves immediately, says nothing.
// Useful for tests and for a silent build. Real adapter (F.010's audio work)
// uses the Web Speech API — see engineering/TECH-DECISIONS.md § Audio.
import type { SpeechOutPort } from '../ports';

export function createFixtureSpeechOut(): SpeechOutPort {
  return {
    async say() {
      // intentionally silent
    },
  };
}
