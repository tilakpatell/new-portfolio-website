import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { floraFor } from './flora';
import { LAND_TYPES } from './spec';

// the kit's manifest, as the browser fetches it (flora.js never reads it: its names are a table)
const MODELS = JSON.parse(readFileSync(new URL('../../../public/kit/naturemega/index.json', import.meta.url), 'utf8')).models;
const rows = (f) => [...f.species, ...f.cover];
const sum = (list) => list.reduce((s, r) => s + r.weight, 0);
// a leaf map whose mean is green: its green channel over its red and its blue
const green = (name) => MODELS[name].tones?.every(([r, g, b]) => g > r && g > b) ?? false;

describe('floraFor', () => {
  it('knows every land type, forest among them', () => {
    expect(LAND_TYPES).toContain('forest');
    for (const type of LAND_TYPES) expect(floraFor(type).species.length).toBeGreaterThan(0);
  });

  it.each(['temperate', 'forest', 'desert', 'ice', 'ocean', 'volcanic'])('%s: three species at least, every name the kit’s and of its kind, weights summing to 1', (type) => {
    const f = floraFor(type);
    expect(f.species.filter((r) => r.names.length).length).toBeGreaterThanOrEqual(3);
    expect(f.cover.length).toBeGreaterThan(0);
    for (const r of rows(f)) {
      for (const name of r.names) {
        expect(MODELS[name], name).toBeTruthy();
        expect(MODELS[name].kind, name).toBe(r.kind);
      }
      expect(['grass', 'bank', 'any']).toContain(r.on);
      expect(r.slope).toHaveLength(2);
      expect(r.slope[0]).toBeGreaterThanOrEqual(0);
      expect(r.slope[1]).toBeGreaterThan(r.slope[0]);
      expect(r.clump).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(r.perCell)).toBe(true);
      expect(r.perCell).toBeGreaterThan(0);
    }
    expect(sum(f.species)).toBeCloseTo(1, 9);
    expect(sum(f.cover)).toBeCloseTo(1, 9);
  });

  it('puts a model in one row of a land at most, so its name says its row', () => {
    for (const type of LAND_TYPES) {
      const names = rows(floraFor(type)).flatMap((r) => r.names);
      expect(new Set(names).size, type).toBe(names.length);
    }
  });

  it('shades by the crown: a leafy tree 6 m, a bush 2, a bare tree and the rest none', () => {
    for (const type of LAND_TYPES)
      for (const r of rows(floraFor(type))) {
        const leafy = r.names.some((n) => MODELS[n].tones);
        expect(r.shade, `${type} ${r.names[0]}`).toBe(r.kind === 'tree' && leafy ? 6 : r.kind === 'bush' ? 2 : 0);
      }
  });

  it('keeps the crate, the physics toy, on every land: no name, three a cell, on thick grass', () => {
    for (const type of LAND_TYPES) {
      const crates = floraFor(type).species.filter((r) => r.kind === 'crate');
      expect(crates).toHaveLength(1);
      expect(crates[0]).toMatchObject({ names: [], weight: 0, perCell: 3, on: 'grass', grass: 0.9, shade: 0 });
      expect(floraFor(type).cover.some((r) => r.kind === 'crate')).toBe(false);
    }
  });

  it('greens the temperate, the forest and the ocean, with birch an autumn tenth at most', () => {
    for (const type of ['temperate', 'forest', 'ocean']) {
      const f = floraFor(type);
      const trees = f.species.filter((r) => r.kind === 'tree');
      for (const r of [...trees, ...f.species.filter((s) => s.kind === 'bush')])
        for (const n of r.names) if (!n.startsWith('Birch')) expect(green(n), `${type} ${n}`).toBe(true);
      const birch = trees.filter((r) => r.names.some((n) => n.startsWith('Birch'))).reduce((s, r) => s + r.weight, 0);
      expect(birch / trees.reduce((s, r) => s + r.weight, 0)).toBeLessThanOrEqual(0.1);
    }
  });

  it('gives temperate the counts it was tuned to (rocks near the old scatter’s five a cell)', () => {
    const golden = (list) => list.map((r) => [r.kind, r.names[0] ?? null, r.on, r.perCell]);
    const f = floraFor('temperate');
    expect(golden(f.species)).toEqual([
      ['tree', 'CommonTree_1', 'grass', 11],
      ['tree', 'Pine_1', 'grass', 7],
      ['tree', 'GiantPine_1', 'grass', 2],
      ['tree', 'Birch_1', 'grass', 2],
      ['bush', 'Bush_Large', 'grass', 6],
      ['rock', 'Rock_Medium_1', 'any', 6],
      ['rock', 'Rock_Big_1', 'bank', 1],
      ['crate', null, 'grass', 3],
    ]);
    expect(golden(f.cover)).toEqual([
      ['grass', 'Grass_Common_Short', 'grass', 22],
      ['plant', 'Fern_1', 'grass', 7],
      ['plant', 'Clover_1', 'grass', 5],
      ['flower', 'Flower_1_Group', 'grass', 8],
      ['mushroom', 'Mushroom_Common', 'grass', 4],
      ['pebble', 'Pebble_Round_1', 'any', 8],
      ['path', 'RockPath_Round_Small_1', 'bank', 6],
    ]);
  });

  it('gives the forest the counts the high budget holds: thicker in trees than temperate, its world seen whole from above under 3M triangles', () => {
    // (at 40 species a cell, seed 3's forest, every cell built and seen from
    // 40 m up at high, drew 3.02M triangles of the budget's 3M; at 34, 2.7M)
    const golden = (list) => list.map((r) => [r.kind, r.names[0] ?? null, r.on, r.perCell]);
    const f = floraFor('forest');
    expect(golden(f.species)).toEqual([
      ['tree', 'GiantPine_1', 'grass', 10],
      ['tree', 'Pine_1', 'grass', 10],
      ['tree', 'CommonTree_1', 'grass', 5],
      ['tree', 'Birch_1', 'grass', 2],
      ['bush', 'Bush_Large', 'grass', 4],
      ['rock', 'Rock_Medium_1', 'any', 2],
      ['crate', null, 'grass', 3],
    ]);
    expect(golden(f.cover)).toEqual([
      ['plant', 'Fern_1', 'grass', 27],
      ['mushroom', 'Mushroom_Common', 'grass', 18],
      ['plant', 'Plant_1', 'grass', 14],
      ['plant', 'Clover_1', 'grass', 9],
      ['grass', 'Grass_Common_Short', 'grass', 14],
      ['pebble', 'Pebble_Round_1', 'any', 9],
    ]);
    const trees = (type) => floraFor(type).species.filter((r) => r.kind === 'tree').reduce((n, r) => n + r.perCell, 0);
    expect(trees('forest')).toBeGreaterThan(trees('temperate'));
  });

  it('is a fresh table each time, and temperate for a type it doesn’t know', () => {
    const a = floraFor('temperate');
    a.species[0].names.push('Nothing');
    a.species[0].slope[1] = 99;
    expect(floraFor('temperate').species[0].names).not.toContain('Nothing');
    expect(floraFor('temperate').species[0].slope[1]).not.toBe(99);
    expect(floraFor('jelly')).toEqual(floraFor('temperate'));
  });
});
