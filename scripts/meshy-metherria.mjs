// Makes Walt's drums and hammer for Metherria with Meshy (meshy.ai), the
// site owner's account: a photo-style concept image for each, then a
// textured model from the image, then (fetch) the model brought into the
// scene's frame, measured and compressed for the web into
// public/models/metherria/. The output is committed, so the site never calls
// Meshy.
//
//   node --env-file=.env.local scripts/meshy-metherria.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30), fetch (free). Each
// task's id is kept in scripts/meshy-metherria-tasks.json, so running a step
// again never pays twice; delete a name's entry there to make it again.
// MESHY_API_KEY comes from .env.local (git ignores it); it is never printed.
//
// fetch prints each model's spout and label band in the scene's frame, for
// src/components/albuquerque/metherria/props.js.

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
const OUT = join(ROOT, 'public', 'models', 'metherria');
const REVIEW = join(ROOT, 'lab', 'meshy', 'metherria'); // concept images and thumbnails, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-metherria-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const STYLE = 'A realistic product photo: true-to-life materials, soft even studio light, plain neutral grey background, no text, no logos, no shadow. The whole object, three-quarter front view, centred.';
const DRUM = 'standing upright, ribbed near the top and bottom, with a small grey metal spigot tap sticking out sideways near the top on one side, and a plain blank white label band around the middle';

// out: file name; poly: target triangles; size: the longest side in the scene, metres
export const ASSETS = {
  drumBase: { out: 'drum-base.glb', kind: 'drum', poly: 1800, size: 0.46, prompt: `A white HDPE plastic 55-gallon chemical drum, ${DRUM}.` },
  drumBlue: { out: 'drum-blue.glb', kind: 'drum', poly: 1800, size: 0.46, prompt: `A blue HDPE plastic 55-gallon chemical drum, ${DRUM}.` },
  hammer: { out: 'hammer.glb', kind: 'hammer', poly: 1500, size: 0.44, prompt: 'A ball-peen hammer: a dark forged steel head with one flat striking face and one rounded peen, on a worn, scuffed wooden handle.' },
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

// ── into the scene's frame ──
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
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const bounds = (ps) => [0, 1, 2].map((k) => [Math.min(...ps.map((p) => p[k])), Math.max(...ps.map((p) => p[k]))]);

// A drum: its axis on y, standing on y = 0, the spout pointing +x, `size`
// tall. Returns the matrix and the spout and band in the new frame.
function placeDrum(ps, size) {
  const [, [y0, y1]] = bounds(ps);
  const h = y1 - y0;
  // the body's axis from the middle of the drum (the spout is up top)
  const mid = ps.filter((p) => p[1] > y0 + h * 0.35 && p[1] < y0 + h * 0.65);
  const cx = (pct(mid.map((p) => p[0]), 0.02) + pct(mid.map((p) => p[0]), 0.98)) / 2;
  const cz = (pct(mid.map((p) => p[2]), 0.02) + pct(mid.map((p) => p[2]), 0.98)) / 2;
  const radius = pct(mid.map((p) => Math.hypot(p[0] - cx, p[2] - cz)), 0.9);
  // the spout: whatever stands out past the body's rim
  const out = ps.filter((p) => Math.hypot(p[0] - cx, p[2] - cz) > radius * 1.12);
  if (out.length < 3) throw new Error('no spout found');
  const tip = out.reduce((a, p) => (Math.hypot(p[0] - cx, p[2] - cz) > Math.hypot(a[0] - cx, a[2] - cz) ? p : a));
  const near = out.filter((p) => Math.hypot(p[0] - tip[0], p[2] - tip[2]) < radius * 0.15);
  const spoutY = near.reduce((a, p) => a + p[1], 0) / near.length;
  const turn = Math.atan2(tip[2] - cz, tip[0] - cx); // rotation about y that brings the spout to +x
  const s = size / h;
  const c = Math.cos(turn);
  const n = Math.sin(turn);
  // scale · rotate about y by `turn` · move the axis and base to the origin
  const matrix = [s * c, 0, -s * n, 0, 0, s, 0, 0, s * n, 0, s * c, 0, 0, 0, 0, 1];
  [matrix[12], matrix[13], matrix[14]] = [-(s * c * cx + s * n * cz), -s * y0, -(-s * n * cx + s * c * cz)];
  const r = (x) => Math.round(x * 1000) / 1000;
  return { matrix, spout: [r(Math.hypot(tip[0] - cx, tip[2] - cz) * s), r((spoutY - y0) * s), 0], band: [r(h * 0.5 * s), r(radius * s)] };
}

// The hammer: the head's middle at the origin, the handle running along +z,
// the head across x, `size` long.
function placeHammer(ps, size) {
  const b = bounds(ps);
  const ext = b.map(([lo, hi]) => hi - lo);
  const long = ext.indexOf(Math.max(...ext));
  const [lo, hi] = b[long];
  const len = hi - lo;
  // the head is the end with the most across it
  const across = (sel) => Math.max(...[0, 1, 2].filter((k) => k !== long).map((k) => Math.max(...sel.map((p) => p[k])) - Math.min(...sel.map((p) => p[k]))));
  const atLo = ps.filter((p) => p[long] < lo + len * 0.18);
  const atHi = ps.filter((p) => p[long] > hi - len * 0.18);
  const headLo = across(atLo) > across(atHi);
  const head = headLo ? atLo : atHi;
  const others = [0, 1, 2].filter((k) => k !== long);
  const spread = others.map((k) => Math.max(...head.map((p) => p[k])) - Math.min(...head.map((p) => p[k])));
  const wide = others[spread[0] >= spread[1] ? 0 : 1]; // the head's own length
  const centre = [0, 1, 2].map((k) => (Math.max(...head.map((p) => p[k])) + Math.min(...head.map((p) => p[k]))) / 2);
  // new axes in old coordinates: x along the head, z down the handle, y = z × x
  const ax = [0, 0, 0];
  ax[wide] = 1;
  const az = [0, 0, 0];
  az[long] = headLo ? 1 : -1;
  const ay = [az[1] * ax[2] - az[2] * ax[1], az[2] * ax[0] - az[0] * ax[2], az[0] * ax[1] - az[1] * ax[0]];
  const s = size / len;
  // rows of the rotation are the new axes; column-major for glTF
  const R = [ax, ay, az];
  const matrix = [s * R[0][0], s * R[1][0], s * R[2][0], 0, s * R[0][1], s * R[1][1], s * R[2][1], 0, s * R[0][2], s * R[1][2], s * R[2][2], 0, 0, 0, 0, 1];
  for (let i = 0; i < 3; i++) matrix[12 + i] = -(matrix[i] * centre[0] + matrix[4 + i] * centre[1] + matrix[8 + i] * centre[2]);
  return { matrix };
}

let io = null;
async function bake(from, to, a) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  const placed = a.kind === 'drum' ? placeDrum(points(doc), a.size) : placeHammer(points(doc), a.size);
  // everything under one node that carries the placement
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const top = doc.createNode('placed').setMatrix(placed.matrix);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    top.addChild(child);
  }
  scene.addChild(top);
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(to, doc);
  const tris = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
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
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    await mkdir(OUT, { recursive: true });
    const tmp = join(REVIEW, 'raw');
    for (const n of names) {
      const a = ASSETS[n];
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      const t = await api('GET', `/v1/image-to-3d/${s[n].model}`);
      const raw = join(tmp, a.out);
      await download(t.model_urls.glb, raw);
      const { spout, band, tris } = await bake(raw, join(OUT, a.out), a);
      console.log(`fetch    ${n.padEnd(10)} ${a.out}, ${tris} triangles${spout ? `, spout ${JSON.stringify(spout)}, band ${JSON.stringify(band)}` : ''}`);
    }
    await rm(tmp, { recursive: true, force: true });
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
