// Middle-earth’s own look (components/worlds/looks.js), for the scenes in
// this folder: the bridge (./Bridge3D.js), Gorgoroth (./Gorgoroth3D.js), the
// ring (./Ring3D.js) and the map’s backdrop (./MapBackdrop3D.js). A folder
// holds one look, so this one is the bridge’s and Gorgoroth’s, and its why
// says where the ring and the backdrop differ. (The Shire, the towns and the
// rush have their own, in their folders.)
//
// The bloom: each scene keeps the numbers it was lit by (BLOOMS), under
// white, so the Balrog’s fire, the lava, the Eye’s beam and the Ring’s
// letters glow as they did; the house’s threshold of 1 wants those lifted
// with lib/stage3d’s hot() and looked at on a real GPU first.

import { BLOOM } from '../../lib/three/bloom';

export const BLOOMS = Object.freeze({
  bridge: { strength: 0.7, radius: 0.55, threshold: 0.9 },
  gorgoroth: { strength: 0.65, radius: 0.5, threshold: 0.9 },
  ring: { strength: 0.55, radius: 0.5, threshold: 0.92 },
});

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: BLOOM,
  why: {
    art: 'the ring is its own: one gold band and its fire-letters, all metal, drawn as itself',
    tone: 'the map’s backdrop is a painted sheet on a table under window light or a candle: its paint is the picture, so it keeps its own tone (ACES, exposure 1.15) rather than the house’s',
    bloom: 'the bridge, Gorgoroth and the ring draw with their own bloom (BLOOMS), thresholds 0.9 to 0.92, until their glows are lifted over white with hot()',
  },
};
