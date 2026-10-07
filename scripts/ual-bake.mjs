// The body under a lit lightsaber: two clips from Quaternius's Universal
// Animation Library (CC0, the free Standard pack's Godot GLB), retargeted
// onto the Meshy rig every galaxy hero stands on and baked into one small
// GLB, public/games/meshy/ual-saber.glb. Sword_Idle is the guard's crouch,
// Sword_Attack the lunge under a stroke. Only the body goes out: the hips
// (their turn and travel), the spine, the neck and both legs. The arms stay
// gunplay's and saber.js's, which pose them over it.
//
// The retarget is scripts/preview/ualRetarget.js's, onto Luke as he stands
// at rest (his skeleton read straight out of luke.glb's nodes, never posed
// by a clip). A clip baked on him plays on any Meshy figure through
// rickmorty/portal/clips.js retarget(), as Rick's do; each carries the hips'
// height it was made for (extras.hips → clip.userData.hips) to scale by.
// Sword_Attack's extras also say where in it the blade strikes (`strike`,
// seconds: the swinging hand at its fastest) and where the lunge comes back
// up (`back`), for saberBody.js to lay a stroke over.
//
// The pack isn't in the repo (6.7 MB): download universal_animation_library
// standard.zip from opengameart.org/content/universal-animation-library and
// put its Godot/AnimationLibrary_Godot_Standard.glb at
// scripts/preview/.ual/ual.glb (git-ignored), or pass its path.
//
//   node scripts/ual-bake.mjs [ual.glb] [--report]

import { Document, NodeIO } from '@gltf-transform/core';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { keepRest, retargetUal, ualRig } from './preview/ualRetarget.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SRC = args.find((a) => !a.startsWith('--')) ?? join(ROOT, 'scripts', 'preview', '.ual', 'ual.glb');
const REPORT = args.includes('--report');
const RIG = join(ROOT, 'public', 'models', 'galaxy', 'crew', 'luke.glb');
const OUT = join(ROOT, 'public', 'games', 'meshy', 'ual-saber.glb');
const CLIPS = ['Sword_Idle', 'Sword_Attack'];
const FPS = 30;
// the body: what goes out of each clip (the arms, the head and the hands stay out)
const BODY = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

// a GLB's JSON chunk
const glbJson = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));

// Luke's skeleton at rest, from the GLB's nodes (no meshes: nothing to
// decode, and no clip has touched it)
function restRig(json) {
  const joints = new Set(json.skins.flatMap((s) => s.joints));
  const objs = json.nodes.map((n, i) => {
    const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.name ?? `node${i}`;
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Group();
  for (const i of json.scenes[json.scene ?? 0].nodes) root.add(objs[i]);
  root.updateMatrixWorld(true);
  return root;
}

async function loadUal(file) {
  const buf = await readFile(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
}

// where in Sword_Attack the blade strikes (the right hand at its fastest)
// and where the lunge is back up (the hips as high again as they start)
function attackTimes(src, clip) {
  const mixer = new THREE.AnimationMixer(src.scene);
  const a = mixer.clipAction(clip).play();
  const hand = src.bones['DEF-handR'];
  const hips = src.bones['DEF-hips'];
  const rows = [];
  const p = new THREE.Vector3();
  for (let f = 0, n = Math.round(clip.duration * FPS); f <= n; f++) {
    a.time = Math.min(clip.duration, f / FPS);
    mixer.update(0);
    src.scene.updateMatrixWorld(true);
    rows.push({ t: a.time, hand: hand.getWorldPosition(p).clone(), hips: hips.getWorldPosition(p).clone() });
  }
  a.stop();
  mixer.uncacheRoot(src.scene);
  let strike = 0;
  let best = 0;
  rows.forEach((r, i) => {
    if (!i) return;
    const v = r.hand.distanceTo(rows[i - 1].hand) / (r.t - rows[i - 1].t);
    r.speed = v;
    if (v > best) [best, strike] = [v, r.t];
  });
  const low = rows.reduce((m, r) => (r.hips.y < m.hips.y ? r : m), rows[0]);
  const top = rows[0].hips.y;
  const back = rows.find((r) => r.t > low.t && r.hips.y >= top - (top - low.hips.y) * 0.15)?.t ?? clip.duration;
  if (REPORT)
    for (const r of rows)
      console.log(r.t.toFixed(2), 'hips', r.hips.toArray().map((v) => v.toFixed(3)).join(' '), 'hand speed', (r.speed ?? 0).toFixed(2));
  return { strike: +strike.toFixed(3), low: +low.t.toFixed(3), back: +back.toFixed(3) };
}

const rig = restRig(glbJson(await readFile(RIG)));
const src = keepRest(ualRig(await loadUal(SRC)));
const missing = CLIPS.filter((n) => !src.clips[n]);
if (missing.length) throw new Error(`${SRC}: no ${missing.join(', ')}`);

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('ual-saber');
doc.getRoot().setDefaultScene(scene);
// the rig's nodes at rest, the Armature down: what the clips' channels
// name, and the hips' height to scale their travel by
const nodes = {};
const add = (o, parent) => {
  const n = doc.createNode(o.name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
  nodes[o.name] = n;
  (parent ?? scene).addChild(n);
  for (const c of o.children) if (c.isBone) add(c, n);
};
const hipsBone = rig.getObjectByName('Hips');
add(hipsBone.parent, null);

const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
for (const name of CLIPS) {
  const baked = retargetUal(src, src.clips[name], rig, { fps: FPS });
  const extras = { hips: +baked.userData.hips.toFixed(4), source: `Quaternius UAL ${name}` };
  if (name === 'Sword_Attack') Object.assign(extras, attackTimes(src, src.clips[name]));
  const anim = doc.createAnimation(name).setExtras(extras);
  const times = acc(baked.tracks[0].times, 'SCALAR');
  for (const tr of baked.tracks) {
    const [bone, prop] = tr.name.split('.');
    if (!BODY.includes(bone)) continue;
    const vec = prop === 'quaternion';
    const sampler = doc.createAnimationSampler().setInput(times).setOutput(acc(tr.values, vec ? 'VEC4' : 'VEC3')).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[bone]).setTargetPath(vec ? 'rotation' : 'translation').setSampler(sampler));
  }
  console.log(name, `${baked.duration.toFixed(2)} s`, baked.tracks[0].times.length, 'frames', JSON.stringify(extras));
}
const bytes = await new NodeIO().writeBinary(doc);
await writeFile(OUT, bytes);
console.log(OUT, `${(bytes.byteLength / 1024).toFixed(1)} KB`);
