// Makes Albuquerque's people and Walt's drums and hammer with Meshy
// (meshy.ai), the site owner's account: a concept image for each, then a
// textured model from the image; a person is then rigged (Meshy's humanoid
// skeleton, which office/people.js poses) and put on a new atlas
// (scripts/reatlas.mjs: welded, a few large charts with gutters, so its
// texture can have mipmaps), a prop brought into the scene's frame and
// measured. Everything is compressed for the web into public/models/
// (metherria/ for the props, albuquerque/ for the people). The output is
// committed, so the site never calls Meshy.
//
//   node --env-file=.env.local scripts/meshy-albuquerque.mjs <step> [name … | hd]
//
// `hd`: Walt and Jesse (in his hoodie, and in hazmat yellow) again at about
// 40,000 faces and 2k textures, from their own concept images, over the
// originals.
//
// Steps, in order: images (9 credits each), models (30), rig (5, people
// only), fetch (free). Each task's id is kept in
// scripts/meshy-albuquerque-tasks.json, so running a step again never pays
// twice; delete a name's entry there to make it again.
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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mendCollapsed } from './meshy-mend.mjs';
import { reatlas } from './reatlas.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models');
const REVIEW = join(ROOT, 'lab', 'meshy', 'albuquerque'); // concept images and thumbnails, for looking at (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-albuquerque-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const STYLE = 'A realistic product photo: true-to-life materials, soft even studio light, plain neutral grey background, no text, no logos, no shadow. The whole object, three-quarter front view, centred.';
const DRUM = 'standing upright, ribbed near the top and bottom, with a small grey metal spigot tap sticking out sideways near the top on one side, and a plain blank white label band around the middle';

// The people are described by how they look and dress, never by name or
// actor: stylized, not a likeness of anyone real.
const PERSON = 'A stylized, high-detail 3D game character in the look of a modern animated feature film: believable adult proportions, soft painted skin, hair and fabric, clean readable shapes. Full body, front view, standing straight in an A-pose with the arms held a little away from the body, feet slightly apart. Plain neutral grey background, no text, no shadow.';
// The world's buildings and cars, in the same stylized look as the people
const WORLD = 'A stylized 3D game asset in the look of a modern animated feature film: believable proportions, softly painted textures, clean readable shapes, a little weathered by the desert sun. The whole object, three-quarter front view from slightly above, centred, on a plain neutral grey background, no text, no logos, no people.';
const HAZMAT = 'a baggy bright yellow hazmat coverall zipped up to the neck, the hood down, and long black rubber gloves';

// out: under public/models; poly: target triangles. A prop's size is its
// longest side in the scene (metres); a person's height is theirs.
export const ASSETS = {
  drumBase: { out: 'metherria/drum-base.glb', kind: 'drum', poly: 1800, size: 0.46, prompt: `A white HDPE plastic 55-gallon chemical drum, ${DRUM}.` },
  drumBlue: { out: 'metherria/drum-blue.glb', kind: 'drum', poly: 1800, size: 0.46, prompt: `A blue HDPE plastic 55-gallon chemical drum, ${DRUM}.` },
  hammer: { out: 'metherria/hammer.glb', kind: 'hammer', poly: 1500, size: 0.44, prompt: 'A ball-peen hammer: a dark forged steel head with one flat striking face and one rounded peen, on a worn, scuffed wooden handle.' },
  // the cook and his partner, at the bench
  walt: { out: 'albuquerque/walt.glb', kind: 'person', poly: 12000, height: 1.79, prompt: `A bald man of about fifty with a short brown-grey goatee and moustache and thin dark-framed glasses, in ${HAZMAT}.` },
  jesseLab: { out: 'albuquerque/jesse-lab.glb', kind: 'person', poly: 12000, height: 1.73, prompt: `A wiry man in his mid-twenties with very short light brown buzzed hair and a boyish face, in ${HAZMAT}.` },
  // Metherria's customers
  jesse: { out: 'albuquerque/jesse.glb', kind: 'person', poly: 12000, height: 1.73, prompt: 'A wiry man in his mid-twenties with very short light brown buzzed hair and a boyish face, in a baggy burnt-orange hoodie, baggy dark blue jeans and white high-top sneakers.' },
  badger: { out: 'albuquerque/badger.glb', kind: 'person', poly: 12000, height: 1.8, prompt: 'A lanky man in his twenties with messy chin-length brown hair and stubble, in a loose olive-grey T-shirt, faded jeans and worn sneakers.' },
  pete: { out: 'albuquerque/pete.glb', kind: 'person', poly: 12000, height: 1.88, prompt: 'A very tall, very thin man in his twenties with a navy knit beanie, a sparse dark goatee and sleepy eyes, in a black T-shirt, dark jeans and black sneakers.' },
  tuco: { out: 'albuquerque/tuco.glb', kind: 'person', poly: 12000, height: 1.73, prompt: 'A stocky, muscular man in his thirties with a shaved head and a thin dark goatee, in a white sleeveless undershirt, a thin silver chain, dark blue jeans and black boots.' },
  mike: { out: 'albuquerque/mike.glb', kind: 'person', poly: 12000, height: 1.8, prompt: 'A stern, balding man in his sixties with short grey hair at the sides and a weathered face, in a tan zip-up work jacket over a grey collared shirt, brown slacks and brown shoes.' },
  gus: { out: 'albuquerque/gus.glb', kind: 'person', poly: 12000, height: 1.78, prompt: 'A tall, composed man of about fifty with dark brown skin, short black hair and rimless glasses, standing very upright, in a charcoal grey suit, a white shirt and a dark grey tie, black shoes.' },
  lydia: { out: 'albuquerque/lydia.glb', kind: 'person', poly: 12000, height: 1.7, prompt: 'A thin, tense woman in her forties with long straight light brown hair, in a camel blazer over a cream blouse, dark grey slacks and low black heels.' },
  declan: { out: 'albuquerque/declan.glb', kind: 'person', poly: 12000, height: 1.83, prompt: 'A man in his forties with short brown hair and a neat short beard, in a navy suit over a white open-collared shirt, and black shoes.' },
  saul: { out: 'albuquerque/saul.glb', kind: 'person', poly: 12000, height: 1.78, prompt: 'A chatty man in his forties with thinning light brown hair combed over, in a shiny light grey suit, a mustard yellow shirt and a loud purple patterned tie, brown loafers.' },
  // at the RV's door, and at the rest home
  hank: { out: 'albuquerque/hank.glb', kind: 'person', poly: 12000, height: 1.85, prompt: 'A big, burly, bald man in his forties with a short blond-grey goatee and a bit of a belly, in an olive green short-sleeved shirt, khaki trousers with a badge on the belt, and brown shoes.' },
  hector: { out: 'albuquerque/hector.glb', kind: 'person', poly: 12000, height: 1.73, prompt: 'A frail, very old man with tanned wrinkled skin, swept-back white hair and white eyebrows, in a pale grey-blue button-up shirt, dark grey trousers and black shoes.' },
  nurse: { out: 'albuquerque/nurse.glb', kind: 'person', poly: 12000, height: 1.65, prompt: 'A woman in her thirties with short dark hair, in light blue nurse scrubs and white shoes.' },
  // the world: Walt's car and the RV, Hank's SUV, and the places you drive to
  aztek: { out: 'albuquerque/world/aztek.glb', kind: 'world', poly: 9000, size: 4.6, prompt: 'A boxy mid-2000s crossover SUV with a sloping split rear tailgate, thick grey plastic body cladding along the doors and bumpers, a dull pale beige-green paint and black roof rails.' },
  rv: { out: 'albuquerque/world/rv.glb', kind: 'world', poly: 9000, size: 8.5, prompt: 'An old weathered 1980s motorhome camper: off-white and beige body with faded brown and orange stripes along its side, a side door, small square windows, a ladder at the back, dusty tyres.' },
  suv: { out: 'albuquerque/world/suv.glb', kind: 'world', poly: 7000, size: 5, prompt: 'A black full-size government SUV with tinted windows, chrome grille and black steel wheels, clean and imposing.' },
  house: { out: 'albuquerque/world/house.glb', kind: 'world', poly: 10000, size: 16, prompt: 'A single-storey suburban ranch house in the American Southwest: tan stucco walls, a low pitched brown shingle roof, an attached two-car garage with a white door, a small front porch, gravel front yard with a small tree and a concrete driveway.' },
  pollos: { out: 'albuquerque/world/pollos.glb', kind: 'world', poly: 10000, size: 18, prompt: 'A cheerful fast-food chicken restaurant: a single-storey building with warm yellow walls and red trim, big front windows, a red tiled roof edge, an outdoor seating area with yellow umbrellas, and a tall yellow sign on a pole.' },
  laundry: { out: 'albuquerque/world/laundry.glb', kind: 'world', poly: 10000, size: 24, prompt: 'An industrial laundry building: a long low warehouse with beige painted brick walls, a loading dock with two roll-up doors, a row of small high windows, steam vents on the flat roof and a blank sign board over the entrance.' },
  casa: { out: 'albuquerque/world/casa.glb', kind: 'world', poly: 10000, size: 20, prompt: 'A single-storey Southwestern adobe-style retirement home: smooth beige stucco walls, a flat roof with wooden beam ends sticking out, an arched entrance porch with a bench, small windows with turquoise blue trim, and a few desert plants in front.' },
  office: { out: 'albuquerque/world/office.glb', kind: 'world', poly: 10000, size: 16, prompt: 'A small office unit in a beige stucco strip mall with a glass storefront and door, a blank sign board above it, and a tall inflatable Statue of Liberty figure in green standing on its flat roof, holding up a torch.' },
  carwash: { out: 'albuquerque/world/carwash.glb', kind: 'world', poly: 9000, size: 18, prompt: 'A small drive-through car wash: a white and blue building with a long open bay showing big blue brushes inside, a flat canopy over the entrance and a tall blank sign on a pole.' },
  // the rest of town (rules.js TOWN): real Albuquerque, and the shows' own
  kimo: { out: 'albuquerque/world/kimo.glb', kind: 'world', poly: 12000, size: 20, prompt: 'A 1920s Pueblo Deco movie theatre, three storeys tall: tan stucco walls with a stepped parapet, bands of colourful geometric tile ornament in turquoise, red and yellow, rows of small windows, a projecting marquee canopy with a blank lightbox over glass entrance doors, and a tall blank vertical blade sign at one corner.' },
  doghouse: { out: 'albuquerque/world/doghouse.glb', kind: 'world', poly: 9000, size: 9, prompt: 'A tiny old roadside hot dog drive-in stand: a small white single-storey building with red trim, big service windows and a short red awning, and on its flat roof a tall sign shaped like a long dachshund dog outlined in neon tubes.' },
  dea: { out: 'albuquerque/world/dea.glb', kind: 'world', poly: 10000, size: 26, prompt: 'A plain modern five-storey government office building: grey concrete with horizontal bands of dark blue tinted windows on every floor, a flat roof with air-conditioning units, and a glass entrance under a short concrete canopy.' },
  motel: { out: 'albuquerque/world/motel.glb', kind: 'world', poly: 12000, size: 34, prompt: 'A long single-storey 1960s roadside motel: tan stucco walls, a row of teal doors each beside a window with an air conditioner under it, a covered walkway on thin posts along the whole front, a flat brown roof, and a tall retro arrow-shaped blank sign on a pole at one end.' },
  pest: { out: 'albuquerque/world/pest.glb', kind: 'world', poly: 9000, size: 14, prompt: 'A suburban single-storey house completely covered by a huge fumigation tent: a tarpaulin with bold vertical stripes of yellow and green and thin red stripes, draped over the pitched roof all the way down to the ground and held with clamps and sandbags.' },
  jesseHouse: { out: 'albuquerque/world/jesse-house.glb', kind: 'world', poly: 12000, size: 14, prompt: 'A two-storey Spanish Colonial Revival house: white stucco walls, a red clay barrel-tile pitched roof, an arched wooden front door, arched windows with dark wooden frames, a small wrought-iron balcony, a chimney, and a low stucco garden wall at the front.' },
  diner: { out: 'albuquerque/world/diner.glb', kind: 'world', poly: 10000, size: 16, prompt: 'A classic American roadside family diner: a single-storey building with big plate-glass windows all round, cream walls with a red stripe, a flat roof with a red edge, a glass double door, and a blank rectangular sign standing on the roof.' },
  hankHouse: { out: 'albuquerque/world/hank-house.glb', kind: 'world', poly: 12000, size: 16, prompt: 'A large single-storey Southwestern Pueblo Revival house: brown adobe stucco walls with rounded corners, a flat roof with wooden beam ends sticking out, a purple front door, a covered porch on wooden posts, a two-car garage and a gravel yard with desert plants.' },
};

// The HD set: Walt and Jesse made again from their own concept images
// (`from` lends its image, so none is paid for twice), at about 40,000
// faces, and written over the 12,000-face originals (the same `out`), so
// everything that draws them gets them. Meshy paints a 4k texture for what
// a 2k one costs (`paint`), and it's brought down to the 2k it ships at
// (`tex`): the loader halves it again on a phone, and again on a weak
// device (lib/detail's model maps). `ultra` is Meshy's finer geometry pass
// (5 credits more), which gave Walt a clean goatee, his glasses and a hard
// brow. Each was made both ways, and the other kept in the tasks file
// (waltHdStandard, jesseHdUltra, jesseLabHdUltra), free to fetch: the finer
// pass gave the Jesse in his hoodie a pink cartoon nose, and the Jesse in
// hazmat a thin yellow line across his cheek once on the new atlas.
const HD = {
  waltHd: { ...ASSETS.walt, from: 'walt', poly: 40000, paint: '4k', tex: 2048, ultra: true },
  jesseHd: { ...ASSETS.jesse, from: 'jesse', poly: 40000, paint: '4k', tex: 2048 },
  jesseLabHd: { ...ASSETS.jesseLab, from: 'jesseLab', poly: 40000, paint: '4k', tex: 2048 },
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

const TEX = 1024; // a texture's size, as shipped (unless the asset says: `tex`)
// A building or a car: standing on y = 0, centred, its longest side `size`
// (which way it faces is the world's business: see albuquerque/world).
function placeWorld(ps, size) {
  const [[x0, x1], [y0], [z0, z1]] = bounds(ps);
  const s = size / Math.max(x1 - x0, z1 - z0);
  const matrix = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, (-s * (x0 + x1)) / 2, -s * y0, (-s * (z0 + z1)) / 2, 1];
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
  // a prop into the scene's frame, under one node that carries the placement
  // (a person stays where they were rigged: people.js sizes and poses them)
  const placed = a.kind === 'drum' ? placeDrum(points(doc), a.size) : a.kind === 'hammer' ? placeHammer(points(doc), a.size) : a.kind === 'world' ? placeWorld(points(doc), a.size) : {};
  if (placed.matrix) {
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const top = doc.createNode('placed').setMatrix(placed.matrix);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      top.addChild(child);
    }
    scene.addChild(top);
  }
  // a person without the clip they were rigged with (the browser poses
  // them), on a new atlas the size of the texture they ship with
  const person = a.kind === 'person';
  const tex = a.tex ?? TEX;
  let mended = 0;
  if (person) {
    for (const clip of doc.getRoot().listAnimations()) {
      for (const part of [...clip.listChannels(), ...clip.listSamplers()]) part.dispose();
      clip.dispose();
    }
    await reatlas(doc, tex, { apart: true });
    // (the few small charts the packing laid down to nothing take their
    // colour from beside them: scripts/meshy-mend.mjs)
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    mended = mendCollapsed(prim.getIndices().getArray(), prim.getAttribute('TEXCOORD_0').getArray(), prim.getAttribute('POSITION').getArray(), tex);
  }
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }), meshopt({ encoder: MeshoptEncoder, level: person ? 'high' : 'medium' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  const prims = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives());
  const tris = prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  const verts = prims.reduce((n, p) => n + p.getAttribute('POSITION').getCount(), 0);
  return { ...placed, tris, verts, mended };
}

const steps = {
  async images(names, s) {
    names = names.filter((n) => !ASSETS[n].from); // (an HD one has its original's)
    for (const n of names) {
      s[n] ??= {};
      if (!s[n].image) {
        const person = ASSETS[n].kind === 'person';
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${ASSETS[n].prompt} ${person ? PERSON : ASSETS[n].kind === 'world' ? WORLD : STYLE}`, ...(person ? { pose_mode: 'a-pose' } : {}) });
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
      const from = ASSETS[n].from;
      if (!s[n]?.image && from && s[from]?.image) {
        s[n] = { ...s[n], image: s[from].image };
        await save(s);
      }
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
          texture_resolution: ASSETS[n].paint ?? '2k',
          ...(ASSETS[n].ultra ? { geometry_resolution: '2k' } : {}),
          ...(ASSETS[n].kind === 'person' ? { pose_mode: 'a-pose' } : {}),
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
  async rig(names, s) {
    const people = names.filter((n) => ASSETS[n].kind === 'person');
    for (const n of people) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
    }
    for (const n of people) {
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    for (const n of names) {
      const a = ASSETS[n];
      if (a.kind === 'person') {
        if (!s[n]?.rig) throw new Error(`${n}: not rigged yet`);
        const raw = join(tmp, `${s[n].rig}-${n}.glb`);
        if (!existsSync(raw)) await download((await api('GET', `/v1/rigging/${s[n].rig}`)).result.rigged_character_glb_url, raw);
        const { tris, verts, mended } = await bake(raw, join(OUT, a.out), a);
        console.log(`fetch    ${n.padEnd(10)} ${a.out}, ${tris} triangles, ${verts} vertices${mended ? `, ${mended} mended` : ''}`);
        continue;
      }
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      const raw = join(tmp, `${s[n].model}-${n}.glb`);
      if (!existsSync(raw)) await download((await api('GET', `/v1/image-to-3d/${s[n].model}`)).model_urls.glb, raw);
      const { spout, band, tris } = await bake(raw, join(OUT, a.out), a);
      console.log(`fetch    ${n.padEnd(10)} ${a.out}, ${tris} triangles${spout ? `, spout ${JSON.stringify(spout)}, band ${JSON.stringify(band)}` : ''}`);
    }
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
