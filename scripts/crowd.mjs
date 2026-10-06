// The Citadel's crowds: each Meshy figure (scripts/meshy.mjs) made into a
// light copy that stands in a crowd. A rigged one is posed on a frame of
// its own idle clip (so the arms come down from the rig's A-pose), turned
// to face +z as the figures do and its skin taken off; one that only ever
// stands in the crowd was modelled standing at ease and is taken as it is.
// Then its triangles are cut to a few thousand and its texture to 256
// pixels, and it's compressed for the web into public/games/meshy/crowd/.
// Hundreds of them are drawn as a few instanced meshes
// (src/components/rickmorty/citadel/crowd.js). The crowd-only figures'
// full-size models aren't shipped: they're kept in
// node_modules/.cache/meshy-full/ (or fetch them again with
// scripts/meshy.mjs, for nothing, and move them there).
//
//   node scripts/crowd.mjs [name …]

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FROM = join(ROOT, 'public', 'games', 'meshy');
const OUT = join(FROM, 'crowd');
const FULL = join(ROOT, 'node_modules', '.cache', 'meshy-full');
export const CROWD = [
  // rigged, posed on their idle
  'rick', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick', 'cop', 'morty', 'copmorty',
  // (the multiverse's Phase 3: Mortytown's, and the Ricks of the Ricklantis Mixup)
  'rickd3', 'simplerick', 'evilrick', 'bigmorty', 'slickmorty',
  // modelled standing at ease
  'wizardrick', 'hazmatrick', 'sheriffrick', 'retrorick', 'visorrick', 'doofusrick', 'mulletrick', 'chefrick', 'pilotrick', 'punkrick',
  'hobbitmorty', 'beaniemorty', 'sheriffmorty', 'overallsmorty', 'maskmorty', 'glassesmorty', 'astronautmorty', 'punkmorty',
  'supremeguard', 'garmentrick',
];
const TRIS = 2400;
const AT = 0.6; // seconds into the idle

// an accessor's values as floats (compressed ones are stored as normalised
// integers: read through getElement, which scales them back)
function floats(acc) {
  if (!acc.getNormalized()) return acc.getArray();
  const n = acc.getElementSize();
  const out = new Float32Array(acc.getCount() * n);
  const el = [];
  for (let i = 0; i < acc.getCount(); i++) out.set(acc.getElement(i, el), i * n);
  return out;
}

// one channel's value at time t (linear; rotations slerped)
function sample(channel, t) {
  const s = channel.getSampler();
  const times = s.getInput().getArray();
  const vals = floats(s.getOutput());
  const n = channel.getTargetPath() === 'rotation' ? 4 : 3;
  let i = 1;
  while (i < times.length - 1 && times[i] < t) i++;
  const t0 = times[i - 1] ?? times[0];
  const t1 = times[i] ?? t0;
  const k = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
  const a = Array.from(vals.slice((i - 1) * n, i * n));
  const b = Array.from(vals.slice(i * n, (i + 1) * n));
  if (b.length < n) return a;
  if (n === 4) return new THREE.Quaternion(...a).slerp(new THREE.Quaternion(...b), k).toArray();
  return a.map((v, j) => v + (b[j] - v) * k);
}

async function bake(io, name) {
  const doc = await io.read(existsSync(join(FROM, `${name}.glb`)) ? join(FROM, `${name}.glb`) : join(FULL, `${name}.glb`));
  const root = doc.getRoot();
  if (root.listSkins().length) await pose(io, doc, name);
  await shrink(io, doc, name);
}

// a rigged figure: posed on its idle, turned to face +z, its skin taken off
async function pose(io, doc, name) {
  const idle = await io.read(join(FROM, `${name}-idle.glb`));
  const root = doc.getRoot();
  // the idle's pose, by bone name
  const posed = new Map();
  for (const ch of idle.getRoot().listAnimations()[0]?.listChannels() ?? []) {
    const n = ch.getTargetNode()?.getName();
    if (!n) continue;
    if (!posed.has(n)) posed.set(n, {});
    posed.get(n)[ch.getTargetPath()] = sample(ch, AT);
  }
  // every node's world matrix in that pose
  const world = new Map();
  const visit = (node, parent) => {
    const p = posed.get(node.getName()) ?? {};
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...(p.translation ?? node.getTranslation())), new THREE.Quaternion(...(p.rotation ?? node.getRotation())), new THREE.Vector3(...(p.scale ?? node.getScale())));
    const w = parent.clone().multiply(m);
    world.set(node, w);
    for (const c of node.listChildren()) visit(c, w);
  };
  for (const scene of root.listScenes()) for (const n of scene.listChildren()) visit(n, new THREE.Matrix4());

  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices().getArray();
  const jm = joints.map((j, i) => world.get(j).clone().multiply(new THREE.Matrix4().fromArray(ibm, i * 16)));
  const jn = jm.map((m) => new THREE.Matrix3().getNormalMatrix(m));
  // which way it faces: across the shoulders, turned about up
  const at = (n) => new THREE.Vector3().setFromMatrixPosition(world.get(root.listNodes().find((x) => x.getName() === n)));
  const across = at('RightArm').sub(at('LeftArm'));
  const ahead = new THREE.Vector3(0, 1, 0).cross(across);
  const turn = new THREE.Matrix4().makeRotationY(-Math.atan2(ahead.x, ahead.z));
  const turnN = new THREE.Matrix3().getNormalMatrix(turn);

  const meshNode = root.listNodes().find((n) => n.getMesh() && n.getSkin());
  const v = new THREE.Vector3();
  const acc = new THREE.Vector3();
  for (const prim of meshNode.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const nor = prim.getAttribute('NORMAL');
    const J = prim.getAttribute('JOINTS_0').getArray();
    const W = floats(prim.getAttribute('WEIGHTS_0'));
    const P = floats(pos);
    const N = nor ? floats(nor) : null;
    const outP = new Float32Array(P.length);
    const outN = N ? new Float32Array(N.length) : null;
    const nAcc = new THREE.Vector3();
    for (let i = 0; i < pos.getCount(); i++) {
      acc.set(0, 0, 0);
      nAcc.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = W[i * 4 + k];
        if (!w) continue;
        const j = J[i * 4 + k];
        acc.addScaledVector(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(jm[j]), w);
        if (N) nAcc.addScaledVector(v.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(jn[j]), w);
      }
      acc.applyMatrix4(turn);
      outP.set([acc.x, acc.y, acc.z], i * 3);
      if (N) {
        nAcc.applyMatrix3(turnN).normalize();
        outN.set([nAcc.x, nAcc.y, nAcc.z], i * 3);
      }
    }
    pos.setArray(outP).setNormalized(false);
    if (N) nor.setArray(outN).setNormalized(false);
    prim.setAttribute('JOINTS_0', null);
    prim.setAttribute('WEIGHTS_0', null);
  }
  // just the mesh, at the root, unskinned and still
  meshNode.setSkin(null);
  meshNode.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  const scene = root.listScenes()[0];
  scene.addChild(meshNode);
  for (const n of root.listNodes()) if (n !== meshNode) n.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const a of root.listAnimations()) a.dispose();
}

async function shrink(io, doc, name) {
  const meshNode = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getMesh());
  const tris = meshNode
    .getMesh()
    .listPrimitives()
    .reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  await doc.transform(prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TRIS / tris), error: 0.03 }), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [256, 256] }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await mkdir(OUT, { recursive: true });
  await io.write(join(OUT, `${name}.glb`), doc);
  const after = doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((s, p) => s + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(`crowd    ${name.padEnd(16)} ${Math.round(tris)} → ${Math.round(after)} triangles`);
}

async function main() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const only = process.argv.slice(2);
  const names = only.length ? only : CROWD;
  for (const n of names) await bake(io, n);
  // credited as what they're made from
  const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
  const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
  for (const n of names) if (credits[`meshy/${n}`]) credits[`meshy/crowd/${n}`] = { ...credits[`meshy/${n}`], name: `${n}, for the Citadel's crowds (scripts/crowd.mjs)` };
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
