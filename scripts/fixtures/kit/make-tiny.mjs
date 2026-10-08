// Writes scripts/fixtures/kit/tiny/: two trees of one family shaped as the
// nature megakit's are (a .gltf, its .bin and the PNGs beside it), small
// enough to import in a test (scripts/kit/manifest.test.mjs runs
// scripts/kit/import.mjs on it). Each tree is a bark part (an open pyramid,
// four triangles, COLOR_0 as floats) and a leaf part (two cards of two
// triangles, COLOR_0 as normalised shorts); the bark is a two-tone 8 × 8,
// MASK in the source as some of the pack's bark is, and the leaf map an
// 8 × 8 with see-through texels, BLEND as one of its crowns is.
//
//   node scripts/fixtures/kit/make-tiny.mjs

import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, 'tiny');
const png = (texel) => {
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) rgba.set(texel(i % 8, Math.floor(i / 8)), i * 4);
  return sharp(rgba, { raw: { width: 8, height: 8, channels: 4 } }).png().toBuffer();
};
const bark = await png((x) => (x < 4 ? [110, 80, 50, 255] : [90, 64, 40, 255]));
const leaf = await png((x, y) => ((x + y) % 2 ? [60, 140, 40, 255] : [0, 0, 0, 0]));

mkdirSync(OUT, { recursive: true });
for (const [name, h] of [['Birch_1', 3], ['Birch_2', 4]]) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (type, array, normalized = false) => doc.createAccessor().setType(type).setArray(array).setNormalized(normalized).setBuffer(buffer);
  const texture = (n, image) => doc.createTexture(n).setImage(image).setMimeType('image/png').setURI(`${n}.png`);

  const barkMat = doc.createMaterial('Bark_Birch').setBaseColorTexture(texture('Bark_Birch', bark)).setAlphaMode('MASK').setAlphaCutoff(0.2).setDoubleSided(true);
  const leafMat = doc.createMaterial('Leaves_Birch').setBaseColorTexture(texture('Leaves_Birch', leaf)).setAlphaMode('BLEND').setDoubleSided(true);

  // the bark: four base corners and the top
  const trunk = doc
    .createPrimitive()
    .setMaterial(barkMat)
    .setAttribute('POSITION', acc('VEC3', new Float32Array([-0.1, 0, -0.1, 0.1, 0, -0.1, 0.1, 0, 0.1, -0.1, 0, 0.1, 0, h, 0])))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array([-0.7, 0, -0.7, 0.7, 0, -0.7, 0.7, 0, 0.7, -0.7, 0, 0.7, 0, 1, 0])))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array([0, 1, 0.25, 1, 0.5, 1, 0.75, 1, 0.5, 0])))
    .setAttribute('COLOR_0', acc('VEC4', new Float32Array([0.14, 0.14, 0.14, 1, 0.14, 0.14, 0.14, 1, 0.14, 0.14, 0.14, 1, 0.14, 0.14, 0.14, 1, 1, 1, 1, 1])))
    .setIndices(acc('SCALAR', new Uint16Array([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4])));

  // the crown: two cards, one each side of the top
  const cards = [];
  for (const [x, z] of [[-1, 0], [0.4, 0.5]]) {
    const y = h * 0.7;
    cards.push(x, y, z, x + 0.6, y, z, x + 0.6, y + 0.6, z, x, y + 0.6, z);
  }
  const crown = doc
    .createPrimitive()
    .setMaterial(leafMat)
    .setAttribute('POSITION', acc('VEC3', new Float32Array(cards)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(Array.from({ length: 8 }, () => [0, 0, 1]).flat())))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array([0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0])))
    .setAttribute('COLOR_0', acc('VEC4', new Uint16Array(32).fill(65535), true))
    .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])));

  // (the mesh keeps a modelling tool's name, as the pack's do)
  const mesh = doc.createMesh('tree.001').addPrimitive(trunk).addPrimitive(crown);
  doc.createScene().addChild(doc.createNode(name).setMesh(mesh));
  await new NodeIO().write(join(OUT, `${name}.gltf`), doc);
}
console.log(`wrote ${OUT}`);
