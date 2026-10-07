// The fake 3D engine (GEN3D_ENGINE=fake): what generate.mjs runs in place of
// TRELLIS.2 or Hunyuan3D in a contract test. It writes a small valid
// textured GLB in well under a second, the same bytes for the same pictures
// and seed, so the pipeline's resume keys, budgets and cuts are tested for
// real without a GPU.
//
//   node scripts/ai-e2e/fakes/engine.mjs IMAGE OUT.glb [--seed N] [--left L --back B --right R] [--tris N] [--fail-at generate] [--sleep S]
//
// A box of 12 triangles with a 64² base-colour texture; --tris N (or
// GEN3D_FAKE_TRIS) a grid of at least N triangles instead, for the budget
// tests; GEN3D_FAKE_TEX=N an N² texture, for the texture cap; GEN3D_FAKE_NOISE
// (below) a model too heavy to ship. common.mjs has the other knobs. The
// flags generate.mjs passes for the tests to read back (--res, --fov,
// --asked, --faithful) change nothing.

import { Document, NodeIO } from '@gltf-transform/core';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fail, failing, flag, nap, record } from './common.mjs';
import { png, seeded } from './png.mjs';

// The box's six faces, four corners each (so each face has its own UVs).
const FACES = [
  [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
  [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
  [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
  [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
];
const CORNER_UV = [[0, 1], [0, 0], [1, 0], [1, 1]];

function box(scale) {
  const pos = [];
  const uv = [];
  const idx = [];
  FACES.forEach((face, f) => {
    face.forEach((p, i) => {
      pos.push(p[0] * scale[0], p[1] * scale[1], p[2] * scale[2]);
      uv.push(...CORNER_UV[i]);
    });
    idx.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
  });
  return { pos, uv, idx };
}

// A k×k grid in the XY plane: 2k² triangles, the fewest k that reach `tris`.
function grid(tris, scale) {
  const k = Math.ceil(Math.sqrt(tris / 2));
  const pos = [];
  const uv = [];
  const idx = [];
  for (let y = 0; y <= k; y++) {
    for (let x = 0; x <= k; x++) {
      pos.push((x / k - 0.5) * 2 * scale[0], (y / k - 0.5) * 2 * scale[1], 0);
      uv.push(x / k, 1 - y / k);
    }
  }
  for (let y = 0; y < k; y++) {
    for (let x = 0; x < k; x++) {
      const a = y * (k + 1) + x;
      idx.push(a, a + 1, a + k + 2, a, a + k + 2, a + k + 1);
    }
  }
  return { pos, uv, idx };
}

export function model(pictures, { seed = 42, tris, tex = 64, noise = 0 } = {}) {
  const h = createHash('sha1');
  for (const p of pictures) h.update(p).update('|');
  h.update(String(seed));
  const rand = seeded(h.digest().readUInt32BE(0));
  const scale = [0.8 + rand() * 0.4, 0.8 + rand() * 0.4, 0.8 + rand() * 0.4];
  const colour = [rand(), rand(), rand()].map((c) => Math.round(64 + c * 160));
  const mesh = tris > 12 ? grid(tris, scale) : box(scale);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const cell = Math.max(1, tex >> 3);
  const checker = png(tex, tex, (x, y) => (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? [...colour, 255] : [colour[0] >> 1, colour[1] >> 1, colour[2] >> 1, 255]);
  const mesh3d = doc.createMesh('fake');
  const prim = (m, image) =>
    doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.pos)).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(m.uv)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.idx)).setBuffer(buffer))
      .setMaterial(doc.createMaterial('fake').setBaseColorTexture(doc.createTexture('base').setMimeType('image/png').setImage(image)).setRoughnessFactor(0.6).setMetallicFactor(0.1));
  mesh3d.addPrimitive(prim(mesh, checker));
  // GEN3D_FAKE_NOISE=K: K more boxes, each with a 2048² texture of noise, which
  // no encoder can shrink: a model too heavy for its cut, for the budget tests
  for (let k = 0; k < noise; k++) {
    const bytes = Buffer.alloc(4);
    const fill = png(2048, 2048, () => {
      bytes.writeUInt32LE((rand() * 4294967296) >>> 0);
      return [bytes[0], bytes[1], bytes[2], 255];
    }, { level: 1 });
    mesh3d.addPrimitive(prim(box([0.1, 0.1, 0.1]), fill));
  }
  doc.createScene('scene').addChild(doc.createNode('fake').setMesh(mesh3d));
  return doc;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  record('engine', argv);
  nap(argv);
  const [image, out] = argv;
  const sides = ['left', 'back', 'right'].map((s) => flag(argv, s)).filter(Boolean);
  const pictures = [image, ...sides].map((f) => readFileSync(f));
  const doc = model(pictures, { seed: Number(flag(argv, 'seed') ?? 42), tris: Number(flag(argv, 'tris', 'GEN3D_FAKE_TRIS') ?? 0), tex: Number(process.env.GEN3D_FAKE_TEX ?? 64), noise: Number(process.env.GEN3D_FAKE_NOISE ?? 0) });
  const bytes = Buffer.from(await new NodeIO().writeBinary(doc));
  if (failing(argv, 'generate')) {
    writeFileSync(out, bytes.subarray(0, bytes.length >> 1)); // what a crash mid-write leaves
    fail('generate');
  }
  writeFileSync(out, bytes);
}
