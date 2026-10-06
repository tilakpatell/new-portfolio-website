import { describe, expect, it } from 'vitest';
import { pushOut, sightClear } from '../../middleearth/towns/walker';
import { BLOCKS, CAST, COLLIDERS, COP, EXIT, HIDES, LOOPS, MORTYTOWN, START, WALLS, inMortytown, validTownAt } from './mortytown';
import { DOORS, SPOTS, START as CONCOURSE_START, WORLD } from './layout';

const clear = (x, z, rad = 0.45) => {
  const [px, pz] = pushOut(x, z, rad, COLLIDERS, WALLS);
  return Math.hypot(px - x, pz - z) < 1e-6;
};
const legClear = (a, b, rad = 0.45) => {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25);
  for (let i = 0; i <= n; i++) if (!clear(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, rad)) return false;
  return true;
};

// can Rick walk from a to b? A search over half-metre squares, inside the district.
function reachable(a, b) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const cell = (x, z) => [Math.round(x / S), Math.round(z / S)];
  const [bi, bj] = cell(b.x, b.z);
  const seen = new Set();
  const queue = [cell(a.x, a.z)];
  seen.add(key(...queue[0]));
  while (queue.length) {
    const [i, j] = queue.shift();
    if (Math.hypot(i - bi, j - bj) * S < (b.r ?? 1)) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const k = key(ni, nj);
      if (seen.has(k)) continue;
      seen.add(k);
      const x = ni * S;
      const z = nj * S;
      if (!inMortytown(x, z) || !clear(x, z, 0.42)) continue;
      queue.push([ni, nj]);
    }
  }
  return false;
}

describe('Mortytown', () => {
  it('is a street of its own, with a way in and a way out', () => {
    expect(MORTYTOWN).toEqual({ x0: -60, x1: 60, z0: -30, z1: 30 });
    expect(inMortytown(0, 0)).toBe(true);
    expect(inMortytown(61, 0)).toBe(false);
    expect(inMortytown(0, -31)).toBe(false);
    expect(clear(START.x, START.z)).toBe(true);
    expect(clear(EXIT.x, EXIT.z)).toBe(true);
    expect(Math.hypot(START.x - EXIT.x, START.z - EXIT.z)).toBeGreaterThan(EXIT.r + 0.5);
  });
  it('has its edges walled, so nobody walks out of it', () => {
    expect(clear(MORTYTOWN.x1 - 0.2, 0)).toBe(false);
    expect(clear(MORTYTOWN.x0 + 0.2, 0)).toBe(false);
    expect(clear(0, MORTYTOWN.z0 + 0.2)).toBe(false);
  });
  it('stands its blocks inside the district, not on the street', () => {
    for (const b of BLOCKS) {
      expect(b.x - b.w / 2, b.id).toBeGreaterThanOrEqual(MORTYTOWN.x0);
      expect(b.x + b.w / 2, b.id).toBeLessThanOrEqual(MORTYTOWN.x1);
      expect(b.z - b.d / 2, b.id).toBeGreaterThanOrEqual(MORTYTOWN.z0);
      expect(b.z + b.d / 2, b.id).toBeLessThanOrEqual(MORTYTOWN.z1);
      expect(b.h, b.id).toBeGreaterThan(3);
    }
    // the street runs the length of it, clear
    expect(legClear([START.x, 0], [MORTYTOWN.x1 - 2, 0])).toBe(true);
    expect(BLOCKS.some((b) => b.id === 'mortymart')).toBe(true);
    expect(BLOCKS.some((b) => b.id === 'creepymorty')).toBe(true);
  });
  it('has everyone standing clear, and reachable from the lift', () => {
    for (const p of [START, EXIT, COP, ...CAST, ...HIDES]) {
      expect(clear(p.x, p.z), p.id ?? `${p.x},${p.z}`).toBe(true);
      expect(inMortytown(p.x, p.z), p.id ?? `${p.x},${p.z}`).toBe(true);
    }
    for (const p of [EXIT, COP, ...CAST, ...HIDES]) expect(reachable(START, { ...p, r: 1 }), p.id ?? `${p.x},${p.z}`).toBe(true);
  });
  it('hides each Loco out of sight of the street’s middle, but not of someone who looks', () => {
    expect(HIDES.length).toBeGreaterThanOrEqual(3);
    for (const h of HIDES) {
      expect(sightClear(0, 0, h.x, h.z, COLLIDERS, WALLS), h.id).toBe(false);
      // somewhere within six metres, he's in plain sight
      const near = [];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) for (const r of [3, 4.5, 6]) near.push([h.x + Math.cos(a) * r, h.z + Math.sin(a) * r]);
      expect(near.some(([x, z]) => inMortytown(x, z) && clear(x, z) && sightClear(x, z, h.x, h.z, COLLIDERS, WALLS)), h.id).toBe(true);
    }
    // and no two hides share a spot
    for (let i = 0; i < HIDES.length; i++) for (let j = 0; j < i; j++) expect(Math.hypot(HIDES[i].x - HIDES[j].x, HIDES[i].z - HIDES[j].z)).toBeGreaterThan(6);
  });
  it('walks its people round loops on open pavement', () => {
    for (const loop of LOOPS) for (let i = 0; i < loop.length; i++) expect(legClear(loop[i], loop[(i + 1) % loop.length], 0.4), `${loop[i]}`).toBe(true);
  });
  it('keeps the cast apart from the Locos’ hides and from Cop Morty', () => {
    for (const c of CAST) {
      for (const h of HIDES) expect(Math.hypot(c.x - h.x, c.z - h.z), `${c.id} by ${h.id}`).toBeGreaterThan(4);
      if (c.id !== 'copmorty') expect(Math.hypot(c.x - COP.x, c.z - COP.z), c.id).toBeGreaterThan(3);
    }
    for (const c of CAST) expect(c.lines.length, c.id).toBeGreaterThan(0);
    expect(CAST.find((c) => c.id === 'copmorty')).toMatchObject({ x: COP.x, z: COP.z });
  });
  it('keeps a saved spot in Mortytown only if it’s a fair one', () => {
    expect(validTownAt(null)).toEqual(START);
    expect(validTownAt({ x: 99, z: 0 })).toEqual(START);
    expect(validTownAt({ x: BLOCKS[0].x, z: BLOCKS[0].z })).toEqual(START);
    expect(validTownAt({ x: 10, z: 0, face: 1 })).toEqual({ x: 10, z: 0, face: 1 });
  });
});

describe('the way down to Mortytown, on the concourse', () => {
  it('has its door in the shopfronts, on the south-west, and its spot just inside', () => {
    expect(DOORS.mortytown).toMatchObject({ x: -27.6, z: 27.6, w: 7 });
    const s = SPOTS.find((p) => p.id === 'mortytown');
    expect(s).toBeDefined();
    expect(Math.hypot(s.x, s.z)).toBeLessThan(WORLD.radius - 0.5);
    expect(Math.hypot(s.x - DOORS.mortytown.x, s.z - DOORS.mortytown.z)).toBeLessThan(4);
    expect(Math.hypot(s.x - CONCOURSE_START.x, s.z - CONCOURSE_START.z)).toBeGreaterThan(10);
  });
});
