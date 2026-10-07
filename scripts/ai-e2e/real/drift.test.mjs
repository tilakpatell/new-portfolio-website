// Drift: a night's real run against the last one a person blessed.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bless } from './bless.mjs';
import { drift, numbers } from './drift.mjs';

const night = (over = {}) => ({
  tier: 'real',
  gen3d: { ok: true, verdict: 8, tris: { hq: 8000, mid: 4000, lo: 1330 }, bytes: { hq: 900000, mid: 500000, lo: 200000 }, seconds: 300, ...over.gen3d },
  voices: { ok: true, made: 1, doubtful: 0, wer: 0.02, similarity: 0.71, seconds: 120, ...over.voices },
});

describe('a night’s numbers', () => {
  it('are flat, named by where they come from', () => {
    expect(numbers(night())).toMatchObject({ 'gen3d.verdict': 8, 'gen3d.tris.hq': 8000, 'gen3d.bytes.lo': 200000, 'gen3d.seconds': 300, 'voices.wer': 0.02, 'voices.similarity': 0.71 });
  });
});

describe('drift from the golden', () => {
  it('is nothing within 10%, and says what moved and by how much past it', () => {
    expect(drift(night({ gen3d: { tris: { hq: 8500, mid: 4000, lo: 1330 } } }), night())).toEqual([]);
    expect(drift(night({ gen3d: { tris: { hq: 9600, mid: 4000, lo: 1330 } } }), night())).toEqual([{ key: 'gen3d.tris.hq', was: 8000, now: 9600, change: '+20%' }]);
    expect(drift(night({ gen3d: { verdict: 6 } }), night())).toEqual([{ key: 'gen3d.verdict', was: 8, now: 6, change: '-25%' }]);
  });
  it('gives the timings room: the GPU is shared, and a cold start is slower', () => {
    expect(drift(night({ gen3d: { seconds: 420 } }), night())).toEqual([]);
    expect(drift(night({ gen3d: { seconds: 600 } }), night())).toEqual([{ key: 'gen3d.seconds', was: 300, now: 600, change: '+100%' }]);
  });
  it('measures a small number, a word error rate, against a floor, not against itself', () => {
    expect(drift(night({ voices: { wer: 0.05 } }), night())).toEqual([]);
    expect(drift(night({ voices: { wer: 0.2 } }), night())).toMatchObject([{ key: 'voices.wer' }]);
  });
  it('says so when a number the golden has is missing tonight', () => {
    const n = night();
    delete n.gen3d.verdict;
    expect(drift(n, night())).toEqual([{ key: 'gen3d.verdict', was: 8, now: null, change: 'missing' }]);
  });
});

describe('blessing a night', () => {
  it('writes its numbers as the new golden, with where they came from', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-bless-'));
    const from = join(dir, '2026-10-07-real.json');
    writeFileSync(from, JSON.stringify(night()));
    const to = join(dir, 'golden.json');
    bless(from, to);
    const g = JSON.parse(readFileSync(to, 'utf8'));
    expect(g.from).toBe('2026-10-07-real.json');
    expect(g.numbers).toEqual(numbers(night()));
    expect(drift(night(), g)).toEqual([]);
  });
  it('refuses a night that failed: a golden is a good night', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-bless-'));
    const from = join(dir, 'x.json');
    writeFileSync(from, JSON.stringify(night({ voices: { ok: false } })));
    expect(() => bless(from, join(dir, 'g.json'))).toThrow(/voices failed that night/);
  });
});
