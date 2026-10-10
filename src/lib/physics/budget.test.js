import { describe, expect, it } from 'vitest';
import { createBudget } from './budget';

describe('createBudget', () => {
  it('grants up to the cap then refuses', () => {
    const b = createBudget({ rays: 24 });
    for (let i = 0; i < 24; i++) expect(b.take('rays')).toBe(true);
    expect(b.take('rays')).toBe(false);
  });

  it('frame() resets the spend', () => {
    const b = createBudget({ rays: 1 });
    expect(b.take('rays')).toBe(true);
    expect(b.take('rays')).toBe(false);
    b.frame();
    expect(b.take('rays')).toBe(true);
  });

  it('stats() counts used and refused', () => {
    const b = createBudget({ rays: 24, sweeps: 8, overlaps: 4 });
    for (let i = 0; i < 25; i++) b.take('rays');
    expect(b.stats().rays).toEqual({ used: 24, refused: 1, cap: 24 });
    expect(b.stats().sweeps).toEqual({ used: 0, refused: 0, cap: 8 });
    b.frame();
    expect(b.stats().rays).toEqual({ used: 0, refused: 1, cap: 24 });
    b.frame();
    expect(b.stats().rays.refused).toBe(0);
  });

  it('an unknown kind is refused and counted nowhere', () => {
    const b = createBudget();
    expect(b.take('lasers')).toBe(false);
    expect(Object.keys(b.stats())).toEqual(['rays', 'sweeps', 'overlaps']);
  });

  it('has the defaults', () => {
    const s = createBudget().stats();
    expect([s.rays.cap, s.sweeps.cap, s.overlaps.cap]).toEqual([24, 8, 4]);
  });
});
