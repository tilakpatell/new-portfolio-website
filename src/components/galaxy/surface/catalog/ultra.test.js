import { describe, expect, it } from 'vitest';
import { ULTRA, farCopies, ultraCut, usesUltra } from './ultra';

describe('the ultra cut of a surface model', () => {
  it('is loaded at ultra only, and only where the entry has one', () => {
    const entry = { tris: 20000, ultra: { tris: 80000, tex: 8192 } };
    expect(usesUltra(entry, 'ultra')).toBe(true);
    for (const level of ['low', 'mid', 'high']) expect(usesUltra(entry, level), level).toBe(false);
    expect(usesUltra({ tris: 20000 }, 'ultra')).toBe(false);
    expect(usesUltra(undefined, 'ultra')).toBe(false);
  });

  it('keeps the far copies at every level but ultra', () => {
    expect(farCopies('ultra')).toBe(false);
    for (const level of ['low', 'mid', 'high']) expect(farCopies(level), level).toBe(true);
  });

  it('asks for four times the high cut and 8192 maps unless the entry says', () => {
    expect(ultraCut({ tris: 20000 })).toEqual({ tris: 80000, tex: 8192 });
    expect(ultraCut({ tris: 20000, ultra: { tris: 50000, tex: 4096 } })).toEqual({ tris: 50000, tex: 4096 });
    expect(ULTRA).toEqual({ factor: 4, tex: 8192, bytes: 24 * 1024 * 1024 });
  });
});
