import { describe, expect, it } from 'vitest';
import { BUDGET_ROWS } from '../budgets';
import { bandsFor, cutFor, wanted } from './bands';

const grid = (r) => {
  const cells = {};
  for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) cells[`${x},${z}`] = { count: 1 };
  return { cell: 128, cells };
};

describe('the bands', () => {
  it('are the row’s near and mid in whole cells round the visitor’s', () => {
    expect(bandsFor(BUDGET_ROWS.high)).toEqual({ near: 70, mid: 220, nearRing: 1, midRing: 2, horizon: 1 });
    expect(bandsFor(BUDGET_ROWS.low)).toMatchObject({ nearRing: 1, midRing: 1, horizon: 0.5 });
    expect(bandsFor(BUDGET_ROWS.ultra)).toMatchObject({ nearRing: 1, midRing: 4, horizon: 1 });
  });

  it('cut: plain near on high, lod1 near on low and mid, ultra near on ultra, lod1 to mid, far beyond', () => {
    expect(cutFor('near', 'high')).toBe('plain');
    expect(cutFor('near', 'low')).toBe('lod1');
    expect(cutFor('near', 'mid')).toBe('lod1');
    expect(cutFor('near', 'ultra')).toBe('ultra');
    expect(cutFor('mid', 'high')).toBe('lod1');
    expect(cutFor('far', 'ultra')).toBe('far');
  });
});

describe('wanted', () => {
  it('at the origin on high: the 3 × 3 near keys and the 5 × 5 ring round them', () => {
    const w = wanted(grid(8), [5, 5], 'high');
    expect(w.near[0]).toBe('0,0'); // nearest first
    expect([...w.near].sort()).toEqual(['-1,-1', '-1,0', '-1,1', '0,-1', '0,0', '0,1', '1,-1', '1,0', '1,1'].sort());
    expect(w.mid.length).toBe(25 - 9);
    expect(w.farList).toBe(true);
  });

  it('leaves out keys the pack has not got (the arena’s edge)', () => {
    const w = wanted(grid(1), [5, 5], 'high');
    expect(w.near.sort()).toEqual(['-1,-1', '-1,0', '0,-1', '0,0'].sort());
    expect(w.mid).toEqual([]);
  });

  it('on low there is no mid ring: near is lod1 and the far list does the rest', () => {
    const w = wanted(grid(8), [5, 5], 'low');
    expect(w.near.length).toBe(9);
    expect(w.mid).toEqual([]);
  });
});
