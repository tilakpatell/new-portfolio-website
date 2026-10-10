import { describe, expect, it, vi } from 'vitest';
import { ORIGIN_CELL, createOrigin } from './origin';

const cell = ORIGIN_CELL;

describe('createOrigin', () => {
  it('starts at zero with the default cell', () => {
    const o = createOrigin();
    expect(o.at).toEqual([0, 0, 0]);
    expect(o.cell).toBe(cell);
  });

  it('does not shift inside a cell, exactly at a cell included', () => {
    const o = createOrigin();
    expect(o.check([cell, 0, -cell])).toBeNull();
    expect(o.check({ x: -cell, y: 9e9, z: cell })).toBeNull();
    expect(o.at).toEqual([0, 0, 0]);
  });

  it('shifts one cell just past a cell on x, and on -z', () => {
    const o = createOrigin();
    expect(o.check([cell + 1, 0, 0])).toEqual([cell, 0, 0]);
    expect(o.at).toEqual([cell, 0, 0]);
    expect(o.check({ x: cell, y: 5, z: -(cell + 1) })).toEqual([0, 0, -cell]);
    expect(o.at).toEqual([cell, 0, -cell]);
  });

  it('shifts by whole cells on a long jump, rounding', () => {
    const o = createOrigin();
    expect(o.check([3.4 * cell, 0, 0])).toEqual([3 * cell, 0, 0]);
    expect(o.at).toEqual([3 * cell, 0, 0]);
  });

  it('leaves the player within a cell of the origin after a shift', () => {
    const o = createOrigin();
    const player = [7.7 * cell, 123, -2.6 * cell];
    expect(o.check(player)).not.toBeNull();
    const local = o.toLocal(player);
    expect(Math.abs(local[0])).toBeLessThanOrEqual(cell);
    expect(Math.abs(local[2])).toBeLessThanOrEqual(cell);
    expect(local[1]).toBe(123);
    expect(o.check(player)).toBeNull();
  });

  it('tells listeners the shift, and undo stops it', () => {
    const o = createOrigin();
    const fn = vi.fn();
    const undo = o.on(fn);
    o.check([cell + 1, 0, 0]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith([cell, 0, 0]);
    o.check([cell, 0, 0]); // no shift, no call
    expect(fn).toHaveBeenCalledTimes(1);
    undo();
    o.check([-5 * cell, 0, 0]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('round-trips toWorld and toLocal far from zero', () => {
    const o = createOrigin();
    expect(o.check([1e9, 0, 1e9])).toEqual([1e9, 0, 1e9]);
    expect(o.at).toEqual([1e9, 0, 1e9]);
    // Dyadic fractions survive the trip exactly: 1e9 + 0.125 is representable.
    const p = [0.125, 3.5, -7.25];
    const back = o.toLocal(o.toWorld(p));
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(p[i], 9);
    // Others don't: near 1e9 a double's step is about 1.2e-7, so
    // 1e9 + 12345.678 rounds and the trip comes back that close, not exact.
    const q = [12345.678, -9.01, 0.333];
    const qb = o.toLocal(o.toWorld(q));
    for (let i = 0; i < 3; i++) expect(Math.abs(qb[i] - q[i])).toBeLessThan(1e-6);
  });

  it('writes into an out object or array', () => {
    const o = createOrigin({ cell: 10 });
    o.check([24, 0, -11]);
    expect(o.at).toEqual([20, 0, -10]);
    const obj = { x: 0, y: 0, z: 0 };
    expect(o.toLocal({ x: 21, y: 2, z: -9 }, obj)).toBe(obj);
    expect(obj).toEqual({ x: 1, y: 2, z: 1 });
    const arr = [0, 0, 0];
    expect(o.toWorld([1, 2, 1], arr)).toBe(arr);
    expect(arr).toEqual([21, 2, -9]);
  });

  it('hands out a copy of at', () => {
    const o = createOrigin();
    o.at[0] = 99;
    expect(o.at).toEqual([0, 0, 0]);
  });

  it('resets to zero without telling anyone', () => {
    const o = createOrigin();
    const fn = vi.fn();
    o.on(fn);
    o.check([4 * cell, 0, 4 * cell]);
    o.reset();
    expect(o.at).toEqual([0, 0, 0]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
