// GPU-compressed textures (KTX2, Basis Universal) for the site's models and
// texture sets, and a report that says, per texture, whether it's worth it.
//
// A KTX2 texture stays compressed on the graphics chip (a 1K map takes
// 1.3 MB as UASTC against 5.3 MB as the RGBA the browser makes of a WebP or
// JPEG), uploads in a fraction of the time, needs no decode on the main
// thread, and carries its own mipmaps. The catch, measured in
// docs/research/2026-10-05-textures-and-asset-quality.md: UASTC is about
// three times the download of the WebP it replaces at the same resolution,
// and ETC1S, the small kind, is too lossy for anything seen close (25–31 dB
// against the shipped files). So the defaults here are UASTC, and the
// report is for deciding which maps earn the bytes: normal maps (JPEG and
// lossy WebP wreck them: 26–27 dB), and large maps seen close, where GPU
// memory is the problem.
//
// The encoder is `basisu` (Binomial LLC's, from npm, a dev dependency; no
// KTX-Software install needed). The browser side needs nothing: the shared
// loader (src/lib/three/gltf.js) reads KTX2 and fetches its transcoder only
// for a file that carries one.
//
//   node scripts/ktx2.mjs report <file …>          what each texture would
//                                                  cost and save (changes nothing)
//   node scripts/ktx2.mjs convert <file …> [--out dir] [--etc1s] [--slots normal,arm]
//                                                  [--level 2] [--rdo 1] [--quality 200] [--flip]
//                                                  (--flip: an image turned for three's UVs, as a sphere's map wants)
//
// A file is a .glb (its textures are rewritten in place as KTX2, the rest of
// the file untouched: meshopt, quantization, materials), or an image
// (.png/.jpg/.webp: written beside it as .ktx2, or under --out). --slots
// limits a GLB's conversion to some texture roles: color (base colour and
// emissive), normal, arm (occlusion, roughness, metalness), other; the
// default is every slot. Normal, ARM and other data maps are encoded in
// linear space with linear mipmaps; colour and emissive in sRGB.
//
// The report's PSNR is against the input as it is (so a texture that's
// already been through JPEG is compared with its JPEG self): it says what
// this step costs, not what the source lost before it.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// basisu's binary for this machine (the package picks SSE where the chip has it);
// exported for scripts/lib/bf2017-textures.mjs, which unpacks the 2017 drop's KTX2
export function basisuPath() {
  const dir = dirname(require.resolve('basisu/package.json'));
  const platform = process.platform === 'win32' ? 'win' : process.platform;
  let arch = process.arch;
  try {
    const features = require('cpu-features')();
    if (features?.flags?.sse4_1 && arch === 'x64') arch = 'x64_sse';
  } catch {
    // no cpu-features: the plain build
  }
  const bin = join(dir, 'bin', platform, arch, platform === 'win' ? 'basisu.exe' : 'basisu');
  if (!existsSync(bin)) throw new Error(`no basisu binary for ${platform}/${arch} at ${bin}`);
  // (the package ships some of its binaries without the execute bit)
  if (platform !== 'win') {
    try {
      chmodSync(bin, 0o755);
    } catch {
      // read-only install: hope it's runnable as it is
    }
  }
  return bin;
}

// ── settings ──

export const DEFAULTS = { level: 2, rdo: 1.0, quality: 200, zstd: 18 };

// Which role a GLB texture plays, from the material slots it's attached to.
export function roleOf(slots) {
  if (slots.some((s) => /baseColor|emissive|diffuse|specularColor|sheenColor/i.test(s))) return 'color';
  if (slots.some((s) => /normal/i.test(s))) return 'normal';
  if (slots.some((s) => /occlusion|roughness|metallic/i.test(s))) return 'arm';
  return 'other';
}

// basisu's arguments for one map.
export function encodeArgs({ role, etc1s = false, level = DEFAULTS.level, rdo = DEFAULTS.rdo, quality = DEFAULTS.quality, zstd = DEFAULTS.zstd } = {}) {
  const linear = role !== 'color';
  const args = ['-ktx2', '-mipmap'];
  if (etc1s) args.push('-comp_level', '2', '-q', String(quality));
  else args.push('-uastc', '-uastc_level', String(level), '-uastc_rdo_l', String(rdo), '-ktx2_zstandard_level', String(zstd));
  if (linear) args.push('-linear');
  return args;
}

// GPU bytes for a w×h map with mipmaps: RGBA8 as the browser uploads a
// WebP/JPEG, 8 bits a pixel for UASTC (BC7, ASTC 4×4), 4 for ETC1S (BC1, ETC1).
export const gpuBytes = (w, h, kind) => Math.round(w * h * (kind === 'rgba' ? 4 : kind === 'etc1s' ? 0.5 : 1) * (4 / 3));
export const kb = (n) => `${Math.round(n / 1024)} KB`;
export const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

// ── encoding ──

// One image to KTX2 (also the planet bakers', scripts/planets/sphere.mjs).
// `flipY` stores it bottom row first: a KTX2 can't be flipped as it's
// uploaded, so a map drawn on three's UVs (v up, as a WebP is flipped to)
// is flipped here instead. (basisu's output isn't the same bytes run to
// run, even on one thread: a rebake of the same picture differs a little.)
let BASISU = null;
export async function encodeImage(buffer, { role, etc1s, level, rdo, quality, flipY = false }) {
  BASISU ??= basisuPath();
  const tmp = await mkdtemp(join(tmpdir(), 'ktx2-'));
  try {
    const png = join(tmp, 'in.png');
    const out = join(tmp, 'out.ktx2');
    const img = sharp(buffer);
    const meta = await img.metadata();
    await img.png().toFile(png);
    execFileSync(BASISU, [...encodeArgs({ role, etc1s, level, rdo, quality }), ...(flipY ? ['-y_flip'] : []), '-file', png, '-output_file', out], { stdio: 'ignore' });
    return { ktx2: await readFile(out), width: meta.width, height: meta.height };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// PSNR of an encode against its input: the KTX2 is unpacked to PNG by basisu
// (the BC7 or BC1 the desktop GPU gets) and compared channel by channel (R and
// G only for a normal map, where the normal lives).
async function psnrOf(ktx2, input, role) {
  BASISU ??= basisuPath();
  const tmp = await mkdtemp(join(tmpdir(), 'ktx2-psnr-'));
  try {
    const file = join(tmp, 't.ktx2');
    await writeFile(file, ktx2);
    execFileSync(BASISU, ['-unpack', '-no_ktx', '-file', file], { cwd: tmp, stdio: 'ignore' });
    const { readdirSync } = await import('node:fs');
    // (UASTC is judged as the BC7 a desktop gets, ETC1S as BC1)
    const all = readdirSync(tmp);
    const pngs = all.filter((f) => /_unpacked_rgb_BC7_RGBA_0_0_0000\.png$/.test(f)).concat(all.filter((f) => /_unpacked_rgb_BC1_RGB_0_0_0000\.png$/.test(f)));
    if (!pngs.length) return null;
    const a = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(join(tmp, pngs[0])).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) return null;
    const chans = role === 'normal' ? [0, 1] : [0, 1, 2];
    let se = 0;
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4)
      for (const c of chans) {
        const d = a.data[i + c] - b.data[i + c];
        se += d * d;
        n++;
      }
    const mse = se / n;
    return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ── files ──

async function io() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

// Every texture in a GLB, with its role and bytes.
async function glbTextures(doc) {
  const out = [];
  for (const tex of doc.getRoot().listTextures()) {
    const slots = doc.getGraph().listParentEdges(tex).map((e) => e.getName());
    const image = tex.getImage();
    if (!image) continue;
    const meta = await sharp(Buffer.from(image)).metadata();
    out.push({ tex, name: tex.getName() || tex.getURI() || `texture ${out.length}`, role: roleOf(slots), mime: tex.getMimeType(), bytes: image.byteLength, width: meta.width, height: meta.height });
  }
  return out;
}

function parseArgs(argv) {
  const opts = { files: [], out: null, etc1s: false, slots: null, level: DEFAULTS.level, rdo: DEFAULTS.rdo, quality: DEFAULTS.quality };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--etc1s') opts.etc1s = true;
    else if (a === '--slots') opts.slots = new Set(argv[++i].split(','));
    else if (a === '--level') opts.level = Number(argv[++i]);
    else if (a === '--rdo') opts.rdo = Number(argv[++i]);
    else if (a === '--quality') opts.quality = Number(argv[++i]);
    else if (a === '--flip') opts.flipY = true;
    else opts.files.push(a);
  }
  return opts;
}

const wanted = (role, slots) => !slots || slots.has(role);

async function report(opts) {
  const rows = [];
  for (const file of opts.files) {
    if (extname(file) === '.glb' || extname(file) === '.gltf') {
      const doc = await (await io()).read(file);
      for (const t of await glbTextures(doc)) {
        if (!wanted(t.role, opts.slots)) continue;
        const { ktx2 } = await encodeImage(Buffer.from(t.tex.getImage()), { role: t.role, ...opts });
        const psnr = await psnrOf(ktx2, Buffer.from(t.tex.getImage()), t.role);
        rows.push({ file: basename(file), name: t.name, role: t.role, mime: t.mime, width: t.width, size: `${t.width}×${t.height}`, before: t.bytes, after: ktx2.byteLength, gpuBefore: gpuBytes(t.width, t.height, 'rgba'), gpuAfter: gpuBytes(t.width, t.height, opts.etc1s ? 'etc1s' : 'uastc'), psnr });
      }
    } else {
      const buf = await readFile(file);
      const role = /normal/i.test(basename(file)) ? 'normal' : /arm|rough|metal|occlusion|ao\b/i.test(basename(file)) ? 'arm' : 'color';
      const { ktx2, width, height } = await encodeImage(buf, { role, ...opts });
      const psnr = await psnrOf(ktx2, buf, role);
      rows.push({ file: file.split('/').slice(-2).join('/'), name: '', role, mime: /\.jpe?g$/i.test(file) ? 'image/jpeg' : '', width, size: `${width}×${height}`, before: buf.byteLength, after: ktx2.byteLength, gpuBefore: gpuBytes(width, height, 'rgba'), gpuAfter: gpuBytes(width, height, opts.etc1s ? 'etc1s' : 'uastc'), psnr });
    }
  }
  console.log(['file', 'texture', 'role', 'size', 'bytes now', 'bytes ktx2', 'GPU now', 'GPU ktx2', 'PSNR', 'verdict'].join('\t'));
  let before = 0;
  let after = 0;
  let gpuB = 0;
  let gpuA = 0;
  for (const r of rows) {
    before += r.before;
    after += r.after;
    gpuB += r.gpuBefore;
    gpuA += r.gpuAfter;
    console.log([r.file, r.name, r.role, r.size, kb(r.before), kb(r.after), mb(r.gpuBefore), mb(r.gpuAfter), r.psnr == null ? '?' : `${r.psnr.toFixed(1)} dB`, verdict(r)].join('\t'));
  }
  console.log(`\n${rows.length} textures: download ${kb(before)} → ${kb(after)} (×${(after / Math.max(1, before)).toFixed(2)}), GPU ${mb(gpuB)} → ${mb(gpuA)}`);
}

// The spec's rule: worth it when GPU memory falls, the download stays within
// 1.25× of today, and the encode keeps 34 dB. A normal map that's a JPEG has
// already lost what JPEG takes (its chroma, which is where a normal lives:
// about 26 dB against its source); re-encoding it here can't bring that
// back, so the answer is to make it again from its source as UASTC, not to
// convert the JPEG. A big map seen close is worth considering for its GPU
// memory alone. Everything else: keep the WebP.
export function verdict({ role, mime = '', before, after, gpuBefore, gpuAfter, psnr, width = 0 } = {}) {
  const bytesOk = after <= before * 1.25;
  const gpuOk = gpuAfter < gpuBefore;
  const qualityOk = psnr == null || psnr >= 34;
  if (gpuOk && bytesOk && qualityOk) return 'convert';
  if (role === 'normal' && /jpe?g/i.test(mime)) return 'regenerate from source as UASTC (JPEG normals)';
  if (width >= 2048 && gpuOk && qualityOk) return 'consider (GPU memory)';
  return 'keep';
}

async function convert(opts) {
  for (const file of opts.files) {
    const outDir = opts.out ? resolve(opts.out) : dirname(file);
    if (extname(file) === '.glb' || extname(file) === '.gltf') {
      const nodeio = await io();
      const doc = await nodeio.read(file);
      const basisu = doc.createExtension(KHRTextureBasisu).setRequired(true);
      let n = 0;
      let still = 0;
      for (const t of await glbTextures(doc)) {
        if (!wanted(t.role, opts.slots) || t.mime === 'image/ktx2') {
          if (t.mime !== 'image/ktx2') still++;
          continue;
        }
        const { ktx2 } = await encodeImage(Buffer.from(t.tex.getImage()), { role: t.role, ...opts });
        t.tex.setImage(new Uint8Array(ktx2)).setMimeType('image/ktx2').setURI('');
        n++;
      }
      if (!still) for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'EXT_texture_webp') ext.dispose();
      if (!n) basisu.dispose();
      const out = join(outDir, basename(file));
      await nodeio.write(out, doc);
      const size = (await stat(out)).size;
      console.log(`${out}: ${n} textures to KTX2${still ? `, ${still} left as they were` : ''}, ${kb(size)}`);
    } else {
      const buf = await readFile(file);
      const role = /normal/i.test(basename(file)) ? 'normal' : /arm|rough|metal|occlusion|ao\b/i.test(basename(file)) ? 'arm' : 'color';
      const { ktx2 } = await encodeImage(buf, { role, ...opts });
      const out = join(outDir, `${basename(file, extname(file))}.ktx2`);
      await writeFile(out, ktx2);
      console.log(`${out}: ${kb(ktx2.byteLength)} (${role}, from ${kb(buf.byteLength)})`);
    }
  }
}

const [cmd, ...rest] = process.argv.slice(2);
// (the path, not file:// + argv: on Windows the URL is file:///C:/…)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(rest);
  if (cmd === 'report' && opts.files.length) await report(opts);
  else if (cmd === 'convert' && opts.files.length) await convert(opts);
  else {
    console.log('node scripts/ktx2.mjs report <file …>\nnode scripts/ktx2.mjs convert <file …> [--out dir] [--etc1s] [--slots color,normal,arm,other] [--level 2] [--rdo 1] [--quality 200]');
    process.exit(cmd ? 1 : 0);
  }
}
