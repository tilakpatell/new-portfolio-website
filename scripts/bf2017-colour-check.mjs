// Holds the game's textures on the site to their colour spaces: every KTX2
// under the published packs (public/models/galaxy/bf2017/**/tex/) and any
// folder named must say what it is (scripts/lib/ktx2-colour.mjs: a colour map
// sRGB, a data map linear, by DICE's suffixes), and every surface role made
// from the game (public/textures/galaxy/bf2017/<role>/) must have its three
// maps and its index row. A map tagged wrong is read wrong by every loader
// that trusts the file (three's KTX2Loader does), and came out washed pale.
//
//   node scripts/bf2017-colour-check.mjs [--check] [--fix] [--formats <textures.jsonl>] [folder …]
//
//   check     exit 1 on any map tagged wrong, or a role short of a map
//   fix       stamp the right transfer function into each wrong file in
//             place (a byte; nothing re-encoded) and say how many
//   formats   the bucket's web/textures.jsonl (fetched: `node scripts/bf2017-fetch.mjs --raw textures.jsonl`):
//             each map's game `format` (BC7_SRGB, BC7_UNORM, BC5 …) decides
//             sRGB or linear ahead of the suffix rule, and a map the rule
//             calls unknown gets its answer from here
//
// One line a folder (files, colour sRGB/linear, data linear/sRGB, unknown,
// wrong), one a wrong file, one summary; exit 1 only with --check.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { auditKtx2, stemOf, summarise, withTransfer } from './lib/ktx2-colour.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PACKS = 'public/models/galaxy/bf2017';
const ROLES = 'public/textures/galaxy/bf2017';
const ROLE_MAPS = ['color.webp', 'normal.webp'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.ktx2')) out.push(p);
  }
  return out;
}

// the game's own word on a map, from textures.jsonl: sRGB where its format says so
export function formatsOf(jsonl) {
  const out = new Map();
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const name = String(row.name ?? row.file ?? '').split('/').pop().toLowerCase().replace(/\.(png|ktx2)$/, '');
    const fmt = String(row.format ?? '').toUpperCase();
    if (name && fmt) out.set(name, /SRGB/.test(fmt) ? 'srgb' : 'linear');
  }
  return out;
}

export function auditFolder(dir, { formats = null, fix = false } = {}) {
  const rows = [];
  let fixed = 0;
  for (const file of walk(dir)) {
    const buf = readFileSync(file);
    const name = relative(ROOT, file);
    const row = auditKtx2(name, buf);
    const known = formats?.get(stemOf(name).replace(/__(normal|orm_[0-9a-f]+)$/, ''));
    // (a derived map is data whatever its source's format; the game's format decides the rest)
    if (known && !/__(normal|orm_)/.test(stemOf(name))) {
      row.wanted = known;
      row.kind = known === 'srgb' ? 'colour' : 'data';
      row.ok = row.transfer === known;
    }
    if (!row.ok && fix) {
      writeFileSync(file, withTransfer(buf, row.wanted));
      row.transfer = row.wanted;
      row.ok = true;
      row.fixed = true;
      fixed++;
    }
    rows.push(row);
  }
  return { rows, fixed, summary: summarise(rows) };
}

// every role in the index has its maps on disk, and every folder its row
export function auditRoles(dir) {
  const problems = [];
  const indexFile = join(dir, 'index.json');
  if (!existsSync(indexFile)) return { roles: 0, problems: [`${relative(ROOT, dir)}: no index.json`] };
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  for (const [role, row] of Object.entries(index)) {
    for (const m of [...ROLE_MAPS, ...(row.arm ? ['arm.webp'] : [])]) if (!existsSync(join(dir, role, m))) problems.push(`${role}: ${m} missing`);
    if (row.license !== 'permission' || !row.authors?.includes('EA DICE')) problems.push(`${role}: not credited as EA DICE’s, used with permission`);
    if (!(row.metres > 0) || !(row.mean > 0 && row.mean <= 1)) problems.push(`${role}: metres or mean out of range`);
  }
  for (const f of readdirSync(dir)) {
    if (f === 'index.json' || f === 'light' || !statSync(join(dir, f)).isDirectory()) continue;
    if (!index[f]) problems.push(`${f}: a folder with no index row`);
  }
  return { roles: Object.keys(index).length, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const formats = args.formats ? formatsOf(readFileSync(resolve(args.formats), 'utf8')) : null;
  const folders = args._.length ? args._.map((f) => resolve(f)) : [join(ROOT, PACKS)];
  let wrong = 0;
  for (const dir of folders) {
    const { summary: s, fixed, rows } = auditFolder(dir, { formats, fix: Boolean(args.fix) });
    console.log(`${relative(ROOT, dir).padEnd(40)} ${String(s.files).padStart(5)} files  colour sRGB ${s.colour.srgb} linear ${s.colour.linear}  data linear ${s.data.linear} sRGB ${s.data.srgb}  unknown ${s.unknown}  wrong ${s.wrong.length}${fixed ? `  fixed ${fixed}` : ''}`);
    for (const r of rows.filter((x) => !x.ok)) console.log(`  wrong  ${r.name}: ${r.kind} tagged ${r.transfer}, wants ${r.wanted}`);
    wrong += s.wrong.length;
  }
  const roles = auditRoles(join(ROOT, ROLES));
  console.log(`${ROLES.padEnd(40)} ${String(roles.roles).padStart(5)} roles  ${roles.problems.length ? roles.problems.length + ' problems' : 'whole'}`);
  for (const p of roles.problems) console.log(`  ${p}`);
  const bad = wrong + roles.problems.length;
  console.log(bad ? `${bad} wrong${args.fix ? ' (after the fix: the unknown ones, which --formats decides)' : ''}` : 'every map says what it is');
  if (args.check && bad) process.exit(1);
}
