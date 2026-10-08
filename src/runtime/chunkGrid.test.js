import { describe, expect, it } from 'vitest';
import { createChunkGrid } from './chunkGrid';

// the reference ordering: a ring of cells nearest first, ties by angle
const wantedChunks = (cx, cz, r) => {
  const list = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) list.push([dx, dz, dx * dx + dz * dz]);
  list.sort((a, b) => a[2] - b[2] || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  return list.map(([dx, dz]) => `${cx + dx},${cz + dz}`);
};

const chebyshev = (key, cx, cz) => {
  const [x, z] = key.split(',').map(Number);
  return Math.max(Math.abs(x - cx), Math.abs(z - cz));
};

describe('createChunkGrid', () => {
  it('finds the cell of a point, negatives included', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    expect(g.cellOf(-0.5, 15.9)).toEqual([-1, 0]);
    expect(g.cellOf(16, -16)).toEqual([1, -1]);
    expect(g.size).toBe(16);
    expect(g.radius).toBe(2);
    expect(g.gen).toBe(0);
  });

  it('asks for every cell in range, nearest first', () => {
    const g = createChunkGrid({ size: 16, radius: 2, inFlight: 100 });
    const { ask, drop, cancel } = g.update({ x: 1, z: 1 });
    expect(ask).toHaveLength(25);
    expect(new Set(ask).size).toBe(25);
    expect(ask[0]).toBe('0,0');
    expect(new Set(ask.slice(1, 5))).toEqual(new Set(['1,0', '-1,0', '0,1', '0,-1']));
    expect(drop).toEqual([]);
    expect(cancel).toEqual([]);
  });

  it('breaks ties toward the heading', () => {
    const g = createChunkGrid({ size: 16, radius: 2, inFlight: 100 });
    const { ask } = g.update({ x: 1, z: 1, heading: [1, 0] });
    expect(ask[0]).toBe('0,0');
    expect(ask[1]).toBe('1,0');
    expect(ask.indexOf('1,0')).toBeLessThan(ask.indexOf('-1,0'));
    expect(ask.indexOf('1,1')).toBeLessThan(ask.indexOf('-1,1'));
  });

  it('with no heading orders cells exactly as the reference does', () => {
    const g = createChunkGrid({ size: 16, radius: 3 });
    const [cx, cz] = g.cellOf(-40, 75);
    expect(g.cells(-40, 75)).toEqual(wantedChunks(cx, cz, 3));
    expect(g.cells(-40, 75, { radius: 1 })).toEqual(wantedChunks(cx, cz, 1));
  });

  it('caches the ordering for the same cell', () => {
    const g = createChunkGrid({ size: 16, radius: 3 });
    const a = g.cells(1, 1);
    expect(g.cells(15, 2)).toBe(a);
    expect(g.cells(17, 2)).not.toBe(a);
    expect(g.cells(1, 1, { heading: [0, 1] })).not.toEqual(a);
  });

  it('keeps at most inFlight cells in flight', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    const first = g.update({ x: 0, z: 0 }).ask;
    expect(first).toHaveLength(8);
    for (const k of first) g.began(k);
    expect(g.flying.size).toBe(8);
    expect(g.update({ x: 0, z: 0 }).ask).toEqual([]);
    expect(g.done(first[0], 0)).toBe(true);
    expect(g.loaded.has(first[0])).toBe(true);
    expect(g.flying.has(first[0])).toBe(false);
    const next = g.update({ x: 0, z: 0 }).ask;
    expect(next).toHaveLength(1);
    expect(first).not.toContain(next[0]);
  });

  it('refuses a done from an old gen', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    g.update({ x: 0, z: 0 });
    g.began('0,0', 0);
    g.gen = 1;
    expect(g.done('0,0', 0)).toBe(false);
    expect(g.loaded.size).toBe(0);
  });

  it('drops loaded cells only past the hysteresis band', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    g.update({ x: 0, z: 0 });
    g.began('0,0');
    expect(g.done('0,0', 0)).toBe(true);
    // centre moves to cell 3: '0,0' is 3 away (radius + 1), kept
    expect(g.update({ x: 3 * 16 + 1, z: 0 }).drop).toEqual([]);
    expect(g.loaded.has('0,0')).toBe(true);
    // centre moves to cell 4: '0,0' is 4 away (radius + 2), dropped
    expect(g.update({ x: 4 * 16 + 1, z: 0 }).drop).toEqual(['0,0']);
    expect(g.loaded.has('0,0')).toBe(false);
  });

  it('cancels flights that fall out of range, and refuses their done', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    const ask = g.update({ x: 0, z: 0 }).ask;
    for (const k of ask) g.began(k);
    const { cancel } = g.update({ x: 2 * 16 + 1, z: 0 });
    expect(cancel.length).toBeGreaterThan(0);
    for (const k of cancel) {
      expect(chebyshev(k, 2, 0)).toBeGreaterThan(2);
      expect(g.flying.has(k)).toBe(false);
    }
    for (const k of g.flying.keys()) expect(chebyshev(k, 2, 0)).toBeLessThanOrEqual(2);
    for (const k of cancel) expect(g.done(k, 0)).toBe(false);
    for (const k of cancel) expect(g.loaded.has(k)).toBe(false);
  });

  it('a done out of range clears its own flight but no one else\'s', () => {
    const g = createChunkGrid({ size: 16, radius: 1 });
    g.update({ x: 0, z: 0 });
    g.began('1,0');
    g.update({ x: -16 * 2 + 1, z: 0 }); // cancelled here
    g.began('1,0'); // a stale re-begin, same gen
    expect(g.done('1,0', 0)).toBe(false);
    expect(g.flying.has('1,0')).toBe(false);
    g.update({ x: 0, z: 0 });
    g.began('0,0', 5);
    expect(g.done('0,0', 0)).toBe(false);
    expect(g.flying.get('0,0')).toBe(5);
  });

  it('failed clears a flight of the same gen, or any when gen is not given', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    g.began('0,0', 0);
    g.failed('0,0', 1);
    expect(g.flying.has('0,0')).toBe(true);
    g.failed('0,0', 0);
    expect(g.flying.has('0,0')).toBe(false);
    g.began('1,0');
    g.failed('1,0');
    expect(g.flying.size).toBe(0);
  });

  it('unload lets go of a loaded cell so it is asked for again', () => {
    const g = createChunkGrid({ size: 16, radius: 0 });
    g.update({ x: 0, z: 0 });
    g.began('0,0');
    g.done('0,0', 0);
    expect(g.update({ x: 0, z: 0 }).ask).toEqual([]);
    g.unload('0,0');
    expect(g.update({ x: 0, z: 0 }).ask).toEqual(['0,0']);
  });

  it('update can change the radius', () => {
    const g = createChunkGrid({ size: 16, radius: 1, inFlight: 100 });
    expect(g.update({ x: 0, z: 0, radius: 3 }).ask).toHaveLength(49);
    expect(g.radius).toBe(3);
  });

  it('reset hands back everything, bumps the gen and voids earlier flights', () => {
    const g = createChunkGrid({ size: 16, radius: 2 });
    const ask = g.update({ x: 0, z: 0 }).ask;
    for (const k of ask) g.began(k);
    g.done(ask[0], 0);
    const { drop, cancel } = g.reset();
    expect(drop).toEqual([ask[0]]);
    expect(new Set(cancel)).toEqual(new Set(ask.slice(1)));
    expect(g.loaded.size).toBe(0);
    expect(g.flying.size).toBe(0);
    expect(g.gen).toBe(1);
    for (const k of ask) expect(g.done(k, 0)).toBe(false);
    expect(g.loaded.size).toBe(0);
    g.reset(7);
    expect(g.gen).toBe(7);
  });
});
