// The rush’s look (components/worlds/looks.js): scanned, as the Shire is.
// The kitchen is built from the Shire’s timber, plaster and stone
// (../shire/props) under the house look (lib/three/house, its exposure kept).
//
// The bloom keeps the numbers the kitchen was lit by (RUSH_BLOOM), a
// threshold of 0.9, so the stoves, the ovens’ mouths and the working rings
// glow as they did; the house’s threshold of 1 wants them lifted further
// with hot() and looked at on a real GPU first.

import { BLOOM } from '../../../lib/three/bloom';

export const RUSH_BLOOM = Object.freeze({ strength: 0.5, radius: 0.45, threshold: 0.9 });

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: BLOOM,
  why: {
    bloom: 'the kitchen draws with its own bloom (RUSH_BLOOM, a threshold of 0.9) until its fires are lifted over white with hot()',
  },
};
