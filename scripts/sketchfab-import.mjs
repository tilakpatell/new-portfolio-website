// Brings a model downloaded from Sketchfab (a .glb, CC Attribution: see
// public/cc0/README.md for who made each) down to web size and into the
// site's frame: textures to WebP at most `tex` pixels a side, the mesh
// simplified to about `tris` triangles if it has more, Meshopt-compressed,
// and (unless --keep) stood on the ground, centred, with its longest side on
// the ground `size` metres long. An animated model keeps its clips; pass
// --keep for those, so its skeleton is left where the animation expects it.
//
//   node scripts/sketchfab-import.mjs <in.glb> <out.glb> [--size 8.5] [--tex 1024] [--tris 40000] [--keep]
//
// Nothing here talks to Sketchfab: the download is the site owner's, by hand
// or through their signed-in browser.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, metalRough, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

const [from, to, ...rest] = process.argv.slice(2);
const opt = (k, d) => (rest.includes(`--${k}`) ? Number(rest[rest.indexOf(`--${k}`) + 1]) : d);
const keep = rest.includes('--keep');
if (!from || !to) {
  console.error('usage: node scripts/sketchfab-import.mjs <in.glb> <out.glb> [--size m] [--tex px] [--tris n] [--keep]');
  process.exit(1);
}
const size = opt('size', 0);
const tex = opt('tex', 1024);
const tris = opt('tris', 60000);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(from);
const root = doc.getRoot();
const count = () =>
  root
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

const before = count();
// (older uploads use specular-glossiness materials, which three.js no longer reads: to metal-roughness)
await doc.transform(dedup(), metalRough(), prune());
if (before > tris * 1.15) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: 0.004 }));

// every vertex in the world, to find the ground and the middle
function bounds() {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const walk = (node, parent) => {
    const m = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        const v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          const w = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], w[k]);
            hi[k] = Math.max(hi[k], w[k]);
          }
        }
      }
    for (const c of node.listChildren()) walk(c, m);
  };
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  for (const n of scene.listChildren()) walk(n, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { lo, hi, scene };
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

let placed = '';
if (!keep && size > 0) {
  const { lo, hi, scene } = bounds();
  const s = size / Math.max(hi[0] - lo[0], hi[2] - lo[2]);
  const top = doc.createNode('placed').setMatrix([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, (-s * (lo[0] + hi[0])) / 2, -s * lo[1], (-s * (lo[2] + hi[2])) / 2, 1]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    top.addChild(child);
  }
  scene.addChild(top);
  placed = `, ${((hi[0] - lo[0]) * s).toFixed(2)} x ${((hi[1] - lo[1]) * s).toFixed(2)} x ${((hi[2] - lo[2]) * s).toFixed(2)} m`;
}

await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await mkdir(dirname(to), { recursive: true });
await io.write(to, doc);
const bytes = (await stat(to)).size;
console.log(`${to}: ${Math.round(before)} -> ${Math.round(count())} triangles, ${(bytes / 1024).toFixed(0)} KB, ${root.listAnimations().length} clip(s), ${root.listTextures().length} texture(s)${placed}`);
