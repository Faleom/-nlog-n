// Fixture RedactionPort. Identity — returns the image unchanged. Fine for
// fixture flows where FixtureFaceDetect already returns zero regions.
import type { RedactionPort } from '../ports';

export function createFixtureRedaction(): RedactionPort {
  return {
    async redactRegions(image) {
      return image;
    },
  };
}
