// Keeps public/audio/voiced/ to the lines the site says today: `npm run voices:tidy` (after
// `npm run voices:lines`, and before committing made lines). A line whose text changed gets a
// new id, so its old recording is never played again: that mp3 goes, and so does its manifest
// entry. A made line the manifest somehow missed is listed. The asset tests' allow-lists
// (scripts/ai-e2e/assets/) are kept to what is still so: no orphans once tidied, and the
// speakers with lines but no voice made yet (each waiting on a reference).

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const idOf = (f) => f.split('/').pop().replace(/\.mp3$/, '');

// What to delete, what the manifest lists (in the lines' order, as generate.py lists them) and
// who has no voice yet, from the lines the site says (`lines`: [{ id, who }]) and the
// recordings there are (`files`: ["who/id.mp3"]).
export function tidy(lines, files) {
  const ids = new Set(lines.map((l) => l.id));
  const gone = files.filter((f) => !ids.has(idOf(f)));
  const made = new Set(files.filter((f) => ids.has(idOf(f))));
  const manifest = Object.fromEntries(lines.filter((l) => made.has(`${l.who}/${l.id}.mp3`)).map((l) => [l.id, `${l.who}/${l.id}.mp3`]));
  const voiced = new Set([...made].map((f) => f.split('/')[0]));
  const voiceless = [...new Set(lines.map((l) => l.who))].filter((w) => !voiced.has(w)).sort();
  return { gone, manifest, voiceless };
}

// the manifest as generate.py writes it (Python's json.dumps with indent=0)
export function manifestText(manifest) {
  const listed = Object.entries(manifest).map(([id, f]) => `"${id}": "${f}"`);
  return ['{', '"version": 1,', '"lines": {', listed.join(',\n'), '}', '}'].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = join(root, 'public', 'audio', 'voiced');
  const lines = JSON.parse(readFileSync(join(here, 'lines.json'), 'utf8'));
  const files = readdirSync(out, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(out, d.name)).filter((f) => f.endsWith('.mp3')).map((f) => `${d.name}/${f}`));
  const { gone, manifest, voiceless } = tidy(lines, files);
  for (const f of gone) rmSync(join(out, f));
  for (const d of readdirSync(out, { withFileTypes: true })) {
    if (d.isDirectory() && !readdirSync(join(out, d.name)).length) rmSync(join(out, d.name), { recursive: true });
  }
  writeFileSync(join(out, 'manifest.json'), manifestText(manifest));
  const assets = join(root, 'scripts', 'ai-e2e', 'assets');
  if (existsSync(join(assets, 'allow-orphans.json'))) {
    const orphans = JSON.parse(readFileSync(join(assets, 'allow-orphans.json'), 'utf8'));
    writeFileSync(join(assets, 'allow-orphans.json'), `${JSON.stringify({ ...orphans, unlisted: [], unsaid: [] }, null, 1)}\n`);
    const quiet = JSON.parse(readFileSync(join(assets, 'allow-voiceless.json'), 'utf8'));
    writeFileSync(join(assets, 'allow-voiceless.json'), `${JSON.stringify({ ...quiet, speakers: voiceless }, null, 1)}\n`);
  }
  console.log(`${gone.length} recordings of lines no longer said removed; ${Object.keys(manifest).length} lines in the manifest; ${voiceless.length} speakers with no voice made yet`);
}
