// Fixture VisionPort. Returns a small canned set of TaggedCrops so Game 1
// (F.008) and the lookup table (F.007) can be built and demoed before
// F.006's real ClaudeVision adapter exists. Also the §11 API-outage fallback.
import type { TaggedCrop } from '../../types';
import type { VisionPort } from '../ports';

const FIXTURE_CROPS: TaggedCrop[] = [
  {
    id: 'fixture-cup',
    name: 'cup',
    colour: 'red',
    category: 'drinkware',
    function: 'you drink from it',
    bbox: { x: 40, y: 60, width: 120, height: 140 },
    image: '',
  },
  {
    id: 'fixture-ball',
    name: 'ball',
    colour: 'blue',
    category: 'toy',
    function: 'you play with it',
    bbox: { x: 220, y: 90, width: 100, height: 100 },
    image: '',
  },
  {
    id: 'fixture-shoe',
    name: 'shoe',
    colour: 'white',
    category: 'clothing',
    function: 'you wear it',
    bbox: { x: 360, y: 200, width: 130, height: 90 },
    image: '',
  },
];

export function createFixtureVision(): VisionPort {
  return {
    async recognizeObjects() {
      return FIXTURE_CROPS;
    },
  };
}
