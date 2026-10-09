import { describe, expect, it } from 'vitest';
import { CLUTTER_DEPTHS, CLUTTER_KINDS, DENSITY, SKIRT, makeLeaf } from './leafMesh';
import { heightOn } from './sample';
import { leafOf } from './quadtree';
import { planetField } from './field';
import { planetSpecOf } from './planetSpec';

const bare = { clutter: [], pois: [] };
const n = 9;
const ring = 4 * n - 4;

describe('makeLeaf', () => {
  it('keeps the spec’s constants', () => {
    expect(SKIRT).toBe(12);
    expect(CLUTTER_DEPTHS).toEqual([5, 6]);
    expect(DENSITY).toEqual({ low: 0.4, mid: 0.7, high: 1, ultra: 1 });
    expect(CLUTTER_KINDS).toEqual(['rock', 'spire', 'debris']);
  });

  it('lays flat ground flat, the skirt SKIRT under its edge', () => {
    const m = makeLeaf(bare, leafOf(6, 0, 0), { n, field: { heightAt: () => 5 } });
    for (let v = 0; v < n * n; v++) {
      expect(m.positions[v * 3 + 1]).toBe(5);
      expect(m.normals[v * 3]).toBeCloseTo(0, 9);
      expect(m.normals[v * 3 + 1]).toBe(1);
      expect(m.normals[v * 3 + 2]).toBeCloseTo(0, 9);
    }
    for (let v = n * n; v < n * n + ring; v++) expect(m.positions[v * 3 + 1]).toBe(5 - SKIRT);
  });

  it('puts every skirt vertex straight under an edge vertex', () => {
    const m = makeLeaf(bare, leafOf(6, 2, 1), { n, field: { heightAt: (x, z) => Math.sin(x * 0.02) * 40 + z * 0.05 } });
    const top = new Map();
    for (let v = 0; v < n * n; v++) top.set(`${m.positions[v * 3]},${m.positions[v * 3 + 2]}`, m.positions[v * 3 + 1]);
    for (let v = n * n; v < n * n + ring; v++) {
      const y = top.get(`${m.positions[v * 3]},${m.positions[v * 3 + 2]}`);
      expect(m.positions[v * 3 + 1]).toBeCloseTo(y - SKIRT, 4);
    }
  });

  it('tilts the normals on a slope, at the edges too', () => {
    const m = makeLeaf(bare, leafOf(6, 0, 0), { n, field: { heightAt: (x) => x } });
    for (let v = 0; v < n * n; v++) {
      expect(m.normals[v * 3]).toBeCloseTo(-Math.SQRT1_2, 6);
      expect(m.normals[v * 3 + 1]).toBeCloseTo(Math.SQRT1_2, 6);
      expect(m.normals[v * 3 + 2]).toBeCloseTo(0, 6);
    }
  });

  it('sizes its buffers, every index a vertex', () => {
    const m = makeLeaf(bare, leafOf(5, 0, 0), { n, field: { heightAt: () => 0 } });
    const verts = n * n + ring;
    expect(m.positions.length).toBe(verts * 3);
    expect(m.normals.length).toBe(verts * 3);
    expect(m.indices.length).toBe((n - 1) ** 2 * 6 + ring * 6);
    for (const i of m.indices) expect(i).toBeLessThan(verts);
    expect(m.heights.length).toBe(n * n);
    expect(m.step).toBe(512 / (n - 1));
  });

  it('round-trips its heights through heightOn', () => {
    const leaf = leafOf(6, -3, 4);
    const m = makeLeaf(bare, leaf, { n, field: { heightAt: (x, z) => x * 0.3 - z * 0.1 } });
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) expect(heightOn(leaf, m.heights, n, leaf.x0 + ix * m.step, leaf.z0 + iz * m.step)).toBe(m.heights[iz * n + ix]);
  });

  describe('on Hoth', () => {
    const hoth = planetSpecOf('hoth');
    const field = planetField(hoth);
    const poi = hoth.pois[0];
    // the depth-6 leaves round Echo Base
    const near = [];
    for (let iz = -6; iz <= 0; iz++) for (let ix = 3; ix <= 8; ix++) near.push(leafOf(6, ix, iz));

    it('scatters on the two finest depths only', () => {
      const fine = near.map((l) => makeLeaf(hoth, l, { n, field }));
      expect(fine.reduce((a, m) => a + m.clutter.length / 6, 0)).toBeGreaterThan(0);
      expect(makeLeaf(hoth, leafOf(4, 0, 0), { n, field }).clutter.length).toBe(0);
    });

    it('keeps clear of Echo Base, and sits on the drawn ground', () => {
      for (const leaf of near) {
        const m = makeLeaf(hoth, leaf, { n, field });
        for (let r = 0; r < m.clutter.length; r += 6) {
          const [x, y, z, , scale, kind] = m.clutter.subarray(r, r + 6);
          expect(Math.hypot(x - poi.at[0], z - poi.at[1])).toBeGreaterThanOrEqual(poi.r + poi.edge);
          expect(Math.abs(y - heightOn(leaf, m.heights, n, x, z))).toBeLessThan(0.5);
          expect(scale).toBeGreaterThanOrEqual(0.7);
          expect(scale).toBeLessThanOrEqual(1.3);
          expect(CLUTTER_KINDS[kind]).toBeTruthy();
        }
      }
    });

    it('keeps a depth-5 kind where it stood when its leaf splits', () => {
      const parent = leafOf(5, 10, 10);
      const spires = (m) => {
        const out = [];
        for (let r = 0; r < m.clutter.length; r += 6) if (CLUTTER_KINDS[m.clutter[r + 5]] === 'spire') out.push(`${m.clutter[r]},${m.clutter[r + 2]}`);
        return out;
      };
      const whole = spires(makeLeaf(hoth, parent, { n, field, tier: 'high' }));
      const parts = [0, 1].flatMap((dz) => [0, 1].flatMap((dx) => spires(makeLeaf(hoth, leafOf(6, 20 + dx, 20 + dz), { n, field, tier: 'high' }))));
      expect(parts.sort()).toEqual(whole.sort());
    });

    it('scatters fewer on a lower tier', () => {
      const count = (tier) => near.reduce((a, l) => a + makeLeaf(hoth, l, { n, field, tier }).clutter.length, 0);
      expect(count('low')).toBeLessThan(count('high'));
    });

    it('gives the same buffers twice', () => {
      const a = makeLeaf(hoth, near[3], { n, field });
      const b = makeLeaf(hoth, near[3], { n, field });
      for (const k of ['positions', 'normals', 'indices', 'heights', 'clutter']) expect(b[k]).toEqual(a[k]);
    });
  });
});
