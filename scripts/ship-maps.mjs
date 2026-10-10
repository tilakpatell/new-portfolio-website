// The hero ships' maps at the size the camera sees them.
//
// The HD Falcon and X-wing came with 1024² photo maps full of greebles and
// panel lines. On the universe map the hull is about 180 px wide, so each
// screen pixel averages five or six texels, and mipmapping averages colour,
// not contrast: a sharp dark line over a panel becomes a mid grey and the
// hull reads as mud (docs/research/2026-10-08-universe-polish-audit.md).
// This rewrites each map at 512 on its long side (metal and roughness at
// 256: they carry no lines worth keeping) with a Lanczos 3 resize, and on
// the colour maps an unsharp mask after it (radius 1.5, amount 0.6), so a
// line that was two texels dark stays dark at one. Normal maps are resized
// but never sharpened: a sharpened normal is a ridge that isn't there.
// Geometry, materials and meshopt are left as they are.
//
//   node scripts/ship-maps.mjs [--check] <glb>...
//
// --check reports what it would do and writes nothing. The table gives each
// map's size and bytes before and after, and its mean local contrast (the
// standard deviation of a 5 × 5 high-pass of its luminance), so the gain is
// a number.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = { albedo: 512, normal: 512, mr: 256, quality: 82, sharpen: { radius: 1.5, amount: 0.6 }, check: false };

// The long side to `size`, the short in proportion; never larger than it was.
export function fitSize(w, h, size) {
  const k = Math.min(1, size / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

// What a texture is for, from the material slots it fills. Occlusion rides
// with metal and roughness (they share a map in these files); emissive and
// anything else are treated as colour.
export function roleOf(slots) {
  if (slots.includes('normalTexture')) return 'normal';
  if (slots.includes('metallicRoughnessTexture') || slots.includes('occlusionTexture')) return 'mr';
  return 'albedo';
}

// Lanczos 3 down to `size` on the long side, then an unsharp mask on the
// colour channels when asked: out = in + amount × (in − blur(in, radius)).
// Alpha is never sharpened (a cut-out's edge would ring).
export async function downscale(buffer, { size, sharpen = null } = {}) {
  const meta = await sharp(buffer).metadata();
  const [w, h] = fitSize(meta.width, meta.height, size);
  const resized = sharp(buffer).resize(w, h, { kernel: 'lanczos3', fit: 'fill' });
  if (!sharpen) return resized.png().toBuffer();
  const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blur = await sharp(data, { raw: info }).blur(Math.max(0.3, sharpen.radius)).raw().toBuffer();
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    if (i % 4 === 3) out[i] = data[i];
    else out[i] = Math.max(0, Math.min(255, Math.round(data[i] + sharpen.amount * (data[i] - blur[i]))));
  }
  return sharp(out, { raw: info }).png().toBuffer();
}

// The standard deviation of a 5 × 5 high-pass of the luminance, 0..1: how
// much fine contrast a map carries. (Rec. 709 of the bytes, edges clamped.)
export async function localContrast(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (0.2126 * data[i * c] + 0.7152 * data[i * c + 1] + 0.0722 * data[i * c + 2]) / 255;
  let sum = 0;
  let sq = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          m += lum[yy * w + xx];
        }
      const d = lum[y * w + x] - m / 25;
      sum += d;
      sq += d * d;
    }
  const n = w * h;
  return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
}

async function io() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

// Every texture in the file to its role's size, WebP at `quality`. Returns
// each map's before and after, and the file's bytes before and after (the
// after measured from the written file, or estimated from the maps' saving
// with check).
export async function rewrite(path, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const nodeio = await io();
  const doc = await nodeio.read(path);
  const bytesBefore = (await stat(path)).size;
  const before = [];
  const after = [];
  let saved = 0;
  for (const [i, tex] of doc.getRoot().listTextures().entries()) {
    const image = tex.getImage();
    if (!image) continue;
    const src = Buffer.from(image);
    const role = roleOf(doc.getGraph().listParentEdges(tex).map((e) => e.getName()));
    const name = tex.getName() || tex.getURI() || `texture ${i}`;
    const meta = await sharp(src).metadata();
    before.push({ name, role, w: meta.width, h: meta.height, kB: src.byteLength / 1024, contrast: await localContrast(src) });
    const png = await downscale(src, { size: opts[role], sharpen: role === 'albedo' ? opts.sharpen : null });
    const webp = await sharp(png).webp({ quality: opts.quality, alphaQuality: 100 }).toBuffer();
    // A map already small and lean stays as it was: re-encoding it would
    // only lose quality.
    const keep = webp.byteLength >= src.byteLength && Math.max(meta.width, meta.height) <= opts[role];
    const outBuf = keep ? src : webp;
    const outMeta = await sharp(outBuf).metadata();
    after.push({ name, role, w: outMeta.width, h: outMeta.height, kB: outBuf.byteLength / 1024, contrast: await localContrast(outBuf) });
    saved += src.byteLength - outBuf.byteLength;
    if (!keep && !opts.check) tex.setImage(new Uint8Array(webp)).setMimeType('image/webp');
  }
  if (!opts.check) {
    // The files came out of gltfpack with meshopt's filters on; written back
    // in gltf-transform's default (quantize) mode the geometry grows by a
    // tenth. Filter mode lands within 2 % of what it was.
    const meshopt = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === 'EXT_meshopt_compression');
    meshopt?.setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    await nodeio.write(path, doc);
  }
  const bytesAfter = opts.check ? bytesBefore - saved : (await stat(path)).size;
  return { before, after, bytes: { before: bytesBefore, after: bytesAfter } };
}

function table(file, { before, after, bytes }) {
  const kb = (n) => `${Math.round(n)} kB`;
  console.log(`\n${basename(file)}`);
  console.log(['texture', 'role', 'before', 'after', 'kB', 'contrast'].join('\t'));
  before.forEach((b, i) => {
    const a = after[i];
    console.log([b.name, b.role, `${b.w}×${b.h}`, `${a.w}×${a.h}`, `${kb(b.kB)} → ${kb(a.kB)}`, `${b.contrast.toFixed(4)} → ${a.contrast.toFixed(4)}`].join('\t'));
  });
  console.log(`file: ${kb(bytes.before / 1024)} → ${kb(bytes.after / 1024)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter((a) => a !== '--check');
  if (!files.length) {
    console.error('usage: node scripts/ship-maps.mjs [--check] <glb>...');
    process.exit(1);
  }
  let total = [0, 0];
  for (const file of files) {
    await readFile(file); // fail early on a wrong path
    const out = await rewrite(file, { check });
    table(file, out);
    total = [total[0] + out.bytes.before, total[1] + out.bytes.after];
  }
  console.log(`\nall: ${Math.round(total[0] / 1024)} kB → ${Math.round(total[1] / 1024)} kB${check ? ' (check: nothing written)' : ''}`);
}
