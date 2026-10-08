/* global window */
// Kit models as the worlds draw them, for judging the kit at run time
// (lib/three/kit, public/kit/<pack>/): the galaxy placer's scatter of
// `kit:<pack>/<Name>` rows on a flat world, and lib/three/kit's pools of the
// same models in the house's look and out of it, with a few of `far`'s in
// their puff band (the pools' far stand-in, lib/three/puffs' puffFor),
// through the dev server (npx vite --port 5188) and
// scripts/preview/kit.html, in headless Chromium. Every shader is checked
// as it is made: a program that fails, a page error or a console error
// fails the shot (exit 1), and so does a `far` asked for that drew no puff,
// or one whose program failed or doesn't read its trunk's flag. `far` is
// Birch_1:2 for naturemega and none for any other pack (name its own to ask).
//
//   node scripts/kit-shot.mjs [out dir (lab/kit)] [pack] [scatter <Name>:<n>,…] [pools <Name>,…] [far <Name>:<n>]
//   shoot({ pack, scatter, pools, far }) → { scatter: PNG Buffer, pools: PNG Buffer,
//                                            result (the page's), errors, console, args }
// The scatter's picture is <out>/scatter.png, the pools' <out>/pools.png. A
// shot with rows asked for that drew no kit program in the wind fails too:
// nothing was checked; and so does one where a second of wind moved no
// pixel of either view's top half, where the crowns are (`moved`, the % of
// each that changed).

import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = () => process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = () => process.env.CHROME ?? '/opt/pw-browsers/chromium';
const W = 960;
const H = 640;

export async function shoot({ pack = 'naturemega', scatter = 'Fern_1:40,Birch_1:10', pools = 'Birch_1,Fern_1', far = pack === 'naturemega' ? 'Birch_1:2' : '', w = W, h = H } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: w * 2, height: h } });
    const errors = [];
    const console_ = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`${r.status()} ${r.url()}`));
    page.on('console', (m) => {
      console_.push(`${m.type()}: ${m.text()}`);
      if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); // (a failed fetch is named by its response, above)
    });
    await page.goto(`${BASE()}/scripts/preview/kit.html?pack=${pack}&scatter=${scatter}&pools=${pools}&far=${far}&w=${w}&h=${h}&quality=high`);
    await page.waitForFunction(() => window.__done, null, { timeout: 300000 });
    const result = await page.evaluate(() => window.__done);
    const png = await page.screenshot();
    const crop = (left) => sharp(png).extract({ left, top: 0, width: w, height: h }).png().toBuffer();
    return { scatter: await crop(0), pools: await crop(w), result, errors, console: console_, args: { pack, scatter, pools, far } };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [out = 'lab/kit', pack, scatter, pools, far] = process.argv.slice(2);
  const shot = await shoot({ pack, scatter, pools, far });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'scatter.png'), shot.scatter);
  writeFileSync(join(out, 'pools.png'), shot.pools);
  console.log(JSON.stringify({ ...shot.result, errors: shot.errors, console: shot.console }, null, 1));
  const asked = [shot.args.scatter, shot.args.pools].some((list) => list.split(',').filter(Boolean).length);
  const weighted = shot.result.weighted ?? [];
  // (and a second of wind moved some of the crowns: % of each view's top half)
  const still = asked && !(shot.result.moved ?? []).some((p) => p > 0);
  // (the far band: puffs drawn, each program run and reading the trunk's flag)
  const puffed = shot.result.puffed ?? [];
  const puffless = Boolean(shot.args.far) && (!puffed.length || puffed.some((p) => !p.ok || !p.trunk || !p.flag));
  const bad = shot.errors.length || shot.result.error || shot.result.failed?.length || weighted.some((p) => !p.ok || !p.weight) || (asked && !weighted.length) || still || puffless;
  console.log(bad ? 'kit shot: FAILED' : `kit shot: ${join(out, 'scatter.png')}, ${join(out, 'pools.png')}; ${shot.result.programs} programs, none failed, ${weighted.length} in the wind by their weight, ${puffed.reduce((n, p) => n + p.count, 0)} puffs in ${puffed.length} draws; a second of wind moved ${shot.result.moved.join(' % and ')} %`);
  process.exit(bad ? 1 : 0);
}
