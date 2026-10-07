import { describe, expect, it } from 'vitest';
import { boltPath, strikeAt } from './storm';

const sample = (seed, every, from = 0, to = 300, dt = 0.02) => {
  const out = [];
  for (let t = from; t < to; t += dt) out.push(strikeAt(t, { seed, every }));
  return out;
};

describe('a discharge tower’s strikes', () => {
  it('come now and then, about as often as asked', () => {
    const s = sample(3, 12);
    let strikes = 0;
    for (let i = 1; i < s.length; i++) if (s[i] > 0 && s[i - 1] === 0) strikes++;
    expect(strikes).toBeGreaterThan(300 / 12 / 2);
    expect(strikes).toBeLessThan((300 / 12) * 2);
  });

  it('are short: lit well under a tenth of the time, never brighter than one', () => {
    const s = sample(3, 12);
    expect(s.filter((v) => v > 0).length / s.length).toBeLessThan(0.1);
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(0);
  });

  it('flicker while they last', () => {
    const s = sample(3, 12);
    let dips = 0;
    for (let i = 2; i < s.length; i++) if (s[i - 2] > 0 && s[i - 1] > 0 && s[i] > 0 && s[i - 1] < s[i - 2] && s[i - 1] < s[i]) dips++;
    expect(dips).toBeGreaterThan(0);
  });

  it('fall on each tower at its own times', () => {
    const a = sample(1, 12);
    const b = sample(2, 12);
    expect(a.some((v, i) => (v > 0) !== (b[i] > 0))).toBe(true);
  });
});

describe('a bolt', () => {
  it('runs from the sky down to the tip, jagged, never far off the line', () => {
    const p = boltPath([0, 100, 0], [0, 10, 0], 7, 12);
    expect(p).toHaveLength(13);
    expect(p[0]).toEqual([0, 100, 0]);
    expect(p[12]).toEqual([0, 10, 0]);
    for (let i = 1; i < 12; i++) expect(p[i][1]).toBeLessThan(p[i - 1][1]);
    expect(p.some(([x]) => Math.abs(x) > 0.5)).toBe(true);
    for (const [x, , z] of p) expect(Math.hypot(x, z)).toBeLessThan(12);
  });
});
