import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { BOARDS, BUTTS, CAST, COLLIDERS, GALADHRIM, LEAD, MALLORNS, MIRROR, PATHS, RANGE, SPOTS, START, TREE, WALLS, WOOD, castFor, groundHeight, moodFor, nearPath, validAt, woodHeight } from './layout';
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

describe('Legolas’s targets', () => {
  it('has a mark by the path to shoot from', () => {
    expect(free(BUTTS.x, BUTTS.z)).toBe(true);
    expect(nearPath(BUTTS.x, BUTTS.z)).toBeLessThan(3.5);
  });
  it('stands each board clear of the trees, off the paths, in sight of the mark', () => {
    const trunks = COLLIDERS.filter((c) => c.kind === 'circle' && !c.low);
    for (const b of BOARDS) {
      const d = Math.hypot(b.x - BUTTS.x, b.z - BUTTS.z);
      expect(d, `board ${b.id}`).toBeGreaterThan(9);
      expect(d, `board ${b.id}`).toBeLessThan(35);
      expect(nearPath(b.x, b.z), `board ${b.id}`).toBeGreaterThan(4);
      for (const c of trunks) expect(Math.hypot(b.x - c.x, b.z - c.z), `board ${b.id} by ${c.id}`).toBeGreaterThan(c.r + 0.8);
      // nothing between: the line from the mark passes every trunk by more than the board is wide
      for (let k = 0.05; k < 1; k += 0.025) {
        const x = BUTTS.x + (b.x - BUTTS.x) * k;
        const z = BUTTS.z + (b.z - BUTTS.z) * k;
        for (const c of trunks) expect(Math.hypot(x - c.x, z - c.z), `board ${b.id} behind ${c.id}`).toBeGreaterThan(c.r - 0.3 + b.r);
      }
    }
  });
  it('gives the archery its boards above the ground, and the bow at a hobbit’s height', () => {
    expect(RANGE.targets).toHaveLength(BOARDS.length);
    for (const t of RANGE.targets) expect(t.y - groundHeight(t.x, t.z)).toBeGreaterThan(1);
    expect(RANGE.from.y - groundHeight(BUTTS.x, BUTTS.z)).toBeCloseTo(1.05);
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
