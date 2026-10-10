#!/usr/bin/env node
// Lane P2's rulebooks from the export: src/data/bf2017/physics/
// projectiles.json, bones.json and ragdoll.json, built by
// scripts/lib/bf2017-physics-rules.mjs from the records under
// `<root>/data/` (the Frosty export's web/ folder, or a fetched copy of
// the bucket's data/<Name>.json.gz). Prints what it refused and the sizes.
//
//   node scripts/bf2017-bolts-data.mjs --root C:/Users/tilak/Downloads/BF2_Extract/web [--out src/data/bf2017/physics]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { checkSources, physicsRulebooks } from './lib/bf2017-physics-rules.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.root) {
  console.error('usage: node scripts/bf2017-bolts-data.mjs --root <export web folder> [--out src/data/bf2017/physics]');
  process.exit(1);
}
const out = args.out ?? 'src/data/bf2017/physics';
const { projectiles, bones, ragdoll } = physicsRulebooks(args.root);
const files = {
  'projectiles.json': { rows: projectiles.rows },
  'bones.json': { sets: bones.sets },
  'ragdoll.json': { rows: ragdoll.rows },
};
fs.mkdirSync(out, { recursive: true });
for (const [name, json] of Object.entries(files)) {
  const bad = checkSources(json);
  if (bad.length) {
    console.error(`${name}: ${bad.length} numbers without a source, first ${bad[0]}`);
    process.exit(1);
  }
  // (one row a line: small, and a rebuild's diff reads row by row)
  const [[key, rows]] = Object.entries(json);
  const text = `{"${key}": [\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  fs.writeFileSync(path.join(out, name), text);
  console.log(`${name}: ${(text.length / 1024).toFixed(1)} KB`);
}
console.log(`projectiles: ${projectiles.rows.length} rows, ${projectiles.refused.length} refused, ${projectiles.skipped} skipped`);
console.log(`bone sets: ${bones.sets.length}, refused ${bones.refused.length}: ${bones.refused.join(', ')}`);
console.log(`ragdolls: ${ragdoll.rows.length}, refused ${ragdoll.refused.length}: ${ragdoll.refused.join(', ')}`);
console.log(`refused projectiles: ${projectiles.refused.join(', ')}`);
