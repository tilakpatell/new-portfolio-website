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
// crash, and you come back beside it.

import { MAP_RADIUS } from './layout';

export const DEEP = {
  system: MAP_RADIUS + 12, // inside this is the home system: boost tops out at SHIP.boost, the ceiling is SHIP.ceiling
  open: MAP_RADIUS + 72, // out past this, the pulse drive's full speed and the full height
  edge: 1000, // turned back here
  ceiling: 180, // how far above or below the disc it can go out in deep space
};

// kind: what it is (deepspace.js draws each kind its own way); r: its radius
// (a black hole's is its shadow); colors: its own palette; planets (a sun's):
// each { r, orbit, angle, color, kind } round it, level with it; crew: whose
// universe it's from (it's there for everyone)
export const WONDERS = [
  { id: 'aurelia', kind: 'gas-giant', name: 'Aurelia', at: [-330, 40, -420], r: 52, ring: true, colors: ['#e9c592', '#b9814d', '#f5e6c8', '#8f5a35'] },
  { id: 'glacia', kind: 'ice-giant', name: 'Glacia', at: [520, -70, 140], r: 30, colors: ['#8fd0ef', '#3f86c2', '#d8f2ff'] },
  {
    id: 'ember',
    kind: 'star',
    name: 'Ember',
    at: [160, 90, 640],
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
    at: [-660, -110, 280],
    r: 20,
    color: '#9cc4ff',
    planets: [
      { r: 5, orbit: 52, angle: 2.2, color: '#d9d3c4', kind: 'rock' },
      { r: 11, orbit: 90, angle: 5.1, color: '#c58fd8', kind: 'gas' },
    ],
  },
  { id: 'maw', kind: 'black-hole', name: 'The Maw', at: [640, 60, -520], r: 12, disk: 72 },
  { id: 'veil', kind: 'nebula', name: 'The Veil', at: [-330, 150, 700], r: 160, colors: ['#5b3fd1', '#d14f9a', '#3fb7d1'], solid: false },
  { id: 'cradle', kind: 'nebula', name: 'The Cradle', at: [740, -150, 330], r: 130, colors: ['#2f9e6b', '#c9d14f', '#2f6e9e'], solid: false },
  { id: 'deathstar', kind: 'deathstar', name: 'Death Star', at: [-560, 30, -180], r: 22, crew: 'starwars' },
  { id: 'citadel', kind: 'citadel', name: 'The Citadel', at: [260, -40, -690], r: 18, crew: 'rickmorty' },
];

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

// what's solid out here, as ship.js's solids: { id, at, r, reach }. A
// black hole is solid out past its shadow, where the light bends round it
const solid = (id, at, r) => ({ id, at, r, reach: r * 1.4, deep: true });
export const DEEP_SOLIDS = WONDERS.filter((w) => w.solid !== false).flatMap((w) => [
  solid(w.id, w.at, w.kind === 'black-hole' ? w.r * 1.5 : w.r),
  ...(w.planets ?? []).map((p, i) => solid(`${w.id}-${i + 1}`, planetAt(w, p), p.r)),
]);

export const wonderById = (id) => WONDERS.find((w) => w.id === id) ?? null;

// 0 in the home system, rising to 1 out in open space (smoothly): how far the
// pulse drive and the ceiling have opened up, at (x, z)
export function openness(x, z) {
  const k = Math.min(1, Math.max(0, (Math.hypot(x, z) - DEEP.system) / (DEEP.open - DEEP.system)));
  return k * k * (3 - 2 * k);
}
