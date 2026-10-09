import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fromHalf, skinVertex, vatLayout, vatSample } from '../src/lib/three/vat.js';

// The bake run as a world's author runs it, on the tiny rig
// (scripts/fixtures/kit/tiny-rig.glb: two bones, a quad, one clip `pose` of
// a second), and its texture read back against three's own mixer and skinning.
const SCRIPT = join(import.meta.dirname, 'vat-bake.mjs');
const RIG = join(import.meta.dirname, 'fixtures', 'kit', 'tiny-rig.glb');

const bake = (...args) => {
  const out = mkdtempSync(join(tmpdir(), 'vat-bake-'));
  try {
    const log = execFileSync(process.execPath, [SCRIPT, RIG, ...args, '--out', out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const json = JSON.parse(readFileSync(join(out, 'tiny-rig.vat.json'), 'utf8'));
    const buf = readFileSync(join(out, json.bin));
    const halves = new Uint16Array(buf.byteLength / 2);
    for (let i = 0; i < halves.length; i++) halves[i] = buf.readUInt16LE(i * 2);
    return { log, json, bytes: buf.byteLength, data: Float32Array.from(halves, fromHalf) };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
};

const load = () => {
  const buf = readFileSync(RIG);
  return new Promise((resolve, reject) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject));
};

// the mixer's own matrix for each bone at time t, as vat.js's header has it
const mixerMatrices = (gltf, clip, t) => {
  let mesh = null;
  gltf.scene.traverse((o) => (mesh ??= o.isSkinnedMesh ? o : null));
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  mixer.setTime(t);
  gltf.scene.updateMatrixWorld(true);
  const rootInverse = gltf.scene.matrixWorld.clone().invert();
  const { bones, boneInverses } = mesh.skeleton;
  const matrices = bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(rootInverse, b.matrixWorld).multiply(boneInverses[j]).multiply(mesh.bindMatrix));
  mixer.stopAllAction();
  return { mesh, matrices };
};

describe('vat-bake', () => {
  it('bakes the rig’s own clip a row a frame, each bone’s matrix the mixer’s, skinning as three skins', async () => {
    const { json, bytes, data, log } = bake('--clips', 'own');
    expect(json).toEqual({ bones: 2, frames: 24, fps: 24, clips: { pose: [0, 24] }, names: ['Root', 'Tip'], bin: 'tiny-rig.vat.bin' });
    const layout = vatLayout(2, 24);
    expect(bytes).toBe(layout.texels * 4 * 2);
    expect(log).toMatch(/tiny-rig\.vat\.bin.*1152 bytes/);

    const gltf = await load();
    const clip = gltf.animations[0];
    const { mesh, matrices } = mixerMatrices(gltf, clip, 0.5);
    expect(Array.from(vatSample(data, layout, 1, 12))).toEqual(Array.from(matrices[1].elements).map((v) => expect.closeTo(v, 2)));
    // (the turn is there: the tip a quarter round about z)
    expect(matrices[1].elements[1]).toBeCloseTo(1, 5);

    // every frame of both bones, and the quad skinned by them where three's SkinnedMesh puts it
    const pos = mesh.geometry.attributes.position;
    const joints = mesh.geometry.attributes.skinIndex;
    const weights = mesh.geometry.attributes.skinWeight;
    for (let f = 0; f < 24; f++) {
      const { matrices: m } = mixerMatrices(gltf, clip, f / 24);
      const baked = [0, 1].map((j) => vatSample(data, layout, j, f));
      for (let j = 0; j < 2; j++) for (let e = 0; e < 16; e++) expect(Math.abs(baked[j][e] - m[j].elements[e])).toBeLessThan(1e-2);
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        const want = mesh.applyBoneTransform(i, v.clone()).applyMatrix4(mesh.matrixWorld);
        const got = skinVertex(v.toArray(), [joints.getX(i), joints.getY(i), joints.getZ(i), joints.getW(i)], [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)], baked);
        for (let c = 0; c < 3; c++) expect(Math.abs(got[c] - want.getComponent(c))).toBeLessThan(1e-2);
      }
    }
  });

  it('borrows a clip from another file under a new name, its turns kept and every position but the hips’ left out', async () => {
    const { json, data } = bake('--clips', `again=${RIG}#pose`, '--fps', '12');
    expect(json.clips).toEqual({ again: [0, 12] });
    expect(json.frames).toBe(12);
    const gltf = await load();
    // (the root's rise dropped: at the half second the root bone is where it rests)
    const atRest = mixerMatrices(gltf, new THREE.AnimationClip('rest', 1, []), 0).matrices;
    const root = vatSample(data, vatLayout(2, 12), 0, 6);
    for (let e = 0; e < 16; e++) expect(root[e]).toBeCloseTo(atRest[0].elements[e], 2);
    const tip = vatSample(data, vatLayout(2, 12), 1, 6);
    expect(tip[1]).toBeCloseTo(1, 2);
  });

  it('refuses a texture taller than 4096 rows', () => {
    expect(() => bake('--clips', 'own', '--fps', '5000')).toThrow(/4096/);
  });
});
