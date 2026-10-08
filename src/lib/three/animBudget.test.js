import { describe, expect, it } from 'vitest';
import { budgetClock, createAnimBudget } from './animBudget';

const cam = { position: { x: 0, y: 1.6, z: 0 } };
const at = (x) => ({ x, y: 0, z: 0 });

describe('createAnimBudget', () => {
  it('the budget runs near figures every frame, far ones every fourth, unseen ones not at all', () => {
    const b = createAnimBudget({ near: 12, far: 40 });
    expect(b.rate(at(5), cam, true)).toBe(1);
    expect(b.rate(at(25), cam, true)).toBe(0.5);
    expect(b.rate(at(90), cam, true)).toBe(0.25);
    expect(b.rate(at(5), cam, false)).toBe(0);
    expect(b.rate(at(90), cam, false)).toBe(0);
    // and through each figure's clock, over 8 frames
    const near = budgetClock(0);
    const far = budgetClock(0);
    const unseen = budgetClock(0);
    const dt = 1 / 60;
    const steps = { near: [], far: [], unseen: [] };
    for (let i = 0; i < 8; i++) {
      b.frame();
      const n = near(b.rate(at(5), cam, true), dt);
      const f = far(b.rate(at(90), cam, true), dt);
      const u = unseen(b.rate(at(5), cam, false), dt);
      if (n) steps.near.push(n);
      if (f) steps.far.push(f);
      if (u) steps.unseen.push(u);
    }
    expect(steps.near).toHaveLength(8);
    expect(steps.far).toHaveLength(2);
    // a far one steps by the time it skipped, so it keeps time with a near one
    for (const s of steps.far) expect(s).toBeCloseTo(4 * dt, 12);
    expect(steps.unseen).toHaveLength(0);
  });

  it('never more than max at rate 1 in a frame', () => {
    const b = createAnimBudget({ max: 10 });
    for (let frame = 0; frame < 3; frame++) {
      b.frame();
      const rates = Array.from({ length: 25 }, (_, i) => b.rate(at(1 + i * 0.2), cam, true));
      expect(rates.filter((r) => r === 1)).toHaveLength(10);
      // the rest drop a step, not out of the picture
      expect(rates.filter((r) => r === 0.5)).toHaveLength(15);
    }
  });

  it('defaults: in view unless told otherwise, and near with no camera', () => {
    const b = createAnimBudget();
    expect(b.rate(at(11), cam)).toBe(1);
    expect(b.rate(at(13), cam)).toBe(0.5);
    expect(b.rate(at(41), cam)).toBe(0.25);
    expect(b.rate(at(500), null, true)).toBe(1);
    expect(b.rate(at(500), null, false)).toBe(0);
  });
});

describe('budgetClock', () => {
  it('spreads figures at one rate over the frames', () => {
    const clocks = Array.from({ length: 8 }, (_, i) => budgetClock(i));
    for (let f = 0; f < 12; f++) {
      const due = clocks.filter((c) => c(0.25, 1 / 60) > 0).length;
      expect(due).toBeLessThanOrEqual(4);
    }
  });

  it('a paused figure lets its missed time go, so it never jumps on coming back', () => {
    const c = budgetClock(3);
    for (let i = 0; i < 30; i++) expect(c(0, 1 / 60)).toBe(0);
    expect(c(1, 1 / 60)).toBeCloseTo(1 / 60, 12);
  });

  it('a 1 s frame is clamped, and a 0 s or NaN one adds nothing', () => {
    const c = budgetClock(0);
    expect(c(1, 1)).toBeCloseTo(0.1, 12);
    expect(c(1, 0)).toBe(0);
    expect(c(1, NaN)).toBe(0);
    expect(c(NaN, 1 / 60)).toBe(0);
  });
});
