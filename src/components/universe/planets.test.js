import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MAP_NAMES, mapFile } from './planets';

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

describe('the sun a planet is lit from', () => {
  it('a planet takes the sun it is given, its air and its rim both', async () => {
    // (the builders paint on canvases: a canvas that takes every call and draws nothing)
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    // (the halo, as on low; the real air's sun is the same vector: below)
    const p = buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'low' });
    expect(p.air.material.uniforms.uLight.value.toArray()).toEqual([0, 0, 1]);
    expect(p.body.material.userData.air.uSunW.value.toArray()).toEqual([0, 0, 1]);
    // (one vector the scene turns with the map, the air and the rim reading the same)
    expect(p.sun).toBe(p.air.material.uniforms.uLight.value);
    expect(p.sun).toBe(p.body.material.userData.air.uSunW.value);
    vi.unstubAllGlobals();
  });
});

describe('the air round a planet', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  it('a planet with air wears the shell on high and mid, the halo on low', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const high = buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'high' });
    expect(high.air.material.fragmentShader).toContain('inscatter');
    expect(high.air.material.defines.STEPS).toBe(8);
    expect(buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'mid' }).air.material.defines.STEPS).toBe(5);
    const low = buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'low' });
    expect(low.air.material.fragmentShader).not.toContain('inscatter');
    // (its sun the planet's own vector, turned with the map)
    expect(high.air.material.uniforms.uSunDir.value[0]).toBe(high.sun);
    // and back to the halo when the pace steps right down
    high.setAir('halo');
    expect(high.air.material.fragmentShader).not.toContain('inscatter');
    high.setAir('shell');
    expect(high.air.material.fragmentShader).toContain('inscatter');
    vi.unstubAllGlobals();
  });

  it('a world with no air keeps its halo, whatever the tier', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    expect(buildPlanet(byId('office'), {}, { tier: 'high' }).air.material.fragmentShader).not.toContain('inscatter');
    vi.unstubAllGlobals();
  });
});

describe('the ground: clouds’ shadows, seas and detail', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  it('planets without clouds or a roughness map get none of those hooks', async () => {
    stub();
    const { buildPlanet, styleFor } = await import('./planets');
    const { byId } = await import('./universes');
    expect(styleFor(byId('office'), {})).toMatchObject({ clouds: null, rough: null, detail: true });
    expect(styleFor(byId('office'), {}, { tier: 'low' }).detail).toBe(false);
    expect(styleFor(byId('home'), {}).detail).toBe(false);
    const key = buildPlanet(byId('gaming'), {}).body.material.customProgramCacheKey();
    expect(key).not.toContain('clouds');
    expect(key).toContain('detail');
    vi.unstubAllGlobals();
  });

  it('a planet with a cloud layer shadows its ground, the layer found by its texture', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet, styleFor } = await import('./planets');
    const { byId } = await import('./universes');
    const clouds = new THREE.Texture();
    const T = { 'caribbean-clouds': clouds, caribbean: new THREE.Texture(), 'caribbean-rough': new THREE.Texture() };
    expect(styleFor(byId('caribbean'), T)).toMatchObject({ clouds, alpha: true });
    const p = buildPlanet(byId('caribbean'), T);
    const key = p.body.material.customProgramCacheKey();
    expect(key).toContain('clouds');
    expect(key).toContain('rough');
    vi.unstubAllGlobals();
  });
});

describe('the ground follows the pace', () => {
  it('drops its detail at step 2 and its clouds’ shadows and air at step 3, and brings them back', async () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const THREE = await import('three');
    const { buildPlanet, styleFor } = await import('./planets');
    const { byId } = await import('./universes');
    const T = { 'caribbean-clouds': new THREE.Texture(), caribbean: new THREE.Texture() };
    // (no clouds' shadows at all on low)
    expect(styleFor(byId('caribbean'), T, { tier: 'low' }).clouds).toBeNull();
    const p = buildPlanet(byId('caribbean'), T, { tier: 'high' });
    const g = p.body.material.userData.ground;
    p.near(1.5);
    expect(g.uCamDist.value).toBe(1.5);
    p.setLevel(2);
    expect(g.uCamDist.value).toBe(1e9);
    p.near(1.5);
    expect(g.uCamDist.value).toBe(1e9);
    expect(g.uCloudOn.value).toBe(1);
    p.setLevel(3);
    expect(g.uCloudOn.value).toBe(0);
    expect(p.air.material.fragmentShader).not.toContain('inscatter');
    p.setLevel(0);
    p.near(1.5);
    expect(g.uCamDist.value).toBe(1.5);
    expect(g.uCloudOn.value).toBe(1);
    expect(p.air.material.fragmentShader).toContain('inscatter');
    vi.unstubAllGlobals();
  });
});
