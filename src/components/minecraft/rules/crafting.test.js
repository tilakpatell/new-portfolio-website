import { describe, expect, it } from 'vitest';
import { match } from './crafting';
import { ITEMS } from './items';
import { RECIPES } from './recipes';

// a grid from rows of letters, with a key
const grid = (rows, key, size = rows.length) => {
  const g = new Array(size * size).fill(null);
  rows.forEach((row, y) => [...row].forEach((c, x) => (g[y * size + x] = c === ' ' || c === '.' ? null : key[c])));
  return g;
};

describe('crafting', () => {
  it('a log anywhere in a 2 × 2 gives 4 planks of its wood', () => {
    for (let i = 0; i < 4; i++) {
      const g = new Array(4).fill(null);
      g[i] = 'birch_log';
      expect(match(g, 2)).toEqual({ result: { item: 'birch_planks', count: 4 }, consume: [i] });
    }
    const g = new Array(9).fill(null);
    g[8] = 'oak_log';
    expect(match(g, 3).result).toEqual({ item: 'oak_planks', count: 4 });
  });

  it('two planks one over the other make 4 sticks, of any wood', () => {
    expect(match(grid(['P.', 'Q.'], { P: 'oak_planks', Q: 'spruce_planks' }), 2).result).toEqual({ item: 'stick', count: 4 });
    expect(match(grid(['PQ', '..'], { P: 'oak_planks', Q: 'oak_planks' }), 2)).toBeNull();
  });

  it('four planks make a crafting table', () => {
    expect(match(grid(['PP', 'PP'], { P: 'jungle_planks' }), 2).result).toEqual({ item: 'crafting_table', count: 1 });
  });

  it('a pickaxe matches only its shape, and only in a 3 × 3', () => {
    const key = { C: 'cobblestone', S: 'stick' };
    expect(match(grid(['CCC', '.S.', '.S.'], key), 3).result).toEqual({ item: 'stone_pickaxe', count: 1 });
    expect(match(grid(['CCC', 'S..', '.S.'], key), 3)).toBeNull();
    expect(match(grid(['CC.', '.S.', '.S.'], key), 3).result.item).toBe('stone_hoe'); // (that's a hoe)
    expect(match(grid(['C.C', '.S.', '.S.'], key), 3)).toBeNull();
    expect(match(grid(['PPP', '.S.', '.S.'], { P: 'oak_planks', S: 'stick' }), 3).result.item).toBe('wooden_pickaxe');
    expect(match(grid(['DDD', '.S.', '.S.'], { D: 'diamond', S: 'stick' }), 3).result.item).toBe('diamond_pickaxe');
  });

  it('a shovel matches at any offset in a 3 × 3', () => {
    const key = { I: 'iron_ingot', S: 'stick' };
    expect(match(grid(['..I', '..S', '..S'], key), 3).result.item).toBe('iron_shovel');
    expect(match(grid(['I..', 'S..', 'S..'], key), 3).result.item).toBe('iron_shovel');
    expect(match(grid(['I..', 'S..', 'S..'], key), 3).consume).toEqual([0, 3, 6]);
  });

  it('an axe matches mirrored', () => {
    const key = { G: 'gold_ingot', S: 'stick' };
    expect(match(grid(['GG.', 'GS.', '.S.'], key), 3).result.item).toBe('golden_axe');
    expect(match(grid(['.GG', '.SG', '.S.'], key), 3).result.item).toBe('golden_axe');
  });

  it('torches from coal or charcoal over a stick, four of them', () => {
    expect(match(grid(['C', 'S'], { C: 'coal', S: 'stick' }, 2), 2).result).toEqual({ item: 'torch', count: 4 });
    expect(match(grid(['C', 'S'], { C: 'charcoal', S: 'stick' }, 2), 2).result).toEqual({ item: 'torch', count: 4 });
  });

  it('a ring of cobblestone is a furnace, of planks a chest', () => {
    expect(match(grid(['CCC', 'C.C', 'CCC'], { C: 'cobblestone' }), 3).result.item).toBe('furnace');
    expect(match(grid(['PPP', 'P.P', 'PPQ'], { P: 'oak_planks', Q: 'acacia_planks' }), 3).result.item).toBe('chest');
  });

  it('nothing in the grid is nothing', () => {
    expect(match(new Array(4).fill(null), 2)).toBeNull();
    expect(match(grid(['D.', '.D'], { D: 'dirt' }), 2)).toBeNull();
  });

  it('every recipe’s result is in ITEMS', () => {
    for (const r of RECIPES) expect(ITEMS[r.result.item], JSON.stringify(r)).toBeTruthy();
  });

  it('every key letter maps to items in ITEMS, and every shape’s letters are keyed', () => {
    for (const r of RECIPES) {
      for (const v of Object.values(r.key ?? {})) for (const it of [v].flat()) expect(ITEMS[it], it).toBeTruthy();
      for (const v of r.items ?? []) for (const it of [v].flat()) expect(ITEMS[it], it).toBeTruthy();
      for (const row of r.shape ?? []) for (const c of row) if (c !== ' ') expect(r.key[c], `${r.result.item}: ${c}`).toBeTruthy();
      if (r.shape) expect(Math.max(r.shape.length, ...r.shape.map((s) => s.length))).toBeLessThanOrEqual(3);
    }
  });

  it('no two recipes are the same shape of the same things', () => {
    const seen = new Set();
    for (const r of RECIPES) {
      const k = JSON.stringify([r.shape, r.key, r.items]);
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });
});
