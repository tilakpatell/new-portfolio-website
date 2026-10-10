import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countFamilies, mapsWanted, recipeOf, recipesOf } from './bf2017-recipes.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/bf2017/materials');
const row = (name) => JSON.parse(readFileSync(join(DIR, `${name}.jsonl`), 'utf8').trim());
const src = (r, i, p) => `materials.jsonl:${r.mesh}#${i}.${p}`;

describe('recipeOf', () => {
  it('a prop with a detail normal: its tiling and where it came from', () => {
    const r = row('props');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('propsNonMetallic');
    expect(x.shader).toBe('Shaders/Presets/SS_PropsNonMetallicPreset_DetailMap');
    expect(x.maps.detail).toBe('Objects/Props/_CommonTextures/T_MetalDetail_02_NS');
    expect(x.params.detail.tiling).toEqual([2, 2]);
    expect(x._source['params.detail.tiling']).toBe(src(r, 0, 'NormalDetailScalar'));
    expect(x._source['maps.detail']).toBe(src(r, 0, 'NS'));
    // (the strength the dump lacks is the named default)
    expect(x.params.detail.strength).toBe(1);
    expect(x._source['params.detail.strength']).toBe('families.js:DETAIL_STRENGTH');
  });

  it('a wrecked large vehicle: paint, metal, grunge, scorch', () => {
    const r = row('vehicle');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('vehicleLarge');
    expect(x.params.wreck).toBe(true);
    expect(x._source['params.wreck']).toBe(src(r, 0, 'ESB_VehicleIsWreck'));
    expect(x.params.scorch.ember).toBe(1000);
    expect(x.params.paint).toEqual([1, 1, 1]);
    expect(x.params.metal[0]).toBeCloseTo(0.6024, 4);
    expect(x.params.grunge.color).toEqual([1, 1, 1]);
    expect(x.params.detail.tiling).toEqual([20, 20]);
    expect(x.params.breakup.tiling).toEqual([40, 40]);
    expect(x.maps.detail).toBe('Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_MetalBare_01_NW');
    expect(x.maps.grunge).toBe('Objects/Architecture/Rebel/MC80/_Shaders/T_MetalGrunge_01_N');
    expect(x.maps.mask).toBe('Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_SmallCanon_01_M01');
  });

  it('a character: the detail array and its slice by the median', () => {
    const r = row('character');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('character');
    expect(x.maps.detailArray).toBe('Characters/DetailMaps/TA_CharacterDetail_17_NS');
    expect(x.maps.detailSlice).toBe('median');
    expect(x.maps.aoSlice).toBe('Characters/Hero/Iden/Act3/Iden_Act3_01/Texture/T_Iden_Act3_01_AOSL');
    expect(x.maps.weathering).toBe('Characters/Hero/Iden/Act3/Iden_Act3_01/Texture/T_Iden_Act3_01_W');
    // (per slice: the slice's own component once the median is known; x until then)
    expect(x.params.detail.tiling).toEqual([13, 13]);
    expect(x.params.detail.perSlice.tiling).toEqual([13, 24, 12]);
  });

  it('vegetation: translucency, alpha test from the colour + alpha map, both sides', () => {
    const r = row('vegetation');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('vegetation');
    expect(x.params.backface.subsurface).toBe(2);
    expect(x.params.backface.smoothness).toBeCloseTo(0.8, 5);
    expect(x.params.alphaTest).toBe(true);
    expect(x._source['params.alphaTest']).toBe(src(r, 0, '_BaseColor'));
    expect(x.params.doubleSided).toBe(true);
    expect(x.params.reflectance).toEqual({ up: 0.30000001192092896, down: 0.30000001192092896 });
  });

  it('an emissive alpha-tested light: colour times intensity from the rgb vector', () => {
    const r = row('emissive');
    const [lamp, body] = recipesOf(r);
    expect(lamp.family).toBe('emissive');
    expect(lamp.params.emissive.intensity).toBe(333209.96875);
    expect(lamp.params.emissive.color[2]).toBe(1);
    expect(lamp.params.emissive.color[0]).toBeCloseTo(127814.1953125 / 333209.96875, 6);
    expect(lamp.params.emissive.mode).toBe('baseColor');
    expect(lamp._source['params.emissive.intensity']).toBe(src(r, 0, 'EmissiveIntensety'));
    expect(lamp.params.alphaTest).toBe(true);
    expect(lamp._source['params.alphaTest']).toBe(src(r, 0, 'AlphaOnOff'));
    expect(body.family).toBe('propsMetallic');
    expect(body.params.detail.tiling).toEqual([1, 1]);
    expect(body.params.alphaTest).toBe(false);
  });

  it('a material with no slots keeps the GLB', () => {
    const x = recipeOf(row('glb'), 0);
    expect(x.family).toBe('glb');
    expect(x.maps).toEqual({});
    expect(x.params).toEqual({});
  });
});

describe('mapsWanted', () => {
  it('names each wanted map once with its kind', () => {
    const all = ['props', 'vehicle', 'character', 'vegetation', 'emissive', 'glb'].flatMap((n) => recipesOf(row(n)));
    const wanted = mapsWanted(all);
    const names = wanted.map((w) => w.name);
    expect(new Set(names).size).toBe(names.length);
    const kind = Object.fromEntries(wanted.map((w) => [w.name, w.kind]));
    expect(kind['Objects/Props/_CommonTextures/T_MetalDetail_02_NS']).toBe('detail');
    expect(kind['Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_MetalBare_01_NW']).toBe('detail');
    expect(kind['Objects/Architecture/Rebel/MC80/_Shaders/T_MetalGrunge_01_N']).toBe('overlay');
    expect(kind['Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_SmallCanon_01_M01']).toBe('mask');
    expect(kind['Characters/DetailMaps/TA_CharacterDetail_17_NS']).toBe('array');
    expect(kind['Characters/Hero/Iden/Act3/Iden_Act3_01/Texture/T_Iden_Act3_01_W']).toBe('mask');
    // (the engine's default black is never fetched)
    expect(names.some((n) => /T_Default/i.test(n))).toBe(false);
  });
});

describe('countFamilies', () => {
  it('counts the families over rows', () => {
    const c = countFamilies(['props', 'emissive', 'glb'].map(row));
    expect(c).toEqual({ propsNonMetallic: 1, emissive: 1, propsMetallic: 1, glb: 1 });
  });
});
