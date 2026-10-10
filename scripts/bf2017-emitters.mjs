#!/usr/bin/env node
// The game's effects read into the site's effect tables (fidelity lane X):
// each `EffectBlueprint` and its emitter documents to
// `src/data/bf2017/fx/<Effect>.json` (scripts/lib/bf2017-emitters.mjs says
// how each field is read), the textures they name to
// `src/data/bf2017/fx/_textures.json`, and what the reader kept under `raw`
// to stdout, for the PR.
//
//   node scripts/bf2017-emitters.mjs <effect name>… | --level hoth [--map levels/mp/hoth_01]
//     [--root C:/Users/tilak/Downloads/BF2_Extract] [--bucket] [--out src/data/bf2017/fx] [--dry]
//
// An effect is named as the export names it (`FX/Ambient/Snow/FX_Snow_
// FallingSnow_01_Hoth`) or by its last part. --level reads the map's extras
// (`web/maps/<map>/<name>.extras.json`, `effects[]`) and takes every effect
// it spawns.
//
// Where it reads: --root, the export on the desktop (`web/data.tsv` and the
// files it lists under `web/`); else --bucket, the private bf2017-assets
// bucket (`data/<Name>.json.gz`, the records by name; `web/data.tsv` there,
// when it is, for the EmitterGraphs' replacements), with SUPABASE_URL and
// BF2017_KEY (or SUPA_KEY) from .env.local or the environment, never
// printed. The fixtures: --root scripts/fixtures/bf2017/fx.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { effectJson, emitterRefs, fileName, nearestDocument, rawReport, readIndex } from './lib/bf2017-emitters.mjs';
import { dataPath, objectUrl } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const stop = (why, code = 2) => {
  console.error(why);
  process.exit(code);
};
const flagged = new Set(['level', 'map', 'root', 'out'].flatMap((k) => [arg(k)]).filter(Boolean));
const names = argv.filter((a) => !a.startsWith('--') && !flagged.has(a));
const level = arg('level');
if (!names.length && !level) stop('usage: node scripts/bf2017-emitters.mjs <effect>… | --level <world> [--map levels/mp/<map>] [--root <export>] [--bucket] [--out dir] [--dry]');
const dry = argv.includes('--dry');
const outDir = arg('out') ?? join(ROOT, 'src/data/bf2017/fx');

// ── where the records are ──
function keys() {
  const file = join(ROOT, '.env.local');
  let from = 'the environment';
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    from = '.env.local';
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) stop(`no export and no bucket key: pass --root <export>, or set SUPABASE_URL and BF2017_KEY in .env.local (read: ${from})`);
  console.log(`keys from ${from}`);
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

function source() {
  const root = arg('root');
  if (root) {
    if (!existsSync(join(root, 'web/data.tsv'))) stop(`no web/data.tsv under ${root}`);
    const index = readIndex(readFileSync(join(root, 'web/data.tsv'), 'utf8'));
    const file = (p) => join(root, 'web', p);
    return {
      index,
      from: root,
      async record(name) {
        const row = index.get(name.toLowerCase()) ?? [...index.values()].find((r) => r.name.toLowerCase().endsWith(`/${name.toLowerCase()}`));
        if (!row || !existsSync(file(row.path))) return null;
        return JSON.parse(readFileSync(file(row.path), 'utf8'));
      },
      async extras(map) {
        const p = join(root, 'web/maps', map, `${map.split('/').pop()}.extras.json`);
        return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
      },
    };
  }
  if (!argv.includes('--bucket')) stop('say where the export is: --root <export> on the desktop, or --bucket with the key');
  const env = keys();
  const get = async (path) => {
    const res = await fetch(objectUrl(env.base, BUCKET, path), { headers: env.headers });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  };
  return (async () => {
    const tsv = await get('web/data.tsv');
    const index = tsv ? readIndex(tsv.toString('utf8')) : new Map();
    if (!tsv) console.log('no web/data.tsv in the bucket: EmitterGraphs will be listed as missing');
    return {
      index,
      from: `the bucket ${BUCKET}`,
      async record(name) {
        const full = index.get(name.toLowerCase())?.name ?? name;
        const gz = await get(dataPath(full));
        return gz ? JSON.parse(gunzipSync(gz).toString('utf8')) : null;
      },
      async extras(map) {
        const buf = await get(`web/maps/${map}/${map.split('/').pop()}.extras.json`);
        return buf ? JSON.parse(buf.toString('utf8')) : null;
      },
    };
  })();
}

const src = await source();
console.log(`reading from ${src.from}`);
let wanted = names;
if (level) {
  const map = arg('map') ?? `levels/mp/${level}_01`;
  const extras = await src.extras(map);
  if (!extras) stop(`no extras for ${map}`, 1);
  const counts = {};
  for (const e of extras.effects ?? []) {
    const n = e.blueprint ?? e.Blueprint ?? e.name ?? e.effect;
    if (n) counts[n] = (counts[n] ?? 0) + 1;
  }
  wanted = Object.keys(counts);
  console.log(`${map}: ${extras.effects?.length ?? 0} effect spawns of ${wanted.length} effects`);
}

// the documents an effect names, each read once
const docs = new Map();
const effects = [];
const notFound = [];
for (const name of wanted) {
  const bp = await src.record(name);
  if (!bp || bp.$type !== 'EffectBlueprint') {
    notFound.push(name);
    continue;
  }
  for (const ref of emitterRefs(bp)) {
    const key = ref.toLowerCase();
    if (!docs.has(key)) docs.set(key, await src.record(ref));
    if (docs.get(key)?.$type === 'EmitterGraph') {
      const near = nearestDocument(src.index, ref);
      if (near && !docs.has(near.name.toLowerCase())) docs.set(near.name.toLowerCase(), await src.record(near.name));
    }
  }
  for (const [k, v] of docs) if (!v) docs.delete(k);
  effects.push(effectJson(bp, docs, src.index));
}

const graphs = effects.filter((fx) => fx.graph).map((fx) => `${fx.name} (${fx.emitters.filter((e) => e.graph).map((e) => `${e.graphOf.split('/').pop()} → ${e.name.split('/').pop()}`).join(', ')})`);
const textures = {};
for (const fx of effects) for (const t of fx.textures) (textures[t] ??= []).push(fx.name);
console.log(`${effects.length} effects read, ${effects.reduce((n, fx) => n + fx.emitters.length, 0)} emitters, ${Object.keys(textures).length} textures`);
if (notFound.length) console.log(`not found: ${notFound.join(', ')}`);
const missing = effects.flatMap((fx) => fx.missing);
if (missing.length) console.log(`emitters missing: ${[...new Set(missing)].join(', ')}`);
console.log(`graph: true (${graphs.length}): ${graphs.join('; ') || 'none'}`);
console.log('kept under raw:');
for (const [k, v] of Object.entries(rawReport(effects))) console.log(`  ${k}: ${v.length} effect${v.length === 1 ? '' : 's'}`);
if (dry) process.exit(0);
mkdirSync(outDir, { recursive: true });
for (const fx of effects) writeFileSync(join(outDir, fileName(fx.path)), `${JSON.stringify(fx, null, 1)}\n`);
writeFileSync(join(outDir, '_textures.json'), `${JSON.stringify(textures, null, 1)}\n`);
console.log(`wrote ${effects.length} effects and _textures.json to ${outDir}`);
