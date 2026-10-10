// Brings models the site owner made in Meshy (downloaded as GLB) into the
// site: welded, simplified to a triangle budget, textures to WebP at a set
// size, meshopt-compressed, into public/models/meshy/, and credited in
// public/games/credits.json. The downloads themselves stay out of the repo.
//
//   node scripts/meshy-import.mjs <folder of .glb downloads> [--ultra] [name …]
//
// --ultra: the ultra level's cut instead, <name>.ultra.glb beside the plain
// one, from the same download (made at Meshy's most polygons, 300k, to be
// worth it): four times the triangles and 8192 maps (scripts/ultra/cut.mjs),
// under 24 MB. The credit already covers it.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUltra, takeUltra, ultraName, ultraSpec } from './ultra/cut.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'meshy');

// name → [triangles to keep, texture size, what it is]
export const MODELS = {
  'optimus-prime': [24000, 1024, 'Optimus Prime, robot mode'],
  megatron: [24000, 1024, 'Megatron, robot mode, with the fusion cannon'],
  'x-wing-fighter': [16000, 1024, 'an X-wing starfighter'],
  'slave-i': [12000, 1024, 'Slave I, Boba Fett\'s ship'],
  'republic-attack-cruiser': [12000, 1024, 'a Republic attack cruiser'],
  mario: [12000, 1024, 'Mario'],
  'piranha-plant': [8000, 512, 'a Piranha Plant in its pipe'],
};

async function main() {
  const { ultra, args } = takeUltra(process.argv.slice(2));
  const [dir, ...only] = args;
  if (!dir) throw new Error('usage: node scripts/meshy-import.mjs <folder> [name …]');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(OUT, { recursive: true });
  const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
  const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
  for (const name of only.length ? only : Object.keys(MODELS)) {
    const [plainTris, plainTex, what] = MODELS[name] ?? [];
    const { tris, tex } = ultra && plainTris ? ultraSpec({ tris: plainTris, tex: plainTex }) : { tris: plainTris, tex: plainTex };
    const src = join(dir, `${name}.glb`);
    if (!tris || !existsSync(src)) throw new Error(`no ${name} (in MODELS, and ${src})`);
    const doc = await io.read(src);
    const count = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
    const before = count();
    await doc.transform(dequantize(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, tris / before), error: 0.01, lockBorder: false }), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 85 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const out = join(OUT, ultra ? ultraName(name) : `${name}.glb`);
    if (ultra) {
      const problems = checkUltra({ tris, after: count(), bytes: (await io.writeBinary(doc)).byteLength });
      if (problems.length) throw new Error(`${name} (ultra): ${problems.join('; ')}`);
    }
    await io.write(out, doc);
    credits[`meshy/${name}`] = { source: 'https://www.meshy.ai', name: `${what}, made for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
    const kb = (await readFile(out)).length / 1024;
    console.log(`${name.padEnd(16)} ${Math.round(before)} → ${Math.round(count())} triangles, ${kb.toFixed(0)} KB`);
  }
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
