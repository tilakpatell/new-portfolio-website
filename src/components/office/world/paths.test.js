import { describe, expect, it } from 'vitest';
import { pushOut } from '../../middleearth/towns/walker';
import { AMBLES, COLLIDERS, SEATS, WALLS } from './layout';
import { amblePaths, findPath } from './paths';

const free = (p, r = 0.3, colliders = COLLIDERS) => {
  const [x, z] = pushOut(p.x, p.z, r, colliders, WALLS);
  return Math.hypot(x - p.x, z - p.z) < 1e-3;
};
const length = (path) => path.reduce((n, p, i) => (i ? n + Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z) : 0), 0);

describe('findPath', () => {
  it('goes round a wall in the way', () => {
    const walls = [[0, -2, 0, 2, 0.1]];
    const path = findPath({ x: -1, z: 0 }, { x: 1, z: 0 }, { walls, colliders: [], radius: 0.3, bounds: { x0: -4, x1: 4, z0: -4, z1: 4 } });
    expect(path).not.toBeNull();
    expect(path[0]).toEqual({ x: -1, z: 0 });
    expect(path[path.length - 1]).toEqual({ x: 1, z: 0 });
    // it had to go past an end of the wall
    expect(Math.max(...path.map((p) => Math.abs(p.z)))).toBeGreaterThan(2);
  });

  it('is straight when nothing is in the way', () => {
    const path = findPath({ x: -1, z: 0 }, { x: 1, z: 0.5 }, { walls: [], colliders: [], radius: 0.3, bounds: { x0: -4, x1: 4, z0: -4, z1: 4 } });
    expect(path).toHaveLength(2);
  });

  it('says so when there is no way through', () => {
    const walls = [
      [-3, -3, 3, -3, 0.1],
      [3, -3, 3, 3, 0.1],
      [3, 3, -3, 3, 0.1],
      [-3, 3, -3, -3, 0.1],
    ];
    expect(findPath({ x: 0, z: 0 }, { x: 5, z: 0 }, { walls, colliders: [], radius: 0.3, bounds: { x0: -6, x1: 6, z0: -6, z1: 6 } })).toBeNull();
  });
});

describe('the office amblers', () => {
  const paths = amblePaths();
  it('every one has a way there, clear of desks, chairs and walls', () => {
    expect(paths.length).toBe(AMBLES.length);
    for (const a of paths) {
      expect(a.path, a.who).not.toBeNull();
      // (their own chair is what they're getting out of)
      const chair = SEATS.find((x) => x.who === a.who).chair;
      const others = COLLIDERS.filter((c) => !(c.kind === 'circle' && Math.hypot(c.x - chair.x, c.z - chair.z) < 0.01));
      expect(a.path.length).toBeGreaterThan(1);
      // sampled every 10 cm along the way, nothing is in it
      for (let i = 1; i < a.path.length; i++) {
        const p = a.path[i - 1];
        const q = a.path[i];
        const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.1);
        for (let k = 0; k <= n; k++) {
          const s = { x: p.x + ((q.x - p.x) * k) / n, z: p.z + ((q.z - p.z) * k) / n };
          expect(free(s, 0.22, others), `${a.who} at ${s.x.toFixed(2)},${s.z.toFixed(2)}`).toBe(true);
        }
      }
      expect(length(a.path)).toBeLessThan(40);
    }
  });
});
