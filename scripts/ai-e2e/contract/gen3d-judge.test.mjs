// Tier 1: the judge's loop. A miss is made again once with the next seed;
// a second miss ships with its verdict, as the README says; --no-judge
// asks nothing. The judge is the fake, answering from a script.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES, sandbox } from './repo.mjs';

const REF = join(FIXTURES, 'x-wing-ref.png');
const ARGS = ['xw', '--image', REF, '--what', 'an X-wing starfighter', '--faces', '4000', '--seed', '1'];
const seeds = (box) => box.fakes('engine').map((c) => c.argv[c.argv.indexOf('--seed') + 1]);
const result = (box) => JSON.parse(readFileSync(join(box.cache, 'xw', 'result.json'), 'utf8'));

describe('the judge’s loop (subprocesses, up to 10 s)', () => {
  it('makes a miss again with the next seed and ships the second when it passes', async () => {
    const box = sandbox({ judge: 'judge-reseed.json' });
    const r = await box.make(ARGS);
    expect(r.status, r.err).toBe(0);
    expect(seeds(box)).toEqual(['1', '2']);
    expect(box.judged()).toHaveLength(2);
    expect(result(box)).toMatchObject({ seed: 2, verdict: { score: 9, ok: true } });
    expect(readFileSync(join(box.cache, 'xw', 'make.log'), 'utf8')).toMatch(/not good enough: once more with seed 2/);
  });

  it('tries once more only, then ships with the verdict for the pull request to show', async () => {
    const box = sandbox({ judge: 'judge-never.json' });
    expect((await box.make(ARGS)).status).toBe(0);
    expect(seeds(box)).toEqual(['1', '2']);
    expect(box.judged()).toHaveLength(2);
    expect(result(box)).toMatchObject({ seed: 2, verdict: { score: 4, ok: false, problems: ['the wings are fused'], fix: 'a side view' } });
  });

  it('asks the judge nothing with --no-judge', async () => {
    const box = sandbox({ judge: 'judge-never.json' });
    expect((await box.make([...ARGS, '--no-judge'])).status).toBe(0);
    expect(box.judged()).toEqual([]);
    expect(seeds(box)).toEqual(['1']);
    expect(result(box).verdict).toBeUndefined();
  });
});
