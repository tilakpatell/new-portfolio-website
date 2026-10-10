import { describe, expect, it } from 'vitest';
import { readEntry } from './entry';
import { createFog, fogAt } from './fog';
import hoth from './fixtures/hoth.ve.json';

describe('fogAt', () => {
  it('Hoth’s day: nothing before Start, the cubic between, 0.58 at the far end', () => {
    const fog = readEntry(hoth.sunny).fog;
    const above = 1000; // (over the height fog)
    expect(fogAt(fog, 20, above)).toBeCloseTo(0);
    expect(fogAt(fog, 50 + 0.25 * 9950, above)).toBeCloseTo(2.23109 / 64 - 4.56547 / 16 + 2.92437 / 4 - 0.00879, 4);
    expect(fogAt(fog, 10000, above)).toBeCloseTo(0.5812, 4);
  });
  it('the height fog: full below the altitude, gone a depth above it', () => {
    const fog = readEntry(hoth.sunny).fog; // altitude 320, depth 50, 95% at 3,000 m
    expect(fogAt(fog, 3000, 300)).toBeCloseTo(1 - Math.exp(-3), 4);
    expect(fogAt(fog, 500, 345)).toBeCloseTo(0.5 * (1 - Math.exp(-0.5)), 4);
    expect(fogAt(fog, 3000, 371)).toBe(fogAt({ ...fog, height: null }, 3000));
  });
  it('without a record: exponential by the derived density', () => {
    const fog = readEntry({ fog: { density: 0.01 } }).fog;
    expect(fogAt(fog, 100)).toBeCloseTo(1 - Math.exp(-1));
  });
});

describe('createFog', () => {
  it('a node with the record’s numbers in its uniforms; a weather change moves them', async () => {
    const f = await createFog(hoth.sunny, { origin: [0, 300, 0] });
    expect(f.node).toBeTruthy();
    expect(f.uniforms.useCurve.value).toBe(1);
    expect(f.uniforms.curve.value.x).toBeCloseTo(2.23109);
    expect(f.uniforms.altitude.value).toBe(20);
    f.set(readEntry(hoth.sunset));
    expect(f.uniforms.end.value).toBe(2500);
    f.set(readEntry({ fog: { density: 0.002 } }));
    expect(f.uniforms.useCurve.value).toBe(0);
    expect(f.uniforms.useHeight.value).toBe(0);
  });
});
