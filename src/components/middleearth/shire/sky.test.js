import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MOODS, shadowFor } from './sky';

const lum = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

describe('a mood’s shadow colour, where a town gives none', () => {
  it('follows the mood’s sky light: bright by day, dark by night', () => {
    const day = shadowFor(MOODS.day);
    const night = shadowFor(MOODS.night);
    expect(lum(day)).toBeGreaterThan(lum(night) * 3);
  });

  it('keeps the sky’s hue, leaning violet, never grey', () => {
    const c = new THREE.Color(shadowFor({ hemiSky: 0x3355aa, hemi: 1 }));
    expect(c.b).toBeGreaterThan(c.g);
    const hsl = c.getHSL({});
    expect(hsl.s).toBeGreaterThan(0.2);
  });

  it('is the mood’s own where it has one', () => {
    expect(shadowFor(MOODS.day)).toBe(MOODS.day.shadow);
  });
});

describe('a town that blends its own moods, followed by the house look', () => {
  it('takes its light, its sky, its fog and its exposure from what the town set', async () => {
    const { createHouse } = await import('../../../lib/three/house');
    const { lookFrom, makeSky } = await import('./sky');
    const house = createHouse();
    const sky = makeSky(10);
    sky.uniforms.uHorizon.value.set(0x7a3216);
    sky.uniforms.uTop.value.set(0x140806);
    sky.uniforms.uSunDir.value.set(0, 1, 0);
    const sun = new THREE.DirectionalLight(0xff9a60, 1);
    const hemi = new THREE.HemisphereLight(0xa8664a, 0x1a0c08, 1.5);
    const fog = new THREE.Fog(0x3a1a10, 80, 1100);
    const renderer = { toneMappingExposure: 1 };
    lookFrom(house, { sky, sun, hemi, fog, renderer, exposure: 1.1 });
    expect(house.uniforms.uLookFogLow.value.getHex()).toBe(0x7a3216);
    expect(house.uniforms.uLookFogHigh.value.getHex()).toBe(0x140806);
    // (the town's other fog, the haze under the horizon, so both agree)
    expect(fog.color.getHex()).not.toBe(0x3a1a10);
    expect(house.uniforms.uLookShadow.value.getHex()).toBe(shadowFor({ hemiSky: hemi.color.getHex(), hemi: 1.5 }));
    expect(renderer.toneMappingExposure).toBeCloseTo(1.1 * house.exposure, 6);
    expect(house.uniforms.uLookFogMix.value).toBe(1);
    // (indoors, with the sky put away, the fog is the town's own)
    sky.dome.visible = false;
    lookFrom(house, { sky, sun, hemi, fog, renderer, exposure: 1.1 });
    expect(house.uniforms.uLookFogMix.value).toBe(0);
  });
});
