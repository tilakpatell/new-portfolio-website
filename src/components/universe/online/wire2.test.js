import { describe, expect, it } from 'vitest';
import { CLIENT_RATES, RATES2, readInvite, readPoint, writePoint } from './wire2';
import { RATES } from './protocol';

describe('the site’s new words', () => {
  it('have rates of their own, beside the old ones', () => {
    expect(RATES2).toEqual({ inv: [0.2, 2], say: [0.5, 3], qc: [1, 3] });
    expect(CLIENT_RATES).toEqual({ ...RATES, ...RATES2 });
  });

  it('an invite carries a squad’s sid, and junk is none', () => {
    expect(readInvite({ s: 'BCDFGHJKLMNP' })).toEqual({ sid: 'BCDFGHJKLMNP' });
    for (const junk of [null, undefined, 'BCDFGHJKLMNP', [], {}, { s: 'AEIOUAEIOUAE' }, { s: 42 }, { s: 'BCDFGHJKLMNPQ' }]) expect(readInvite(junk)).toBeNull();
  });
});

describe('a point on the map, as it goes over the wire', () => {
  it('round-trips, rounded as a pose is', () => {
    expect(writePoint({ x: 12.345, y: -6.789, z: 1000 })).toEqual([12.35, -6.79, 1000]);
    expect(readPoint(writePoint({ x: 12.345, y: -6.789, z: 1000 }))).toEqual({ x: 12.35, y: -6.79, z: 1000 });
  });

  it('carries the sector out in the Expanse, with x and z from its middle', () => {
    const out = writePoint({ x: 123456.78, y: 5, z: -81000 });
    expect(out[3]).toBe('E:2,-1');
    expect(out[0]).toBeCloseTo(123456.78 - 160000, 2);
    const p = readPoint(out);
    expect(p.sec).toBe('E:2,-1');
    expect(p.x).toBeCloseTo(123456.78, 2);
    expect(p.z).toBeCloseTo(-81000, 2);
  });

  it('is clamped as a pose is, and junk is no point', () => {
    expect(readPoint([1e9, -1e9, 0])).toEqual({ x: 60000, y: -1300, z: 0 });
    expect(readPoint([1e9, 0, 0, 'E:1,0']).x).toBe(80000 + 42000);
    for (const junk of [null, undefined, 'x', {}, [], [1, 2], [1, 'a', 3], [NaN, 0, 0], [1, 2, 3, 'E:1,0', 5]]) expect(readPoint(junk)).toBeNull();
  });
});
