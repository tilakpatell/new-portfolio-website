// The worlds you can land on, from the ground: one site for each of the
// galaxy's systems with a planet you can stand on (Alderaan's gone; the
// rest are all here). A site is data: the scene (surface/scene.js) builds
// it, the page (pages/GalaxySurface.jsx) names it, and the tests check it.
//
//   place, line    where you've come down, and a line about it
//   sky            sky.js's: the colours, the sun or suns, clouds, stars,
//                  what hangs in the sky
//   fog            { color, density } (exponential: thick or thin air)
//   light          { sun, second?, sky, ground, ambient }: the sun's
//                  strength (and a second sun's), the sky's and the
//                  ground's colours for the light from all round
//   ground         terrain.js's layers and flats, ground.js's palette;
//                  wind (radians) for ripples and blowing sand
//   water          { level, color, deep, kind: sea | swamp | lava | salt |
//                  clouds, wade? } or left out
//   weather        weather.js's: [{ kind, count? }]
//   land           { at: [x, z], yaw }: where your ship sets down
//   places         what there is to find: { id, name, at, r (you've found
//                  it within this), about, flat? { r, h?, edge? }, pits?
//                  [{ at, r, depth, cone? }] (relative to it), things
//                  (placed relative to it) }
//   things         placed things (placer.js's specs), at world positions
//   scatter        [{ kind, n, within: [r0, r1], scale: [a, b], solid?,
//                  opts?, flat? (on level ground only) }]
//   life           actors.js's
//   rides          [{ kind (rides.js's), at, yaw }]
//   flyovers       [{ kind (a galaxy ship), n, metres, alt, speed, every }]
//   skyships       [{ kind, metres, at: [x, y, z], yaw }]: hanging in the sky
//   floors         walker.js's, over the land (platforms, walkways)
//   reach          how far you can go (terrain.js's REACH unless said)
//   fall           a world with nothing under its floors (Bespin, Coruscant,
//                  Kamino): how far down counts as falling off

import { SYSTEMS } from '../../systems';
import { REACH } from '../terrain';
import { SITES as desert } from './desert';
import { SITES as ice } from './ice';
import { SITES as forest } from './forest';
import { SITES as core } from './core';
import { SITES as edge } from './edge';

export const SITES = { ...desert, ...ice, ...forest, ...core, ...edge };

// the systems with somewhere to land, in the galaxy's own order
export const LANDABLE = SYSTEMS.filter((s) => SITES[s.id]).map((s) => s.id);
export const canLand = (id) => Boolean(SITES[id]);

const turn = ([x, z], yaw = 0) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];

// A site made whole: its places' things and pits moved to where the places
// are, its flats gathered (the landing spot's, each place's, each pit), and
// what's left out filled in.
export function siteOf(id) {
  const raw = SITES[id];
  if (!raw) return null;
  const sys = SYSTEMS.find((s) => s.id === id);
  const places = (raw.places ?? []).map((p) => ({
    ...p,
    things: (p.things ?? []).map((t) => ({ ...t, at: plus(p.at, turn(t.at, p.yaw)), yaw: (t.yaw ?? 0) + (p.yaw ?? 0), place: p.id })),
    pits: (p.pits ?? []).map((q) => ({ ...q, at: plus(p.at, turn(q.at, p.yaw)) })),
  }));
  const land = { at: [0, 0], yaw: 0, ...raw.land };
  const flats = [
    ...(raw.ground.flats ?? []),
    { at: land.at, r: raw.land?.r ?? 26, edge: 22, h: raw.land?.h },
    ...places.filter((p) => p.flat).map((p) => ({ at: p.at, r: p.flat.r, edge: p.flat.edge, h: p.flat.h })),
  ];
  const pits = places.flatMap((p) => p.pits);
  return {
    id,
    name: sys?.name ?? id,
    accent: sys?.accent ?? '#ffffff',
    reach: REACH,
    weather: [],
    things: [],
    scatter: [],
    life: [],
    rides: [],
    flyovers: [],
    skyships: [],
    floors: [],
    ...raw,
    land,
    places,
    ground: { ...raw.ground, flats, pits },
    things_all: [...(raw.things ?? []), ...places.flatMap((p) => p.things)],
  };
}
