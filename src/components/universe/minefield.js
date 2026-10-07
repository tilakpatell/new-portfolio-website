// A minefield across your way (director.js's 'minefield'): a band of mines
// laid ahead of you, across the way you're flying, each a target the guns
// can pop and each set off by a ship that comes close. Shoot a way through
// or weave between them; a mine going off sets off the ones close by it.
// Pure (no three.js), so it's tested in Node; mines.js draws them.
//
// minefieldLane(ship, rand, solids) → [from, to] | null: a run across your
//   way ahead, further ahead the faster you're going (so you see it coming
//   at any speed), clear of everything solid
// layMines({ lane, n, seed, solids }) → [{ at: [x, y, z], r }]: along the
//   lane, a little either side of it and above and below, none on top of
//   another, none inside anything solid; the same field for the same seed
// mineHit(ship, mines, dt) → indices of the mines the ship came close
//   enough to this step (its whole way since the last, at any speed)
// chainFrom(mines, i) → indices: mine i and every one it sets off, and theirs
// mineBlast(d) → the shields a blast takes from a ship d away

import { SOLIDS, forward, noseOf } from './ship';
import { clearance } from './lanes';

export const MINE = {
  n: 14,
  r: 0.35, // map units across the mine's body (its spikes reach a little further)
  width: 26, // how wide the band is, across your way
  depth: 3, // how far either side of it along your way a mine can sit
  up: 2.5, // and above or below it
  apart: 1.6, // the least between two mines' middles (room to weave)
  ahead: [36, 50], // how far ahead of you it's laid, at the least
  lead: 4, // and this many seconds of your speed further on
  clear: 4, // the least room round the band from anything solid
  trigger: 0.9, // a ship this close past a mine's body sets it off
  chain: 3.2, // a mine going off sets off the others this close
  blast: 3, // how far a blast reaches
  damage: 30, // the shields it takes at its middle
};

// a seeded random 0…1 (mulberry32)
const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function minefieldLane(ship, rand = Math.random, solids = SOLIDS) {
  const [fx, fz] = forward(ship.heading);
  const [rx, rz] = [-fz, fx];
  const half = MINE.width / 2;
  for (let i = 0; i < 6; i++) {
    const ahead = MINE.ahead[0] + rand() * (MINE.ahead[1] - MINE.ahead[0]) + Math.abs(ship.speed || 0) * MINE.lead + i * 15;
    const c = [ship.x + fx * ahead, ship.y, ship.z + fz * ahead];
    const from = [c[0] - rx * half, c[1], c[2] - rz * half];
    const to = [c[0] + rx * half, c[1], c[2] + rz * half];
    if (clearance([from, c, to], solids) > MINE.clear) return [from, to];
  }
  return null;
}

export function layMines({ lane: [a, b], n = MINE.n, seed = 1, solids = [] }) {
  const rand = seeded(seed);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[2]) || 1;
  // across the lane, level: the way you're flying, one way or the other
  const across = [-d[2] / len, 0, d[0] / len];
  const fits = (p, mines) => mines.every((m) => dist(m.at, p) > MINE.apart) && solids.every((o) => dist(o.at, p) - o.r > MINE.r + 1);
  const mines = [];
  for (let i = 0; i < n; i++) {
    // (each in its own stretch of the lane, so they spread across it; one
    // that can't go there, anywhere along it)
    for (let tries = 0; tries < 18; tries++) {
      const t = tries < 6 ? (i + 0.15 + rand() * 0.7) / n : rand();
      const side = (rand() * 2 - 1) * MINE.depth;
      const up = (rand() * 2 - 1) * MINE.up;
      const p = [a[0] + d[0] * t + across[0] * side, a[1] + d[1] * t + up, a[2] + d[2] * t + across[2] * side];
      if (fits(p, mines)) {
        mines.push({ at: p, r: MINE.r });
        break;
      }
    }
  }
  return mines;
}

// how close the segment from p to q passes c
const segmentDistance = (p, q, c) => {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = l2 > 1e-12 ? Math.min(1, Math.max(0, ((c[0] - p[0]) * d[0] + (c[1] - p[1]) * d[1] + (c[2] - p[2]) * d[2]) / l2)) : 0;
  return Math.hypot(p[0] + d[0] * t - c[0], p[1] + d[1] * t - c[1], p[2] + d[2] * t - c[2]);
};

export function mineHit(ship, mines, dt) {
  const n = noseOf(ship);
  const v = (ship.speed || 0) * dt;
  const now = [ship.x, ship.y, ship.z];
  const was = [ship.x - n[0] * v, ship.y - n[1] * v, ship.z - n[2] * v];
  const out = [];
  mines.forEach((m, i) => {
    if (!m.gone && segmentDistance(was, now, m.at) < m.r + MINE.trigger) out.push(i);
  });
  return out;
}

export function chainFrom(mines, i) {
  const out = [i];
  const seen = new Set(out);
  for (let k = 0; k < out.length; k++) {
    const at = mines[out[k]].at;
    mines.forEach((m, j) => {
      if (!seen.has(j) && !m.gone && dist(m.at, at) < MINE.chain) {
        seen.add(j);
        out.push(j);
      }
    });
  }
  return out;
}

export const mineBlast = (d) => (d >= MINE.blast ? 0 : MINE.damage * (1 - d / MINE.blast));
