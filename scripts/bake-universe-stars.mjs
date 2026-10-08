// The universe map's stars (public/textures/universe/stars.bin): the real
// sky's, every star in the Hipparcos catalogue (ESA, 1997, through CDS's
// VizieR, I/239) to tenth magnitude, about 108,000 of them, each where the
// Milky Way's photo has it (src/components/universe/starCatalog.js: the
// format, the frame and the reading back).
//
//   NODE_USE_ENV_PROXY=1 node scripts/bake-universe-stars.mjs
//
// (it downloads the catalogue, 5 MB, to scripts/.cache the first time)

import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { RECORD, encodeStar, equatorialToGalactic, skyDir } from '../src/components/universe/starCatalog.js';

const SOURCE_URL = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=I/239/hip_main&-out=HIP,_RA.icrs,_DE.icrs,Vmag,B-V&-out.max=unlimited';
const SOURCE = 'scripts/.cache/hip_main.tsv';
const OUT = 'public/textures/universe/stars.bin';
const FAINTEST = 10; // V
const SUN_LIKE = 0.65; // B-V, for the stars the catalogue has none for

if (!existsSync(SOURCE)) {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`${SOURCE_URL}: ${res.status}`);
  await mkdir('scripts/.cache', { recursive: true });
  await writeFile(SOURCE, await res.text());
}

const stars = [];
for (const line of (await readFile(SOURCE, 'utf8')).split('\n')) {
  const [hip, ra, dec, v, bv] = line.split('\t');
  if (!/^\s*\d+$/.test(hip ?? '')) continue; // the header, its units, its rule
  const [V, RA, DEC] = [v, ra, dec].map((s) => (s?.trim() ? Number(s) : NaN));
  if (![V, RA, DEC].every(Number.isFinite) || V > FAINTEST) continue;
  const BV = bv?.trim() ? Number(bv) : SUN_LIKE;
  stars.push({ dir: skyDir(...equatorialToGalactic(RA, DEC)), v: V, bv: BV });
}
stars.sort((a, b) => a.v - b.v);

const buf = new Uint8Array(stars.length * RECORD);
stars.forEach((s, i) => encodeStar(buf, i, s.dir, s.v, s.bv));
await writeFile(OUT, buf);
console.log(`${OUT}: ${stars.length} stars to V ${FAINTEST}, ${Math.round(statSync(OUT).size / 1024)} KB`);
