// The vision judge's evaluation, run against the fake judge over three
// labelled sheets and a pick set: the numbers it reports, and the lines it
// holds each backend to.
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LINES, evaluate, passes } from './vision.mjs';

const FIX = join(import.meta.dirname, 'fixtures');
let saved;
beforeEach(() => {
  saved = { ...process.env };
  const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-vision-'));
  copyFileSync(join(FIX, 'judge.json'), join(dir, 'judge.json'));
  process.env.GEN3D_JUDGE = 'fake';
  process.env.GEN3D_JUDGE_SCRIPT = join(dir, 'judge.json');
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('the vision judge’s evaluation', () => {
  it('scores each sheet against its band: in band, the error to the band’s middle, and good and bad told apart', async () => {
    const r = await evaluate({ sheets: join(FIX, 'sheets'), picks: join(FIX, 'pick-sets') });
    expect(r.backend).toBe('fake');
    expect(r.judge.n).toBe(3);
    expect(r.judge.accuracy).toBeCloseTo(2 / 3, 9);
    // |9 − 8.5| + |3 − 2.5| + |8 − 2| over three
    expect(r.judge.mae).toBeCloseTo((0.5 + 0.5 + 6) / 3, 9);
    expect(r.judge.confusion).toEqual({ good: { good: 1, bad: 0 }, bad: { good: 1, bad: 1 } });
    expect(r.judge.rows.find((x) => x.sheet === 'missed.png')).toMatchObject({ score: 8, inBand: false });
  });

  it('asks pick() which of four is the thing, and counts it right when the judge’s best is the labelled one', async () => {
    const r = await evaluate({ sheets: join(FIX, 'sheets'), picks: join(FIX, 'pick-sets') });
    expect(r.pick).toMatchObject({ n: 1, right: 1, accuracy: 1 });
    expect(r.pick.rows[0]).toMatchObject({ set: 'thing', chose: 'c.png', right: 'c.png' });
  });

  it('holds each backend to its line, and says which number fell short', async () => {
    expect(LINES).toMatchObject({ claude: { judge: 0.85, pick: 0.8 }, qwen: { judge: 0.7, pick: 0.8 } });
    expect(passes({ backend: 'claude', judge: { accuracy: 0.9 }, pick: { accuracy: 0.8 } })).toEqual([]);
    expect(passes({ backend: 'claude', judge: { accuracy: 0.8 }, pick: { accuracy: 0.6 } })).toEqual(['judge 80% in band, under 85%', 'pick 60% right, under 80%']);
    expect(passes({ backend: 'qwen', judge: { accuracy: 0.75 }, pick: { accuracy: 1 } })).toEqual([]);
  });

  it('writes nothing it was not asked to: the fake judge’s calls stay in its own folder', async () => {
    await evaluate({ sheets: join(FIX, 'sheets'), picks: join(FIX, 'pick-sets') });
    const calls = JSON.parse(readFileSync(join(process.env.GEN3D_JUDGE_SCRIPT, '..', 'calls.json'), 'utf8'));
    expect(calls).toHaveLength(3 + 4);
  });
});
