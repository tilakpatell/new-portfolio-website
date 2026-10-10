import { describe, expect, it } from 'vitest';
import { MIE, RAYLEIGH, SUN, lerpEntry, readEntry, sunDir } from './entry';

describe('readEntry', () => {
  it('a world with no record still lights, on the named defaults', () => {
    const p = readEntry(null);
    expect(p.sun.color).toEqual(SUN.color);
    expect(p.sky.rayleigh).toEqual(RAYLEIGH);
    expect(p.sky.mie).toBe(MIE);
    expect(p.exposure).toBe(1);
    expect(Math.hypot(...p.sun.dir)).toBeCloseTo(1);
  });
  it('reads lane G’s derived shape', () => {
    const p = readEntry({
      sky: { zenith: '#3366cc', suns: [{ az: 0, el: 90, color: [1, 0.8, 0.6] }] },
      light: { sun: 5, sky: [0.5, 0.6, 0.7], ground: 0x804020, ambient: 0.4 },
      fog: { color: [0.9, 0.9, 1], density: 0.002 },
      exposure: 1.2,
      bloom: 0.5,
    });
    expect(p.sun.dir[1]).toBeCloseTo(1);
    expect(p.sun.intensity).toBe(5);
    expect(p.sun.color).toEqual([1, 0.8, 0.6]);
    expect(p.ambient.ground[0]).toBeCloseTo(128 / 255);
    expect(p.ambient.intensity).toBe(0.4);
    expect(p.sky.zenith[2]).toBeCloseTo(0.8);
    expect(p.fog.density).toBe(0.002);
    expect(p.exposure).toBe(1.2);
    expect(p.bloom.scale).toBe(0.5);
  });
  it('the record’s own fields win', () => {
    const p = readEntry({
      light: { sun: 5 },
      record: {
        Sky: { RayleighCoefficient: [1e-6, 2e-6, 3e-6], MieCoefficient: 4e-6 },
        Fog: { FogStart: 50, FogEnd: 900, Curve: [[0, 0], [500, 0.6], [900, 1]] },
        Tonemap: { BloomScale: 0.3, ExposureCompensation: 1 },
        DynamicAO: { HbaoRadius: 1.5, HbaoAngleBias: 0.1, HbaoPowerExponent: 2 },
        ColorCorrection: { ColorGradingMaxHdrValue: 4 },
      },
    });
    expect(p.sky.rayleigh).toEqual([1e-6, 2e-6, 3e-6]);
    expect(p.sky.mie).toBe(4e-6);
    expect(p.fog.curve).toHaveLength(3);
    expect(p.fog.start).toBe(50);
    expect(p.bloom.scale).toBe(0.3);
    expect(p.exposure).toBe(2);
    expect(p.ao).toEqual({ radius: 1.5, bias: 0.1, power: 2 });
    expect(p.grade.maxHdr).toBe(4);
  });
});

describe('sunDir', () => {
  it('azimuth from +Z toward +X, elevation up', () => {
    expect(sunDir(90, 0)[0]).toBeCloseTo(1);
    expect(sunDir(0, 0)[2]).toBeCloseTo(1);
    expect(sunDir(0, 90)[1]).toBeCloseTo(1);
  });
});

describe('lerpEntry', () => {
  it('eases every number, keeps the sun a unit vector and swaps what cannot blend', () => {
    const a = readEntry({ light: { sun: 2 }, sky: { suns: [{ az: 0, el: 10 }] } });
    const b = readEntry({ light: { sun: 6 }, sky: { suns: [{ az: 90, el: 10 }] }, record: { Fog: { Curve: [[0, 0], [100, 1]] } } });
    expect(lerpEntry(a, b, 0).sun.intensity).toBe(2);
    const mid = lerpEntry(a, b, 0.5);
    expect(mid.sun.intensity).toBe(4);
    expect(Math.hypot(...mid.sun.dir)).toBeCloseTo(1);
    expect(mid.fog.curve).toEqual(b.fog.curve);
    expect(lerpEntry(a, b, 0).fog.curve).toBe(null);
    expect(lerpEntry(a, b, 2).sun.intensity).toBe(6);
  });
});
