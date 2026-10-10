import { describe, expect, it } from 'vitest';
import { dressingOf, stemOf, textureArg } from './bf2017-dress.mjs';

const NAMES = [
  'Objects/Nature/Forest/_ForestBase/_TerrainTextures/T_ForestBase_Roots_01_C',
  'Objects/Nature/Forest/_ForestBase/_TerrainTextures/T_ForestBase_Roots_01_N',
  'Objects/Nature/Forest/_ForestBase/_MeshScattering/MS_ForestBase_Fern_01/T_MS_ForestBase_Fern_01_C',
  'Objects/Nature/Forest/_ForestBase/ForestBase_BackdropCloud_01/T_ForestBase_BackdropCloud_01_C',
  'Objects/Nature/Volcanic/Sullustan/_MeshScatter/MS_VolcanicCrater_SandRough_01/T_MS_VolcanicCrater_SandRough_01_CA',
  'Objects/Nature/Volcanic/Sullustan/_MeshScatter/MS_VolcanicCrater_SandRough_01/T_MS_VolcanicCrater_SandRough_01_NA',
  'Objects/Nature/Kashyyyk/_KashyyykBase/_TerrainTextures/T_KashyyykBase_Roots_01_C',
  'Objects/Nature/Kashyyyk/_KashyyykBase/KashyyykBase_TreeGiant_01/T_KAS_InteriorMetalTrim_A_01_CS',
];
const bare = (shader) => ({ name: 'MeshMaterial', shader, textures: {} });

describe('a bare material dressed by its shader’s name', () => {
  it('takes the stem from the shader’s preset', () => {
    expect(stemOf('Objects/Nature/Forest/_ForestBase/ForestBase_Roots_01/SS_ForestBase_Roots_01')).toBe('ForestBase_Roots_01');
    expect(stemOf('X/MS_Fern_01')).toBe('Fern_01');
  });

  it('finds the stem’s colour map and the normal beside it', () => {
    const d = dressingOf([bare('Objects/Nature/Forest/_ForestBase/ForestBase_Roots_01/SS_ForestBase_Roots_01')], { names: NAMES });
    expect(d).toEqual({
      'shader:Objects/Nature/Forest/_ForestBase/ForestBase_Roots_01/SS_ForestBase_Roots_01': [
        { slot: 'color', name: NAMES[0] },
        { slot: 'normal', name: NAMES[1] },
      ],
    });
  });

  it('finds a mesh-scatter map (`T_MS_<stem>`), and a colour map in the shader’s own folder', () => {
    expect(dressingOf([bare('Objects/Nature/Forest/_ForestBase/_MeshScattering/MS_ForestBase_Fern_01/SS_MS_ForestBase_Fern_01')], { names: NAMES })['shader:Objects/Nature/Forest/_ForestBase/_MeshScattering/MS_ForestBase_Fern_01/SS_MS_ForestBase_Fern_01'][0].name).toBe(NAMES[2]);
    const folder = dressingOf([bare('Objects/Nature/Volcanic/Sullustan/_MeshScatter/MS_VolcanicCrater_SandRough_01/SS_Crater_SandRough')], { names: NAMES });
    expect(Object.values(folder)[0].map((m) => m.name)).toEqual([NAMES[4], NAMES[5]]);
  });

  it('drops words from a mesh-named preset’s middle to the base’s maps, and never takes a folder map of another subject', () => {
    const roots = dressingOf([bare('Objects/Nature/Kashyyyk/_KashyyykBase/KashyyykBase_TreeGiant_01/SS_MS_KashyyykBase_TreeGiant_01_Roots_01')], { names: NAMES });
    expect(Object.values(roots)[0][0].name).toBe(NAMES[6]);
    expect(dressingOf([bare('Objects/Nature/Kashyyyk/_KashyyykBase/KashyyykBase_TreeGiant_01/SS_Bark_Moss')], { names: NAMES })).toEqual({});
  });

  it('dresses only what the bucket holds, and never a material with maps of its own', () => {
    const cloud = 'Objects/Nature/Forest/_ForestBase/ForestBase_BackdropCloud_01/SS_ForestBase_BackdropCloud_01';
    expect(dressingOf([bare(cloud)], { names: NAMES, uploaded: () => false })).toEqual({});
    // (a normal only where its derived `__normal` is there)
    const d = dressingOf([bare('Objects/Nature/Forest/_ForestBase/ForestBase_Roots_01/SS_ForestBase_Roots_01')], { names: NAMES, uploaded: (n, slot) => slot === 'color' });
    expect(Object.values(d)[0]).toEqual([{ slot: 'color', name: NAMES[0] }]);
    expect(dressingOf([{ shader: cloud, textures: { color: 'x' } }], { names: NAMES })).toEqual({});
    expect(textureArg(d)).toBe(`shader:Objects/Nature/Forest/_ForestBase/ForestBase_Roots_01/SS_ForestBase_Roots_01=color:${NAMES[0]}`);
  });
});
