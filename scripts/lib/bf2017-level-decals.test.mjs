import { describe, expect, it } from 'vitest';
import { decalsJson, decalTexture } from './bf2017-level-decals.mjs';

// Endor_01's extras, cut to three decals: a burn, a normal-only dent, and a
// burn whose texture the bucket's listing lacks
const BURN = 'FX/Decals/VolumeDecals/Templates/DV_DamageBurningTri_01';
const DENT = 'FX/Decals/VolumeDecals/Templates/DV_BumpedMetal_01';
const extras = {
  decals: [
    { type: 'volume', template: BURN, row: 0, column: 0, alpha: 1, sub: 0, position: [110, 5, 330], quaternion: [0, 0, 0, 1], scale: [4, 1, 4] },
    { type: 'volume', template: DENT, row: 0, column: 0, alpha: 1, sub: 0, position: [110, 5, 210], quaternion: [0, 0, 0, 1], scale: [10, 1.5, 10] },
    { type: 'volume', template: 'FX/Decals/VolumeDecals/Templates/DV_Scorch_02', alpha: 0.5, sub: 0, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
    { type: 'volume', template: BURN, alpha: 1, sub: 1, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
  ],
  decalTemplates: {
    [BURN]: { Shader: { Shader: 'FX/Decals/VolumeDecals/Shaders/SS_vDecal_DamageBurningTri_01' } },
    [DENT]: { Shader: { Shader: 'FX/Decals/VolumeDecals/Shaders/SS_vDecal_NormalOnly_01' } },
    'FX/Decals/VolumeDecals/Templates/DV_Scorch_02': { Shader: { Shader: 'FX/Decals/VolumeDecals/Shaders/SS_vDecal_Scorch_02' } },
  },
  shaderTextures: {
    'FX/Decals/VolumeDecals/Shaders/SS_vDecal_DamageBurningTri_01': ['FX/StandardShaders/T_BlackBodyRamps_01_M', 'FX/Decals/VolumeDecals/Textures/Perlin/T_PerlinNoise_Array_01_M', 'FX/Decals/VolumeDecals/Textures/T_Burnt_01_RGB'],
    'FX/Decals/VolumeDecals/Shaders/SS_vDecal_NormalOnly_01': ['shaders/T_DefaultBlack_RGBA'],
    'FX/Decals/VolumeDecals/Shaders/SS_vDecal_Scorch_02': ['FX/Decals/VolumeDecals/Textures/T_Scorch_02_C'],
  },
  textureFiles: {
    'FX/Decals/VolumeDecals/Textures/T_Burnt_01_RGB': 'textures/fx/decals/volumedecals/textures/t_burnt_01_rgb.ktx2',
    'FX/Decals/VolumeDecals/Textures/T_Scorch_02_C': 'textures/fx/decals/volumedecals/textures/t_scorch_02_c.ktx2',
    'shaders/T_DefaultBlack_RGBA': 'textures/shaders/t_defaultblack_rgba.ktx2',
  },
};
const subworlds = ['Levels/MP/Endor_01/Shared_Art', 'Levels/MP/Endor_01/Lobby'];
const pack = { origin: [100, 2, 200], yaw: 0, cell: 128, arena: 1024 };
const listing = new Set(['web/textures/fx/decals/volumedecals/textures/t_burnt_01_rgb.ktx2']);

describe('the map’s placed decals', () => {
  it('finds a decal’s colour among its shader’s textures, and none for a normal-only one', () => {
    expect(decalTexture(extras, extras.decals[0])).toBe('textures/fx/decals/volumedecals/textures/t_burnt_01_rgb.ktx2');
    expect(decalTexture(extras, extras.decals[1])).toBe(null);
  });

  it('puts a volume decal’s box in the pack’s frame, by cell', () => {
    const j = decalsJson(extras, pack, { listing, subworlds, subs: ['shared_art'] });
    expect(j.decals).toEqual([{ kind: 'volume', position: [10, 3, 130], quaternion: [0, 0, 0, 1], scale: [4, 1, 4], tex: 'textures/fx/decals/volumedecals/textures/t_burnt_01_rgb.ktx2', alpha: 1, cell: '0,1' }]);
  });

  it('skips and counts a decal whose texture the bucket lacks, one with no colour, and one in another sub-level', () => {
    const j = decalsJson(extras, pack, { listing, subworlds, subs: ['shared_art'] });
    expect(j.skipped).toEqual({ 'normal only': 1, 'not in the bucket': 1, 'another sub-level': 1 });
    expect(j.missing).toEqual(['textures/fx/decals/volumedecals/textures/t_scorch_02_c.ktx2']);
  });
});
