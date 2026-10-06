import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAP_NAMES, buildPlanet, mapFile } from './planets';
import { byId } from './universes';

describe('the planet maps by detail level', () => {
  it('gives a strong card the -hq set, a desktop the standard file, and a phone or a weak device the -sm half', () => {
    expect(mapFile('earth', 'ultra')).toBe('earth-hq.webp');
    expect(mapFile('sky', 'ultra')).toBe('sky-hq.webp');
    expect(mapFile('earth', 'high')).toBe('earth.webp');
    expect(mapFile('earth', 'mid')).toBe('earth-sm.webp');
    expect(mapFile('earth', 'low')).toBe('earth-sm.webp');
  });
  it('gives a strong card the standard file for a map that has no -hq', () => {
    expect(mapFile('transformers', 'ultra')).toBe('transformers.webp');
    expect(mapFile('invincible-night', 'ultra')).toBe('invincible-night.webp');
    expect(mapFile('transformers', 'mid')).toBe('transformers-sm.webp');
  });
  it('is the standard file when no level is given', () => {
    expect(mapFile('marvel')).toBe('marvel.webp');
  });
});

describe('the fandoms’ baked maps', () => {
  it('come in all three sizes where they need them, and one where they don’t', () => {
    expect(mapFile('middleearth', 'ultra')).toBe('middleearth-hq.webp');
    expect(mapFile('caribbean-clouds', 'mid')).toBe('caribbean-clouds-sm.webp');
    expect(mapFile('middleearth-night', 'ultra')).toBe('middleearth-night.webp');
    expect(mapFile('middleearth-night', 'low')).toBe('middleearth-night-sm.webp');
    expect(mapFile('middleearth-glow', 'mid')).toBe('middleearth-glow.webp');
  });
  it('are all there: every file the loader can ask for, at every level', () => {
    const dir = resolve('public/textures/universe');
    const missing = [];
    for (const level of ['low', 'mid', 'high', 'ultra']) for (const name of MAP_NAMES) if (!existsSync(resolve(dir, mapFile(name, level)))) missing.push(mapFile(name, level));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('a planet’s light', () => {
  it('takes the sun it is given: the air, the rim and the night side all face it', () => {
    const p = buildPlanet(byId('rickmorty'), {}, { sun: [0, 0, 1] });
    expect(p.air.material.uniforms.uLight.value.toArray()).toEqual([0, 0, 1]);
    expect(p.body.material.userData.air.uSunW.value.toArray()).toEqual([0, 0, 1]);
  });
  it('turns its sun with the map', () => {
    const p = buildPlanet(byId('rickmorty'), {}, { sun: [0, 0, 1] });
    p.turn(Math.PI / 2);
    const s = p.body.material.userData.air.uSunW.value;
    expect(s.x).toBeCloseTo(1, 6);
    expect(s.z).toBeCloseTo(0, 6);
    expect(p.air.material.uniforms.uLight.value).toBe(s); // (one vector for both)
  });
  it('draws its terminator toward its own sun, not the key’s, once it is told the key', () => {
    const key = { value: new THREE.Vector3(0, 1, 0) };
    const p = buildPlanet(byId('rickmorty'), {}, { sun: [0, 0, 1], key });
    const mat = p.body.material;
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    mat.onBeforeCompile(shader);
    expect(shader.uniforms.uKeyW).toBe(key);
    expect(shader.fragmentShader).toMatch(/directLight\.direction = normalize\( \( viewMatrix \* vec4\( uSunW/);
    expect(shader.fragmentShader).not.toMatch(/#include <lights_fragment_begin>/);
    expect(mat.customProgramCacheKey()).toMatch(/sun/);
  });
  it('a sun defaults to the old key light when none is given', () => {
    const p = buildPlanet(byId('rickmorty'));
    expect(p.air.material.uniforms.uLight.value.length()).toBeCloseTo(1, 6);
  });
});
