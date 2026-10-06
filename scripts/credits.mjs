// CREDITS.md, from the lists the site credits from itself: every Sketchfab
// model (src/data/modelCredits.json, and the ones public/cc0/README.md lists
// by hand), every CC0 scan, sky and kit (public/games/credits.json,
// public/games/caribbean/credits.json, public/hq/CREDITS.md), every photo
// (src/data/photos.js), the fonts and the public data, and the README's
// thank-you to the artists. Run it after any of those change:
//
//   npm run credits
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFile(join(ROOT, p), 'utf8');
const json = async (p) => JSON.parse(await read(p));
// (as file URLs: a bare C: path isn't one, so Windows can't import it)
const { PHOTOS } = await import(pathToFileURL(join(ROOT, 'src/data/photos.js')).href);
const { profile } = await import(pathToFileURL(join(ROOT, 'src/data/profile.js')).href);

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const link = (text, url) => (url ? `[${cell(text)}](${url})` : cell(text));
const licence = (l) => l.replace(/^CC-/, 'CC ').replace(/-(\d)/, ' $1'); // 'CC-BY-NC-SA-4.0' → 'CC BY-NC-SA 4.0'
const LICENCE_URL = {
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC-BY-NC-SA-4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};
const sketchfabId = (url) => url.match(/([0-9a-f]{32})\/?$/)?.[1] ?? url;
const authorUrl = (name) => `https://sketchfab.com/${encodeURIComponent(name)}`;

// ── 3D models from Sketchfab ──
const WORLDS = [
  ['universe', 'The universe map'],
  ['galaxy', 'A galaxy far, far away: in space'],
  ['galaxy-surface', 'A galaxy far, far away: down on the worlds'],
  ['cybertron', 'Cybertron'],
  ['avengers', 'Avengers HQ'],
  ['albuquerque', 'Albuquerque'],
  ['middle-earth', 'Middle-earth'],
  ['c-137', 'Dimension C-137'],
  ['invincible', 'Invincible'],
  ['earth', 'Earth'],
  ['dickansh', 'The secret world'],
];
const models = Object.values(await json('src/data/modelCredits.json'));
const known = new Set(models.map((m) => sketchfabId(m.source)));
// the ones public/cc0/README.md lists by hand: "- `file`: [Title](url) by author. What it is."
const cc0Readme = await read('public/cc0/README.md');
const byHand = cc0Readme.slice(cc0Readme.indexOf('from Sketchfab'));
for (const [, file, title, source, author, rest] of byHand.matchAll(/^- `([^`]+)`: \[([^\]]+)\]\(([^)]+)\) by ([^.\s]+(?:\.[^.\s]+)*)\.[ \t]*([^\n]*)/gm)) {
  if (known.has(sketchfabId(source))) continue;
  known.add(sketchfabId(source));
  const where = /optimus/.test(file) ? 'cybertron' : file.startsWith('avengers/') ? 'avengers' : 'albuquerque';
  models.push({ title, author, authorUrl: authorUrl(author), license: 'CC-BY-4.0', licenseUrl: LICENCE_URL['CC-BY-4.0'], source, where, as: rest.replace(/\.$/, '') || title });
}
// (a name with nothing to read in it goes by the handle in the artist's address)
for (const m of models) if (!/[\p{L}\p{N}]/u.test(m.author) && m.authorUrl) m.author = m.authorUrl.split('/').pop();
const artists = [...new Map(models.map((m) => [m.author, m.authorUrl ?? authorUrl(m.author)])).entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }));

// ── CC0 scans, skies and kits ──
const cc0 = [];
for (const file of ['public/games/credits.json', 'public/games/caribbean/credits.json']) {
  for (const a of Object.values(await json(file))) if (/CC0/.test(a.license)) cc0.push({ name: a.name, source: a.source, by: a.authors.join(', ') });
}
for (const [, kind, name, from, url, by] of (await read('public/hq/CREDITS.md')).matchAll(/^\| (\w+) \| ([^|]+) \| \[([^\]]+)\]\(([^)]+)\) \| ([^|]+) \|$/gm)) {
  // (the same pipeline makes the Mario 64 tribute's sets, named m64-)
  const where = name.trim().startsWith('m64-') ? 'Super Mario 64' : 'Avengers HQ';
  cc0.push({ name: `${name.trim()} (${kind.toLowerCase()}, ${where})`, source: url, by: by.trim(), from });
}
const site = (url) => (/polyhaven/.test(url) ? 'Poly Haven' : /ambientcg/.test(url) ? 'ambientCG' : /kenney/.test(url) ? 'Kenney' : new URL(url).hostname);
const cc0Unique = [...new Map(cc0.map((a) => [`${a.source}|${a.name}`, a])).values()];
const kenney = cc0Unique.filter((a) => site(a.source) === 'Kenney');
const scans = cc0Unique.filter((a) => site(a.source) !== 'Kenney').sort((a, b) => site(a.source).localeCompare(site(b.source)) || a.name.localeCompare(b.name));
const cc0People = [...new Set(scans.flatMap((a) => a.by.split(/,\s*/)))].filter((p) => p !== 'ambientCG').sort();

// ── photos ──
const photos = Object.values(PHOTOS)
  .filter((p) => p.credit)
  .map((p) => p.credit)
  .filter((c, i, all) => all.findIndex((d) => d.source === c.source) === i)
  .sort((a, b) => a.author.localeCompare(b.author));

// ── fonts ──
const pkg = await json('package.json');
const FONT_NAMES = { 'archivo': 'Archivo', 'bebas-neue': 'Bebas Neue', 'cinzel': 'Cinzel', 'cinzel-decorative': 'Cinzel Decorative', 'courier-prime': 'Courier Prime', 'jetbrains-mono': 'JetBrains Mono', 'luckiest-guy': 'Luckiest Guy', 'news-cycle': 'News Cycle', 'orbitron': 'Orbitron', 'press-start-2p': 'Press Start 2P', 'yatra-one': 'Yatra One', 'noto-sans-runic': 'Noto Sans Runic' };
const fonts = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((d) => d.startsWith('@fontsource'))
  .map((d) => d.replace(/^@fontsource(-variable)?\//, ''))
  .map((id) => FONT_NAMES[id] ?? id)
  .sort();

const contact = `[${profile.email}](mailto:${profile.email}) or [LinkedIn](${profile.linkedin.url})`;
const md = [];
md.push(
  '# Credits',
  '',
  `[tilakpatell.com](${profile.site}) is built on a lot of other people's work: ${models.length} 3D models from ${artists.length} artists on Sketchfab, ${cc0Unique.length} free scans, skies and kit pieces, ${photos.length} photos, open fonts and public data. Thank you, all of you.`,
  '',
  `> **Made something here and I've missed you, got your name wrong, or you'd like it taken down?** Message me at ${contact} and I'll fix it straight away, or open a pull request.`,
  '',
  "Everything here is credited on the page that uses it too. This file is made by `npm run credits` (`scripts/credits.mjs`) from the same lists the site reads, so it can't fall out of step with them.",
  '',
  '## Contents',
  '',
  '- [3D models from Sketchfab](#3d-models-from-sketchfab)',
  '- [Scans, skies and kits (CC0)](#scans-skies-and-kits-cc0)',
  '- [Photos](#photos)',
  '- [Fonts](#fonts)',
  '- [Data and imagery](#data-and-imagery)',
  '- [Sound](#sound)',
  '- [Made for this site](#made-for-this-site)',
  '',
  '## 3D models from Sketchfab',
  '',
  `Each one is its artist's, used under the Creative Commons licence it's published with, and brought down to web size (textures resized and re-encoded, meshes simplified and compressed) by the import scripts in \`scripts/\`. None of them is changed beyond that, except where it says.`,
  '',
  `**The artists:** ${artists.map(([name, url]) => `[${name}](${url})`).join(' · ')}`,
  '',
);
for (const [id, label] of WORLDS) {
  const list = models.filter((m) => m.where === id).sort((a, b) => a.title.localeCompare(b.title));
  if (!list.length) continue;
  md.push(`### ${label}`, '', '| Model | Artist | Licence | On the site |', '| --- | --- | --- | --- |');
  for (const m of list) md.push(`| ${link(m.title, m.source)} | ${link(m.author, m.authorUrl ?? authorUrl(m.author))} | ${link(licence(m.license), m.licenseUrl ?? LICENCE_URL[m.license])} | ${cell(m.as)} |`);
  md.push('');
}
md.push(
  '## Scans, skies and kits (CC0)',
  '',
  `Public domain, so no credit is needed, but they deserve it. From [Poly Haven](https://polyhaven.com) (${cc0People.join(', ')}), [ambientCG](https://ambientcg.com) and [Kenney](https://kenney.nl), whose kits make up *Portal panic* and more (${kenney.length} pieces). The lists by game are in [\`public/games/credits.json\`](public/games/credits.json), [\`public/hq/CREDITS.md\`](public/hq/CREDITS.md) and [\`public/cc0/README.md\`](public/cc0/README.md).`,
  '',
  '<details>',
  `<summary>All ${scans.length} scans and skies</summary>`,
  '',
  '| Asset | From | By |',
  '| --- | --- | --- |',
  ...scans.map((a) => `| ${link(a.name, a.source)} | ${site(a.source)} | ${cell(a.by)} |`),
  '',
  '</details>',
  '',
  '## Photos',
  '',
  'The Travel page and the backdrops behind some of the pages use these, each credited where it appears. My own photos are mine.',
  '',
  '<details>',
  `<summary>All ${photos.length} photos</summary>`,
  '',
  '| Photo | By | Licence |',
  '| --- | --- | --- |',
  ...photos.map((c) => `| ${link(c.title ?? 'Photo', c.source)} | ${cell(c.author)} | ${link(c.license, c.licenseUrl)} |`),
  '',
  '</details>',
  '',
  '## Fonts',
  '',
  `${fonts.join(', ')}: open fonts (SIL Open Font License), through [Fontsource](https://fontsource.org). Aurebesh is by [SilvinoR](https://github.com/silvinor) (SIL OFL), in [\`public/fonts/aurebesh\`](public/fonts/aurebesh/OFL.md); the other faces in [\`public/fonts\`](public/fonts) carry their own licences beside them.`,
  '',
  '## Data and imagery',
  '',
  "- **Earth's globe:** NASA Earth Observatory's Blue Marble Next Generation, Black Marble 2016, cloud and GEBCO images (public domain).",
  "- **The universe map's planets, sun and Milky Way:** [Solar System Scope](https://www.solarsystemscope.com/textures/)'s maps (CC BY 4.0), recoloured for Music's and Marvel's gas giants and laid under the Death Star's plates. The other fandoms' planets (Middle-earth from Tolkien's own map, New Mexico, the Caribbean, C-137, the Office's crumpled letterhead) are made in code by `scripts/build-fandom-planets.mjs`.",
  "- **The Travel page's dotted globe:** Natural Earth's 1:50m country outlines (public domain), via [world-atlas](https://github.com/topojson/world-atlas).",
  '- **The GitHub snapshot on the home page:** GitHub\'s public API, read at build time.',
  '',
  '## Sound',
  '',
  "The short clips from the films and shows belong to their studios; where each came from is in [`public/audio/clips/README.md`](public/audio/clips/README.md). The ships' engines are listed in [`public/audio/engines/README.md`](public/audio/engines/README.md), Kenney's [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (CC0) among them.",
  '',
  '## Made for this site',
  '',
  "The worlds' own characters, buildings and props (the Albuquerque town and its people, the Caribbean's ships, Middle-earth's places, Mark Grayson and more) were made for this site with [Meshy](https://www.meshy.ai), or modelled in code. The task behind each one is recorded next to it (`scripts/*-tasks.json`, `public/games/credits.json`).",
  '',
  '---',
  '',
  `Missed someone? ${contact}, or a pull request. Thank you.`,
  '',
);
await writeFile(join(ROOT, 'CREDITS.md'), md.join('\n'));

// and the README's thank-you: the counts and every artist, between its markers
const between = (text, name, body) => text.replace(new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`), `$1${body}$2`);
let readme = await read('README.md');
readme = between(readme, 'counts', `${models.length} 3D models by ${artists.length} artists, ${cc0Unique.length} free scans, skies and kit pieces, ${photos.length} photos and ${fonts.length} open fonts`);
readme = between(readme, 'artists', `\n${artists.map(([name, url]) => `[${name}](${url})`).join(' · ')}\n`);
await writeFile(join(ROOT, 'README.md'), readme);
console.log(`CREDITS.md: ${models.length} models by ${artists.length} artists, ${cc0Unique.length} CC0 assets, ${photos.length} photos, ${fonts.length} fonts`);
