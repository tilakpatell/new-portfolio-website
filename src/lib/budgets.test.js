import { describe, expect, it } from 'vitest';
import { BUDGETS, budget } from './budgets';

const LEVELS = ['low', 'mid', 'high', 'ultra'];
const COLUMNS = ['triangles', 'props', 'lod1', 'grass', 'terrain', 'water'];

describe('the budget table', () => {
  it('has every column at every level', () => {
    for (const l of LEVELS) for (const c of COLUMNS) expect(BUDGETS[l]).toHaveProperty(c);
  });

  it('holds high to 3M triangles and ultra to none', () => {
    expect(budget('high').triangles).toBe(3e6);
    expect(budget('ultra').triangles).toBeNull();
    expect(budget('low').triangles).toBe(0.8e6);
  });

  it('rises from low to ultra', () => {
    for (const c of ['props', 'grass', 'terrain', 'water'])
      for (let i = 1; i < LEVELS.length; i++) expect(budget(LEVELS[i])[c]).toBeGreaterThan(budget(LEVELS[i - 1])[c]);
  });

  it('keeps the light copies everywhere but ultra', () => {
    expect(LEVELS.map((l) => budget(l).lod1)).toEqual([true, true, true, false]);
  });

  it("reads high's row for a level it doesn't know", () => {
    expect(budget('nonsense')).toBe(BUDGETS.high);
  });
});
