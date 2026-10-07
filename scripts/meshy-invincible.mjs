// Makes the Invincible page's hero with Meshy (meshy.ai), the site owner's
// account: a concept image, then a textured model from the image, then
// Meshy's humanoid skeleton (which the game poses: flying, punching), then
// a new atlas (scripts/reatlas.mjs) and compression for the web into
// public/models/invincible/. The output is committed, so the site never
// calls Meshy. Omni-Man and Thragg were Sketchfab models (scripts/sketchfab-characters.mjs).
//
//   node --env-file=.env.local scripts/meshy-invincible.mjs <step> [name …]
//
// Steps, in order: images (3 credits each), models (15: meshy-6-lite with 2K
// textures), rig (5), fetch (free). Each task's id is kept in
// scripts/meshy-invincible-tasks.json, so running a step again never pays
// twice; delete a name's entry there to make it again. MESHY_API_KEY comes
// from .env.local (git ignores it); it is never printed.
//
// Meshy turns down named characters, so he is described, not named.
//
// A figure with a `ref` is made from the show's own character art instead of
// a generated concept image: `refs` downloads it from the Invincible wiki
// (amazon-invincible.fandom.com) into lab/meshy/invincible/ref/, which git
// ignores, so the studio's pictures are never committed; `models` sends it
// to Meshy's image-to-3D. Only the models Meshy makes from it are shipped.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'invincible');
const REVIEW = join(ROOT, 'lab', 'meshy', 'invincible'); // concept images and thumbnails, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-invincible-tasks.json');
const CREDITS = join(OUT, 'credits.json');
const API = 'https://api.meshy.ai/openapi';
const REFS = join(REVIEW, 'ref');
const WIKI = 'https://amazon-invincible.fandom.com/api.php';

// In the look of the Sketchfab figures beside him (Omni-Man and Thragg are
// game models: clean painted textures, believable proportions).
const PERSON = 'A high-detail 3D video game character in the look of a modern adult animated superhero series: believable athletic proportions, clean painted textures, crisp readable shapes. Full body, front view, standing straight in an A-pose with the arms held a little away from the body, feet slightly apart. Plain neutral grey background, no text, no logo, no shadow.';

export const ASSETS = {
  mark: {
    out: 'mark.glb',
    height: 1.78,
    tex: 2048,
    ref: 'Invincible_(Mark_Grayson).png',
    prompt:
      'A fit, athletic young man of about eighteen in a skin-tight superhero suit. A bright yellow cowl covers his head and the upper half of his face, with his short spiky black hair sticking up out of the top of it, and two large oval white goggle lenses over his eyes; his mouth and chin are bare. On his chest and stomach, a bright yellow panel shaped like a long downward-pointing shield, framed by a sky-blue yoke over both shoulders. The rest of the suit (arms, sides and legs) is very dark navy, almost black. Bright yellow gloves to the middle of the forearm, and sky-blue boots to just below the knee.',
  },
  omni: { out: 'omni-man.glb', height: 1.95, tex: 2048, ref: 'Omni-ManProfile.png' },
  thragg: { out: 'thragg.glb', height: 2.05, tex: 2048, ref: 'GrandRegentThragg-render.png' },
  eve: { out: 'eve.glb', height: 1.7, tex: 2048, ref: 'Atom-EveProfile.png' },
  cecil: { out: 'cecil.glb', height: 1.8, tex: 2048, ref: 'CecilProfile.png' },
  debbie: { out: 'debbie.glb', height: 1.68, tex: 2048, ref: 'DebbieProfile.png' },
  allen: { out: 'allen.glb', height: 2.3, tex: 2048, ref: 'Allen.png' },
  // the wiki's picture is the twins side by side: the left half is one
  mauler: { out: 'mauler.glb', height: 2.6, tex: 2048, ref: 'MaulerTwin-render.png', crop: 'left' },
  seismic: { out: 'seismic.glb', height: 1.8, tex: 2048, ref: 'DocSeismic-render.png' },
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

let io = null;
let sharp = null;
// The skinned figure on its skeleton, without the clip it was rigged with
// (the game poses him), on a new atlas the size of the texture he ships with.
async function bake(from, to, a) {
  // loaded here, so the paid steps run without the build's dependencies
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { dedup, meshopt, prune, textureCompress } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  const { reatlas } = await import('./reatlas.mjs');
  sharp ??= (await import('sharp')).default;
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  for (const clip of doc.getRoot().listAnimations()) {
    for (const part of [...clip.listChannels(), ...clip.listSamplers()]) part.dispose();
    clip.dispose();
  }
  await reatlas(doc, a.tex, { apart: true });
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [a.tex, a.tex] }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  const prims = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives());
  return { tris: prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0) };
}

const steps = {
  // the show's art from the wiki, scaled to at most 1,536 px tall (needs sharp)
  async refs(names) {
    sharp ??= (await import('sharp')).default;
    for (const n of names) {
      const a = ASSETS[n];
      if (!a.ref) continue;
      const q = await (await fetch(`${WIKI}?action=query&format=json&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(a.ref)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
      const url = Object.values(q.query.pages)[0].imageinfo[0].url;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`${n}: ${r.status}`);
      let img = sharp(Buffer.from(await r.arrayBuffer()));
      const { width, height } = await img.metadata();
      if (a.crop === 'left') img = sharp(await img.extract({ left: 0, top: 0, width: Math.floor(width / 2), height }).png().toBuffer());
      await mkdir(REFS, { recursive: true });
      await img.resize({ height: 1536, withoutEnlargement: true }).png().toFile(join(REFS, `${n}.png`));
      console.log(`ref      ${n.padEnd(8)} ${a.ref}`);
    }
  },
  async images(names, s) {
    for (const n of names) {
      if (ASSETS[n].ref) continue;
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana', prompt: `${ASSETS[n].prompt} ${PERSON}`, pose_mode: 'a-pose', aspect_ratio: '3:4' });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async models(names, s) {
    for (const n of names) {
      const ref = ASSETS[n].ref && join(REFS, `${n}.png`);
      if (ref && !existsSync(ref)) throw new Error(`${n}: run refs first`);
      if (!ref && !s[n]?.image) throw new Error(`${n}: no image yet`);
      s[n] ??= {};
      if (!s[n].model) {
        const from = ref ? { image_url: `data:image/png;base64,${(await readFile(ref)).toString('base64')}` } : { input_task_id: s[n].image };
        const { result } = await api('POST', '/v1/image-to-3d', {
          ...from,
          ai_model: 'meshy-6-lite',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: 16000,
          texture_resolution: '2k',
          pose_mode: 'a-pose',
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) if (url) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async rig(names, s) {
    for (const n of names) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(8)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async fetch(names, s) {
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    const credits = existsSync(CREDITS) ? JSON.parse(await readFile(CREDITS, 'utf8')) : {};
    for (const n of names) {
      const a = ASSETS[n];
      if (!s[n]?.rig) throw new Error(`${n}: not rigged yet`);
      const raw = join(tmp, `${s[n].rig}-${n}.glb`);
      if (!existsSync(raw)) await download((await api('GET', `/v1/rigging/${s[n].rig}`)).result.rigged_character_glb_url, raw);
      const { tris } = await bake(raw, join(OUT, a.out), a);
      credits[n] = { source: 'https://www.meshy.ai', id: s[n].model, name: 'Invincible, generated for this site with Meshy AI', authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(8)} ${a.out}, ${tris} triangles`);
    }
    await mkdir(OUT, { recursive: true });
    await writeFile(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ASSETS);
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
