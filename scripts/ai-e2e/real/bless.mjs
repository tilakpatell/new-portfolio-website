// A good night's real run made the golden the next nights drift from.
// A person runs this, having looked at the night (its sheet, its line):
// drift is a question, and blessing is the answer that the new numbers are
// right.
//
//   node scripts/ai-e2e/real/bless.mjs [results/<date>-real.json]   (default: the latest)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOLDEN, numbers } from './drift.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export function bless(from, to = GOLDEN) {
  const night = JSON.parse(readFileSync(from, 'utf8'));
  for (const part of ['gen3d', 'voices']) if (!night[part]?.ok) throw new Error(`${part} failed that night: bless a good one`);
  const golden = { from: basename(from), blessed: new Date().toISOString().slice(0, 10), numbers: numbers(night) };
  writeFileSync(to, `${JSON.stringify(golden, null, 1)}\n`);
  return golden;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.env.AI_RESULTS ?? join(HERE, '..', 'results');
  const from = process.argv[2] ?? join(dir, readdirSync(dir).filter((f) => f.endsWith('-real.json')).sort().at(-1));
  const g = bless(from);
  console.log(`blessed ${g.from}: ${Object.keys(g.numbers).length} numbers → ${GOLDEN}`);
}
