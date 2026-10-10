// The Supabase project this checkout is linked to, read as Vite reads it:
// parseEnv and projectFrom (the asset mirror, scripts/assets-upload.mjs, reads
// the project the same way). Run, it says whether a project is linked; exit 2
// when none is. The URL and anon key are read from the file (or the VITE_
// names in the environment) and used, never printed.
//
//   node scripts/supabase-check.mjs [--env <file>]   # default .env.local
//
// planet flight: begin
// With a project it first walks the flight's durable world against it
// (./lib/durable-check.mjs, over lib/durable): CI never runs it.
// planet flight: end
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

// KEY=value lines, as Vite reads them: comments and blanks skipped, one pair
// of quotes taken off
export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function projectFrom(file, env = process.env) {
  const fromFile = file && existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  const [url, key] = NAMES.map((n) => fromFile[n] || env[n] || '');
  return url && key ? { url, key } : null;
}

async function main() {
  const at = process.argv.indexOf('--env');
  const file = at > 0 ? process.argv[at + 1] : join(ROOT, '.env.local');
  const project = projectFrom(file);
  if (!project) {
    console.log('no project linked: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(2);
  }
  // planet flight: begin (scripts/flight-island.mjs removes this block)
  const { durableCheck } = await import('./lib/durable-check.mjs');
  if (await durableCheck(project)) process.exit(1);
  // planet flight: end
  console.log('ok    a project is linked');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
