// Tier 6's run, tested here with the fakes in place of the GPU's engines:
// the plumbing of the nightly real run (where it writes, what it reads
// back, the lines it holds the night to) on every pull request, so the
// night it matters it doesn't fail on a typo.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, run, sandbox } from '../contract/repo.mjs';
import { missing, references } from '../contract/voices-kit.mjs';
import { LIMITS, short } from './health.mjs';

const good = { gen3d: { ok: true, status: 0, verdict: 8, tris: { hq: 8000, mid: 4000, lo: 1333 }, budget: { hq: 8000, mid: 4000, lo: 1333 }, seconds: 300 }, voices: { ok: true, status: 0, made: 1, doubtful: 0, seconds: 120 } };

describe('the lines a real night is held to', () => {
  it('pass a good night', () => {
    expect(short(good)).toEqual([]);
  });
  it('name each thing that fell short', () => {
    const bad = { gen3d: { ...good.gen3d, verdict: 5, tris: { hq: 9000, mid: 4000, lo: 1333 }, seconds: LIMITS.gen3dSeconds + 1 }, voices: { ...good.voices, made: 0, doubtful: 1, seconds: LIMITS.voicesSeconds + 1 } };
    expect(short(bad)).toEqual([
      'gen3d: the judge gave it 5/10, under 7',
      'gen3d: the hq cut has 9000 triangles, over its 8000',
      `gen3d: took ${Math.round((LIMITS.gen3dSeconds + 1) / 60)} min, over ${LIMITS.gen3dSeconds / 60}`,
      'voices: 0 lines made, not 1',
      'voices: 1 doubtful',
      `voices: took ${Math.round((LIMITS.voicesSeconds + 1) / 60)} min, over ${LIMITS.voicesSeconds / 60}`,
    ]);
  });
  it('say so when a pipeline didn’t finish, or had no judge to ask', () => {
    expect(short({ gen3d: { ok: false, status: 1, error: 'make.mjs exited 1' }, voices: good.voices })).toEqual(['gen3d: make.mjs exited 1']);
    expect(short({ gen3d: { ...good.gen3d, verdict: null }, voices: good.voices })).toEqual(['gen3d: no verdict (no judge reachable, or no sheet)']);
  });
});

const why = process.env.CI ? null : missing();

describe.skipIf(why)(`the real run's plumbing, with the fakes (subprocesses, up to 30 s)${why ? `: skipped, ${why}` : ''}`, () => {
  it('makes the X-wing and Han’s line, outside public/, and writes the night’s results', async () => {
    const box = sandbox();
    const results = mkdtempSync(join(tmpdir(), 'ai-e2e-real-'));
    const refs = references(join(box.dir, 'refs'));
    const env = { ...box.env, AI_RESULTS: results, VOICES_ENGINE: 'fake', VOICES_JUDGE: 'fake', VOICES_REFS: refs, VOICES_PYTHON: (await import('../contract/voices-kit.mjs')).python(), AI_DATE: '2026-10-07' };
    delete env.GEN3D_OUT;
    delete env.GEN3D_CACHE;
    const r = await run(process.execPath, [join(REPO, 'scripts', 'ai-e2e', 'real', 'health.mjs')], { env, timeoutMs: 120000 });
    expect(r.status, `${r.out}\n${r.err}`).toBe(0);
    const night = JSON.parse(readFileSync(join(results, '2026-10-07-real.json'), 'utf8'));
    expect(night).toMatchObject({ tier: 'real', ok: true, short: [], gen3d: { ok: true, verdict: 9 }, voices: { ok: true, made: 1, doubtful: 0 } });
    expect(Object.keys(night.gen3d.tris)).toEqual(['hq', 'mid', 'lo']);
    // nothing written into the site's own folders
    expect(existsSync(join(REPO, 'public', 'models', 'gen3d', 'ai-health-xwing.glb'))).toBe(false);
    expect(readFileSync(join(REPO, 'public', 'games', 'credits.json'), 'utf8')).not.toMatch(/ai-health-xwing/);
  }, 120000);
});
