// Tier 1: a model over its budget never ships. web.mjs's simplifier can
// bring any mesh to its triangle count, so what overshoots in practice is
// the size: the fake engine's noise textures (GEN3D_FAKE_NOISE) make a
// model too heavy for its cut, and web.mjs must refuse it in budget.mjs's
// words, with nothing credited.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES, sandbox } from './repo.mjs';

describe('a model over budget (subprocesses, up to 10 s)', () => {
  it('is refused in budget.mjs’s words, and nothing is credited or kept as a result', async () => {
    const box = sandbox();
    const r = await box.make(['heavy', '--image', join(FIXTURES, 'x-wing-ref.png'), '--what', 'a heavy box', '--faces', '8000', '--no-judge'], { GEN3D_FAKE_NOISE: '2' });
    expect(r.status).not.toBe(0);
    expect(r.err).toMatch(/heavy \(mid\): \d+ KB, over 4096 KB/);
    const credits = JSON.parse(readFileSync(join(box.out, 'public', 'games', 'credits.json'), 'utf8'));
    expect(credits['gen3d/heavy']).toBeUndefined();
    expect(existsSync(join(box.cache, 'heavy', 'result.json'))).toBe(false);
    expect(existsSync(join(box.out, 'public', 'models', 'gen3d', 'heavy.glb'))).toBe(false);
  });
});
