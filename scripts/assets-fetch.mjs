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

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
};

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
    for (const [k, [file, mb, what]] of Object.entries(PACKS)) console.log(`${k.padEnd(11)} ${String(mb).padStart(4)} MB  ${what}  (${file})`);
  } else {
    for (const pack of asked[0] === 'all' ? Object.keys(PACKS) : asked) {
      if (!PACKS[pack]) throw new Error(`no pack "${pack}": node scripts/assets-fetch.mjs list`);
      fetchOne(pack);
    }
  }
}
