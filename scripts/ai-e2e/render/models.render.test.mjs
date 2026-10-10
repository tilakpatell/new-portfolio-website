// Tier 3: every model draws. Each gen3d cut is rendered the way the judge
// renders it (scripts/glb-shot.mjs: headless Chromium, SwiftShader, a dev
// server) and must fill at least COVERAGE of the frame with no console or
// page error outside the noise every software renderer makes. The PNGs go
// to render/out/ for a person, or the nightly's artifacts, to look at.
//
// AI_RENDER_ALL=1 (the nightly) renders every GLB under public/models/ in
// the plain look, and the galaxy's again in the toon look it draws its
// figures with (every model in both looks took the whole night).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { noisy } from '../../lib/noise.mjs';
import { tracked } from '../assets/credits.mjs';
import { inspect } from '../assets/glb.mjs';
import { REPO } from '../contract/repo.mjs';
import { coverage } from './coverage.mjs';
import { chromium as findChromium, serve } from './server.mjs';

// a blank canvas, or a model loaded as a speck, covers less than this; a
// framed model more: a fighter or a figure 10 to 30%, the longest, thinnest
// ships seen three-quarter (the Executor, the Nubian, the krayt) about 3.3%,
// which is why the first night's 4% was too strict
const COVERAGE = 0.02;
// a fresh browser this often: hundreds of loads in one ran it out of buffer
// space (ERR_NO_BUFFER_SPACE) and a model failed to load for that alone
const RELAUNCH = 100;
const W = 320;
const H = 240;
const OUT = join(REPO, 'scripts', 'ai-e2e', 'render', 'out');
const ALL = process.env.AI_RENDER_ALL === '1';
const MODELS = tracked(REPO, ALL ? 'public/models' : 'public/models/gen3d').filter((f) => f.endsWith('.glb'));
const looks = (file) => (ALL && file.startsWith('public/models/galaxy/') ? ['', 'toon'] : ['']);
const CHROME = findChromium();
// on CI the job installs Chromium, so a missing one is a failure there, never a quiet skip
const why = !CHROME && !process.env.CI ? 'no Chromium (set CHROME, or npx playwright install chromium)' : null;

describe.skipIf(why)(`every model draws (a browser, up to 60 s each)${why ? `: skipped, ${why}` : ''}`, () => {
  let server;
  let browser;
  let shoot;
  const results = [];
  // written after every model, so a night cut off by its time limit still says what it saw
  const save = () => {
    const json = `${JSON.stringify({ tier: 'render', coverage: COVERAGE, models: results }, null, 1)}\n`;
    writeFileSync(join(OUT, 'results.json'), json);
    // and where the nightly report reads every tier's results
    if (process.env.AI_RESULTS) {
      mkdirSync(process.env.AI_RESULTS, { recursive: true });
      writeFileSync(join(process.env.AI_RESULTS, 'render.json'), json);
    }
  };
  beforeAll(async () => {
    server = await serve(REPO);
    process.env.BASE = server.base;
    process.env.CHROME = CHROME;
    ({ shoot } = await import('../../glb-shot.mjs'));
    browser = await shoot.launch();
    mkdirSync(OUT, { recursive: true });
  });
  afterAll(async () => {
    await browser?.close();
    server?.stop();
    save();
  });

  const cases = MODELS.flatMap((file) => looks(file).map((look) => [`${file}${look ? ` (${look})` : ''}`, file, look]));
  let shots = 0;
  it.each(cases)('%s', async (_, file, look) => {
    // an animation-only file (a clip the figures play, no mesh) has nothing to draw
    if (!(await inspect(join(REPO, file))).tris) {
      results.push({ file, look: look || 'plain', clip: true });
      save();
      return;
    }
    if (++shots % RELAUNCH === 0) {
      await browser.close();
      browser = await shoot.launch();
    }
    const [png] = await shoot(join(REPO, file), ['three'], { w: W, h: H, look: look || undefined, browser }).catch((e) => {
      // a model that never loads is a finding too, written down like the rest
      results.push({ file, look: look || 'plain', coverage: 0, errors: [String(e.message ?? e).slice(0, 300)] });
      save();
      throw e;
    });
    const name = relative('public/models', file).replace(/[\\/]/g, '__').replace(/\.glb$/, look ? `.${look}.png` : '.png');
    writeFileSync(join(OUT, name), png);
    const share = await coverage(png);
    const errors = shoot.last.errors.filter((e) => !noisy(e));
    results.push({ file, look: look || 'plain', coverage: share, errors });
    save();
    expect(errors, `${file}: errors`).toEqual([]);
    expect(share, `${file}: ${(share * 100).toFixed(1)}% of the frame drawn`).toBeGreaterThanOrEqual(COVERAGE);
  });
});
