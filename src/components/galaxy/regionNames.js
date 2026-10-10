// The regions' names on the galaxy map (HoloMap.jsx): each is set along its
// ring at its own angle (so the names spread round the core rather than stand
// in a column), 11.5 px on screen at any zoom, and shown only when it has the
// room there: the ring's wide enough for the name to lie along it, and clear
// of the ring inside it. The inner rings are only about a name's height apart
// when the map's fitted, so their names come in as you zoom; the Unknown
// Regions' is kept in off the map's edge. Pure, tested.
//
// regionNamesShown(regions, unitPx, angleFor?, fontPx?) → a Set of the ids
// of the regions (REGIONS, the Deep Core first, which has no name) whose
// names have room at unitPx screen pixels to a map unit;
// regionAngle(i) → the angle (radians, north −π/2) the name of regions[i] is
// at; unknownNameX(unitPx, fontPx?) → where in map units the Unknown Regions'
// name is centred.

import { CORE, edgeAt } from './systems';

export const REGION_FONT = 11.5;
const ANGLES = [-90, -112, -68, -132, -48, -150]; // (degrees round the core, north is −90: the names apart)
const GLYPH = 0.62; // (a mono letter's width in em, near enough; the names are in capitals)
export const LETTER_SPACING = 0.18; // (em between the letters of a name along a ring: HoloMap.jsx sets it; the Unknown Regions' has none)
const RING_GLYPH = GLYPH + LETTER_SPACING; // (a letter along a ring with the space after it)
const EDGE = 18; // (px the Unknown Regions' name keeps off the map's edge: clear of the grid's row numbers)

export const regionAngle = (i) => (ANGLES[(i - 1) % ANGLES.length] * Math.PI) / 180;

export function regionNamesShown(regions, unitPx, angleFor = regionAngle, fontPx = REGION_FONT) {
  const shown = new Set();
  if (!(unitPx > 0)) return shown;
  regions.forEach((r, i) => {
    if (i === 0) return;
    const a = angleFor(i);
    const here = edgeAt(r.r, a) * unitPx;
    const gap = here - edgeAt(regions[i - 1].r, a) * unitPx;
    // (the name lies along the ring, so it wants the ring's width, its letters spaced; and a name's height and a half from the ring inside)
    if (here >= 0.9 * r.name.length * fontPx * RING_GLYPH && gap >= 1.4 * fontPx) shown.add(r.id);
  });
  return shown;
}

// out west, as it's always been, centred where it fits: from EDGE px in on a small map
export function unknownNameX(unitPx, fontPx = REGION_FONT) {
  const home = CORE[0] - 9.3;
  if (!(unitPx > 0)) return home;
  return Math.max(home, (EDGE + ('Unknown Regions'.length * fontPx * GLYPH) / 2) / unitPx);
}
