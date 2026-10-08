// The raw asset packs the site's worlds are built from, kept as a GitHub
// release (assets-quaternius) rather than in the repo, so clones and deploys
// stay small: this fetches one (or all) and unpacks it into lab/assets/<pack>/
// (git-ignored), where the import scripts pick models and clips from. What
// each pack holds and which worlds it suits: docs/assets/quaternius.md.
//
//   node scripts/assets-fetch.mjs list
//   node scripts/assets-fetch.mjs <pack> [<pack> …]   (or `all`)
//
// The release is public, so no key is needed; an archive already fetched is
// kept in lab/assets/.zips/ and not fetched again.
//
// Two more ways in, from the assets repo (tilakpatell/tilakverse-assets,
// public): a pack's folder as the repo keeps it (unzipped), for a session
// with git but no release zip, sparse-checked out once into
// lab/assets/.repo/ and linked as lab/assets/<pack>/; and the Sketchfab Star
// Wars originals on its sketchfab-star-wars release, each in 8 MB parts
// (<file>.part-aa, -ab, …) joined and checked against its SHA256SUMS into
// lab/assets/starwars/<file>. Each one's credit is in PACKS.starwars.models,
// copied from the repo's sketchfab/star-wars/README.md (these are not CC0).
//
//   node scripts/assets-fetch.mjs --repo <pack> [<pack> …]
//   node scripts/assets-fetch.mjs starwars [b1 atat …]   (every model, without names)
//
//   partsOf(file, n) → its first n part names (pure)
//   joinParts(dir, file) → the joined file's path: every <file>.part-?? in dir, in name order
//   readSums(text) → { file: sha256 } (pure); checkSums(dir, sums, files) → [files that don't match]

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'lab', 'assets');
const RELEASE = 'https://github.com/tilakpatell/tilakpatell.com/releases/download/assets-quaternius';

// pack → [archive, size in MB, what's in it, parts?] (an archive too big to
// upload whole is in parts, `<archive>.part-a`, `-b`…, joined here)
export const PACKS = {
  ual1: ['quaternius-universal-animation-library-source.zip', 49, 'Universal Animation Library: 120+ humanoid clips (one GLB, with and without root motion): locomotion in 8 directions, crouch, crawl, climb, sitting, hits, deaths, pistol, punches, spells, swimming, driving; the .blend'],
  ual2: ['quaternius-universal-animation-library-2-source.zip', 53, 'Universal Animation Library 2: 130+ humanoid clips (one GLB, with and without root motion), the female mannequin, the .blend'],
  city: ['quaternius-downtown-city-megakit-standard.zip', 235, 'Downtown City MegaKit (standard): modular brick and metal facades, roofs, cornices, doors, streets, sidewalks, road decals, props'],
  street: ['quaternius-street-pack.zip', 4, 'Street Pack: road tiles, bridges, ramps, traffic lights, street lights, signs'],
  furniture: ['quaternius-furniture-pack.zip', 3, 'Furniture Pack: beds, sofas, chairs, tables, bookcases, closets, lamps, vases, a plant'],
  space: ['quaternius-ultimate-space-kit.zip', 37, 'Ultimate Space Kit: astronauts and mechs (rigged), enemies, rovers, spaceships, domes and base parts, alien trees and rocks, planets, pickups'],
  farm: ['quaternius-farm-animals.zip', 7, 'Farm Animals: horse, cow, sheep, pig, llama, zebra, pug (rigged and animated)'],
  nature: ['quaternius-stylized-nature-pack.zip', 414, 'Stylized nature: birch, maple, pine, palm and dead trees, bushes, flowers, grass, rocks', 3],
  naturemega: ['quaternius-stylized-nature-megakit-source.zip', 718, 'Stylized Nature MegaKit (source): five of each tree (birch, cherry blossom, pine, giant pine, twisted, dead), bushes, ferns, flowers, grasses, mushrooms, rocks, rock paths, pebbles', 4],
  // (not a zip: the assets repo's release of Sketchfab originals, a model at a time)
  starwars: {
    release: 'https://github.com/tilakpatell/tilakverse-assets/releases/download/sketchfab-star-wars',
    models: {
      b1: { file: 'b1-battle-droid.glb', title: 'B1 Battle Droid', author: 'leoxx300', authorUrl: 'https://sketchfab.com/leoxx300', license: 'CC-BY-4.0', licenseUrl: 'http://creativecommons.org/licenses/by/4.0/', source: 'https://sketchfab.com/3d-models/b1-battle-droid-star-wars-f0ca5d7dd5b64869907c6e781d7c660a' },
      atat: { file: 'at-at-walker.glb', title: 'Imperial AT-AT Walker', author: 'Quiznos323', authorUrl: 'https://sketchfab.com/quiznos323', license: 'CC-BY-NC-SA-4.0', licenseUrl: 'http://creativecommons.org/licenses/by-nc-sa/4.0/', source: 'https://sketchfab.com/3d-models/imperial-at-at-walker-star-wars-7eab3f41da9143d8975b9034e91f8920' },
      atat1k: { file: 'at-at-walker-1k.glb', title: 'Imperial AT-AT Walker (1K maps)', author: 'Quiznos323', authorUrl: 'https://sketchfab.com/quiznos323', license: 'CC-BY-NC-SA-4.0', licenseUrl: 'http://creativecommons.org/licenses/by-nc-sa/4.0/', source: 'https://sketchfab.com/3d-models/imperial-at-at-walker-star-wars-7eab3f41da9143d8975b9034e91f8920' },
      tie: { file: 'tie-fighter.glb', title: '3D T.I.E Fighter', author: 'Mickael Boitte', authorUrl: 'https://sketchfab.com/boittemike1', license: 'CC-BY-4.0', licenseUrl: 'http://creativecommons.org/licenses/by/4.0/', source: 'https://sketchfab.com/3d-models/3d-tie-fighter-star-wars-model-5375de94c2484ab0b2a2bd75aa63c2b4' },
      venatorcw: { file: 'venator-clone-wars.glb', title: 'The Clone Wars: Venator Prefab', author: 'ShineyFX', authorUrl: 'https://sketchfab.com/ShineyFX', license: 'CC-BY-4.0', licenseUrl: 'http://creativecommons.org/licenses/by/4.0/', source: 'https://sketchfab.com/3d-models/star-wars-the-clone-wars-venator-prefab-8a1e1760391c4ac6a50373c2bf5efa2e' },
      venator: { file: 'venator.glb', title: 'Venator Class Star Destroyer', author: 'ForkyForklift', authorUrl: 'https://sketchfab.com/ForkyForklift', license: 'CC-BY-4.0', licenseUrl: 'http://creativecommons.org/licenses/by/4.0/', source: 'https://sketchfab.com/3d-models/venator-class-star-destroyer-ff65cd3c27234615a3b68088f67e99e4' },
    },
  },
};
// where each pack is in the assets repo (quaternius/<folder>), unzipped
export const FOLDERS = {
  ual1: 'universal-animation-library',
  ual2: 'universal-animation-library-2',
  city: 'downtown-city-megakit',
  street: 'street-pack',
  furniture: 'furniture-pack',
  space: 'ultimate-space-kit',
  farm: 'farm-animals',
  nature: 'stylized-nature-pack',
  naturemega: 'stylized-nature-megakit',
};
const REPO = 'https://github.com/tilakpatell/tilakverse-assets';

export const partsOf = (file, n) => Array.from({ length: n }, (_, i) => `${file}.part-${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`);

export function joinParts(dir, file) {
  const names = readdirSync(dir)
    .filter((n) => n.startsWith(`${file}.part-`) && /^[a-z]{2}$/.test(n.slice(file.length + 6)))
    .sort();
  if (!names.length) throw new Error(`no parts of ${file} in ${dir}`);
  const out = join(dir, file);
  writeFileSync(out, Buffer.concat(names.map((n) => readFileSync(join(dir, n)))));
  return out;
}

export function readSums(text) {
  const sums = {};
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (m) sums[m[2]] = m[1];
  }
  return sums;
}

export const checkSums = (dir, sums, files) => files.filter((f) => !existsSync(join(dir, f)) || createHash('sha256').update(readFileSync(join(dir, f))).digest('hex') !== sums[f]);

const curl = (url, to) => spawnSync('curl', ['-fsSL', '--retry', '3', '-o', to, url], { stdio: ['ignore', 'ignore', 'pipe'] }).status === 0;

function fetchStarWars(names) {
  const { release, models } = PACKS.starwars;
  const dir = join(OUT, 'starwars');
  mkdirSync(dir, { recursive: true });
  if (!curl(`${release}/SHA256SUMS`, join(dir, 'SHA256SUMS'))) throw new Error('starwars: no SHA256SUMS on the release');
  const sums = readSums(readFileSync(join(dir, 'SHA256SUMS'), 'utf8'));
  for (const name of names.length ? names : Object.keys(models)) {
    const m = models[name];
    if (!m) throw new Error(`starwars: no model "${name}" (${Object.keys(models).join(', ')})`);
    if (!checkSums(dir, sums, [m.file]).length) {
      console.log(`starwars: ${m.file} already in ${dir}`);
      continue;
    }
    // (the parts until one isn't there: a file re-split into more or fewer is still whole)
    let n = 0;
    for (const part of partsOf(m.file, 26 * 26)) {
      if (!curl(`${release}/${part}`, join(dir, part))) break;
      n += 1;
    }
    if (!n) throw new Error(`starwars: no parts of ${m.file} on the release`);
    joinParts(dir, m.file);
    for (const part of partsOf(m.file, n)) rmSync(join(dir, part));
    const bad = checkSums(dir, sums, [m.file]);
    if (bad.length) throw new Error(`starwars: ${m.file} does not match SHA256SUMS`);
    console.log(`starwars: ${m.file} (${n} parts, ${(statSync(join(dir, m.file)).size / 1e6).toFixed(1)} MB) into ${dir}`);
  }
}

function fetchFromRepo(pack) {
  const folder = FOLDERS[pack];
  if (!folder) throw new Error(`no pack "${pack}" in the assets repo (${Object.keys(FOLDERS).join(', ')})`);
  const repo = join(OUT, '.repo');
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd: existsSync(repo) ? repo : OUT, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed`);
  };
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(join(repo, '.git'))) git('clone', '--filter=blob:none', '--sparse', '--depth', '1', REPO, repo);
  git('sparse-checkout', 'add', `quaternius/${folder}`);
  const dir = join(OUT, pack);
  if (existsSync(dir)) return console.log(`${pack}: already in ${dir}`);
  symlinkSync(join(repo, 'quaternius', folder), dir, 'dir');
  console.log(`${pack}: ${dir} (the assets repo's quaternius/${folder})`);
}


function fetchOne(pack) {
  const [file, mb, , parts = 0] = PACKS[pack];
  const zips = join(OUT, '.zips');
  mkdirSync(zips, { recursive: true });
  const zip = join(zips, file);
  const get = (name, to) => {
    const got = spawnSync('curl', ['-fL', '--retry', '3', '-o', to, `${RELEASE}/${name}`], { stdio: 'inherit' });
    if (got.status !== 0) throw new Error(`${pack}: download of ${name} failed`);
  };
  if (!existsSync(zip) || statSync(zip).size < 1000) {
    console.log(`${pack}: fetching ${file} (${mb} MB)${parts ? ` in ${parts} parts` : ''}…`);
    if (!parts) get(file, zip);
    else {
      const names = Array.from({ length: parts }, (_, i) => `${file}.part-${String.fromCharCode(97 + i)}`);
      for (const n of names) get(n, join(zips, n));
      writeFileSync(zip, Buffer.concat(names.map((n) => readFileSync(join(zips, n)))));
      for (const n of names) rmSync(join(zips, n));
    }
  }
  const dir = join(OUT, pack);
  if (existsSync(join(dir, '.unpacked'))) return console.log(`${pack}: already in ${dir}`);
  mkdirSync(dir, { recursive: true });
  const un = spawnSync('unzip', ['-q', '-o', zip, '-d', dir], { stdio: 'inherit' });
  if (un.status !== 0) throw new Error(`${pack}: unzip failed (needs unzip on the PATH)`);
  writeFileSync(join(dir, '.unpacked'), file);
  console.log(`${pack}: unpacked into ${dir}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const asked = process.argv.slice(2);
  if (!asked.length || asked[0] === 'list') {
    for (const [k, p] of Object.entries(PACKS)) {
      if (!Array.isArray(p)) console.log(`${k.padEnd(11)}   (release) the Sketchfab Star Wars originals: ${Object.keys(p.models).join(', ')}`);
      else console.log(`${k.padEnd(11)} ${String(p[1]).padStart(4)} MB  ${p[2]}  (${p[0]})`);
    }
  } else if (asked[0] === '--repo') {
    for (const pack of asked.slice(1)) fetchFromRepo(pack);
  } else if (asked[0] === 'starwars') {
    fetchStarWars(asked.slice(1));
  } else {
    for (const pack of asked[0] === 'all' ? Object.keys(PACKS).filter((k) => Array.isArray(PACKS[k])) : asked) {
      if (!PACKS[pack]) throw new Error(`no pack "${pack}": node scripts/assets-fetch.mjs list`);
      fetchOne(pack);
    }
  }
}
