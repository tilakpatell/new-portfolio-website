// How the vision judge's labelled set was made, so it can be made again or
// grown: each sheet is one model's four views (judge.mjs's: three-quarter,
// front, side, top) side by side with no caption (a caption names the file,
// and the file names the answer), as WebP; each pick set is four
// three-quarter renders on white, one of them the thing asked for.
//
//   CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/ai-e2e/evals/make-sheets.mjs
//
// The labels are in sheets/labels.json and pick-sets/labels.json, written
// by hand: a score band a fair judge's score falls in, and why.

import { NodeIO } from '@gltf-transform/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { model } from '../fakes/engine.mjs';
import { chromium, serve } from '../render/server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(ROOT, 'scripts', '.cache', 'evals');
const M = (p) => join(ROOT, 'public', 'models', p);
const VIEWS = ['three', 'front', 'side', 'top'];

// the sheets: [file name, model]
export const SHEETS = [
  ['x-wing.webp', M('gen3d/x-wing.glb')],
  ['tie-fighter.webp', M('gen3d/tie-fighter.glb')],
  ['tie-interceptor.webp', M('gen3d/tie-interceptor.glb')],
  ['falcon.webp', M('universe/falcon.glb')],
  ['slave1.webp', M('universe/slave1.glb')],
  ['star-destroyer.webp', M('universe/star-destroyer.glb')],
  ['cr90.webp', M('universe/cr90.glb')],
  ['venator.webp', M('universe/venator.glb')],
  ['sitar.webp', M('sketchfab/sitar.glb')],
  ['rv.webp', M('sketchfab/rv.glb')],
  // the deliberate wrongs (labels.json asks the wrong question of the first three)
  ['tie-as-x-wing.webp', M('gen3d/tie-fighter.glb')],
  ['x-wing-as-tie.webp', M('gen3d/x-wing.glb')],
  ['falcon-as-star-destroyer.webp', M('universe/falcon.glb')],
  ['sitar-as-guitar.webp', M('sketchfab/sitar.glb')],
  ['fake-box.webp', join(WORK, 'box.glb')],
  ['x-wing-on-its-back.webp', join(WORK, 'x-wing-on-its-back.glb')],
];

// the pick sets: [set, the thing asked for's candidate first, then the others]
export const PICKS = {
  'x-wing': [M('gen3d/x-wing.glb'), M('gen3d/tie-fighter.glb'), M('universe/falcon.glb'), join(WORK, 'box.glb')],
  'tie-fighter': [M('gen3d/tie-fighter.glb'), M('gen3d/x-wing.glb'), M('universe/slave1.glb'), M('universe/cr90.glb')],
  falcon: [M('universe/falcon.glb'), M('gen3d/tie-interceptor.glb'), M('universe/star-destroyer.glb'), M('sketchfab/rv.glb')],
  sitar: [M('sketchfab/sitar.glb'), M('sketchfab/rv.glb'), M('gen3d/x-wing.glb'), join(WORK, 'box.glb')],
  'star-destroyer': [M('universe/star-destroyer.glb'), M('universe/venator.glb'), M('universe/cr90.glb'), M('universe/falcon.glb')],
};

async function work() {
  mkdirSync(WORK, { recursive: true });
  const io = new NodeIO();
  await io.write(join(WORK, 'box.glb'), model([Buffer.from('an eval box')], { seed: 1 }));
  const { upright } = await import('../../gen3d/upright.mjs');
  const { io: webIo } = await import('../../gen3d/web.mjs');
  const nio = await webIo();
  const doc = await nio.read(M('gen3d/x-wing.glb'));
  await upright(doc, { x: 90 });
  await nio.write(join(WORK, 'x-wing-on-its-back.glb'), doc);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await work();
  const server = await serve(ROOT);
  process.env.BASE = server.base;
  process.env.CHROME = chromium();
  const { shoot } = await import('../../glb-shot.mjs');
  const browser = await shoot.launch();
  try {
    mkdirSync(join(HERE, 'sheets'), { recursive: true });
    for (const [name, file] of SHEETS) {
      const shots = await shoot(file, VIEWS, { browser });
      const out = join(HERE, 'sheets', name);
      await sharp({ create: { width: 640 * VIEWS.length, height: 480, channels: 3, background: '#111' } })
        .composite(shots.map((input, i) => ({ input, left: i * 640, top: 0 })))
        .webp({ quality: 80 })
        .toFile(out);
      console.log(out);
    }
    for (const [set, files] of Object.entries(PICKS)) {
      mkdirSync(join(HERE, 'pick-sets', set), { recursive: true });
      // shuffled by a fixed order, so the right one isn't always first
      const order = [[2, 0, 3, 1], [0, 3, 1, 2], [3, 1, 0, 2], [1, 2, 3, 0], [2, 3, 0, 1]][Object.keys(PICKS).indexOf(set) % 5];
      for (const [slot, i] of order.entries()) {
        const [png] = await shoot(files[i], ['three'], { bg: 'ffffff', w: 512, h: 512, browser });
        await sharp(png).webp({ quality: 82 }).toFile(join(HERE, 'pick-sets', set, `${'abcd'[slot]}.webp`));
        if (i === 0) writeFileSync(join(WORK, `${set}.right`), 'abcd'[slot]);
      }
      console.log(set);
    }
  } finally {
    await browser.close();
    server.stop();
  }
}
