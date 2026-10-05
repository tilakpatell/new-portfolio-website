// Deep space: everything out past the home system (the sun, the stations and
// the fandoms' planets, layout.js). Pure numbers, so it's tested in Node:
// deepspace.js draws it, ship.js flies through it.
//
// Out here it opens up. The ship's boost becomes a pulse drive, its ceiling
// lifts from the home system's 14 to DEEP.ceiling, and the edge of the map is
// DEEP.edge away. Far out are the wonders: places to fly to that dwarf the
// home system's planets. A ringed gas giant and an ice giant, two other suns
// with planets of their own, a black hole, two nebulae to fly through, and
// one landmark from each crew's universe, the Empire's Death Star and the
// Citadel of Ricks. Everything but the nebulae is solid. A solid wonder
// counts as a planet: graze it and you bounce off, hit it fast and you
// crash, and you come back beside it. The black hole is the exception:
// touch it at any speed and it has you, and you don't come back. What's on
// its far side (`beyond`) is a friend's universe, their own site, and the
// page goes on to it (Universe.jsx).

import { MAP_RADIUS } from './layout';

export const DEEP = {
  system: MAP_RADIUS + 12, // inside this is the home system: boost tops out at SHIP.boost, the ceiling is SHIP.ceiling
  open: MAP_RADIUS + 72, // out past this, the pulse drive's full speed and the full height
  edge: 1400, // turned back here
  ceiling: 230, // how far above or below the disc it can go out in deep space
};

// kind: what it is (deepspace.js draws each kind its own way); r: its radius
// (a black hole's is its shadow); colors: its own palette; planets (a sun's):
// each { r, orbit, angle, color, kind } round it, level with it; crew: whose
// universe it's from (it's there for everyone); trench: the Death Star's,
// the trench run round its middle (trench.js), deep enough to fly down;
// beyond (the black hole's): what's on its far side, { name, what, url },
// where the page goes when the ship falls in
export const WONDERS = [
  { id: 'aurelia', kind: 'gas-giant', name: 'Aurelia', at: [-446, 54, -567], r: 52, ring: true, colors: ['#e9c592', '#b9814d', '#f5e6c8', '#8f5a35'] },
  { id: 'glacia', kind: 'ice-giant', name: 'Glacia', at: [702, -94, 189], r: 30, colors: ['#8fd0ef', '#3f86c2', '#d8f2ff'] },
  {
    id: 'ember',
    kind: 'star',
    name: 'Ember',
    at: [216, 122, 864],
    r: 26,
    color: '#ff7a3c',
    planets: [
      { r: 6, orbit: 64, angle: 0.6, color: '#b0623c', kind: 'rock' },
      { r: 9, orbit: 104, angle: 3.4, color: '#6f86a0', kind: 'ocean' },
    ],
  },
  {
    id: 'halcyon',
    kind: 'star',
    name: 'Halcyon',
    at: [-891, -148, 378],
    r: 20,
    color: '#9cc4ff',
    planets: [
      { r: 5, orbit: 52, angle: 2.2, color: '#d9d3c4', kind: 'rock' },
      { r: 11, orbit: 90, angle: 5.1, color: '#c58fd8', kind: 'gas' },
    ],
  },
  {
    id: 'maw',
    kind: 'black-hole',
    name: 'The Maw',
    at: [864, 81, -702],
    r: 12,
    disk: 72,
    // on its far side: Shrey Pathak's portfolio, the Matrix (where Rick and Morty come out)
    beyond: { name: 'Shrey Pathak', what: 'the Matrix', url: 'https://shreyaanpathak.github.io/portfolio' },
  },
  { id: 'veil', kind: 'nebula', name: 'The Veil', at: [-446, 202, 945], r: 160, colors: ['#5b3fd1', '#d14f9a', '#3fb7d1'], solid: false },
  { id: 'cradle', kind: 'nebula', name: 'The Cradle', at: [999, -202, 446], r: 130, colors: ['#2f9e6b', '#c9d14f', '#2f6e9e'], solid: false },
  { id: 'deathstar', kind: 'deathstar', name: 'Death Star', at: [-756, 40, -243], r: 60, crew: 'starwars', trench: { segments: 34 } },
  { id: 'citadel', kind: 'citadel', name: 'The Citadel', at: [351, -54, -932], r: 18, crew: 'rickmorty' },
];

// The trench run model (public/models/universe/trench.glb), as measured:
// its trench runs along x, 24.71 long, 6.6 wide (z −15…−8.4) and 7.1 deep
// (the rim at y 5.4, the floor at −1.7). trench.js lays it round the Death
// Star's middle, `segments` sections to the ring.
export const TRENCH_MODEL = { x: [-1.75, 22.96], z: [-15.0, -8.4], rim: 5.4, floor: -1.7 };

// a wonder's trench, in map units: how many sections, scaled how much, and
// how wide and deep its channel is
export function trenchOf(w) {
  const segments = w.trench.segments;
  const scale = (2 * Math.PI * w.r) / segments / (TRENCH_MODEL.x[1] - TRENCH_MODEL.x[0]);
  return { segments, scale, width: (TRENCH_MODEL.z[1] - TRENCH_MODEL.z[0]) * scale, depth: (TRENCH_MODEL.rim - TRENCH_MODEL.floor) * scale };
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

// what's solid out here, as ship.js's solids: { id, at, r, reach, band,
// swallow }. A black hole is solid out past its shadow, where the light
// bends round it, and it swallows: nothing bounces off it, whatever the
// speed (ship.js); a trench (band) lets the ship in, between its walls,
// down to near its floor
const solid = (id, at, r, band, swallow = false) => ({ id, at, r, reach: r * 1.4, deep: true, ...(band ? { band } : {}), ...(swallow ? { swallow } : {}) });
const bandOf = (w) => {
  if (!w.trench) return null;
  const t = trenchOf(w);
  return { half: t.width / 2 - 0.3, floor: w.r - t.depth + 0.45 };
};
export const DEEP_SOLIDS = WONDERS.filter((w) => w.solid !== false).flatMap((w) => [
  solid(w.id, w.at, w.kind === 'black-hole' ? w.r * 1.5 : w.r, bandOf(w), w.kind === 'black-hole'),
  ...(w.planets ?? []).map((p, i) => solid(`${w.id}-${i + 1}`, planetAt(w, p), p.r)),
]);

export const wonderById = (id) => WONDERS.find((w) => w.id === id) ?? null;

// what's on the far side of the thing the ship fell into (the black hole's
// `beyond`: { name, what, url }), or null for anything you come back from
export const beyondOf = (id) => wonderById(id)?.beyond ?? null;

// 0 in the home system, rising to 1 out in open space (smoothly): how far the
// pulse drive and the ceiling have opened up, at (x, z)
export function openness(x, z) {
  const k = Math.min(1, Math.max(0, (Math.hypot(x, z) - DEEP.system) / (DEEP.open - DEEP.system)));
  return k * k * (3 - 2 * k);
}
