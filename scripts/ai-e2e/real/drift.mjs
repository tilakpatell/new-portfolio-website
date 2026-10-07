// Drift: tonight's real run (health.mjs) against the last one a person
// blessed (golden.json, written by bless.mjs). Within TOLERANCE is a night
// like any other; past it, the night says what moved and by how much, and
// a person decides whether it's a regression or the new normal (bless).
//
//   node scripts/ai-e2e/real/drift.mjs [results/<date>-real.json]   → results/<date>-drift.json; exit 1 on drift
//   numbers(night) → { 'gen3d.tris.hq': …, … }
//   drift(night, golden) → [{ key, was, now, change }]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GOLDEN = join(HERE, 'golden.json');

// A number moved when it's more than this share off the golden. The
// models' sizes and the judge's verdict are deterministic for a seed and an
// engine, so a tenth is already a change worth a look; the timings get
// half again, since the GPU is shared and a cold start (weights off the
// disk) is slower than a warm one.
export const TOLERANCE = 0.1;
const TIMING = 0.5;
// and the least a number is measured against: a word error rate of 0.02 that
// becomes 0.05 has not "moved 150%"
const FLOOR = { 'voices.wer': 0.5, 'voices.similarity': 0.5 };

// a night's numbers, flat, each named by where it comes from
export function numbers(night) {
  const out = {};
  const walk = (o, at) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (['ok', 'made', 'doubtful', 'short'].includes(k)) continue;
      if (typeof v === 'number') out[`${at}${k}`] = v;
      else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, `${at}${k}.`);
    }
  };
  walk({ gen3d: night.gen3d, voices: night.voices }, '');
  return out;
}

export function drift(night, golden) {
  const was = golden.numbers ?? numbers(golden);
  const now = numbers(night);
  const out = [];
  for (const [key, w] of Object.entries(was)) {
    const n = now[key];
    if (n === undefined) {
      out.push({ key, was: w, now: null, change: 'missing' });
      continue;
    }
    const room = (key.endsWith('seconds') ? TIMING : TOLERANCE) * Math.max(Math.abs(w), FLOOR[key] ?? 0);
    if (Math.abs(n - w) > room) out.push({ key, was: w, now: n, change: `${n >= w ? '+' : '-'}${Math.round((Math.abs(n - w) / Math.abs(w || 1)) * 100)}%` });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.env.AI_RESULTS ?? join(HERE, '..', 'results');
  const file = process.argv[2] ?? join(dir, readdirSync(dir).filter((f) => f.endsWith('-real.json')).sort().at(-1) ?? 'none-real.json');
  const date = basename(file).slice(0, 10);
  const out = join(dirname(file), `${date}-drift.json`);
  if (!existsSync(GOLDEN)) {
    writeFileSync(out, `${JSON.stringify({ tier: 'drift', ok: true, blessed: false, moves: [], note: 'no golden yet: bless a good night (node scripts/ai-e2e/real/bless.mjs)' }, null, 1)}\n`);
    console.log('no golden yet: nothing to drift from (node scripts/ai-e2e/real/bless.mjs blesses a good night)');
    process.exit(0);
  }
  const moves = drift(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(readFileSync(GOLDEN, 'utf8')));
  writeFileSync(out, `${JSON.stringify({ tier: 'drift', ok: moves.length === 0, blessed: true, moves }, null, 1)}\n`);
  for (const m of moves) console.log(`${m.key}: ${m.was} → ${m.now ?? 'missing'} (${m.change})`);
  console.log(moves.length ? `${moves.length} number(s) moved past the golden` : 'within the golden');
  process.exit(moves.length ? 1 : 0);
}
