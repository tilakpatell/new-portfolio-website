// Brings the galaxy's Sketchfab ships into the site: each one downloaded with
// the site owner's Sketchfab token (SKETCHFAB_API_TOKEN, never kept), cut
// down to what it's seen at (a fighter a few dozen pixels across, a capital
// ship a screen wide at the most) and written to public/models/galaxy/<kind>.glb,
// where galaxy/models.js loads it in place of the ship it built in code. Its
// materials are made metal-roughness (three.js no longer reads the old
// specular-glossiness ones), its parts that share a material merged into one
// mesh (one draw each), simplified to a triangle budget, its maps WebPs at a
// set size and the whole of it meshopt-compressed. Who made each one, its
// licence and where it came from are read from Sketchfab and kept in
// src/data/modelCredits.json, which the galaxy's panel shows
// (components/ModelCredits.jsx). The downloads stay out of the repo, in
// /tmp/sketchfab-galaxy/ (fetched once, kept for the next run).
//
// (scripts/sketchfab-batch.mjs does the same for models downloaded by hand,
// packed onto one sheet; this one keeps each model's own materials.)
//
//   SKETCHFAB_API_TOKEN=… NODE_USE_ENV_PROXY=1 node scripts/sketchfab-galaxy.mjs [kind …]

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, dequantize, flatten, join, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join as path } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'galaxy');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const CACHE = '/tmp/sketchfab-galaxy';
const API = 'https://api.sketchfab.com/v3/models';

// kind (galaxy/fleet.js's name for it) → uid: the Sketchfab model; tris:
// triangles to keep; tex: its colour and glow maps' size (its other maps
// half that, or `maps`); gain: its colours brightened (a model made for
// Sketchfab's bright viewer comes out near black under one sun); drop: its
// materials to leave off, by name; as: what it is in the galaxy (for the
// credits)
// (Tried and left built: the Hammerhead corvette, 8ca35cee5f614c289a1ff069556fef98,
// a generated model that doesn't read as one; the second Death Star,
// 17ccca0dbb6b4e338fa999202f9e6685, a cage of plating all round rather than
// the half-built one; the Munificent, 966265e37e61433b919ba640a12a33f5, whose
// paint is tiled maps that don't survive, leaving it near black; Naboo's royal
// starship, f72431e7a97e4bf994dd8b1f3f288d7c, whose maps are black.)
export const MODELS = {
  // the Rebellion's
  moncal: { uid: '9b5e5e5192f64a7faad93a3bfd2efaf2', tris: 40000, tex: 1024, as: 'the Mon Calamari cruisers' },
  nebulon: { uid: '1986f7b0dee647b3b2374eb80dbd1faf', tris: 30000, tex: 1024, as: 'the Nebulon-B frigates' },
  awing: { uid: '15d7370b56c04c2e86b16e50bf931a02', tris: 13000, tex: 512, as: 'the A-wings' },
  ywing: { uid: 'b8bb6476b1b14ba48987c7efc7b7087a', tris: 14000, tex: 512, as: 'the Y-wings' },
  bwing: { uid: '08293253519a455483970295430b3a73', tris: 14000, tex: 512, as: 'the B-wings' },
  uwing: { uid: '8d7539ceba7142c2ab5ce296659c026d', tris: 14000, tex: 1024, as: 'the U-wings' },
  // the Empire's
  executor: { uid: '0e4cbb98a2ba43f2a11498061b3f21d8', tris: 50000, tex: 1024, as: 'the Executor' },
  // the Separatists'
  lucrehulk: { uid: '8bb11e0ad31e4b23b1783e10242c5115', tris: 20000, tex: 1024, as: 'the droid control ships' },
  coreship: { uid: '0d829115bb4d472da5d05cdf529b6694', tris: 20000, tex: 1024, as: 'the Separatist core ships' },
  vulture: { uid: '5542f951834e4032b229ebdee12d3310', tris: 10000, tex: 512, as: 'the vulture droids' },
  trifighter: { uid: '9c06ba9b24144221aa80f56192f485b6', tris: 10000, tex: 512, as: 'the droid tri-fighters' },
  // the Republic's
  acclamator: { uid: 'e6a2171be5c34bb68a05aba657fd8fa8', tris: 30000, tex: 1024, as: 'the Acclamators' },
  delta7: { uid: 'b4a8ad8a1e8b4e5b961cf4726d8a8646', tris: 12000, tex: 512, as: 'the Jedi starfighters' },
  arc170: { uid: 'b9407262cdf34d37b0720ca6b70469be', tris: 14000, tex: 512, as: 'the ARC-170s' },
  n1: { uid: '3cf69f6c85234aac8844e845e74ac75b', tris: 12000, tex: 512, as: 'the Naboo N-1 starfighters' },
  // the sequels'
  xyston: { uid: '8fe215c3b4154320b89ec60e6d0cd5ec', tris: 30000, tex: 1024, gain: 0.35, as: 'the Sith Star Destroyers' },
  tiefo: { uid: 'a6f29bb8f80149c5a83ca1341fc10093', tris: 10000, tex: 512, drop: /^WorldGridMaterial$/, as: 'the First Order’s TIEs' },
};

const token = process.env.SKETCHFAB_API_TOKEN;
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };

const json = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

// the download, fetched once
async function download(kind, uid) {
  const file = path(CACHE, `${kind}.glb`);
  if (existsSync(file)) return file;
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set');
  const { glb } = await json(`${API}/${uid}/download`, { Authorization: `Token ${token}` });
  if (!glb?.url) throw new Error(`${kind}: no .glb to download`);
  const r = await fetch(glb.url);
  if (!r.ok) throw new Error(`${kind}: download ${r.status}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

// who made it, from the model's public page
async function credit(kind, uid, as) {
  const m = await json(`${API}/${uid}`);
  const license = LICENCES[m.license?.slug];
  if (!license) throw new Error(`${kind}: its licence (${m.license?.label}) isn't one the site can use`);
  return {
    title: m.name,
    author: m.user.displayName || m.user.username,
    authorUrl: m.user.profileUrl,
    license,
    licenseUrl: m.license.url,
    source: m.viewerUrl,
    where: 'galaxy',
    as,
    file: `/models/galaxy/${kind}.glb`,
    also: ['galaxy'],
  };
}

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// Its materials made for the galaxy's light: nothing more than half metal (a
// fully metal hull, with only the dark sky to reflect, comes out black), its
// colours brightened by `gain`, and any material in `drop` left off with its
// parts.
const relit = ({ gain = 1, drop = null }) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (drop?.test(prim.getMaterial()?.getName() ?? '')) prim.dispose();
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.5));
    const [r, g, b, a] = m.getBaseColorFactor();
    m.setBaseColorFactor([...[r, g, b].map((c) => Math.min(1, c * gain)), a]);
  }
};

// Parts with no maps on them don't need their UVs, or their tangents: without
// them, the corners either side of a UV seam are one corner again, and the
// simplifier can fold across them.
const bareWhereUntextured = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const mapped = m && [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].some(Boolean);
      for (const name of prim.listSemantics()) if (name === 'TANGENT' || (!mapped && name.startsWith('TEXCOORD_'))) prim.setAttribute(name, null);
    }
};

// The simplifier, on each merged mesh, its share of the budget at a time,
// a step rougher each time it stops short: first keeping to the mesh's seams
// and edges, then folding across its seams ('Permissive'), and last, for a
// model built of thousands of loose pieces that won't fold at all, the sloppy
// one, which merges corners on a grid. Bits too small to see go ('Prune').
const simplified = (tris) => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const all = prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  if (all <= tris * 1.1) return;
  for (const prim of prims) {
    const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
    let indices = new Uint32Array(prim.getIndices().getArray());
    const target = Math.floor((indices.length * tris) / all / 3) * 3;
    const steps = [
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.01, ['Prune'])[0],
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.03, ['Prune', 'Permissive'])[0],
      (ix) => MeshoptSimplifier.simplifySloppy(ix, positions, 3, null, target, 0.02)[0],
    ];
    for (const step of steps) if (indices.length > target * 1.15) indices = step(indices);
    // (a part that's gone altogether)
    if (!indices.length) {
      prim.dispose();
      continue;
    }
    prim.setIndices(doc.createAccessor().setArray(indices).setBuffer(buffer));
    compactPrimitive(prim);
  }
};

async function bring(io, kind, spec) {
  const src = await download(kind, spec.uid);
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const before = triangles(doc);
  // (lines and points: nothing seen at this size)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  await doc.transform(dequantize(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  await doc.transform(simplified(spec.tris));
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps ?? spec.tex / 2, spec.maps ?? spec.tex / 2], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path(OUT, `${kind}.glb`);
  await io.write(out, doc);
  const draws = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  const bytes = (await stat(out)).size;
  console.log(`${kind.padEnd(12)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${draws} draws, ${root.listTextures().length} maps, ${(bytes / 1024).toFixed(0)} KB`);
}

async function main() {
  const only = process.argv.slice(2);
  for (const k of only) if (!MODELS[k]) throw new Error(`no ${k} in MODELS`);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  for (const kind of only.length ? only : Object.keys(MODELS)) {
    const spec = MODELS[kind];
    await bring(io, kind, spec);
    credits[`galaxy-${kind}`] = await credit(kind, spec.uid, spec.as);
  }
  const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
