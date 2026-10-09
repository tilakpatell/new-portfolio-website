// The HQ games’ look (components/worlds/looks.js): scanned, physically
// based materials and the HQ’s sky under the house look (hq/engine.js:
// Neutral through houseOn). The engine’s default bloom is the house’s
// (lib/three/bloom); every HQ game passes the numbers it was lit by, in its
// own folder, and none draws with this default today.

import { BLOOM } from '../../../lib/three/bloom';

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: BLOOM,
  why: {},
};
