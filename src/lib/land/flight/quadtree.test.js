import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, ROOT, SPLIT, keyOf, leafOf, leavesFor, sizeAt } from './quadtree';

const inside = (l, x, z) => x >= l.x0 && x < l.x0 + l.size && z >= l.z0 && z < l.z0 + l.size;

// every point of the roots' union lies in exactly one leaf, and the areas add up
function tiles(leaves) {
  const list = [...leaves.values()];
  const roots = new Map();
  for (const l of list) {
    const f = 2 ** l.d;
    roots.set(keyOf(0, Math.floor(l.ix / f), Math.floor(l.iz / f)), true);
  }
  const area = list.reduce((a, l) => a + l.size * l.size, 0);
  expect(area).toBe(roots.size * ROOT * ROOT);
  const rootList = [...roots.keys()].map((k) => k.split(':').map(Number));
  for (let i = 0; i < 200; i++) {
    const [, rx, rz] = rootList[i % rootList.length];
    const x = (rx + ((i * 0.618034) % 1)) * ROOT, z = (rz + ((i * 0.414214) % 1)) * ROOT;
    expect(list.filter((l) => inside(l, x, z))).toHaveLength(1);
  }
}

describe('the quadtree', () => {
  it('keeps the spec’s constants', () => {
    expect([ROOT, MAX_DEPTH, SPLIT]).toEqual([16384, 6, 1.6]);
    expect(sizeAt(MAX_DEPTH)).toBe(256);
    expect(leafOf(2, -1, 3)).toEqual({ key: '2:-1:3', d: 2, ix: -1, iz: 3, size: 4096, x0: -4096, z0: 12288 });
  });

  it('puts the finest leaf under the camera', () => {
    const leaves = leavesFor(0, 0);
    const under = [...leaves.values()].filter((l) => inside(l, 0, 0));
    expect(under).toHaveLength(1);
    expect(under[0].d).toBe(MAX_DEPTH);
  });

  it('tiles the ground with no gap and no double', () => {
    tiles(leavesFor(0, 0));
    tiles(leavesFor(5321.7, -12000.2));
  });

  it('tiles round a root corner too', () => {
    const leaves = leavesFor(ROOT, ROOT);
    tiles(leaves);
    for (const [x, z] of [[ROOT - 1, ROOT - 1], [ROOT, ROOT - 1], [ROOT - 1, ROOT], [ROOT, ROOT]]) {
      const under = [...leaves.values()].filter((l) => inside(l, x, z));
      expect(under).toHaveLength(1);
      expect(under[0].d).toBe(MAX_DEPTH);
    }
  });

  it('lists coarse to fine', () => {
    const ds = [...leavesFor(0, 0).values()].map((l) => l.d);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThanOrEqual(ds[i - 1]);
  });

  it('gives root tiles alone at maxDepth 0', () => {
    for (const l of leavesFor(100, 100, { maxDepth: 0 }).values()) expect(l.d).toBe(0);
  });

  it('stays under 400 leaves', () => {
    expect(leavesFor(0, 0).size).toBeLessThan(400);
    expect(leavesFor(ROOT, ROOT).size).toBeLessThan(400);
  });
});
