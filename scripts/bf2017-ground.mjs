// A level pack's ground layers (lane Q2: docs/superpowers/specs/2026-10-10-
// bf2017-surfaces-design.md, "The ground"; plan laneQ2-ground): the
// terrain's layer stacks from its `surfaceShaders`, the masks derived from
// the pack's heightmap and its placed meshes (src/lib/three/ground/masks.js),
// written beside the pack as ground.json and ground/masks.png (RGBA, a layer
// a channel, the near map's size). With --fetch, the layer maps the bucket
// holds come into the pack's tex/ at each tier's size, with rows in
// level.json's `tex`; a map the bucket lacks yet prints `missing:` and its
// layer draws without its detail until a run after it lands.
//
//   NODE_USE_ENV_PROXY=1 node scripts/bf2017-ground.mjs hoth [--fetch]
//
// The keys: as scripts/bf2017-fetch.mjs reads them (SUPABASE_URL, and
// BF2017_KEY or SUPA_KEY), never printed.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodeHeights } from '../src/lib/land/layers.js';
import { readInstances } from '../src/lib/level/instances.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { densityOf, fieldOf, masksOf, slopeOf } from '../src/lib/three/ground/masks.js';
import { RULES, groundJson, packMasks, readTextureIndex, slugOf } from './lib/bf2017-ground.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = join(ROOT, 'lab/assets/bf2017/web');
// metres round a pixel its placed meshes are counted over, and the meshes a
// square metre that count as an apron's full density (the hangar's mouth
// holds several; the open field none)
const DENSITY = { radius: 12, full: 0.08 };
// a layer map's size per tier: the detail tiles every few metres, so a
// 1,024 px map is already 4 mm a pixel; low draws no detail at all
const GROUND_TEX = { low: 256, mid: 512, high: 1024, ultra: 2048 };

const args = process.argv.slice(2);
const world = args.find((a) => !a.startsWith('--'));
const wantFetch = args.includes('--fetch');
if (!world || !RULES[world]) {
  console.error(`usage: node scripts/bf2017-ground.mjs <${Object.keys(RULES).join('|')}> [--fetch]`);
  process.exit(1);
}
const PACK = join(ROOT, 'public/models/galaxy/bf2017/levels', world);

// one bucket object into lab/assets/bf2017/web/, through the fetch (its
// pool, its retries); its local path, or null where the bucket lacks it
async function raw(path) {
  const local = join(LAB, path);
  if (!existsSync(local) || (await stat(local)).size === 0) {
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts/bf2017-fetch.mjs'), '--raw', path], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });
    } catch {
      return null;
    }
  }
  return existsSync(local) && (await stat(local)).size > 0 ? local : null;
}

const pack = JSON.parse(await readFile(join(PACK, 'level.json'), 'utf8'));
const name = pack.map.split('/').pop();
const scatterPath = `maps/terrain_scatter/${pack.map}/${name}_terrain/${name}_terrain.json`;
const scatterFile = await raw(scatterPath);
if (!scatterFile) throw new Error(`the bucket has no ${scatterPath}`);
const scatter = JSON.parse(await readFile(scatterFile, 'utf8'));
const indexFile = await raw('textures.jsonl');
if (!indexFile) throw new Error('the bucket has no textures.jsonl');
const index = readTextureIndex(await readFile(indexFile, 'utf8'));

// the heightmap, in metres, in the site's frame
const t = pack.terrain;
const png = await decodePng16(await readFile(join(PACK, t.near.png)));
const heights = decodeHeights(png.data, t.scale, t.offset, { hole: t.hole });
const frame = {
  w: png.w,
  h: png.h,
  minX: t.near.min[0],
  minZ: t.near.min[1],
  metresPerPixel: t.near.metresPerPixel,
};

// every placed mesh's x, z (the far list is the whole arena's table)
const inst = readInstances(new Uint8Array(await readFile(join(PACK, pack.far.bin))));
const points = new Float32Array(inst.count * 2);
for (let i = 0; i < inst.count; i++) {
  points[i * 2] = inst.position[i * 3];
  points[i * 2 + 1] = inst.position[i * 3 + 2];
}

const spec = RULES[world];
const slope = slopeOf(heights, frame);
const field = fieldOf(heights, frame);
const density = densityOf(points, frame, DENSITY);
const masks = masksOf(spec.rules, { heights, slope, field, density, frame });
const ids = spec.rules.map((r) => r.layer);
await mkdir(join(PACK, 'ground'), { recursive: true });
// (written at half the near map's resolution, 2 m a texel: the masks blend
// over metres, and the full 2,561² was 2.8 MB against the plan's 2)
const half = { w: Math.ceil(frame.w / 2), h: Math.ceil(frame.h / 2) };
const maskFrame = {
  ...half,
  minX: frame.minX,
  minZ: frame.minZ,
  metresPerPixel: (frame.metresPerPixel * (frame.w - 1)) / (half.w - 1),
};
await sharp(
  Buffer.from(
    packMasks(
      ids.map((id) => masks[id]),
      frame.w * frame.h,
    ),
  ),
  { raw: { width: frame.w, height: frame.h, channels: 4 } },
)
  .resize(half.w, half.h, { kernel: 'linear' })
  .png({ compressionLevel: 9 })
  .toFile(join(PACK, 'ground/masks.png'));
const share = Object.fromEntries(ids.map((id) => [id, +(masks[id].reduce((a, b) => a + b, 0) / masks[id].length).toFixed(4)]));

// the layer maps (and the sparkle) the bucket holds, at each tier's size
const have = {};
const wanted = [...Object.values(spec.layers), ...(spec.sparkle ? [...new Set(Object.values(scatter.surfaceShaders).flat())].filter((n) => /sparkle/i.test(n)).map((n) => n.split('/').pop()) : [])];
if (wantFetch) {
  for (const n of wanted) {
    const file = index.get(n)?.file;
    if (!file) {
      console.log(`missing: ${n} (not in textures.jsonl)`);
      continue;
    }
    const base = file.replace(/\.png$/, '');
    // (the desktop's encode writes <name>.ktx2; a mesh's import split a
    // normal map into <name>__normal.ktx2)
    let got = null;
    for (const c of [`${base}.ktx2`, `${base}__normal.ktx2`]) if ((got = await raw(c))) break;
    if (!got) {
      console.log(`missing: ${n}`);
      continue;
    }
    const buf = new Uint8Array(await readFile(got));
    const info = ktx2Info(buf);
    const slug = slugOf(n);
    const sizes = {};
    for (const [tier, want] of Object.entries(GROUND_TEX)) {
      const size = Math.min(want, info.width);
      const out = join(PACK, 'tex', `${slug}.${size}.ktx2`);
      if (!existsSync(out)) await writeFile(out, dropMips(buf, Math.min(mipsToFit(info.width, size), info.levels - 1)));
      sizes[tier] = size;
    }
    pack.tex[slug] = sizes;
    have[slug] = `tex/${slug}.ktx2`;
    console.log(`fetched: ${n} (${info.width} px) → tex/${slug}.<${[...new Set(Object.values(sizes))].join('|')}>.ktx2`);
  }
}

const ground = groundJson({
  world,
  scatter,
  index,
  have,
  masks: { png: 'ground/masks.png', ...maskFrame, share },
});
await writeFile(join(PACK, 'ground.json'), JSON.stringify(ground, null, 1) + '\n');
pack.ground = 'ground.json';
await writeFile(join(PACK, 'level.json'), JSON.stringify(pack) + '\n');
const bytes = (await stat(join(PACK, 'ground/masks.png'))).size;
console.log(`${world}: ${ground.combos} layer combinations; layers ${ids.join(', ')}; share ${JSON.stringify(share)}; masks.png ${(bytes / 1e6).toFixed(2)} MB`);
if (ground.missing.length) console.log(`missing: ${ground.missing.length} map(s), the layers draw without them until a re-run: ${ground.missing.join(', ')}`);
