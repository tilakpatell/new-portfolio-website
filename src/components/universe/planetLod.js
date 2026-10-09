// What a body on the universe map draws for its size on screen. Across the
// map most of the bodies are a few pixels tall, and each was drawn whole all
// the same: its sphere, its marched shell of air, its clouds, the models on
// its orbits and its props, all of them moving every frame. So under 24
// pixels a body shows its sphere and its halo only (no shell, clouds, props
// or models, and none of its own motion: planets.js's setLod), and under 6
// it isn't drawn at all, farPlaces.js's point of light standing in for it
// however near it is (only for what farPlaces lights: the stations never go
// below their halo). Each step back up is taken a tenth past its threshold,
// so a body on the edge doesn't flicker between the two; and the light fades
// out over the first half again above 6 pixels, under the body drawn again.
// Pure: no three.js, no page.
//
//   pxOf(radius, distance, fovYDeg, viewportH) → its height on screen, px
//       (Infinity with the camera at it or in it)
//   lodOf(px, was = null) → 'full' | 'halo' | 'hidden'
//   standIn(px, lod) → how much farPlaces' light stands in for it, 0 … 1
//   segOf(level, small) → [w, h], its sphere's segments at lib/detail's level

import { seg } from '../../lib/detail';

export const HALO_PX = 24; // under this, its halo only
export const HIDDEN_PX = 6; // under this, its light instead
const HOLD = 0.1; // (a step back up is taken this much past its threshold)
const FADE = 1.5; // (the light gone by this many times HIDDEN_PX)
const RANK = { hidden: 0, halo: 1, full: 2 };

export function pxOf(radius, distance, fovYDeg, viewportH) {
  if (!(distance > radius)) return Infinity;
  return (radius / (distance * Math.tan((fovYDeg * Math.PI) / 360))) * viewportH;
}

export function lodOf(px, was = null) {
  // (the threshold up into a level above the one it was at is a tenth higher)
  const edge = (px0, rank) => (was && RANK[was] < rank ? px0 * (1 + HOLD) : px0);
  return px >= edge(HALO_PX, 2) ? 'full' : px >= edge(HIDDEN_PX, 1) ? 'halo' : 'hidden';
}

export function standIn(px, lod) {
  if (lod === 'hidden') return 1;
  const t = Math.min(1, Math.max(0, (px - HIDDEN_PX) / (HIDDEN_PX * (FADE - 1))));
  return 1 - t * t * (3 - 2 * t);
}

// 64 × 40 round a desktop's sphere and 44 × 28 round a phone's: what the
// screen needs for the limb to read as a curve from where a ship parks
// without a finer sphere (nearMaps.js's, which low and a phone never get),
// so lib/detail's seg only adds to it (twice at ultra), never takes away
export function segOf(level, small = false) {
  const [w, h] = small ? [44, 28] : [64, 40];
  return [seg(w, { level, min: w }), seg(h, { level, min: h })];
}
