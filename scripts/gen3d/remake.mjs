// A model the site already has, made again at full quality: its own render
// on white (the shape it has, which TRELLIS.2 keeps, adding the detail) is
// the reference picture, as the trench run's X-wing was made.
//
//   CHROME=… BASE=http://127.0.0.1:5299 node scripts/gen3d/remake.mjs public/models/universe/cr90.glb cr90 --what "a CR90 corvette" [--view three] [--faces 60000] [--tex 2048] [--seed 42]
//
// The render is the judge's three-quarter view unless --view says another
// (front, side, top); the picture lands in cache/<name>/reference.png to be
// looked at, and the rest is make.mjs's.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shoot } from '../glb-shot.mjs';
import { make } from './make.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export async function reference(glb, out, view = 'three') {
  const [png] = await shoot(glb, [view], { bg: 'ffffff', w: 1024, h: 1024 });
  writeFileSync(out, png);
  return out;
}

export async function remake(glb, name, { view = 'three', ...opts } = {}) {
  const dir = join(HERE, 'cache', name);
  mkdirSync(dir, { recursive: true });
  const ref = await reference(glb, join(dir, 'reference.png'), view);
  console.log(`[${name}] reference: ${ref}`);
  // not Pixal3D: a render isn't a frontal photo, and the shape should be free to improve
  return make(name, { ...opts, image: ref, faithful: false, match: glb }); // its brightness matched to the old one's: the render's shading darkens the paint
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const [faces, tex] = [flag('faces'), flag('tex')];
  const opts = { what: flag('what'), view: flag('view', 'three'), faces: faces && Number(faces), tex: tex && Number(tex), seed: Number(flag('seed', 42)) };
  const [glb, name] = args;
  if (!glb || !name) throw new Error('usage: node scripts/gen3d/remake.mjs EXISTING.glb NAME --what "…" [--view three|front|side|top]');
  if (!process.env.CHROME) throw new Error('CHROME (a Chromium) and BASE (the dev server) are needed for the reference render');
  await remake(resolve(glb), name, opts);
}
