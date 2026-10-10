import { describe, expect, it } from 'vitest';
import naboo from '../fixtures/bf2017/decals/naboo.extras.json';
import endor from '../fixtures/bf2017/decals/endor.extras.json';
import { colourOf, decalsOf, readDecal, rebaseDecal } from './bf2017-decals.mjs';

const ORIGIN = [640, 400, 300];
const all = (json) => Object.values(json.cells).flat();

describe('decalsOf: Naboo’s ten', () => {
  const json = decalsOf(naboo, { origin: ORIGIN, yaw: 0, cell: 128 });
  it('every one kept, in the cell its rebased position falls in', () => {
    expect(json.count).toBe(10);
    expect(json.kinds).toEqual({ projected: 10, volume: 0 });
    for (const [key, list] of Object.entries(json.cells)) {
      for (const d of list) expect(`${Math.floor(d.position[0] / 128)},${Math.floor(d.position[2] / 128)}`).toBe(key);
    }
    // the first: (708.505, 447.741, 328.038) less the origin
    const first = all(json).find((d) => Math.abs(d.position[0] - 68.51) < 0.01);
    expect(first.position).toEqual([68.51, 47.74, 28.04]);
    expect(Object.keys(json.cells)).toContain('0,0');
  });
  it('the size is the box’s scale, the texture the shader’s colour map', () => {
    const d = all(json).find((x) => x.shader.endsWith('SS_BlasterHole_Decal_01'));
    expect(d.size).toHaveLength(3);
    expect(d.texture).toBe('FX/Decals/EnvDecals/T_BlasterHole_RGB_01');
    expect(d.kind).toBe('projected');
    expect(d.opacity).toBe(1);
  });
  it('textures are distinct, and each names its KTX2 in the bucket', () => {
    expect(json.textures).toEqual(['FX/Decals/EnvDecals/T_BlasterHole_RGB_01', 'FX/Decals/EnvDecals/T_BlasterStreak_RGB_01']);
    expect(json.files['FX/Decals/EnvDecals/T_BlasterHole_RGB_01']).toBe('textures/fx/decals/envdecals/t_blasterhole_rgb_01.ktx2');
  });
  it('a decal whose shader binds no colour map is dropped and counted', () => {
    const extras = { ...naboo, decals: [...naboo.decals, { ...naboo.decals[0], shader: 'FX/Decals/EnvDecals/SS_Unknown_01' }] };
    const out = decalsOf(extras, { origin: ORIGIN });
    expect(out.count).toBe(10);
    expect(out.skipped.texture).toBe(1);
  });
  it('the subworlds that are not the arena are left out', () => {
    const subworlds = [];
    subworlds[0] = 'Levels/MP/Naboo_01/Naboo_01';
    subworlds[15] = 'Levels/MP/Naboo_01/Cinematics';
    const out = decalsOf(naboo, { origin: ORIGIN }, { subworlds });
    expect(out.count).toBe(6);
    expect(out.skipped.sub).toBe(4);
  });
  it('outside the arena is left out', () => {
    const out = decalsOf(naboo, { origin: [0, 0, 0], arena: 100, cell: 128 });
    expect(out.count).toBe(0);
    expect(out.skipped.outside).toBe(10);
  });
});

describe('rebaseDecal', () => {
  it('turned by the pack’s yaw: the position, the quaternion and the projection’s normal together', () => {
    const d = readDecal(naboo.decals[4], naboo);
    const a = rebaseDecal(d, ORIGIN, 0);
    const b = rebaseDecal(d, ORIGIN, Math.PI / 2);
    // Ry(90°): (x, y, z) → (z, y, −x)
    expect(b.position[0]).toBeCloseTo(a.position[2], 6);
    expect(b.position[2]).toBeCloseTo(-a.position[0], 6);
    expect(b.normal[0]).toBeCloseTo(a.normal[2], 6);
    expect(b.normal[1]).toBeCloseTo(a.normal[1], 6);
    expect(b.normal[2]).toBeCloseTo(-a.normal[0], 6);
    expect(Math.hypot(...b.quaternion)).toBeCloseTo(1, 4); // (the record stores five decimals)
  });
});

describe('volume decals (Endor)', () => {
  const json = decalsOf(endor, { origin: [400, 190, 700] });
  it('the burnt one kept with its alpha and the template’s colour map; the normal-only one dropped', () => {
    expect(json.kinds).toEqual({ projected: 0, volume: 1 });
    expect(json.skipped.texture).toBe(1);
    const [d] = all(json);
    expect(d.kind).toBe('volume');
    expect(d.texture).toBe('FX/Decals/VolumeDecals/Textures/T_Burnt_01_RGB');
    expect(d.opacity).toBe(1);
    expect(d.template).toBe('FX/Decals/VolumeDecals/Templates/DV_DamageBurningTri_01');
  });
});

describe('colourOf', () => {
  it('skips the defaults, ramps, noise and masks; prefers a colour suffix', () => {
    expect(colourOf(['FX/StandardShaders/T_BlackBodyRamps_01_M', 'FX/Decals/EnvDecals/T_BlasterHole_RGB_01'])).toBe('FX/Decals/EnvDecals/T_BlasterHole_RGB_01');
    expect(colourOf(['shaders/T_DefaultBlack_RGBA'])).toBe(null);
    expect(colourOf(['FX/Decals/VolumeDecals/Textures/Perlin/T_PerlinNoise_Array_01_M'])).toBe(null);
    expect(colourOf([])).toBe(null);
  });
});
