import { describe, expect, it } from 'vitest';
import { createAttention } from './attention';

// steps of 0.1 s until `done`, or `max` steps; how many it took
const stepsUntil = (a, opts, done, max = 50) => {
  for (let n = 1; n <= max; n++) {
    a.step(0.1, opts);
    if (done(a.values)) return n;
  }
  return Infinity;
};

describe('each place’s attention', () => {
  it('starts at rest', () => {
    expect(createAttention(['shire', 'bree']).values).toEqual({ shire: 0, bree: 0 });
  });
  it('rises to 1 for a hovered place within 0.4 s, and not before 0.3 s', () => {
    const a = createAttention(['shire', 'bree']);
    const n = stepsUntil(a, { hover: 'shire' }, (v) => v.shire >= 1);
    expect(n).toBeGreaterThan(3);
    expect(n).toBeLessThanOrEqual(4);
    expect(a.values.shire).toBe(1);
    expect(a.values.bree).toBe(0);
  });
  it('rises the same for the place being flown to', () => {
    const a = createAttention(['shire', 'bree']);
    expect(stepsUntil(a, { flying: 'bree' }, (v) => v.bree >= 1)).toBe(4);
  });
  it('falls back to 0 within 0.8 s once released', () => {
    const a = createAttention(['shire']);
    stepsUntil(a, { hover: 'shire' }, (v) => v.shire >= 1);
    const n = stepsUntil(a, {}, (v) => v.shire <= 0);
    expect(n).toBeGreaterThan(7);
    expect(n).toBeLessThanOrEqual(8);
    expect(a.values.shire).toBe(0);
  });
  it('tops at 0.6 for a place nearby, and hover outranks it', () => {
    const a = createAttention(['shire']);
    for (let i = 0; i < 20; i++) a.step(0.1, { near: 'shire' });
    expect(a.values.shire).toBeCloseTo(0.6, 9);
    for (let i = 0; i < 20; i++) a.step(0.1, { near: 'shire', hover: 'shire' });
    expect(a.values.shire).toBe(1);
    for (let i = 0; i < 20; i++) a.step(0.1, { near: 'shire' });
    expect(a.values.shire).toBeCloseTo(0.6, 9);
  });
  it('jumps straight to its target when motion is reduced', () => {
    const a = createAttention(['shire', 'bree']);
    a.step(0.01, { hover: 'shire', near: 'bree', instant: true });
    expect(a.values).toEqual({ shire: 1, bree: 0.6 });
    a.step(0.01, { instant: true });
    expect(a.values).toEqual({ shire: 0, bree: 0 });
  });
  it('ignores a place it wasn’t given', () => {
    const a = createAttention(['shire']);
    const v = a.step(0.1, { hover: 'orthanc', near: 'nowhere', flying: 'moria' });
    expect(v).toEqual({ shire: 0 });
  });
});
