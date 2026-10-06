// A remade model's brightness brought to the old one's: the reference render
// has its shading in it, and TRELLIS.2 reads lit-and-shadowed grey as the
// paint, so a remade base map comes out darker than what it was made from.
// Luminance only (hue is the model's own), matched at the bright end (the
// 75th percentile: the hull, not the black panels that drag a mean down),
// each old material weighted by its texture's size.
//
//   node scripts/gen3d/colour.mjs OLD.glb NEW.glb [--out NEW.glb]
//   matchColour(doc, oldDoc) → { from, to, scale }

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from './web.mjs';

const P = 0.75;

// the luminance at the P-th percentile of a material's base colour, and its weight
async function bright(sharp, mat) {
  const f = mat.getBaseColorFactor();
  const tex = mat.getBaseColorTexture();
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (!tex) return { value: lum(f[0], f[1], f[2]), weight: 1 };
  const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(256, 256, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const vals = [];
  for (let i = 0; i < data.length; i += info.channels) vals.push(lum((data[i] / 255) * f[0], (data[i + 1] / 255) * f[1], (data[i + 2] / 255) * f[2]));
  vals.sort((a, b) => a - b);
  return { value: vals[Math.floor(vals.length * P)], weight: tex.getSize()?.[0] ?? 256 };
}

export async function matchColour(doc, oldDoc) {
  const { default: sharp } = await import('sharp');
  const [mat] = doc.getRoot().listMaterials();
  const olds = oldDoc.getRoot().listMaterials();
  if (!mat || !olds.length) return null;
  const from = (await bright(sharp, mat)).value;
  const ws = await Promise.all(olds.map((m) => bright(sharp, m)));
  const to = ws.reduce((s, w) => s + w.value * w.weight, 0) / ws.reduce((s, w) => s + w.weight, 0);
  const scale = Math.min(2, Math.max(0.5, to / Math.max(0.01, from))); // no more than doubled: past that the paint blows out
  const tex = mat.getBaseColorTexture();
  if (tex) {
    const img = sharp(Buffer.from(tex.getImage()));
    const { format } = await img.metadata();
    const out = await img.linear([scale, scale, scale], [0, 0, 0]).toFormat(format === 'webp' ? 'webp' : 'png', { quality: 90 }).toBuffer();
    tex.setImage(new Uint8Array(out));
  } else mat.setBaseColorFactor([...mat.getBaseColorFactor().slice(0, 3).map((v) => Math.min(1, v * scale)), 1]);
  return { from, to, scale };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--out');
  const out = i >= 0 ? args.splice(i, 2)[1] : args[1];
  const [oldFile, newFile] = args;
  if (!oldFile || !newFile) throw new Error('usage: node scripts/gen3d/colour.mjs OLD.glb NEW.glb [--out FILE]');
  const nio = await io();
  const doc = await nio.read(resolve(newFile));
  const r = await matchColour(doc, await nio.read(resolve(oldFile)));
  await nio.write(resolve(out), doc);
  console.log(r ? `brightness ×${r.scale.toFixed(2)} (${r.from.toFixed(2)} → ${r.to.toFixed(2)}) → ${out}` : 'nothing to match');
}
