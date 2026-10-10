// The weapon socket's frame (walrusRig.js's WEAPON_FRAME), measured: the
// game's skeleton as committed (walrus.glb) moved by Luke's own clips (his
// pack over the humanoid one, as the loader plays them), and the blade (the
// site's gun +y through the frame) read in the world. This is the probe:
// a frame that turned the blade down or back, or a socket away from the
// hand, fails here before anyone has to see it in a duel.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipsFor } from './walrus';
import { WEAPON_FRAME } from './walrusRig.js';

const DIR = 'public/models/galaxy/bf2017';
const parse = async (file) => {
  const buf = readFileSync(`${DIR}/${file}`);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};

let skeleton;
let clips;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const [walrus, humanoid, luke] = await Promise.all(['walrus.glb', 'clips-humanoid.glb', 'clips-luke.glb'].map(parse));
  skeleton = walrus.scene;
  const all = new Map();
  for (const g of [humanoid, luke]) for (const c of g.animations) all.set(c.name, c);
  clips = clipsFor(skeleton, all);
});

// the figure posed at `t` seconds into a clip: the blade's way and the grip, in the world
function posed(name, t) {
  const mixer = new THREE.AnimationMixer(skeleton);
  mixer.clipAction(clips[name]).play();
  mixer.setTime(t);
  skeleton.updateMatrixWorld(true);
  const socket = skeleton.getObjectByName('Wep_Root');
  const q = socket.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().fromArray(WEAPON_FRAME.quaternion));
  const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const grip = socket.localToWorld(new THREE.Vector3().fromArray(WEAPON_FRAME.position));
  const hand = skeleton.getObjectByName('RightHand').getWorldPosition(new THREE.Vector3());
  const fore = skeleton.getObjectByName('RightForeArm').getWorldPosition(new THREE.Vector3());
  mixer.stopAllAction();
  mixer.uncacheRoot(skeleton);
  return { blade, grip, hand, fore };
}

describe('the weapon socket on Luke, under his own clips', () => {
  it('holds the grip in the right hand', () => {
    const { grip, hand } = posed('idle', 0.5);
    expect(grip.distanceTo(hand)).toBeLessThan(0.15);
  });
  it('raises the blade at his guard, up and away from the forearm, never down it', () => {
    const { blade, hand, fore } = posed('idle', 0.5);
    expect(blade.y).toBeGreaterThan(0.3);
    expect(blade.dot(hand.clone().sub(fore).normalize())).toBeGreaterThan(-0.2);
  });
  it('keeps the blade out of the floor through a strike', () => {
    const d = clips['sword.light.a'].duration;
    for (const k of [0.25, 0.5, 0.75]) expect(posed('sword.light.a', d * k).blade.y, `at ${k}`).toBeGreaterThan(-0.7);
  });
});
