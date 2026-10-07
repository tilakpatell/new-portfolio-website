import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHouse } from '../../../lib/three/house';
import { createSkyFog } from './skyfog';
import { siteCode, surfaceTuning } from './tune';

const sky = () => ({
  uniforms: {
    uZenith: { value: new THREE.Color('#4060a0') },
    uHorizon: { value: new THREE.Color('#c0d0e0') },
    uBelow: { value: new THREE.Color('#a0a8a0') },
    uHaze: { value: new THREE.Color('#d0d8d8') },
    uHazeK: { value: 0.5 },
    uSunDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
    uSunColor: { value: [new THREE.Color('#ffffff'), new THREE.Color('#000000')] },
    uSunSize: { value: [new THREE.Vector3(0.01, 1, 1), new THREE.Vector3(0.01, 1, 0)] },
  },
});
const fake = ({ grass = true } = {}) => {
  const house = createHouse();
  const wind = {
    uniforms: { uWindStrength: { value: 0.45 }, uWindDir: { value: new THREE.Vector2(1, 0) } },
    set(o) {
      if (o.strength != null) this.uniforms.uWindStrength.value = o.strength;
      if (o.angle != null) this.uniforms.uWindDir.value.set(Math.cos(o.angle), Math.sin(o.angle));
    },
  };
  const post = { k: 1, exposure(v) { this.k = v; } };
  return { house, wind, post, exposure: 1, skyFog: createSkyFog(sky(), THREE.ShaderChunk), grass: grass ? { uniforms: { uGrassHeight: { value: 0.5 }, uGrassWidth: { value: 0.05 }, uGrassRoot: { value: 0.35 } } } : null };
};
const item = (groups, g, k) => groups.find((x) => x.name === g).items.find((i) => i.key === k);
const values = (groups) => groups.map((g) => ({ name: g.name, items: g.items.map((it) => ({ key: it.key, type: it.type, value: it.get() })) }));

describe('tuning a galaxy world by eye', () => {
  it('binds the look, the grass and the wind, and no grass where there is none', () => {
    expect(surfaceTuning(fake()).map((g) => g.name)).toEqual(['look', 'grass', 'wind']);
    expect(surfaceTuning(fake({ grass: false })).map((g) => g.name)).toEqual(['look', 'wind']);
  });

  it('reads and writes the live values', () => {
    const f = fake();
    const groups = surfaceTuning(f);
    item(groups, 'look', 'shadow').set('#5a4a7a');
    expect(f.house.uniforms.uLookShadow.value.getHexString()).toBe('5a4a7a');
    expect(item(groups, 'look', 'shadow').get()).toBe('#5a4a7a');
    item(groups, 'look', 'exposure').set(0.8);
    expect(f.post.k).toBe(0.8);
    expect(item(groups, 'look', 'exposure').get()).toBe(0.8);
    item(groups, 'look', 'halo').set('#ff9a50');
    expect(f.skyFog.uniforms.uSfHalo.value.getHexString()).toBe('ff9a50');
    item(groups, 'look', 'fogBelow').set(0.7);
    expect(f.skyFog.uniforms.uSfBelowK.value).toBe(0.7);
    item(groups, 'grass', 'height').set(0.8);
    expect(f.grass.uniforms.uGrassHeight.value).toBe(0.8);
    item(groups, 'wind', 'angle').set(Math.PI / 2);
    expect(f.wind.uniforms.uWindDir.value.y).toBeCloseTo(1, 6);
  });

  it('copies the values as a site’s own blocks, to paste into its file', () => {
    const f = fake();
    const groups = surfaceTuning(f);
    item(groups, 'look', 'shadow').set('#5a4a7a');
    item(groups, 'look', 'edgeFrom').set(0.12);
    item(groups, 'look', 'edgeTo').set(0.8);
    item(groups, 'look', 'fogBelow').set(0.7);
    item(groups, 'look', 'halo').set('#ff9a50');
    item(groups, 'look', 'exposure').set(0.9);
    const text = siteCode(values(groups));
    const site = new Function(`return {\n${text}\n};`)();
    expect(site.look).toEqual({ shadow: '#5a4a7a', edge: [0.12, 0.8], fogBelow: 0.7, halo: '#ff9a50' });
    expect(site.exposure).toBe(0.9);
    expect(site.grass).toMatchObject({ w: 0.05 });
    expect(site.grass.h[1]).toBe(0.5);
    expect(typeof site.grass.wind).toBe('number');
  });
});
