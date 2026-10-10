// The Shire’s look (components/worlds/looks.js): scanned. The core kit’s
// sets (./dress.js) under the house look, as was asked of it; its shade
// colour follows the hour (./sky.js’s moods), so the look names none. The
// house bloom: the lamps, the lanterns and the fireworks are lifted over
// white to glow, and a sunlit wall is not.

import { BLOOM } from '../../../lib/three/bloom';

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: BLOOM,
  why: {},
};
