// Seals the secret world's exhibits with its password, for
// src/components/dickansh/sealed.json (see src/components/dickansh/seal.js),
// and, given a folder of photos, the friendship wall's photos with it: each
// made a WebP no more than 1400 px across (and stripped of where and when it
// was taken), sealed under the same key into public/dickansh/sealed/. The
// folder's captions.json ({ "file.jpg": "caption" }, in the order to show
// them) names and orders them. The plain JSON and the photos stay out of the
// repo: keep them somewhere of your own.
//
//   node scripts/dickansh-seal.mjs <exhibits.json> "<password>" [photos folder]

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { boxKey, seal, sealBytes, unseal, unsealBytes } from '../src/components/dickansh/seal.js';

const [from, password, photosDir] = process.argv.slice(2);
if (!from || !password) {
  console.error('usage: node scripts/dickansh-seal.mjs <exhibits.json> "<password>" [photos folder]');
  process.exit(1);
}
const value = JSON.parse(await readFile(from, 'utf8'));
const OUT = new URL('../public/dickansh/sealed/', import.meta.url);

// the photos' list goes into the sealed value; the files are sealed after,
// under the box's key (so a fresh seal means fresh files)
const photos = [];
if (photosDir) {
  const captions = existsSync(join(photosDir, 'captions.json')) ? JSON.parse(await readFile(join(photosDir, 'captions.json'), 'utf8')) : {};
  const files = (await readdir(photosDir)).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f));
  const order = [...Object.keys(captions).filter((f) => files.includes(f)), ...files.filter((f) => !(f in captions)).sort()];
  for (const [i, file] of order.entries()) photos.push({ file, src: `/dickansh/sealed/${String(i + 1).padStart(2, '0')}.bin`, caption: captions[file] ?? '' });
}
if (photosDir) value.photos = [];
const plain = [];
for (const p of photos) {
  const img = sharp(join(photosDir, p.file)).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
  value.photos.push({ src: p.src, caption: p.caption, w: info.width, h: info.height });
  plain.push(data);
}
const box = await seal(value, password);
if (JSON.stringify(await unseal(box, password)) !== JSON.stringify(value)) throw new Error('sealed exhibits did not open again');
await writeFile(new URL('../src/components/dickansh/sealed.json', import.meta.url), `${JSON.stringify(box, null, 2)}\n`);
if (photosDir) {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const key = await boxKey(box, password);
  for (const [i, p] of value.photos.entries()) {
    const sealed = await sealBytes(plain[i], key);
    if (!(await unsealBytes(sealed, key))) throw new Error(`${p.src} did not open again`);
    await writeFile(new URL(p.src.split('/').pop(), OUT), sealed);
  }
}
console.log(`sealed ${value.exhibits?.length ?? 0} exhibits${photosDir ? ` and ${value.photos.length} photos` : ''}, ${box.data.length} characters`);
