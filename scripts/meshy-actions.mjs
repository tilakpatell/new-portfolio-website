// The clips every figure on the site can play that neither Meshy's thirteen
// shared ones nor Quaternius's library (scripts/ual-bake.mjs) give: walking
// backward and sideways, crouching to the side, talking in a dozen ways, a
// phone call, a shrug, looking round while searching, sitting down to drink
// or clap or doze, sleeping, picking things up, blocks and dodges and kicks,
// press-ups for the Avengers' gym, a few dances. Made with Meshy's animation
// library (docs.meshy.ai/en/api/animation-library) once, on one rig, Luke's
// figure rigged afresh (Quaternius's clips are baked onto Luke too), and
// played on every Meshy figure through lib/three/clipLibrary.js, which
// scales the hips to each (the troopers' and Rick's clips go the same way).
// (docs/superpowers/specs/2026-10-07-living-characters-design.md)
//
//   MESHY_API_KEY=<the account's key> node --env-file=.env.local scripts/meshy-actions.mjs <step> [clip …]
//
// Steps, in order: bake (free: Luke's figure without its skin, its maps
// JPEGs, into lab/meshy/actions/in/), rig (5 credits), clips (3 credits
// each), fetch (free: each clip's skeleton and motion to
// public/games/meshy/act-<name>.glb), balance. Task ids are kept in
// scripts/meshy-actions-tasks.json, so a step run again never pays twice;
// a task can only be read by the account that made it, so run every step
// with the same key. MESHY_API_KEY comes from the environment (an exported
// one wins over .env.local's) and is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// (glTF-Transform's own sharp: two libvips in one process break textures on Windows)
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIGURE = join(ROOT, 'public', 'models', 'galaxy', 'crew', 'luke.glb');
const HEIGHT = 1.72; // metres
const OUT = join(ROOT, 'public', 'games', 'meshy');
const REVIEW = join(ROOT, 'lab', 'meshy', 'actions');
const TASKS = join(ROOT, 'scripts', 'meshy-actions-tasks.json');
const API = 'https://api.meshy.ai/openapi';
const TEX = 1024;
const WINDOW = 8; // clips in Meshy's queue at once

// clip name (as lib/three/clipLibrary.js names it) → Meshy's action
export const ACTIONS = {
  // going other ways than straight ahead
  'walk.back': 544, // Walk_Backward
  'walk.back.gun': 529, // Walk_Backward_with_Gun
  'walk.left.gun': 528, // Walk_Left_with_Gun
  'walk.fight': 21, // Walk_Fight_Forward
  'walk.fight.back': 20, // Walk_Fight_Back
  'run.left': 9, // ForwardLeft_Run_Fight
  'run.right': 10, // ForwardRight_Run_Fight
  'run.back.left': 5, // BackLeft_run
  'run.back.right': 6, // BackRight_Run
  'crouch.back': 523, // Cautious_Crouch_Walk_Backward
  'crouch.left': 525, // Cautious_Crouch_Walk_Left
  'crouch.right': 526, // Cautious_Crouch_Walk_Right
  'turn.left': 576, // Idle_Turn_Left
  'turn.right': 586, // Idle_Turn_Right
  // walking some way of one's own
  'walk.sneak': 559, // Sneaky_Walk
  'walk.injured': 111, // Injured_Walk
  'walk.limp': 558, // Limping_Walk
  'walk.phone': 124, // Walking_with_Phone
  'walk.text': 122, // Texting_Walk
  'walk.talk': 37, // Discuss_While_Moving
  'walk.search': 341, // Walk_Slowly_and_Look_Around
  'walk.scan': 339, // Walking_Scan_with_Sudden_Look_Back
  'walk.carry': 551, // Carry_Heavy_Object_Walk
  'walk.casual': 30, // Casual_Walk
  'walk.proud': 114, // Proud_Strut
  'walk.shoot': 234, // Walk_Forward_While_Shooting
  'walk.back.shoot': 233, // Walk_Backward_While_Shooting
  'run.shoot': 98, // Run_and_Shoot
  charge: 511, // Rifle_Charge
  // talking, and listening
  'talk.passion': 308, // Talk_Passionately
  'talk.open': 313, // Talk_with_Hands_Open
  'talk.hip': 309, // Talk_with_Left_Hand_on_Hip
  'talk.raised': 310, // Talk_with_Left_Hand_Raised
  'talk.right': 314, // Talk_with_Right_Hand_Open
  'talk.angry': 311, // Stand_Talking_Angry
  chat: 56, // Stand_and_Chat
  listen: 47, // Listening_Gesture
  agree: 25, // Agree_Gesture
  phone: 312, // Phone_Conversation
  call: 50, // Phone_Call_Gesture
  beckon: 29, // Call_Gesture
  shrug: 317, // Shrug
  bow: 41, // Formal_Bow
  'bow.gent': 42, // Gentlemans_Bow
  shout: 51, // Shouting_Angrily
  stomp: 26, // Angry_Stomp
  confused: 36, // Confused_Scratch
  scheme: 318, // Scheming_Hand_Rub
  headache: 316, // Headache_Relief
  hip: 315, // Hand_on_Hip_Gesture
  nope: 409, // Finger_Wag_No
  sway: 415, // Happy_Sway_Standing
  // looking about
  'look.around': 336, // Long_Breathe_and_Look_Around
  'look.short': 338, // Short_Breathe_and_Look_Around
  'look.dumb': 333, // Look_Around_Dumbfounded
  alert: 2, // Alert
  // glad
  'cheer.up': 298, // Cheer_with_Both_Hands_Up
  'cheer.one': 306, // Cheer_with_One_Hand_Up
  victory: 59, // Victory_Cheer
  'fist.pump': 403, // Victory_Fist_Pump
  'jump.happy': 61, // happy_jump_m
  'wave.one': 290, // Wave_One_Hand
  'wave.help': 291, // Wave_for_Help
  // sitting
  'sit.down': 57, // Stand_to_Sit_Transition_M
  'sit.up': 53, // Sit_to_Stand_Transition_M
  'sit.drink': 343, // Sit_and_Drink
  'sit.clap': 354, // Sitting_Clap
  'sit.cheer': 304, // Seated_Fist_Pump
  'sit.answer': 307, // Sitting_Answering_Questions
  'sit.doze': 268, // Sit_and_Doze_Off
  'sit.thumbs': 357, // Sit_Thumbs_Up_Right
  'sit.nope': 355, // Sit_Finger_Wag_No
  'sit.lean': 356, // Sit_Hands_on_Head_Lean_Back
  'sit.floor': 363, // Sit_Cross_Legged_on_Floor
  // asleep, and lying down
  sleep: 267, // Sleep_Normally
  'sleep.desk': 263, // Sleep_on_Desk
  lie: 266, // Lie_Down_Hands_Spread
  wake: 271, // Wake_Up_and_Look_Up
  // hands busy
  'pickup.bend': 276, // Male_Bend_Over_Pick_Up
  collect: 284, // Collect_Object
  door: 285, // open_door
  'push.walk': 261, // Push_and_Walk_Forward
  // fighting
  stance: 89, // Combat_Stance
  block: 138, // Block1
  parry: 147, // Sword_Parry
  dodge: 156, // Stand_Dodge
  'dodge.roll': 158, // Roll_Dodge
  kick: 103, // Simple_Kick
  'kick.round': 207, // Roundhouse_Kick
  uppercut: 194, // Right_Uppercut_from_Guard
  'jab.guard': 191, // Left_Jab_from_Guard
  boxing: 87, // Boxing_Practice
  'reload.stand': 170, // Standing_Reload
  'draw.shoot': 236, // Draw_and_Shoot_Left
  'roll.cover': 426, // Roll_Behind_Cover
  'hit.face': 174, // Face_Punch_Reaction
  'hit.waist': 171, // Hit_Reaction_to_Waist
  electrocuted: 172, // Electrocution_Reaction
  knockdown: 187, // Knock_Down
  'die.slow': 185, // Shot_and_Slow_Fall_Backward
  'die.back.shot': 180, // Shot_in_the_Back_and_Fall
  'die.gut': 188, // Fall_Dead_from_Abdominal_Injury
  arise: 3, // Arise
  'stand.up': 344, // Stand_Up1
  // the gym
  pushup: 329, // push_up
  situps: 330, // situps
  jacks: 326, // jumping_jacks
  curl: 320, // bicep_curl
  squat: 319, // air_squat
  // dancing
  'dance.funny': 22, // FunnyDancing_01
  'dance.gangnam': 74, // Gangnam_Groove
  'dance.joy': 405, // Joyful_Dance_with_Hand_Sway
  'dance.hiphop': 561, // Step_Hip_Hop_Dance
};

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function wait(path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api('GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
    if (i % 6 === 0) console.log(`  ${label}: ${t.status} ${t.progress ?? 0}%`);
    await sleep(5000);
  }
}
async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}
const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);

let io = null;
async function getIO() {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

// a clip as the site plays it: its skeleton and motion, nothing to draw
async function squeezeClip(from, to) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(dedup(), prune(), resample());
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  return { hips: root.listNodes().some((n) => n.getName() === 'Hips'), clips: root.listAnimations().map((a) => a.getName()) };
}

const steps = {
  // Luke as Meshy's rigger can read him: the skin and the clips taken off
  // (he stands in his bind pose), no meshopt or quantizing, his maps JPEGs
  async bake() {
    const io = await getIO();
    const doc = await io.read(FIGURE);
    const root = doc.getRoot();
    for (const node of root.listNodes()) node.setSkin(null);
    for (const a of root.listAnimations()) a.dispose();
    for (const s of root.listSkins()) s.dispose();
    await doc.transform(dequantize(), prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [TEX, TEX], quality: 92 }));
    for (const e of root.listExtensionsUsed()) if (/meshopt|quantization|webp/i.test(e.extensionName)) e.dispose();
    const file = join(REVIEW, 'in', 'luke.glb');
    await mkdir(dirname(file), { recursive: true });
    await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(file, doc);
    console.log(`bake     luke ${((await stat(file)).size / 1e6).toFixed(2)} MB`);
  },
  async rig(_names, s) {
    if (!s.rig) {
      const file = join(REVIEW, 'in', 'luke.glb');
      if (!existsSync(file)) throw new Error('bake first');
      const { balance } = await api('GET', '/v1/balance');
      if (balance < 5) throw new Error(`only ${balance} credits`);
      const model_url = `data:application/octet-stream;base64,${(await readFile(file)).toString('base64')}`;
      const { result } = await api('POST', '/v1/rigging', { model_url, height_meters: HEIGHT });
      s.rig = result;
      await save(s);
    }
    const t = await wait('/v1/rigging', s.rig, 'luke rig');
    console.log(`rig      luke ${t.consumed_credits ?? '?'} credits`);
  },
  // a few clips in Meshy's queue at a time (a plan only holds so many
  // pending tasks: past that it answers 429 NoMorePendingTasks), each one
  // that finishes making room for the next
  async clips(names, s) {
    if (!s.rig) throw new Error('rig first');
    s.clips ??= {};
    const todo = names.filter((n) => !s.clips[n]);
    const { balance } = await api('GET', '/v1/balance');
    if (todo.length * 3 > balance) throw new Error(`${todo.length} clips need ${todo.length * 3} credits; ${balance} left`);
    const flying = new Set(names.filter((n) => s.clips[n]));
    let failed = 0;
    while (todo.length || flying.size) {
      // fill the queue till Meshy says it's full
      while (todo.length && flying.size < WINDOW) {
        const n = todo[0];
        try {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: s.rig, action_id: ACTIONS[n], post_process: { operation_type: 'extract_armature' } });
          s.clips[n] = result;
          await save(s);
          todo.shift();
          flying.add(n);
        } catch (e) {
          if (!/429/.test(e.message)) throw e;
          break; // (full: wait for one to finish)
        }
      }
      await sleep(5000);
      for (const n of [...flying]) {
        const t = await api('GET', `/v1/animations/${s.clips[n]}`);
        if (t.status === 'SUCCEEDED') {
          flying.delete(n);
          console.log(`clip     ${n.padEnd(16)} ${t.consumed_credits ?? '?'} credits`);
        } else if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') {
          flying.delete(n);
          failed += 1;
          console.error(`! ${n}: ${t.status} ${t.task_error?.message ?? ''}`);
        }
      }
    }
    if (failed) throw new Error(`${failed} clips failed (drop their ids from the tasks file to ask again)`);
  },
  async fetch(names, s) {
    const raw = join(REVIEW, 'raw');
    for (const n of names) {
      const id = s.clips?.[n];
      if (!id) {
        console.error(`! ${n}: not made yet`);
        continue;
      }
      const t = await api('GET', `/v1/animations/${id}`);
      if (t.status !== 'SUCCEEDED') {
        console.error(`! ${n}: ${t.status}`);
        continue;
      }
      const file = join(raw, `${n}.glb`);
      if (!existsSync(file)) await download(t.result?.animation_glb_url ?? t.animation_glb_url, file);
      const to = join(OUT, `act-${n}.glb`);
      const got = await squeezeClip(file, to);
      if (!got.hips) throw new Error(`${n}: no Hips bone`);
      console.log(`fetch    act-${n.padEnd(16)} ${((await stat(to)).size / 1e3).toFixed(1)} KB  ${got.clips.join(', ')}`);
    }
  },
  async balance() {},
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in the environment.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ACTIONS);
  for (const n of names) if (!(n in ACTIONS)) throw new Error(`unknown clip ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
