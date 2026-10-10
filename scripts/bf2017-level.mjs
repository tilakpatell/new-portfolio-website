// A level pack from the Battlefront II (2017) drop (lane L: docs/superpowers/
// plans/2026-10-10-bf2017-phaseL-levels.md, task 2): the game's map, its
// terrain and its meshes, cut for the site and written under
// public/models/galaxy/bf2017/levels/<world>/, which scripts/assets-upload.mjs
// mirrors to the bucket. The work is in scripts/lib/bf2017-level.mjs (pure,
// tested); this fetches, reads and writes.
//
//   node scripts/bf2017-level.mjs <map> --world <id> --spot <x> <z> [--subs a,b] [--arena 1024] [--yaw 0] [--ultra] [--dry]
//
//   map     the map's folder under web/maps/ (levels/mp/hoth_01)
//   world   the site's world (hoth): the pack's folder and its credit
//   spot    the game's x and z that become the site's 0, 0 (the landing spot)
//   subs    the sub-levels that are the arena (default: the level's own and Content)
//   arena   the pack's half-size in metres; instances beyond it are the horizon
//   ultra   the LOD0 cut and 2048 textures as well
//   dry     the table only: fetches the map, terrain and manifest, writes nothing
//
// The keys as the fetch takes them (SUPABASE_URL, BF2017_KEY or SUPA_KEY),
// never printed. A map the bucket has not got yet is said so and exits 3:
// the uploader sends the maps in passes.

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET_ROWS } from '../src/lib/budgets.js';
import { LAYERS } from '../src/lib/land/layers.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { getObject, keys } from './bf2017-fetch.mjs';
import { parseArgs } from './lib/args.mjs';
import { writeCredit } from './lib/catalog-write.mjs';
import { readManifest } from './lib/bf2017-manifest.mjs';
import { glbJson, imagePath, imageUris, inBucket } from './lib/bf2017-paths.mjs';
import { buildPack, cropHeights, heightsLayer, meshCuts, readMap, rewriteImageUris, terrainFrame } from './lib/bf2017-level.mjs';
import { ktx2Info, dropMips, mipsToFit } from './lib/ktx2-mips.mjs';
import { encodePng16 } from './lib/png16.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab', 'assets', 'bf2017');
const PERMISSION = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
// the texture sizes by tier (the design: 512 low, 1024 mid and high, 2048 ultra)
const TEX = { low: 512, mid: 1024, high: 1024, ultra: 2048 };
const CUTS = ['far', 'lod1', 'plain', 'ultra'];

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const lastOf = (p) => p.split('/').pop();

async function need(env, path, what) {
  const r = await getObject(env, CACHE, path);
  if (r.state === 'missing') {
    console.error(`${path}: not in the bucket yet (${what}). The uploader sends in passes: try again in ten minutes.`);
    process.exit(3);
  }
  return readFile(r.file);
}

// A terrain record by its name, from web/terrain.jsonl
async function terrainRecord(env, name) {
  const text = (await need(env, 'web/terrain.jsonl', 'the terrain records')).toString('utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (String(r.name).toLowerCase() === String(name).toLowerCase()) return r;
  }
  return null;
}

// The pack's two heightmaps in the site's frame: near at 1 m a pixel over the
// arena and 256 m round it, far at 2 m over the whole world map; heights
// rebased so the spot's ground is 0
async function writeTerrain(env, record, { spot, groundY, arena, out, dry }) {
  const f = terrainFrame(record);
  const src = (await decodePng16(await need(env, inBucket(record.world.png), 'the world heightmap'))).data;
  const nearSize = 2 * (arena + 256);
  const near = cropHeights(src, f, { minX: spot[0] - arena - 256, minZ: spot[1] - arena - 256, size: nearSize, metresPerPixel: 1 });
  const far = cropHeights(src, f, { minX: f.minX, minZ: f.minZ, size: (f.w - 1) * f.metresPerPixel, metresPerPixel: 2 });
  const nearPng = encodePng16(near.data, near.w, near.h);
  const farPng = encodePng16(far.data, far.w, far.h);
  if (!dry) {
    await mkdir(join(out, 'terrain'), { recursive: true });
    await writeFile(join(out, 'terrain', 'near.png'), nearPng);
    await writeFile(join(out, 'terrain', 'far.png'), farPng);
  }
  return {
    json: {
      near: { png: 'terrain/near.png', metresPerPixel: 1, min: [-arena - 256, -arena - 256], size: [near.w, near.h] },
      far: { png: 'terrain/far.png', metresPerPixel: 2, min: [f.minX - spot[0], f.minZ - spot[1]], size: [far.w, far.h] },
      scale: f.scale,
      offset: f.offset - groundY,
      hole: f.hole,
    },
    bytes: { near: nearPng.length, far: farPng.length },
  };
}

// Each texture once, as the bucket encoded it, its mips dropped to each
// tier's size: tex/<slug>.<size>.ktx2. The meshes name tex/<slug>.ktx2 and
// the scene puts the tier's size in as it loads them.
async function writeTextures(env, uris, { out, ultra, dry }) {
  const sizes = [...new Set(Object.entries(TEX).filter(([t]) => ultra || t !== 'ultra').map(([, s]) => s))];
  const slugs = new Map();
  const bytes = Object.fromEntries(sizes.map((s) => [s, 0]));
  const missing = [];
  for (const uri of uris) {
    let slug = lastOf(uri).replace(/\.ktx2$/, '').toLowerCase();
    if ([...slugs.values()].includes(slug)) slug = `${slug}_${slugs.size}`;
    slugs.set(uri, slug);
    const r = await getObject(env, CACHE, uri);
    if (r.state === 'missing') {
      missing.push(uri);
      continue;
    }
    const buf = await readFile(r.file);
    const width = ktx2Info(buf).width;
    for (const size of sizes) {
      const k = dropMips(buf, Math.min(mipsToFit(width, size), ktx2Info(buf).levels - 1));
      bytes[size] += k.length;
      if (!dry) {
        await mkdir(join(out, 'tex'), { recursive: true });
        await writeFile(join(out, 'tex', `${slug}.${size}.ktx2`), k);
      }
    }
  }
  return { slugs, bytes, missing };
}

async function main(args) {
  const [mapName] = args._;
  const world = args.world;
  const spot = [Number(args.spot), Number(args._[1])];
  if (!mapName || !world || spot.some(Number.isNaN)) {
    console.error('usage: node scripts/bf2017-level.mjs <map> --world <id> --spot <x> <z> [--subs a,b] [--arena 1024] [--yaw 0] [--ultra] [--dry]');
    process.exit(1);
  }
  const env = keys();
  const arena = Number(args.arena ?? 1024);
  const yaw = Number(args.yaw ?? 0);
  const ultra = Boolean(args.ultra);
  const dry = Boolean(args.dry);
  const subs = typeof args.subs === 'string' ? args.subs.split(',') : null;
  const out = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', world);
  if (yaw) throw new Error('--yaw: the heightmaps are not turned yet; keep the level square to the site');

  const base = `web/maps/${mapName}/${lastOf(mapName)}`;
  const map = readMap(JSON.parse((await need(env, `${base}.json`, 'the map')).toString('utf8')), await need(env, `${base}.bin`, 'the map’s instances'));
  console.log(`${mapName}: ${map.instances.count} instances, ${map.meshes.length} meshes, subs ${map.subworlds.map(lastOf).join(', ')}`);
  console.log(`vehicle spawns: ${map.vehicleSpawns.map((v) => `${v.name ?? '?'} ${v.position?.map((n) => Math.round(n)).join(' ')}`).join(' · ') || 'none'}`);

  const record = map.terrain ? await terrainRecord(env, map.terrain) : null;
  if (!record) console.log(`terrain ${map.terrain}: no record; the ground stays the site's`);
  const layer = record ? await heightsLayer(record, await need(env, inBucket(record.world.png), 'the world heightmap')) : null;
  const groundY = layer ? LAYERS.image(spot[0], spot[1], layer) : 0;

  // the meshes: the manifest's chains, the four cuts, their triangles
  const manifest = readManifest((await need(env, 'web/models.jsonl', 'the model manifest')).toString('utf8'));
  const byLower = new Map([...manifest].map(([k, v]) => [k.toLowerCase(), v]));
  const meshes = map.meshes.map((m) => {
    const entry = manifest.get(m.name) ?? byLower.get(m.name.toLowerCase()) ?? byLower.get(m.name.toLowerCase().replace(/^models\//, '').replace(/\.glb$/, ''));
    if (!entry) return { name: m.name, missing: true, tris: { far: 0, lod1: 0, plain: 0, ultra: 0 }, bounds: [0, 0, 0, 0, 0, 0], mats: 1 };
    const cuts = meshCuts(entry, { ultra });
    return { name: entry.name, entry, cuts, tris: Object.fromEntries(CUTS.map((c) => [c, cuts[c].triangles])), bounds: [...entry.min, ...entry.max], mats: entry.sections ?? 1 };
  });
  const absent = meshes.filter((m) => m.missing);
  if (absent.length) console.log(`${absent.length} meshes not in the manifest (drawn as nothing): ${absent.slice(0, 5).map((m) => m.name).join(', ')}${absent.length > 5 ? ' …' : ''}`);

  // the GLBs: each cut once, its images pointing at the pack's textures
  const glbBytes = Object.fromEntries(CUTS.map((c) => [c, 0]));
  const uris = new Set();
  const glbs = [];
  if (!dry) {
    for (const m of meshes) {
      if (m.missing) continue;
      m.glb = {};
      const slug = lastOf(m.name).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      for (const cut of CUTS) {
        const lod = m.cuts[cut];
        const path = `meshes/${slug}.lod${lod.lod}.glb`;
        m.glb[cut] = path;
        if (glbs.some((g) => g.path === path)) continue;
        const r = await getObject(env, CACHE, inBucket(lod.file));
        if (r.state === 'missing') {
          console.log(`${lod.file}: missing`);
          continue;
        }
        const buf = await readFile(r.file);
        for (const u of imageUris(buf, inBucket(lod.file))) uris.add(u);
        glbs.push({ path, buf, from: inBucket(lod.file), cut });
      }
    }
  }
  const tex = dry ? { slugs: new Map(), bytes: {}, missing: [] } : await writeTextures(env, [...uris], { out, ultra, dry });
  if (!dry) {
    await rm(join(out, 'meshes'), { recursive: true, force: true });
    await mkdir(join(out, 'meshes'), { recursive: true });
    for (const g of glbs) {
      const fixed = rewriteImageUris(g.buf, (uri) => {
        const abs = imagePath(uri, g.from);
        return `../tex/${tex.slugs.get(abs) ?? lastOf(abs).replace(/\.ktx2$/, '')}.ktx2`;
      });
      glbBytes[g.cut] += fixed.length;
      await writeFile(join(out, g.path), fixed);
      glbJson(fixed); // (a GLB that does not parse back is a bug here, not a file to ship)
    }
  }

  const terrain = record ? await writeTerrain(env, record, { spot, groundY, arena, out, dry }) : null;
  const pack = buildPack({ world, mapName, map, spot, groundY, meshes, arena, rows: ultra ? BUDGET_ROWS : { low: BUDGET_ROWS.low, mid: BUDGET_ROWS.mid, high: BUDGET_ROWS.high }, subs, terrain: terrain?.json ?? null });

  // the table
  const rows = [];
  rows.push(`| | ${Object.keys(pack.table).join(' | ')} |`, `|---|${Object.keys(pack.table).map(() => '---').join('|')}|`);
  rows.push(`| near meshes dropped | ${Object.values(pack.table).map((t) => t.dropped.length).join(' | ')} |`);
  rows.push(`| near instances dropped | ${Object.values(pack.table).map((t) => t.dropped.reduce((a, d) => a + d.count, 0)).join(' | ')} |`);
  rows.push(`| far list meshes dropped | ${Object.values(pack.table).map((t) => t.farDropped.length).join(' | ')} |`);
  rows.push(`| texture bytes | ${Object.keys(pack.table).map((t) => mb(tex.bytes[TEX[t]] ?? 0)).join(' | ')} |`);
  const farBytes = pack.files.get('far.bin').byteLength;
  const lines = [
    `# ${world}: the game's level`,
    '',
    `From \`${mapName}\` (Star Wars Battlefront II, 2017, EA DICE; ${PERMISSION.split(';')[0].replace('From EA DICE’s Star Wars Battlefront II (2017), ', '')}). Written by \`node scripts/bf2017-level.mjs ${process.argv.slice(2).join(' ')}\`; do not edit by hand.`,
    '',
    `- ${pack.counts.arena} instances in the arena (±${arena} m), ${pack.counts.horizon} beyond it (the horizon), ${pack.counts.cells} cells of ${pack.json.cell} m`,
    `- ${meshes.length} meshes (${absent.length} not in the manifest), GLB bytes by cut: ${CUTS.map((c) => `${c} ${mb(glbBytes[c])}`).join(', ')}`,
    `- the far list ${mb(farBytes)}; terrain ${terrain ? `near ${mb(terrain.bytes.near)}, far ${mb(terrain.bytes.far)}` : 'none'}; the spot's ground ${groundY.toFixed(2)} m in the game`,
    `- textures missing from the bucket: ${tex.missing.length}`,
    '',
    ...rows,
    '',
    ...Object.entries(pack.table).flatMap(([t, v]) => (v.dropped.length ? [`Dropped on ${t}: ${v.dropped.map((d) => `${lastOf(d.name)} ×${d.count}`).join(', ')}`, ''] : [])),
  ];
  console.log(lines.join('\n'));
  if (dry) return;

  await mkdir(join(out, 'cells'), { recursive: true });
  for (const [path, bin] of pack.files) await writeFile(join(out, path), Buffer.from(bin));
  await writeFile(join(out, 'level.json'), `${JSON.stringify(pack.json)}\n`);
  await writeFile(join(out, 'README.md'), `${lines.join('\n')}\n`);
  await writeCredit(join(ROOT, 'src', 'data', 'modelCredits.json'), `level-${world}`, {
    title: `Star Wars Battlefront II (2017): ${mapName}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy-surface',
    as: `${world}: the game's level`,
    file: relative(ROOT, join(out, 'level.json')).split('\\').join('/'),
    also: ['galaxy'],
    permission: PERMISSION,
  });
  console.log(`wrote ${relative(ROOT, out)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(CACHE)) await mkdir(CACHE, { recursive: true });
  await main(parseArgs(process.argv.slice(2))).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
