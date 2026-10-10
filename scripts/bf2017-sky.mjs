// A level's light probe from Star Wars Battlefront II (2017) (EA DICE's,
// used with permission on this non-commercial fan project), published for
// the owner's lighting lane (this pipeline builds no lighting: the owner's
// rule of 2026-10-10, 04:40): the six Radiance faces of one of the level's
// reflection volumes, fetched from the drop's bucket into lab/assets/bf2017/
// (git-ignored), brought to the site's light (scripts/lib/bf2017-sky.mjs)
// and written at the game's 128 and at 64, as
// public/textures/galaxy/sky/<name>-probe-<size>-<face>.hdr, with what each
// is in docs/superpowers/evidence/bf2017-<world>/skies.md.
//
//   node scripts/bf2017-sky.mjs <bucket folder> <probe id> --name hoth [--mean 0.8]
//
//   folder  web/textures/levels/mp/hoth_01/reflectionvolumetexture/cloudy_vfx
//   id      the probe's id, its faces <id>-tex_{px,nx,py,ny,pz,nz}.hdr (the
//           daytime one out on the level's main arena: look at them first)
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY) from the environment,
// never printed; a face already on disk is not fetched again.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FloatType } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { parseArgs } from './lib/args.mjs';
import { bucketFile } from './lib/bf2017-bucket.mjs';
import { encodeRgbe, halve, normalise } from './lib/bf2017-sky.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
// (the game's own 128, and half of it for a weak device)
const SIZES = [128, 64];

async function face(root, bucketPath) {
  const file = await bucketFile(root, bucketPath);
  const buf = await readFile(file);
  const l = new HDRLoader();
  l.setDataType(FloatType);
  const { data, width, height } = l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  return { data, width, height };
}

export async function makeSky(folder, id, { name, mean = 0.8, root = join(ROOT, 'lab', 'assets', 'bf2017'), out = join(ROOT, 'public', 'textures', 'galaxy', 'sky') } = {}) {
  if (!/^[a-z0-9]+$/.test(name ?? '')) throw new Error('--name: the world, letters and digits (hoth)');
  const faces = normalise(await Promise.all(FACES.map((f) => face(root, `${folder}/${id}-tex_${f}.hdr`))), mean);
  await mkdir(out, { recursive: true });
  const written = [];
  let level = faces;
  for (const size of SIZES) {
    while (level[0].width > size) level = level.map(halve);
    for (const [i, f] of FACES.entries()) {
      const file = join(out, `${name}-probe-${size}-${f}.hdr`);
      await writeFile(file, encodeRgbe(level[i]));
      written.push(file);
    }
  }
  for (const f of written) console.log(relative(ROOT, f));
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [folder, id] = args._;
  if (!folder || !id) {
    console.error('usage: node scripts/bf2017-sky.mjs <bucket folder> <probe id> --name <world> [--mean 0.8]');
    process.exit(1);
  }
  makeSky(folder, id, { name: args.name, mean: args.mean ? Number(args.mean) : 0.8 }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
