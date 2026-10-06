// Lists every line the crews say that has no recording of its own, for
// generate.py to make in the speaker's voice: `npm run voices:lines`.
// The site's modules are read through Vite's own module runner, the way the
// dev server reads them (extensionless imports, import.meta.env), so this
// needs nothing past Vite itself.
// Writes scripts/voices/lines.json: [{ id, who, text }], one per distinct line,
// with the same id the site looks it up by (src/lib/voiced.js).

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// who has a voice to make (Artoo and Chewie don't speak Basic, and 'comms'
// is anybody on the radio)
export const VOICED = ['rick', 'morty', 'luke', 'han', 'walt', 'jesse', 'hank'];
// and the worlds' speakers with a voice of their own (common.py keeps the same list)
export const WORLD_VOICED = [
  'gandalf', 'aragorn', 'sam', 'frodo', 'galadriel', 'boromir', 'pippin', 'gimli', 'saruman', 'gollum', 'elrond', 'merry',
  'butterbur', 'theoden', 'legolas', 'arwen', 'bilbo', 'hama', 'haldir', 'denethor', 'grima', 'celeborn',
  'michael', 'jim', 'erin',
];

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

// The worlds' conversations (Middle-earth's towns, the Office, the Citadel):
// { who, say } nodes, made in the speaker's voice (voiceOf) when it's one of
// `voices`, saying what's said aloud (spoken: the quoted part of a line that
// mixes in narration), with the id the site looks it up by: the line as shown.
export function conversationLines(sources, { lineId, voiceOf, spoken }, voices) {
  const found = new Map();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return undefined;
    const voice = typeof v.who === 'string' && typeof v.say === 'string' ? voiceOf(v.who) : null;
    if (voice && voices.includes(voice)) found.set(lineId(voice, v.say), { id: lineId(voice, v.say), who: voice, text: spoken(v.say) });
    return Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...found.values()];
}

const here = dirname(fileURLToPath(import.meta.url));
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runnerImport } = await import('vite');
  const root = resolve(here, '../..');
  // no config file: the site's plugins (prerender, the icons) have nothing to do here
  const load = async (path) => (await runnerImport(join(root, path), { root, configFile: false, logLevel: 'error' })).module;
  const [{ CREWS }, { GALAXY_LINES }, { VEHICLES }, { SITES }, { MISSIONS }, { crewLines }, { lineId }] = await Promise.all([
    load('src/components/universe/crews.js'),
    load('src/components/galaxy/lines.js'),
    load('src/components/cockpit/vehicles.js'),
    // on the ground: each landing site's places, its missions, and climbing out, riding and leaving
    load('src/components/galaxy/surface/sites/index.js'),
    load('src/components/galaxy/surface/missions/index.js'),
    load('src/components/galaxy/surface/lines.js'),
    load('src/lib/voiced.js'),
  ]);
  const surface = [SITES, MISSIONS, CREWS.map((c) => crewLines(c.id))];
  // the worlds' conversations: every Middle-earth town's, the Office's and the Citadel's
  const towns = readdirSync(join(root, 'src/components/middleearth/towns'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, 'src/components/middleearth/towns', d.name, 'story.js')))
    .map((d) => `src/components/middleearth/towns/${d.name}/story.js`);
  const worlds = await Promise.all([...towns, 'src/components/office/world/story.js', 'src/components/rickmorty/citadel/story.js'].map(load));
  const voiced = await load('src/lib/voiced.js');
  const lines = [...unrecorded([CREWS, GALAXY_LINES, VEHICLES.map((v) => v.lines), ...surface], lineId), ...conversationLines(worlds, voiced, [...VOICED, ...WORLD_VOICED])];
  writeFileSync(join(here, 'lines.json'), `${JSON.stringify(lines, null, 1)}\n`);
  const count = lines.reduce((n, l) => ({ ...n, [l.who]: (n[l.who] ?? 0) + 1 }), {});
  const by = Object.entries(count).map(([who, n]) => `${who} ${n}`);
  console.log(`${lines.length} lines without a recording (${by.join(', ')}) -> scripts/voices/lines.json`);
}
