import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WIND } from '../../../lib/three/foliage';
import { NATURE, isTintable, natureLook, natureMaterials, natureTick, pushShader } from './nature';

// (the page-wide sharing is by name: each test's own materials named for it alone)
let n = 0;
const named = (name) => `${name}_${++n}`;
const mesh = (name, { vc = true, cut = 0 } = {}) => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name, vertexColors: vc, alphaTest: cut, map: new THREE.Texture(), side: cut ? THREE.DoubleSide : THREE.FrontSide }));
const file = (...meshes) => ({ scene: new THREE.Group().add(...meshes) });
const base = (name, opts) => new THREE.MeshStandardMaterial({ name, vertexColors: true, map: new THREE.Texture(), ...opts });

describe('the push', () => {
  it('pushes a vertex away from you, after three’s begin_vertex', () => {
    const out = pushShader({ vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}', fragmentShader: 'f' });
    expect(out.swapped.push).toBe(true);
    expect(out.vertexShader).toContain('uniform vec3 uPush;');
    expect(out.vertexShader).toContain('uniform float uPushR;');
    expect(out.vertexShader.indexOf('uPushR * 0.3')).toBeGreaterThan(out.vertexShader.indexOf('#include <begin_vertex>'));
    expect(out.fragmentShader).toBe('f');
  });

  it('leaves a shader without begin_vertex alone', () => {
    const vs = 'void main(){}';
    expect(pushShader({ vertexShader: vs, fragmentShader: '' })).toEqual({ vertexShader: vs, fragmentShader: '', swapped: { push: false } });
  });
});

describe('a nature file as it loads', () => {
  it('shares each material by its name across the files, freeing the copy', () => {
    const name = named('Leaves');
    const a = file(mesh(name, { cut: 0.35 }));
    const b = file(mesh(name, { cut: 0.35 }), mesh(named('Flowers'), { cut: 0.35 }));
    const copy = b.scene.children[0].material;
    let freed = 0;
    copy.map.addEventListener('dispose', () => freed++);
    natureLook(a);
    natureLook(b);
    expect(b.scene.children[0].material).toBe(a.scene.children[0].material);
    expect(freed).toBe(1);
    expect(b.scene.children[1].material.name).toMatch(/^Flowers/);
  });

  it('never shares one with vertex colours with one without', () => {
    const name = named('Rocks');
    const a = file(mesh(name, { vc: true }));
    const b = file(mesh(name, { vc: false }));
    natureLook(a);
    natureLook(b);
    expect(b.scene.children[0].material).not.toBe(a.scene.children[0].material);
  });

  it('leaves the shared materials as they came: each world dresses its own copies', () => {
    const g = file(mesh(named('Leaves_Look'), { cut: 0.35 }));
    natureLook(g, { sway: 'shrub' });
    const m = g.scene.children[0].material;
    expect(m.userData.wind).toBeUndefined();
    expect(m.userData.push).toBeUndefined();
  });

  it('stands its quantized geometry in metres from its foot, the node’s transform baked in', () => {
    // (as meshopt writes it: positions in [-1, 1], the node scaled and moved to the model's box)
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Int16Array([0, -32767, 0, 0, 32767, 0, 32767, 0, 0]), 3, true));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 127, 0, 0, 127, 0, 0, 127, 0]), 3, true));
    const o = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: named('Bark_Q') }));
    o.scale.setScalar(6);
    o.position.set(0.5, 6, -0.25);
    natureLook(file(o));
    const pos = o.geometry.attributes.position;
    expect(pos.array).toBeInstanceOf(Float32Array);
    expect(pos.normalized).toBe(false);
    expect(pos.getY(0)).toBeCloseTo(0, 3);
    expect(pos.getY(1)).toBeCloseTo(12, 3);
    expect(pos.getX(2)).toBeCloseTo(6.5, 3);
    expect(pos.getZ(2)).toBeCloseTo(-0.25, 3);
    expect(o.geometry.attributes.normal.getY(0)).toBeCloseTo(1, 3);
    expect(o.position.lengthSq()).toBe(0);
    expect(o.scale.x).toBe(1);
  });
});

describe('a world’s own copies of the nature materials', () => {
  it('dresses a copy for this world, sharing the pictures, the same one each time it’s asked', () => {
    const m = base(named('Leaves_Mine'), { alphaTest: 0.35, side: THREE.DoubleSide });
    m.userData.skyFog = true; // (as if another world had fogged the shared one)
    const mine = natureMaterials();
    const a = mine(m, 'tree');
    expect(a).not.toBe(m);
    expect(a.map).toBe(m.map);
    expect(mine(m, 'tree')).toBe(a);
    expect(a.userData.skyFog).toBeUndefined();
    expect(a.userData.wind).toBeTruthy();
    expect(m.userData.wind).toBeUndefined();
    // (another world, another copy, fogged and lit as that world)
    expect(natureMaterials()(m, 'tree')).not.toBe(a);
  });

  it('moves every part of a model by the model’s own sway: a bush’s leaves and flowers together, pushed', () => {
    const mine = natureMaterials();
    const leaves = mine(base(named('Leaves_NormalTree'), { alphaTest: 0.35, side: THREE.DoubleSide }), 'shrub');
    const flowers = mine(base('Flowers', { alphaTest: 0.35, side: THREE.DoubleSide }), 'shrub');
    for (const m of [leaves, flowers]) {
      expect(m.userData.wind.uWindHeight.value).toBe(WIND.shrub.height);
      expect(m.userData.push).toBe(true);
    }
  });

  it('sways a tree’s leaves and branches together, and never pushes them', () => {
    const mine = natureMaterials();
    const leaves = mine(base(named('Leaves_TwistedTree'), { alphaTest: 0.35, side: THREE.DoubleSide }), 'tree');
    const bark = mine(base(named('Bark_TwistedTree')), 'tree');
    expect(leaves.userData.wind.uWindHeight.value).toBe(bark.userData.wind.uWindHeight.value);
    expect(leaves.userData.wind.uWindStrength.value).toBe(bark.userData.wind.uWindStrength.value);
    expect(bark.userData.wind.uWindLeafAmp.value).toBe(0);
    expect(leaves.userData.wind.uWindDir).toBe(NATURE.dir);
    expect(leaves.userData.wind.uWindTime).toBe(NATURE.time);
    expect(leaves.userData.push).toBeUndefined();
  });

  it('gives a tree-leaf material a copy for a tree and another for a bush', () => {
    const mine = natureMaterials();
    const m = base(named('Leaves_Both'), { alphaTest: 0.35, side: THREE.DoubleSide });
    expect(mine(m, 'tree')).not.toBe(mine(m, 'shrub'));
  });

  it('lights the leaves as leaves, the grass by its own numbers, and marks what takes a tint', () => {
    const mine = natureMaterials();
    const plant = mine(base('Leaves', { alphaTest: 0.35, side: THREE.DoubleSide }), 'shrub');
    const grass = mine(base('Grass', { side: THREE.DoubleSide }), 'grass');
    const bark = mine(base('Bark_Birch'), 'tree');
    const flowers = mine(base('Flowers', { alphaTest: 0.35 }), 'shrub');
    const rocks = mine(base('PathRocks'), undefined);
    expect(plant.userData.wrap).toBeTruthy();
    expect(plant.alphaToCoverage).toBe(true);
    expect(grass.userData.wind.uWindHeight.value).toBe(WIND.grass.height);
    expect(WIND.grass.height).toBeLessThan(WIND.shrub.height);
    expect(grass.userData.push).toBe(true);
    expect([plant, grass, rocks].map(isTintable)).toEqual([true, true, true]);
    expect([bark, flowers].map(isTintable)).toEqual([false, false]);
  });

  it('keeps what doesn’t sway still', () => {
    const still = natureMaterials()(base('Mushrooms'), undefined);
    expect(still.userData.wind).toBeUndefined();
    expect(still.userData.push).toBeUndefined();
  });

  it('frees its copies, never the shared pictures', () => {
    const mine = natureMaterials();
    const m = base(named('Leaves_Free'), { alphaTest: 0.35 });
    const a = mine(m, 'tree');
    let copies = 0;
    let pictures = 0;
    a.addEventListener('dispose', () => copies++);
    m.map.addEventListener('dispose', () => pictures++);
    mine.dispose();
    expect(copies).toBe(1);
    expect(pictures).toBe(0);
  });
});

describe('the page’s wind and push', () => {
  it('takes the kit’s clock and its wind’s way, and where you are', () => {
    natureTick({ wind: { value: 3.5 }, windAngle: Math.PI / 2 }, { x: 2, z: -4 });
    expect(NATURE.time.value).toBe(3.5);
    expect(NATURE.dir.value.x).toBeCloseTo(0);
    expect(NATURE.dir.value.y).toBeCloseTo(1);
    natureTick({ wind: { value: 3.6 } }, { x: 2, z: -4 });
    expect(NATURE.push.value.x).toBe(2);
    expect(NATURE.push.value.z).toBe(-4);
  });

  it('stands still under reduced motion: no wind, and no push, when the kit’s clock doesn’t move', () => {
    const kit = { wind: { value: 9 } };
    natureTick(kit, { x: 1, z: 1 });
    natureTick(kit, { x: 5, z: 5 });
    expect(NATURE.time.value).toBe(9);
    expect(Math.hypot(NATURE.push.value.x - 5, NATURE.push.value.z - 5)).toBeGreaterThan(1000);
  });
});
