// Makes the crews for the cockpits the site opens in (src/components/cockpit)
// with Meshy (meshy.ai), the site owner's account. Chewbacca is new: a
// concept image, a textured model from it, Meshy's humanoid skeleton and its
// seated clip, for the Falcon's co-pilot's seat. Walt and Jesse are the
// people already modelled for Albuquerque (scripts/meshy-albuquerque.mjs):
// only their clips are new (sat in the RV's seat, stood behind it), made on
// the skeletons Meshy gave them then. Rick and Morty in the cruiser are
// Portal panic's (scripts/meshy.mjs), as they are. Everything is compressed
// for the web into public/models/cockpit/. The output is committed, so the
// site never calls Meshy.
//
//   node --env-file=.env.local scripts/meshy-cockpit.mjs <step> [name … | hd]
//
// `hd`: Walt and Jesse as scripts/meshy-albuquerque.mjs's hd set made them
// again (about 40,000 faces, 2k textures), with their clips made again on
// their new skeletons, over the originals.
//
// Steps, in order: images (9 credits each), models (30), rig (5), clips (3
// a clip), fetch (free). Each task's id is kept in
// scripts/meshy-cockpit-tasks.json, so running a step again never pays twice;
// delete a name's entry there to make it again. MESHY_API_KEY comes from
// .env.local (git ignores it); it is never printed. Concept images and
// thumbnails go to lab/meshy/cockpit (or MESHY_REVIEW), for looking at, not
// shipped.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'cockpit');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'cockpit');
const TASKS = join(ROOT, 'scripts', 'meshy-cockpit-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const PERSON =
  'A stylized 3D animated feature film character, soft and appealing, clean readable shapes, painted fur. Full body, front view, standing straight in an A-pose with the arms held a little away from the body, feet slightly apart. Plain neutral grey background, no text, no shadow.';

// Meshy's animation library: 0 is a standing idle, 33 sitting in a chair
const IDLE = 0;
const SIT = 33;

// height: metres, for the rig; poly: target triangles; tex: texture size on
// the site. `rig` names a skeleton Meshy has already made (the Albuquerque
// people's), so only the clips are new; `clips` are the ones to make.
export const ASSETS = {
  chewie: {
    height: 2.28,
    poly: 16000,
    tex: 1024,
    clips: { sit: SIT },
    // Described by how he looks, not by name, in a softer animated look:
    // the image step turns names down, and the model step turned down a
    // concept that looked too much like the films' own
    prompt:
      'A towering furry alien starship engineer, shaggy honey-brown and dark brown fur, a long face with a short snout and gentle eyes, broad shoulders, long arms, wearing a dark leather bandolier with small silver pockets across his chest and a utility belt.',
  },
  walt: { rig: '01a1086f-05b2-7469-8c15-7c8205721b17', model: '01a1086c-b335-723a-a090-6bd52a6ee0d0', tex: 1024, clips: { idle: IDLE, sit: SIT } },
  jesse: { rig: '01a1087a-bd22-721a-a542-46f4ec4492ca', model: '01a10877-c1cb-76a4-b8f7-13bf6710e8bf', tex: 1024, clips: { sit: SIT } },
};

// The HD set: Walt and Jesse as scripts/meshy-albuquerque.mjs's waltHd and
// jesseHd (their skeletons, made on the new models), written over the
// originals (`as`) with their clips made again on those skeletons, as a
// clip carries its own skeleton's bone lengths. Meshy paints them at 4k;
// they ship at 2k (the loader halves it on a phone, and again on a weak
// device).
const HD = {
  waltHd: { rig: '01a111fb-1207-74b6-90e7-1aa608e01f9f', model: '01a111f8-ed5f-73f6-b299-8c48642a2ee5', tex: 2048, clips: { idle: IDLE, sit: SIT }, as: 'walt' },
  jesseHd: { rig: '01a111c5-2005-748f-99f4-20609ad13592', model: '01a111c2-56a7-745d-9693-630a4602dbef', tex: 2048, clips: { sit: SIT }, as: 'jesse' },
};
// Jesse in his hoodie made again (scripts/meshy-albuquerque.mjs's
// jessePinkHd: his first HD face was a cartoon grin), sitting on a clip made
// on his new skeleton; made by name, not with `hd`
const JESSE_AGAIN = {
  jessePinkHd: { rig: '01a1127a-169f-77fd-a431-57b33cf5170f', model: '01a11277-c6b9-71f1-875f-b6341b360483', tex: 2048, clips: { sit: SIT }, as: 'jesse' },
};
Object.assign(ASSETS, HD, JESSE_AGAIN);

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// wait for a task to finish; returns the task
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
// the skeleton a name's clips go on: its own, or the one Meshy made before
const rigOf = (n, s) => ASSETS[n].rig ?? s[n]?.rig;

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed.
// A clip keeps only its skeleton and animation.
let io = null;
async function squeeze(from, to, { tex = 0, clip = false } = {}) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
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
  }
  await doc.transform(dedup(), prune(), resample(), ...(tex ? [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] })] : []), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
}

const fresh = (names) => names.filter((n) => !ASSETS[n].rig);

const steps = {
  async images(names, s) {
    for (const n of fresh(names)) {
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${ASSETS[n].prompt} ${PERSON}`, pose_mode: 'a-pose' });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(8)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    for (const n of fresh(names)) {
      if (!s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: ASSETS[n].ai ?? 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: ASSETS[n].poly,
          texture_resolution: '2k',
          pose_mode: 'a-pose',
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(8)} ${t.consumed_credits} credits`);
    }
  },
  async rig(names, s) {
    for (const n of fresh(names)) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(8)} ${t.consumed_credits} credits`);
    }
  },
  async clips(names, s) {
    for (const n of names) {
      const rig = rigOf(n, s);
      if (!rig) throw new Error(`${n}: not rigged yet`);
      s[n] ??= {};
      for (const [clip, action] of Object.entries(ASSETS[n].clips)) {
        if (!s[n][clip]) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: rig, action_id: action, post_process: { operation_type: 'extract_armature' } });
          s[n][clip] = result;
          await save(s);
        }
        const t = await wait('/v1/animations', s[n][clip], `${n} ${clip}`);
        console.log(`clip     ${`${n}-${clip}`.padEnd(12)} ${t.consumed_credits} credits`);
      }
    }
  },
  async fetch(names, s) {
    const tmp = join(REVIEW, 'raw');
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    for (const n of names) {
      const a = ASSETS[n];
      const rig = rigOf(n, s);
      if (!rig) throw new Error(`${n}: not rigged yet`);
      const r = (await api('GET', `/v1/rigging/${rig}`)).result;
      const as = a.as ?? n; // (the name it's written as)
      const files = [[r.rigged_character_glb_url, `${as}.glb`, a.tex, false]];
      for (const clip of Object.keys(a.clips)) {
        if (!s[n]?.[clip]) throw new Error(`${n}: no ${clip} clip yet`);
        files.push([(await api('GET', `/v1/animations/${s[n][clip]}`)).result.animation_glb_url, `${as}-${clip}.glb`, 0, true]);
      }
      for (const [url, file, tex, clip] of files) {
        const raw = join(tmp, file);
        await download(url, raw);
        await squeeze(raw, join(OUT, file), { tex, clip });
      }
      credits[`cockpit/${as}`] = { source: 'https://www.meshy.ai', id: a.model ?? s[n].model, name: `${as}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(8)} ${files.map((f) => f[1]).join(', ')}`);
    }
    await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    await rm(tmp, { recursive: true, force: true });
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  // (`hd` stands for the HD set)
  const names = only.length ? only.flatMap((n) => (n === 'hd' ? Object.keys(HD) : [n])) : Object.keys(ASSETS);
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
