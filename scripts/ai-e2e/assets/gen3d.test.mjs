// Tier 2: every model gen3d shipped, as it is in the repository, held to
// the bar web.mjs set when it was made: three cuts, each within its budget
// for the ask its cuts imply, each within its size cap, WebP textures no
// bigger than its tier's, meshopt, one scene, and its credit. A model
// edited or imported by hand is held to the same bar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TIERS, ULTRA, cutsFor, inferFaces } from '../../gen3d/budget.mjs';
import { REPO } from '../contract/repo.mjs';
import { inspect } from './glb.mjs';

const DIR = join(REPO, 'public', 'models', 'gen3d');
const NAMES = readdirSync(DIR)
  .filter((f) => /^[^.]+\.glb$/.test(f))
  .map((f) => f.replace(/\.glb$/, ''));
const CREDITS = JSON.parse(readFileSync(join(REPO, 'public', 'games', 'credits.json'), 'utf8'));
// a cut well under its budget is a copy of a smaller one, or a failed simplify
const FLOOR = 0.25;

describe('the gen3d models as shipped', () => {
  it('are there to test', () => {
    expect(NAMES.length).toBeGreaterThan(0);
  });

  describe.each(NAMES)('%s', (name) => {
    const file = (t) => join(DIR, `${name}${TIERS[t].suffix}.glb`);
    const cuts = () => Promise.all(Object.keys(TIERS).map(async (t) => [t, await inspect(file(t))]));

    it('has three cuts, each within its budget for the ask they imply', async () => {
      const got = Object.fromEntries(await cuts());
      const faces = inferFaces(Object.fromEntries(Object.entries(got).map(([t, m]) => [t, m.tris])));
      const budget = cutsFor(faces);
      for (const [t, m] of Object.entries(got)) {
        const say = `${name}${TIERS[t].suffix}.glb: ${Math.round(m.tris)} triangles against ${budget[t].faces} (asked ${faces})`;
        expect(m.tris, say).toBeLessThanOrEqual(budget[t].faces * 1.05);
        expect(m.tris, say).toBeGreaterThanOrEqual(budget[t].faces * FLOOR);
        expect(m.bytes, `${name}${TIERS[t].suffix}.glb: ${(m.bytes / 1024).toFixed(0)} KB, over ${TIERS[t].bytes / 1024} KB`).toBeLessThanOrEqual(TIERS[t].bytes);
      }
    });

    it('has WebP textures no bigger than each tier’s, meshopt and one scene', async () => {
      for (const [t, m] of await cuts()) {
        const at = `${name}${TIERS[t].suffix}.glb`;
        for (const tex of m.textures) {
          expect(tex.mime, at).toBe('image/webp');
          expect(Math.max(tex.w, tex.h), `${at}: a ${tex.w}×${tex.h} texture`).toBeLessThanOrEqual(TIERS[t].tex);
        }
        expect(m.meshopt, `${at}: not meshopt-compressed`).toBe(true);
        expect(m.scenes, at).toBe(1);
      }
    });

    // (made only for a model asked for at ultra: budget.mjs ULTRA)
    it.runIf(existsSync(join(DIR, `${name}${ULTRA.suffix}.glb`)))('has an ultra cut within its budget, no lighter than its hq one', async () => {
      const at = `${name}${ULTRA.suffix}.glb`;
      const [ultra, hq] = await Promise.all([inspect(join(DIR, at)), inspect(file('hq'))]);
      expect(ultra.tris, at).toBeLessThanOrEqual(ULTRA.faces * 1.05);
      expect(ultra.tris, at).toBeGreaterThanOrEqual(hq.tris);
      expect(ultra.bytes, at).toBeLessThanOrEqual(ULTRA.bytes);
      for (const tex of ultra.textures) expect(Math.max(tex.w, tex.h), at).toBeLessThanOrEqual(ULTRA.tex);
      expect(ultra.meshopt, at).toBe(true);
    });

    it('is credited as gen3d/<name>', () => {
      const credit = CREDITS[`gen3d/${name}`];
      expect(credit, `public/games/credits.json has no gen3d/${name}`).toBeTruthy();
      expect(credit.license, name).toBeTruthy();
      expect(credit.name, name).toMatch(/scripts\/gen3d/);
    });
  });
});
