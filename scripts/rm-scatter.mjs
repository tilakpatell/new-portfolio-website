// Small copies of the Rick and Morty sector's set pieces, for scattering
// across a world's ground (universe/landings/landings.js): a Meshy model is
// about 30k triangles, fine standing once, too many a dozen times over. Each
// one is read from public/models/c137/rm/<name>.glb, simplified with
// meshoptimizer toward 3,000 triangles (as far as its UV seams let it: the
// suckulent stops at about 8,800, the cog at 6,300), its UVs and texture
// kept, the texture down to 512 px, and written beside it as <name>-small.glb.
//
//   node scripts/rm-scatter.mjs suckulent gearcog

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'c137', 'rm');
const TRIS = 3000;

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

const names = process.argv.slice(2);
if (!names.length) throw new Error('node scripts/rm-scatter.mjs <name …> (a GLB in public/models/c137/rm/)');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
for (const name of names) {
  const doc = await io.read(join(DIR, `${name}.glb`));
  const before = triangles(doc);
  await doc.transform(dequantize(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TRIS / before), error: 0.05 }), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(join(DIR, `${name}-small.glb`), doc);
  console.log(`small    ${name.padEnd(16)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles`);
}
