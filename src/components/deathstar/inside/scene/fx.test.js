import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../rules/combat';
import { POOLS, boltHue, createFx, createSlots, flareLevel, inFlight } from './fx';

const bolt = (more = {}) => ({ id: 1, x: 0, y: 1.4, z: 0, dx: 0, dy: 0, dz: -1, speed: 55, owner: 'tk', side: 'imperial', weapon: 'e11', ...more });
const at = (x = 0, y = 1, z = 0) => ({ x, y, z });

// everything the effects hang in the scene: objects, geometries, materials
function inventory(scene) {
  const objects = [];
  const geometries = new Set();
  const materials = new Set();
  scene.traverse((o) => {
    objects.push(o);
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [o.material].flat()) if (m) materials.add(m);
  });
  return { objects, geometries, materials };
}

describe('the colour of a bolt', () => {
  it('is red for the Empire and red for the Rebels, as every blaster in the films is', () => {
    expect(boltHue(bolt({ side: 'imperial' }))).toBe('red');
    expect(boltHue(bolt({ side: 'rebel', weapon: 'dl44' }))).toBe('red');
    expect(boltHue(bolt({ side: 'neutral' }))).toBe('red');
  });

  it('is green only for the station’s own turbolasers and its superlaser', () => {
    expect(boltHue(bolt({ weapon: 'turbolaser' }))).toBe('green');
    expect(boltHue(bolt({ weapon: 'superlaser' }))).toBe('green');
  });
});

describe('the pools’ sizes', () => {
  it('counts how many bolts one gun can have in the air at once, from its range, speed and rate', () => {
    expect(inFlight('e11')).toBe(Math.ceil(60 / 55 / 0.18));
    expect(inFlight('dl44')).toBe(Math.ceil(50 / 50 / 0.32));
  });

  it('has room for eight shooters firing as fast as the quickest gun allows', () => {
    const most = Math.max(...Object.keys(WEAPONS).map(inFlight));
    expect(POOLS.bolts).toBeGreaterThanOrEqual(8 * most);
  });

  it('keeps fewer sparks and less smoke on a small screen, but every bolt', () => {
    const small = POOLS.small;
    expect(small.bolts).toBe(POOLS.bolts);
    expect(small.sparks).toBeLessThan(POOLS.sparks);
    expect(small.puffs).toBeLessThan(POOLS.puffs);
  });
});

describe('a pool’s slots', () => {
  it('hands out free slots first, then the oldest one taken', () => {
    const slots = createSlots(3);
    expect([slots.take(), slots.take(), slots.take()]).toEqual([0, 1, 2]);
    expect(slots.take()).toBe(0);
    slots.release(1);
    expect(slots.take()).toBe(1);
    expect(slots.take()).toBe(2);
  });
});

describe('a muzzle’s flare', () => {
  it('is full at the shot and gone within its life', () => {
    expect(flareLevel(0, 0.08)).toBe(1);
    expect(flareLevel(0.04, 0.08)).toBeGreaterThan(0);
    expect(flareLevel(0.04, 0.08)).toBeLessThan(1);
    expect(flareLevel(0.08, 0.08)).toBe(0);
    expect(flareLevel(1, 0.08)).toBe(0);
  });
});

describe('the effects', () => {
  it('keeps one flare light in the scene, at nothing until a shot lights it and after it fades', () => {
    const scene = new THREE.Scene();
    const fx = createFx(scene);
    const lights = () => inventory(scene).objects.filter((o) => o.isPointLight);
    expect(lights()).toHaveLength(1);
    expect(lights()[0].intensity).toBe(0);
    fx.flare(at(2, 1.5, -3));
    fx.update(0.01);
    expect(lights()[0].intensity).toBeGreaterThan(0);
    expect(lights()[0].position.toArray()).toEqual([2, 1.5, -3]);
    fx.update(0.5);
    expect(lights()).toHaveLength(1);
    expect(lights()[0].intensity).toBe(0);
  });

  it('draws a bolt only while the rules still have it in the air', () => {
    const fx = createFx(new THREE.Scene());
    fx.bolt(bolt());
    fx.update(1 / 60);
    expect(fx.live().bolts).toBe(1);
    fx.update(1 / 60);
    expect(fx.live().bolts).toBe(0);
  });

  it('carries a bolt on past its last step by the time since, so it flies smoothly between steps', () => {
    const fx = createFx(new THREE.Scene());
    const cores = fx.meshes.find((m) => m.name === 'bolt-cores');
    const where = () => new THREE.Vector3().setFromMatrixPosition(cores.getMatrixAt(0, new THREE.Matrix4()));
    const b = bolt();
    fx.bolt(b);
    fx.update(1 / 60);
    const first = where();
    fx.bolt(b);
    fx.update(1 / 60);
    expect(first.z - where().z).toBeCloseTo(55 / 60, 3);
    // the next step moves the bolt itself: drawn from there, not carried on twice
    b.z -= 55 / 30;
    fx.bolt(b);
    fx.update(1 / 60);
    expect(where().z).toBeCloseTo(first.z - 55 / 30, 3);
  });

  it('carries a bolt on as smoothly far out in the station, where a float can’t hold its position exactly', () => {
    const fx = createFx(new THREE.Scene());
    const cores = fx.meshes.find((m) => m.name === 'bolt-cores');
    const where = () => new THREE.Vector3().setFromMatrixPosition(cores.getMatrixAt(0, new THREE.Matrix4()));
    const b = bolt({ x: -48.123, y: 1.4, z: -101.77 });
    fx.bolt(b);
    fx.update(1 / 60);
    const first = where();
    fx.bolt(b);
    fx.update(1 / 60);
    expect(first.z - where().z).toBeCloseTo(55 / 60, 3);
    b.z -= 55 / 30;
    fx.bolt(b);
    fx.update(1 / 60);
    expect(where().z).toBeCloseTo(first.z - 55 / 30, 3);
  });

  it('draws a bolt as a capsule about 0.9 m long, its head where the rules have it', () => {
    const fx = createFx(new THREE.Scene());
    const cores = fx.meshes.find((m) => m.name === 'bolt-cores');
    cores.geometry.computeBoundingBox();
    const size = cores.geometry.boundingBox.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(0.9, 1);
    fx.bolt(bolt({ x: 3, z: -5 }));
    fx.update(0);
    const m = cores.getMatrixAt(0, new THREE.Matrix4());
    const head = new THREE.Vector3(0, cores.geometry.boundingBox.max.y, 0).applyMatrix4(m);
    expect(head.x).toBeCloseTo(3);
    expect(head.y).toBeCloseTo(1.4);
    expect(head.z).toBeCloseTo(-5);
  });

  it('throws sparks, scorches a wall, puffs smoke and blows things up, each fading away in time', () => {
    const fx = createFx(new THREE.Scene());
    fx.spark(at(), 12, { x: 0, y: 0, z: 1 });
    fx.scorch(at(0, 1, -2), { x: 0, y: 0, z: 1 });
    fx.smoke(at());
    fx.explode(at(), 1.5);
    fx.update(1 / 60);
    const now = fx.live();
    expect(now.sparks).toBeGreaterThanOrEqual(12);
    expect(now.scorches).toBe(1);
    expect(now.puffs).toBeGreaterThan(1);
    for (let i = 0; i < 60 * 10; i++) fx.update(1 / 60);
    expect(fx.live()).toMatchObject({ sparks: 0, puffs: 0, bolts: 0 });
  });

  it('keeps the newest scorches when the walls are full, scorching over the oldest', () => {
    const fx = createFx(new THREE.Scene());
    for (let i = 0; i < POOLS.scorches + 5; i++) fx.scorch(at(i, 1, -2), { x: 0, y: 0, z: 1 });
    fx.update(1 / 60);
    expect(fx.live().scorches).toBe(POOLS.scorches);
  });

  it('makes nothing new in a fight: every object, geometry and material is there from the start', () => {
    const scene = new THREE.Scene();
    const fx = createFx(scene);
    const before = inventory(scene);
    for (let i = 0; i < 200; i++) {
      fx.bolt(bolt({ id: i, side: i % 2 ? 'rebel' : 'imperial', weapon: i % 7 ? 'e11' : 'turbolaser' }));
      fx.spark(at(i % 5), 20);
      fx.scorch(at(i % 9, 1, -2), { x: 0, y: 0, z: 1 });
      fx.flare(at());
      fx.smoke(at());
      if (i % 10 === 0) fx.explode(at(), 2);
      fx.update(1 / 60);
    }
    const after = inventory(scene);
    expect(after.objects).toEqual(before.objects);
    expect(after.geometries).toEqual(before.geometries);
    expect(after.materials).toEqual(before.materials);
  });

  it('takes everything it put in the scene away again', () => {
    const scene = new THREE.Scene();
    const fx = createFx(scene);
    fx.explode(at(), 1);
    fx.update(1 / 60);
    fx.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
