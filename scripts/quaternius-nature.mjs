// Quaternius's Stylized Nature MegaKit (CC0), cut down for the galaxy's
// worlds: each kind in src/components/galaxy/surface/catalog/nature.js read
// from the pack's glTF and written to public/models/galaxy/surface/<kind>.glb
// (and, for a tree, its far-off light copy, <kind>.lod1.glb).
//
//   node scripts/quaternius-nature.mjs                  every kind in the catalogue
//   node scripts/quaternius-nature.mjs nkbirch1 nkfern1 just these
//   node scripts/quaternius-nature.mjs --from <dir>     the pack's glTF folder
//   node scripts/quaternius-nature.mjs --credits        only the credits
//
// Without --from, the pack is looked for where scripts/quaternius.mjs (the
// planet landings' kits) looks first: the folders $QUATERNIUS lists (':'
// between), then the asset repo cloned beside this one; then a clone in the
// system's temp folder, then lab/assets/naturemega (where
// `node scripts/assets-fetch.mjs naturemega` puts it). Every run writes the
// kinds' credits to public/games/credits.json, one a kind, as the landings'
// models have theirs (`quaternius-galaxy/<kind>`: the landings' script keeps
// only its own `quaternius/` ones).
//
// The landings' kits (public/models/quaternius/) are files of a family, a
// model a node, sized for a landing and given colliders; these are the
// galaxy catalogue's, a kind a file, at the pack's own size, with a light
// copy for each tree. About ten of the pack's models are in both.
//
// What it does to each one:
//   - stands it on y = 0, its x and z left as the pack has them (the foot of
//     a tree's trunk at the origin, where the placer puts its solid)
//   - turns the pack's vertex colours, which are masks for its own shader (0
//     at a blade's root to 1 at its tip), into a grey that darkens what's
//     low down, as the light under a plant is; every part gets one, so
//     materials shared by name always have them
//   - gives the leaves the pack's grey cut-outs and a colour of their own
//     (NATURE_COLOURS), cut out at 0.35 and never blended; what's solid
//     opaque and one-sided
//   - its pictures WebP at the entry's `tex`, welded, cut to `tris` where
//     the entry has one, meshopt-compressed

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { MODELS, NATURE_COLOURS } from '../src/components/galaxy/surface/catalog/nature.js';
import { bounds, dims, simplified, triangles } from './lib/surface-model.mjs';
import { makeLod } from './galaxy-surface-lod.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'surface');
const MEGAKIT = join('stylized-nature-megakit', 'glTF');
// where the pack's glTF may be, first found first
export const packRoots = (env = process.env, root = ROOT, tmp = tmpdir()) => [
  ...(env.QUATERNIUS ?? join(root, '..', 'tilakverse-assets', 'quaternius')).split(':').filter(Boolean).map((d) => join(d, MEGAKIT)),
  join(tmp, 'tilakverse-assets', 'quaternius', MEGAKIT),
  join(root, 'lab', 'assets', 'naturemega', 'glTF'),
];

// A kind's credit, as public/games/credits.json has the landings' models
// (scripts/quaternius.mjs's creditOf); the credits' audit finds its file by
// the key's name (scripts/ai-e2e/assets/credits.mjs), so its text never
// names a public/ folder, which it would take for the whole folder
export const CREDIT = (kind) => `quaternius-galaxy/${kind}`;
export const galaxyCredit = (kind, m) => ({
  source: 'https://quaternius.com',
  id: m.from,
  name: `Stylized Nature MegaKit: ${m.from}`,
  authors: ['Quaternius'],
  license: 'CC0 1.0',
  use: `On the galaxy's green worlds as the surface kind ${kind} (src/components/galaxy/surface/catalog/nature.js, scripts/quaternius-nature.mjs)`,
});
function writeCredits() {
  const file = join(ROOT, 'public', 'games', 'credits.json');
  const credits = JSON.parse(readFileSync(file, 'utf8'));
  // (each kept where it is; a kind no longer in the catalogue dropped)
  for (const key of Object.keys(credits)) if (key.startsWith(CREDIT('')) && !MODELS[key.slice(CREDIT('').length)]) delete credits[key];
  for (const [kind, m] of Object.entries(MODELS)) credits[CREDIT(kind)] = galaxyCredit(kind, m);
  writeFileSync(file, `${JSON.stringify(credits, null, 2)}\n`);
}

// a material's family, by the pack's names for them (surface/nature.js has the same rule)
export const familyOf = (name) =>
  name === 'Grass' ? 'grass' : name === 'Leaves' ? 'plant' : name === 'Flowers' ? 'flowers' : name.startsWith('Leaves_') || name.startsWith('Leaf_') ? 'leaves' : name.startsWith('Bark_') ? 'bark' : 'stone';

// a mask's value as the grey it's drawn with: each family's floor at 0, full at 1
const FLOOR = { grass: 0.42, plant: 0.5, bark: 0.62, flowers: 0.7 };
export const greyOf = (family, v) => (FLOOR[family] == null ? 1 : FLOOR[family] + (1 - FLOOR[family]) * Math.min(1, Math.max(0, v)));

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (hex) => [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

// stood on y = 0, its x and z where the pack has them
const standing = () => (doc) => {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min } = bounds(doc, scene);
  for (const n of scene.listChildren()) {
    const [x, y, z] = n.getTranslation();
    n.setTranslation([x, y - min[1], z]);
  }
};

// every part's COLOR_0 a grey (VEC3), from its mask where it has one
const greys = () => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const family = familyOf(p.getMaterial()?.getName() ?? '');
      const n = p.getAttribute('POSITION').getCount();
      const mask = p.getAttribute('COLOR_0');
      const out = new Float32Array(n * 3);
      const el = [];
      for (let i = 0; i < n; i++) out.fill(greyOf(family, mask ? mask.getElement(i, el)[0] : 1), i * 3, i * 3 + 3);
      if (mask) p.setAttribute('COLOR_0', null);
      p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(buffer));
    }
};

// the leaves' grey cut-outs, and the colours, the cut and the sides
const looks = (dir) => async (doc) => {
  for (const m of doc.getRoot().listMaterials()) {
    const name = m.getName();
    const family = familyOf(name);
    const tex = m.getBaseColorTexture();
    const grey = family === 'leaves' && tex?.getURI()?.replace(/_C\.png$/, '.png');
    if (grey && grey !== tex.getURI() && existsSync(join(dir, grey))) tex.setImage(await sharp(join(dir, grey)).png().toBuffer()).setMimeType('image/png').setURI(grey);
    if (NATURE_COLOURS[name]) m.setBaseColorFactor([...linear(NATURE_COLOURS[name]), 1]);
    const cut = family === 'leaves' || family === 'plant' || family === 'flowers';
    m.setAlphaMode(cut ? 'MASK' : 'OPAQUE').setAlphaCutoff(0.35);
    m.setDoubleSided(cut || family === 'grass');
    m.setRoughnessFactor(1).setMetallicFactor(0);
  }
};

const io = async () => {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
};

// one kind: read, made over, written; resolves to what it came to
export async function importOne(kind, m, dir, node) {
  const doc = await node.read(join(dir, `${m.from}.gltf`));
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const before = triangles(doc);
  await doc.transform(standing(), greys(), looks(dir), weld(), ...(m.tris ? [simplified(m.tris)] : []), dedup(), prune());
  const size = dims(doc);
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [m.tex, m.tex], quality: 82 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const to = join(OUT, `${kind}.glb`);
  await node.write(to, doc);
  const lod = m.lod ? await makeLod(to, join(OUT, `${kind}.lod1.glb`), { over: 1500 }) : null;
  return { kind, before, after: triangles(doc), size, bytes: statSync(to).size, lod };
}

async function main() {
  const args = process.argv.slice(2);
  writeCredits();
  if (args.includes('--credits')) return;
  const at = args.indexOf('--from');
  const dir = at >= 0 ? args.splice(at, 2)[1] : packRoots().find((d) => existsSync(d));
  if (!dir || !existsSync(dir)) throw new Error(`no megakit glTF folder: set QUATERNIUS to tilakverse-assets/quaternius (docs/assets/quaternius.md), or run node scripts/assets-fetch.mjs naturemega`);
  const node = await io();
  for (const [kind, m] of Object.entries(MODELS)) {
    if (args.length && !args.includes(kind)) continue;
    const r = await importOne(kind, m, dir, node);
    const lod = r.lod ? (r.lod.skipped ? '  lod: not worth one' : `  lod ${r.lod.low} tris ${(r.lod.bytes / 1024).toFixed(0)} KB`) : '';
    console.log(`${kind.padEnd(14)} ${String(r.before).padStart(6)} → ${String(r.after).padStart(6)} tris  ${r.size.map((v) => v.toFixed(1)).join('×').padEnd(14)} ${(r.bytes / 1024).toFixed(0).padStart(4)} KB${lod}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
