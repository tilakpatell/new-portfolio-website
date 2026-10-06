// Where each universe sits on the map, and how to step between them. Pure:
// the 3D scene, the SVG mini-map and the world pages' links all use it.
//
// A sun sits in the middle of the disc (x, z) with the site's own pages as
// stations on a ring round it: the home system, HOME_RADIUS across. The
// fandoms are planets far out in deep space, scattered on a golden-angle
// spiral that grows with their order, a thousand and more map units apart, each at
// its own height: getting between them is a journey (ship.js's pulse
// drive), and a fight (hunters.js). deep.js keeps them clear of its wonders.

import { UNIVERSES, byId } from './universes';
import { HOME_SPREAD } from './scale';

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5°
const FIRST = 2000; // how far out the nearest fandom is
const STEP = 330; // and how much further each one after it
const HEIGHT = 560; // how far above or below the disc they go
// the home system's sizes grow together by scale.js's HOME_SPREAD (the
// stations themselves by HOME_SCALE, universes.js), so the sun keeps its
// place against the ring and the stations stay big across the gaps
const RING = 85 * HOME_SPREAD; // the stations' ring

export const ORDER = UNIVERSES.map((u) => u.id);

// the sun in the middle: something to fly round, not somewhere to go
export const SUN = { at: [0, 0, 0], r: 32 * HOME_SPREAD };

// the asteroid belt, round the outside of the stations
export const BELT = { inner: 130 * HOME_SPREAD, outer: 185 * HOME_SPREAD, height: 16 * HOME_SPREAD };
// the home system: the sun, the stations and the belt (what the overview shows)
export const HOME_RADIUS = 230 * HOME_SPREAD;
// the rim: a wide, thin ring of ice rocks right round the outside of the
// map, out past every world and wonder and short of the edge (belt.js draws
// it as a second belt; nothing's solid out there)
export const RIM = { inner: 8000, outer: 8600, height: 60 };

// how far a universe's moons, rings and orbiting things reach from its centre
export const REACH = Object.fromEntries(UNIVERSES.map((u) => [u.id, u.size * (u.reach ?? (u.kind === 'core' ? 2.0 : 1.9))]));

const core = UNIVERSES.filter((u) => u.kind === 'core');
const fandoms = UNIVERSES.filter((u) => u.kind !== 'core');
export const POSITIONS = Object.fromEntries([
  ...core.map((u, i) => {
    const a = (i / core.length) * Math.PI * 2 + Math.PI / 2; // Home nearest the camera
    return [u.id, [RING * Math.cos(a), 3 * Math.sin(i * 2.1), RING * Math.sin(a)]];
  }),
  ...fandoms.map((u, i) => {
    const r = FIRST + STEP * i;
    const a = i * GOLDEN + 0.32;
    return [u.id, [r * Math.cos(a), HEIGHT * Math.sin(i * 2.4 + 1), r * Math.sin(a)]];
  }),
]);

// how far out the furthest fandom reaches
export const MAP_RADIUS = Math.max(...ORDER.map((id) => Math.hypot(POSITIONS[id][0], POSITIONS[id][2]) + REACH[id]));

const step = (id, by) => {
  const i = ORDER.indexOf(id);
  if (i < 0) return by > 0 ? ORDER[0] : ORDER[ORDER.length - 1];
  return ORDER[(i + by + ORDER.length) % ORDER.length];
};
export const next = (id) => step(id, 1);
export const prev = (id) => step(id, -1);

// A route param to a universe id, or null (the overview) for anything else.
export const parseId = (param) => (typeof param === 'string' && byId(param) ? param : null);

// The next universe after `id` that has a world page of its own.
export function nextWorld(id) {
  let at = id;
  for (let n = 0; n < ORDER.length; n++) {
    at = next(at);
    if (byId(at).world) return byId(at);
  }
  return byId(ORDER[0]);
}

// A key in the map's focus group → the universe it moves to, or undefined
// when the key isn't one of ours (so it's left alone).
export function keyStep(key, id) {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return prev(id);
    case 'ArrowRight':
    case 'ArrowDown':
      return next(id);
    case 'Home':
      return ORDER[0];
    case 'End':
      return ORDER[ORDER.length - 1];
    default:
      return undefined;
  }
}
