import { describe, expect, it } from 'vitest';
import { planetField } from './field';
import { PLANETS, TYPE_BIOMES, planetSpecOf } from './planetSpec';
import { WORLDS } from './planetTables';
import { seeded } from '../../seeded.js';

describe('planetField', () => {
  const hoth = planetSpecOf('hoth');
  const f = planetField(hoth);

  it('gives the same height at a point twice', () => {
    expect(f.heightAt(321.5, -987.25)).toBe(f.heightAt(321.5, -987.25));
  });

  it('holds Echo Base flat at 12 inside its r', () => {
    expect(f.heightAt(1200, -800)).toBe(12);
    expect(f.heightAt(1200 + 219, -800)).toBe(12);
    expect(f.heightAt(1200, -800 - 217)).toBe(12);
  });

  it('is the land again past r + edge', () => {
    const h = f.heightAt(1200 + 380, -800);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).not.toBe(12);
  });

  it('has no step anywhere: no cliff where one biome gives way to another', () => {
    // a 3 km line a metre at a time, twice, across the ridges' reach: never
    // steeper than the flight's limit (60 m in 4 m) in any one metre
    for (const [x0, z0, dx, dz] of [[-20000, 4000, 1, 0], [6000, -15000, 0.6, 0.8]]) {
      let was = f.heightAt(x0, z0);
      for (let i = 1; i <= 3000; i++) {
        const h = f.heightAt(x0 + dx * i, z0 + dz * i);
        expect(Math.abs(h - was), `${x0 + dx * i}, ${z0 + dz * i}`).toBeLessThan(15);
        was = h;
      }
    }
  });

  it('names a biome by index', () => {
    for (let i = 0; i < 20; i++) {
      const b = f.biomeAt(i * 1700, -i * 900);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(hoth.biomes.length);
    }
  });

  it('is finite on every planet', () => {
    for (const p of PLANETS) {
      const g = planetField(planetSpecOf(p.id));
      for (const [x, z] of [[0, 0], [5000, -3000], [-12000, 9000]]) expect(Number.isFinite(g.heightAt(x, z))).toBe(true);
    }
  });

  // every named world and every Expanse type: 2,000 points over 40 km, each
  // with a neighbour 4 m off; the ship at its slowest clears 60 m in 4 m
  const CASES = [...WORLDS.map((w) => [w.id, w.id]), ...Object.keys(TYPE_BIOMES).map((t) => [`expanse ${t}`, PLANETS.find((p) => p.type === t && p.id.startsWith('e:'))?.id])].filter(([, id]) => id);
  it.each(CASES)('%s: finite, within −200…1200 m, never more than 60 m in 4 m', (name, id) => {
    const spec = planetSpecOf(id);
    const g = planetField(spec);
    const rnd = seeded(7);
    const nearPoi = (x, z) => [...spec.pois, ...spec.pits.map((p) => ({ ...p, edge: 0 }))].some((q) => Math.hypot(x - q.at[0], z - q.at[1]) < q.r + (q.edge ?? 0) + 8);
    for (let i = 0; i < 2000; i++) {
      const x = (rnd() * 2 - 1) * 20000, z = (rnd() * 2 - 1) * 20000;
      const h = g.heightAt(x, z);
      expect(Number.isFinite(h)).toBe(true);
      expect(h, `${id} at ${x}, ${z}`).toBeGreaterThanOrEqual(-200);
      expect(h, `${id} at ${x}, ${z}`).toBeLessThanOrEqual(1200);
      if (nearPoi(x, z)) continue;
      const a = rnd() * Math.PI * 2;
      expect(Math.abs(g.heightAt(x + Math.cos(a) * 4, z + Math.sin(a) * 4) - h), `${id} at ${x}, ${z}`).toBeLessThanOrEqual(60);
    }
  });

  it('snaps the pixel world to its step, POIs and all', () => {
    const g = planetField(planetSpecOf('dot-matrix'));
    for (let i = 0; i < 200; i++) expect(Math.abs(g.heightAt(i * 131 - 9000, i * -77 + 4000) % 4)).toBe(0);
    expect(g.heightAt(1200, -800)).toBe(60);
  });

  it('digs the pits', () => {
    const g = planetField(planetSpecOf('tatooine'));
    expect(g.heightAt(2800, -1900)).toBeLessThan(g.heightAt(2800 + 120, -1900) - 25);
  });
});
