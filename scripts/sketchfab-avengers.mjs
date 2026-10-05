// The Avengers compound's people, downloaded from Sketchfab (CC Attribution:
// see public/cc0/README.md and src/data/modelCredits.json for who made each),
// brought into the site's frame for src/components/avengers/world/:
//
//   1. A model that came without the clips the world needs (idle, walk, run)
//      gets them from a separate animated download, retargeted onto its own
//      skeleton: each source bone's turn away from its rest pose is carried
//      onto the matching target bone, after first swinging the target's rest
//      bone to point the way the source's does (so an A-posed model takes a
//      T-posed model's clips without its arms going wrong). The hips' travel is
//      scaled by leg length, and walks and runs are made to stay in place.
//   2. A model that brought its own clips keeps only the ones named, renamed.
//   3. Every bone gets a plain name three.js won't mangle (no "mixamorig:",
//      no Sketchfab's "_12" suffix), the model is stood on y = 0, centred,
//      facing +z and scaled to its real height in metres.
//   4. Then scripts/sketchfab-import.mjs --keep makes it web-sized (textures
//      to WebP, simplified, Meshopt).
//
// The bone map (hips, spine, …, footR) and the rest go into
// public/models/sketchfab/avengers/manifest.json, so the world can find the
// bones to pose a model by hand.
//
//   node scripts/sketchfab-avengers.mjs <folder of downloads> [name …]
//
// The folder holds each download as <file> below. Nothing here talks to
// Sketchfab.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'sketchfab', 'avengers');
const CREDITS = join(ROOT, 'src', 'data', 'modelCredits.json');

// The animation sets (Mixamo-rigged downloads whose clips are borrowed):
// file, which of their clips become idle, walk, run, jump, and (for the
// credits, which point at Cap, who has them all) what they are
const ANIMS = {
  basic: { file: 'anim-basic-male.glb', clips: { idle: 'male_Idle', walk: 'male_Walk', run: 'male_Run' }, as: 'the idle, walk and run Cap, Thor and Black Widow move with' },
  puppet: { file: 'anim-puppet.glb', clips: { jump: 'Jump_place2' }, as: 'Captain America’s jump' },
};

// file: the download; h: real height (m); yaw: turn to face +z (radians);
// clips: { idle: 'their name', … } to keep a model's own, or anims: [sets] to
// borrow; drop: meshes to leave out (by name); tex, tris: for sketchfab-import;
// still: no skeleton, no clips; as: what it is in the world (for the credits)
export const CHARACTERS = {
  cap: { file: 'cap.glb', h: 1.9, anims: ['basic', 'puppet'], tex: 2048, tris: 30000, as: 'Captain America, who you walk the compound as' },
  thor: { file: 'thor.glb', h: 1.98, anims: ['basic'], tex: 1024, tris: 30000, as: 'Thor, about the compound' },
  // (the people standing about are seen a few metres off: half-size textures)
  hulk: { file: 'hulk.glb', h: 2.55, clips: { idle: 'Like_Idle', walk: 'Walk_Fwd_C', run: 'Run_Fwd_C' }, tex: 512, tris: 30000, as: 'Hulk, about the compound' },
  // an armour on its stand (no skeleton)
  ironman: { file: 'ironman.glb', h: 1.98, still: true, tex: 1024, tris: 30000, as: 'an Iron Man armour at the workshop door' },
  widow: { file: 'widow.glb', h: 1.7, anims: ['basic'], tex: 512, tris: 28000, as: 'Black Widow, about the compound' },
};

// ---------------------------------------------------------------------------
// Bones. Each rig family's names for the bones the world cares about.

const SLOTS = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'shoulderL', 'armL', 'elbowL', 'handL', 'shoulderR', 'armR', 'elbowR', 'handR', 'thighL', 'kneeL', 'footL', 'toeL', 'thighR', 'kneeR', 'footR', 'toeR'];
// [slot, pattern] per family, tried against the bone's name with Sketchfab's suffix gone
const FAMILIES = {
  mixamo: {
    test: /^mixamorig/i,
    slots: { hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head', shoulderL: 'LeftShoulder', armL: 'LeftArm', elbowL: 'LeftForeArm', handL: 'LeftHand', shoulderR: 'RightShoulder', armR: 'RightArm', elbowR: 'RightForeArm', handR: 'RightHand', thighL: 'LeftUpLeg', kneeL: 'LeftLeg', footL: 'LeftFoot', toeL: 'LeftToeBase', thighR: 'RightUpLeg', kneeR: 'RightLeg', footR: 'RightFoot', toeR: 'RightToeBase' },
    name: (n) => n.replace(/^mixamorig\d*[:_]?/i, ''),
  },
  // Unreal's mannequin skeleton (Marvel Rivals)
  unreal: {
    test: /^(pelvis|spine_0\d|clavicle_[lr]|upperarm_[lr])$/,
    slots: { hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', upperChest: 'spine_05', neck: 'neck_01', head: 'head', shoulderL: 'clavicle_l', armL: 'upperarm_l', elbowL: 'lowerarm_l', handL: 'hand_l', shoulderR: 'clavicle_r', armR: 'upperarm_r', elbowR: 'lowerarm_r', handR: 'hand_r', thighL: 'thigh_l', kneeL: 'calf_l', footL: 'foot_l', toeL: 'ball_l', thighR: 'thigh_r', kneeR: 'calf_r', footR: 'foot_r', toeR: 'ball_r' },
    name: (n) => n,
  },
  // 3ds Max's Biped ("Bip001 L Thigh", or with dashes)
  biped: {
    test: /^bip0*1[ -]pelvis$/i,
    slots: { hips: 'pelvis', spine: 'spine', chest: 'spine1', upperChest: 'spine2', neck: 'neck', head: 'head', shoulderL: 'l clavicle', armL: 'l upperarm', elbowL: 'l forearm', handL: 'l hand', shoulderR: 'r clavicle', armR: 'r upperarm', elbowR: 'r forearm', handR: 'r hand', thighL: 'l thigh', kneeL: 'l calf', footL: 'l foot', toeL: 'l toe0', thighR: 'r thigh', kneeR: 'r calf', footR: 'r foot', toeR: 'r toe0' },
    name: (n) => n.toLowerCase().replace(/^bip0*1[ -]/, '').replace(/-/g, ' '),
  },
  // Auto-Rig Pro (its deforming bones)
  arp: {
    test: /^(root|spine_01)\.x$/,
    slots: { hips: 'root.x', spine: 'spine_01.x', chest: 'spine_02.x', upperChest: 'spine_03.x', neck: 'neck.x', head: 'head.x', shoulderL: 'shoulder.l', armL: 'arm_stretch.l', elbowL: 'forearm_stretch.l', handL: 'hand.l', shoulderR: 'shoulder.r', armR: 'arm_stretch.r', elbowR: 'forearm_stretch.r', handR: 'hand.r', thighL: 'thigh_stretch.l', kneeL: 'leg_stretch.l', footL: 'foot.l', toeL: 'toes_01.l', thighR: 'thigh_stretch.r', kneeR: 'leg_stretch.r', footR: 'foot.r', toeR: 'toes_01.r' },
    name: (n) => n,
  },
};
// the bone each slot points at, for its direction
const NEXT = { hips: 'spine', spine: 'chest', chest: 'upperChest', upperChest: 'neck', neck: 'head', shoulderL: 'armL', armL: 'elbowL', elbowL: 'handL', shoulderR: 'armR', armR: 'elbowR', elbowR: 'handR', thighL: 'kneeL', kneeL: 'footL', footL: 'toeL', thighR: 'kneeR', kneeR: 'footR', footR: 'toeR' };
// The fingers (Mixamo's and Unreal's), when both rigs have them: thumbL1 … pinkyR3
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
for (const [side, Side] of [['L', 'Left'], ['R', 'Right']])
  for (const f of FINGERS)
    for (let i = 1; i <= 3; i++) {
      const slot = `${f.toLowerCase()}${side}${i}`;
      SLOTS.push(slot);
      FAMILIES.mixamo.slots[slot] = `${Side}Hand${f}${i}`;
      FAMILIES.unreal.slots[slot] = `${f.toLowerCase()}_0${i}_${side.toLowerCase()}`;
      if (i < 3) NEXT[slot] = `${f.toLowerCase()}${side}${i + 1}`;
    }
const PREV = { spine: 'hips', chest: 'spine', upperChest: 'chest', neck: 'upperChest', head: 'neck', shoulderL: 'upperChest', armL: 'shoulderL', elbowL: 'armL', handL: 'elbowL', shoulderR: 'upperChest', armR: 'shoulderR', elbowR: 'armR', handR: 'elbowR', thighL: 'hips', kneeL: 'thighL', footL: 'kneeL', toeL: 'footL', thighR: 'hips', kneeR: 'thighR', footR: 'kneeR', toeR: 'footR' };
for (const slot of SLOTS) if (/\d$/.test(slot) && !slot.endsWith('1')) PREV[slot] = slot.replace(/\d$/, (d) => d - 1);
for (const side of ['L', 'R']) for (const f of FINGERS) PREV[`${f.toLowerCase()}${side}1`] = `hand${side}`;

const bare = (n) => n.replace(/_\d+$/, '');

// slot -> joint node, for a skin's joints
export function mapBones(doc) {
  const joints = doc.getRoot().listSkins().flatMap((s) => s.listJoints());
  const names = joints.map((j) => bare(j.getName()));
  const fam = Object.entries(FAMILIES).find(([, f]) => names.some((n) => f.test.test(n)));
  if (!fam) throw new Error(`no known rig in ${names.slice(0, 8).join(' ')}`);
  const [family, f] = fam;
  const map = {};
  for (const [slot, want] of Object.entries(f.slots)) {
    const i = names.findIndex((n) => f.name(n).toLowerCase() === want.toLowerCase());
    if (i >= 0) map[slot] = joints[i];
  }
  return { family, map };
}

// ---------------------------------------------------------------------------
// Poses. A node's local TRS at time t (the clip's value, or its rest).

export function parents(doc) {
  const p = new Map();
  for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) p.set(c, n);
  return p;
}

export function sample(sampler, t) {
  const input = sampler.getInput().getArray();
  const output = sampler.getOutput().getArray();
  const n = sampler.getOutput().getElementSize();
  const cubic = sampler.getInterpolation() === 'CUBICSPLINE';
  const stride = cubic ? n * 3 : n;
  const off = cubic ? n : 0;
  const at = (i) => Array.from(output.slice(i * stride + off, i * stride + off + n));
  if (t <= input[0]) return at(0);
  if (t >= input[input.length - 1]) return at(input.length - 1);
  let i = 0;
  while (input[i + 1] < t) i++;
  const a = at(i);
  const b = at(i + 1);
  if (sampler.getInterpolation() === 'STEP') return a;
  const k = (t - input[i]) / (input[i + 1] - input[i]);
  if (n === 4) return new Quaternion(...a).slerp(new Quaternion(...b), k).toArray();
  return a.map((v, j) => v + (b[j] - v) * k);
}

// node -> world Matrix4 at time t of a clip (null for the rest pose)
export function worlds(doc, clip, t, override) {
  const anim = new Map();
  if (clip)
    for (const ch of clip.listChannels()) {
      const node = ch.getTargetNode();
      if (!node) continue;
      if (!anim.has(node)) anim.set(node, {});
      anim.get(node)[ch.getTargetPath()] = sample(ch.getSampler(), t);
    }
  const out = new Map();
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const visit = (node, parent) => {
    const a = anim.get(node) ?? {};
    const o = override?.get(node) ?? {};
    const local = new Matrix4().compose(
      new Vector3(...(o.translation ?? a.translation ?? node.getTranslation())),
      new Quaternion(...(o.rotation ?? a.rotation ?? node.getRotation())),
      new Vector3(...(o.scale ?? a.scale ?? node.getScale())),
    );
    const w = parent.clone().multiply(local);
    out.set(node, w);
    for (const c of node.listChildren()) visit(c, w);
  };
  for (const n of scene.listChildren()) visit(n, new Matrix4());
  return out;
}

// Each joint's local TRS in the skin's bind pose (from the inverse bind
// matrices), for a download whose nodes were left posed partway through a
// clip rather than at rest. The bind pose is in the mesh's own space, which
// a converter may have left turned from the nodes' (Z up, say): it is turned
// back by the quarter turns that stand it up facing +z (as a Mixamo or Unreal
// figure is made to), its left on +x.
export function bindPose(doc) {
  const out = new Map();
  const par = parents(doc);
  const rest = worlds(doc, null, 0);
  const { map } = mapBones(doc);
  for (const skin of doc.getRoot().listSkins()) {
    const ibm = skin.getInverseBindMatrices();
    if (!ibm) continue;
    const joints = skin.listJoints();
    const bind = new Map(joints.map((j, i) => [j, new Matrix4().fromArray(ibm.getElement(i, [])).invert()]));
    // the figure's frame in the mesh's space: across (right thigh to left), up (hips to head), ahead
    const frame = (w) => {
      const at = (slot) => pos(w.get(map[slot]));
      const up = at('head').sub(at('hips')).normalize();
      const across = at('thighL').sub(at('thighR'));
      const len = across.length();
      across.addScaledVector(up, -across.dot(up)).normalize();
      return { basis: new Matrix4().makeBasis(across, up, new Vector3().crossVectors(across, up)), len };
    };
    const want = frame(rest);
    const have = frame(bind);
    const turn = have.basis.clone().invert();
    const e = turn.elements;
    for (let i = 0; i < 16; i++) if (i % 4 < 3 && i < 12) e[i] = Math.round(e[i]);
    turn.multiplyScalar(want.len / have.len);
    turn.elements[15] = 1;
    // stood where the skin's top joint really is
    const top = joints.find((j) => !bind.has(par.get(j)));
    const moved = turn.clone().multiply(bind.get(top));
    turn.premultiply(new Matrix4().makeTranslation(pos(rest.get(top)).sub(pos(moved))));
    for (const j of joints) bind.set(j, turn.clone().multiply(bind.get(j)));
    for (const j of joints) {
      const p = par.get(j);
      const parentW = bind.get(p) ?? rest.get(p) ?? new Matrix4();
      const local = parentW.clone().invert().multiply(bind.get(j));
      const t = new Vector3();
      const q = new Quaternion();
      const sc = new Vector3();
      local.decompose(t, q, sc);
      out.set(j, { translation: t.toArray(), rotation: q.toArray(), scale: sc.toArray() });
    }
  }
  return out;
}

export const rot = (m) => {
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  m.decompose(p, q, s);
  return q;
};
export const pos = (m) => new Vector3().setFromMatrixPosition(m);

// ---------------------------------------------------------------------------
// Retargeting one clip from src onto dst.

export function retarget(src, srcClip, dst, name, { inPlace, bind = false }) {
  const S = mapBones(src);
  const D = mapBones(dst);
  const slots = SLOTS.filter((s) => S.map[s] && D.map[s]);
  // (bind: the source's rest is its bind pose, not its nodes as they were left)
  const srcRest = worlds(src, null, 0, bind ? bindPose(src) : undefined);
  const dstRest = worlds(dst, null, 0);
  const dstParent = parents(dst);

  // the swing that turns each target rest bone to point the way the source's does
  const swing = {};
  for (const slot of SLOTS) {
    if (!slots.includes(slot)) continue;
    const next = NEXT[slot];
    if (next && slots.includes(next)) {
      const ds = pos(srcRest.get(S.map[next])).sub(pos(srcRest.get(S.map[slot]))).normalize();
      const dd = pos(dstRest.get(D.map[next])).sub(pos(dstRest.get(D.map[slot]))).normalize();
      swing[slot] = new Quaternion().setFromUnitVectors(dd, ds);
    } else swing[slot] = PREV[slot] && swing[PREV[slot]] ? swing[PREV[slot]].clone() : new Quaternion();
  }
  // the hips' height over the feet, to scale their travel
  const hipH = (w, M) => pos(w.get(M.hips)).y - (pos(w.get(M.footL)).y + pos(w.get(M.footR)).y) / 2;
  const k = hipH(dstRest, D.map) / hipH(srcRest, S.map);

  const input = srcClip.listSamplers().map((s) => s.getInput().getArray());
  const duration = Math.max(...input.map((a) => a[a.length - 1]));
  const fps = 30;
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const times = Array.from({ length: frames }, (_, i) => (i / (frames - 1)) * duration);

  const tracks = new Map(slots.map((s) => [s, []]));
  const hipTrack = [];
  // order the target's slots parent-first
  const order = slots.slice().sort((a, b) => depth(D.map[a]) - depth(D.map[b]));
  function depth(n) {
    let d = 0;
    for (let p = dstParent.get(n); p; p = dstParent.get(p)) d++;
    return d;
  }
  const hipsRestW = pos(srcRest.get(S.map.hips));
  for (const t of times) {
    const sw = worlds(src, srcClip, t);
    const override = new Map();
    // the hips' travel, in the world, scaled
    const delta = pos(sw.get(S.map.hips)).sub(hipsRestW).multiplyScalar(k);
    hipTrack.push(delta);
    for (const slot of order) {
      const node = D.map[slot];
      const want = rot(sw.get(S.map[slot])).multiply(rot(srcRest.get(S.map[slot])).invert()).multiply(swing[slot]).multiply(rot(dstRest.get(node)));
      // the parent as it now stands
      const dw = worlds(dst, null, 0, override);
      const parentW = rot(dw.get(dstParent.get(node)) ?? new Matrix4());
      const local = parentW.invert().multiply(want).normalize();
      override.set(node, { rotation: local.toArray() });
      tracks.get(slot).push(local);
    }
  }
  // walks and runs stay where they are: take out the drift over the clip
  if (inPlace) {
    const first = hipTrack[0].clone();
    const drift = hipTrack[hipTrack.length - 1].clone().sub(first);
    hipTrack.forEach((d, i) => {
      d.x -= drift.x * (i / (frames - 1)) + first.x;
      d.z -= drift.z * (i / (frames - 1)) + first.z;
    });
  }

  const anim = dst.createAnimation(name);
  const buf = dst.getRoot().listBuffers()[0];
  const tAcc = dst.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buf);
  for (const slot of slots) {
    const qs = tracks.get(slot);
    for (let i = 1; i < qs.length; i++) if (qs[i].dot(qs[i - 1]) < 0) qs[i].set(-qs[i].x, -qs[i].y, -qs[i].z, -qs[i].w);
    const out = dst.createAccessor().setType('VEC4').setArray(new Float32Array(qs.flatMap((q) => q.toArray()))).setBuffer(buf);
    const s = dst.createAnimationSampler().setInput(tAcc).setOutput(out).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(dst.createAnimationChannel().setTargetNode(D.map[slot]).setTargetPath('rotation').setSampler(s));
  }
  // hips position: rest, plus the travel taken into the hips' parent's frame
  const hips = D.map.hips;
  const hp = dstParent.get(hips);
  const hipsRest = pos(dstRest.get(hips));
  const toLocal = (hp ? dstRest.get(hp) : new Matrix4()).clone().invert();
  const ps = hipTrack.map((d) => hipsRest.clone().add(d).applyMatrix4(toLocal));
  const out = dst.createAccessor().setType('VEC3').setArray(new Float32Array(ps.flatMap((p) => p.toArray()))).setBuffer(buf);
  const s = dst.createAnimationSampler().setInput(tAcc).setOutput(out).setInterpolation('LINEAR');
  anim.addSampler(s).addChannel(dst.createAnimationChannel().setTargetNode(hips).setTargetPath('translation').setSampler(s));
  return { frames, slots: slots.length };
}

// ---------------------------------------------------------------------------
// Placing: bounds of the skinned rest pose (vertices through their joints),
// or of the pose at time t of a clip

export function bounds(doc, clip = null, t = 0) {
  const w = worlds(doc, clip, t);
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const skin = node.getSkin();
    const jm = skin?.listJoints().map((j, i) => {
      const ibm = skin.getInverseBindMatrices();
      const m = new Matrix4().fromArray(ibm ? ibm.getElement(i, []) : new Matrix4().toArray());
      return w.get(j).clone().multiply(m);
    });
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      const J = prim.getAttribute('JOINTS_0');
      const W = prim.getAttribute('WEIGHTS_0');
      const v = new Vector3();
      for (let i = 0; i < P.getCount(); i++) {
        v.fromArray(P.getElement(i, []));
        let p;
        if (skin && J && W) {
          const j = J.getElement(i, []);
          const wt = W.getElement(i, []);
          p = new Vector3();
          for (let k = 0; k < 4; k++) if (wt[k] > 0) p.add(v.clone().applyMatrix4(jm[j[k]]).multiplyScalar(wt[k]));
        } else p = v.clone().applyMatrix4(w.get(node));
        lo.min(p);
        hi.max(p);
      }
    }
  }
  return { lo, hi };
}

// The extras Sketchfab writes into every download: "Name (https://sketchfab.com/user)"
export function credit(asset, as, file) {
  const x = asset.extras ?? {};
  const [, author = x.author ?? 'unknown', authorUrl = ''] = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(x.author ?? '') ?? [];
  const [, license = x.license ?? '', licenseUrl = ''] = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(x.license ?? '') ?? [];
  return { title: x.title ?? as, author, authorUrl, license, licenseUrl, source: x.source ?? '', where: 'avengers', as, file };
}

// three.js keeps a name only if it has none of [ ] . : / and no spaces
const clean = (n) => n.replace(/^mixamorig\d*[:_]?/i, '').replace(/[[\].:/\s]+/g, '_');

async function main() {
  const [dir, ...only] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node scripts/sketchfab-avengers.mjs <folder of downloads> [name …]');
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const manifestPath = join(OUT, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  await mkdir(OUT, { recursive: true });

  for (const [name, c] of Object.entries(CHARACTERS)) {
    if (only.length && !only.includes(name)) continue;
    const from = join(dir, c.file);
    if (!existsSync(from)) {
      console.log(`skip     ${name} (no ${c.file} in ${dir})`);
      continue;
    }
    const doc = await io.read(from);
    const root = doc.getRoot();
    const asset = root.getAsset();
    for (const m of root.listMeshes()) if (c.drop?.some((d) => m.getName().includes(d))) m.dispose();

    const { map } = c.still ? { map: {} } : mapBones(doc);
    const clips = [];
    if (c.still) for (const a of root.listAnimations()) a.dispose();
    else if (c.clips) {
      // its own: keep the named, renamed
      const keep = new Map(Object.entries(c.clips).map(([to, fromName]) => [fromName, to]));
      for (const a of root.listAnimations()) {
        if (keep.has(a.getName())) {
          a.setName(keep.get(a.getName()));
          clips.push(a.getName());
        } else a.dispose();
      }
    } else {
      for (const a of root.listAnimations()) a.dispose();
      for (const set of c.anims ?? []) {
        const A = ANIMS[set];
        const src = await io.read(join(dir, A.file));
        credits[`avengers-anim-${set}`] = credit(src.getRoot().getAsset(), A.as, '/models/sketchfab/avengers/cap.glb');
        for (const [to, fromName] of Object.entries(A.clips)) {
          const clip = src.getRoot().listAnimations().find((a) => a.getName() === fromName);
          if (!clip) throw new Error(`${A.file} has no clip ${fromName}`);
          const r = retarget(src, clip, doc, to, { inPlace: to === 'walk' || to === 'run' || to === 'jump' });
          console.log(`  ${name}: ${to} <- ${A.file}:${fromName} (${r.slots} bones, ${r.frames} frames)`);
          clips.push(to);
        }
      }
    }
    // tidy the bones' names (animation channels point at nodes, not names)
    const taken = new Set();
    for (const node of root.listNodes()) {
      let n = clean(bare(node.getName()) || 'node');
      if (taken.has(n)) n = clean(node.getName());
      while (taken.has(n)) n += '_';
      taken.add(n);
      node.setName(n);
    }
    // stand it up: feet on y = 0, centred, facing +z, h metres tall
    const { lo, hi } = bounds(doc);
    const s = c.h / (hi.y - lo.y);
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    const top = doc.createNode(name);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), c.yaw ?? 0);
    const centre = new Vector3((lo.x + hi.x) / 2, lo.y, (lo.z + hi.z) / 2).multiplyScalar(s).applyQuaternion(q);
    top.setScale([s, s, s]).setRotation(q.toArray()).setTranslation([-centre.x, -centre.y, -centre.z]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      top.addChild(child);
    }
    scene.addChild(top);
    for (const cam of root.listCameras()) cam.dispose();
    await doc.transform(prune({ keepLeaves: false }));

    const tmp = join(tmpdir(), `avengers-${name}.glb`);
    await io.write(tmp, doc);
    const file = join(OUT, `${name}.glb`);
    console.log(
      execFileSync('node', [join(ROOT, 'scripts', 'sketchfab-import.mjs'), tmp, file, '--keep', '--tex', String(c.tex), '--tris', String(c.tris)], { encoding: 'utf8' }).trim(),
    );
    await rm(tmp);

    // what the world needs to know
    const out = await io.read(file);
    const tris = out
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
    const pick = (slot) => map[slot]?.getName();
    const bones = {
      hips: pick('hips'),
      spine: pick('spine'),
      chest: pick('upperChest') ?? pick('chest'),
      neck: pick('neck'),
      head: pick('head'),
      shoulderL: pick('armL'),
      elbowL: pick('elbowL'),
      handL: pick('handL'),
      shoulderR: pick('armR'),
      elbowR: pick('elbowR'),
      handR: pick('handR'),
      thighL: pick('thighL'),
      kneeL: pick('kneeL'),
      footL: pick('footL'),
      thighR: pick('thighR'),
      kneeR: pick('kneeR'),
      footR: pick('footR'),
    };
    const key = `avengers-${name}`;
    manifest[name] = { h: c.h, rig: !c.still, clips, ...(c.still ? {} : { bones }), tris: Math.round(tris), bytes: (await stat(file)).size, credit: key };
    credits[key] = credit(asset, c.as, `/models/sketchfab/avengers/${name}.glb`);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(CREDITS, JSON.stringify(credits, null, 2) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });

