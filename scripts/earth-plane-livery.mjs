// The Earth world's plane in the site's own colours. The model (a 737 MAX by
// Sofyan Kurniawan, CC BY 4.0, credited in src/data/modelCredits.json) came
// from Sketchfab in an airline's livery; this takes the airline off it: the
// red lettering and emblem on the fuselage go back to its white, and the
// red tail, winglets and engine bands (with the emblems on them filled in)
// become the Travel planet's blue. It works on the file
// scripts/sketchfab-import.mjs made, in place, and only finds the red the
// first time.
//
//   node scripts/earth-plane-livery.mjs public/models/sketchfab/earth-plane.glb

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/earth-plane-livery.mjs <earth-plane.glb>');
  process.exit(1);
}
const BLUE = [0x1f, 0x5f, 0x99];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(file);

const isRed = (r, g, b) => r > 120 && r > g * 1.35 && r > b * 1.35;

// grow a mask by `r` pixels, then shrink it back: holes smaller than that
// (an emblem in a red panel) close up
function close(mask, w, h, r) {
  const pass = (src, grow) => {
    const tmp = new Uint8Array(w * h);
    const out = new Uint8Array(w * h);
    const pick = grow ? (a, b) => a | b : (a, b) => a & b;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = grow ? 0 : 1;
        for (let k = -r; k <= r; k++) v = pick(v, src[y * w + Math.min(w - 1, Math.max(0, x + k))]);
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = grow ? 0 : 1;
        for (let k = -r; k <= r; k++) v = pick(v, tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]);
        out[y * w + x] = v;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}
// grow a mask by `r` pixels (to take in the soft edge round the paint)
function grow(mask, w, h, r) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) out[Math.min(h - 1, Math.max(0, y + j)) * w + Math.min(w - 1, Math.max(0, x + k))] = 1;
    }
  }
  return out;
}

for (const tex of doc.getRoot().listTextures()) {
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const red = new Uint8Array(w * h);
  let reds = 0;
  for (let i = 0; i < w * h; i++) {
    red[i] = isRed(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0;
    reds += red[i];
  }
  if (!reds) continue;
  // the fuselage is the sheet with the windows on it: there, red is lettering
  // and an emblem, and goes; elsewhere it's paint, and turns blue
  let dark = 0;
  for (let i = 0; i < w * h; i++) if (data[i * 4] < 40 && data[i * 4 + 1] < 40 && data[i * 4 + 2] < 40) dark++;
  const fuselage = dark > w * h * 0.004 && reds < w * h * 0.05;
  // the body's own white, from the most common light grey
  const counts = new Map();
  for (let i = 0; i < w * h; i += 7) {
    const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    if (Math.abs(r - g) < 6 && Math.abs(g - b) < 6 && r > 150) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const white = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 205;
  const paint = grow(fuselage ? close(red, w, h, 6) : close(red, w, h, 34), w, h, 2);
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    if (!paint[i]) continue;
    const c = fuselage ? [white, white, white] : BLUE;
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
  }
  const webp = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).removeAlpha().webp({ quality: 88 }).toBuffer();
  tex.setImage(new Uint8Array(webp)).setMimeType('image/webp');
  console.log(`${fuselage ? 'fuselage' : 'paint'} sheet ${w}×${h}: ${reds} red pixels ${fuselage ? 'taken off' : 'made blue'}`);
}
await io.write(file, doc);
