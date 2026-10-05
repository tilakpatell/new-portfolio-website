// Brings the office's scanned plant down to what it's seen at: the soil in
// its pot was 36,685 triangles (more than all the set's furniture put
// together), and nobody looks into a pot. Only meshes over their budget are
// touched, so it can be run again safely; the file stays meshopt-compressed.
//   node scripts/office-simplify.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dequantize, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const FILE = 'public/models/office/plant.glb';
const BUDGET = { 'low.008': 1800 }; // mesh name → triangles at most

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(FILE);
const tris = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
await doc.transform(dequantize(), weld());
const buffer = doc.getRoot().listBuffers()[0];
for (const mesh of doc.getRoot().listMeshes()) {
  const budget = BUDGET[mesh.getName()];
  for (const prim of mesh.listPrimitives()) {
    const before = tris(prim);
    if (budget && before > budget) {
      const pos = prim.getAttribute('POSITION');
      const indices = new Uint32Array(prim.getIndices().getArray());
      const [kept] = MeshoptSimplifier.simplify(indices, new Float32Array(pos.getArray()), 3, budget * 3, 0.05, ['LockBorder']);
      prim.setIndices(doc.createAccessor().setArray(kept).setBuffer(buffer));
      compactPrimitive(prim);
    }
    console.log(mesh.getName(), before, '→', tris(prim));
  }
}
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(FILE, doc);
