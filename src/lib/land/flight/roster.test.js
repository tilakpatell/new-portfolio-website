import { describe, expect, it } from 'vitest';
import { LIFE_CAP, rosterFor, slopeAt } from './roster';
import { cellBounds } from './routes';
import { LIFE } from './lifeTables';
import { planetField } from './field';
import { planetSpecOf } from './planetSpec';

const spec = { id: 'test', seed: 99, biomes: [{ id: 'plains' }, { id: 'ridges' }, { id: 'glacier' }], pois: [{ id: 'base', name: 'Base', at: [1200, -800], r: 220, edge: 160, h: 12 }] };
const field = {
  heightAt: (x, z) => 30 * Math.sin(x / 300) + 20 * Math.cos(z / 410) + (x > 4096 && x < 4106 ? (x - 4096) * 3 : x >= 4106 ? 30 : 0),
  biomeAt: (x) => (x < 2048 ? 0 : x < 4096 ? 1 : 2),
};
const KEYS = ['0,-1', '0,0', '1,0', '2,-1', '-1,-1', '3,3'];

describe('roster', () => {
  it('is the same every visit', () => {
    for (const key of KEYS) expect(rosterFor(spec, LIFE.hoth, key, 'mid', field)).toEqual(rosterFor(spec, LIFE.hoth, key, 'mid', field));
  });

  it('stays under the caps, even on Coruscant', () => {
    for (const life of Object.values(LIFE))
      for (const key of KEYS) {
        const r = rosterFor(spec, life, key, 'ultra', field);
        expect(r.air.length).toBeLessThanOrEqual(LIFE_CAP.air);
        expect(r.ground.length).toBeLessThanOrEqual(LIFE_CAP.ground);
      }
    const city = rosterFor(spec, LIFE.coruscant, '0,0', 'mid', field);
    expect(city.air.length).toBe(LIFE_CAP.air);
    // (the cap shared round the rows, so every kind of traffic is there)
    expect(new Set(city.air.map((a) => a.kind)).size).toBeGreaterThan(1);
  });

  it('halves on low', () => {
    let low = 0;
    let mid = 0;
    for (let i = -4; i <= 4; i++)
      for (let j = -4; j <= 4; j++) {
        low += rosterFor(spec, LIFE.tatooine, `${i},${j}`, 'low', field).ground.length;
        mid += rosterFor(spec, LIFE.tatooine, `${i},${j}`, 'mid', field).ground.length;
      }
    expect(low).toBeLessThan(mid * 0.75);
    expect(low).toBeGreaterThan(0);
  });

  it('keeps a herd round its home', () => {
    let herds = 0;
    for (const key of KEYS) {
      const { ground } = rosterFor(spec, LIFE.hoth, key, 'mid', field);
      const groups = new Map();
      for (const g of ground) groups.set(g.group, [...(groups.get(g.group) ?? []), g]);
      for (const members of groups.values()) {
        const row = LIFE.hoth.ground[members[0].row];
        expect(members.length).toBeGreaterThanOrEqual(1);
        expect(members.length).toBeLessThanOrEqual(row.group[1]);
        if (row.role === 'herd') herds++;
        for (const m of members) expect(Math.hypot(m.at[0] - m.home[0], m.at[2] - m.home[1])).toBeLessThanOrEqual(row.spread ?? 30);
      }
    }
    expect(herds).toBeGreaterThan(0);
  });

  it('puts nobody on a steep slope or in a place’s flat, and everybody in its cell on the ground', () => {
    for (const key of KEYS) {
      const [x0, z0, x1, z1] = cellBounds(key);
      for (const g of rosterFor(spec, LIFE.hoth, key, 'ultra', field).ground) {
        const [x, y, z] = g.at;
        expect(x >= x0 && x < x1 && z >= z0 && z < z1).toBe(true);
        expect(slopeAt(field.heightAt, x, z)).toBeLessThanOrEqual(0.7);
        for (const p of spec.pois) expect(Math.hypot(x - p.at[0], z - p.at[1])).toBeGreaterThan(p.r);
        const lift = g.lift ?? 0;
        expect(y).toBeCloseTo(field.heightAt(x, z) + lift, 5);
      }
    }
  });

  it('keeps each row to its biome and its ground', () => {
    for (const key of KEYS)
      for (const g of rosterFor(spec, LIFE.hoth, key, 'ultra', field).ground) {
        const row = LIFE.hoth.ground[g.row];
        if (row.name === 'tauntaun') expect(field.biomeAt(g.at[0], g.at[2])).toBe(0);
        // (the base's patrol keeps near the base)
        if (row.near === 'poi') expect(Math.hypot(g.home[0] - 1200, g.home[1] + 800)).toBeLessThan(1200);
      }
  });

  it('puts every ship on one of its cell’s routes', () => {
    const r = rosterFor(spec, LIFE.hoth, '0,-1', 'mid', field);
    expect(r.air.length).toBeGreaterThan(0);
    const ids = new Set(r.routes.map((x) => x.id));
    for (const a of r.air) {
      expect(ids.has(a.route)).toBe(true);
      expect(a.t0 >= 0 && a.t0 < 1).toBe(true);
    }
  });

  it('makes nothing on a dead world, and only bogwings on Dagobah', () => {
    const dead = rosterFor(spec, { kinds: { default: 'dead' }, air: [], ground: [] }, '0,0', 'ultra', field);
    expect(dead).toEqual({ air: [], ground: [], routes: [] });
    const names = new Set();
    for (const key of KEYS) for (const g of rosterFor(spec, LIFE.dagobah, key, 'ultra', field).ground) names.add(g.kind);
    expect([...names]).toEqual(['bogwing']);
  });

  it('peoples Hoth’s own ground', () => {
    const hoth = planetSpecOf('hoth');
    const f = planetField(hoth);
    const r = rosterFor(hoth, LIFE.hoth, '0,-1', 'mid', f);
    expect(r.ground.length + r.air.length).toBeGreaterThan(0);
  });
});
