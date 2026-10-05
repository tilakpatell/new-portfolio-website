// Deep space: everything out past the home system (the sun and the stations,
// layout.js). Pure numbers, so it's tested in Node: deepspace.js draws it,
// ship.js flies through it.
//
// The fandoms' planets are out here too, far apart (layout.js), and between
// them it's open: the ship's boost becomes a pulse drive, the ceiling lifts
// from the home system's 70 to DEEP.ceiling, and the edge of the map is
// DEEP.edge away. Near any place (the home system, a planet, a wonder) the
// drive drops back to the boost, so you arrive at flying speed. Among the
// planets are the wonders: a ringed gas giant and an ice giant, two other
// suns with planets of their own, a black hole, two nebulae to fly through,
// and the Citadel of Ricks. Everything but the nebulae is solid: graze it and
// you bounce off, hit it fast and you crash (and crash.js and the scene make
// something of it: the Citadel takes you to its world). The black hole is
// the exception: touch it at any speed and it has you, and you don't come
// back. What's on its far side (`beyond`) is a friend's universe, their own
// site, and the page goes on to it (Universe.jsx).

import { HOME_RADIUS, ORDER, POSITIONS, REACH } from './layout';
import { byId } from './universes';

export const DEEP = {
  system: HOME_RADIUS + 40, // inside this is the home system: boost tops out at SHIP.boost, the ceiling is SHIP.ceiling
  open: HOME_RADIUS + 440, // out past this (and this far from any place), the pulse drive's full speed and the full height
  near: 40, // how far past a place's reach you're still at it (the drive stays down)
  ramp: 400, // and how much further the drive takes to open all the way
  edge: 7000, // turned back here
  ceiling: 1150, // how far above or below the disc it can go out in deep space
};

// kind: what it is (deepspace.js draws each kind its own way); r: its radius
// (a black hole's is its shadow); colors: its own palette; planets (a sun's):
// each { r, orbit, angle, color, kind } round it, level with it; crew: whose
// universe it's from (it's there for everyone); world: the universe whose
// page a crash into it leads to; beyond (the black hole's): what's on its
// far side, { name, what, url }, where the page goes when the ship falls in
export const WONDERS = [
  { id: 'aurelia', kind: 'gas-giant', name: 'Aurelia', at: [-2230, 135, -2835], r: 140, ring: true, colors: ['#e9c592', '#b9814d', '#f5e6c8', '#8f5a35'] },
  { id: 'glacia', kind: 'ice-giant', name: 'Glacia', at: [3510, -235, 945], r: 80, colors: ['#8fd0ef', '#3f86c2', '#d8f2ff'] },
  {
    id: 'ember',
    kind: 'star',
    name: 'Ember',
    at: [1080, 305, 4320],
    r: 90,
    color: '#ff7a3c',
    planets: [
      { r: 22, orbit: 320, angle: 0.6, color: '#b0623c', kind: 'rock' },
      { r: 30, orbit: 520, angle: 3.4, color: '#6f86a0', kind: 'ocean' },
    ],
  },
  {
    id: 'halcyon',
    kind: 'star',
    name: 'Halcyon',
    at: [-4455, -370, 1890],
    r: 75,
    color: '#9cc4ff',
    planets: [
      { r: 18, orbit: 260, angle: 2.2, color: '#d9d3c4', kind: 'rock' },
      { r: 36, orbit: 450, angle: 5.1, color: '#c58fd8', kind: 'gas' },
    ],
  },
  {
    id: 'maw',
    kind: 'black-hole',
    name: 'The Maw',
    at: [4320, 200, -3510],
    r: 30,
    disk: 200,
    // on its far side: Shrey Pathak's portfolio, the Matrix (where Rick and Morty come out)
    beyond: { name: 'Shrey Pathak', what: 'the Matrix', url: 'https://shreyaanpathak.github.io/portfolio' },
  },
  { id: 'veil', kind: 'nebula', name: 'The Veil', at: [-2230, 505, 4725], r: 700, colors: ['#5b3fd1', '#d14f9a', '#3fb7d1'], solid: false },
  { id: 'cradle', kind: 'nebula', name: 'The Cradle', at: [4995, -505, 2230], r: 600, colors: ['#2f9e6b', '#c9d14f', '#2f6e9e'], solid: false },
  { id: 'citadel', kind: 'citadel', name: 'The Citadel', at: [1755, -135, -4660], r: 45, crew: 'rickmorty', world: 'rickmorty' },
];

// The trench run model (public/models/universe/trench.glb), as measured:
// its trench runs along x, 24.71 long, 6.6 wide (z −15…−8.4) and 7.1 deep
// (the rim at y 5.4, the floor at −1.7). trench.js lays it in the Death
// Star's trench (the Star Wars planet's, universes.js), `segments` sections
// all the way round (or `stretch` of them, if it says, centred on the side
// that faces home). (sunk a little into the surface, so its city blocks
// don't stand proud)
export const TRENCH_MODEL = { x: [-1.75, 22.96], z: [-15.0, -8.4], rim: 5.4, floor: -1.7, sink: 2.6 };

// a place's trench, in map units: how many sections to the ring, how many
// laid, scaled how much, how wide and deep its channel is, and the arc
// (either way round the place's middle from the way home) they cover
export function trenchOf(place) {
  const segments = place.trench.segments;
  const stretch = Math.min(place.trench.stretch ?? segments, segments);
  const scale = (2 * Math.PI * place.r) / segments / (TRENCH_MODEL.x[1] - TRENCH_MODEL.x[0]);
  const home = Math.atan2(-place.at[2], -place.at[0]);
  const arc = (stretch / segments) * Math.PI;
  return { segments, stretch, scale, width: (TRENCH_MODEL.z[1] - TRENCH_MODEL.z[0]) * scale, depth: (TRENCH_MODEL.rim + TRENCH_MODEL.sink - TRENCH_MODEL.floor) * scale, home, arc };
}

// the band a trench lets the ship into (ship.js): how far above and below
// the place's middle, how far in (the floor), and the arc it covers
export function trenchBand(place) {
  if (!place.trench) return null;
  const t = trenchOf(place);
  return { half: t.width / 2 - 0.3, floor: place.r - t.depth + 0.45, home: t.home, arc: t.arc };
}

// where a sun's planet is, in the map's space
export function planetAt(star, p) {
  return [star.at[0] + Math.cos(p.angle) * p.orbit, star.at[1], star.at[2] + Math.sin(p.angle) * p.orbit];
}

// how far a wonder's things reach out from its middle (its rings, its disk,
// its planets): nothing else is placed inside this
export function reachOf(w) {
  if (w.kind === 'star') return Math.max(w.r, ...w.planets.map((p) => p.orbit + p.r));
  if (w.kind === 'black-hole') return w.disk;
  if (w.ring) return w.r * 2.3;
  return w.r;
}

// what's solid out here, as ship.js's solids: { id, at, r, reach, swallow }.
// A black hole is solid out past its shadow, where the light bends round
// it, and it swallows: nothing bounces off it, whatever the speed (ship.js)
const solid = (id, at, r, swallow = false) => ({ id, at, r, reach: r * 1.4, deep: true, ...(swallow ? { swallow } : {}) });
export const DEEP_SOLIDS = WONDERS.filter((w) => w.solid !== false).flatMap((w) => [
  solid(w.id, w.at, w.kind === 'black-hole' ? w.r * 1.5 : w.r, w.kind === 'black-hole'),
  ...(w.planets ?? []).map((p, i) => solid(`${w.id}-${i + 1}`, planetAt(w, p), p.r)),
]);

export const wonderById = (id) => WONDERS.find((w) => w.id === id) ?? null;

// what's on the far side of the thing the ship fell into (the black hole's
// `beyond`: { name, what, url }), or null for anything you come back from
export const beyondOf = (id) => wonderById(id)?.beyond ?? null;

// every place there is to be at, out here and at home: the universes (the
// stations and the planets) and the wonders, each with how far it reaches
export const PLACES = [
  ...ORDER.map((id) => ({ id, at: POSITIONS[id], reach: REACH[id], kind: byId(id).kind === 'core' ? 'station' : 'planet' })),
  ...WONDERS.map((w) => ({ id: w.id, at: w.at, reach: reachOf(w), kind: w.kind })),
];
const far = PLACES.filter((p) => p.kind !== 'station'); // (the stations are the home system)

// the place nearest (x, y, z), and how far past its reach it is (negative: inside)
export function nearestPlace(x, y, z) {
  let best = null;
  for (const p of far) {
    const gap = Math.hypot(x - p.at[0], y - p.at[1], z - p.at[2]) - p.reach;
    if (!best || gap < best.gap) best = { place: p, gap };
  }
  const home = Math.hypot(x, z) - HOME_RADIUS;
  return home < best.gap ? { place: null, gap: home } : best;
}

// 0 at a place (the home system, a planet, a wonder: in its space you fly at
// the boost, under the home ceiling), rising smoothly to 1 out in the open
// between them (the pulse drive's full speed): how far it's opened up at
// (x, y, z)
export function openness(x, y, z) {
  const { gap } = nearestPlace(x, y, z);
  const k = Math.min(1, Math.max(0, (gap - DEEP.near) / DEEP.ramp));
  return k * k * (3 - 2 * k);
}
