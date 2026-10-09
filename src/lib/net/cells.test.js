import { describe, expect, it } from 'vitest';
import { NET_CELL, cellTag, netCellOf, netCellsAround, parseTag, sameCells } from './cells';

// The durable world fetches by the same grid (the spec: one constant, said
// here). Its module lands from another lane; wherever it's on the branch,
// its CELL is held to NET_CELL, so whoever merges second is told.
const durable = import.meta.glob('../durable/entities.js', { eager: true });

describe('the net’s grid', () => {
  it('is 2,048 m a cell, floored, so a cell’s west and south edges are its own', () => {
    expect(NET_CELL).toBe(2048);
    expect(netCellOf(-1, 2048)).toEqual([-1, 1]);
    expect(netCellOf(0, 2047.9)).toEqual([0, 0]);
    expect(netCellOf(-2048, -2049)).toEqual([-1, -2]);
  });

  it('gives the 3 × 3 round a cell, nearest first', () => {
    const keys = netCellsAround(0, 0);
    expect(keys).toHaveLength(9);
    expect(keys[0]).toBe('0,0');
    expect(new Set(keys).size).toBe(9);
    expect(keys.slice(1, 5).sort()).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
    expect(keys).toContain('-1,-1');
    expect(netCellsAround(3, -2, 2)).toHaveLength(25);
    expect(netCellsAround(3, -2, 0)).toEqual(['3,-2']);
  });

  it('tags a cell with its planet, and reads a tag back', () => {
    expect(cellTag('hoth', '0,0')).toBe('hoth/0,0');
    expect(parseTag('hoth/-2,3')).toEqual({ planetId: 'hoth', cx: -2, cz: 3 });
    expect(parseTag(cellTag('e-12', '5,-5'))).toEqual({ planetId: 'e-12', cx: 5, cz: -5 });
    for (const bad of ['x', 'hoth/1', 'hoth/1,2,3', '/1,2', 'hoth/a,b', 'hoth/1.5,2', null, 7, 'a/b/1,2', `${'p'.repeat(80)}/0,0`]) expect(parseTag(bad)).toBeNull();
  });

  it('compares two sets of cells whatever their order', () => {
    expect(sameCells(['a/0,0', 'a/1,0'], ['a/1,0', 'a/0,0'])).toBe(true);
    expect(sameCells(['a/0,0'], ['a/0,0', 'a/1,0'])).toBe(false);
    expect(sameCells(['a/0,0', 'a/0,0'], ['a/0,0', 'a/1,0'])).toBe(false);
    expect(sameCells([], [])).toBe(true);
    expect(sameCells(null, null)).toBe(true);
    expect(sameCells(null, [])).toBe(false);
  });
});

describe('one grid', () => {
  it('the durable world’s CELL, where its module is on this branch, is NET_CELL', () => {
    for (const m of Object.values(durable)) expect(m.CELL).toBe(NET_CELL);
  });
});
