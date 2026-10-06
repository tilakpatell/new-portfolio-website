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
    const key = buildPlanet(byId('office'), {}).body.material.customProgramCacheKey();
    expect(key).not.toContain('clouds');
    expect(key).toContain('detail');
    // (a world drawn in flat colour has no mottle come up on it)
    expect(buildPlanet(byId('gaming'), {}).body.material.customProgramCacheKey()).not.toContain('detail');
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

describe('the styles in the light', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  // what three hands a standard or physical material's onBeforeCompile
  const shaderOf = async (mat) => {
    const THREE = await import('three');
    const lib = mat.isMeshPhysicalMaterial ? THREE.ShaderLib.physical : THREE.ShaderLib.standard;
    const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
    mat.onBeforeCompile(shader);
    return shader;
  };

  it('C-137 is cel-shaded with an inked limb', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const mat = buildPlanet(byId('rickmorty'), {}).body.material;
    expect(mat.customProgramCacheKey()).toContain('cel');
    const { fragmentShader } = await shaderOf(mat);
    // three bands of the direct light, no reflection, the limb darkened to the eighth power
    expect(fragmentShader).toContain('#define RE_Direct RE_Direct_Cel');
    expect(fragmentShader).toContain('#define RE_IndirectSpecular RE_IndirectSpecular_Cel');
    expect(fragmentShader).toMatch(/smoothstep\(0\.550 - celEdge/);
    expect(fragmentShader).toMatch(/0\.8 \* pow\(1\.0 - saturate\(dot\(nonPerturbedNormal, normalize\(vViewPosition\)\)\), 8\.000\)/);
    // (and the air's earlier hook still there: composed, not replaced)
    expect(fragmentShader).toContain('uRimColor');
    vi.unstubAllGlobals();
  });

  it('C-137’s air is two flat bands of lime', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    expect(buildPlanet(byId('rickmorty'), {}, { tier: 'high' }).air.material.fragmentShader).toContain('#define FLAT');
    expect(buildPlanet(byId('middleearth'), {}, { tier: 'high' }).air.material.fragmentShader).not.toContain('#define FLAT');
    vi.unstubAllGlobals();
  });

  it('Dot Matrix is dithered in four greens', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const u = byId('gaming');
    const p = buildPlanet(u, {});
    const mat = p.body.material;
    expect(mat.customProgramCacheKey()).toContain('dither');
    const greens = mat.userData.dither.uPalette.value.map((c) => `#${c.getHexString()}`);
    expect(greens).toEqual([u.palette.dark, u.palette.glow, u.palette.base, u.palette.light]);
    // its dots sized by the ratio the frame is drawn at, set each frame
    const THREE = await import('three');
    p.light(new THREE.Color(1, 1, 1), 1.5);
    expect(mat.userData.dither.uDpr.value).toBe(1.5);
    const { fragmentShader } = await shaderOf(mat);
    expect(fragmentShader).toContain('gl_FragCoord.xy / (uDpr * 2.0)');
    vi.unstubAllGlobals();
  });

  it('the Office is paper', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const mat = buildPlanet(byId('office'), {}).body.material;
    expect(mat.isMeshPhysicalMaterial).toBe(true);
    expect(mat.sheen).toBe(0.6);
    expect(mat.sheenRoughness).toBe(0.8);
    expect(mat.roughness).toBe(1);
    vi.unstubAllGlobals();
  });

  it('Cybertron’s seams take the key light’s colour, as a tint', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet, MAP_NAMES } = await import('./planets');
    const { byId } = await import('./universes');
    const T = Object.fromEntries(MAP_NAMES.map((n) => [n, new THREE.Texture()]));
    const p = buildPlanet(byId('transformers'), T);
    p.light(new THREE.Color(0.5, 0.4, 0.25), 1);
    const key = p.body.material.userData.cybertron.uKeyColour.value;
    expect(key.r).toBeCloseTo(1);
    expect(key.g).toBeCloseTo(0.8);
    expect(key.b).toBeCloseTo(0.5);
    vi.unstubAllGlobals();
  });

  it('the map’s planets make at most 24 program variants of their own', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet, MAP_NAMES, variants } = await import('./planets');
    const { UNIVERSES } = await import('./universes');
    // (every map there, as on a desktop: the most variants a visit makes)
    const T = Object.fromEntries(MAP_NAMES.map((n) => [n, new THREE.Texture()]));
    const made = variants(UNIVERSES.map((u) => buildPlanet(u, T, { tier: 'high' })));
    expect(made.size).toBeGreaterThan(8);
    expect(made.size).toBeLessThanOrEqual(24);
    vi.unstubAllGlobals();
  });
});
