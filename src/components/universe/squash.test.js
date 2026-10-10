import { describe, expect, it } from 'vitest';
import { createSquash } from './squash';

const run = (sq, seconds, dt = 1 / 60) => {
  let low = 1;
  let high = 1;
  let last = [1, 1, 1];
  for (let t = 0; t < seconds; t += dt) {
    last = [...sq.step(dt)];
    low = Math.min(low, last[1]);
    high = Math.max(high, last[1]);
  }
  return { low, high, last };
};

describe('a landing’s squash', () => {
  it('stands as it is until it lands', () => {
    expect(run(createSquash(), 1).last).toEqual([1, 1, 1]);
  });

  it('gives a jump’s landing about 6%, springs past and back, and is still in under a second', () => {
    const sq = createSquash();
    sq.land(4.2);
    const { low, high, last } = run(sq, 1);
    expect(1 - low).toBeGreaterThan(0.04);
    expect(1 - low).toBeLessThan(0.09);
    expect(high).toBeGreaterThan(1); // (past: up a little, then back)
    expect(Math.abs(last[1] - 1)).toBeLessThan(0.005);
  });

  it('squashes a harder landing more, and wider as it goes shorter, its volume about kept', () => {
    const soft = createSquash();
    const hard = createSquash();
    soft.land(2);
    hard.land(6);
    expect(run(hard, 0.5).low).toBeLessThan(run(soft, 0.5).low);
    const sq = createSquash();
    sq.land(6);
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      const [x, y, z] = sq.step(1 / 60);
      expect(x).toBe(z);
      worst = Math.max(worst, Math.abs(x * y * z - 1));
    }
    expect(worst).toBeLessThan(0.02);
  });

  it('is bounded at 30 Hz and agrees with 60 Hz on the squash', () => {
    const a = createSquash();
    const b = createSquash();
    a.land(4.2);
    b.land(4.2);
    const fast = run(a, 1, 1 / 60).low;
    const slow = run(b, 1, 1 / 30).low;
    expect(Math.abs(fast - slow) / (1 - fast)).toBeLessThan(0.2);
  });

  it('takes no landing from nothing', () => {
    const sq = createSquash();
    sq.land(0);
    sq.land(-3);
    sq.land(NaN);
    expect(run(sq, 0.5).last).toEqual([1, 1, 1]);
  });
});
