// Takes the CC0 Quaternius models the planet landings use
// (src/components/universe/landings/landings.js) from the packs as
// downloaded (tilakverse-assets: docs/assets/quaternius.md) and writes them,
// compressed, to public/models/quaternius/: a GLB a family (a kit: the
// trees, the rocks, the street furniture), one node a model, its textures
// shared between them, so a landing that stands three kinds of tree about
// fetches one file and one copy of the bark. Each model is baked into the
// site's frame: metres, standing on y = 0, centred on x and z. Leaves and
// flowers keep their cut-out edges (alpha-tested, both sides drawn, their
// colour pushed out under the cut so it doesn't fringe white); bark, rock
// and props are opaque, one side; normal and ORM maps are dropped (the
// stylised look holds without them). Colour maps are WebP, leaves at most
// 512 pixels a side and the rest 256 (a kit can ask more); meshes are
// Meshopt-compressed. public/models/quaternius/manifest.json says what each
// model is: its size, triangles, draws, a collider (a box and a hull of at
// most 64 points, in metres) and the body a landing's physics should give
// it. The credits go into public/games/credits.json.
//
//   QUATERNIUS=/path/to/tilakverse-assets/quaternius npm run quaternius [kit …]
//
// QUATERNIUS may list several folders (':' between), each holding packs as
// tilakverse-assets/quaternius does; a file is taken from the first that
// has it. Without it, the asset repo cloned beside this one. The output is
// committed, so the site never needs the packs.

import { Document, Logger, Node, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, mergeDocuments, prune, simplify, transformMesh, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = joinPath(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = 'models/quaternius'; // (under public/)
const SOURCE = 'https://quaternius.com';

// where each pack's models are, under a packs folder
export const PACKS = {
  naturemega: { dir: 'stylized-nature-megakit/glTF', name: 'Stylized Nature MegaKit' },
  furniture: { dir: 'furniture-pack/OBJ', name: 'Furniture Pack' },
  street: { dir: 'street-pack/OBJ', name: 'Street Pack' },
  city: { dir: 'downtown-city-megakit/Exports/glTF (Godot)', name: 'Downtown City MegaKit' },
  space: { dir: 'ultimate-space-kit', name: 'Ultimate Space Kit' },
};

// What a model may cost, by what it is: triangles, and its share of its
// kit's bytes (a tree's bark and leaves, a rock's face)
export const BUDGETS = {
  tree: { tris: 5000, bytes: 180 * 1024 },
  bush: { tris: 1500, bytes: 60 * 1024 },
  plant: { tris: 700, bytes: 60 * 1024 },
  rock: { tris: 600, bytes: 60 * 1024 },
  prop: { tris: 1500, bytes: 60 * 1024 },
};

// The kits: `<folder>/<kit>` → { pack, opaque? (px: its opaque maps' size,
// 256 if not said), models: { node name → model } }. A model: { file (in
// its pack's folder), kind (a BUDGETS key), metres? ({ tall | long | wide }:
// the size it's baked at; left out, as the pack has it, in metres), maps?
// ({ material: texture file }: a texture swapped in, the material renamed
// `as`), colours? ({ material: '#hex' }: an OBJ's, whose MTL gives grey),
// palette? (the space kit's atlas read into vertex colours), tris? (simplified
// to about), turn? (radians about the upright: its front to +z), ao? (how
// much of its vertex colours' shade to keep, 0…1: the grass's is black at
// the root), body? ({ shape: 'box' | 'cylinder' | 'ball', mass (kg),
// fixed? }: what a landing's physics makes of it, as
// universe/landings/bodies.js reads a model's) }
const tree = (file, tall) => ({ file, kind: 'tree', metres: { tall } });
export const KITS = {
  'nature/trees': {
    pack: 'naturemega',
    models: {
      CommonTree_3: tree('CommonTree_3.gltf', 9.4),
      CommonTree_4: tree('CommonTree_4.gltf', 9.4),
      CommonTree_5: tree('CommonTree_5.gltf', 7),
      Pine_4: tree('Pine_4.gltf', 10.2),
      Pine_5: tree('Pine_5.gltf', 8.7),
      // (the bushes wear the common trees' leaves: one copy of them)
      Bush_Common_Flowers: { file: 'Bush_Common_Flowers.gltf', kind: 'bush', metres: { tall: 1.3 } },
      Bush_Long_1: { file: 'Bush_Long_1.gltf', kind: 'bush', metres: { tall: 1.6 } },
    },
  },
  'nature/flowers': {
    pack: 'naturemega',
    models: {
      Flower_1_Single: { file: 'Flower_1_Single.gltf', kind: 'plant', metres: { tall: 0.5 } },
      Flower_3_Single: { file: 'Flower_3_Single.gltf', kind: 'plant', metres: { tall: 0.6 } },
      Flower_6: { file: 'Flower_6.gltf', kind: 'plant', metres: { wide: 0.7 } },
      Fern_2: { file: 'Fern_2.gltf', kind: 'plant', metres: { wide: 1.2 } },
    },
  },
  'nature/grass': {
    pack: 'naturemega',
    models: {
      Grass_Common_Short: { file: 'Grass_Common_Short.gltf', kind: 'plant', metres: { tall: 0.5 }, ao: 0.45 },
      Grass_Wispy_Short: { file: 'Grass_Wispy_Short.gltf', kind: 'plant', metres: { tall: 0.45 }, ao: 0.45 },
    },
  },
  'nature/rocks': {
    pack: 'naturemega',
    models: {
      Rock_Medium_1: { file: 'Rock_Medium_1.gltf', kind: 'rock', metres: { long: 1 } },
      Rock_Medium_2: { file: 'Rock_Medium_2.gltf', kind: 'rock', metres: { long: 1 } },
      Rock_Medium_4: { file: 'Rock_Medium_4.gltf', kind: 'rock', metres: { long: 1 } },
      Rock_Desert_1: { file: 'Rock_Medium_1.gltf', kind: 'rock', metres: { long: 1 }, maps: { Rocks: 'Rocks_Desert_Diffuse.png' }, as: 'Rocks_Desert' },
      Rock_Desert_2: { file: 'Rock_Medium_2.gltf', kind: 'rock', metres: { long: 1 }, maps: { Rocks: 'Rocks_Desert_Diffuse.png' }, as: 'Rocks_Desert' },
      Pebble_Round_2: { file: 'Pebble_Round_2.gltf', kind: 'rock', metres: { long: 0.5 } },
      Pebble_Square_3: { file: 'Pebble_Square_3.gltf', kind: 'rock', metres: { long: 0.5 } },
      Pebble_Desert: { file: 'Pebble_Round_2.gltf', kind: 'rock', metres: { long: 0.5 }, maps: { PathRocks: 'PathRocks_Desert_Diffuse.png' }, as: 'PathRocks_Desert' },
    },
  },
  'nature/mushrooms': {
    pack: 'naturemega',
    models: {
      Mushroom_Common: { file: 'Mushroom_Common.gltf', kind: 'plant', metres: { tall: 0.3 }, tris: 320 },
      Mushroom_RedCap: { file: 'Mushroom_RedCap.gltf', kind: 'plant', metres: { tall: 0.35 }, tris: 320 },
    },
  },
  // the furniture pack's OBJs name no colours (every MTL is grey): its
  // preview's, by material
  'props/furniture': {
    pack: 'furniture',
    models: {
      Chair: { file: 'Chair.obj', kind: 'prop', metres: { tall: 0.95 }, turn: -Math.PI / 2, body: { shape: 'box', mass: 4 } },
      Stool: { file: 'Stool.obj', kind: 'prop', metres: { tall: 0.65 }, body: { shape: 'cylinder', mass: 2.5 } },
      Table: { file: 'Table.obj', kind: 'prop', metres: { tall: 0.76 }, body: { shape: 'box', mass: 14 } },
      Vase: { file: 'Vase.obj', kind: 'prop', metres: { tall: 0.4 }, body: { shape: 'cylinder', mass: 1.5 } },
      Plant: { file: 'Plant.obj', kind: 'prop', metres: { tall: 0.45 }, body: { shape: 'cylinder', mass: 1.2 } },
    },
    colours: { Wood: '#8c3b2a', DarkWood: '#5e2a20', Red: '#b3302b', Metal: '#26334f', Top: '#f2e2b4', Vase: '#9fd2e0', DarkBrown: '#5a3424', Green: '#6aab3a' },
  },
  'props/street': {
    pack: 'street',
    models: {
      Streetlight_Single: { file: 'Streetlight_Single.obj', kind: 'prop', metres: { tall: 5.6 }, body: { shape: 'cylinder', mass: 120, fixed: true } },
      TrafficLight: { file: 'TrafficLight.obj', kind: 'prop', metres: { tall: 4.4 }, turn: -Math.PI / 2, body: { shape: 'cylinder', mass: 150, fixed: true } },
      Sign_Stop: { file: 'Sign_Stop.obj', kind: 'prop', metres: { tall: 2.4 }, turn: -Math.PI / 2, body: { shape: 'cylinder', mass: 15, fixed: true } },
      Sign_NoParking: { file: 'Sign_NoParking.obj', kind: 'prop', metres: { tall: 2.4 }, turn: -Math.PI / 2, body: { shape: 'cylinder', mass: 12, fixed: true } },
    },
  },
  'props/city': {
    pack: 'city',
    opaque: 512,
    models: {
      Prop_ACUnit: { file: 'Prop_ACUnit.gltf', kind: 'prop', body: { shape: 'box', mass: 25 } },
      Prop_Bollard: { file: 'Prop_Bollard.gltf', kind: 'prop', body: { shape: 'cylinder', mass: 60, fixed: true } },
      Prop_Planter_Single: { file: 'Prop_Planter_Single.gltf', kind: 'prop', body: { shape: 'box', mass: 300, fixed: true } },
    },
  },
  'props/space': {
    pack: 'space',
    models: {
      Pickup_Crate: { file: 'Items/GLTF/Pickup_Crate.gltf', kind: 'prop', metres: { tall: 0.8 }, palette: true, body: { shape: 'box', mass: 8 } },
      Pickup_Jar: { file: 'Items/GLTF/Pickup_Jar.gltf', kind: 'prop', metres: { tall: 0.9 }, palette: true, body: { shape: 'cylinder', mass: 3 } },
    },
  },
};

// ── pure: the rules each model is held to ──

// a material's name without Blender's numbering ('DarkWood.009' → 'DarkWood')
export const baseName = (name = '') => name.replace(/\.\d+$/, '');

// The thin, cut-out parts: drawn both sides
const CARDS = /leaf|leaves|flower|petal|grass|fern|plant|clover/i;

// What a material becomes: a card (leaves, flowers, grass) alpha-tested
// where its source cuts it (a blend too: sorted blends and instancing don't
// mix) and drawn both sides; anything else opaque and one-sided (the
// sources draw bark and rock both sides, and some mark opaque bark as
// alpha-tested)
export function materialFix({ name = '', alphaMode = 'OPAQUE', cutoff = 0.5 } = {}) {
  const card = CARDS.test(name);
  if (!card) return { alphaMode: 'OPAQUE', doubleSided: false, cutoff: null };
  if (alphaMode === 'OPAQUE') return { alphaMode: 'OPAQUE', doubleSided: true, cutoff: null };
  return { alphaMode: 'MASK', doubleSided: true, cutoff: alphaMode === 'BLEND' ? 0.5 : cutoff };
}

// What a kit may cost: its models' budgets together
export function kitBudget(kit) {
  const models = Object.values(kit.models);
  return { bytes: models.reduce((n, m) => n + BUDGETS[m.kind].bytes, 0) };
}

// What's wrong with a model as it was written (its summary: tris, textures
// [{ width, height, mime }], materials [{ name, alphaMode, doubleSided }],
// minY in metres), against its kind's budget: [] when nothing is
export function problems(model, { tris, textures = [], materials = [], minY = 0 }) {
  const out = [];
  const budget = BUDGETS[model.kind];
  if (!budget) out.push(`no budget for a ${model.kind}`);
  else if (tris > (model.tris ?? budget.tris)) out.push(`${tris} triangles, over ${model.tris ?? budget.tris}`);
  for (const t of textures) {
    if (Math.max(t.width, t.height) > 512) out.push(`a ${t.width}×${t.height} texture, over 512`);
    if (t.mime !== 'image/webp') out.push(`a ${t.mime} texture, not WebP`);
  }
  for (const m of materials) if (m.alphaMode !== 'OPAQUE' && !m.doubleSided) out.push(`${m.name} cut out but drawn one side`);
  if (Math.abs(minY) > 0.02) out.push(`stands ${minY.toFixed(3)} m off the ground`);
  return out;
}

// Directions spread evenly over a sphere (a Fibonacci lattice)
function directions(n) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
  }
  return out;
}

// A model's collider, from its points (flat [x, y, z, …], metres, standing
// on y = 0): its box (the half sizes, and the middle), the circle round it
// along the ground (from its upright axis), and its hull as at most `most`
// of its own points, the furthest out each way (a convex hull round them is
// the model's, near enough), rounded to the millimetre
export function colliderOf(points, { most = 64 } = {}) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], points[i + k]);
      hi[k] = Math.max(hi[k], points[i + k]);
    }
  const mid = lo.map((v, k) => (v + hi[k]) / 2);
  let radius = 0;
  for (let i = 0; i < points.length; i += 3) radius = Math.max(radius, Math.hypot(points[i], points[i + 2]));
  const keep = new Set();
  for (const d of directions(most)) {
    let best = -1;
    let far = -Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const v = (points[i] - mid[0]) * d[0] + (points[i + 1] - mid[1]) * d[1] + (points[i + 2] - mid[2]) * d[2];
      if (v > far) [far, best] = [v, i];
    }
    keep.add(best);
  }
  const mm = (v) => Math.round(v * 1000) / 1000;
  return {
    half: hi.map((v, k) => mm((v - lo[k]) / 2)),
    mid: mid.map(mm),
    radius: mm(radius),
    hull: [...keep].sort((a, b) => a - b).map((i) => [mm(points[i]), mm(points[i + 1]), mm(points[i + 2])]),
  };
}

// The credit for a model of a pack, as public/games/credits.json has them;
// its `use` names the kit it's in (`url`), which is how the credits' audit
// (scripts/ai-e2e/assets/credits.mjs) finds its file
export const creditOf = (pack, file, url) => ({ source: SOURCE, id: file.split('/').pop().replace(/\.\w+$/, ''), name: `${PACKS[pack].name}: ${file.split('/').pop().replace(/\.\w+$/, '')}`, authors: ['Quaternius'], license: 'CC0 1.0', use: `In public${url}, a kit of them (scripts/quaternius.mjs)` });

// Colour under a cut-out texture's clear and soft-edged texels, pushed out
// from its solid ones (rgba: Uint8Array of w × h × 4, its colour changed in
// place, its alpha kept): each takes the average of its solid (or already
// filled) neighbours, pass after pass, and what's still left the average of
// all the solid ones; so mipmaps and filtering at the cut's edge blend leaf
// into leaf, not into whatever the painter left under it (white, often)
export function dilate(rgba, w, h, { passes = 16, solid = 250 } = {}) {
  const done = new Uint8Array(w * h);
  const mean = [0, 0, 0];
  let seeds = 0;
  for (let i = 0; i < w * h; i++)
    if (rgba[i * 4 + 3] >= solid) {
      done[i] = 1;
      for (let c = 0; c < 3; c++) mean[c] += rgba[i * 4 + c];
      seeds++;
    }
  if (!seeds) return rgba;
  for (let pass = 0; pass < passes; pass++) {
    const fill = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (done[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (!done[j]) continue;
            r += rgba[j * 4];
            g += rgba[j * 4 + 1];
            b += rgba[j * 4 + 2];
            n++;
          }
        if (n) fill.push([i, r / n, g / n, b / n]);
      }
    if (!fill.length) break;
    for (const [i, r, g, b] of fill) {
      rgba[i * 4] = Math.round(r);
      rgba[i * 4 + 1] = Math.round(g);
      rgba[i * 4 + 2] = Math.round(b);
      done[i] = 1;
    }
  }
  for (let i = 0; i < w * h; i++) if (!done[i]) for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.round(mean[c] / seeds);
  return rgba;
}

// ── reading and writing ──

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLinear = (hex) => [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const prims = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
const triangles = (doc) => prims(doc).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// every vertex, in the world (each node's matrix applied): flat [x, y, z, …]
export function worldPoints(doc) {
  const out = [];
  const v = [0, 0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const a = p.getAttribute('POSITION');
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        out.push(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]);
      }
    }
  }
  return out;
}

// An OBJ's faces, by material: [{ material, positions, normals }] (flat
// arrays, a triangle a three vertices; a face of more sides as a fan). Its
// lines (a stray edge some exports leave in) and texture coordinates (these
// packs' OBJs are flat colours) are left out
export function parseObj(text) {
  const v = [];
  const vn = [];
  const out = new Map();
  let cur = null;
  const into = (name) => {
    if (!out.has(name)) out.set(name, { material: name, positions: [], normals: [] });
    return out.get(name);
  };
  for (const line of text.split('\n')) {
    const [k, ...a] = line.trim().split(/\s+/);
    if (k === 'v') v.push(+a[0], +a[1], +a[2]);
    else if (k === 'vn') vn.push(+a[0], +a[1], +a[2]);
    else if (k === 'usemtl') cur = into(a.join(' '));
    else if (k === 'f') {
      const g = cur ?? into('default');
      const corners = a.map((c) => c.split('/').map((x) => (x ? parseInt(x, 10) : null)));
      for (let i = 1; i + 1 < corners.length; i++)
        for (const [pi, , ni] of [corners[0], corners[i], corners[i + 1]]) {
          const p = (pi < 0 ? v.length / 3 + pi : pi - 1) * 3;
          g.positions.push(v[p], v[p + 1], v[p + 2]);
          if (ni !== null && ni !== undefined && vn.length) {
            const q = (ni < 0 ? vn.length / 3 + ni : ni - 1) * 3;
            g.normals.push(vn[q], vn[q + 1], vn[q + 2]);
          }
        }
    }
  }
  return [...out.values()].filter((g) => g.positions.length).map((g) => ({ material: g.material, positions: new Float32Array(g.positions), normals: g.normals.length === g.positions.length ? new Float32Array(g.normals) : null }));
}

// An OBJ (and its MTL's colours) as a document
function readObj(file, colours = {}) {
  const kd = {};
  let cur = null;
  const mtl = file.replace(/\.obj$/i, '.mtl');
  if (existsSync(mtl))
    for (const line of readFileSync(mtl, 'utf8').split('\n')) {
      const [k, ...v] = line.trim().split(/\s+/);
      if (k === 'newmtl') cur = v.join(' ');
      else if (k === 'Kd' && cur) kd[cur] = v.map(Number);
    }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh(file.split('/').pop());
  doc.createScene().addChild(doc.createNode('model').setMesh(mesh));
  for (const g of parseObj(readFileSync(file, 'utf8'))) {
    const own = colours[baseName(g.material)];
    const material = doc.createMaterial(g.material).setBaseColorFactor([...(own ? hexLinear(own) : (kd[g.material] ?? [0.64, 0.64, 0.64])), 1]).setRoughnessFactor(0.85).setMetallicFactor(0);
    const prim = doc.createPrimitive().setMaterial(material).setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.positions).setBuffer(buffer));
    if (g.normals) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.normals).setBuffer(buffer));
    mesh.addPrimitive(prim);
  }
  return doc;
}

const QUIET = new Logger(Logger.Verbosity.ERROR);

// The first packs folder with a pack's file
function find(roots, pack, file) {
  for (const r of roots) {
    const p = joinPath(r, PACKS[pack].dir, file);
    if (existsSync(p)) return p;
  }
  throw new Error(`no ${PACKS[pack].dir}/${file} under ${roots.join(' or ')}: set QUATERNIUS to the packs (docs/assets/quaternius.md)`);
}

// One model, read and brought into the site's frame, alone in its document
async function prepareModel(io, roots, pack, name, model, colours) {
  const file = find(roots, pack, model.file);
  const doc = file.endsWith('.obj') ? readObj(file, colours) : await io.read(file);
  doc.setLogger(QUIET);
  const root = doc.getRoot();
  await doc.transform(dedup(), prune());
  // (an atlas of flat colours, the space kit's: into the vertices, the texture gone)
  if (model.palette) await paletteToColours(doc);
  // (a vertex colour that's white everywhere does nothing but cost bytes;
  // one that's shade, `ao`, lightened toward white by as much as asked)
  for (const p of prims(doc)) {
    const c = p.getAttribute('COLOR_0');
    if (!c) continue;
    const v = [];
    let white = true;
    for (let i = 0; i < c.getCount() && white; i++) {
      c.getElement(i, v);
      if (v.slice(0, 3).some((x) => x < 0.995)) white = false;
    }
    if (white) p.setAttribute('COLOR_0', null);
    else if (model.ao !== undefined) {
      const lifted = new Float32Array(c.getCount() * 3);
      for (let i = 0; i < c.getCount(); i++) {
        c.getElement(i, v);
        for (let k = 0; k < 3; k++) lifted[i * 3 + k] = 1 - model.ao * (1 - v[k]);
      }
      p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(lifted).setBuffer(root.listBuffers()[0]));
    }
  }
  for (const m of root.listMaterials()) {
    const swap = model.maps?.[baseName(m.getName())];
    if (swap) {
      const tex = doc.createTexture(swap.replace(/\.\w+$/, '')).setImage(readFileSync(joinPath(dirname(file), swap))).setMimeType('image/png').setURI(swap);
      m.setBaseColorTexture(tex).setName(model.as ?? `${m.getName()}_${swap}`);
    }
    const fix = materialFix({ name: m.getName(), alphaMode: m.getAlphaMode(), cutoff: m.getAlphaCutoff() });
    m.setAlphaMode(fix.alphaMode).setDoubleSided(fix.doubleSided);
    // (a card's lit the same from either side: landings/models.js reads this)
    if (fix.doubleSided) m.setExtras({ ...m.getExtras(), foliage: true });
    if (fix.cutoff !== null) m.setAlphaCutoff(fix.cutoff);
    m.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
    m.setMetallicFactor(0);
  }
  // baked: each node's place into its mesh, then scaled to its metres, its
  // lowest point on y = 0 and its middle over the origin
  await bake(doc);
  // (turned about the upright, so its front is +z: the way a landing faces things to you)
  if (model.turn) for (const mesh of root.listMeshes()) transformMesh(mesh, [Math.cos(model.turn), 0, -Math.sin(model.turn), 0, 0, 1, 0, 0, Math.sin(model.turn), 0, Math.cos(model.turn), 0, 0, 0, 0, 1]);
  const pts = worldPoints(doc);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pts.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], pts[i + k]);
      hi[k] = Math.max(hi[k], pts[i + k]);
    }
  const size = hi.map((v, k) => v - lo[k]);
  const { tall, long, wide } = model.metres ?? {};
  const s = tall ? tall / size[1] : long || wide ? (long ?? wide) / Math.max(size[0], size[2]) : 1;
  const [tx, ty, tz] = [(-s * (lo[0] + hi[0])) / 2, -s * lo[1], (-s * (lo[2] + hi[2])) / 2];
  for (const mesh of root.listMeshes()) transformMesh(mesh, [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, tx, ty, tz, 1]);
  await doc.transform(join({ keepNamed: false }), weld());
  if (model.tris && triangles(doc) > model.tris * 1.1) {
    await MeshoptSimplifier.ready;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: model.tris / triangles(doc), error: 0.01 }));
  }
  // one node, named for the model, holding it (or holding the nodes that do)
  const scene = root.listScenes()[0];
  const holders = root.listNodes().filter((n) => n.getMesh());
  const top = holders.length === 1 ? holders[0].setName(name) : doc.createNode(name);
  if (holders.length !== 1) for (const n of holders) top.addChild(n);
  for (const c of scene.listChildren()) if (c !== top) scene.removeChild(c);
  if (!scene.listChildren().includes(top)) scene.addChild(top);
  await doc.transform(prune());
  const points = worldPoints(doc);
  return { doc, file, points, size: size.map((v) => v * s), source: { tris: triangles(doc), size } };
}

// the space kit's atlas: each vertex the colour of the atlas under its UV
async function paletteToColours(doc) {
  const sharp = (await import('sharp')).default;
  const buffer = doc.getRoot().listBuffers()[0];
  const read = new Map();
  for (const p of prims(doc)) {
    const mat = p.getMaterial();
    const tex = mat?.getBaseColorTexture();
    const uv = p.getAttribute('TEXCOORD_0');
    if (!tex || !uv) continue;
    if (!read.has(tex)) read.set(tex, await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
    const { data, info } = read.get(tex);
    const n = uv.getCount();
    const col = new Float32Array(n * 3);
    const t = [0, 0];
    for (let i = 0; i < n; i++) {
      uv.getElement(i, t);
      const x = Math.min(info.width - 1, Math.max(0, Math.floor((((t[0] % 1) + 1) % 1) * info.width)));
      const y = Math.min(info.height - 1, Math.max(0, Math.floor((((t[1] % 1) + 1) % 1) * info.height)));
      const k = (y * info.width + x) * 4;
      for (let c = 0; c < 3; c++) col[i * 3 + c] = linear(data[k + c] / 255);
    }
    p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(col).setBuffer(buffer));
    p.setAttribute('TEXCOORD_0', null);
    mat.setBaseColorTexture(null).setRoughnessFactor(0.7);
  }
  await doc.transform(prune());
}

// Each node's place baked into its mesh, every node then where its parent
// is: a mesh two nodes share (a linked duplicate's) copied for each first,
// or it'd be moved by both and drawn twice in one place
export async function bake(doc) {
  const root = doc.getRoot();
  await doc.transform(flatten());
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (mesh && mesh.listParents().filter((p) => p instanceof Node).length > 1) node.setMesh(mesh.clone());
  }
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (mesh) transformMesh(mesh, node.getWorldMatrix());
  }
  for (const node of root.listNodes()) node.setMatrix(IDENTITY);
}

// Every colour map as WebP: a cut-out one (a card's) at most 512 pixels a
// side, its colour pushed out under the cut, its alpha kept; an opaque one
// at most `opaque`, no alpha
async function compressTextures(doc, { opaque = 256 } = {}) {
  const sharp = (await import('sharp')).default;
  const root = doc.getRoot();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const cut = new Set(root.listMaterials().filter((m) => m.getAlphaMode() !== 'OPAQUE').map((m) => m.getBaseColorTexture()).filter(Boolean));
  for (const tex of root.listTextures()) {
    const alpha = cut.has(tex);
    const px = alpha ? 512 : opaque;
    let img = sharp(Buffer.from(tex.getImage())).resize(px, px, { fit: 'inside', withoutEnlargement: true });
    let out;
    if (alpha) {
      const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      dilate(data, info.width, info.height);
      // (as it is, not premultiplied: the resize's `info` says it was, and
      // read so it'd be divided by its alpha, blacking the colour under the cut)
      out = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).webp({ quality: 85, alphaQuality: 90, exact: true }).toBuffer();
    } else out = await img.removeAlpha().webp({ quality: 82 }).toBuffer();
    const name = (tex.getName() || tex.getURI().split('/').pop()).replace(/\.\w+$/, '');
    tex.setImage(out).setMimeType('image/webp').setURI(`${name}.webp`).setName(name);
  }
}

// A written GLB, summed up as problems() reads it
export async function summary(io, path) {
  const sharp = (await import('sharp')).default;
  const doc = await io.read(path);
  const root = doc.getRoot();
  const textures = [];
  for (const t of root.listTextures()) {
    const meta = await sharp(Buffer.from(t.getImage())).metadata();
    textures.push({ name: t.getName(), width: meta.width, height: meta.height, mime: t.getMimeType() });
  }
  const materials = root.listMaterials().map((m) => ({ name: m.getName(), alphaMode: m.getAlphaMode(), doubleSided: m.getDoubleSided() }));
  // each model's own: its node's triangles, and its lowest point
  const models = {};
  for (const node of root.listScenes()[0].listChildren()) {
    let tris = 0;
    let minY = Infinity;
    const v = [0, 0, 0];
    node.traverse((n) => {
      const mesh = n.getMesh();
      if (!mesh) return;
      const m = n.getWorldMatrix();
      for (const p of mesh.listPrimitives()) {
        tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
        const a = p.getAttribute('POSITION');
        for (let i = 0; i < a.getCount(); i++) {
          a.getElement(i, v);
          minY = Math.min(minY, m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]);
        }
      }
    });
    const used = new Set();
    node.traverse((n) => n.getMesh()?.listPrimitives().forEach((p) => used.add(p.getMaterial())));
    const mats = [...used].filter(Boolean);
    const texs = new Set(mats.map((m) => m.getBaseColorTexture()).filter(Boolean));
    models[node.getName()] = { tris, minY, materials: materials.filter((m) => mats.some((x) => x.getName() === m.name)), textures: textures.filter((t) => [...texs].some((x) => x.getName() === t.name)), draws: mats.length };
  }
  return { bytes: (await stat(path)).size, textures, materials, models };
}

export async function makeIo() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(QUIET).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

async function main() {
  const roots = (process.env.QUATERNIUS ?? joinPath(ROOT, '..', 'tilakverse-assets', 'quaternius')).split(':').filter(Boolean);
  const only = process.argv.slice(2);
  const io = await makeIo();
  const manifestFile = joinPath(ROOT, 'public', OUT, 'manifest.json');
  const creditsFile = joinPath(ROOT, 'public', 'games', 'credits.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(await readFile(manifestFile, 'utf8')) : {};
  const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
  const rows = [];
  for (const [kitName, kit] of Object.entries(KITS)) {
    if (only.length && !only.includes(kitName)) continue;
    const url = `/${OUT}/${kitName}.glb`;
    let doc = null;
    const made = {};
    for (const [name, model] of Object.entries(kit.models)) {
      const got = await prepareModel(io, roots, kit.pack, name, model, kit.colours);
      made[name] = got;
      if (!doc) doc = got.doc;
      else {
        const map = mergeDocuments(doc, got.doc);
        const scene = doc.getRoot().listScenes()[0];
        const theirs = map.get(got.doc.getRoot().listScenes()[0]);
        for (const c of theirs.listChildren()) scene.addChild(c);
        theirs.dispose();
      }
    }
    await doc.transform(dedup(), unpartition(), prune());
    await compressTextures(doc, { opaque: kit.opaque ?? 256 });
    await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const path = joinPath(ROOT, 'public', OUT, `${kitName}.glb`);
    await mkdir(dirname(path), { recursive: true });
    await io.write(path, doc);
    const sum = await summary(io, path);
    const budget = kitBudget(kit);
    if (sum.bytes > budget.bytes) throw new Error(`${kitName}: ${sum.bytes} bytes, over its ${budget.bytes}`);
    for (const [name, model] of Object.entries(kit.models)) {
      const own = sum.models[name];
      const wrong = problems(model, own);
      if (wrong.length) throw new Error(`${kitName} ${name}: ${wrong.join('; ')}`);
      const c = colliderOf(made[name].points);
      manifest[name] = {
        url,
        node: name,
        pack: kit.pack,
        file: model.file,
        kind: model.kind,
        metres: made[name].size.map((v) => Math.round(v * 1000) / 1000),
        tris: own.tris,
        draws: own.draws,
        radius: c.radius,
        collider: { half: c.half, mid: c.mid, hull: c.hull },
        ...(model.body ? { body: model.body } : {}),
      };
      credits[`quaternius/${name}`] = creditOf(kit.pack, model.file, url);
      rows.push(`${kitName.padEnd(18)} ${name.padEnd(20)} ${String(own.tris).padStart(6)} tris ${own.draws} draw(s) ${manifest[name].metres.map((v) => v.toFixed(2)).join(' × ')} m`);
    }
    rows.push(`${kitName.padEnd(18)} ${'(kit)'.padEnd(20)} ${(sum.bytes / 1024).toFixed(1)} KB, ${sum.textures.map((t) => `${t.name} ${t.width}`).join(', ') || 'no textures'}`);
  }
  // (a model no kit has any more: out of the manifest and the credits)
  const kept = new Set(Object.values(KITS).flatMap((k) => Object.keys(k.models)));
  for (const name of Object.keys(manifest)) if (!kept.has(name)) delete manifest[name];
  for (const key of Object.keys(credits)) if (key.startsWith('quaternius/') && !kept.has(key.slice('quaternius/'.length))) delete credits[key];
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  // (a model a line)
  await writeFile(manifestFile, `{\n${Object.entries(sorted).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`);
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
  console.log(rows.join('\n'));
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
