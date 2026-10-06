// Rigs the galaxy's soldiers with Meshy (meshy.ai, the site owner's
// account), so they walk, aim and fall instead of sliding about in the
// T-pose their models came in. The models are the Battlefront II remaster's
// (scripts/battlefront-import.mjs put them in public/models/galaxy/surface/,
// static); each goes to Meshy's rigger as a data: URI and comes back on the
// same 24-bone skeleton as every other Meshy figure on the site, so Rick's
// idle, walk and run play on it (rickmorty/portal/clips.js) and the guns are
// held and aimed the universe map's way (universe/gunplay.js). The combat
// clips (a flinch, three ways of going down, a kneel behind cover, a
// Wookiee's chest-pound) are made once, on the clone's rig, and played on
// everyone, as Rick's are.
//
//   node --env-file=$HOME/.tilakverse.env scripts/meshy-troopers.mjs <step> [name …]
//
// Steps, in order: bake (free: the site's model, decompressed, its maps
// JPEGs, into lab/meshy/troops/in/), rig (5 credits each), clips (3 each, on
// the clone's rig), fetch (free: rigged figures to public/models/galaxy/
// troops/<kind>.glb, clips to public/models/galaxy/troops/clip-<name>.glb),
// balance. Task ids are kept in scripts/meshy-troopers-tasks.json, so a step
// run again never pays twice. MESHY_API_KEY comes from the environment and
// is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, getBounds, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
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
const SRC = join(ROOT, 'public', 'models', 'galaxy', 'surface');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'troops');
const REVIEW = join(ROOT, 'lab', 'meshy', 'troops');
const TASKS = join(ROOT, 'scripts', 'meshy-troopers-tasks.json');
const API = 'https://api.meshy.ai/openapi';

// kind → height in metres (as the catalogue has it)
export const TROOPS = {
  clone: 1.83,
  battledroid: 1.91,
  superdroid: 1.93,
  stormtrooper: 1.83,
  snowtrooper: 1.83,
  hothtrooper: 1.78,
  sandtrooper: 1.83,
  scouttrooper: 1.83,
  shoretrooper: 1.83,
  deathtrooper: 1.83,
};
// the rig the clips are made on
const CLIP_RIG = 'clone';
// clip name → Meshy's animation library action (docs.meshy.ai/en/api/animation-library)
export const CLIPS = {
  hit: 177, // Gunshot_Reaction
  die: 183, // Shot_and_Fall_Backward
  dieFwd: 184, // Shot_and_Fall_Forward
  dieBlown: 182, // Shot_and_Blown_Back
  kneel: 165, // Kneeling_Reload
  taunt: 88, // Chest_Pound_Taunt
};
const TEX = 1024;

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

// For the web: textures WebP at TEX, geometry meshopt; a clip keeps only its
// skeleton and animation
async function squeeze(from, to, { clip = false } = {}) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  if (clip) {
    for (const node of root.listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const m of root.listMeshes()) m.dispose();
    for (const m of root.listMaterials()) m.dispose();
    for (const t of root.listTextures()) t.dispose();
  } else for (const a of root.listAnimations()) a.dispose();
  await doc.transform(dedup(), prune(), resample(), ...(clip ? [] : [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX] })]), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  return { hips: root.listNodes().some((n) => n.getName() === 'Hips'), clips: root.listAnimations().map((a) => a.getName()) };
}

const steps = {
  // the site's model as Meshy's rigger can read it: no meshopt, no
  // quantizing, its maps JPEGs; it already stands on y = 0 facing +z
  async bake(names) {
    const io = await getIO();
    for (const n of names) {
      const doc = await io.read(join(SRC, `${n}.glb`));
      await doc.transform(dequantize(), prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [TEX, TEX], quality: 92 }));
      for (const e of doc.getRoot().listExtensionsUsed()) if (/meshopt|quantization|webp/i.test(e.extensionName)) e.dispose();
      const plain = new NodeIO().registerExtensions(ALL_EXTENSIONS);
      const file = join(REVIEW, 'in', `${n}.glb`);
      await mkdir(dirname(file), { recursive: true });
      await plain.write(file, doc);
      const b = getBounds(doc.getRoot().listScenes()[0]);
      console.log(`bake     ${n.padEnd(13)} ${(b.max[1] - b.min[1]).toFixed(2)} m tall, ${((await stat(file)).size / 1e6).toFixed(2)} MB`);
    }
  },
  async rig(names, s) {
    for (const n of names) {
      s[n] ??= {};
      if (!s[n].rig) {
        const file = join(REVIEW, 'in', `${n}.glb`);
        if (!existsSync(file)) throw new Error(`${n}: bake it first`);
        const { balance } = await api('GET', '/v1/balance');
        if (balance < 5) throw new Error(`${n}: only ${balance} credits`);
        const model_url = `data:application/octet-stream;base64,${(await readFile(file)).toString('base64')}`;
        const { result } = await api('POST', '/v1/rigging', { model_url, height_meters: TROOPS[n] });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(13)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async clips(_names, s) {
    const rig = s[CLIP_RIG]?.rig;
    if (!rig) throw new Error(`rig ${CLIP_RIG} first`);
    s.clips ??= {};
    for (const [name, action] of Object.entries(CLIPS)) {
      if (!s.clips[name]) {
        const { result } = await api('POST', '/v1/animations', { rig_task_id: rig, action_id: action, post_process: { operation_type: 'extract_armature' } });
        s.clips[name] = result;
        await save(s);
      }
      const t = await wait('/v1/animations', s.clips[name], `clip ${name}`);
      console.log(`clip     ${name.padEnd(13)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async fetch(names, s) {
    const raw = join(REVIEW, 'raw');
    for (const n of names) {
      if (!s[n]?.rig) {
        console.error(`! ${n}: not rigged yet`);
        continue;
      }
      const r = (await api('GET', `/v1/rigging/${s[n].rig}`)).result;
      const file = join(raw, `${n}.glb`);
      if (!existsSync(file)) await download(r.rigged_character_glb_url, file);
      const got = await squeeze(file, join(OUT, `${n}.glb`));
      if (!got.hips) throw new Error(`${n}: no Hips bone`);
      console.log(`fetch    ${n.padEnd(13)} ${((await stat(join(OUT, `${n}.glb`))).size / 1e6).toFixed(2)} MB`);
    }
    for (const [name, id] of Object.entries(s.clips ?? {})) {
      const t = await api('GET', `/v1/animations/${id}`);
      const file = join(raw, `clip-${name}.glb`);
      if (!existsSync(file)) await download(t.result?.animation_glb_url ?? t.animation_glb_url, file);
      const got = await squeeze(file, join(OUT, `clip-${name}.glb`), { clip: true });
      console.log(`fetch    clip-${name.padEnd(8)} ${got.clips.join(', ')}`);
    }
  },
  async balance() {},
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in the environment.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(TROOPS);
  for (const n of names) if (!TROOPS[n]) throw new Error(`unknown kind ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
