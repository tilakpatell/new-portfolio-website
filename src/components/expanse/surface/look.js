// The Expanse’s look (components/worlds/looks.js): painted. Its land takes
// the seed’s colours (lib/three/landmap); what the world builds in code
// (the trees’ crowns and bark, the crates, the barrels, the buggy) takes
// these, from one strip (lib/three/palette), so the crates and the buggy
// share one material. No scan, no ramp: the house look over flat colour.
//
//   LOOK → the look; PAINT → each thing’s cell on the strip

import { BLOOM } from '../../../lib/three/bloom.js';

export const PAINT = { crown: 0, crownLit: 1, bark: 2, crate: 3, barrel: 4, body: 5, cab: 6, dark: 7 };

export const LOOK = {
  art: 'painted',
  palette: ['#b4b536', '#d8cf3b', '#6b4a32', '#b98a4e', '#3f6a8a', '#d8572a', '#f2e6c9', '#2a2a2a'],
  tone: 'house',
  bloom: BLOOM,
  why: {},
};
