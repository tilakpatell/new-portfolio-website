// The host of Rohan's models and baked textures (src/components/middleearth/towns/edoras/host.js
// draws them), into public/models/middleearth/host/:
//
//   horse.vat.bin, horse.vat.json   the farm kit's Horse (public/kit/farm/horse.glb)
//                                   at its own Run and WalkSlow
//   rider.glb                       a Rider of the cast (public/models/middleearth/cast/rohirrim.glb)
//                                   cut down for the thousand: its picture's colours
//                                   read into its corners, its seams welded, and
//                                   simplified to about RIDER_TRIS triangles, skin kept
//   rider.vat.bin, rider.vat.json   that Rider at the clip library's drive (a seated
//                                   figure's hands held before him, the reins), as `ride`
//
//   node scripts/edoras-vat.mjs
//
// Each texture is scripts/vat-bake.mjs's. The cast's own Rider is some twelve
// thousand triangles on a picture whose seams split nearly every corner:
// fine for the dozen on the cast, a thousand times too many for the host, and
// its seams keep a simplifier from taking any of it away. So the colours go
// into the corners (the picture sampled at each corner's place on it, sRGB to
// linear), every corner at one place becomes one (its skin is the same), and
// meshoptimizer's simplifier takes it down; the picture goes. Run again after
// either model or the drive clip changes; the outputs are committed (the town
// fetches them as they are).

import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/models/middleearth/host');
const RIDER_TRIS = 900;

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

async function cutRider(from, to) {
  await Promise.all([MeshoptSimplifier.ready, MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(from);
  await doc.transform(dequantize());
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  if (prims.length !== 1) throw new Error(`edoras-vat: ${from} has ${prims.length} primitives, one expected`);
  const prim = prims[0];
  const pos = prim.getAttribute('POSITION');
  const uv = prim.getAttribute('TEXCOORD_0');
  const joints = prim.getAttribute('JOINTS_0');
  const weights = prim.getAttribute('WEIGHTS_0');
  const tex = prim.getMaterial().getBaseColorTexture();
  const { data: px, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = pos.getCount();
  // every corner at one place becomes the first there
  const first = new Map();
  const remap = new Uint32Array(n);
  const kept = [];
  const e = [];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, e);
    const key = e.map((x) => Math.round(x * 1e5)).join(',');
    if (!first.has(key)) {
      first.set(key, kept.length);
      kept.push(i);
    }
    remap[i] = first.get(key);
  }
  const src = prim.getIndices().getArray();
  const index = new Uint32Array(src.length);
  for (let k = 0; k < src.length; k++) index[k] = remap[src[k]];
  const positions = new Float32Array(kept.length * 3);
  kept.forEach((i, j) => positions.set(pos.getElement(i, []), j * 3));
  const [cut] = MeshoptSimplifier.simplify(index, positions, 3, RIDER_TRIS * 3, 0.05, []);
  // the corners the cut keeps, in order, and what each carries
  const used = [...new Set(cut)];
  const at = new Map(used.map((v, j) => [v, j]));
  const P = new Float32Array(used.length * 3);
  const C = new Float32Array(used.length * 3);
  const J = new Uint16Array(used.length * 4);
  const W = new Float32Array(used.length * 4);
  used.forEach((v, j) => {
    const i = kept[v];
    P.set(pos.getElement(i, []), j * 3);
    const [u, w] = uv.getElement(i, []);
    const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width)));
    const y = Math.min(info.height - 1, Math.max(0, Math.floor((w - Math.floor(w)) * info.height)));
    const o = (y * info.width + x) * 4;
    C.set([linear(px[o] / 255), linear(px[o + 1] / 255), linear(px[o + 2] / 255)], j * 3);
    J.set(joints.getElement(i, []), j * 4);
    W.set(weights.getElement(i, []), j * 4);
  });
  const make = (array, type) => doc.createAccessor().setType(type).setArray(array).setBuffer(doc.getRoot().listBuffers()[0]);
  for (const s of prim.listSemantics()) prim.setAttribute(s, null);
  prim.setAttribute('POSITION', make(P, 'VEC3')).setAttribute('COLOR_0', make(C, 'VEC3')).setAttribute('JOINTS_0', make(J, 'VEC4')).setAttribute('WEIGHTS_0', make(W, 'VEC4'));
  prim.setIndices(make(Uint16Array.from(cut, (v) => at.get(v)), 'SCALAR'));
  prim.getMaterial().setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, 1]);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  for (const x of doc.getRoot().listExtensionsUsed()) if (/texture|meshopt|quantization/i.test(x.extensionName)) x.dispose();
  await doc.transform(prune());
  await io.write(to, doc);
  console.log(`rider.glb: ${n} corners and ${src.length / 3} triangles → ${used.length} and ${cut.length / 3}`);
}

await mkdir(OUT, { recursive: true });
await cutRider(join(root, 'public/models/middleearth/cast/rohirrim.glb'), join(OUT, 'rider.glb'));
const BAKES = [
  ['public/kit/farm/horse.glb', '--clips', 'own', '--only', 'Run,WalkSlow', '--name', 'horse'],
  ['public/models/middleearth/host/rider.glb', '--clips', 'ride=public/games/meshy/ual-drive.glb', '--name', 'rider'],
];
for (const args of BAKES) execFileSync(process.execPath, [join(root, 'scripts/vat-bake.mjs'), ...args, '--out', OUT], { cwd: root, stdio: 'inherit' });
