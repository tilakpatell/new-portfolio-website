// Makes the music planet's instruments and courtyard with Meshy (meshy.ai),
// the site owner's account: a concept image for each, then a textured model
// from the image, brought into the scene's frame (standing on y = 0,
// centred, its longest side `size` metres) and compressed for the web into
// public/models/music/ (and music/sm/, with half the texture, for phones).
// The output is committed, so the site never calls Meshy.
//
//   node scripts/meshy-music.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30), fetch (free). Look
// at the images (lab/meshy/music/, not shipped) before making the models: a
// name's image can be made again by deleting its entry in
// scripts/meshy-music-tasks.json. Each task's id is kept there, so running a
// step again never pays twice. MESHY_API_KEY comes from the environment (or
// .env.local with node --env-file); it is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'music');
const REVIEW = join(ROOT, 'lab', 'meshy', 'music'); // concept images and thumbnails, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-music-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const STYLE =
  'A realistic product photo: true-to-life materials and craftsmanship, soft even studio light, plain neutral light grey background, no text, no logos, no people, no shadow. The whole object in view, three-quarter front view from slightly above, centred.';
const INLAY = 'glossy dark brown lacquered wood decorated with fine ivory-white floral inlay';

// size: the longest side in the scene (metres); poly: target triangles; tex: the texture's side as shipped
export const ASSETS = {
  sitar: {
    size: 1.22,
    poly: 24000,
    tex: 2048,
    prompt: `A classical Indian sitar lying on its back, the whole instrument from end to end: a large round pumpkin-gourd resonator (tumba) at one end with a flat wooden top plate and a small bone bridge, a long hollow wooden neck (dand) with about twenty slim curved brass frets tied on with thread, a second smaller round gourd under the top of the neck, a carved head with ornate wooden tuning pegs along the side of the neck, all in ${INLAY}.`,
  },
  tabla: {
    size: 0.62,
    poly: 20000,
    tex: 2048,
    prompt:
      'A pair of Indian tabla drums standing side by side on two small round cloth ring cushions: on the right a smaller, taller drum (dayan) of dark polished wood, slightly tapered, laced from top to bottom with thin leather straps over cylindrical wooden tuning blocks, its goatskin head with a round black syahi spot in the centre; on the left a larger, wider drum (bayan) shaped like a round bowl of hammered copper, laced with leather straps, its goatskin head with an off-centre round black syahi spot.',
  },
  tanpura: {
    size: 1.4,
    poly: 20000,
    tex: 2048,
    prompt: `A classical Indian tanpura standing upright: a large round gourd resonator at the bottom with a flat wooden soundboard and a wide flat bone bridge, a long plain hollow wooden neck with no frets, four long metal strings running from the bridge to the top, four large carved wooden tuning pegs near the top of the neck, all in ${INLAY}.`,
  },
  harmonium: {
    size: 0.62,
    poly: 20000,
    tex: 2048,
    prompt:
      'A portable Indian harmonium: a rectangular box of polished dark teak wood with a keyboard of three and a half octaves of white and black keys along its top, a row of small round wooden stop knobs above the keys, folding bellows at the back made of pleated maroon cloth with wooden ribs, brass corner fittings and a carved wooden front panel with a small grille.',
  },
  pavilion: {
    size: 8,
    poly: 20000,
    tex: 2048,
    prompt:
      'An open Rajasthani sandstone pavilion (chhatri) for musicians: a square raised stone platform with three steps on each side, four slender carved columns at each side holding scalloped arches, a carved cornice with deep overhanging eaves, and a shallow dome on top with a brass finial; warm pink-red sandstone with fine carved floral details, open on all sides with nothing inside.',
  },
  lamp: {
    size: 1.25,
    poly: 8000,
    tex: 1024,
    prompt: 'A tall polished antique brass oil lamp stand (samai): a round stepped base, a slender turned stem with rings, a wide round oil dish near the top with five small cotton wicks around its rim, and a small brass peacock finial on top.',
  },
  gaddi: {
    size: 2.6,
    poly: 8000,
    tex: 1024,
    prompt:
      'Low floor seating for an Indian classical music concert: a thick rectangular cotton mattress (gaddi) covered with a crisp white sheet, laid on a larger hand-woven dhurrie rug with a deep red and indigo geometric pattern, and two long cylindrical bolster cushions (takiya) in maroon and gold brocade lying along the back edge.',
  },
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

// Every vertex in world space, read off the document.
function points(doc) {
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        out.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]);
      }
    }
  }
  return out;
}
const bounds = (ps) => [0, 1, 2].map((k) => [Math.min(...ps.map((p) => p[k])), Math.max(...ps.map((p) => p[k]))]);

// standing on y = 0, centred, its longest side `size`; which way it faces is the scene's business
function place(ps, size) {
  const b = bounds(ps);
  const [[x0, x1], [y0, y1], [z0, z1]] = b;
  const s = size / Math.max(x1 - x0, y1 - y0, z1 - z0);
  const matrix = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, (-s * (x0 + x1)) / 2, -s * y0, (-s * (z0 + z1)) / 2, 1];
  const r = (x) => Math.round(x * 1000) / 1000;
  return { matrix, box: [r((x1 - x0) * s), r((y1 - y0) * s), r((z1 - z0) * s)] };
}

let io = null;
async function bake(from, to, a) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  const placed = place(points(doc), a.size);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const top = doc.createNode('placed').setMatrix(placed.matrix);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    top.addChild(child);
  }
  scene.addChild(top);
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [a.tex, a.tex], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  const prims = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives());
  const tris = prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  return { ...placed, tris };
}

const steps = {
  async images(names, s) {
    for (const n of names) {
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${ASSETS[n].prompt} ${STYLE}` });
        s[n].image = result;
        await save(s);
      }
    }
    for (const n of names) {
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    for (const n of names) {
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
    }
    for (const n of names) {
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) if (url) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    for (const n of names) {
      const a = ASSETS[n];
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      const raw = join(tmp, `${s[n].model}-${n}.glb`);
      if (!existsSync(raw)) await download((await api('GET', `/v1/image-to-3d/${s[n].model}`)).model_urls.glb, raw);
      const { tris, box } = await bake(raw, join(OUT, `${n}.glb`), a);
      // and a lighter one for phones and weaker machines: half the texture
      await bake(raw, join(OUT, 'sm', `${n}.glb`), { ...a, tex: a.tex / 2 });
      console.log(`fetch    ${n.padEnd(10)} music/${n}.glb, ${tris} triangles, ${box.join(' × ')} m`);
    }
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY (or put it in .env.local and run with node --env-file=.env.local).');
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
