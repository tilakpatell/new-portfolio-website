// A humanoid built from code, for Ultron's sentries, Chitauri soldiers,
// training bots and the like. Every part is bound wholly to one bone of a
// skeleton ("rigid skinning"), so however many plates, joints and lights a
// figure has, it draws as one mesh per material and still moves limb by limb.
//
// A style supplies the parts for each bone; `poseHumanoid` sets the bones from
// a few numbers (time, gait, aim, recoil, flinch, lean).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { limb, placed, rbox, taper } from './shapes';

// bone: [parent, x, y, z] in metres for a 1.9 m figure, at rest
const BONES = {
  hips: [null, 0, 1.0, 0],
  spine: ['hips', 0, 0.12, 0],
  chest: ['spine', 0, 0.2, 0],
  neck: ['chest', 0, 0.3, 0],
  head: ['neck', 0, 0.08, 0],
  shoulderL: ['chest', 0.23, 0.22, 0],
  elbowL: ['shoulderL', 0, -0.3, 0],
  handL: ['elbowL', 0, -0.27, 0],
  shoulderR: ['chest', -0.23, 0.22, 0],
  elbowR: ['shoulderR', 0, -0.3, 0],
  handR: ['elbowR', 0, -0.27, 0],
  thighL: ['hips', 0.1, -0.05, 0],
  kneeL: ['thighL', 0, -0.44, 0],
  footL: ['kneeL', 0, -0.44, 0],
  thighR: ['hips', -0.1, -0.05, 0],
  kneeR: ['thighR', 0, -0.44, 0],
  footR: ['kneeR', 0, -0.44, 0],
};
const NAMES = Object.keys(BONES);

// Each style: (add) => adds parts as add(bone, material, geometry, placement).
// Limbs hang down (−y) from their joint; the figure faces +z.
const STYLES = {
  // Ultron's sentries: polished silver, slim, a long head with a red stare
  ultron(add) {
    // hips and waist
    add('hips', 'body', rbox(0.3, 0.14, 0.19, 0.04), { p: [0, -0.02, 0] });
    add('hips', 'dark', rbox(0.34, 0.05, 0.21, 0.02), { p: [0, 0.05, 0] });
    for (let i = 0; i < 3; i++) add('spine', 'dark', new THREE.CylinderGeometry(0.105 - i * 0.004, 0.11 - i * 0.004, 0.05, 18), { p: [0, 0.03 + i * 0.065, 0] });
    // the chest: a tapered shell, plates over it, the light in the middle
    add('chest', 'body', taper(rbox(0.42, 0.3, 0.23, 0.07), 0.72, 1), { p: [0, 0.14, 0] });
    for (const s of [-1, 1]) {
      add('chest', 'body', rbox(0.17, 0.13, 0.05, 0.025), { p: [s * 0.095, 0.2, 0.11], r: [-0.12, 0, s * -0.12] });
      add('chest', 'dark', rbox(0.04, 0.2, 0.05, 0.015), { p: [s * 0.19, 0.12, 0.06], r: [0, 0, s * 0.2] });
    }
    add('chest', 'glow', new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), { p: [0, 0.16, 0.135], r: [Math.PI / 2, 0, 0] });
    add('chest', 'dark', new THREE.TorusGeometry(0.045, 0.01, 8, 24), { p: [0, 0.16, 0.13] });
    add('chest', 'body', rbox(0.2, 0.07, 0.16, 0.03), { p: [0, 0.31, -0.02] }); // collar
    // neck and head
    add('neck', 'dark', new THREE.CylinderGeometry(0.045, 0.055, 0.12, 14), { p: [0, 0.03, 0] });
    const skull = new THREE.SphereGeometry(0.1, 24, 18);
    add('head', 'body', skull, { p: [0, 0.13, -0.005], s: [0.95, 1.35, 1.08] });
    add('head', 'body', rbox(0.15, 0.09, 0.15, 0.04), { p: [0, 0.05, 0.02] }); // jaw
    add('head', 'dark', rbox(0.17, 0.035, 0.12, 0.012), { p: [0, 0.13, 0.03] }); // brow ridge band
    for (const s of [-1, 1]) add('head', 'glow', rbox(0.045, 0.014, 0.02, 0.006), { p: [s * 0.04, 0.135, 0.1], r: [0, s * -0.25, s * 0.22] });
    add('head', 'glow', rbox(0.06, 0.008, 0.02, 0.003), { p: [0, 0.06, 0.098] }); // mouth
    add('head', 'dark', rbox(0.03, 0.12, 0.08, 0.012), { p: [0, 0.22, -0.03] }); // crest
    // arms
    for (const [sh, el, ha, s] of [
      ['shoulderL', 'elbowL', 'handL', 1],
      ['shoulderR', 'elbowR', 'handR', -1],
    ]) {
      add(sh, 'dark', new THREE.SphereGeometry(0.06, 16, 12));
      add(sh, 'body', rbox(0.13, 0.09, 0.15, 0.04), { p: [s * 0.02, 0.03, 0], r: [0, 0, s * -0.35] }); // pauldron
      add(sh, 'body', limb(0.05, 0.28, 0.042), { p: [0, -0.29, 0] });
      add(el, 'dark', new THREE.SphereGeometry(0.042, 14, 10));
      add(el, 'body', limb(0.045, 0.25, 0.036), { p: [0, -0.255, 0] });
      add(ha, 'dark', rbox(0.07, 0.09, 0.035, 0.012), { p: [0, -0.05, 0] });
      add(ha, 'body', rbox(0.072, 0.05, 0.03, 0.01), { p: [0, -0.115, 0.004] });
      add(ha, 'glow', new THREE.CylinderGeometry(0.018, 0.018, 0.01, 14), { p: [0, -0.06, 0.02], r: [Math.PI / 2, 0, 0] }); // palm
    }
    // legs, with a thruster in each foot
    for (const [th, kn, ft] of [
      ['thighL', 'kneeL', 'footL'],
      ['thighR', 'kneeR', 'footR'],
    ]) {
      add(th, 'dark', new THREE.SphereGeometry(0.065, 14, 10));
      add(th, 'body', limb(0.07, 0.42, 0.055), { p: [0, -0.43, 0] });
      add(kn, 'dark', new THREE.SphereGeometry(0.05, 14, 10));
      add(kn, 'body', rbox(0.07, 0.07, 0.05, 0.02), { p: [0, 0, 0.04] });
      add(kn, 'body', limb(0.055, 0.42, 0.04), { p: [0, -0.43, 0] });
      add(ft, 'body', taper(rbox(0.08, 0.06, 0.2, 0.025), 1, 0.85), { p: [0, -0.02, 0.03] });
      add(ft, 'glow', new THREE.CylinderGeometry(0.025, 0.03, 0.02, 14), { p: [0, -0.055, 0] });
    }
  },
};

// Build a figure. `materials` has a material for each key the style uses
// (ultron: body, dark, glow). `scale` grows it from 1.9 m.
export function buildHumanoid({ style = 'ultron', materials, scale = 1 } = {}) {
  // the bones, at rest
  const bones = {};
  for (const name of NAMES) {
    const [parent, x, y, z] = BONES[name];
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x * scale, y * scale, z * scale);
    bones[name] = b;
    if (parent) bones[parent].add(b);
  }
  const root = new THREE.Group();
  root.add(bones.hips);
  root.updateMatrixWorld(true);
  const list = NAMES.map((n) => bones[n]);
  const skeleton = new THREE.Skeleton(list);

  // the parts, each in its bone's space, carried into the figure's space
  const byMat = {};
  const add = (bone, mat, geo, place) => {
    const g = placed(geo, place);
    g.scale(scale, scale, scale);
    g.applyMatrix4(bones[bone].matrixWorld);
    const n = g.attributes.position.count;
    const idx = NAMES.indexOf(bone);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? idx : 0)), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    (byMat[mat] ??= []).push(g.index ? g.toNonIndexed() : g);
  };
  STYLES[style](add);

  const meshes = {};
  for (const [key, geos] of Object.entries(byMat)) {
    for (const g of geos) for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(a)) g.deleteAttribute(a);
    const geo = mergeGeometries(geos, false);
    const mesh = new THREE.SkinnedMesh(geo, materials[key]);
    mesh.name = key;
    mesh.castShadow = key !== 'glow';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    root.add(mesh);
    meshes[key] = mesh;
  }
  const rest = Object.fromEntries(NAMES.map((n) => [n, bones[n].position.clone()]));
  return { root, bones, meshes, skeleton, scale, rest, height: 1.9 * scale };
}

const set = (b, x = 0, y = 0, z = 0) => b.rotation.set(x, y, z);

// Pose a figure. `mode`: 'hover' (Ultron's float), 'walk', 'run', 'idle'.
// `aim` (0..1) raises the right arm to point forward; `recoil` kicks it;
// `flinch` jolts the body back; `lean` tilts forward; `phase` offsets the gait.
export function poseHumanoid(h, { t = 0, mode = 'hover', aim = 0, recoil = 0, flinch = 0, lean = 0, phase = 0, speed = 1 } = {}) {
  const b = h.bones;
  const k = t * speed + phase;
  if (mode === 'hover') {
    const bob = Math.sin(k * 1.6);
    b.hips.position.y = h.rest.hips.y + bob * 0.03 * h.scale;
    set(b.hips, 0.05 + lean * 0.3, 0, 0);
    set(b.spine, 0.03, Math.sin(k * 0.7) * 0.06, 0);
    set(b.chest, -flinch * 0.5, 0, 0);
    set(b.neck, 0, 0, 0);
    set(b.head, 0.05 - flinch * 0.3, Math.sin(k * 0.9) * 0.15, 0);
    // legs hang, a little bent, slightly apart, swaying
    set(b.thighL, 0.12 + bob * 0.05, 0, 0.05);
    set(b.thighR, 0.05 - bob * 0.05, 0, -0.05);
    set(b.kneeL, 0.45 + bob * 0.06, 0, 0);
    set(b.kneeR, 0.35 - bob * 0.06, 0, 0);
    set(b.footL, 0.35, 0, 0);
    set(b.footR, 0.3, 0, 0);
    // arms down and out, ready
    set(b.shoulderL, 0.1 + Math.sin(k * 1.3) * 0.05, 0, 0.35);
    set(b.elbowL, -0.35, 0, 0);
    set(b.handL, 0, 0, 0);
  } else {
    // a walking (or running) gait
    const run = mode === 'run' ? 1 : 0;
    const amp = mode === 'idle' ? 0 : 0.45 + run * 0.35;
    const s = Math.sin(k * (5 + run * 3));
    const c = Math.cos(k * (5 + run * 3));
    b.hips.position.y = h.rest.hips.y - Math.abs(c) * 0.04 * amp * h.scale;
    set(b.hips, 0.05 + lean * 0.4 + run * 0.15, s * 0.08 * amp, 0);
    set(b.spine, 0.04 + run * 0.08, -s * 0.12 * amp, 0);
    set(b.chest, -flinch * 0.5, 0, 0);
    set(b.neck, 0, 0, 0);
    set(b.head, -run * 0.15 - flinch * 0.3, 0, 0);
    set(b.thighL, -s * amp * 0.9, 0, 0.03);
    set(b.thighR, s * amp * 0.9, 0, -0.03);
    set(b.kneeL, Math.max(0, c) * amp * 1.3 + 0.05, 0, 0);
    set(b.kneeR, Math.max(0, -c) * amp * 1.3 + 0.05, 0, 0);
    set(b.footL, Math.max(0, s) * 0.3 * amp, 0, 0);
    set(b.footR, Math.max(0, -s) * 0.3 * amp, 0, 0);
    set(b.shoulderL, s * amp * 0.8, 0, 0.1);
    set(b.elbowL, -0.3 - run * 0.9, 0, 0);
    set(b.handL, 0, 0, 0);
  }
  // the right arm: at rest it mirrors the left; aiming raises it forward
  const restX = mode === 'hover' ? 0.1 + Math.sin(k * 1.3 + 1) * 0.05 : -Math.sin(k * 5) * 0.4;
  const ax = restX * (1 - aim) + (-Math.PI / 2 + 0.1) * aim - recoil * 0.5;
  set(b.shoulderR, ax, -0.1 * aim, (mode === 'hover' ? -0.35 : -0.1) * (1 - aim));
  set(b.elbowR, -0.35 * (1 - aim) - recoil * 0.3, 0, 0);
  set(b.handR, aim * 0.2, 0, 0);
}
