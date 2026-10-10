// The game's own clips, packed for the site: Star Wars Battlefront II
// (2017)'s animations, one glTF per clip in the bf2017-assets bucket
// (web/anims/, listed in web/anims.jsonl), all on the one humanoid
// skeleton every 2017 person shares (Walrus_HumanMale), gathered into one
// GLB per pack under the site's own clip names: a generic humanoid pack
// everyone walks on, and one per hero with its strikes, blocks, staggers,
// dodges and its own walk. Packs, not per-figure bakes: the clips are the
// game's, made on the game's rig, so they play on any 2017 body by bone
// name as they are, with nothing retargeted (src/lib/three/walrus.js). The
// names are src/lib/three/walrusClips.js's map.
//
// Each clip is resampled to --fps (24: the site's animator steps a tenth of
// a second at most, and 24 holds a stroke's arc), its root motion taken off
// (the game moves the figure by AITrajectory, the node above the hips; the
// site moves it itself, so the clip plays in place) and kept instead as
// `root` ([[t, dx, dz]…], metres, +z ahead and +x to the figure's left,
// ual-bake.mjs's rootTravel) with `rootHips` (the hips' height over the
// toes it was measured at), and a stroke's `contact` ([t0, t1], the span the
// blade's tip, a metre out of the Wep_Root socket along the hilt's +y, moves
// fastest ahead of the body: ual-bake.mjs's contactWindow) put in the
// animation's extras, which the site reads as clip.userData. The channels of
// the game's camera and trajectory helpers go, and so does a bone's that
// holds the skeleton's rest all through (a third of each clip's: the loader
// puts rest back for any bone another clip of the pack moves, so none is
// left where the last clip put it); a bone held anywhere else is two keys.
// A clip's channels share its times. Then meshopt, with its animation
// quantisation.
//
//   node scripts/bf2017-clips.mjs <pack> [--fps 24] [--only <site name>,…]
//     [--out public/models/galaxy/bf2017] [--root lab/assets/bf2017] [--skeleton public/models/galaxy/bf2017/walrus.glb]
//
//   pack      a key of walrusClips.js's PACKS (humanoid, luke, vader, obiwan…)
//   only      just these site names (a test's, or a re-pack of a few)
//   root      where the fetch keeps the bucket (a clip not there is fetched,
//             with SUPABASE_URL and BF2017_KEY or SUPA_KEY in the environment)
//
// It prints each clip's site name, the game's, its frames and bytes, the
// pack's total, and every site name the game had nothing for (the loader
// plays walrusRig.js's CLIP_FALLBACK for those). It refuses a sequel-era pack.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { PACKS, candidates } from '../src/lib/three/walrusClips.js';
import { SOCKETS } from '../src/lib/three/walrusRig.js';
import { parseArgs } from './lib/args.mjs';
import { animEntry, animPath } from './lib/bf2017-anims.mjs';
import { isSequel, readManifest } from './lib/bf2017-manifest.mjs';
import { contactWindow, rootTravel } from './ual-bake.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// the game's helpers no site code reads: the trajectory the game moves the
// figure by (measured, then dropped), its cameras, its ground and aim targets
const DROP = /^(AITrajectory|Trajectory|TrajectoryEnd|CameraBase|CameraJoint|Camera3pDefPos_Rig|Camera3p_Rig|TrajChildDummy|TrajChildDummyCam|Wep_Aim_Target_Rig|Connect|ConnectEnd|Ground)$/;
const TRAJ = 'AITrajectory';
// the skeletons a pack takes clips from: the humanoid's, and the cinematics'
// (the same rig at the same rest, with a few more physics bones; it holds
// Luke's block swings, which the humanoid's set hasn't), never the first
// person's or another rig's
const SKELETONS = /\/(Walrus_HumanMale|Walrus_NIS_S0800_Skeleton)$/;
const BLADE = 1; // metres out of the socket the stroke's tip is timed at (ual-bake's: a blade's length)

async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// ── a channel at another rate ──

// a channel's values at `fps` from 0 to its end (the end itself always a
// key): linear for positions, slerp for turns, the last value held past
// the channel's end; a constant channel two keys
export function resampleChannel(times, values, size, fps, end) {
  // (up, so an end between two frames is still a key: rounded down, the last half frame went)
  const n = Math.max(1, Math.ceil(end * fps - 1e-6));
  const out = { times: [], values: [] };
  const constant = values.every((v, i) => Math.abs(v - values[i % size]) < 1e-6);
  const at = constant ? [0, end] : Array.from({ length: n + 1 }, (_, i) => Math.min(end, i / fps));
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  for (const t of at) {
    let k = 0;
    while (k < times.length - 2 && times[k + 1] < t) k++;
    const t0 = times[k];
    const t1 = times[Math.min(k + 1, times.length - 1)];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    const a = values.slice(k * size, k * size + size);
    const b = values.slice(Math.min(k + 1, times.length - 1) * size, Math.min(k + 1, times.length - 1) * size + size);
    out.times.push(t);
    if (size === 4) {
      qa.fromArray(a).slerp(qb.fromArray(b), f);
      out.values.push(qa.x, qa.y, qa.z, qa.w);
    } else out.values.push(...a.map((v, i) => v + (b[i] - v) * f));
  }
  return out;
}

// ── the skeleton, posed by a clip, in three.js (for measuring) ──

function skeletonScene(doc) {
  const objs = new Map();
  const make = (n) => {
    const o = new THREE.Object3D();
    o.name = n.getName();
    o.position.fromArray(n.getTranslation());
    o.quaternion.fromArray(n.getRotation());
    o.scale.fromArray(n.getScale());
    objs.set(o.name, o);
    for (const c of n.listChildren()) o.add(make(c));
    return o;
  };
  const scene = new THREE.Group();
  for (const n of doc.getRoot().listScenes()[0].listChildren()) scene.add(make(n));
  return { scene, objs };
}

const PATHS = { translation: 'position', rotation: 'quaternion', scale: 'scale' };
const SIZES = { translation: 3, rotation: 4, scale: 3 };

// rows through a clip (in place: its trajectory left out) of what the
// site measures: the hips, the toes, the blade's tip out of the socket
function measure(skel, channels, duration, fps) {
  const tracks = channels.map((c) => {
    const T = c.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new T(`${c.node}.${PATHS[c.path]}`, c.times, c.values);
  });
  const clip = new THREE.AnimationClip('m', duration, tracks);
  const { scene, objs } = skel;
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip).play();
  const rows = [];
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3();
  const hips = objs.get('Hips');
  const wep = objs.get(SOCKETS.weapon);
  for (let f = 0, n = Math.round(duration * fps); f <= n; f++) {
    action.time = Math.min(duration, f / fps);
    mixer.update(0);
    scene.updateMatrixWorld(true);
    const h = hips.getWorldPosition(new THREE.Vector3());
    // (the blade along the socket's +y: the game's hilts are modelled up it, the grip at its origin)
    const tip = wep.getWorldPosition(p).clone().add(up.set(0, 1, 0).applyQuaternion(wep.getWorldQuaternion(q)).multiplyScalar(BLADE));
    rows.push({ t: action.time, hand: tip.toArray(), ahead: tip.z > h.z + 0.15 });
  }
  action.stop();
  mixer.uncacheRoot(scene);
  return rows;
}

// the hips' height over the toes at rest (game metres)
function restHips(skel) {
  const { scene, objs } = skel;
  scene.updateMatrixWorld(true);
  const y = (n) => objs.get(n).getWorldPosition(new THREE.Vector3()).y;
  return +(y('Hips') - Math.min(y('LeftToeBase'), y('RightToeBase'))).toFixed(4);
}

// a channel that holds its node's rest all through (nothing to send)
const REST = { translation: (n) => n.getTranslation(), rotation: (n) => n.getRotation(), scale: (n) => n.getScale() };
export function atRest(node, path, values) {
  const rest = REST[path](node);
  const size = rest.length;
  for (let i = 0; i < values.length; i += size) {
    // (a turn and its negation are the same turn)
    const d = (sign) => Math.max(...rest.map((r, k) => Math.abs(values[i + k] - sign * r)));
    if (Math.min(d(1), size === 4 ? d(-1) : Infinity) > 1e-4) return false;
  }
  return true;
}

// ── one clip, read ──

// its channels by node name, the trajectory's kept apart
async function readClip(rw, file) {
  const doc = await rw.read(file);
  const [anim] = doc.getRoot().listAnimations();
  if (!anim) throw new Error(`${file}: no animation`);
  const channels = [];
  let traj = null;
  let end = 0;
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode()?.getName();
    const path = ch.getTargetPath();
    if (!node || !SIZES[path]) continue;
    const s = ch.getSampler();
    const times = Array.from(s.getInput().getArray());
    const values = Array.from(s.getOutput().getArray());
    end = Math.max(end, times[times.length - 1] ?? 0);
    const c = { node, path, times, values };
    if (node === TRAJ && path === 'translation') traj = c;
    if (!DROP.test(node)) channels.push(c);
  }
  return { name: anim.getName(), channels, traj, end, extras: anim.getExtras() };
}

// ── the pack ──

export async function makePack(pack, { fps = 24, only = null, out, root, skeleton, fetchClip = null, log = console.log } = {}) {
  if (isSequel(pack)) throw new Error(`${pack} is sequel-era; the site shows none of it`);
  const map = PACKS[pack];
  if (!map) throw new Error(`${pack}: no such pack (${Object.keys(PACKS).join(', ')})`);
  const rw = await io();
  const anims = readManifest(await readFile(join(root, 'web', 'anims.jsonl'), 'utf8'));
  const doc = await rw.read(skeleton);
  const skel = skeletonScene(doc);
  const rootHips = restHips(skel);
  const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const names = Object.keys(map).filter((n) => !only || only.includes(n));
  const made = [];
  const none = [];
  // (a game clip two site names share is packed once; the other is an alias,
  // in the scene's extras, which the loader reads)
  const aliases = {};
  const packed = new Map(); // game name → site name
  for (const site of names) {
    // the first spelling the game has, on disk or fetched
    let file = null;
    let game = null;
    for (const g of candidates(map, site)) {
      const e = animEntry(anims, g);
      if (!e || e.additive || isSequel(g) || !SKELETONS.test(e.skeleton ?? '')) continue;
      const f = join(root, animPath(e));
      if (!existsSync(f) && fetchClip) await fetchClip(e.name);
      if (existsSync(f)) {
        file = f;
        game = e.name;
        break;
      }
    }
    if (!file) {
      none.push(site);
      continue;
    }
    if (packed.has(game)) {
      aliases[site] = packed.get(game);
      continue;
    }
    packed.set(game, site);
    const clip = await readClip(rw, file);
    const end = clip.end;
    const anim = doc.createAnimation(site);
    let keys = 0;
    const kept = [];
    // (one input a key count: every channel is on the same grid, or two keys)
    const inputs = new Map();
    const inputOf = (times) => {
      if (!inputs.has(times.length)) inputs.set(times.length, doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer));
      return inputs.get(times.length);
    };
    for (const c of clip.channels) {
      const node = nodes.get(c.node);
      if (!node) continue;
      const r = resampleChannel(c.times, c.values, SIZES[c.path], fps, end);
      kept.push({ ...c, times: r.times, values: r.values });
      if (atRest(node, c.path, r.values)) continue;
      keys += r.times.length;
      const input = inputOf(r.times);
      const output = doc
        .createAccessor()
        .setType(SIZES[c.path] === 4 ? 'VEC4' : 'VEC3')
        .setArray(new Float32Array(r.values))
        .setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(c.path).setSampler(sampler));
    }
    const extras = { source: `Star Wars Battlefront II (2017): ${game}`, fps, loop: Boolean(clip.extras?.loop) };
    if (clip.traj) {
      const rows = clip.traj.times.map((t, i) => ({ t, at: clip.traj.values.slice(i * 3, i * 3 + 3) }));
      // (at the pack's rate: a row every 1/fps)
      const step = Math.max(1, Math.round(rows.length / Math.max(1, end * fps)));
      const travel = rootTravel(rows.filter((_, i) => i % step === 0 || i === rows.length - 1));
      if (travel.some(([, x, z]) => Math.hypot(x, z) > 0.01)) {
        extras.root = travel;
        extras.rootHips = rootHips;
      }
    }
    if (site.startsWith('sword.') && !site.endsWith('.rec')) extras.contact = contactWindow(measure(skel, kept, end, fps));
    anim.setExtras(extras);
    made.push({ site, game, frames: Math.round(end * fps) + 1, keys, duration: end });
  }
  doc.getRoot().listScenes()[0].setExtras({ pack, aliases });
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const file = join(out, `clips-${pack}.glb`);
  await mkdir(out, { recursive: true });
  await rw.write(file, doc);
  const bytes = (await stat(file)).size;
  for (const m of made) log(`${m.site.padEnd(22)} ${m.game.padEnd(50)} ${String(m.frames).padStart(4)} frames`);
  for (const [a, b] of Object.entries(aliases)) log(`${a.padEnd(22)} = ${b}`);
  log(`${relative(ROOT, file)}: ${made.length} clips at ${fps} fps, ${(bytes / 1024).toFixed(1)} KB`);
  if (none.length) log(`nothing in the game for: ${none.join(', ')} (the loader's fallback plays for these)`);
  return { file, bytes, made, none, aliases };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [pack] = args._;
  if (!pack) {
    console.error(`usage: node scripts/bf2017-clips.mjs <pack> [--fps 24] [--only a,b] (packs: ${Object.keys(PACKS).join(', ')})`);
    process.exit(1);
  }
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  // (the network only for a clip not on disk: the fetch's, keys from the environment)
  const fetchClip = async (name) => {
    const { anims } = await import('./bf2017-fetch.mjs');
    const manifest = readManifest(await readFile(join(root, 'web', 'anims.jsonl'), 'utf8'));
    await anims.fetch(null, root, manifest, name);
  };
  await makePack(pack, {
    fps: Number(args.fps ?? 24),
    only: typeof args.only === 'string' ? args.only.split(',') : null,
    out: resolve(args.out ?? join(ROOT, 'public', 'models', 'galaxy', 'bf2017')),
    root,
    skeleton: resolve(args.skeleton ?? join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'walrus.glb')),
    fetchClip,
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
