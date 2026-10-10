// The 2017 game's humanoid skeleton, Walrus_HumanMale, in one file with no
// mesh: every joint of a rigged 2017 figure at its rest transform, the way
// the game shares one skeleton between 604 people. The shared clip packs
// (scripts/bf2017-clips.mjs) are written onto it, and the loader
// (src/lib/three/walrus.js) drives any 2017 body by these bone names. Read
// from a figure the import made with --rig (Luke's, phase 1), so nothing is
// renamed or dropped: the owner's choice, the rig whole.
//
//   node scripts/bf2017-skeleton.mjs <rigged.glb> [--out public/models/galaxy/bf2017/walrus.glb]
//
// Prints the joint count; the file is meshopt-compressed like every model.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';

export const SKELETON = 'Walrus_HumanMale';
const OUT = 'public/models/galaxy/bf2017/walrus.glb';

export async function walrusIo() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.ERROR))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// The document cut to its skeleton: the skin's joints and every node above
// or between them kept with their rest transforms; meshes, materials,
// textures, skins and animations gone; nodes that held only a mesh gone.
// Returns the joint count (the skin's, before it went).
export async function skeletonOnly(doc) {
  const root = doc.getRoot();
  const skins = root.listSkins();
  if (skins.length !== 1) throw new Error(`expected one skin, found ${skins.length}: import with --rig so the parts share the body's`);
  const joints = new Set(skins[0].listJoints());
  const keep = new Set();
  for (const j of joints) for (let n = j; n; n = n.getParentNode()) keep.add(n);
  for (const node of root.listNodes()) {
    node.setMesh(null).setSkin(null);
    // (a node outside the rig holds no joint: every joint's parents are kept)
    if (!keep.has(node)) node.dispose();
  }
  for (const a of root.listAnimations()) a.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const scene of root.listScenes()) scene.setName(SKELETON);
  await doc.transform(prune({ keepLeaves: true }));
  return joints.size;
}

async function main() {
  const { _: [file], out = OUT } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('usage: node scripts/bf2017-skeleton.mjs <rigged.glb> [--out public/models/galaxy/bf2017/walrus.glb]');
    process.exit(1);
  }
  const io = await walrusIo();
  const doc = await io.read(resolve(file));
  const count = await skeletonOnly(doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await mkdir(dirname(resolve(out)), { recursive: true });
  await io.write(resolve(out), doc);
  console.log(`${out}: ${count} joints, ${doc.getRoot().listNodes().length} nodes`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
