// The shader depots' hashed parameter names, resolved into
// src/data/bf2017/shaderParams.json: every name the readable records use
// with its djb2-xor hash (scripts/lib/bf2017-shader-names.mjs), and, when a
// depot probe is given, how many of its blocks the dictionary names and the
// hashes it cannot, by count. No network: the records come from the drop
// fetched ahead into lab/assets/bf2017/ (git-ignored):
//
//   node --env-file=.env.local scripts/bf2017-fetch.mjs --raw materials.jsonl
//   node --env-file=.env.local scripts/bf2017-fetch.mjs data 'Objects/**/*Variation*' 'Shaders/**/*Preset*'
//   node scripts/bf2017-shader-names.mjs [--root lab/assets/bf2017] [--depots <shaderdepots.jsonl>] [--out src/data/bf2017/shaderParams.json]
//
// On the desktop, --root is the export (its web/materials.jsonl and data/).
// The output: { names: { name: hash }, count, depots?: { rows, params, resolved, resolvedShare }, unresolved: { hash: count } }.

import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { dictionary, namesFrom, resolveDepot } from './lib/bf2017-shader-names.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, test, out);
    else if (test(f)) out.push(p);
  }
  return out;
}

const readRecord = async (file) => {
  if (file.endsWith('.gz')) {
    const chunks = [];
    for await (const c of createReadStream(file).pipe(createGunzip())) chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return JSON.parse(readFileSync(file, 'utf8'));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  const materialsFile = [join(root, 'web', 'materials.jsonl'), join(root, 'materials.jsonl')].find(existsSync);
  if (!materialsFile) {
    console.error(`No materials.jsonl under ${root}: fetch it first (node scripts/bf2017-fetch.mjs --raw materials.jsonl).`);
    process.exit(2);
  }
  const variations = [];
  const presets = [];
  for (const f of walk(join(root, 'data'), (n) => /\.json(\.gz)?$/.test(n) && /variation|preset/i.test(n))) {
    const rec = await readRecord(f);
    (/preset/i.test(f) ? presets : variations).push(rec);
  }
  const names = namesFrom({ materials: readFileSync(materialsFile, 'utf8'), variations, presets });
  const dict = dictionary(names);
  const out = { names: dict.names, count: names.size, unresolved: {} };
  if (args.depots) {
    let rows = 0;
    let params = 0;
    let resolved = 0;
    const rl = createInterface({ input: createReadStream(resolve(args.depots)) });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const r = resolveDepot(JSON.parse(line), dict);
      rows++;
      params += r.params.length;
      resolved += r.resolved;
      for (const [h, n] of Object.entries(r.unresolved)) out.unresolved[h] = (out.unresolved[h] ?? 0) + n;
    }
    out.depots = { rows, params, resolved, resolvedShare: params ? +(resolved / params).toFixed(4) : 0 };
    out.unresolved = Object.fromEntries(Object.entries(out.unresolved).sort((a, b) => b[1] - a[1]));
  }
  const file = resolve(args.out ?? join(ROOT, 'src', 'data', 'bf2017', 'shaderParams.json'));
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${names.size} names (${variations.length} variation records, ${presets.length} presets)${out.depots ? `; depots: ${out.depots.resolved} of ${out.depots.params} params named (${Math.round(out.depots.resolvedShare * 100)}%), ${Object.keys(out.unresolved).length} hashes unresolved` : ''} → ${file}`);
}
