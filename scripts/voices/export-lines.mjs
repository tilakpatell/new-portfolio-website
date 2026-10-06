// Lists every line the crews say that has no recording of its own, for
// generate.py to make in the speaker's voice: `npm run voices:lines`.
// The site's modules are read through Vite's own module runner, the way the
// dev server reads them (extensionless imports, import.meta.env), so this
// needs nothing past Vite itself.
// Writes scripts/voices/lines.json: [{ id, who, text }], one per distinct line,
// with the same id the site looks it up by (src/lib/voiced.js).

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// who has a voice to make (Artoo and Chewie don't speak Basic, and 'comms'
// is anybody on the radio)
export const VOICED = ['rick', 'morty', 'luke', 'han', 'walt', 'jesse', 'hank'];

const isLine = (v) => Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && v.length <= 3 && v.every((x) => typeof x === 'string');

export function unrecorded(sources, lineId) {
  const found = new Map();
  const walk = (v) => {
    if (isLine(v)) {
      const [who, text, clip] = v;
      if (!clip && VOICED.includes(who)) found.set(lineId(who, text), { id: lineId(who, text), who, text });
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...found.values()].sort((a, b) => a.who.localeCompare(b.who) || a.text.localeCompare(b.text));
}

const here = dirname(fileURLToPath(import.meta.url));
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runnerImport } = await import('vite');
  const root = resolve(here, '../..');
  // no config file: the site's plugins (prerender, the icons) have nothing to do here
  const load = async (path) => (await runnerImport(join(root, path), { root, configFile: false, logLevel: 'error' })).module;
  const [{ CREWS }, { GALAXY_LINES }, { VEHICLES }, { lineId }] = await Promise.all([
    load('src/components/universe/crews.js'),
    load('src/components/galaxy/lines.js'),
    load('src/components/cockpit/vehicles.js'),
    load('src/lib/voiced.js'),
  ]);
  const lines = unrecorded([CREWS, GALAXY_LINES, VEHICLES.map((v) => v.lines)], lineId);
  writeFileSync(join(here, 'lines.json'), `${JSON.stringify(lines, null, 1)}\n`);
  const count = lines.reduce((n, l) => ({ ...n, [l.who]: (n[l.who] ?? 0) + 1 }), {});
  const by = Object.entries(count).map(([who, n]) => `${who} ${n}`);
  console.log(`${lines.length} lines without a recording (${by.join(', ')}) -> scripts/voices/lines.json`);
}
