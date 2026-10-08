import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WIND } from '../../../lib/three/foliage';
import { NATURE, isTintable, natureLook, natureTick, pushShader } from './nature';

const mesh = (name, { vc = true, cut = 0 } = {}) => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ name, vertexColors: vc, alphaTest: cut, map: new THREE.Texture(), side: cut ? THREE.DoubleSide : THREE.FrontSide }));
const file = (...meshes) => ({ scene: new THREE.Group().add(...meshes) });

describe('the nature kit at run time', () => {
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

  it('shares each material by its name across the files, freeing the copy', () => {
    const a = file(mesh('Leaves', { cut: 0.35 }));
    const b = file(mesh('Leaves', { cut: 0.35 }), mesh('Flowers', { cut: 0.35 }));
    const copy = b.scene.children[0].material;
    let freed = 0;
    copy.map.addEventListener('dispose', () => freed++);
    natureLook(a, { sway: 'shrub' });
    natureLook(b, { sway: 'shrub' });
    expect(b.scene.children[0].material).toBe(a.scene.children[0].material);
    expect(freed).toBe(1);
    expect(b.scene.children[1].material.name).toBe('Flowers');
  });

  it('never shares one with vertex colours with one without', () => {
    const a = file(mesh('Rocks', { vc: true }));
    const b = file(mesh('Rocks', { vc: false }));
    natureLook(a, {});
    natureLook(b, {});
    expect(b.scene.children[0].material).not.toBe(a.scene.children[0].material);
  });

  it('sways a tree’s leaves and branches together, once, whatever loaded the leaves first', () => {
    const bush = file(mesh('Leaves_TwistedTree', { cut: 0.35 }));
    natureLook(bush, { sway: 'shrub' });
    const tree = file(mesh('Leaves_TwistedTree', { cut: 0.35 }), mesh('Bark_TwistedTree'));
    natureLook(tree, { sway: 'tree' });
    natureLook(tree, { sway: 'tree' });
    const [leaves, bark] = tree.scene.children.map((o) => o.material);
    expect(leaves.userData.wind.uWindHeight.value).toBe(bark.userData.wind.uWindHeight.value);
    expect(leaves.userData.wind.uWindStrength.value).toBe(bark.userData.wind.uWindStrength.value);
    expect(bark.userData.wind.uWindLeafAmp.value).toBe(0);
    // (the page's wind, one way for all of it)
    expect(leaves.userData.wind.uWindDir).toBe(NATURE.dir);
    expect(leaves.userData.wind.uWindTime).toBe(NATURE.time);
    // (high up, never pushed)
    expect(leaves.userData.push).toBeUndefined();
  });

  it('pushes the low plants and the grass, lights them as leaves, and marks what takes a tint', () => {
    const g = file(mesh('Leaves', { cut: 0.35 }), mesh('Grass'), mesh('Bark_Birch'), mesh('Flowers', { cut: 0.35 }));
    natureLook(g, { sway: 'shrub' });
    const [plant, grass, bark, flowers] = g.scene.children.map((o) => o.material);
    expect(plant.userData.push).toBe(true);
    expect(grass.userData.push).toBe(true);
    expect(flowers.userData.push).toBe(true);
    expect(plant.userData.wrap).toBeTruthy();
    expect(plant.alphaToCoverage).toBe(true);
    expect(isTintable(plant)).toBe(true);
    expect(isTintable(grass)).toBe(true);
    expect(isTintable(bark)).toBe(false);
    expect(isTintable(flowers)).toBe(false);
    // (the grass by its own numbers: short, stiff at the root, quick at the tips)
    expect(grass.userData.wind.uWindHeight.value).toBe(WIND.grass.height);
    expect(WIND.grass.height).toBeLessThan(WIND.shrub.height);
  });

  it('keeps what doesn’t sway still', () => {
    const still = file(mesh('Mushrooms'));
    natureLook(still, {});
    expect(still.scene.children[0].material.userData.wind).toBeUndefined();
    expect(still.scene.children[0].material.userData.push).toBeUndefined();
  });

  it('takes the kit’s clock (still when reduced motion stops it), its wind’s way, and where you are', () => {
    natureTick({ wind: { value: 3.5 }, windAngle: Math.PI / 2 }, { x: 2, z: -4 });
    expect(NATURE.time.value).toBe(3.5);
    expect(NATURE.dir.value.x).toBeCloseTo(0);
    expect(NATURE.dir.value.y).toBeCloseTo(1);
    expect(NATURE.push.value.x).toBe(2);
    expect(NATURE.push.value.z).toBe(-4);
    natureTick({ wind: { value: 3.5 } }, null);
    expect(NATURE.time.value).toBe(3.5);
    expect(NATURE.push.value.x).toBe(2);
  });
});
