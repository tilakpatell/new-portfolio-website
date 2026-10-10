import { describe, expect, it } from 'vitest';
import { CSM_CASCADES, CSM_MAX_FAR, SUN_CASCADES, cascadesFor, createSun, splitsFor } from './sun';

describe('cascadesFor', () => {
  it('gives the design’s cascades per tier, none on low', () => {
    expect(cascadesFor('ultra')).toEqual({ n: CSM_CASCADES, far: CSM_MAX_FAR });
    expect(cascadesFor('high')).toEqual({ n: 4, far: 600 });
    expect(cascadesFor('mid')).toEqual({ n: 2, far: 300 });
    expect(cascadesFor('low')).toEqual({ n: 0, far: 0 });
  });
});

describe('splitsFor', () => {
  it('runs from near to far, rising, the practical split at lambda 0.5', () => {
    const s = splitsFor(0.1, 600, 4);
    expect(s).toHaveLength(5);
    expect(s[0]).toBe(0.1);
    expect(s[4]).toBe(600);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
    // (SunLightShadow's own inner edge for two cascades)
    const two = splitsFor(0.1, 300, 2);
    const uniform = 0.1 + (300 - 0.1) / 2;
    const log = 0.1 * Math.sqrt(300 / 0.1);
    expect(two[1]).toBeCloseTo((uniform + log) / 2, 6);
  });
  it('lambda 0 is uniform, 1 logarithmic', () => {
    expect(splitsFor(1, 101, 2, 0)[1]).toBeCloseTo(51);
    expect(splitsFor(1, 100, 2, 1)[1]).toBeCloseTo(10);
  });
});

describe('createSun', () => {
  it('a SunLight from the entry: its colour, strength and direction, its shadow from the record', async () => {
    const sun = await createSun({ sky: { suns: [{ az: 90, el: 30, color: [1, 0.5, 0.25] }] }, light: { sun: 4 }, record: { OutdoorLight: { ShadowDistance: 250 } } }, { tier: 'ultra' });
    expect(sun.light.isSunLight).toBe(true);
    expect(sun.light.intensity).toBe(4);
    expect(sun.light.color.g).toBeCloseTo(0.5);
    expect(sun.light.position.x).toBeCloseTo(Math.cos(Math.PI / 6));
    expect(sun.light.position.y).toBeCloseTo(0.5);
    expect(sun.light.castShadow).toBe(true);
    expect(sun.light.shadow.camera.far).toBe(250);
    expect(sun.light.shadow._viewportCount).toBe(SUN_CASCADES);
    expect(sun.rays).toBe(null);
    sun.dispose();
  });
  it('no shadow on low; a rays light that adds nothing when god rays are asked', async () => {
    expect((await createSun({}, { tier: 'low' })).light.castShadow).toBe(false);
    const sun = await createSun({}, { tier: 'ultra', rays: true });
    expect(sun.rays.isDirectionalLight).toBe(true);
    expect(sun.rays.intensity).toBe(0);
    expect(sun.rays.castShadow).toBe(true);
    sun.update({ position: { x: 10, y: 2, z: -5 } });
    expect(sun.rays.target.position.x).toBe(10);
  });
});
