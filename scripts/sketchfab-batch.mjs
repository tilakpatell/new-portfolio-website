// Brings a set of models downloaded from Sketchfab into the site, each to
// what it's seen at: its materials' colours packed onto one sheet and its
// parts merged into one mesh (so it's one draw and one texture, like the
// site's own Meshy models), simplified to a triangle budget, the sheet a WebP
// at a set size, meshopt-compressed, into public/models/sketchfab/. Who made each one, its
// licence and where it came from are read out of the download itself
// (Sketchfab writes them into the file) and kept in src/data/modelCredits.json,
// which the pages show (components/ModelCredits.jsx). The downloads stay out
// of the repo. (The same file also credits the universe map's Star Wars
// models, which scripts/build-universe.py makes: those entries carry their
// own `file`, are written by hand, and are left as they are here.)
//
// A model for the Middle-earth map is kept as its shape alone (`bare`): the
// map's toys are plain colours, flat-shaded, and the map gives it its colour.
//
// (scripts/sketchfab-import.mjs does one model at a time, stood on the ground
// at a size in metres, for the worlds you walk and drive in; this one is for
// the models seen small, and keeps the credits.)
//
//   node scripts/sketchfab-batch.mjs <folder of .glb downloads> [name …]

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, dequantize, flatten, join, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { Euler, Quaternion } from 'three';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join as path } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'sketchfab');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');

// name → from: the download's file name; tris: triangles to keep; tex: the
// sheet's size, or bare: its shape alone; seams and error: for the simplifier
// (below); turn: degrees about x, y and z, to stand it the way the model it
// takes over from stood; where: the page that shows it; as: what it is there
// (both for the credits)
export const MODELS = {
  // the universe map: what stands by its planet, a few dozen pixels across
  sitar: { from: 'classical-musical-instrument-sitar', tris: 9000, tex: 512, seams: true, turn: [0, 0, -57], where: 'universe', as: 'the sitar by the music planet' },
  // the Middle-earth map: toys a few units tall, which you can zoom in on
  'minas-tirith': { from: 'minas-tirith-remake', tris: 14000, bare: true, where: 'middle-earth', as: 'Minas Tirith' },
  orthanc: { from: 'isengard', tris: 6000, bare: true, where: 'middle-earth', as: 'Orthanc' },
};

const split = (s = '') => {
  const m = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(s);
  return m ? [m[1], m[2]] : [s, null];
};

// The simplifier, on the merged mesh. It drops loose pieces too small to see
// at the size kept ('Prune'), and for a model cut into many pieces along its
// UV seams, which otherwise stops well short of its budget, it may fold
// across the seams ('Permissive': `seams` in MODELS).
const simplified = (tris, error, seams) => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const all = prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()), 0) / 3;
  for (const prim of prims) {
    const pos = prim.getAttribute('POSITION');
    const index = prim.getIndices();
    const indices = index ? new Uint32Array(index.getArray()) : Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
    const target = Math.floor((indices.length * Math.min(1, tris / all)) / 3) * 3;
    const [kept] = MeshoptSimplifier.simplify(indices, new Float32Array(pos.getArray()), 3, target, error, seams ? ['Prune', 'Permissive'] : ['Prune']);
    prim.setIndices(doc.createAccessor().setArray(kept).setBuffer(buffer));
    compactPrimitive(prim);
  }
};

// Its shape alone: no materials, no UVs, no normals (flat shading works them
// out from the faces).
const bare = () => (doc) => {
  const root = doc.getRoot();
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      for (const name of prim.listSemantics()) if (name !== 'POSITION') prim.setAttribute(name, null);
      prim.setMaterial(null);
    }
  for (const m of root.listMaterials()) m.dispose();
};

// One sheet for the whole model: each material's colour map (or its plain
// colour) in its own square, every corner's UV moved into its square, and
// one material over all of it. Only the colour is kept: at these sizes the
// normal and roughness maps don't show. A map that's tiled over its parts
// (its UVs run well past 0 to 1) can't sit in a square, so it gives its
// average colour instead. A decal drawn with blending has nothing under it
// on the sheet, so it's left off.
const onOneSheet = (size, gutter = 4) => async (doc) => {
  const root = doc.getRoot();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMaterial()?.getAlphaMode() === 'BLEND') prim.dispose();
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
  const mats = [...new Set(prims.map((p) => p.getMaterial()))];
  // tiled: more than a twentieth of its corners outside the square
  const tiled = mats.map((m) => {
    let out = 0;
    let total = 0;
    for (const p of prims) {
      const uv = p.getMaterial() === m && p.getAttribute('TEXCOORD_0')?.getArray();
      if (!uv) continue;
      total += uv.length / 2;
      for (let k = 0; k < uv.length; k += 2) if (uv[k] < -0.01 || uv[k] > 1.01 || uv[k + 1] < -0.01 || uv[k + 1] > 1.01) out++;
    }
    return total > 0 && out / total > 0.05;
  });
  const n = Math.ceil(Math.sqrt(mats.length));
  const cell = Math.floor(size / n);
  const inner = cell - gutter * 2;
  const srgb = (v) => Math.min(1, Math.max(0, v)) ** (1 / 2.2);
  const squares = await Promise.all(
    mats.map(async (m, i) => {
      const f = (m?.getBaseColorFactor() ?? [1, 1, 1, 1]).slice(0, 3).map(srgb);
      const map = m?.getBaseColorTexture();
      const plain = (c) => sharp({ create: { width: inner, height: inner, channels: 3, background: { r: c[0] * f[0], g: c[1] * f[1], b: c[2] * f[2] } } });
      const img = !map
        ? plain([255, 255, 255])
        : tiled[i]
          ? plain((await sharp(Buffer.from(map.getImage())).removeAlpha().stats()).channels.map((c) => c.mean))
          : sharp(Buffer.from(map.getImage())).resize(inner, inner, { fit: 'fill' }).removeAlpha().linear(f, [0, 0, 0]);
      // its own edge colour round it, so the smaller mip levels don't pull in the neighbours
      const input = await img.extend({ top: gutter, bottom: gutter, left: gutter, right: gutter, extendWith: 'copy' }).png().toBuffer();
      return { input, left: (i % n) * cell, top: Math.floor(i / n) * cell };
    }),
  );
  const sheet = await sharp({ create: { width: size, height: size, channels: 3, background: '#808080' } }).composite(squares).png().toBuffer();
  const one = doc
    .createMaterial('sheet')
    .setBaseColorTexture(doc.createTexture('sheet').setImage(sheet).setMimeType('image/png'))
    .setRoughnessFactor(0.75)
    .setMetallicFactor(0)
    .setDoubleSided(mats.some((m) => m?.getDoubleSided()));
  const buffer = root.listBuffers()[0];
  let wrapped = 0;
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const i = mats.indexOf(prim.getMaterial());
      const count = prim.getAttribute('POSITION').getCount();
      const from = tiled[i] ? null : prim.getAttribute('TEXCOORD_0')?.getArray();
      const uv = new Float32Array(count * 2);
      const into = (v) => (v >= 0 && v <= 1 ? v : (wrapped++, v - Math.floor(v)));
      for (let k = 0; k < count; k++) {
        uv[k * 2] = ((i % n) * cell + gutter + (from ? into(from[k * 2]) : 0.5) * inner) / size;
        uv[k * 2 + 1] = (Math.floor(i / n) * cell + gutter + (from ? into(from[k * 2 + 1]) : 0.5) * inner) / size;
      }
      for (const name of prim.listSemantics()) if (/^(TEXCOORD_[1-9]|COLOR_|TANGENT)/.test(name)) prim.setAttribute(name, null);
      prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer)).setMaterial(one);
    }
  if (wrapped) console.log(`  (${wrapped} corners had a UV outside the square, wrapped into it)`);
  if (tiled.some(Boolean)) console.log(`  (tiled, so plain: ${mats.filter((_, i) => tiled[i]).map((m) => m.getName()).join(', ')})`);
};

async function main() {
  const [dir, ...only] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node scripts/sketchfab-batch.mjs <folder> [name …]');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(OUT, { recursive: true });
  const credits = existsSync(CREDITS) ? JSON.parse(await readFile(CREDITS, 'utf8')) : {};
  for (const name of only.length ? only : Object.keys(MODELS)) {
    const spec = MODELS[name];
    const src = spec && path(dir, `${spec.from}.glb`);
    if (!spec || !existsSync(src)) throw new Error(`no ${name} (in MODELS, and ${src})`);
    const doc = await io.read(src);
    const root = doc.getRoot();
    const made = root.getAsset().extras ?? {};
    if (!made.source || !made.author || !made.license) throw new Error(`${name}: the download doesn't say who made it`);
    const count = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
    const before = count();
    if (spec.turn) {
      const q = new Quaternion().setFromEuler(new Euler(...spec.turn.map((d) => (d * Math.PI) / 180)));
      const turned = doc.createNode('turned').setRotation([q.x, q.y, q.z, q.w]);
      for (const scene of root.listScenes()) {
        for (const child of scene.listChildren()) turned.addChild(child);
        scene.addChild(turned);
      }
    }
    const steps = [dequantize(), flatten(), spec.bare ? bare() : onOneSheet(spec.tex), prune(), join({ keepNamed: false }), weld()];
    if (before > spec.tris) steps.push(simplified(spec.tris, spec.error ?? 0.01, spec.seams));
    steps.push(dedup(), prune());
    if (root.listTextures().length) steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex, spec.tex], quality: 85 }));
    steps.push(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    await doc.transform(...steps);
    const out = path(OUT, `${name}.glb`);
    await io.write(out, doc);
    const [author, authorUrl] = split(made.author);
    const [license, licenseUrl] = split(made.license);
    credits[name] = { title: made.title, author, authorUrl, license, licenseUrl, source: made.source, where: spec.where, as: spec.as };
    const draws = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
    console.log(`${name.padEnd(18)} ${Math.round(before)} → ${Math.round(count())} triangles, ${draws} draws, ${((await readFile(out)).length / 1024).toFixed(0)} KB`);
  }
  const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
