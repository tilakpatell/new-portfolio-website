// Builds a level's surfaces rulebook (src/data/bf2017/physics/materials.json,
// keyed by level) from its material grid, for the material indices its
// meshes' Havok shapes use; or cuts the grid into the test's fixture.
//
//   node scripts/bf2017-materials.mjs --level hoth_01 --grid <materialgrid_win32.json.gz> --map <web/maps/…/hoth_01.json> --physics <web/physics.jsonl>
//   node scripts/bf2017-materials.mjs fixture --grid <…json.gz> --indices 0,3,5,14,28,45,149
//
// The inputs come from the export (C:\Users\…\Downloads\BF2_Extract\upload_stage\data\…)
// or the bf2017-assets bucket (scripts/bf2017-fetch.mjs's keys); nothing here
// touches the network. --out defaults to the rulebook; --dry prints a summary.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from './lib/args.mjs';
import { cutGrid, materialRulebook, usedIndicesOf } from './lib/bf2017-materials.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOK = join(ROOT, 'src/data/bf2017/physics/materials.json');
const FIXTURE = join(ROOT, 'scripts/fixtures/bf2017/data/hoth_materialgrid.cut.json');

const readJson = async (file) => {
  const buf = await readFile(file);
  return JSON.parse((file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
};

const { _: cmd, ...opt } = parseArgs(process.argv.slice(2));
if (!opt.grid) {
  console.error('Give --grid <materialgrid_win32.json.gz> (and --level, --map, --physics to build).');
  process.exit(2);
}
const grid = await readJson(opt.grid);

if (cmd?.[0] === 'fixture') {
  const indices = String(opt.indices ?? '0,3,5,14,28,45,149')
    .split(',')
    .map(Number);
  const text = JSON.stringify(cutGrid(grid, indices));
  await writeFile(opt.out ?? FIXTURE, text);
  console.log(`fixture: ${indices.length} indices, ${(text.length / 1024).toFixed(1)} KB → ${opt.out ?? FIXTURE}`);
} else {
  if (!opt.level || !opt.map || !opt.physics) {
    console.error('Give --level, --map and --physics.');
    process.exit(2);
  }
  const manifest = await readJson(opt.map);
  const records = (await readFile(opt.physics, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const used = usedIndicesOf(manifest, records);
  const book = materialRulebook(grid, used.map(([i]) => i), { level: opt.level });
  book.used = Object.fromEntries(used.map(([i, n]) => [i, { records: n, records_source: `web/physics.jsonl#materials[].index (records named by ${manifest.level})` }]));
  const out = opt.out ?? BOOK;
  const all = existsSync(out) ? JSON.parse(await readFile(out, 'utf8')) : {};
  all[opt.level] = book;
  const text = `${JSON.stringify(all, null, 1)}\n`;
  console.log(`${opt.level}: ${Object.keys(book.materials).length} materials, ${Object.keys(book.pairs).length} pairs; ${(text.length / 1024).toFixed(1)} KB`);
  for (const [i, m] of Object.entries(book.materials)) console.log(`  ${i.padStart(3)} ${m.name.padEnd(16)} ${m.nameFrom ?? ''}`);
  if (!opt.dry) await writeFile(out, text);
}
