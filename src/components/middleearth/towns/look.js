// The twelve towns’ look (components/worlds/looks.js): scanned. The core
// kit’s sets and the towns’ own props, dressed (lib/three/core) under the
// house look (lib/three/house: Neutral, the house shade), as the Shire is.
//
// The bloom: each town keeps the numbers it was lit by (BLOOMS), under
// white, so its lamps, torches, the Phial, the Eye and the beacons glow as
// they did. The house’s (a threshold of 1, emissives lifted with
// lib/stage3d’s hot()) wants each town’s glows lifted one by one and looked
// at on a real GPU; until then a sunlit wall that is bright enough glows a
// little too, as it always has.

import { BLOOM } from '../../../lib/three/bloom';

export const BLOOMS = Object.freeze({
  amonhen: { strength: 0.55, radius: 0.55, threshold: 0.85 },
  bree: { strength: 0.62, radius: 0.5, threshold: 0.86 },
  cirithungol: { strength: 0.8, radius: 0.6, threshold: 0.8 },
  doom: { strength: 0.8, radius: 0.6, threshold: 0.8 },
  edoras: { strength: 0.6, radius: 0.5, threshold: 0.86 },
  lorien: { strength: 0.7, radius: 0.6, threshold: 0.8 },
  marshes: { strength: 0.7, radius: 0.6, threshold: 0.8 },
  minastirith: { strength: 0.7, radius: 0.5, threshold: 0.85 },
  moria: { strength: 0.85, radius: 0.6, threshold: 0.78 },
  orthanc: { strength: 0.85, radius: 0.55, threshold: 0.82 },
  rivendell: { strength: 0.55, radius: 0.55, threshold: 0.86 },
  weathertop: { strength: 0.7, radius: 0.55, threshold: 0.82 },
});

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: BLOOM,
  why: {
    bloom: 'each town draws with its own bloom (BLOOMS), thresholds 0.78 to 0.86, until its glows are lifted over white with hot()',
  },
};
