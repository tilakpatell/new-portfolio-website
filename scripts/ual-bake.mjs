// Clips from Quaternius's Universal Animation Library (CC0, the free
// Standard pack's Godot GLB), retargeted onto the Meshy rig every figure
// the site made with Meshy stands on, and baked into small GLBs, in sets:
//
//   saber  The body under a lit lightsaber, in one file,
//          public/games/meshy/ual-saber.glb. Sword_Idle is the guard's
//          crouch, Sword_Attack the lunge under a stroke. Only the body goes
//          out: the hips (their turn and travel), the spine, the neck and
//          both legs. The arms stay gunplay's and saber.js's, which pose
//          them over it.
//   life   What a figure does that Meshy's library doesn't (talking,
//          sitting, crouching, hits, a death, a pistol, punches, jumps, a
//          spell, swimming, driving, a calm idle), a file per clip,
//          public/games/meshy/ual-<name>.glb, named as the clip library
//          names it (src/lib/three/clipLibrary.js CLIPS). The whole body
//          goes out, every bone the retarget maps; a layer's mask is the
//          animator's, when it plays.
//
// The retarget is scripts/preview/ualRetarget.js's, onto Luke as he stands
// at rest (his skeleton read straight out of luke.glb's nodes, never posed
// by a clip). A clip baked on him plays on any Meshy figure through
// clipLibrary.js retarget(), as Rick's do; each carries the hips' height it
// was made for (extras.hips → clip.userData.hips) to scale by.
// Sword_Attack's extras also say where in it the blade strikes (`strike`,
// seconds: the swinging hand at its fastest) and where the lunge comes back
// up (`back`), for saberBody.js to lay a stroke over.
//
// --report prints how far each bake is from the mannequin it came off: the
// file read back and played on Luke beside the UAL clip on its own, at each
// key and halfway between. Per bone the file moves, its turn in the world
// away from its rest (squared back onto the mannequin's rest, as the
// retarget squares it) against the mannequin's bone's, faced Luke's way, as
// an angle in radians; and the hips' travel against the mannequin's, as a
// share of the hips' height. On the keys it is float noise; between them,
// what thirty frames a second lose.
//
// The pack isn't in the repo (6.7 MB): download universal_animation_library
// standard.zip from opengameart.org/content/universal-animation-library and
// put its Godot/AnimationLibrary_Godot_Standard.glb at
// scripts/preview/.ual/ual.glb (git-ignored), or pass its path.
//
//   node scripts/ual-bake.mjs [ual.glb] [--set saber|life|pro|ual2] [--report]
//     (every set but core, when --set doesn't name one)
//
// Into a figure: a set's clips retargeted onto the figure's own skeleton
// (any humanoid's: Mixamo's, found by role through rig.js's findBones) and
// written into a copy of its GLB as its animations, named as the clip
// library names them, so a catalogue row's `anim` plays them. `core` (UAL1:
// idle, walk, run, talk, hit, die, sit) is the set a surface figure needs.
//
//   node scripts/ual-bake.mjs --rig <figure.glb> --into <out.glb> [--set core]
//   bakeInto(figureFile, outFile, { set, src, findBones }) → { clips, bytes, added }
//     src: a mannequin (ualRig, keepRest) in place of the set's pack;
//     findBones: rig.js's (the CLI loads it through Vite)
//   bakeFiles(setName, names, outDir) → [{ file, kb }]: a set's per-clip files
//     baked into outDir as they are into public/games/meshy (the byte test)

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { UAL_MAP, keepRest, prepareUal, retargetUal, toRest, ualRig } from './preview/ualRetarget.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = process.argv[1] === fileURLToPath(import.meta.url);
const args = MAIN ? process.argv.slice(2) : [];
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const ONLY = opt('--set');
const SRC = args.find((a, i) => !a.startsWith('--') && !['--set', '--rig', '--into'].includes(args[i - 1])) ?? join(ROOT, 'scripts', 'preview', '.ual', 'ual.glb');
const REPORT = args.includes('--report');
const RIG = join(ROOT, 'public', 'models', 'galaxy', 'crew', 'luke.glb');
const OUT = join(ROOT, 'public', 'games', 'meshy');
const FPS = 30;
// the body: what goes out of each clip (the arms, the head and the hands stay out)
const BODY = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
// The sets: one file for the set (`file`) or one per clip (ual-<name>.glb),
// its clips as UAL names them → the names they go out under, the bones that
// go out (every bone the retarget maps, where it doesn't say), and whether
// the turns go out as 16-bit numbers (`short`: glTF lets a rotation be a
// normalized short, half a float's bytes, and three's loader reads it back
// as one; a turn moves by about 1e-4 rad)
export const SETS = [
  // what a surface figure needs to live (actors.js: walk, idle, talk, sit,
  // hit, die), baked into the figure's own file (--rig, --into), not out
  {
    name: 'core',
    pack: 'ual1',
    short: true,
    into: true,
    fps: 24, // (thirty a second came to just over 60 KB a figure)
    clips: { Idle_Loop: 'idle', Walk_Loop: 'walk', Jog_Fwd_Loop: 'run', Idle_Talking_Loop: 'talk', Hit_Chest: 'hit.chest', Death01: 'die', Sitting_Idle_Loop: 'sit.idle' },
  },
  { name: 'saber', file: 'ual-saber.glb', bones: BODY, clips: { Sword_Idle: 'Sword_Idle', Sword_Attack: 'Sword_Attack' } },
  {
    name: 'life',
    short: true,
    clips: {
      Idle_Talking_Loop: 'talk',
      Sitting_Enter: 'sit.enter',
      Sitting_Idle_Loop: 'sit.idle',
      Sitting_Talking_Loop: 'sit.talk',
      Sitting_Exit: 'sit.exit',
      Crouch_Idle_Loop: 'crouch',
      Crouch_Fwd_Loop: 'crouch.walk',
      Interact: 'interact',
      PickUp_Table: 'pickup',
      Fixing_Kneeling: 'kneel.fix',
      Hit_Chest: 'hit.chest',
      Hit_Head: 'hit.head',
      Death01: 'die',
      Pistol_Aim_Neutral: 'aim.pistol',
      Pistol_Aim_Up: 'aim.pistol.up',
      Pistol_Aim_Down: 'aim.pistol.down',
      Pistol_Shoot: 'shoot.pistol',
      Pistol_Reload: 'reload',
      Punch_Jab: 'jab',
      Punch_Cross: 'cross',
      Roll: 'roll',
      Jump_Start: 'jump.start',
      Jump_Loop: 'jump.loop',
      Jump_Land: 'jump.land',
      Push_Loop: 'push',
      Spell_Simple_Enter: 'cast.enter',
      Spell_Simple_Idle_Loop: 'cast.idle',
      Spell_Simple_Shoot: 'cast',
      Sprint_Loop: 'sprint',
      Walk_Formal_Loop: 'walk.formal',
      Idle_Torch_Loop: 'torch',
      Dance_Loop: 'dance.ual',
      Swim_Fwd_Loop: 'swim',
      Swim_Idle_Loop: 'swim.idle',
      Driving_Loop: 'drive',
      Idle_Loop: 'idle.calm',
    },
  },
  // the paid packs' (the source zips, `node scripts/assets-fetch.mjs ual1
  // ual2`: the newer Unreal-style rig, which the retarget knows under the
  // older names), what the free one and Meshy's library don't have
  {
    name: 'pro',
    pack: 'ual1',
    short: true,
    clips: {
      Jog_Fwd_Loop: 'jog',
      Jog_Bwd_Loop: 'jog.back',
      Jog_Left_Loop: 'jog.left',
      Jog_Right_Loop: 'jog.right',
      Jog_Fwd_L_Loop: 'jog.fwd.left',
      Jog_Fwd_R_Loop: 'jog.fwd.right',
      Jog_Bwd_L_Loop: 'jog.back.left',
      Jog_Bwd_R_Loop: 'jog.back.right',
      Crouch_Fwd_L_Loop: 'crouch.fwd.left',
      Crouch_Fwd_R_Loop: 'crouch.fwd.right',
      Hit_Shoulder_L: 'hit.shoulder.l',
      Hit_Shoulder_R: 'hit.shoulder.r',
      Hit_Stomach: 'hit.stomach',
      Death02: 'die.2',
      Idle_Tired_Loop: 'tired',
      Sitting_Idle02_Loop: 'sit.idle2',
      Sitting_Idle03_Loop: 'sit.idle3',
      Sitting_Nodding_Loop: 'sit.nod',
      GroundSit_Enter: 'sit.ground.enter',
      GroundSit_Idle_Loop: 'sit.ground',
      GroundSit_Exit: 'sit.ground.exit',
      Crawl_Fwd_Loop: 'crawl',
      Crawl_Idle_Loop: 'crawl.idle',
      Counter_Idle_Loop: 'counter.idle',
      Counter_Give: 'counter.give',
      Counter_Show: 'counter.show',
      Counter_Angry: 'counter.angry',
      Celebration: 'celebrate',
      Crying: 'cry',
      PickUp_Kneeling: 'pickup.kneel',
      BackFlip: 'backflip',
      Spell_Double_Enter: 'cast.double.enter',
      Spell_Double_Shoot_Loop: 'cast.double',
    },
  },
  {
    name: 'ual2',
    pack: 'ual2',
    short: true,
    clips: {
      Walk_L_Loop: 'walk.left',
      Walk_R_Loop: 'walk.right',
      Walk_Fwd_L_Loop: 'walk.fwd.left',
      Walk_Fwd_R_Loop: 'walk.fwd.right',
      Walk_Bwd_L_Loop: 'walk.back.left',
      Walk_Bwd_R_Loop: 'walk.back.right',
      Idle_FoldArms_Loop: 'arms.folded',
      Yes: 'nod',
      Idle_No_Loop: 'shake',
      Surprise: 'surprise',
      Consume: 'eat',
      Bandage_Loop: 'bandage',
      Hit_Knockback: 'hit.knock',
      KipUp: 'kipup',
      IdleToLay: 'lie.down',
      LayToIdle: 'lie.up',
      Melee_Combo: 'melee.combo',
      Melee_Hook: 'melee.hook',
      Melee_Knee: 'melee.knee',
      OverhandThrow: 'throw',
      Mining_Loop: 'mine',
      TreeChopping_Loop: 'chop',
      Idle_Lantern_Loop: 'lantern',
      Idle_Rail_Loop: 'lean.rail',
      Chest_Open: 'open.chest',
      Sword_Regular_A: 'sword.a',
      Sword_Regular_B: 'sword.b',
      Sword_Regular_C: 'sword.c',
      Sword_Light_A: 'sword.light.a',
      Sword_Light_B: 'sword.light.b',
      Sword_Light_C: 'sword.light.c',
      Sword_Heavy_A: 'sword.heavy',
      Sword_Block: 'sword.block',
      Sword_Dash: 'sword.dash',
      LiftAir_Idle_Loop: 'lifted',
      LiftAir_Fall: 'lifted.fall',
      LiftAir_Fall_Impact: 'lifted.land',
      Zombie_Idle_Loop: 'zombie.idle',
      Zombie_Walk_Fwd_Loop: 'zombie.walk',
      Zombie_Bite: 'zombie.bite',
      Zombie_Scratch: 'zombie.scratch',
      Farm_Harvest: 'farm.harvest',
      Farm_Watering: 'farm.water',
      Farm_PlantSeed: 'farm.plant',
      Fish_Cast: 'fish.cast',
      Fish_Cast_Idle_Loop: 'fish.idle',
      Fish_Reel: 'fish.reel',
      Turn180_L: 'turn.around',
    },
  },
];
// where a set's pack's GLB is, fetched (scripts/assets-fetch.mjs)
const PACK_GLB = { ual1: join(ROOT, 'lab', 'assets', 'ual1', 'Unreal-Godot', 'UAL1.glb'), ual2: join(ROOT, 'lab', 'assets', 'ual2', 'Unreal-Godot', 'UAL2.glb') };

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

const parseGlb = (buf) => {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
};
const loadUal = async (file) => parseGlb(await readFile(file));

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

// How far a baked file is from the mannequin (see --report, above): for each
// of its clips, the worst bone's angle on the keys and between them, and the
// hips' worst travel off the mannequin's, as a share of their height
const TO_SRC = Object.fromEntries(Object.entries(UAL_MAP).map(([s, t]) => [t, s]));
const posed = (o, inv) => {
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(p, q, new THREE.Vector3());
  return { p, q };
};
// the angle between two turns (radians), read off the vector part so a
// small one isn't lost to acos
const apart = (a, b) => {
  const d = a.clone().invert().multiply(b);
  return 2 * Math.atan2(Math.hypot(d.x, d.y, d.z), Math.abs(d.w));
};
async function drift(bytes, takes) {
  const back = await parseGlb(bytes);
  const fig = rig.clone(true);
  toRest(src);
  const { tRest, sRest, face, align, hipsK, sInv } = prepareUal(src, fig);
  const faceInv = face.clone().invert();
  const tInv = fig.matrixWorld.clone().invert();
  const height = tRest.Hips.p.y - Math.min(tRest.LeftToeBase.p.y, tRest.RightToeBase.p.y);
  return takes.map(([from, name]) => {
    const clip = back.animations.find((a) => a.name === name);
    const moved = [...new Set(clip.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => t.name.split('.')[0]))].filter((n) => TO_SRC[n]);
    const sm = new THREE.AnimationMixer(src.scene);
    const sa = sm.clipAction(src.clips[from]).play();
    const tm = new THREE.AnimationMixer(fig);
    const ta = tm.clipAction(clip).play();
    const keys = clip.tracks[0].times;
    const worst = { keys: 0, between: 0, hips: 0 };
    for (let i = 0; i < keys.length * 2 - 1; i++) {
      const t = i % 2 ? (keys[(i - 1) / 2] + keys[(i + 1) / 2]) / 2 : keys[i / 2];
      const at = i % 2 ? 'between' : 'keys';
      sa.time = t;
      sm.update(0);
      src.scene.updateMatrixWorld(true);
      ta.time = t;
      tm.update(0);
      fig.updateMatrixWorld(true);
      for (const n of moved) {
        const s = TO_SRC[n];
        // the mannequin's turn off its rest, faced Luke's way; Luke's off his, squared back
        const want = face.clone().multiply(posed(src.bones[s], sInv).q).multiply(sRest[s].q.clone().invert()).multiply(faceInv);
        const got = posed(fig.getObjectByName(n), tInv).q.multiply(tRest[n].q.clone().invert()).multiply(align[n].clone().invert());
        worst[at] = Math.max(worst[at], apart(want, got));
      }
      const wantP = posed(src.bones['DEF-hips'], sInv).p.sub(sRest['DEF-hips'].p).applyQuaternion(face).multiplyScalar(hipsK);
      const gotP = posed(fig.getObjectByName('Hips'), tInv).p.sub(tRest.Hips.p);
      worst.hips = Math.max(worst.hips, gotP.distanceTo(wantP) / height);
    }
    sa.stop();
    sm.uncacheRoot(src.scene);
    tm.uncacheRoot(fig);
    toRest(src);
    return worst;
  });
}

// One GLB: the rig's nodes at rest, the Armature down (what the clips'
// channels name, and the hips' height to scale their travel by), and its
// clips (`takes`: [UAL's name, the name it goes out under]) on the bones
// the set sends out, as its set has them
async function bake(file, takes, { bones = null, short = false }, out = OUT) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(file.replace(/\.glb$/, ''));
  doc.getRoot().setDefaultScene(scene);
  const nodes = {};
  const add = (o, parent) => {
    const n = doc.createNode(o.name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    nodes[o.name] = n;
    (parent ?? scene).addChild(n);
    for (const c of o.children) if (c.isBone) add(c, n);
  };
  add(rig.getObjectByName('Hips').parent, null);

  const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const turns = (values) => (short ? acc(Int16Array.from(values, (v) => Math.round(v * 32767)), 'VEC4').setNormalized(true) : acc(values, 'VEC4'));
  for (const [from, name] of takes) {
    const baked = retargetUal(src, src.clips[from], rig, { fps: FPS });
    const extras = { hips: +baked.userData.hips.toFixed(4), source: `Quaternius UAL ${from}` };
    if (from === 'Sword_Attack') Object.assign(extras, attackTimes(src, src.clips[from]));
    const anim = doc.createAnimation(name).setExtras(extras);
    const times = acc(baked.tracks[0].times, 'SCALAR');
    for (const tr of baked.tracks) {
      const [bone, prop] = tr.name.split('.');
      if (bones && !bones.includes(bone)) continue;
      const vec = prop === 'quaternion';
      const sampler = doc.createAnimationSampler().setInput(times).setOutput(vec ? turns(tr.values) : acc(tr.values, 'VEC3')).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[bone]).setTargetPath(vec ? 'rotation' : 'translation').setSampler(sampler));
    }
    console.log(name === from ? name : `${name} (${from})`, `${baked.duration.toFixed(2)} s`, baked.tracks[0].times.length, 'frames', JSON.stringify(extras));
  }
  const bytes = await new NodeIO().writeBinary(doc);
  await writeFile(join(out, file), bytes);
  const kb = bytes.byteLength / 1024;
  console.log(join(out, file), `${kb.toFixed(1)} KB`);
  const off = REPORT ? await drift(bytes, takes) : [];
  off.forEach((w, i) => console.log(`  ${takes[i][1]} off the mannequin: ${w.keys.toFixed(5)} rad on the keys, ${w.between.toFixed(5)} between, hips ${w.hips.toFixed(5)} of their height`));
  return { file, kb, off };
}

let rig = null;
// (each pack's mannequin, loaded once: the free pack's unless a set names another)
const sources = new Map();
const sourceOf = async (set) => {
  const file = set.pack ? PACK_GLB[set.pack] : SRC;
  if (!sources.has(file)) sources.set(file, keepRest(ualRig(await loadUal(file))));
  return sources.get(file);
};
let src = null;
const setOf = (name) => {
  const set = SETS.find((s) => s.name === name);
  if (!set) throw new Error(`no set ${name} (${SETS.map((s) => s.name).join(', ')})`);
  return set;
};

export async function bakeFiles(setName, names, outDir) {
  const set = setOf(setName);
  rig ??= restRig(glbJson(await readFile(RIG)));
  src = await sourceOf(set);
  toRest(src);
  const made = [];
  for (const take of Object.entries(set.clips).filter(([, n]) => names.includes(n))) made.push(await bake(`ual-${take[1]}.glb`, [take], set, outDir));
  return made;
}

// the figure's file read and written with its compression as it came
let io = null;
async function ioOf() {
  if (io) return io;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  return io;
}

export async function bakeInto(figureFile, outFile, { set: setName = 'core', src: given = null, findBones = null } = {}) {
  const set = setOf(setName);
  const from = given ?? (await sourceOf(set));
  const missing = Object.keys(set.clips).filter((n) => !from.clips[n]);
  if (missing.length) throw new Error(`${set.name}: no ${missing.join(', ')}`);
  const buf = await readFile(figureFile);
  const json = glbJson(buf);
  const rest = restRig(json);
  // (the skeleton's bones by name: each a node of the file, by its index)
  const index = new Map();
  json.nodes.forEach((n, i) => {
    const name = n.name ?? `node${i}`;
    if (index.has(name)) index.set(name, -1);
    else index.set(name, i);
  });
  const doc = await (await ioOf()).readBinary(new Uint8Array(buf));
  const nodes = doc.getRoot().listNodes();
  if (nodes.length !== json.nodes.length) throw new Error(`${figureFile}: ${nodes.length} nodes read, ${json.nodes.length} in its JSON`);
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const turns = (values) => (set.short ? acc(Int16Array.from(values, (v) => Math.round(v * 32767)), 'VEC4').setNormalized(true) : acc(values, 'VEC4'));
  const before = buf.byteLength;
  const clips = [];
  toRest(from);
  for (const [take, name] of Object.entries(set.clips)) {
    for (const a of doc.getRoot().listAnimations()) if (a.getName() === name) a.dispose();
    const baked = retargetUal(from, from.clips[take], rest, { fps: set.fps ?? FPS, findBones });
    const anim = doc.createAnimation(name).setExtras({ source: `Quaternius UAL ${take}` });
    const times = acc(baked.tracks[0].times, 'SCALAR');
    for (const tr of baked.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const [bone, prop] = [tr.name.slice(0, dot), tr.name.slice(dot + 1)];
      const i = index.get(bone);
      if (i == null || i < 0) throw new Error(`${figureFile}: no one node named ${bone}`);
      const vec = prop === 'quaternion';
      const sampler = doc.createAnimationSampler().setInput(times).setOutput(vec ? turns(tr.values) : acc(tr.values, 'VEC3')).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[i]).setTargetPath(vec ? 'rotation' : 'translation').setSampler(sampler));
    }
    clips.push(name);
  }
  // (the turns filtered as meshopt packs a quaternion: a third smaller; the
  // mesh, already quantized, comes out as it went in)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const bytes = await (await ioOf()).writeBinary(doc);
  await writeFile(outFile, bytes);
  return { clips, bytes: bytes.byteLength, added: bytes.byteLength - before };
}

async function main() {
  if (opt('--rig')) {
    const figure = opt('--rig');
    const out = opt('--into') ?? figure;
    // (rig.js's role finder, which imports as Vite resolves, through Vite)
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
    try {
      const { findBones } = await vite.ssrLoadModule('/src/lib/three/rig.js');
      const r = await bakeInto(figure, out, { set: ONLY ?? 'core', findBones });
      console.log(out, `${(r.bytes / 1024).toFixed(1)} KB (${(r.added / 1024).toFixed(1)} KB more)`, r.clips.join(', '));
    } finally {
      await vite.close();
    }
    return;
  }
  rig = restRig(glbJson(await readFile(RIG)));
  const sets = ONLY ? SETS.filter((s) => s.name === ONLY) : SETS.filter((s) => !s.into);
  if (!sets.length) throw new Error(`no set ${ONLY} (${SETS.map((s) => s.name).join(', ')})`);
  if (sets.some((s) => s.into)) throw new Error(`${ONLY} goes into a figure: --rig <figure.glb> --into <out.glb>`);
  for (const set of sets) {
    const from = await sourceOf(set);
    const missing = Object.keys(set.clips).filter((n) => !from.clips[n]);
    if (missing.length) throw new Error(`${set.name}: no ${missing.join(', ')}`);
  }

  const made = [];
  for (const set of sets) {
    src = await sourceOf(set);
    toRest(src);
    const takes = Object.entries(set.clips);
    if (set.file) made.push(await bake(set.file, takes, set));
    else for (const take of takes) made.push(await bake(`ual-${take[1]}.glb`, [take], set));
  }
  const kbs = made.map((m) => m.kb);
  console.log(`${made.length} files, ${Math.min(...kbs).toFixed(1)}–${Math.max(...kbs).toFixed(1)} KB, ${kbs.reduce((a, b) => a + b, 0).toFixed(0)} KB in all`);
  if (REPORT) {
    const all = made.flatMap((m) => m.off);
    const most = (k) => Math.max(...all.map((w) => w[k])).toFixed(5);
    console.log(`off the mannequin at worst: ${most('keys')} rad on the keys, ${most('between')} between, hips ${most('hips')} of their height`);
  }
}

if (MAIN) await main();
