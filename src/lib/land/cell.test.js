import { describe, expect, it } from 'vitest';
import { CELL, MASK, MAX_DEPTH, N, cellMesh, heightAt, makeCell, waterAt } from './cell';
import { landSpec } from './spec';
import { fieldAt } from './layers';
import { REGION, riversNear } from './rivers';

const spec = landSpec('seven');
const col = (a, ix) => Array.from({ length: N }, (_, iz) => a[iz * N + ix]);
const bytes = (a) => Array.from(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
// the flora row a prop was placed by (its kind and its name)
const rowOf = (s, p) => [...s.flora.species, ...s.flora.cover].find((r) => r.kind === p.kind && (p.name === undefined ? !r.names.length : r.names.includes(p.name)));
const texel = (lx, lz) => (Math.min(MASK - 1, Math.floor(lz * 2)) * MASK + Math.min(MASK - 1, Math.floor(lx * 2))) * 4;

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
        // (16 first, then 15: 15 reads the regions 16 and the scan above left cached)
        const b = makeCell(s, 16, cz);
        const a = makeCell(s, 15, cz);
        expect(a.props.length).toBeGreaterThan(0);
        expect(bytes(new Float32Array(col(a.heights, 64)))).toEqual(bytes(new Float32Array(col(b.heights, 0))));
        expect(bytes(new Float32Array(col(a.water, 64)))).toEqual(bytes(new Float32Array(col(b.water, 0))));
        expect(col(a.water, 64).some((w) => !Number.isNaN(w))).toBe(true);
        // and 15 again, cold: four far 3 × 3 lookups put 33 new regions into the
        // cache of 32 after every one 15 reads, so its own are traced afresh
        for (let k = 1; k <= 4; k++) riversNear(s, 15 + k * 48, cz);
        const fresh = makeCell(s, 15, cz);
        expect(bytes(fresh.heights)).toEqual(bytes(a.heights));
        expect(bytes(fresh.water)).toEqual(bytes(a.water));
        expect(bytes(fresh.mask)).toEqual(bytes(a.mask));
        expect(fresh.props).toEqual(a.props);
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
    expect(a.props.length).toBeGreaterThan(0);
    // and another seed's is another
    expect(makeCell(landSpec('eight'), 3, -2).props).not.toEqual(a.props);
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
    const rows = [...spec.flora.species, ...spec.flora.cover];
    for (let cx = 0; cx < 4; cx++) {
      // (the grass as it was before the crowns shaded it)
      const cell = makeCell(spec, cx, 0, { shade: false });
      expect(cell.props.length).toBeLessThanOrEqual(rows.reduce((n, r) => n + r.perCell, 0));
      for (const p of cell.props) {
        expect(rows.map((r) => r.kind)).toContain(p.kind);
        const lx = p.x - cx * CELL;
        const lz = p.z;
        expect(lx).toBeGreaterThanOrEqual(0);
        expect(lx).toBeLessThan(CELL);
        expect(lz).toBeGreaterThanOrEqual(0);
        expect(lz).toBeLessThan(CELL);
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

  it('names its flora from the land’s table, at the galaxy’s scales, and leaves the crate unnamed', () => {
    const kinds = new Set();
    for (let cx = 0; cx < 4; cx++)
      for (const p of makeCell(spec, cx, 0).props) {
        kinds.add(p.kind);
        const row = rowOf(spec, p);
        expect(row, `${p.kind} ${p.name}`).toBeTruthy();
        if (p.kind === 'crate') {
          expect(p.name).toBeUndefined();
          expect(p.scale).toBe(1);
        } else {
          expect(typeof p.name).toBe('string');
          expect(p.scale).toBeGreaterThanOrEqual(0.8);
          expect(p.scale).toBeLessThanOrEqual(1.2);
        }
        for (const k of ['x', 'y', 'z', 'yaw', 'scale']) expect(Number.isFinite(p[k])).toBe(true);
      }
    // trees and their cover both
    for (const k of ['tree', 'bush', 'grass']) expect(kinds).toContain(k);
  });

  it('keeps each species to its count, its spacing and its slope, dry, and its bank by the water', () => {
    const made = new Map();
    const cellAt = (cx, cz) => made.get(`${cx},${cz}`) ?? made.set(`${cx},${cz}`, makeCell(spec, cx, cz)).get(`${cx},${cz}`);
    // how far a world point is from a wet vertex, its cell's or a neighbour's
    const fromWater = (x, z) => {
      let near = Infinity;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const c = cellAt(Math.floor(x / CELL) + dx, Math.floor(z / CELL) + dz);
          for (let k = 0; k < N * N; k++) if (!Number.isNaN(c.water[k])) near = Math.min(near, Math.hypot(c.cx * CELL + (k % N) - x, c.cz * CELL + Math.floor(k / N) - z));
        }
      return near;
    };
    let banks = 0;
    // (8, 13): a river's banks, above the beach
    for (const [cx, cz] of [[0, 0], [1, 0], [8, 13]]) {
      const cell = cellAt(cx, cz);
      const rows = [...spec.flora.species, ...spec.flora.cover];
      for (const row of rows) {
        const mine = cell.props.filter((p) => rowOf(spec, p) === row);
        expect(mine.length).toBeLessThanOrEqual(row.perCell);
        const spacing = Math.max(2, CELL / Math.sqrt(row.perCell * 2));
        for (let i = 0; i < mine.length; i++)
          for (let j = i + 1; j < mine.length; j++) expect(Math.hypot(mine[i].x - mine[j].x, mine[i].z - mine[j].z)).toBeGreaterThanOrEqual(spacing);
        for (const p of mine) {
          const lx = p.x - cx * CELL;
          const lz = p.z - cz * CELL;
          const dx = heightAt(cell, lx + 0.5, lz) - heightAt(cell, lx - 0.5, lz);
          const dz = heightAt(cell, lx, lz + 0.5) - heightAt(cell, lx, lz - 0.5);
          const slope = Math.hypot(dx, dz);
          expect(slope).toBeGreaterThanOrEqual(row.slope[0] - 1e-9);
          expect(slope).toBeLessThanOrEqual(row.slope[1] + 1e-9);
          expect(Number.isNaN(waterAt(cell, lx, lz))).toBe(true);
          expect(p.y).toBeGreaterThan(spec.sea);
          if (row.on === 'bank' && p.y >= spec.sea + 1.5) {
            // within 6 m of a river's or a lake's edge: a wet vertex within 6 m and a grid step
            banks++;
            expect(fromWater(p.x, p.z)).toBeLessThanOrEqual(7.5);
          }
        }
      }
    }
    expect(banks).toBeGreaterThan(0);
  });

  it('gathers its trees into woods, with glades between', () => {
    // trees a 32 m square of all grass, over 4 × 4 cells of a planet of hills
    // (a Poisson disc's counts vary half as much as their mean; a wood's more)
    const s = landSpec(3);
    const counts = [];
    for (let cz = 0; cz < 4; cz++)
      for (let cx = 0; cx < 4; cx++) {
        const cell = makeCell(s, cx, cz, { shade: false });
        for (let b = 0; b < 4; b++) {
          const [bx, bz] = [(b & 1) * 32, (b >> 1) * 32];
          let grass = 0;
          for (let j = bz * 2; j < bz * 2 + 64; j++) for (let i = bx * 2; i < bx * 2 + 64; i++) if (cell.mask[(j * MASK + i) * 4 + 1] > 127) grass++;
          if (grass < 0.95 * 64 * 64) continue;
          counts.push(cell.props.filter((p) => p.kind === 'tree' && p.x - cx * CELL >= bx && p.x - cx * CELL < bx + 32 && p.z - cz * CELL >= bz && p.z - cz * CELL < bz + 32).length);
        }
      }
    expect(counts.length).toBeGreaterThan(32);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    expect(variance / mean).toBeGreaterThan(1.2);
    expect(Math.min(...counts)).toBe(0);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2 * mean);
  });

  it('shades the grass under a crown softly, and nothing else, after placing (the props the same either way)', () => {
    let crowns = 0;
    let trunks = 0;
    let rims = 0;
    for (let cx = 0; cx < 3; cx++) {
      const before = makeCell(spec, cx, 0, { shade: false });
      const after = makeCell(spec, cx, 0);
      expect(after.props).toEqual(before.props);
      // each crown in the cell's frame: [lx, lz, its radius]
      const shades = after.props.filter((p) => rowOf(spec, p).shade).map((p) => [p.x - cx * CELL, p.z, rowOf(spec, p).shade * p.scale]);
      // (counted, not asserted texel by texel: 65,536 of them)
      let wrong = 0;
      let deep = 0;
      let hard = 0;
      for (let j = 0; j < MASK; j++)
        for (let i = 0; i < MASK; i++) {
          const t = (j * MASK + i) * 4;
          const [g0, g] = [before.mask[t + 1], after.mask[t + 1]];
          if (after.mask[t] !== 0 || g > g0 || after.mask[t + 2] !== before.mask[t + 2] || after.mask[t + 3] !== before.mask[t + 3]) wrong++;
          // (no texel under a crown below 0.75 of its unshaded grass, to the byte)
          if (g < 0.75 * g0 - 0.5) deep++;
          // under one crown alone: about 0.75 of itself at the trunk, easing
          // to all of itself at the crown's edge (no disc with a hard rim)
          const over = shades.map(([x, z, r]) => Math.hypot((i + 0.5) / 2 - x, (j + 0.5) / 2 - z) / r).filter((u) => u <= 1);
          if (over.length !== 1 || g0 < 100) continue;
          if (over[0] < 0.1) {
            trunks++;
            if (g > 0.76 * g0 + 0.5) hard++;
          } else if (over[0] > 0.9) {
            rims++;
            if (g < 0.98 * g0 - 0.5) hard++;
          }
        }
      expect(wrong).toBe(0);
      expect(deep).toBe(0);
      expect(hard).toBe(0);
      for (const p of after.props) {
        if (!rowOf(spec, p).shade) continue;
        crowns++;
        const t = texel(p.x - cx * CELL, p.z);
        // (darker under a tree than before)
        expect(after.mask[t + 1]).toBeLessThan(before.mask[t + 1]);
      }
    }
    expect(crowns).toBeGreaterThan(0);
    expect(trunks).toBeGreaterThan(0);
    expect(rims).toBeGreaterThan(0);
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
