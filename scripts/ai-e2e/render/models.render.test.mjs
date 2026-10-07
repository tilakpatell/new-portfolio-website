// Tier 3: every model draws. Each gen3d cut is rendered the way the judge
// renders it (scripts/glb-shot.mjs: headless Chromium, SwiftShader, a dev
// server) and must fill at least COVERAGE of the frame with no console or
// page error outside the noise every software renderer makes. The PNGs go
// to render/out/ for a person, or the nightly's artifacts, to look at.
//
// AI_RENDER_ALL=1 (the nightly) renders every GLB under public/models/,
// in the plain look and the toon look the galaxy draws figures with.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { noisy } from '../../lib/noise.mjs';
import { tracked } from '../assets/credits.mjs';
import { REPO } from '../contract/repo.mjs';
import { coverage } from './coverage.mjs';
import { chromium as findChromium, serve } from './server.mjs';

// a model framed by the three-quarter view covers far more than this; a
// blank canvas, or a model loaded as a speck, covers less
const COVERAGE = 0.04;
const W = 320;
const H = 240;
const OUT = join(REPO, 'scripts', 'ai-e2e', 'render', 'out');
const ALL = process.env.AI_RENDER_ALL === '1';
const MODELS = tracked(REPO, ALL ? 'public/models' : 'public/models/gen3d').filter((f) => f.endsWith('.glb'));
const LOOKS = ALL ? ['', 'toon'] : [''];
const CHROME = findChromium();
// on CI the job installs Chromium, so a missing one is a failure there, never a quiet skip
const why = !CHROME && !process.env.CI ? 'no Chromium (set CHROME, or npx playwright install chromium)' : null;

describe.skipIf(why)(`every model draws (a browser, up to 60 s each)${why ? `: skipped, ${why}` : ''}`, () => {
  let server;
  let browser;
  let shoot;
  const results = [];
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
    writeFileSync(join(OUT, 'results.json'), `${JSON.stringify({ tier: 'render', coverage: COVERAGE, models: results }, null, 1)}\n`);
  });

  const cases = MODELS.flatMap((file) => LOOKS.map((look) => [`${file}${look ? ` (${look})` : ''}`, file, look]));
  it.each(cases)('%s', async (_, file, look) => {
    const [png] = await shoot(join(REPO, file), ['three'], { w: W, h: H, look: look || undefined, browser });
    const name = relative('public/models', file).replace(/[\\/]/g, '__').replace(/\.glb$/, look ? `.${look}.png` : '.png');
    writeFileSync(join(OUT, name), png);
    const share = await coverage(png);
    const errors = shoot.last.errors.filter((e) => !noisy(e));
    results.push({ file, look: look || 'plain', coverage: share, errors });
    expect(errors, `${file}: errors`).toEqual([]);
    expect(share, `${file}: ${(share * 100).toFixed(1)}% of the frame drawn`).toBeGreaterThanOrEqual(COVERAGE);
  });
});
