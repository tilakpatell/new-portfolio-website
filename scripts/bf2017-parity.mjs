#!/usr/bin/env node
// The parity ledger (the galaxy-on-the-game design's decision 8, lane G6):
// one row per level × mode the site plays, scored by what of it is the
// game's. scripts/lib/bf2017-parity.mjs decides; this reads the tree.
//
//   node scripts/bf2017-parity.mjs            writes ledger.md and ledger.json
//   node scripts/bf2017-parity.mjs --check    compares to the committed
//                                             ledger.json; exits 1 when a
//                                             row's score fell or a done sim
//                                             went missing (CI runs this)
//   node scripts/bf2017-parity.mjs --status   prints the hand-off's table
//
// It reads: the levels and their modes (src/data/bf2017/frontend.json, lane
// G1, else modes.json), the map rulebooks and the hand files beside them
// (maps/<name>.json, maps/<name>.<mode>.json), the sim's modes
// (src/lib/battlefront/modes/<id>.js) and what the world builds
// (src/components/battlefront/index.js: BUILT, else LEVELS × MODES), the HUD
// parts' widget names (src/components/battlefront/hud/), the team records,
// what battle.js offers on the deploy screen, points.json's source, the
// packs (public/models/galaxy/bf2017/levels/**/level.json, galaxyAssets.json)
// and every evidence folder's check.json. Space levels are left out: their
// battles run on the galaxy's fleet sim (decision 9).
//
// The rows are keyed by the game's level key (hoth_01), so they join the
// accuracy design's per-map ledger (#877's maps lane) by level when it lands.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { MAP_PIECES, checkGreen, checkLedger, ledgerMarkdown, ledgerRows, levelKey, packPieces, routeOf, statusBlock, totalsOf } from './lib/bf2017-parity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const OUT = join(ROOT, args.out ?? 'docs/superpowers/evidence/bf2017-parity');
const DATA = join(ROOT, 'src/data/bf2017');
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const text = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const SPACE = new Set(['starfighter', 'heroStarfighters']);

function levelsOf() {
  const front = join(DATA, 'frontend.json');
  const src = existsSync(front) ? json(front) : json(join(DATA, 'modes.json'));
  const raw = src.rows?.levels ?? src.levels ?? {};
  const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([key, v]) => ({ key, ...v }));
  return list
    .map((l) => ({ key: (l.key ?? l.id).toLowerCase(), world: l.world ?? l.system ?? null, modes: (l.modes ?? []).filter((m) => !SPACE.has(m)) }))
    .filter((l) => !l.key.startsWith('sb_') && l.modes.length)
    .sort((a, b) => a.key.localeCompare(b.key));
}

function mapsAndHands() {
  const maps = {};
  const hands = [];
  const dir = join(DATA, 'maps');
  const named = {}; // a file's short name → the game's key (hoth → hoth_01)
  for (const f of readdirSync(dir).filter((n) => /^[a-z0-9_]+\.json$/.test(n))) {
    const d = json(join(dir, f));
    if (!d.rows?.level) continue;
    const key = levelKey(d.rows.level);
    maps[key] = d.rows;
    named[f.replace(/\.json$/, '')] = key;
  }
  for (const f of readdirSync(dir).filter((n) => /^[a-z0-9_]+\.[A-Za-z]+\.json$/.test(n))) {
    const [name, part] = f.split('.');
    if (part === 'lighting') continue;
    const d = json(join(dir, f));
    const key = d.level ? levelKey(d.level) : (named[name] ?? name);
    hands.push(`${key}.${d.mode ?? part}`);
  }
  return { maps, hands };
}

// BUILT from the world's face, else LEVELS × MODES (lane 5's two lists)
function builtOf(keys) {
  const src = text(join(ROOT, 'src/components/battlefront/index.js'));
  const list = (name) => [...(src.match(new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const resolve = (n) => (keys.includes(n) ? n : keys.find((k) => k.startsWith(`${n}_`)));
  const out = {};
  const built = src.match(/export const BUILT\s*=\s*\{([\s\S]*?)\n\};/);
  if (built) {
    for (const m of built[1].matchAll(/['"]?([a-z0-9_]+)['"]?\s*:\s*\[([^\]]*)\]/g)) {
      const k = resolve(m[1]);
      if (k) out[k] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    }
    return out;
  }
  const modes = list('MODES');
  for (const l of list('LEVELS')) {
    const k = resolve(l);
    if (k) out[k] = modes;
  }
  return out;
}

function hudDrawn() {
  const widgets = Object.keys(json(join(DATA, 'ui.json')).rows.widgets);
  const dir = join(ROOT, 'src/components/battlefront/hud');
  const src = readdirSync(dir).filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f)).map((f) => text(join(dir, f))).join('\n');
  return widgets.filter((w) => new RegExp(`\\b${w}\\b`).test(src));
}

function offeredKinds() {
  const src = text(join(ROOT, 'src/components/battlefront/battle.js'));
  const body = src.match(/function offers\([\s\S]*?\n\}/)?.[0] ?? '';
  return [...new Set([...body.matchAll(/kind: '([a-z]+)'/g)].map((m) => m[1]))];
}

function teamsOf() {
  const out = {};
  for (const [id, row] of Object.entries(json(join(DATA, 'teams.json')).rows)) {
    const [era, key] = id.split(':');
    if (era === 'Orig' && key) out[key] = row;
  }
  return out;
}

function packsOf() {
  const base = join(ROOT, 'public/models/galaxy/bf2017/levels');
  const assets = existsSync(join(ROOT, 'src/data/galaxyAssets.json')) ? Object.keys(json(join(ROOT, 'src/data/galaxyAssets.json'))) : [];
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 3 || !existsSync(dir)) return;
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (n === 'level.json') found.push(p);
      else if (statSync(p).isDirectory() && !['cells', 'meshes', 'tex', 'terrain', 'ground'].includes(n)) walk(p, depth + 1);
    }
  };
  walk(base, 0);
  const out = {};
  for (const p of found) {
    const pack = json(p);
    if (!pack.map) continue;
    const key = levelKey(pack.map);
    const dir = dirname(p);
    const rel = dir.slice(join(ROOT, 'public').length + 1).replaceAll('\\', '/');
    const whole = pack.whole === true || /\/game\//.test(rel);
    const cell = Object.values(pack.cells ?? {})[0]?.bin;
    const published = Boolean(cell && (existsSync(join(dir, cell)) || assets.some((a) => a.startsWith(`${rel}/`))));
    const row = { kind: whole ? 'whole' : 'roam', published, pieces: packPieces(pack) };
    // a whole pack beats a roam cut of the same level
    if (!out[key] || (whole && out[key].kind !== 'whole')) out[key] = row;
  }
  return out;
}

function evidenceOf(keys) {
  const base = join(ROOT, 'docs/superpowers/evidence');
  const out = new Set();
  const walk = (dir, depth) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (n === 'check.json') {
        const c = json(p);
        const at = c.route && routeOf(c.route, keys);
        if (at && checkGreen(c)) out.add(at);
      } else if (depth < 3 && statSync(p).isDirectory()) walk(p, depth + 1);
    }
  };
  walk(base, 0);
  return [...out];
}

const levels = levelsOf();
const keys = levels.map((l) => l.key);
const { maps, hands } = mapsAndHands();
const modesDir = join(ROOT, 'src/lib/battlefront/modes');
const points = json(join(DATA, 'points.json'));
const rows = ledgerRows({
  levels,
  maps,
  hands,
  modes: readdirSync(modesDir).filter((f) => /^[a-zA-Z]+\.js$/.test(f)).map((f) => f.replace(/\.js$/, '')),
  built: builtOf(keys),
  hud: { drawn: hudDrawn() },
  teams: teamsOf(),
  offered: offeredKinds(),
  // the record's costs carry a _source each; a top-level `source: "hand"` is lane 0's hand table
  points: { source: points.source === 'hand' || points.rows?.source === 'hand' ? 'hand' : 'game' },
  packs: packsOf(),
  pieces: MAP_PIECES,
  evidence: evidenceOf(keys),
});
const totals = totalsOf(rows);

if (args.status) {
  console.log(statusBlock(totals));
} else if (args.check) {
  const file = join(OUT, 'ledger.json');
  if (!existsSync(file)) {
    console.error(`no ${file.slice(ROOT.length + 1)}: run node scripts/bf2017-parity.mjs and commit it`);
    process.exit(1);
  }
  const c = checkLedger(json(file), rows);
  console.log(`parity: ${totals.rows} rows, score ${totals.score} of ${totals.max} (committed ${json(file).totals?.score ?? '?'})`);
  for (const r of c.removed) console.log(`  gone (not a failure): ${r}`);
  for (const r of c.regressions) console.error(`  regression: ${r}`);
  if (!c.ok) console.error('the ledger fell: fix the regression, or write a new ledger with `node scripts/bf2017-parity.mjs` and say why in the PR');
  process.exit(c.ok ? 0 : 1);
} else {
  mkdirSync(OUT, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, 'ledger.md'), ledgerMarkdown(rows, { notes: text(join(DATA, 'NOTES.md')), date }));
  writeFileSync(join(OUT, 'ledger.json'), `${JSON.stringify({ date, totals, rows }, null, 1)}\n`);
  console.log(`parity: ${totals.rows} rows on ${totals.levels} levels, score ${totals.score} of ${totals.max}; wrote ${OUT.slice(ROOT.length + 1)}/ledger.md and ledger.json`);
  console.log(statusBlock(totals));
}
