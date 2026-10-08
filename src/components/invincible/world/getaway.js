// A vehicle driven along the city's grid by rules: the Maulers' getaway
// truck in episode 2, and the radio's stolen car. It keeps to the street
// centre lines (./map.js's GRID), turns at a crossing now and then or when
// the city ends, and stops when Mark lands in front of it. Plain numbers;
// ./scene.js draws it, ./missions.js's `land` and `slam` steps read where
// it is from the `at` events' `car`.
//
// newGetaway({ from, speed, seed }) → { p: [x, 0, z], axis, dir, speed, …}
// stepGetaway(g, dt) → g, each step at most 0.05 s.
// stopGetaway(g) → g, stopped where it is.

import { CITY, GRID, groundAt, rng } from './map';

const EDGE = 120; // how far from the city's edge it turns back
const line = (v) => Math.round((v - GRID.cell / 2) / GRID.cell) * GRID.cell + GRID.cell / 2; // the nearest street's centre
const inside = (axis, v) => (axis === 'x' ? v > CITY.x0 + EDGE && v < CITY.x1 - EDGE : v > CITY.z0 + EDGE && v < CITY.z1 - EDGE);

// From `from`, on the nearest street, heading away from `away` (whoever's
// after it) along that street; `seed` picks its turns.
export function newGetaway({ from, speed = 22, seed = 3, away = null } = {}) {
  const x = line(from[0]);
  const z = line(from[2]);
  // which street it's on: the nearer of the two through the crossing
  const dx = Math.abs(from[0] - x);
  const dz = Math.abs(from[2] - z);
  const axis = dx > dz ? 'x' : 'z';
  let dir = 1;
  if (away) dir = axis === 'x' ? (from[0] >= away[0] ? 1 : -1) : from[2] >= away[2] ? 1 : -1;
  const p = axis === 'x' ? [from[0], 0, z] : [x, 0, from[2]];
  p[1] = groundAt(p[0], p[2]);
  return { p, axis, dir, speed, cruise: speed, seed, n: 0, next: nextCrossing(p, axis, dir), yaw: yawOf(axis, dir), stopped: false, t: 0 };
}

const yawOf = (axis, dir) => (axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI);
// the next crossing along the way
function nextCrossing(p, axis, dir) {
  const v = axis === 'x' ? p[0] : p[2];
  const c = line(v);
  return c * dir > v * dir + 1 ? c : c + GRID.cell * dir;
}

export function stepGetaway(prev, rawDt) {
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  if (!prev || prev.stopped || dt === 0) return prev;
  const g = { ...prev, p: [...prev.p] };
  g.t += dt;
  let left = g.speed * dt;
  while (left > 0) {
    const a = g.axis === 'x' ? 0 : 2;
    const to = g.next;
    const d = Math.abs(to - g.p[a]);
    if (left < d) {
      g.p[a] += left * g.dir;
      left = 0;
      break;
    }
    // at the crossing: on, or a turn (one in three, and always when the city ends ahead)
    g.p[a] = to;
    left -= d;
    const r = rng(g.seed + g.n++);
    const ahead = to + GRID.cell * g.dir;
    const turn = !inside(g.axis, ahead) || r() < 0.33;
    if (turn) {
      const other = g.axis === 'x' ? 'z' : 'x';
      const ov = other === 'x' ? g.p[0] : g.p[2];
      let dir = r() < 0.5 ? 1 : -1;
      if (!inside(other, ov + GRID.cell * dir)) dir = -dir;
      g.axis = other;
      g.dir = dir;
    }
    g.yaw = yawOf(g.axis, g.dir);
    g.next = (g.axis === 'x' ? g.p[0] : g.p[2]) + GRID.cell * g.dir;
  }
  g.p[1] = groundAt(g.p[0], g.p[2]);
  return g;
}

export const stopGetaway = (g) => (g ? { ...g, stopped: true, speed: 0 } : g);
// where it is, and the way it's going
export const getawayAt = (g) => (g ? [g.p[0], g.p[1], g.p[2]] : null);
export const getawayDir = (g) => (g ? [Math.sin(g.yaw), 0, Math.cos(g.yaw)] : null);
