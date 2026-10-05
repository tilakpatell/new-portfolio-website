import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { CAST, COLLIDERS, GALADHRIM, LEAD, MALLORNS, MIRROR, PATHS, SPOTS, START, TREE, WALLS, WOOD, castFor, groundHeight, moodFor, nearPath, validAt, woodHeight } from './layout';
import { QUESTS } from './story';

const free = (x, z, r = 0.4) => {
  const [px, pz] = pushOut(x, z, r, COLLIDERS, WALLS);
  return Math.hypot(px - x, pz - z) < 0.02;
};

describe('the wood', () => {
  it('has plenty of mallorns, none on a path', () => {
    expect(MALLORNS.length).toBeGreaterThan(25);
    for (const [x, z, r] of MALLORNS) expect(nearPath(x, z)).toBeGreaterThan(r + 2);
  });
  it('lets you walk every path end to end', () => {
    for (const path of PATHS) {
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1];
        const [bx, bz] = path[i];
        for (let t = 0; t <= 1; t += 0.05) {
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          // the path's last step can run up to the great tree's stair
          if (Math.hypot(x - TREE.x, z - TREE.z) < TREE.r + 2) continue;
          if (Math.hypot(x - MIRROR.x, z - MIRROR.z) < 1.5) continue;
          expect(free(x, z), `path at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(true);
        }
      }
    }
  });
  it('lets Haldir’s way through, and the Galadhrim stand clear of the path', () => {
    for (const [x, z] of LEAD) expect(free(x, z, 0.5)).toBe(true);
    for (const [x, z] of GALADHRIM) expect(nearPath(x, z)).toBeGreaterThan(2);
  });
  it('puts every place to do things, and everyone, somewhere you can stand', () => {
    expect(free(START.x, START.z)).toBe(true);
    for (const s of SPOTS) expect(free(s.x, s.z), s.id).toBe(true);
    for (const c of CAST) expect(free(c.x, c.z, 0.3), c.id).toBe(true);
  });
  it('rings the Mirror’s hollow with its bank, and keeps the city flat', () => {
    expect(groundHeight(MIRROR.x, MIRROR.z)).toBeCloseTo(0, 1);
    expect(groundHeight(MIRROR.x, MIRROR.z - MIRROR.crest)).toBeCloseTo(MIRROR.rim, 1);
    expect(Math.abs(woodHeight(TREE.x - 6, TREE.z))).toBeLessThan(0.2);
  });
  it('has a spot for every quest but the first', () => {
    for (const q of QUESTS.slice(1)) expect(SPOTS.some((s) => s.quest === q.id), q.id).toBe(true);
  });
  it('brings the right people out for each part', () => {
    expect(castFor('gifts').filter((c) => c.gift).map((c) => c.look)).toEqual(expect.arrayContaining(['legolas', 'merry', 'pippin', 'sam', 'gimli']));
    expect(castFor('haldir').some((c) => c.look === 'galadriel')).toBe(false);
    expect(moodFor('mirror')).toBe('night');
    expect(moodFor('haldir')).toBe('day');
  });
});

describe('a saved spot', () => {
  it('is kept when it’s fair', () => {
    expect(validAt({ x: -30, z: -4.5, face: 1 })).toEqual({ x: -30, z: -4.5, face: 1 });
  });
  it('is thrown out when it’s inside a tree or off the map', () => {
    expect(validAt({ x: TREE.x + 0.5, z: TREE.z })).toEqual(START);
    expect(validAt({ x: WOOD.east + 10, z: 0 })).toEqual(START);
    expect(validAt(null)).toEqual(START);
  });
});
