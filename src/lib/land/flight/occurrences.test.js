import { describe, expect, it } from 'vitest';
import { OCC, OCCURRENCES, OCC_CAP, applyRule, occurrencesFor, placeOccurrences } from './occurrences';
import { PLANETS, planetSpecOf } from './planetSpec';
import { slopeAt } from './roster';
import { isDead, lifeFor } from './lifeTables';

const spec = { id: 'hoth', seed: 7, biomes: [{ id: 'plains' }, { id: 'range' }, { id: 'glacier' }], pois: [{ id: 'base', at: [1024, 1024], r: 220, edge: 160 }] };
const flat = { heightAt: () => 10, biomeAt: (x) => (x < 1024 ? 0 : x < 1600 ? 1 : 2) };
const KEYS = ['0,0', '1,0', '0,1', '-1,-1', '3,-2', '5,5', '-4,2', '2,2'];

describe('occurrences', () => {
  it('names only known kinds, and biomes its world has', () => {
    for (const [id, rows] of Object.entries(OCC)) {
      const s = planetSpecOf(id);
      expect(s, id).toBeTruthy();
      const ids = s.biomes.map((b) => b.id);
      for (const r of rows) {
        expect(OCCURRENCES[r.kind], `${id} ${r.kind}`).toBeTruthy();
        expect(r.chance).toBeGreaterThan(0);
        for (const b of r.biome ?? []) expect(ids, `${id} ${r.name}`).toContain(b);
      }
    }
  });

  it('gives every living world a list and a dead one nothing', () => {
    for (const p of PLANETS) {
      const s = planetSpecOf(p.id);
      const rows = occurrencesFor(s);
      if (isDead(lifeFor(s))) expect(rows, p.id).toEqual([]);
      else expect(rows.length, p.id).toBeGreaterThan(0);
    }
  });

  it('is the same every visit, and capped', () => {
    for (const key of KEYS) {
      const a = placeOccurrences(spec, OCC.hoth, key, flat);
      expect(a).toEqual(placeOccurrences(spec, OCC.hoth, key, flat));
      expect(a.length).toBeLessThanOrEqual(OCC_CAP);
    }
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: 'ruin', name: `r${i}`, chance: 1 }));
    expect(placeOccurrences(spec, many, '0,0', flat)).toHaveLength(OCC_CAP);
  });

  it('keeps off a place’s flat and its edge, and off steep ground', () => {
    const steep = { heightAt: (x) => (x > 2048 ? x * 2 : 10), biomeAt: () => 0 };
    const every = Array.from({ length: 6 }, (_, i) => ({ kind: 'camp', name: `c${i}`, chance: 1 }));
    for (const key of ['0,0', '1,0', '0,1', '1,1']) {
      for (const occ of placeOccurrences(spec, every, key, steep)) {
        const [x, , z] = occ.at;
        expect(Math.hypot(x - 1024, z - 1024)).toBeGreaterThan(220 + 160);
        expect(slopeAt(steep.heightAt, x, z)).toBeLessThanOrEqual(0.7);
      }
    }
    // (a cell that is all slope has none)
    expect(placeOccurrences(spec, every, '2,0', steep)).toEqual([]);
  });

  it('keeps a row to its biomes', () => {
    const cave = [{ kind: 'cave', name: 'an ice cave', chance: 1, biome: ['glacier'] }];
    for (const key of KEYS) for (const occ of placeOccurrences(spec, cave, key, flat)) expect(flat.biomeAt(occ.at[0])).toBe(2);
  });

  it('a camp fires within its reach and not outside it', () => {
    const camp = { id: 'c', kind: 'camp', name: 'a Tusken camp', rule: 'hostile', r: 300, at: [0, 0, 0] };
    const state = {};
    const near = applyRule(camp, { x: 200, y: 50, z: 0 }, state, 0.1);
    expect(near.hostile).toHaveLength(1);
    expect(near.toast).toMatch(/^A Tusken camp/);
    // (a volley, then a wait)
    expect(applyRule(camp, { x: 200, y: 50, z: 0 }, state, 0.1).hostile).toBeUndefined();
    expect(applyRule(camp, { x: 400, y: 50, z: 0 }, {}, 0.1)).toEqual({});
    // (too high over it to reach)
    expect(applyRule(camp, { x: 100, y: 900, z: 0 }, {}, 0.1)).toEqual({});
  });

  it('a salvage is taken once a visit', () => {
    const wreck = { id: 'w', kind: 'wreck', name: 'a crashed snowspeeder', rule: 'salvage', r: 90, at: [0, 0, 0] };
    const state = {};
    expect(applyRule(wreck, { x: 500, y: 20, z: 0 }, state, 0.1)).toEqual({});
    const got = applyRule(wreck, { x: 40, y: 30, z: 0 }, state, 0.1);
    expect(got.pickup).toBe('w');
    expect(got.toast).toBe('Salvage taken from a crashed snowspeeder.');
    expect(applyRule(wreck, { x: 40, y: 30, z: 0 }, state, 0.1)).toEqual({});
  });

  it('a beacon calls once and marks the map', () => {
    const b = { id: 'b', kind: 'beacon', name: 'a colony beacon', rule: 'call', r: 900, at: [0, 0, 0] };
    const state = {};
    expect(applyRule(b, { x: 800, y: 2000, z: 0 }, state, 0.1)).toMatchObject({ marker: 'b' });
    expect(applyRule(b, { x: 800, y: 2000, z: 0 }, state, 0.1)).toEqual({});
  });
});
