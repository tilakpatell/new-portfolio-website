import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { groundWorld } from './groundwork';

// a renderer that can't draw into float pictures (the bake gives up at once),
// or one that can but draws nothing (the bake runs its chunks)
const stubRenderer = (floats = false) => ({
  shadowMap: { enabled: true, type: THREE.PCFShadowMap, autoUpdate: true },
  autoClear: true,
  extensions: { has: () => floats },
  getRenderTarget: () => null,
  setRenderTarget() {},
  getClearColor: (c) => c.set(0, 0, 0),
  getClearAlpha: () => 1,
  setClearColor() {},
  clear() {},
  render() {},
  getContext: () => ({ finish() {} }),
});

function world() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 5);
  sun.castShadow = true;
  const hemi = new THREE.HemisphereLight(0xbbccff, 0x806040, 1);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial());
  floor.receiveShadow = true;
  const wood = new THREE.MeshStandardMaterial({ color: 0x806040 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), wood);
  house.castShadow = true;
  const walker = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshStandardMaterial());
  walker.position.set(3, 1, 4);
  walker.castShadow = true;
  const cart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2), wood);
  cart.position.set(-5, 0.5, 0);
  scene.add(sun, sun.target, hemi, floor, house, walker, cart);
  return { scene, sun, hemi, floor, house, walker, cart, wood };
}

const area = { x0: -20, z0: -20, w: 40, d: 40 };

describe('a world put on baked floor light', () => {
  it('ends the shadow pass and every cast and received shadow', () => {
    const w = world();
    const renderer = stubRenderer();
    groundWorld({ renderer, scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    expect(renderer.shadowMap.enabled).toBe(false);
    w.scene.traverse((o) => {
      if (o.isMesh) {
        expect(o.castShadow).toBe(false);
        expect(o.receiveShadow).toBe(false);
      }
      if (o.isLight) expect(o.castShadow ?? false).toBe(false);
    });
  });

  it('shades the floor, bounces the statics, and stands the movers in the shade', () => {
    const w = world();
    groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }, { object: w.cart, size: [1.2, 2.2] }] });
    expect(w.floor.material.userData.floorShadow).toBeTruthy();
    expect(w.wood.userData.bounce).toBeTruthy();
    expect(w.walker.material.userData.standIn).toBeTruthy();
    expect(w.walker.material.userData.bounce).toBeTruthy();
    // (the cart's wood is the house's too: a wall would read its own footprint)
    expect(w.wood.userData.standIn).toBeUndefined();
  });

  it('takes the bounce colour from the sky light\'s ground colour unless given one', () => {
    const w = world();
    groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun });
    expect(w.wood.userData.bounce.uBounceColor.value.getHex()).toBe(w.hemi.groundColor.getHex());
  });

  it('puts a blob under each mover, where it stands', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(1);
    expect(g.blobs.mesh.parent).toBe(w.scene);
    w.walker.visible = false;
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
  });

  it('stands as it was where the bake can\'t be had', async () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(false), scene: w.scene, floor: [w.floor], area, sun: w.sun });
    const before = w.floor.material.userData.floorShadow.uMask.value[0];
    expect(await g.bake()).toBe(false);
    expect(w.floor.material.userData.floorShadow.uMask.value[0]).toBe(before);
  });

  it('stops a bake left mid-way, and frees what it put in the scene', async () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(true), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    const before = w.floor.material.userData.floorShadow.uMask.value[0];
    const done = g.bake();
    g.dispose();
    expect(await done).toBe(false);
    expect(w.floor.material.userData.floorShadow.uMask.value[0]).toBe(before);
    expect(g.blobs.mesh.parent).toBeNull();
    expect(w.walker.visible).toBe(true);
  });
});
