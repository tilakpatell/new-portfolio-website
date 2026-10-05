// Brings the wardrobe's gear that's someone else's model into the site:
// Rick's portal gun, which Bob.Ho made far better than the site could in
// code (CC BY 4.0). Each is downloaded with the site owner's Sketchfab
// token (SKETCHFAB_API_TOKEN, never kept), its specular-glossiness materials
// made metal-roughness, its parts that share a material merged, its maps
// WebPs at a set size, the whole of it meshopt-compressed; and then set in
// a frame the wardrobe can hold it by: turned so its front points along −z
// and its top along +y, `length` long front to back, and centred, so
// wardrobe/gear.js puts it in a hand with a position and nothing else.
// It's written to public/models/wardrobe/<kind>.glb, and who made it, its
// licence and where it came from go into src/data/modelCredits.json (as
// `wardrobe-<kind>`).
//
//   SKETCHFAB_API_TOKEN=… NODE_USE_ENV_PROXY=1 node scripts/sketchfab-gear.mjs [kind …]
//
// The downloads stay out of the repo, in /tmp/sketchfab-gear/.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join as path } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'wardrobe');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const CACHE = '/tmp/sketchfab-gear';
const API = 'https://api.sketchfab.com/v3/models';
const token = process.env.SKETCHFAB_API_TOKEN;
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0' };

// kind → { uid, as (what it is, for the credits), turn: [x, y, z] radians
// that bring its front to −z and its top to +y, length, tex }
export const GEAR = {
  portalgun: { uid: 'c5f7b4a950de4002b448ac65c6b0207b', as: 'Rick’s portal gun, in the wardrobe', turn: [0, -Math.PI / 2, 0], length: 1, tex: 512 },
};

const json = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

async function download(kind, uid) {
  const file = path(CACHE, `${kind}-${uid}.glb`);
  if (existsSync(file)) return file;
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set');
  const { glb } = await json(`${API}/${uid}/download`, { Authorization: `Token ${token}` });
  if (!glb?.url) throw new Error(`${kind}: no .glb to download`);
  const r = await fetch(glb.url);
  if (!r.ok) throw new Error(`${kind}: download ${r.status}`);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

async function credit(kind, uid, as) {
  const m = await json(`${API}/${uid}`);
  const license = LICENCES[m.license?.slug];
  if (!license) throw new Error(`${kind}: its licence (${m.license?.label}) isn't one the site can use`);
  return { title: m.name, author: m.user.displayName || m.user.username, authorUrl: m.user.profileUrl, license, licenseUrl: m.license.url, source: m.viewerUrl, where: 'c-137', as, file: `/models/wardrobe/${kind}.glb` };
}

// the bounds of every mesh in the scene, in world space: [min, max]
function bounds(scene) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const v = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        for (let k = 0; k < 3; k++) {
          const w = m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k];
          min[k] = Math.min(min[k], w);
          max[k] = Math.max(max[k], w);
        }
      }
    }
  });
  return [min, max];
}

// a quaternion from x, y, z turns (in that order, as three.js's 'XYZ')
function quat([x, y, z]) {
  const [c1, c2, c3] = [Math.cos(x / 2), Math.cos(y / 2), Math.cos(z / 2)];
  const [s1, s2, s3] = [Math.sin(x / 2), Math.sin(y / 2), Math.sin(z / 2)];
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

async function bring(io, kind, spec) {
  const doc = await io.read(await download(kind, spec.uid));
  await doc.transform(metalRough(), flatten(), join(), weld(), dedup(), prune());
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  // everything under one holder that turns it, sizes it and centres it
  const holder = doc.createNode(kind).setRotation(quat(spec.turn));
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    holder.addChild(child);
  }
  scene.addChild(holder);
  const [min, max] = bounds(scene);
  const k = spec.length / (max[2] - min[2]);
  holder.setScale([k, k, k]);
  const [a, b] = bounds(scene);
  holder.setTranslation([-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2, -(a[2] + b[2]) / 2]);
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex, spec.tex] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(OUT, { recursive: true });
  await io.write(path(OUT, `${kind}.glb`), doc);
  const [c, d] = bounds(scene);
  console.log(`${kind}: ${(d[0] - c[0]).toFixed(3)} × ${(d[1] - c[1]).toFixed(3)} × ${(d[2] - c[2]).toFixed(3)}`);
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const kinds = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GEAR);
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  for (const kind of kinds) {
    const spec = GEAR[kind];
    if (!spec) throw new Error(`unknown gear ${kind}`);
    await bring(io, kind, spec);
    credits[`wardrobe-${kind}`] = await credit(kind, spec.uid, spec.as);
  }
  await writeFile(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
