// Gives Walt and Jesse's RV its wings, with Meshy (meshy.ai), the site
// owner's account. The RV is Albuquerque's (scripts/meshy-albuquerque.mjs):
// its concept image is edited (Meshy's image to image) into the same RV with
// a pair of home-made aeroplane wings bolted on, and a textured model is made
// from that, for the universe map's ship and the cockpit's last look at it;
// then one wing on its own, from the winged RV's picture, so the cockpit can
// swing a pair of them out of the RV's sides. Everything is compressed for
// the web into public/models/. The output is committed, so the site never
// calls Meshy.
//
//   node --env-file=.env.local scripts/meshy-rv.mjs <step> [name … | hd]
//
// `hd`: the winged RV painted again (Meshy's retexture), on the same mesh and
// its own UVs, from its own picture, at 4k brought down to 2k, over the
// original. The mesh stays as it is because the code that flies it has
// measured it: where the jets and the wingtips' lights are, raw
// (cockpit/vehicles/rv.js FLYER, universe/shipModels.js POD), which a model
// made again would move.
//
// Steps, in order: images (9 credits each, 12 with gpt-image-2), models
// (30), retexture (10), fetch (free). Each task's id is kept in scripts/meshy-rv-tasks.json,
// so running a step again never pays twice; delete a name's entry there to
// make it again. MESHY_API_KEY comes from .env.local (git ignores it); it is
// never printed. Concept images and thumbnails go to lab/meshy/rv (or
// MESHY_REVIEW), for looking at, not shipped. fetch prints each model's
// size, for the code that places it.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'rv');
const TASKS = join(ROOT, 'scripts', 'meshy-rv-tasks.json');
const API = 'https://api.meshy.ai/openapi';

// the RV's own concept image, made for Albuquerque (meshy-albuquerque-tasks.json)
const RV_IMAGE = '01a108fd-7974-77d1-8eb7-1dc85f895a60';

const KEEP = 'Keep the same stylized 3D game asset look of a modern animated feature film, softly painted textures and clean readable shapes, the same plain neutral grey background, no text, no logos, no people.';
const WINGS =
  'a pair of long, straight, home-made aeroplane wings, one bolted to each side of the body at floor height and spanning about one and a half times the RV’s length from tip to tip; the wings are riveted sheet aluminium, painted the same off-white with the same faded brown and orange stripes, with a small grey jet engine pod hanging under each wing, scuffed and a little dented, a red light at the left wing’s tip and a green light at the right’s';

// from: the image task the picture is edited from (an id, or another name
// here); ai: the image model, if not nano-banana-pro; out: under
// public/models (a name without one is only a picture, for another to be
// edited from); poly: target triangles; tex: texture size on the site
export const ASSETS = {
  rv: {
    from: RV_IMAGE,
    out: 'universe/rv-wings.glb',
    poly: 14000,
    tex: 1024,
    prompt: `The same old 1980s motorhome camper, exactly as it is (the same body, paint, stripes, windows, side door, ladder and dusty tyres), now with ${WINGS}. The whole RV and both wingtips in view, three-quarter front view from slightly above, centred. ${KEEP}`,
  },
  // asked for one wing, this came back with three (the edit keeps the
  // picture's layout); the wing below is the one wanted, cut out of it
  wingDraft: {
    from: 'rv',
    prompt: `Only the left wing from this picture, taken off the RV and on its own: the whole wing from its flat root plate to its tip, with its jet engine pod underneath and the red light at its tip, seen from above and a little in front, lying level, centred, filling the picture. ${KEEP}`,
  },
  wing: {
    from: 'wingDraft',
    ai: 'gpt-image-2', // follows an edit's instructions more closely
    out: 'cockpit/rv-wing.glb',
    poly: 5000,
    tex: 1024,
    prompt: `Remove the two wings at the top of the picture and keep only the wing at the bottom left, the one with the jet engine pod under it and the red light at its tip, exactly as it is. Move it to the centre and make it bigger so the whole wing, root to tip, fills the picture. One single wing and nothing else. ${KEEP}`,
  },
};

// The HD set: `retexture` names the model painted again (its mesh and UVs
// kept, its own picture to paint from), written over its `out`. (The wing
// was painted again too, and came out only a little sharper, its rivets
// and stripes much as they were, for twice the bytes in the cockpit the
// site opens in: the original stays. Its task is in the tasks file as
// wingHd, free to fetch: { retexture: 'wing', out: 'cockpit/rv-wing.glb',
// tex: 2048, what: 'the RV’s wing' }.)
const HD = {
  rvHd: { retexture: 'rv', out: 'universe/rv-wings.glb', tex: 2048, what: 'the RV with wings' },
};
Object.assign(ASSETS, HD);

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

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed.
let io = null;
async function squeeze(from, to, tex) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  // its size, for placing it
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const v = [0, 0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        for (let k = 0; k < 3; k++) {
          const w = m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k];
          lo[k] = Math.min(lo[k], w);
          hi[k] = Math.max(hi[k], w);
        }
      }
    }
  }
  return lo.map((l, k) => [+l.toFixed(3), +hi[k].toFixed(3)]);
}

const steps = {
  async images(names, s) {
    for (const n of names.filter((n) => !ASSETS[n].retexture)) {
      const a = ASSETS[n];
      // another name's picture (kept in the tasks file), or an image task's id
      const from = s[a.from]?.image ?? (/^[0-9a-f-]{36}$/.test(a.from) ? a.from : null);
      if (!from) throw new Error(`${n}: make ${a.from}'s image first`);
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/image-to-image', { ai_model: a.ai ?? 'nano-banana-pro', prompt: a.prompt, input_task_id: from });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(6)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    for (const n of names.filter((n) => ASSETS[n].out && !ASSETS[n].retexture)) {
      if (!s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: ASSETS[n].poly,
          texture_resolution: '2k',
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(6)} ${t.consumed_credits} credits`);
    }
  },
  // painted again from its own picture (sent as data, as the picture's link
  // may have expired), the UVs it has kept
  async retexture(names, s) {
    for (const n of names.filter((n) => ASSETS[n].retexture)) {
      const of = ASSETS[n].retexture;
      if (!s[of]?.model || !s[of]?.image) throw new Error(`${n}: ${of} has no model yet`);
      s[n] ??= {};
      if (!s[n].retexture) {
        const picture = join(REVIEW, `${of}.png`);
        if (!existsSync(picture)) await download((await api('GET', `/v1/image-to-image/${s[of].image}`)).image_urls[0], picture);
        const { result } = await api('POST', '/v1/retexture', {
          input_task_id: s[of].model,
          image_style_url: `data:image/png;base64,${(await readFile(picture)).toString('base64')}`,
          ai_model: 'latest',
          enable_original_uv: true,
          enable_pbr: false,
          texture_resolution: '4k',
          target_formats: ['glb'],
        });
        s[n].retexture = result;
        await save(s);
      }
      const t = await wait('/v1/retexture', s[n].retexture, `${n} retexture`);
      if (t.thumbnail_url) await download(t.thumbnail_url, join(REVIEW, `${n}-front.png`));
      console.log(`retex    ${n.padEnd(6)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    const tmp = join(REVIEW, 'raw');
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    for (const n of names.filter((n) => ASSETS[n].out)) {
      const a = ASSETS[n];
      const id = a.retexture ? s[n]?.retexture : s[n]?.model;
      if (!id) throw new Error(`${n}: no model yet`);
      const t = await api('GET', a.retexture ? `/v1/retexture/${id}` : `/v1/image-to-3d/${id}`);
      const raw = join(tmp, `${n}.glb`);
      await download(t.model_urls.glb, raw);
      const box = await squeeze(raw, join(OUT, a.out), a.tex);
      credits[a.out.replace(/\.glb$/, '')] = { source: 'https://www.meshy.ai', id, name: `${a.what ?? (n === 'rv' ? 'the RV with wings' : 'the RV’s wing')}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(6)} ${a.out}  x ${box[0]}  y ${box[1]}  z ${box[2]}`);
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
