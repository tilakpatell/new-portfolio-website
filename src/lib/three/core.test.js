import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CORE, coreFiles, coreOf, dress, meanColour, rolesFor, wear, wearShader } from './core';

const scan = { map: new THREE.Texture(), normalMap: new THREE.Texture() };
const STUB = {
  vertexShader: '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n#include <normal_fragment_maps>\n}',
};

describe('the core surfaces every world wears', () => {
  it('are one kit of scans, each at its real size and centred brightness', () => {
    for (const role of ['stone', 'wood', 'bark', 'adobe', 'metal', 'grass', 'rock', 'concrete']) {
      expect(CORE[role], role).toBeTruthy();
      expect(coreOf(role).metres).toBeGreaterThan(0);
      expect(coreOf(role).mean).toBeGreaterThan(0.5);
    }
    expect(coreOf('nonsense')).toBe(null);
  });

  it('are laid on in the world, three ways, darkening and lightening the material’s own colour, with their relief', () => {
    const out = wearShader(STUB, { normal: true });
    expect(out.swapped).toEqual({ colour: true, normal: true });
    expect(out.vertexShader).toContain('vCorePos = ');
    expect(out.fragmentShader).toContain('diffuseColor.rgb *= mix(vec3(1.0), cc / uCoreMean, uCoreStrength);');
    expect(out.fragmentShader).toContain('normal = normalize(normal + shift * faceDirection);');
    expect(wearShader(STUB, { normal: false }).fragmentShader).not.toContain('faceDirection');
  });

  it('work on three’s own lit shaders', () => {
    for (const kind of ['meshlambert', 'meshphysical', 'meshphong']) {
      const out = wearShader({ vertexShader: THREE.ShaderChunk[`${kind}_vert`], fragmentShader: THREE.ShaderChunk[`${kind}_frag`] }, { normal: true });
      expect(out.swapped, kind).toEqual({ colour: true, normal: true });
    }
  });

  it('go on a lit material once, and never on an unlit one', () => {
    const m = new THREE.MeshLambertMaterial();
    wear(m, scan, { metres: 3, mean: 0.8 });
    wear(m, scan, { metres: 3, mean: 0.8 });
    const sh = { ...STUB, uniforms: {} };
    m.onBeforeCompile(sh);
    expect(sh.fragmentShader.split('cc / uCoreMean').length).toBe(2);
    expect(sh.uniforms.uCoreScale.value).toBeCloseTo(1 / 3);
    // (the mean is sRGB; the map is read linear)
    expect(sh.uniforms.uCoreMean.value).toBeCloseTo(0.8 ** 2.2, 5);
    expect(m.customProgramCacheKey()).toMatch(/\|core:n$/);
    const basic = new THREE.MeshBasicMaterial();
    wear(basic, scan);
    expect(basic.userData.core).toBeUndefined();
  });

  it('goes on a copy of a worn material made later (the copy isn’t marked as worn)', () => {
    const m = new THREE.MeshStandardMaterial();
    wear(m, scan, { metres: 3 });
    const copy = m.clone();
    expect(copy.userData.core).toBeUndefined();
    wear(copy, scan, { metres: 3 });
    expect(copy.userData.core.uCoreScale.value).toBeCloseTo(1 / 3);
  });
});

describe('a world dressed in the core kit', () => {
  // a 2x2 picture of one colour, as a DataTexture
  const flat = (r, g, b) => {
    const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255, r, g, b, 255, r, g, b, 255, r, g, b, 255]), 2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  it('reads a picture’s mean colour', () => {
    const c = meanColour(flat(255, 128, 0));
    expect(c.r).toBeCloseTo(1, 3);
    expect(c.g).toBeCloseTo(new THREE.Color('#808080').g, 3);
    expect(c.b).toBeCloseTo(0, 3);
    expect(meanColour(null)).toBe(null);
  });

  it('folds a material’s own picture into its colour and puts the role’s scan on instead', async () => {
    const stone = new THREE.MeshStandardMaterial({ map: flat(200, 180, 160), normalMap: new THREE.Texture(), color: 0xffffff });
    const tinted = new THREE.MeshStandardMaterial({ map: flat(255, 255, 255), color: 0x806040 });
    const left = new THREE.MeshStandardMaterial({ color: 0x123456 });
    const loads = [];
    const done = await dress({ stone, tinted, left }, { stone: 'stone', tinted: 'wood' }, { load: (role) => (loads.push(role), Promise.resolve(scan)) });
    expect(loads.sort()).toEqual(['stone', 'wood']);
    expect(done).toBe(2);
    expect(stone.map).toBe(null);
    expect(stone.normalMap).toBe(null);
    expect(stone.color.getHexString()).toBe('c8b4a0');
    expect(tinted.color.getHexString()).toBe('806040');
    expect(stone.userData.core).toBeTruthy();
    expect(left.userData.core).toBeUndefined();
  });

  it('with `keep`, leaves the material its own picture and relief (cobbles, ruts) and lays the scan’s grain over them', async () => {
    const map = flat(200, 180, 160);
    const normalMap = new THREE.Texture();
    const road = new THREE.MeshStandardMaterial({ map, normalMap, color: 0xffffff });
    const done = await dress({ road }, { road: 'gravel' }, { keep: true, load: () => Promise.resolve(scan) });
    expect(done).toBe(1);
    expect(road.map).toBe(map);
    expect(road.normalMap).toBe(normalMap);
    expect(road.color.getHexString()).toBe('ffffff');
    expect(road.userData.core).toBeTruthy();
  });

  it('with `keep`, puts the scan’s shader on at once and its pictures in once they’ve loaded: the shader the first frame is drawn with stays', async () => {
    const road = new THREE.MeshStandardMaterial({ color: 0xffffff });
    let arrive;
    const done = dress({ road }, { road: 'gravel' }, { keep: true, load: () => new Promise((resolve) => (arrive = resolve)) });
    const core = road.userData.core;
    expect(core).toBeTruthy(); // before the scan is in
    const key = road.customProgramCacheKey();
    const patch = road.onBeforeCompile;
    const version = road.version;
    // (meanwhile a stand-in at the scan's centred brightness and a flat relief: the material looks as it did)
    expect(core.uCoreMap.value).not.toBe(scan.map);
    expect(core.uCoreMap.value.image.data[0] / 255).toBeCloseTo(core.uCoreMean.value, 2);
    arrive(scan);
    expect(await done).toBe(1);
    expect(core.uCoreMap.value).toBe(scan.map);
    expect(core.uCoreNormal.value).toBe(scan.normalMap);
    expect(road.customProgramCacheKey()).toBe(key);
    expect(road.onBeforeCompile).toBe(patch);
    expect(road.version).toBe(version);
  });

  it('with `keep`, where a scan can’t be had, leaves its stand-in on and doing nothing', async () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const done = await dress({ m }, { m: 'stone' }, { keep: true, load: () => Promise.resolve(null) });
    expect(done).toBe(0);
    expect(m.userData.core.uCoreStrength.value).toBe(0);
    expect(m.userData.core.uCoreNormalStrength.value).toBe(0);
  });

  it('keeps the material as it was where a scan can’t be had', async () => {
    const m = new THREE.MeshStandardMaterial({ map: flat(10, 20, 30) });
    const done = await dress({ m }, { m: 'stone' }, { load: () => Promise.resolve(null) });
    expect(done).toBe(0);
    expect(m.map).not.toBe(null);
  });
});

describe('which core surface a world’s material wears, by its name', () => {
  it('reads the usual names of a world’s materials', () => {
    const m = () => new THREE.MeshStandardMaterial();
    const mats = { stone: m(), paving: m(), hearthStone: m(), timber: m(), hallBeam: m(), logs: m(), bark: m(), turf: m(), plaster: m(), iron: m(), rock: m(), thatch: m(), gollumSkin: m(), eagleEye: m(), towerGlow: m(), banner: m() };
    expect(rolesFor(mats)).toEqual({ stone: 'stone', paving: 'stone', hearthStone: 'stone', timber: 'wood', hallBeam: 'wood', logs: 'wood', bark: 'bark', turf: 'grass', plaster: 'adobe', iron: 'metal', rock: 'rock' });
  });

  it('leaves alone what glows, what is see-through, and what isn’t lit', () => {
    const glowing = new THREE.MeshStandardMaterial({ emissive: 0xff8800, emissiveIntensity: 1 });
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4 });
    const basic = new THREE.MeshBasicMaterial();
    expect(rolesFor({ stone: glowing, wall: glass, rock: basic })).toEqual({});
  });
});

describe('what keeps its own picture', () => {
  it('a material lit from within by a map (lit windows) wears nothing', () => {
    const house = new THREE.MeshStandardMaterial({ emissiveMap: new THREE.Texture(), emissiveIntensity: 0 });
    expect(rolesFor({ house })).toEqual({});
  });

  it('a material cut out by its picture (a road’s ragged edge) wears nothing: its picture is its shape', () => {
    const road = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), alphaTest: 0.5 });
    const path = new THREE.MeshStandardMaterial({ alphaMap: new THREE.Texture() });
    const gravel = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    expect(rolesFor({ road, path, gravel })).toEqual({ gravel: 'gravel' });
  });
});

describe("a scan's files", () => {
  const index = { sand: { metres: 2, arm: true }, snow: { metres: 2, xl: 'ktx2' }, mud: { metres: 2, xl: 'webp' } };

  it('are the 1K WebPs, unless the 8192 set is asked for', () => {
    expect(coreFiles('snow', { index })).toEqual({ color: '/cc0/galaxy/snow/color.webp', normal: '/cc0/galaxy/snow/normal.webp', arm: null });
    expect(coreFiles('sand', { index }).arm).toBe('/cc0/galaxy/sand/arm.webp');
  });

  it("are the 8192 set's at ultra, in the kind it was made in", () => {
    expect(coreFiles('snow', { xl: true, index })).toMatchObject({ color: '/cc0/galaxy/snow/color-xl.ktx2', normal: '/cc0/galaxy/snow/normal-xl.ktx2' });
    expect(coreFiles('mud', { xl: true, index })).toMatchObject({ color: '/cc0/galaxy/mud/color-xl.webp' });
  });

  it("stay the 1K set where there's no 8192 set made yet", () => {
    expect(coreFiles('sand', { xl: true, index }).color).toBe('/cc0/galaxy/sand/color.webp');
    expect(coreFiles('nonsense', { xl: true, index }).color).toBe('/cc0/galaxy/nonsense/color.webp');
  });
});
