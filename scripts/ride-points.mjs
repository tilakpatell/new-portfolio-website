// The rides' points to the centimetre, for rides.seat.test.js where the model is
// in the bucket and not the checkout: run after re-importing the X-34 or the 74-Z.
//
//   node scripts/ride-points.mjs

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const kind of ['speederbike', 'landspeeder']) {
  const doc = await io.read(`public/models/galaxy/surface/${kind}.glb`);
  const seen = new Set(); const v = [];
  for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); const q = [0, 1, 2].map((r) => Math.round((m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]) * 100)); seen.add(q.join(',')); } } }
  const flat = [...seen].flatMap((s) => s.split(',').map(Number));
  writeFileSync(`src/components/galaxy/surface/fixtures/${kind}.points.json`, JSON.stringify({ made: `public/models/galaxy/surface/${kind}.glb`, cm: flat }));
  console.log(kind, seen.size);
}
