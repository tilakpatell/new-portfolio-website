// The two Death Stars' HD exteriors (docs/superpowers/specs/2026-10-07-deathstar-inside-design.md,
// "HD exteriors"), from the two models already credited on the site, at the
// size their authors made them:
//
//   ds1  Quiznos323's Death Star (CC BY-NC-SA 4.0), its maps 4096 × 2048:
//        public/models/universe/death-star.hq.glb with them whole, and
//        death-star.glb (the one mid and low detail load) at 2048. Its own
//        normal map is all but flat, so both get a new one: the plating
//        baked as a height field (plating.js's paintStation: bands of
//        latitude, sectors along the meridians, strips, blocks, and the
//        trench's rims, where its colour map has them) over the model's
//        own panel lines made crisper. The superlaser's beams (skinned to
//        bones scaled to nothing, so never seen, and boxing the model 2 units
//        past the hull, which made the galaxy draw it a tenth small and off
//        centre) are left out.
//   ds2  N8's Death Star II (CC BY 4.0), maps up to 4096: in place of the
//        512-pixel one as public/models/galaxy/deathstar2.glb (colour maps at
//        2048) and deathstar2.hq.glb (at their own size, to 4096), and a new
//        far-off copy (scripts/galaxy-lod.mjs). Turned so its dish faces +z
//        and its poles are y, its hull's middle at the origin and 20 across
//        (as the old one: galaxy/world.js puts the station's solid at the
//        middle of its box, 0.47 of its size out). Its colours were near black
//        (made for Sketchfab's viewer): set here by part for one sun. Its
//        hull's lattice of gaps is plated over (DS2_HULL), so it's the films'
//        station, whole but for its open side; the two parts drawn alike are
//        one draw (10, from 12).
//
// galaxy/models.js loads the .hq files on high and ultra detail (HD_MAPS).
// Normal maps are never lossy WebP. By scripts/ktx2.mjs's rule (GPU memory
// down, the download within 1.25 times, 34 dB kept) the DS2's are KTX2
// (UASTC: 37–39 dB, a quarter of the GPU memory, smaller than lossless WebP)
// and the DS1's lossless WebP (its seams on flat plates pack to 0.8 MB that
// way at 4096, against 1.9 MB as KTX2). The rest are WebP.
//
//   SKETCHFAB_API_TOKEN=… NODE_USE_ENV_PROXY=1 node scripts/deathstar-hd.mjs [ds1] [ds2] [lod] [credits]
//   node scripts/deathstar-hd.mjs shots     the pictures in docs/superpowers/shots/deathstar-hd/
//
// The downloads (each model's glTF archive, its maps at full size) are kept
// in $DEATHSTAR_HD_CACHE (/tmp/deathstar-hd), out of the repo; only their
// scene.gltf, scene.bin and textures/*.png are taken out of the archive. The
// token is read from the environment and never written anywhere.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, KHRTextureBasisu } from '@gltf-transform/extensions';
import { clearNodeTransform, cloneDocument, dedup, dequantize, flatten, join, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join as path, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeImage } from './ktx2.mjs';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.DEATHSTAR_HD_CACHE ?? '/tmp/deathstar-hd';
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const API = 'https://api.sketchfab.com/v3/models';

export const SOURCES = {
  ds1: { uid: '423fb92f677f4448aef407112a1fc032' },
  ds2: { uid: '17ccca0dbb6b4e338fa999202f9e6685' },
};
const OUT = {
  ds1: { base: 'public/models/universe/death-star.glb', hq: 'public/models/universe/death-star.hq.glb' },
  ds2: { base: 'public/models/galaxy/deathstar2.glb', hq: 'public/models/galaxy/deathstar2.hq.glb' },
};

// ── the plating (pure: tested in deathstar-hd.test.mjs) ──

// paintStation's random numbers (components/deathstar/plating.js), so the same
// seed lays the same plates
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The DS1's UVs are a globe's (measured from the hull: u = ¾ + longitude/2π,
// v = ½ + latitude/π, v growing north, so the map's top row is the south
// pole): a row's latitude, in radians.
export const latitudeOf = (row, h) => ((row + 0.5) / h - 0.5) * Math.PI;

// The trench's rows in the colour map: the dark band nearest the equator
// (its rows' mean brightness, `profile`, under 60% of the map's median).
export function trenchRows(profile) {
  const sorted = [...profile].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mid = Math.floor(profile.length / 2);
  const dark = (y) => profile[y] < median * 0.6;
  let at = -1;
  for (let d = 0; d < profile.length / 8 && at < 0; d++) {
    if (dark(mid - d)) at = mid - d;
    else if (dark(mid + d)) at = mid + d;
  }
  if (at < 0) return null;
  let top = at;
  let bottom = at;
  while (top > 0 && dark(top - 1)) top--;
  while (bottom < profile.length - 1 && dark(bottom + 1)) bottom++;
  return [top, bottom];
}

// The plating as a height field (0…1, plate tops at ½) over a w × h globe map,
// as paintStation lays it: 36 bands of latitude, each cut into sectors along
// the meridians (fewer toward the poles, so they stay square-ish on the
// sphere), long low strips and small raised or sunk blocks in each, a seam
// down every sector's side and along every band; and the trench, if its rows
// are given, sunk with a raised lip either side.
export function platingHeight({ w, h, seed = 4, trench = null }) {
  const rand = rng(seed);
  const H = new Float32Array(w * h).fill(0.5);
  const k = w / 2048;
  const rect = (x0, y0, x1, y1, z, mode = 'set') => {
    const xa = Math.max(0, Math.round(x0));
    const xb = Math.min(w, Math.max(xa + 1, Math.round(x1)));
    const ya = Math.max(0, Math.round(y0));
    const yb = Math.min(h, Math.max(ya + 1, Math.round(y1)));
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) H[y * w + x] = mode === 'min' ? Math.min(H[y * w + x], z) : z;
  };
  const bands = 36;
  const bh = h / bands;
  for (let b = 0; b < bands; b++) {
    const y = b * bh;
    const lat = Math.abs((b + 0.5) / bands - 0.5) * Math.PI;
    const sectors = Math.max(12, Math.round(72 * Math.cos(lat)));
    const sw = w / sectors;
    for (let i = 0; i < sectors; i++) {
      const x = i * sw;
      // each sector's plate a little higher or lower than its neighbours
      rect(x, y, x + sw, y + bh, 0.5 + (rand() - 0.5) * 0.06);
      const strips = 1 + Math.floor(rand() * 3);
      for (let j = 0; j < strips; j++) {
        const sy = y + bh * (0.15 + rand() * 0.7);
        rect(x + sw * 0.08, sy, x + sw * (0.38 + rand() * 0.6), sy + Math.max(1, 1.5 * k), 0.42);
      }
      const blocks = Math.floor(rand() * 6);
      for (let j = 0; j < blocks; j++) {
        const bw = sw * (0.05 + rand() * 0.16);
        const bhh = bh * (0.08 + rand() * 0.22);
        const bx = x + rand() * (sw - bw);
        const by = y + rand() * (bh - bhh);
        rect(bx, by, bx + bw, by + bhh, rand() < 0.5 ? 0.62 : 0.38);
      }
      // the seam down the sector's side
      rect(x, y, x + Math.max(1, k), y + bh, 0.3, 'min');
    }
    // and the line between bands
    rect(0, y, w, y + Math.max(1, 1.4 * k), 0.26, 'min');
  }
  if (trench) {
    const [top, bottom] = trench;
    const lip = Math.max(2, Math.round(3 * k));
    rect(0, top - lip, w, top, 0.66);
    rect(0, bottom + 1, w, bottom + 1 + lip, 0.66);
    rect(0, top, w, bottom + 1, 0.12);
  }
  return H;
}

// A tangent-space normal map from a height field, as the DS1's own is drawn:
// its tangents run along u and its bitangents along v (down the map as it's
// stored, the way three's loader reads them from these files), so a slope up
// the rows turns the normal toward the smaller rows. Wraps round in u (the
// globe's seam); clamps at the poles. Float x, y, z per texel.
export function heightNormals(H, w, h, strength) {
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1);
    const down = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const dx = (H[y * w + ((x + 1) % w)] - H[y * w + ((x - 1 + w) % w)]) * strength;
      const dy = (H[down * w + x] - H[up * w + x]) * strength;
      const len = Math.hypot(dx, dy, 1);
      out[(y * w + x) * 3] = -dx / len;
      out[(y * w + x) * 3 + 1] = -dy / len;
      out[(y * w + x) * 3 + 2] = 1 / len;
    }
  }
  return out;
}

// One normal map's detail over another's ("whiteout": the slopes added, the
// heights multiplied), the base's slopes scaled by `gain` after a soft
// threshold at `floor` (the source's grain left out, its panel lines kept):
// RGB bytes in, RGB bytes out.
export function blendNormals(base, detail, { gain = 1, floor = 0 } = {}) {
  const n = detail.length / 3;
  const out = new Uint8Array(n * 3);
  const soft = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - floor) * gain;
  for (let i = 0; i < n; i++) {
    const bx = soft(base[i * 3] / 127.5 - 1);
    const by = soft(base[i * 3 + 1] / 127.5 - 1);
    const bz = Math.max(1e-3, base[i * 3 + 2] / 127.5 - 1);
    const x = bx + detail[i * 3];
    const y = by + detail[i * 3 + 1];
    const z = bz * detail[i * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = Math.round((x / l) * 127.5 + 127.5);
    out[i * 3 + 1] = Math.round((y / l) * 127.5 + 127.5);
    out[i * 3 + 2] = Math.round((z / l) * 127.5 + 127.5);
  }
  return out;
}

// ── turning the DS2 ──

// A sphere through points (least squares: x² + y² + z² = 2ax + 2by + 2cz + d).
export function fitSphere(points) {
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const B = [0, 0, 0, 0];
  for (const [x, y, z] of points) {
    const r = [2 * x, 2 * y, 2 * z, 1];
    const f = x * x + y * y + z * z;
    for (let i = 0; i < 4; i++) {
      B[i] += r[i] * f;
      for (let j = 0; j < 4; j++) A[i][j] += r[i] * r[j];
    }
  }
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let k = i + 1; k < 4; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
    [A[i], A[p]] = [A[p], A[i]];
    [B[i], B[p]] = [B[p], B[i]];
    for (let k = i + 1; k < 4; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j];
      B[k] -= f * B[i];
    }
  }
  const s = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let v = B[i];
    for (let j = i + 1; j < 4; j++) v -= A[i][j] * s[j];
    s[i] = v / A[i][i];
  }
  return { centre: s.slice(0, 3), r: Math.sqrt(s[3] + s[0] ** 2 + s[1] ** 2 + s[2] ** 2) };
}

// The turn about y that brings a direction round to +z.
export const yawToFront = ([x, , z]) => Math.atan2(-x, z);

// centre → origin, turned `yaw` about y, scaled `k`: a column-major matrix
export function placing(centre, yaw, k) {
  const c = Math.cos(yaw) * k;
  const s = Math.sin(yaw) * k;
  const [x, y, z] = centre;
  // (R·(p − centre))·k: rows (c, 0, s), (0, k, 0), (−s, 0, c)
  return [c, 0, -s, 0, 0, k, 0, 0, s, 0, c, 0, -(c * x + s * z), -k * y, -(-s * x + c * z), 1];
}

// ── the downloads ──

const json = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

// the model's glTF archive (its maps at full size), fetched once and unpacked
// to CACHE/<name>/: only the scene and its PNG maps, by name
async function source(name) {
  const dir = path(CACHE, name);
  const gltf = path(dir, 'scene.gltf');
  if (existsSync(gltf)) return gltf;
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set');
  const { gltf: archive } = await json(`${API}/${SOURCES[name].uid}/download`, { Authorization: `Token ${token}` });
  if (!archive?.url) throw new Error(`${name}: no glTF archive to download`);
  const r = await fetch(archive.url);
  if (!r.ok) throw new Error(`${name}: download ${r.status}`);
  const files = unzipSync(new Uint8Array(await r.arrayBuffer()), { filter: (f) => /^(scene\.gltf|scene\.bin|textures\/[\w.-]+\.png)$/.test(f.name) });
  await mkdir(path(dir, 'textures'), { recursive: true });
  for (const [f, bytes] of Object.entries(files)) await writeFile(path(dir, f), bytes);
  return gltf;
}

// who made it, from the model's public page
async function credit(name, as, file, also) {
  const m = await json(`${API}/${SOURCES[name].uid}`);
  const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };
  const license = LICENCES[m.license?.slug];
  if (!license) throw new Error(`${name}: its licence (${m.license?.label}) isn't one the site can use`);
  return { title: m.name, author: m.user.displayName || m.user.username, authorUrl: m.user.profileUrl, license, licenseUrl: m.license.url, source: m.viewerUrl, where: 'galaxy', as, file, ...(also ? { also } : {}) };
}

// ── shared steps ──

const kb = (n) => `${Math.round(n / 1024)} KB`;
const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// an image (a PNG's bytes) at `size` on its longer side (never larger than it is)
async function sized(bytes, size) {
  const img = sharp(Buffer.from(bytes));
  const { width, height } = await img.metadata();
  const k = Math.min(1, size / Math.max(width, height));
  return k === 1 ? img : img.resize(Math.round(width * k), Math.round(height * k), { kernel: 'lanczos3' });
}

// a texture's new image: WebP (`lossless` for a normal map) or KTX2 (UASTC)
async function encode(tex, bytes, { size, as = 'webp', quality = 85, role = 'color' }) {
  const img = await sized(bytes, size);
  if (as === 'ktx2') {
    const { ktx2 } = await encodeImage(await img.png().toBuffer(), { role });
    tex.setImage(new Uint8Array(ktx2)).setMimeType('image/ktx2').setURI('');
  } else {
    const webp = as === 'lossless' ? await img.webp({ lossless: true, effort: 6 }).toBuffer() : await img.webp({ quality, alphaQuality: 90, effort: 6 }).toBuffer();
    tex.setImage(new Uint8Array(webp)).setMimeType('image/webp').setURI('');
  }
}

// Every texture re-encoded by its role: `plan(texture, slots, materials)` →
// { size, as, quality } (slots: the material slots it fills; materials: the
// ones it's in). The extensions a format needs are switched on here.
async function encodeAll(doc, originals, plan) {
  let webp = false;
  let ktx2 = false;
  for (const tex of doc.getRoot().listTextures()) {
    const edges = doc.getGraph().listParentEdges(tex);
    const slots = edges.map((e) => e.getName());
    const materials = edges.map((e) => e.getParent()).filter((p) => p.propertyType === 'Material');
    const how = plan(tex, slots, materials);
    await encode(tex, originals.get(tex.getName()), how);
    if (how.as === 'ktx2') ktx2 = true;
    else webp = true;
  }
  if (webp) doc.createExtension(EXTTextureWebP).setRequired(true);
  if (ktx2) doc.createExtension(KHRTextureBasisu).setRequired(true);
}

async function write(io, doc, file) {
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await mkdir(dirname(path(ROOT, file)), { recursive: true });
  await io.write(path(ROOT, file), doc);
  const bytes = (await stat(path(ROOT, file))).size;
  const maps = [];
  for (const t of doc.getRoot().listTextures()) {
    const { width, height } = t.getMimeType() === 'image/ktx2' ? ktxSize(t.getImage()) : await sharp(Buffer.from(t.getImage())).metadata();
    maps.push(`${t.getName()} ${width}×${height} ${t.getMimeType().slice(6)} ${kb(t.getImage().byteLength)}`);
  }
  console.log(`${file}: ${Math.round(triangles(doc))} triangles, ${doc.getRoot().listMaterials().length} materials, ${kb(bytes)}\n  ${maps.join('\n  ')}`);
}

// a KTX2's size, from its header
const ktxSize = (b) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(20, true), height: v.getUint32(24, true) };
};

// every texture named, and its original bytes kept by name (each variant
// re-encodes from these, not from the last one)
function originalsOf(doc) {
  const map = new Map();
  doc
    .getRoot()
    .listTextures()
    .forEach((t, i) => {
      const name = (t.getURI() || t.getName() || `map${i}`).replace(/^textures\//, '').replace(/\.png$/, '');
      t.setName(name);
      map.set(name, t.getImage());
    });
  return map;
}

// ── DS1 ──

async function ds1(io) {
  const doc = await io.read(await source('ds1'));
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  // the superlaser's beams: skinned, their bones scaled to nothing
  for (const node of root.listNodes()) {
    if (!node.getSkin()) continue;
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const skin of root.listSkins()) skin.dispose();
  for (const a of root.listAnimations()) a.dispose();
  await doc.transform(dedup(), prune());
  const originals = originalsOf(doc);
  const hull = root.listMaterials().find((m) => m.getName() === 'Death_Star');
  const normalTex = hull.getNormalTexture();
  const colour = Buffer.from(hull.getBaseColorTexture().getImage());
  const own = Buffer.from(normalTex.getImage());
  // (the model's own normal was drawn softly, at ¾: the new one at full strength)
  hull.setNormalScale(1);

  // The close cut: every map at its own size (the hull's 4096 × 2048). The
  // mid and low cut: 2048, its normal at 1024, the size a phone's ceiling
  // brings the rest to (lib/detail).
  const hq = cloneDocument(doc);
  originals.set(normalTex.getName(), await stationNormal(colour, own, 4096));
  await encodeAll(hq, originals, (t, slots) => (slots.includes('normalTexture') ? { size: 4096, as: 'lossless' } : { size: 4096, quality: 86 }));
  await write(io, hq, OUT.ds1.hq);
  originals.set(normalTex.getName(), await stationNormal(colour, own, 1024));
  await encodeAll(doc, originals, (t, slots) => (slots.includes('normalTexture') ? { size: t.getName() === normalTex.getName() ? 1024 : 512, as: 'lossless' } : { size: 2048, quality: 80 }));
  await write(io, doc, OUT.ds1.base);
}

// The hull's new normal map, `w` wide (its colour map's shape), baked at that
// size rather than shrunk (a shrunk one blurs its seams, and costs twice the
// bytes): the plating over the model's own panel lines, its grain left out.
// A PNG's bytes.
async function stationNormal(colourPng, ownPng, w) {
  const { width, height } = await sharp(colourPng).metadata();
  const h = Math.round((w * height) / width);
  const grey = await sharp(colourPng).greyscale().resize(w, h).raw().toBuffer();
  const profile = Array.from({ length: h }, (_, y) => {
    let s = 0;
    for (let x = 0; x < w; x++) s += grey[y * w + x];
    return s / w;
  });
  const trench = trenchRows(profile);
  const detail = heightNormals(platingHeight({ w, h, trench }), w, h, 2.4 * (w / 4096) + 0.6);
  const own = await sharp(ownPng).removeAlpha().resize(w, h).raw().toBuffer();
  const normal = blendNormals(own, detail, NORMAL_BLEND);
  console.log(`ds1: normal ${w}×${h}, the trench at rows ${trench?.join('–')}`);
  return new Uint8Array(await sharp(Buffer.from(normal), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer());
}
// the model's own panel lines, 2.6 times as steep, its grain (slopes under 0.08) left out
const NORMAL_BLEND = { gain: 2.6, floor: 0.08 };

// ── DS2 ──

// N8's parts by material, each's colour (a factor on its map) for one sun in
// space: the hull's plates light, the frames under them and the decks darker,
// the metal barely metal (there's nothing out there for it to reflect).
// `as`: drawn as another (the same maps), so the two are one draw.
const DS2_LOOK = {
  '06_-_Default': { base: 1, whole: true }, // the hull's plates
  '06_-_Defaultasdsda': { base: 1 }, // more of them
  '06_-_Defaultasdsdaasdassad': { base: 0.75 }, // darker plates among them
  '06_-_Defaultasdsdaasdassadasd': { as: '06_-_Defaultasdsdaasdassad' },
  '03_-_Defaultasdsad': { base: 0.9 }, // the dish
  '03_-_Defaultasdsadasd': { base: 0.8 }, // round the dish
  '06_-_Defaultasdsdaasdassadasdassd': { base: 0.85 }, // the frames under the hull
  '03_-_Defaultasdsadasdassda': { base: 0.8 }, // the shell under those
  '05_-_Defaultasdasd': { base: 0.7 }, // the decks, lit
  '06_-_Defaultasdsdaasdaasdsdassadasdassdasasdss': { base: 0.6 }, // the equator's floors
  '06_-_Defaultasdsdaasdaasdsdassadasdassdasasd': { base: 0.6 },
};
const DS2_METAL = 0.25;
// The hull's plates as N8 made them are cut away in a lattice all round (its
// colour map's alpha), so the whole sphere read as a cage rather than the
// films' station, whole but for the unfinished side. The hull gets a map of
// its own with the holes filled with the plating made for round the dish
// (that map tiled at its own scale), no alpha, and is drawn whole (`whole`
// above); the plates along the open side's edge keep the cut one. (A map
// shared by the two wouldn't do: shrunk to a phone's ceiling in the browser,
// lib/three/textures.js, the colour under its clear texels goes black.)
const DS2_HULL = { material: '06_-_Default', plating: '03_-_Defaultasdsadasd_baseColor' };
const DS2_RADIUS = 10;

async function ds2(io) {
  const doc = await io.read(await source('ds2'));
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  // its look, and the parts drawn alike made one material
  const byName = new Map(root.listMaterials().map((m) => [m.getName(), m]));
  for (const [name, look] of Object.entries(DS2_LOOK)) {
    const m = byName.get(name);
    if (!m) throw new Error(`ds2: no material ${name}`);
    if (look.as) continue;
    m.setBaseColorFactor([look.base, look.base, look.base, 1]);
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), DS2_METAL));
    if (look.whole) m.setAlphaMode('OPAQUE');
  }
  for (const [name, look] of Object.entries(DS2_LOOK)) {
    if (!look.as) continue;
    const m = byName.get(name);
    for (const prim of root.listMeshes().flatMap((x) => x.listPrimitives())) if (prim.getMaterial() === m) prim.setMaterial(byName.get(look.as));
    m.dispose();
  }

  // where it is: the hull's sphere, and the dish's way from its middle
  const points = (material) => {
    const out = [];
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const M = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMaterial()?.getName() !== material) continue;
        const P = prim.getAttribute('POSITION');
        const p = [0, 0, 0];
        for (let i = 0; i < P.getCount(); i++) {
          P.getElement(i, p);
          out.push([M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]]);
        }
      }
    }
    return out;
  };
  const { centre, r } = fitSphere(points('06_-_Default'));
  const dish = [0, 0, 0];
  for (const p of points('03_-_Defaultasdsad')) {
    const d = p.map((v, i) => v - centre[i]);
    const l = Math.hypot(...d);
    for (let i = 0; i < 3; i++) dish[i] += d[i] / l;
  }
  const yaw = yawToFront(dish);
  console.log(`ds2: hull r ${r.toFixed(1)} at ${centre.map((v) => v.toFixed(1)).join(', ')}; dish ${(Math.asin(dish[1] / Math.hypot(...dish)) * (180 / Math.PI)).toFixed(0)}° north, turned ${((yaw * 180) / Math.PI).toFixed(0)}°`);
  // every part under one node that places it, then that baked into the vertices
  const scene = root.listScenes()[0];
  const place = doc.createNode('deathstar2').setMatrix(placing(centre, yaw, DS2_RADIUS / r));
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    place.addChild(child);
  }
  scene.addChild(place);
  await doc.transform(dequantize(), dedup(), prune(), flatten());
  for (const node of root.listNodes()) if (node.getMesh()) clearNodeTransform(node);
  await doc.transform(join({ keepNamed: false }), weld(), dedup(), prune());
  const originals = originalsOf(doc);
  const hull = root.listMaterials().find((m) => m.getName() === DS2_HULL.material);
  const cut = hull.getBaseColorTexture();
  const whole = doc.createTexture(`${cut.getName()}_whole`).setMimeType('image/png');
  whole.setImage(await filled(cut.getImage(), originals.get(DS2_HULL.plating)));
  hull.setBaseColorTexture(whole);
  originals.set(whole.getName(), whole.getImage());

  // The close cut: the colour maps at their own size (the hull's 4096), the
  // hull frames' normal at 2048 and the dish's at 1024 (KTX2), the roughness,
  // metal and shadow maps at 1024. The mid and low cut: colour at 2048,
  // normals 512, the rest 512. The colour maps only cut-out parts wear (the
  // frames, decks and edge plates seen through the open side) a step down in
  // each: a phone's ceiling never shrinks a cut-out's maps (lib/three/textures.js).
  const plan = (hq) => (t, slots, materials) => {
    if (slots.includes('normalTexture')) return { size: hq ? (/^03_/.test(t.getName()) ? 1024 : 2048) : 512, as: 'ktx2', role: 'normal' };
    if (slots.includes('metallicRoughnessTexture') || slots.includes('occlusionTexture')) return { size: hq ? 1024 : 512, quality: 80 };
    const cutOnly = materials.every((m) => m.getAlphaMode() === 'MASK');
    return { size: (hq ? 4096 : 2048) / (cutOnly ? 2 : 1), quality: 80 };
  };
  const hq = cloneDocument(doc);
  await encodeAll(hq, originals, plan(true));
  await write(io, hq, OUT.ds2.hq);
  await encodeAll(doc, originals, plan(false));
  await write(io, doc, OUT.ds2.base);
}

// A map with alpha (PNG bytes) made whole: its clear texels' colour taken
// from `plating` (tiled at its own size). PNG bytes, without alpha.
async function filled(rgbaPng, platingPng) {
  const { width, height } = await sharp(Buffer.from(rgbaPng)).metadata();
  const tile = await sharp(Buffer.from(platingPng)).removeAlpha().ensureAlpha(1).png().toBuffer();
  const t = await sharp(tile).metadata();
  const tiles = [];
  for (let y = 0; y < height; y += t.height) for (let x = 0; x < width; x += t.width) tiles.push({ input: tile, left: x, top: y });
  const under = await sharp({ create: { width, height, channels: 4, background: '#000000ff' } }).composite(tiles).png().toBuffer();
  const rgb = await sharp(under).composite([{ input: Buffer.from(rgbaPng) }]).removeAlpha().raw().toBuffer();
  return new Uint8Array(await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer());
}

// the far-off copy, by the galaxy's own LOD script
function lod() {
  execFileSync(process.execPath, ['scripts/galaxy-lod.mjs', 'deathstar2'], { cwd: ROOT, stdio: 'inherit' });
}

async function credits() {
  const all = JSON.parse(await readFile(CREDITS, 'utf8'));
  // (each .hq file is credited with its lighter cut; the first Death Star hangs
  // in Scarif's sky too, galaxy/surface/sites/edge.js)
  all['death-star'] = await credit('ds1', 'the Death Star', '/models/universe/death-star.glb', ['galaxy-surface']);
  // (and N8's changed beyond a cut for the web, which a credit says: CREDITS.md)
  all['galaxy-deathstar2'] = await credit('ds2', 'the second Death Star, its hull’s gaps plated over', '/models/galaxy/deathstar2.glb', ['galaxy']);
  const sorted = Object.fromEntries(
    Object.keys(all)
      .sort()
      .map((k) => [k, all[k]]),
  );
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`credits: death-star → ${all['death-star'].author}, galaxy-deathstar2 → ${all['galaxy-deathstar2'].author}`);
}

async function main() {
  const asked = process.argv.slice(2);
  const steps = asked.length ? asked : ['ds1', 'ds2', 'lod', 'credits'];
  if (steps.includes('shots')) {
    const { shots } = await import('./deathstar-hd-shots.mjs');
    await shots(resolve(ROOT, 'docs/superpowers/shots/deathstar-hd'));
    return;
  }
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(CACHE, { recursive: true });
  if (steps.includes('ds1')) await ds1(io);
  if (steps.includes('ds2')) await ds2(io);
  if (steps.includes('lod')) lod();
  if (steps.includes('credits')) await credits();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
