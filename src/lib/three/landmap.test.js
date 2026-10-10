import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LAND_GLSL, createLandMap } from './landmap';
import { createGrass } from './grass';
import { createWind } from './wind';
import { makeCell } from '../land/cell';
import { landSpec } from '../land/spec';

const spec = landSpec('seven');
const cells = new Map();
const cell = (cx, cz) => {
  const k = `${cx},${cz}`;
  if (!cells.has(k)) cells.set(k, makeCell(spec, cx, cz));
  return cells.get(k);
};

describe('createLandMap', () => {
  it('has a layer a slot, (2r + 1)² of them, for masks, waters and heights', () => {
    const map = createLandMap({ radius: 2, palette: spec.palette });
    expect(map.slots).toBe(25);
    expect(map.masks).toBeInstanceOf(THREE.DataArrayTexture);
    expect(map.masks.image).toMatchObject({ width: 128, height: 128, depth: 25 });
    expect(map.waters.image).toMatchObject({ width: 65, height: 65, depth: 25 });
    expect(map.heights.image).toMatchObject({ width: 65, height: 65, depth: 25 });
    map.dispose();
  });

  it('puts each cell in a slot and gives it back; drop frees it', () => {
    const map = createLandMap({ radius: 1, palette: spec.palette });
    const seen = new Set();
    for (let cz = -1; cz <= 1; cz++)
      for (let cx = -1; cx <= 1; cx++) {
        const s = map.set(cx, cz, cell(cx, cz));
        expect(map.slotOf(cx, cz)).toBe(s);
        seen.add(s);
      }
    expect(seen.size).toBe(9);
    map.drop(0, 0);
    expect(map.slotOf(0, 0)).toBe(-1);
    expect(map.slotOf(1, 1)).toBeGreaterThanOrEqual(0);
    map.dispose();
  });

  it('writes a cell into its layer: the mask bytes, the water (none: far below) and the heights', () => {
    const map = createLandMap({ radius: 1, palette: spec.palette });
    const c = cell(0, 0);
    const s = map.set(0, 0, c);
    const masks = map.masks.image.data;
    expect(Array.from(masks.subarray(s * 128 * 128 * 4, s * 128 * 128 * 4 + 64))).toEqual(Array.from(c.mask.subarray(0, 64)));
    const w = map.waters.image.data[s * 65 * 65];
    const h = map.heights.image.data[s * 65 * 65 + 3];
    expect(THREE.DataUtils.fromHalfFloat(h)).toBeCloseTo(c.heights[3], 1);
    expect(Number.isNaN(c.water[0]) ? THREE.DataUtils.fromHalfFloat(w) < -1000 : true).toBe(true);
    map.dispose();
  });

  it('keeps the slots of the cells still in range when its centre moves', () => {
    const map = createLandMap({ radius: 1, palette: spec.palette });
    for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) map.set(cx, cz, cell(cx, cz));
    const before = {};
    for (let cz = -1; cz <= 1; cz++) for (const cx of [0, 1]) before[`${cx},${cz}`] = map.slotOf(cx, cz);
    map.centre(1, 0);
    for (const [k, s] of Object.entries(before)) {
      const [cx, cz] = k.split(',').map(Number);
      expect(map.slotOf(cx, cz)).toBe(s);
    }
    // (the column that left is gone; the one that came takes its slots)
    expect(map.slotOf(-1, 0)).toBe(-1);
    expect(map.uniforms.uLandCentre.value.toArray()).toEqual([1, 0]);
    map.dispose();
  });

  it('gives the shader its reads', () => {
    for (const fn of ['vec4 landMask(vec2 xz)', 'float landWater(vec2 xz)', 'float landHeight(vec2 xz)', 'vec3 landColour(vec4 mask, float slope, float h)', 'float groundHeight(vec2 xz)', 'vec3 groundColour(vec2 xz)', 'float groundGrass(vec2 xz)']) expect(LAND_GLSL).toContain(fn);
    const map = createLandMap({ radius: 1, palette: spec.palette });
    expect(map.ground.glsl).toBe(LAND_GLSL);
    for (const u of ['uLandMasks', 'uLandWaters', 'uLandHeights', 'uLandCentre', 'uLandOffset', 'uLandRadius', 'uLandDirt', 'uLandDeep']) expect(map.uniforms[u]).toBeTruthy();
    map.dispose();
  });

  it('grows grass on it', () => {
    const map = createLandMap({ radius: 1, palette: spec.palette });
    const wind = createWind();
    const grass = createGrass({ ground: map.ground, wind, side: 8, size: 8 });
    const sh = { uniforms: {}, vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };
    grass.material.onBeforeCompile(sh);
    expect(sh.vertexShader).toContain('vec4 landMask(vec2 xz)');
    expect(sh.vertexShader).not.toContain('uniform sampler2D uGroundMap;');
    expect(sh.uniforms.uLandMasks).toBe(map.uniforms.uLandMasks);
    grass.dispose();
    wind.dispose();
    map.dispose();
  });
});
