// The Death Star’s look (components/worlds/looks.js), for the scenes in
// this folder: the station over the page’s hero (./DeathStar3D.js) and the
// trench run (./Trench3D.js). (Aboard it has its own, in ./inside.)
//
// Its own art: the plating, the trench’s walls, catwalks and turrets, the
// TIEs and the beam are drawn in code, with one model (the X-wing).
//
// The house’s tone: houseOn maps both Neutral at their exposure of 1.05
// times the house’s 1.4 (what ACES lifted mid-grey by), so they are as
// bright as under the ACES they were first lit with. The bloom: each scene
// keeps the numbers it was lit by (BLOOMS), under white, so the beam, the
// lasers, the engines and the fire glow as they did; the house’s threshold
// of 1 wants those lifted with hot() and looked at on a real GPU first.

import { BLOOM } from '../../lib/three/bloom';

export const BLOOMS = Object.freeze({
  station: Object.freeze({ strength: 0.55, radius: 0.55, threshold: 0.85 }),
  trench: Object.freeze({ strength: 0.7, radius: 0.38, threshold: 0.9 }),
});

export const LOOK = {
  art: 'own',
  tone: 'house',
  bloom: BLOOM,
  why: {
    art: 'drawn in code: the plating, the trench and its catwalks and turrets, the TIEs, the beam; one model, the X-wing',
    bloom: 'the station and the trench draw with their own bloom (BLOOMS), thresholds 0.85 and 0.9, until their glows are lifted over white with hot()',
  },
};
