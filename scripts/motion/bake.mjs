// A BVH from scripts/motion/generate.py baked onto Luke as UAL's clips are
// (scripts/ual-bake.mjs): put on UAL's DEF-* names by bvh-map.mjs,
// retargeted by scripts/preview/ualRetarget.js onto Luke's skeleton at rest,
// and written as a small GLB of the bones and the clip alone,
// public/games/meshy/ual-gen.<name>.glb, its clip named gen.<name>. Like
// the library's, it plays on any Meshy figure through clipLibrary.js's
// retarget, scaled by the hips' height it carries (extras.hips).
//
// The whole body goes out, every bone the retarget maps. The extras say
// where the hands move fastest (`strike`, seconds), for the sheet and for a
// stroke to time its contact window by, and what made the clip.
//
// This is its own small writer and not ual-bake.mjs's: that one's bake()
// isn't exported, and it belongs to the sword set's work.
//
//   node scripts/motion/bake.mjs IN.bvh NAME [--out DIR] [--prompt "…"]
//   bakeBvh(text, name, { rig, out, prompt }) → { file, bytes, seconds, frames, extras }

import { Document, NodeIO } from '@gltf-transform/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { retargetUal } from '../preview/ualRetarget.js';
import { bvhSource } from './bvh-map.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LUKE = join(ROOT, 'public', 'models', 'galaxy', 'crew', 'luke.glb');
export const OUT = join(ROOT, 'public', 'games', 'meshy');
const FPS = 30;

// a GLB's JSON chunk
const glbJson = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));

// A figure's skeleton at rest, from its GLB's nodes (nothing to decode, and
// no clip has touched it): ual-bake.mjs's restRig
export function restRig(json) {
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

// When the hands move fastest, in the figure's own frame (the hips' travel
// taken out, so a lunge doesn't count as a swing): a two-handed stroke's
// strike, whichever hand leads it
export function fastest(rig, clip) {
  const mixer = new THREE.AnimationMixer(rig);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const hips = rig.getObjectByName('Hips');
  const hands = ['LeftHand', 'RightHand'].map((n) => rig.getObjectByName(n));
  const at = (t) => {
    mixer.setTime(t);
    rig.updateMatrixWorld(true);
    const h = hips.getWorldPosition(new THREE.Vector3());
    return hands.map((b) => b.getWorldPosition(new THREE.Vector3()).sub(h));
  };
  let best = { t: 0, speed: 0 };
  let last = at(0);
  for (let f = 1; f * (1 / FPS) <= clip.duration + 1e-6; f++) {
    const now = at(f / FPS);
    const speed = Math.max(...now.map((p, i) => p.distanceTo(last[i]))) * FPS;
    if (speed > best.speed) best = { t: (f - 0.5) / FPS, speed };
    last = now;
  }
  action.stop();
  mixer.uncacheRoot(rig);
  return best;
}

export async function bakeBvh(text, name, { rig: rigFile = LUKE, out = OUT, prompt } = {}) {
  const rig = restRig(glbJson(await readFile(rigFile)));
  const { src, clip } = bvhSource(text, { name });
  const baked = retargetUal(src, clip, rig, { fps: FPS });
  const strike = fastest(restRig(glbJson(await readFile(rigFile))), baked);
  const extras = { hips: +baked.userData.hips.toFixed(4), strike: +strike.t.toFixed(3), source: 'HY-Motion 1.0 (scripts/motion)', ...(prompt ? { prompt } : {}) };

  const doc = new Document();
  const buffer = doc.createBuffer();
  const file = `ual-gen.${name}.glb`;
  const scene = doc.createScene(file.replace(/\.glb$/, ''));
  doc.getRoot().setDefaultScene(scene);
  const nodes = {};
  const add = (o, parent) => {
    const n = doc.createNode(o.name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    nodes[o.name] = n;
    (parent ?? scene).addChild(n);
    for (const c of o.children) if (c.isBone) add(c, n);
  };
  // the Armature down: what the channels name, and the scale the hips' travel is in
  add(rig.getObjectByName('Hips').parent, null);
  const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const anim = doc.createAnimation(`gen.${name}`).setExtras(extras);
  const times = acc(baked.tracks[0].times, 'SCALAR');
  for (const tr of baked.tracks) {
    const [bone, prop] = tr.name.split('.');
    const turn = prop === 'quaternion';
    // (turns as normalised shorts, as the library's are: half the bytes, no visible loss)
    const values = turn ? acc(Int16Array.from(tr.values, (v) => Math.round(v * 32767)), 'VEC4').setNormalized(true) : acc(tr.values, 'VEC3');
    const sampler = doc.createAnimationSampler().setInput(times).setOutput(values).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[bone]).setTargetPath(turn ? 'rotation' : 'translation').setSampler(sampler));
  }
  const bytes = await new NodeIO().writeBinary(doc);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, file), bytes);
  return { file: join(out, file), bytes: bytes.byteLength, seconds: baked.duration, frames: baked.tracks[0].times.length, extras };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const [bvh, name] = args.filter((a, i) => !a.startsWith('--') && !['--out', '--prompt'].includes(args[i - 1]));
  if (!bvh || !/^[a-z0-9-]+$/.test(name ?? '')) {
    console.error('usage: node scripts/motion/bake.mjs IN.bvh NAME [--out DIR] [--prompt "…"]   (NAME: a-z, 0-9, dashes)');
    process.exit(1);
  }
  const r = await bakeBvh(await readFile(bvh, 'utf8'), name, { out: opt('--out') ?? OUT, prompt: opt('--prompt') });
  console.log(`${r.file} ${(r.bytes / 1024).toFixed(1)} KB, ${r.seconds.toFixed(2)} s, ${r.frames} frames ${JSON.stringify(r.extras)}`);
}
