// A 2017 figure's weapon in the game's socket, headless: the committed
// skeleton (walrus.glb) as the figure, gunplay putting the saber in
// Wep_Root, and the saber wearing the game's hilt there. Nothing of the
// site's hand placement runs: the game's clips hold it.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// (the hilt's file held back until the test lets it come)
const glb = vi.hoisted(() => ({ asked: [], release: null }));
vi.mock('./placer', async (orig) => ({
  ...(await orig()),
  loadGlb: (u) => (glb.asked.push(u), new Promise((r) => (glb.release = r))),
}));
const { socketsOf } = await import('../../../lib/three/walrus');
const { rotateWorld } = await import('../../../lib/three/ik');
const { createGunplay } = await import('../../universe/gunplay');
const { createSaber } = await import('./saber');
const { HILTS } = await import('../heroes');

let figure;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const buf = readFileSync('public/models/galaxy/bf2017/walrus.glb');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  figure = () =>
    new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j)).then((g) => {
      const bones = {};
      g.scene.traverse((o) => o.name && !(o.name in bones) && (bones[o.name] = o));
      new THREE.Group().add(g.scene);
      g.scene.updateMatrixWorld(true);
      return { model: g.scene, bones, sockets: socketsOf(g.scene), rig: 'walrus', clips: {} };
    });
});

describe('a weapon in the game’s socket', () => {
  it('goes into Wep_Root, leaves the other hand to the clip, and can be let go', async () => {
    const fig = await figure();
    const gp = createGunplay(fig, 'saber', { unit: 1 });
    expect(gp.gun.parent.name).toBe('Wep_Root');
    expect(gp.holder).toBe(fig.sockets.weapon);
    const left = fig.bones.LeftHand.quaternion.clone();
    gp.holdLeft(new THREE.Vector3(0, 1, 0.3), null, new THREE.Vector3(0, 1, 0), null, 1);
    expect(fig.bones.LeftHand.quaternion.equals(left)).toBe(true);
    expect(gp.drop()).toBe(gp.gun);
    gp.dispose();
  });

  it('wears the game’s hilt there, and never after it’s been put away', async () => {
    const fig = await figure();
    const gp = createGunplay(fig, 'saber', { unit: 1 });
    glb.asked.length = 0;
    const saber = createSaber(gp, { hilt: HILTS.find((h) => h.id === 'luke'), fig });
    expect(glb.asked).toHaveLength(1);
    expect(glb.asked[0]).toMatch(/hiltluke/);
    saber.dispose();
    const hilt = new THREE.Group();
    hilt.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04)));
    glb.release({ scene: hilt });
    await new Promise((r) => setTimeout(r, 0));
    expect(gp.gun.getObjectByName('hilt-model')).toBeUndefined();
    gp.dispose();
  });

  it('aims the chest, not the waist: a clip’s twist above the waist is taken out', async () => {
    const fig = await figure();
    const gp = createGunplay(fig, 'blaster', { unit: 1 });
    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(0, 0, 1);
    const chest = fig.bones.Spine2;
    const yawOf = () => {
      fig.model.updateMatrixWorld(true);
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(chest.getWorldQuaternion(new THREE.Quaternion()).multiply(rest));
      return Math.atan2(f.x, f.z);
    };
    // the chest's own forward, read at rest (its bind frame against the figure's +z)
    fig.model.updateMatrixWorld(true);
    const rest = chest.getWorldQuaternion(new THREE.Quaternion()).invert();
    // a clip that turns the upper body half a radian off, above the waist
    rotateWorld(fig.bones.Spine1, up, 0.5, 1);
    expect(Math.abs(yawOf())).toBeGreaterThan(0.4);
    for (let i = 0; i < 40; i++) {
      gp.set(1 / 30, { aim: 1, look: 1, dir: forward.clone(), forward, up });
    }
    expect(Math.abs(yawOf())).toBeLessThan(0.15);
    gp.dispose();
  });
});

