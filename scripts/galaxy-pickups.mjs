// Packs the galaxy's five pickups (galaxy/pickups.js) into one GLB from
// Quaternius's Ultimate Space Kit (CC0, tilakverse-assets'
// quaternius/ultimate-space-kit/Items/GLTF): a node per kind, each centred
// and fitted to a unit cube, deduplicated and meshopt-compressed.
//   node scripts/galaxy-pickups.mjs <folder with Pickup_*.gltf> public/models/galaxy/pickups.glb
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, prune, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error('usage: node scripts/galaxy-pickups.mjs <folder with Pickup_*.gltf> <out.glb>');
const KINDS = { repair: 'Health', overcharge: 'Thunder', rapid: 'Bullets', bubble: 'Sphere', charge: 'Crate' };
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const doc = new Document();
const main = doc.createScene('pickups');
doc.getRoot().setDefaultScene(main);
for (const [kind, name] of Object.entries(KINDS)) {
  const src = await io.read(join(dir, `Pickup_${name}.gltf`));
  const srcScene = src.getRoot().getDefaultScene() ?? src.getRoot().listScenes()[0];
  const map = mergeDocuments(doc, src);
  const scene = map.get(srcScene);
  // (each kind under a node named for it, centred on its origin and fitted to a unit cube)
  const fit = doc.createNode(`${kind}-fit`);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    fit.addChild(child);
  }
  scene.dispose();
  const { min, max } = getBounds(fit);
  const side = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const s = 1 / side;
  fit.setScale([s, s, s]);
  fit.setTranslation([(-(min[0] + max[0]) / 2) * s, (-(min[1] + max[1]) / 2) * s, (-(min[2] + max[2]) / 2) * s]);
  const holder = doc.createNode(kind).addChild(fit);
  main.addChild(holder);
}
await doc.transform(unpartition(), dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder }));
await io.write(out, doc);
for (const node of main.listChildren()) {
  let tris = 0;
  node.traverse((n) => {
    for (const p of n.getMesh()?.listPrimitives() ?? []) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  });
  console.log(`${node.getName()}: ${Math.round(tris)} triangles`);
}
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(1)} KB`);
