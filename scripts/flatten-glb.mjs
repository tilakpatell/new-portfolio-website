// A model repainted in flat colours, for a stylised world
// (docs/research/2026-10-06-why-theirs-look-expensive.md: a photo-baked Meshy
// atlas stretched over a 28 m house smears up close, and beside code-made,
// flat-coloured things it reads as a collage). Its shape and its UVs are
// kept; its atlas is painted again in a few flat colours.
//
// By default (texture mode) the atlas is smoothed of the generator's mush
// (a median), enlarged (`--scale`, so the edges between flat regions are
// drawn at twice the texels), its colours gathered into a few (k-means),
// pulled toward a world's palette if one is given, and every texel set to
// its cluster's colour: the windows, the brick and the trim stay, as clean
// flat shapes. The material goes matte; the world's house look
// (src/lib/three/house.js) shades it, and its core kit (src/lib/three/
// core.js) lays real grain over it at a fixed size, which is what a close
// look then sees instead of a blur. `--vertex` instead writes each vertex
// the colour its atlas shows there and drops the atlas (for dense meshes
// whose detail is in the shape, not the paint).
//
//   node scripts/flatten-glb.mjs <in.glb> [out.glb] [--colours 16] [--scale 2]
//     [--palette '#aabbcc,#ddeeff'] [--pull 0.5] [--vertex] [--blur 96] [--keep-normal]
//
// (out defaults to in: the model is replaced; git keeps the old one.)
//
//   kmeans(colours, k, { seed, iterations }) → { centres, label }    (pure)
//   nearestOf(colour, palette) → the palette's nearest entry        (pure)
//   posterize(pixels, { colours, palette, pull }) → { pixels, colours } (pure)
//   flattenPrimitive(doc, primitive, pixels, opts) → { colours } | null

import { fileURLToPath } from 'node:url';

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexOf = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// Colours gathered into at most `k` (k-means, seeded k-means++ start).
export function kmeans(colours, k, { seed = 1, iterations = 14 } = {}) {
  const n = colours.length;
  const kk = Math.max(1, Math.min(k, n));
  const rand = rng(seed);
  const centres = [colours[Math.floor(rand() * n)].slice()];
  const best = new Float64Array(n).fill(Infinity);
  while (centres.length < kk) {
    let sum = 0;
    const last = centres[centres.length - 1];
    for (let i = 0; i < n; i++) {
      best[i] = Math.min(best[i], d2(colours[i], last));
      sum += best[i];
    }
    if (sum <= 0) break;
    let r = rand() * sum;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      r -= best[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centres.push(colours[pick].slice());
  }
  const label = new Array(n).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = d2(colours[i], centres[c]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      label[i] = bi;
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const s = sums[label[i]];
      s[0] += colours[i][0];
      s[1] += colours[i][1];
      s[2] += colours[i][2];
      s[3] += 1;
    }
    sums.forEach((s, c) => {
      if (s[3]) centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return { centres, label };
}

export const nearestOf = (c, palette) => palette.reduce((a, b) => (d2(c, b) < d2(c, a) ? b : a));

// The colour the picture shows at a UV (wrapping, glTF's v down the image), sRGB 0…1.
function texel({ width, height, data }, u, v) {
  const x = Math.min(width - 1, Math.floor((((u % 1) + 1) % 1) * width));
  const y = Math.min(height - 1, Math.floor((((v % 1) + 1) % 1) * height));
  const k = (y * width + x) * 4;
  return [data[k] / 255, data[k + 1] / 255, data[k + 2] / 255];
}

// One primitive repainted from `pixels` ({ width, height, data: RGBA bytes }
// of its base-colour map). `colours` at most; `palette` ['#rrggbb'] pulled
// toward by `pull` (0…1).
export function flattenPrimitive(doc, prim, pixels, { colours = 10, palette = null, pull = 0.6, keepNormal = false, seed = 1 } = {}) {
  const mat = prim.getMaterial();
  const uv = prim.getAttribute('TEXCOORD_0');
  if (!mat?.getBaseColorTexture() || !uv) return null;
  const factor = mat.getBaseColorFactor();
  const n = uv.getCount();
  const seen = [];
  const t = [0, 0];
  for (let i = 0; i < n; i++) {
    uv.getElement(i, t);
    const c = texel(pixels, t[0], t[1]);
    // (the factor is linear; the map's colour is sRGB: near enough, scale it)
    seen.push([c[0] * factor[0] ** (1 / 2.2), c[1] * factor[1] ** (1 / 2.2), c[2] * factor[2] ** (1 / 2.2)]);
  }
  let { centres, label } = kmeans(seen, colours, { seed });
  if (palette?.length) {
    const pal = palette.map(rgbOf);
    centres = centres.map((c) => {
      const p = nearestOf(c, pal);
      return c.map((v, j) => v + (p[j] - v) * pull);
    });
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = centres[label[i]];
    out[i * 3] = toLin(c[0]);
    out[i * 3 + 1] = toLin(c[1]);
    out[i * 3 + 2] = toLin(c[2]);
  }
  const buffer = uv.getBuffer() ?? doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(buffer));
  mat.setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, factor[3]]).setMetallicRoughnessTexture(null).setRoughnessFactor(0.85).setMetallicFactor(0);
  if (!keepNormal) mat.setNormalTexture(null);
  return { colours: centres.map(hexOf) };
}

// A picture ({ width, height, data: RGBA bytes }) in `colours` flat colours:
// its clusters (k-means over up to 24k of its texels, sRGB), pulled toward
// `palette` by `pull`, every texel set to its own (alpha kept).
export function posterize({ width, height, data }, { colours = 16, palette = null, pull = 0.5, seed = 1 } = {}) {
  const n = width * height;
  const step = Math.max(1, Math.floor(n / 24000));
  const sample = [];
  for (let i = 0; i < n; i += step) if (data[i * 4 + 3] > 8) sample.push([data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255]);
  if (!sample.length) return { pixels: { width, height, data }, colours: [] };
  let { centres } = kmeans(sample, colours, { seed });
  if (palette?.length) {
    const pal = palette.map(rgbOf);
    centres = centres.map((c) => {
      const p = nearestOf(c, pal);
      return c.map((v, j) => v + (p[j] - v) * pull);
    });
  }
  const bytes = centres.map((c) => c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)));
  const out = new Uint8Array(data.length);
  for (let i = 0; i < n; i++) {
    const c = [data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255];
    let bi = 0;
    let bd = Infinity;
    for (let k = 0; k < centres.length; k++) {
      const d = d2(c, centres[k]);
      if (d < bd) {
        bd = d;
        bi = k;
      }
    }
    out[i * 4] = bytes[bi][0];
    out[i * 4 + 1] = bytes[bi][1];
    out[i * 4 + 2] = bytes[bi][2];
    out[i * 4 + 3] = data[i * 4 + 3];
  }
  return { pixels: { width, height, data: out }, colours: centres.map(hexOf) };
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, d) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : d;
  };
  const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--keep-normal'].includes(argv[i - 1])));
  const [from, to = from] = files;
  if (!from) {
    console.error("usage: node scripts/flatten-glb.mjs <in.glb> [out.glb] [--colours 10] [--blur 96] [--palette '#…,#…'] [--pull 0.6] [--keep-normal]");
    process.exit(1);
  }
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { meshopt, prune } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  const sharp = (await import('sharp')).default;
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(from);
  const palette = opt('palette', null)?.split(',').map((t) => t.trim());
  const report = [];
  if (argv.includes('--vertex')) {
    const blur = Number(opt('blur', 96));
    const cache = new Map();
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const tex = prim.getMaterial()?.getBaseColorTexture();
        if (!tex) continue;
        if (!cache.has(tex)) {
          // (a small copy: each texel a region's colour, not a stain's)
          const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(blur, blur, { fit: 'fill' }).blur(0.6).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          cache.set(tex, { width: info.width, height: info.height, data });
        }
        const got = flattenPrimitive(doc, prim, cache.get(tex), { colours: Number(opt('colours', 10)), palette, pull: Number(opt('pull', 0.6)), keepNormal: argv.includes('--keep-normal') });
        if (got) report.push(`${mesh.getName() || 'mesh'}: ${got.colours.join(' ')}`);
      }
  } else {
    const scale = Number(opt('scale', 2));
    const done = new Set();
    for (const mat of doc.getRoot().listMaterials()) {
      const tex = mat.getBaseColorTexture();
      if (!tex) continue;
      if (!done.has(tex)) {
        done.add(tex);
        const img = sharp(Buffer.from(tex.getImage()));
        const meta = await img.metadata();
        const { data, info } = await img
          .median(5)
          .resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { kernel: 'lanczos3' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const got = posterize({ width: info.width, height: info.height, data }, { colours: Number(opt('colours', 16)), palette, pull: Number(opt('pull', 0.5)) });
        const webp = await sharp(Buffer.from(got.pixels.data), { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 92, alphaQuality: 90 }).toBuffer();
        tex.setImage(new Uint8Array(webp)).setMimeType('image/webp');
        report.push(`${tex.getName() || 'atlas'} ${info.width}px: ${got.colours.join(' ')}`);
      }
      mat.setMetallicRoughnessTexture(null).setRoughnessFactor(0.85).setMetallicFactor(0);
      if (!argv.includes('--keep-normal')) mat.setNormalTexture(null);
    }
  }
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(to, doc);
  console.log(report.join('\n'));
  console.log(`wrote ${to}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
