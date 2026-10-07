import { describe, expect, it, vi } from 'vitest';
import { STEPS } from '../lib/three/pace';
import { createQuality } from './quality';

// a stand-in pace: `levels` is what each frame() call returns, in turn
const fakePace = (levels, last = STEPS.length - 1) => {
  let i = 0;
  const pace = { level: 0, scale: 1, reset: vi.fn() };
  pace.frame = () => {
    const l = levels[Math.min(i++, levels.length - 1)];
    if (l === null) return null;
    pace.level = l;
    pace.scale = STEPS[Math.min(l, last)];
    return pace.scale;
  };
  return pace;
};

describe('createQuality', () => {
  it('starts at the tier budget, sharpest', () => {
    const q = createQuality({ tier: 'mid', pace: fakePace([null]) });
    expect(q.tier).toBe('mid');
    expect(q.budget.ratio).toBe(1.5);
    expect(q.level).toBe(0);
    expect(q.scale).toBe(1);
    expect(q.ratio).toBe(1.5);
  });

  // This pinned 1 at a 1× screen on the high tier. But every world on the
  // runtime really drew at 1.25 there: the WebGL backend's resize went
  // through lib/three/renderer's own ratio, which keeps the budget's least
  // (lib/device's minRatio). Now the runtime alone sets the ratio, so it
  // keeps that least itself, or every world would draw softer than it
  // always has on a 1× screen.
  it("draws the screen's own pixels, and at least the budget's least, never past its most nor a module's cap", () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 1 });
    expect(q.ratio).toBe(1.25);
    expect(q.ratioUnder(1.5)).toBe(1.25);
    expect(q.ratioUnder(1.1)).toBe(1.1); // (a module's cap is under it all)
    const mid = createQuality({ tier: 'mid', pace: fakePace([null]), dpr: 1 });
    expect(mid.ratio).toBe(1); // (no least on the mid tier: a 1× screen draws at 1)
    // a strong card (lib/device's ultra row) draws one and a half pixels for each of a 1× screen's
    const ultra = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 1, minRatio: 1.5 });
    expect(ultra.ratioUnder(1.5)).toBe(1.5);
    expect(ultra.ratio).toBe(1.5);
    const sharp = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 3 });
    expect(sharp.ratio).toBe(2);
    expect(sharp.ratioUnder(1.5)).toBe(1.5);
    expect(sharp.ratioUnder(undefined)).toBe(2);
    // and the pace's scale comes off whatever that is
    const softer = createQuality({ tier: 'high', pace: fakePace([2]), dpr: 2 });
    softer.frame(0);
    expect(softer.ratioUnder(1.5)).toBeCloseTo(1.5 * STEPS[2]);
  });

  it('follows the pace down and tells listeners once per change', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null, 1, null, 1, 0]) });
    const seen = [];
    q.on((l) => seen.push(l));
    expect(q.frame(0)).toBe(null);
    expect(q.frame(16)).toBe(1);
    expect(q.ratio).toBeCloseTo(2 * STEPS[1]);
    expect(q.frame(32)).toBe(null);
    expect(q.frame(48)).toBe(null); // the same level again: no change
    expect(q.frame(64)).toBe(0);
    expect(seen).toEqual([1, 0]);
    expect(q.ratio).toBe(2);
  });

  it('floors once when the last step still misses', () => {
    const last = STEPS.length - 1;
    const q = createQuality({ tier: 'low', pace: fakePace([last, ...Array(400).fill(null)]), floorAfter: 2500 });
    const seen = [];
    q.on((l) => seen.push(l));
    expect(q.frame(0)).toBe(last);
    let now = 0;
    let floored = null;
    for (let i = 1; i < 300 && floored === null; i++) {
      now += 16;
      const r = q.frame(now);
      if (r !== null) floored = { r, now };
    }
    expect(floored.r).toBe(STEPS.length);
    expect(floored.now).toBeGreaterThanOrEqual(2500);
    expect(q.level).toBe(STEPS.length);
    expect(q.scale).toBe(STEPS[last]); // the picture is no softer than the last step
    for (let i = 0; i < 200; i++) expect(q.frame((now += 16))).toBe(null); // once
    expect(seen).toEqual([last, STEPS.length]);
    q.reset();
    expect(q.level).toBe(0);
  });

  it('a listener can leave', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([1, 2]) });
    const fn = vi.fn();
    const off = q.on(fn);
    q.frame(0);
    off();
    q.frame(16);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
