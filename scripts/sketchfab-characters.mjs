// The rigged characters downloaded from Sketchfab (CC Attribution), brought
// to web size with their skeletons whole: the Invincible page's Omni-Man and
// Thragg, and Avengers HQ's Spider-Man. Each keeps its skin and bones (the
// games pose them), loses what came along with the download (empty lights
// and cameras, a stray mesh of one point, an invisible helper), and has its
// textures turned to WebP: the colour at full size, so they stay sharp up
// close, the normal maps a size down. Then Meshopt. Who made each, its
// licence and its source are read out of the file and go into
// src/data/modelCredits.json, which the pages show.
//
//   node scripts/sketchfab-characters.mjs <folder of downloads> [name …]
//
// The folder holds each download as <name>.glb (omni-man.glb, thragg.glb,
// spiderman.glb). Nothing here talks to Sketchfab: the downloads are the
// site owner's.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, metalRough, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREDITS = join(ROOT, 'src', 'data', 'modelCredits.json');

// out: under public/; color, maps: texture sizes; clip: keep the first
// animation (Omni-Man's idle), else every clip goes; where, as: for the
// credits (the page, and what the model is there)
export const CHARACTERS = {
  'omni-man': { out: 'models/invincible/omni-man.glb', color: 2048, maps: 1024, clip: true, where: 'invincible', as: 'Omni-Man' },
  thragg: { out: 'models/invincible/thragg.glb', color: 2048, maps: 1024, clip: false, where: 'invincible', as: 'Thragg' },
  spiderman: { out: 'models/marvel/spiderman.glb', color: 2048, maps: 1024, clip: false, where: 'avengers', as: 'Spider-Man' },
};

// The extras Sketchfab writes into every download: "Name (https://sketchfab.com/user)"
const credit = (asset, c) => {
  const x = asset.extras ?? {};
  const [, author = x.author ?? 'unknown', authorUrl = ''] = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(x.author ?? '') ?? [];
  const [, license = x.license ?? '', licenseUrl = ''] = /^(.*?)\s*\((https?:[^)]+)\)\s*$/.exec(x.license ?? '') ?? [];
  return { title: x.title ?? c.as, author, authorUrl, license, licenseUrl, source: x.source ?? '', where: c.where, as: c.as, file: `/${c.out}` };
};

// a mesh whose points all sit within a millimetre (of the model's own size) of each other
function degenerate(mesh) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const lo = pos.getMin([]);
    const hi = pos.getMax([]);
    if (Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) > 0.05) return false;
  }
  return true;
}

async function main() {
  const [dir, ...only] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node scripts/sketchfab-characters.mjs <folder of downloads> [name …]');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  for (const [name, c] of Object.entries(CHARACTERS)) {
    if (only.length && !only.includes(name)) continue;
    const from = join(dir, `${name}.glb`);
    if (!existsSync(from)) {
      console.log(`skip     ${name} (no ${name}.glb in ${dir})`);
      continue;
    }
    const doc = await io.read(from);
    const root = doc.getRoot();
    const asset = root.getAsset();
    // what came along with the download
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const helper = mesh.listPrimitives().every((p) => /^transparent$/i.test(p.getMaterial()?.getName() ?? ''));
      if (helper || degenerate(mesh)) {
        node.setMesh(null);
        node.setSkin(null);
      }
    }
    const clips = root.listAnimations();
    clips.forEach((a, i) => {
      if (c.clip && i === 0) {
        a.setName('idle');
        return;
      }
      for (const part of [...a.listChannels(), ...a.listSamplers()]) part.dispose();
      a.dispose();
    });
    await doc.transform(
      dedup(),
      metalRough(),
      prune({ keepLeaves: false }),
      resample(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [c.color, c.color], quality: 86 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness/, resize: [c.maps, c.maps], quality: 86 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const to = join(ROOT, 'public', c.out);
    await mkdir(dirname(to), { recursive: true });
    await io.write(to, doc);
    const tris = root
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
    const before = (await stat(from)).size;
    const after = (await stat(to)).size;
    credits[name] = credit(asset, c);
    console.log(`${name.padEnd(9)} ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(2)} MB, ${Math.round(tris)} triangles, ${root.listAnimations().length} clip(s), ${root.listTextures().length} texture(s), by ${credits[name].author}`);
  }
  const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
