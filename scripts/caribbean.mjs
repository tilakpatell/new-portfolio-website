// The Caribbean page's game assets, into public/games/caribbean/ (committed,
// so the site never calls anyone):
//
//   node scripts/caribbean.mjs sky            the sky, from a CC0 Poly Haven HDRI
//   node scripts/caribbean.mjs models <dir>   the ships, the kraken, the islands
//
// The models were made with Meshy (meshy.ai, the site owner's account): a
// concept image each, then a textured PBR model from the image; the task ids
// are in scripts/caribbean-tasks.json. <dir> holds the GLBs as they came
// (<name>.glb); here they are compressed for the web: textures to WebP at the
// size each is seen at, geometry simplified where it's far off, then meshopt.
// Credits go to public/games/caribbean/credits.json.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'caribbean');
const CREDITS = join(OUT, 'credits.json');
const SKY = 'evening_road_01_puresky';

// color: the base colour map's size; maps: normal and roughness/metalness;
// keep: the share of triangles kept (1 = as Meshy made it)
export const ASSETS = {
  pearl: { color: 2048, maps: 1024, keep: 1, what: 'the black-sailed galleon you sail' },
  navy: { color: 1536, maps: 1024, keep: 0.8, what: 'a navy ship of the line' },
  ghost: { color: 1536, maps: 1024, keep: 1, what: 'the cursed ship' },
  kraken: { color: 1536, maps: 1024, keep: 1, what: 'the kraken' },
  tentacle: { color: 1024, maps: 1024, keep: 0.7, what: 'one of its arms' },
  fort: { color: 1536, maps: 1024, keep: 1, what: 'the sea fort' },
  skull: { color: 1536, maps: 1024, keep: 1, what: 'the skull island' },
  port: { color: 1536, maps: 1024, keep: 1, what: 'the pirate port' },
  palms: { color: 1024, maps: 512, keep: 0.5, what: 'a sandbar with palms' },
  chest: { color: 1024, maps: 512, keep: 0.6, what: 'a treasure chest on a raft' },
};

const loadJson = async (file, fallback) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback);
const credit = async (key, value) => {
  const c = await loadJson(CREDITS, {});
  c[key] = value;
  await mkdir(OUT, { recursive: true });
  await writeFile(CREDITS, `${JSON.stringify(c, null, 2)}\n`);
};

// Radiance HDR into floats (the same reader as scripts/cc0.mjs).
function readHdr(buf) {
  let p = 0;
  const line = () => {
    const e = buf.indexOf(10, p);
    const l = buf.toString('latin1', p, e);
    p = e + 1;
    return l;
  };
  while (line() !== '');
  const [, h, , w] = line().split(' ').map((v, i) => (i % 2 ? Number(v) : v));
  const px = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[p] === 2 && buf[p + 1] === 2 && ((buf[p + 2] << 8) | buf[p + 3]) === w) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < w; ) {
          let n = buf[p++];
          if (n > 128) {
            n -= 128;
            const v = buf[p++];
            while (n--) scan[x++ * 4 + c] = v;
          } else while (n--) scan[x++ * 4 + c] = buf[p++];
        }
      }
    } else for (let i = 0; i < w * 4; i++) scan[i] = buf[p++];
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      for (let c = 0; c < 3; c++) px[(y * w + x) * 3 + c] = scan[x * 4 + c] * f;
    }
  }
  return { w, h, px };
}

const get = async (url, as = 'json') => {
  const r = await fetch(url, { headers: { 'User-Agent': 'tilakpatel-portfolio-build' } });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
};

// The sky you see and the light it gives: the top half of the 4K HDRI and a
// little below the horizon, scaled so the middle of the sky sits near 0.35
// and range-compressed into 8 bits (x / (1 + x), gamma 2.2; the sky shader
// undoes it, so the sun stays far brighter than the clouds).
async function sky() {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${SKY}`), get(`https://api.polyhaven.com/info/${SKY}`)]);
  const src = readHdr(await get(files.hdri['4k'].hdr.url, 'buffer'));
  const rows = src.h / 2 + src.h / 16;
  const lum = (i) => src.px[i] * 0.2126 + src.px[i + 1] * 0.7152 + src.px[i + 2] * 0.0722;
  let sun = 0;
  let sunAt = 0;
  const all = [];
  for (let y = 0; y < src.h / 2; y++)
    for (let x = 0; x < src.w; x += 4) {
      const l = lum((y * src.w + x) * 3);
      all.push(l);
      if (l > sun) [sun, sunAt] = [l, y * src.w + x];
    }
  all.sort((a, b) => a - b);
  const scale = 0.35 / all[all.length >> 1];
  const out = Buffer.alloc(src.w * rows * 3);
  for (let i = 0; i < src.w * rows * 3; i++) {
    const v = (src.px[i] * scale) / (1 + src.px[i] * scale);
    out[i] = Math.round(255 * v ** (1 / 2.2));
  }
  await mkdir(OUT, { recursive: true });
  await sharp(out, { raw: { width: src.w, height: rows, channels: 3 } }).webp({ quality: 90, effort: 6 }).toFile(join(OUT, 'sky.webp'));
  const u = ((sunAt % src.w) + 0.5) / src.w;
  const elevation = 90 - ((Math.floor(sunAt / src.w) + 0.5) / src.h) * 180;
  const made = { source: `https://polyhaven.com/a/${SKY}`, id: SKY, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', size: `${src.w} × ${rows}`, sun: { u: Number(u.toFixed(4)), elevation: Number(elevation.toFixed(2)) }, scale: Number(scale.toFixed(4)) };
  await credit('sky', made);
  console.log(`sky      ${SKY}  ${src.w} × ${rows}  sun at u ${made.sun.u}, ${made.sun.elevation}° up, ×${made.scale}`);
}

async function models(dir) {
  if (!dir) throw new Error('models <dir>: the folder the GLBs were downloaded to');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const tasks = await loadJson(join(ROOT, 'scripts', 'caribbean-tasks.json'), {});
  await mkdir(OUT, { recursive: true });
  for (const [name, a] of Object.entries(ASSETS)) {
    const from = join(dir, `${name}.glb`);
    if (!existsSync(from)) {
      console.log(`skip     ${name} (no ${name}.glb in ${dir})`);
      continue;
    }
    const doc = await io.read(from);
    const tris = () => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
    const before = tris();
    await doc.transform(
      dedup(),
      prune(),
      ...(a.keep < 1 ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: a.keep, error: 0.01 })] : []),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [a.color, a.color], quality: 84 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness/, resize: [a.maps, a.maps], quality: 84 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const to = join(OUT, `${name}.glb`);
    await io.write(to, doc);
    const { size } = await stat(to);
    await credit(`models/${name}`, { source: 'https://www.meshy.ai', id: tasks[name]?.model, name: `${a.what}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' });
    console.log(`model    ${name.padEnd(9)} ${String(Math.round(before)).padStart(6)} → ${String(Math.round(tris())).padStart(6)} tris  ${(size / 1024).toFixed(0).padStart(5)} KB`);
  }
}

const [step, arg] = process.argv.slice(2);
const run = { sky, models: () => models(arg) }[step];
if (!run) {
  console.error('step: sky | models <dir>');
  process.exit(1);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
