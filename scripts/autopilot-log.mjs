// Writes an entry in the ship's log (src/data/changes/<id>.json, read by the
// /changes page) for a change the autopilot (.claude/skills/autopilot) has
// made. Run it after the pull request exists, so its number goes in:
//
//   node scripts/autopilot-log.mjs --title "…" --kind graphics --summary "…" \
//     --routes /galaxy/hoth/surface,/galaxy --pr 151 [--note "…"] [--session session_…] [--id 12]
//
//   node scripts/autopilot-log.mjs --next     the next entry's number (for the branch name)
//
// The screenshots are whatever scripts/autopilot-check.mjs --shots <id> left
// in public/changes/ for the number; the JS total is read from dist/ (build
// first). Kinds: feature, graphics, performance, fix, content, infra.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'src/data/changes');
const SHOTS = join(ROOT, 'public/changes');
const KINDS = ['feature', 'graphics', 'performance', 'fix', 'content', 'infra'];

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else args[key] = argv[++i];
}

export const pad = (id) => String(id).padStart(4, '0');

async function entries() {
  const names = (await readdir(DIR).catch(() => [])).filter((n) => /^\d{4}\.json$/.test(n));
  return Promise.all(names.map(async (n) => JSON.parse(await readFile(join(DIR, n), 'utf8'))));
}

async function jsTotal() {
  const dir = join(ROOT, 'dist/assets');
  const names = await readdir(dir).catch(() => null);
  if (!names) return null;
  let total = 0;
  for (const n of names) if (n.endsWith('.js')) total += (await stat(join(dir, n))).size;
  return total;
}

const all = await entries();
const nextId = all.reduce((m, e) => Math.max(m, e.id), 0) + 1;

if (args.next) {
  console.log(pad(nextId));
  process.exit(0);
}

const fail = (why) => {
  console.error(why);
  process.exit(1);
};
for (const k of ['title', 'kind', 'summary', 'routes', 'pr']) if (typeof args[k] !== 'string' || !args[k].trim()) fail(`--${k} is needed`);
if (!KINDS.includes(args.kind)) fail(`--kind must be one of ${KINDS.join(', ')}`);
const pr = Number(args.pr);
if (!Number.isInteger(pr) || pr <= 0) fail('--pr must be the pull request’s number');
const id = args.id ? Number(args.id) : nextId;
if (!Number.isInteger(id) || id <= 0) fail('--id must be a number');
if (all.some((e) => e.id === id)) fail(`entry ${id} already exists`);
const routes = args.routes
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
if (!routes.length || routes.some((r) => !r.startsWith('/'))) fail('--routes must be paths like /avengers, separated by commas');

const shots = (await readdir(SHOTS).catch(() => []))
  .filter((n) => n.startsWith(`${pad(id)}-`) && n.endsWith('.webp'))
  .sort()
  .slice(0, 2)
  .map((n) => `/changes/${n}`);

const entry = {
  id,
  date: new Date().toISOString().slice(0, 10),
  title: args.title.trim(),
  kind: args.kind,
  summary: args.summary.trim(),
  routes,
  pr,
  shots,
  measured: { js: await jsTotal(), note: typeof args.note === 'string' ? args.note.trim() : null },
  session: typeof args.session === 'string' ? args.session : null,
  reverted: null,
};
const file = join(DIR, `${pad(id)}.json`);
await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`);
console.log(`wrote ${file.replace(ROOT, '')}`);
console.log(JSON.stringify(entry, null, 2));
