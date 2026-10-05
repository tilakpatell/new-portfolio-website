// Spider-Man's moves for the Avengers compound: motion-captured idle, walk,
// run and jump for the HD Spider-Man (public/models/marvel/spiderman.glb,
// which has no clips of its own and which Thwip! uses as it is), retargeted
// onto his Unreal skeleton by scripts/sketchfab-avengers.mjs's retarget().
//
// The clips come from two CC Attribution uploads by jerrylxia on Sketchfab,
// both Mixamo-rigged (see public/cc0/README.md and src/data/modelCredits.json):
// "Spider-Man 2 Advanced Suit 2.0 PS5" (its Idle, Walk and Jump) and
// "Spider-Man 2 Symbiote Suit (PS5)" (its Run, the lighter, more athletic of
// the two). Spider-Man's own bones are left as they are: only clips go out.
//
// Writes public/models/sketchfab/avengers/spiderman-moves.glb: the four
// clips and the skeleton nodes they animate, no mesh, no textures. Its node
// names are spiderman.glb's, which three.js's GLTFLoader keeps as they are
// (none has a space or any of [ ] . : /), so
//   new THREE.AnimationMixer(spidermanScene).clipAction(clip)
// plays them on the real model. They play in place, facing +z; the jump's
// flight is taken out (the game's physics does the rising and falling) and
// when its feet leave and meet the ground goes in the manifest, with how fast
// the walk and run cover the ground (from the stance foot's travel), under
// "spiderman" in public/models/sketchfab/avengers/manifest.json.
//
//   node scripts/sketchfab-spiderman-moves.mjs <folder> [--fetch]
//
// <folder> holds the two downloads as <uid>.glb; --fetch downloads any that
// are missing with the Sketchfab API token in SKETCHFAB_API_TOKEN.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Quaternion, Vector3 } from 'three';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bounds, credit, mapBones, parents, pos, retarget, worlds } from './sketchfab-avengers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = join(ROOT, 'public', 'models', 'marvel', 'spiderman.glb');
const OUT = join(ROOT, 'public', 'models', 'sketchfab', 'avengers');
const CREDITS = join(ROOT, 'src', 'data', 'modelCredits.json');
const H = 1.75; // the height the speeds are given for (m)

// the downloads, and which of their clips become which
const SOURCES = {
  advanced: { uid: '90907e9f6ad04e299239f306d22848f8', clips: { idle: 'Idle', walk: 'Walk', jump: 'Jump' }, as: 'Spider-Man’s idle, walk and jump' },
  symbiote: { uid: '0845c06a538746c8a8111b241575bd9d', clips: { run: 'Run' }, as: 'Spider-Man’s run' },
};
const ORDER = ['idle', 'walk', 'run', 'jump'];

async function fetchModel(uid, file) {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error(`no ${file}, and no SKETCHFAB_API_TOKEN to fetch it with`);
  const r = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, { headers: { Authorization: `Token ${token}` } });
  if (!r.ok) throw new Error(`Sketchfab: ${uid}: ${r.status} ${r.statusText}`);
  const { glb } = await r.json();
  const bin = await fetch(glb.url);
  if (!bin.ok) throw new Error(`Sketchfab: ${uid}: download ${bin.status}`);
  await writeFile(file, Buffer.from(await bin.arrayBuffer()));
}

// the clip's sampled times
const timesOf = (anim) => anim.listChannels()[0].getSampler().getInput().getArray();

// Where each foot is (world, metres at height H) through a clip on Spider-Man
function feet(doc, anim, scale) {
  const { map } = mapBones(doc);
  return Array.from(timesOf(anim), (t) => {
    const w = worlds(doc, anim, t);
    const at = (slot) => pos(w.get(map[slot])).multiplyScalar(scale);
    return { t, footL: at('footL'), footR: at('footR'), toeL: at('toeL'), toeR: at('toeR'), hips: at('hips') };
  });
}

// Ground speed of an in-place walk or run: while a foot is planted it slides
// back under the body at the speed the body would go forward.
function groundSpeed(track) {
  const v = [];
  for (const side of ['L', 'R']) {
    const y = track.map((f) => Math.min(f[`foot${side}`].y, f[`toe${side}`].y));
    const lo = Math.min(...y);
    for (let i = 1; i < track.length; i++) {
      if (y[i] > lo + 0.03 || y[i - 1] > lo + 0.03) continue;
      const dt = track[i].t - track[i - 1].t;
      v.push(-(track[i][`foot${side}`].z - track[i - 1][`foot${side}`].z) / dt);
    }
  }
  v.sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

async function main() {
  const [dir, ...flags] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node scripts/sketchfab-spiderman-moves.mjs <folder> [--fetch]');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await mkdir(dir, { recursive: true });

  const doc = await io.read(MODEL);
  const root = doc.getRoot();
  const { map } = mapBones(doc);
  const rest = worlds(doc, null, 0);
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));

  for (const [set, S] of Object.entries(SOURCES)) {
    const file = join(dir, `${S.uid}.glb`);
    if (!existsSync(file)) {
      if (!flags.includes('--fetch')) throw new Error(`no ${file} (run with --fetch to download it)`);
      console.log(`fetch    ${S.uid}`);
      await fetchModel(S.uid, file);
    }
    const src = await io.read(file);
    credits[`avengers-anim-spiderman-${set}`] = credit(src.getRoot().getAsset(), S.as, '/models/marvel/spiderman.glb');
    for (const [to, from] of Object.entries(S.clips)) {
      const clip = src.getRoot().listAnimations().find((a) => a.getName() === from);
      if (!clip) throw new Error(`${S.uid} has no clip ${from}`);
      const r = retarget(src, clip, doc, to, { inPlace: true, bind: true });
      console.log(`  ${to} <- ${set}:${from} (${r.slots} bones, ${r.frames} frames)`);
    }
  }
  const anims = new Map(root.listAnimations().map((a) => [a.getName(), a]));

  // metres at height H: his height as he stands, soles to crown (through his skin)
  const { lo, hi } = bounds(doc);
  const natural = hi.y - lo.y;
  const scale = H / natural;

  // the hips' height axis in their parent's frame, and how far a metre is there
  const par = parents(doc);
  const parentQ = new Quaternion();
  const parentS = new Vector3();
  rest.get(par.get(map.hips)).decompose(new Vector3(), parentQ, parentS);
  const upLocal = new Vector3(0, 1, 0).applyQuaternion(parentQ.clone().invert()).normalize();
  const hipsTrack = (anim) => anim.listChannels().find((c) => c.getTargetNode() === map.hips && c.getTargetPath() === 'translation').getSampler().getOutput();

  // stand each clip on y = 0: its lowest moment on the ground (a skinned vertex,
  // not a bone) touching it, as his soles do at rest. The jump's is taken
  // before it leaves the ground.
  for (const [name, anim] of anims) {
    const ts = timesOf(anim);
    let low = Infinity;
    for (let i = 0; i < ts.length; i += 2) {
      if (name === 'jump' && ts[i] > 0.5) break;
      low = Math.min(low, bounds(doc, anim, ts[i]).lo.y);
    }
    const lift = (lo.y - low) / parentS.y;
    const out = hipsTrack(anim);
    const arr = out.getArray().slice();
    for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) arr[i + k] += upLocal.getComponent(k) * lift;
    out.setArray(arr);
    console.log(`  ${name}: hips up ${((lo.y - low) * scale * 100).toFixed(1)} cm`);
  }

  // the jump: when the feet leave and meet the ground, then take the flight out
  // of the hips (they keep to a line between takeoff and landing), so the
  // figure stays on y = 0 and the game's physics lifts it
  const jump = anims.get('jump');
  const jt = feet(doc, jump, scale);
  const low = jt.map((f) => Math.min(f.toeL.y, f.toeR.y, f.footL.y, f.footR.y));
  const ground = low[0];
  const up = low.map((y) => y > ground + 0.04);
  const t0i = up.indexOf(true);
  const t1i = up.lastIndexOf(true) + 1;
  const takeoff = jt[t0i - 1].t;
  const land = jt[t1i].t;
  {
    const out = hipsTrack(jump);
    const arr = out.getArray().slice();
    const lift = (i) => new Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]).dot(upLocal);
    const a = t0i - 1;
    const b = t1i;
    const ha = lift(a);
    const hb = lift(b);
    for (let i = a + 1; i < b; i++) {
      const k = (i - a) / (b - a);
      const d = ha + (hb - ha) * k - lift(i);
      for (let c = 0; c < 3; c++) arr[i * 3 + c] += upLocal.getComponent(c) * d;
    }
    out.setArray(arr);
  }

  // how fast the walk and run cover the ground
  const speeds = {};
  if (process.env.DEBUG) for (const c of ['walk', 'run', 'idle']) for (const f of feet(doc, anims.get(c), scale)) console.log(c, f.t.toFixed(2), ['footL', 'toeL', 'footR', 'toeR', 'hips'].map((k) => f[k].toArray().map((v) => v.toFixed(3)).join(',')).join('  '));
  for (const c of ['walk', 'run']) speeds[c] = +groundSpeed(feet(doc, anims.get(c), scale)).toFixed(2);

  // only the clips and the bones they move (with the nodes above them) go out
  const keep = new Set();
  for (const a of root.listAnimations()) for (const ch of a.listChannels()) for (let n = ch.getTargetNode(); n; n = par.get(n)) keep.add(n);
  for (const n of root.listNodes()) {
    n.setMesh(null).setSkin(null);
    if (!keep.has(n)) n.dispose();
  }
  for (const p of [...root.listSkins(), ...root.listMeshes(), ...root.listMaterials(), ...root.listTextures(), ...root.listCameras()]) p.dispose();
  for (const a of root.listAccessors()) if (!a.listParents().some((p) => p.propertyType === 'AnimationSampler')) a.dispose();
  for (const e of root.listExtensionsUsed()) e.dispose();
  const asset = root.getAsset();
  asset.extras = {
    title: 'Spider-Man’s moves (idle, walk, run, jump)',
    note: 'Clips for /models/marvel/spiderman.glb. Motion from jerrylxia’s Spider-Man 2 Advanced Suit 2.0 PS5 and Spider-Man 2 Symbiote Suit (PS5) on Sketchfab, CC BY 4.0.',
  };
  root.setExtras({});

  // smaller: keys a straight line would give dropped, turns as 16-bit
  await doc.transform(resample({ tolerance: 1e-4 }));
  for (const a of root.listAnimations())
    for (const ch of a.listChannels()) {
      if (ch.getTargetPath() !== 'rotation') continue;
      const out = ch.getSampler().getOutput();
      if (out.getComponentType() !== 5126) continue;
      const q = out.getArray();
      const i16 = new Int16Array(q.length);
      for (let i = 0; i < q.length; i++) i16[i] = Math.round(Math.max(-1, Math.min(1, q[i])) * 32767);
      const packed = doc.createAccessor().setType('VEC4').setArray(i16).setNormalized(true).setBuffer(root.listBuffers()[0]);
      ch.getSampler().setOutput(packed);
      if (!out.listParents().some((p) => p.propertyType === 'AnimationSampler')) out.dispose();
    }

  const file = join(OUT, 'spiderman-moves.glb');
  await io.write(file, doc);
  const bytes = (await stat(file)).size;

  const manifestPath = join(OUT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const r3 = (v) => +v.toFixed(3);
  manifest.spiderman = {
    file: '/models/marvel/spiderman.glb',
    moves: '/models/sketchfab/avengers/spiderman-moves.glb',
    h: H,
    clips: ORDER.filter((c) => anims.has(c)),
    speeds,
    jump: { takeoff: r3(takeoff), land: r3(land), duration: r3(timesOf(jump).at(-1)) },
    bytes,
    credit: 'spiderman',
    moveCredits: Object.keys(SOURCES).map((s) => `avengers-anim-spiderman-${s}`),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(CREDITS, JSON.stringify(credits, null, 2) + '\n');
  console.log(`  ${natural.toFixed(3)} m as modelled; ${(bytes / 1024).toFixed(0)} KB`);
  console.log(JSON.stringify(manifest.spiderman));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
