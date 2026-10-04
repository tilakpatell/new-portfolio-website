// Where each universe sits on the map, and how to step between them. Pure:
// the 3D scene, the SVG mini-map and the world pages' links all use it.
//
// A sun sits in the middle of the disc (x, z), the site's own pages are
// stations on a ring round it, and the fandoms are planets further out on a
// golden-angle spiral, radius growing with their order, so no two line up.
// A little height (y) each keeps the tilted view from looking flat.

import { UNIVERSES, byId } from './universes';

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5°
const SPREAD = 12; // map units per √step, out past the stations
const HUB = 27; // where the fandoms' spiral starts
const RING = 15; // the stations' ring

export const ORDER = UNIVERSES.map((u) => u.id);

// the sun in the middle: something to fly round, not somewhere to go
export const SUN = { at: [0, 0, 0], r: 3.2 };

// the asteroid belt, in the gap between the stations and the planets
export const BELT = { inner: 21, outer: 28.5, height: 4.5 };

// how far a universe's moons, rings and orbiting things reach from its centre
export const REACH = Object.fromEntries(UNIVERSES.map((u) => [u.id, u.size * (u.kind === 'core' ? 2.0 : 1.9)]));

const core = UNIVERSES.filter((u) => u.kind === 'core');
const fandoms = UNIVERSES.filter((u) => u.kind !== 'core');
export const POSITIONS = Object.fromEntries([
  ...core.map((u, i) => {
    const a = (i / core.length) * Math.PI * 2 + Math.PI / 2; // Home nearest the camera
    return [u.id, [RING * Math.cos(a), 0.45 * Math.sin(i * 2.1), RING * Math.sin(a)]];
  }),
  ...fandoms.map((u, i) => {
    const r = HUB + SPREAD * Math.sqrt(i + 0.6);
    const a = i * GOLDEN + 0.4;
    return [u.id, [r * Math.cos(a), 1.4 * Math.sin(i * 2.4), r * Math.sin(a)]];
  }),
]);

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
