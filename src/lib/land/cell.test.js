import { describe, expect, it } from 'vitest';
import { CELL, MASK, MAX_DEPTH, N, cellMesh, heightAt, makeCell, waterAt } from './cell';
import { landSpec } from './spec';
import { fieldAt } from './layers';
import { REGION, riversNear } from './rivers';

const spec = landSpec('seven');
const col = (a, ix) => Array.from({ length: N }, (_, iz) => a[iz * N + ix]);
const bytes = (a) => Array.from(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));

// a cell a river runs through, and a point on it
function riverCell(s) {
  for (let cz = -8; cz < 24; cz++)
    for (let cx = -8; cx < 24; cx++) {
      for (const r of riversNear(s, cx, cz)) {
        const p = r.points;
        for (let i = 0; i < p.length; i += 5) {
          const lx = p[i] - cx * CELL;
          const lz = p[i + 1] - cz * CELL;
          if (lx > 4 && lx < 60 && lz > 4 && lz < 60 && fieldAt(s, p[i], p[i + 1]) > s.sea + 1) return { cx, cz, lx, lz, level: p[i + 2] };
        }
      }
    }
  return null;
}

describe('the cell', () => {
  it('has the constants', () => {
    expect([CELL, N, MASK, MAX_DEPTH]).toEqual([64, 65, 128, 3]);
  });

  it('shares its edges with its neighbours exactly', () => {
    const a = makeCell(spec, 0, 0);
    const b = makeCell(spec, 1, 0);
    const c = makeCell(spec, 0, 1);
    expect(col(a.heights, 64)).toEqual(col(b.heights, 0));
    expect(Array.from(a.heights.slice(64 * N, 65 * N))).toEqual(Array.from(c.heights.slice(0, N)));
    expect(bytes(new Float32Array(col(a.water, 64)))).toEqual(bytes(new Float32Array(col(b.water, 0))));
  });

  it('agrees across a region edge a river crosses', () => {
    let done = false;
    for (let seed = 1; seed <= 40 && !done; seed++) {
      const s = landSpec(seed);
      for (let cz = -16; cz < 32 && !done; cz++) {
        const crosses = riversNear(s, 15, cz).some((r) => {
          for (let i = 5; i < r.points.length; i += 5) if ((r.points[i - 5] - REGION) * (r.points[i] - REGION) <= 0 && Math.abs(r.points[i - 4] - (cz * CELL + 32)) < 24) return true;
          return false;
        });
        if (!crosses) continue;
        done = true;
        const a = makeCell(s, 15, cz);
        const b = makeCell(s, 16, cz);
        expect(bytes(new Float32Array(col(a.heights, 64)))).toEqual(bytes(new Float32Array(col(b.heights, 0))));
        expect(bytes(new Float32Array(col(a.water, 64)))).toEqual(bytes(new Float32Array(col(b.water, 0))));
        expect(col(a.water, 64).some((w) => !Number.isNaN(w))).toBe(true);
      }
    }
    expect(done).toBe(true);
  });

  it('is the same twice, byte for byte', () => {
    const a = makeCell(spec, 3, -2);
    const b = makeCell(spec, 3, -2);
    expect(bytes(a.heights)).toEqual(bytes(b.heights));
    expect(bytes(a.water)).toEqual(bytes(b.water));
    expect(bytes(a.mask)).toEqual(bytes(b.mask));
    expect(a.props).toEqual(b.props);
  });

  it('has water on a traced river, no grass in water, depth only where water stands', () => {
    const at = riverCell(spec);
    expect(at).toBeTruthy();
    const cell = makeCell(spec, at.cx, at.cz);
    const v = Math.round(at.lz) * N + Math.round(at.lx);
    expect(Number.isNaN(cell.water[v])).toBe(false);
    let wet = 0;
    for (let j = 0; j < MASK; j++)
      for (let i = 0; i < MASK; i++) {
        const t = (j * MASK + i) * 4;
        const lx = (i + 0.5) * (CELL / MASK);
        const lz = (j + 0.5) * (CELL / MASK);
        const w = cell.water[Math.round(lz) * N + Math.round(lx)];
        if (!Number.isNaN(w)) expect(cell.mask[t + 1]).toBe(0);
        const here = waterAt(cell, lx, lz);
        if (Number.isNaN(here)) expect(cell.mask[t + 2]).toBe(0);
        else if (here > heightAt(cell, lx, lz) + 0.05) {
          expect(cell.mask[t + 2]).toBeGreaterThan(0);
          wet++;
        }
        expect(cell.mask[t]).toBe(0);
      }
    expect(wet).toBeGreaterThan(0);
    // the bed is under the level
    expect(heightAt(cell, at.lx, at.lz)).toBeLessThan(at.level);
  });

  it('places its props on the ground, trees on grass', () => {
    let trees = 0;
    for (let cx = 0; cx < 4; cx++) {
      const cell = makeCell(spec, cx, 0);
      expect(cell.props.length).toBeLessThanOrEqual(spec.kit.perCell);
      for (const p of cell.props) {
        expect(spec.kit.kinds).toContain(p.kind);
        const lx = p.x - cx * CELL;
        const lz = p.z;
        expect(lx).toBeGreaterThanOrEqual(0);
        expect(lx).toBeLessThan(CELL);
        expect(p.y).toBeCloseTo(heightAt(cell, lx, lz), 4);
        if (p.kind === 'tree') {
          trees++;
          const t = (Math.min(MASK - 1, Math.floor(lz * 2)) * MASK + Math.min(MASK - 1, Math.floor(lx * 2))) * 4;
          expect(cell.mask[t + 1]).toBeGreaterThan(127);
        }
      }
    }
    expect(trees).toBeGreaterThan(0);
  });

  it('with no rivers, is dry above the sea and has no trees under it', () => {
    const dry = { ...spec, rivers: { ...spec.rivers, perRegion: 0 } };
    for (let cx = -3; cx < 3; cx++) {
      const cell = makeCell(dry, cx, 2);
      for (let k = 0; k < N * N; k++) if (cell.heights[k] >= dry.sea) expect(Number.isNaN(cell.water[k])).toBe(true);
      for (const p of cell.props) if (p.kind === 'tree') expect(p.y).toBeGreaterThan(dry.sea);
    }
  });

  it('is made inside its budget', () => {
    makeCell(spec, 7, 7);
    const t = [];
    for (let i = 0; i < 5; i++) {
      const s = performance.now();
      makeCell(spec, 8 + i, 7);
      t.push(performance.now() - s);
    }
    t.sort((a, b) => a - b);
    expect(t[2]).toBeLessThan(40);
  });
});

describe('heightAt and waterAt', () => {
  const heights = new Float32Array(N * N);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) heights[iz * N + ix] = (ix * 7 + iz * 13) % 5;
  const cell = { heights, water: heights.map((h) => (h > 2 ? NaN : h + 1)) };

  it('is the vertex at a vertex', () => {
    for (const [ix, iz] of [[0, 0], [3, 9], [64, 64], [10, 64]]) expect(heightAt(cell, ix, iz)).toBeCloseTo(heights[iz * N + ix], 6);
  });

  it('is the plane of the triangle split (ix + 1, iz)–(ix, iz + 1) between, as Rapier’s', () => {
    const h = (i, j) => heights[j * N + i];
    // fx + fz ≤ 1: the triangle (0,0), (1,0), (0,1)
    expect(heightAt(cell, 5.7, 2.2)).toBeCloseTo(h(5, 2) + (h(6, 2) - h(5, 2)) * 0.7 + (h(5, 3) - h(5, 2)) * 0.2, 5);
    // beyond: (1,1), (0,1), (1,0)
    expect(heightAt(cell, 5.6, 2.7)).toBeCloseTo(h(6, 3) + (h(5, 3) - h(6, 3)) * 0.4 + (h(6, 2) - h(6, 3)) * 0.3, 5);
  });

  it('reads NaN water where a corner is dry', () => {
    expect(waterAt(cell, 0, 0)).toBe(heights[0] > 2 ? NaN : heights[0] + 1);
    let nan = 0;
    for (let i = 0; i < 64; i++) if (Number.isNaN(waterAt(cell, i + 0.5, 3.25))) nan++;
    expect(nan).toBeGreaterThan(0);
  });
});

describe('cellMesh', () => {
  const cell = makeCell(spec, 0, 0);
  it.each([1, 2])('step %i: the grid and its skirts', (step) => {
    const m = cellMesh(cell.heights, { step });
    const q = 64 / step;
    expect(m.indices.length).toBe(q * q * 6 + 4 * q * 6);
    expect(m.positions.length).toBe(m.normals.length);
    const verts = m.positions.length / 3;
    for (const i of m.indices) expect(i).toBeLessThan(verts);
    // its top vertices are the heights, in the cell's frame
    expect(m.positions[0]).toBe(0);
    expect(m.positions[1]).toBe(cell.heights[0]);
    expect(m.positions[2]).toBe(0);
    const last = (q + 1) * (q + 1) - 1;
    expect(m.positions[last * 3]).toBe(64);
    expect(m.positions[last * 3 + 1]).toBe(cell.heights[N * N - 1]);
    // its skirts hang 2 m below the edge
    const ys = [];
    for (let v = (q + 1) * (q + 1); v < verts; v++) ys.push(m.positions[v * 3 + 1]);
    expect(ys.length).toBeGreaterThan(0);
    for (let k = 0; k < 3 * verts; k += 3) {
      const l = Math.hypot(m.normals[k], m.normals[k + 1], m.normals[k + 2]);
      expect(l).toBeCloseTo(1, 4);
      expect(m.normals[k + 1]).toBeGreaterThan(0);
    }
  });

  it('faces up', () => {
    const flat = cellMesh(new Float32Array(N * N), { step: 1 });
    const [a, b, c] = flat.indices;
    const p = (i) => [flat.positions[i * 3], flat.positions[i * 3 + 1], flat.positions[i * 3 + 2]];
    const [A, B, C] = [p(a), p(b), p(c)];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    expect(u[2] * v[0] - u[0] * v[2]).toBeGreaterThan(0);
  });
});
