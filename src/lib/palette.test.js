import { describe, expect, it } from 'vitest';
import { guideDetail, isPaletteKey } from './palette';

describe('the palette’s key', () => {
  it('is ⌘K or Ctrl K, whichever case', () => {
    expect(isPaletteKey({ key: 'k', metaKey: true })).toBe(true);
    expect(isPaletteKey({ key: 'K', ctrlKey: true })).toBe(true);
  });

  it('is not K alone, another letter, or with Alt', () => {
    expect(isPaletteKey({ key: 'k' })).toBe(false);
    expect(isPaletteKey({ key: 'j', metaKey: true })).toBe(false);
    expect(isPaletteKey({ key: 'k', ctrlKey: true, altKey: true })).toBe(false);
    expect(isPaletteKey(null)).toBe(false);
    expect(isPaletteKey({ key: undefined, metaKey: true })).toBe(false);
  });
});

describe('opening the guide on a tab', () => {
  it('reads a tab from a plain object', () => {
    expect(guideDetail({ tab: 'checklist' })).toEqual({ tab: 'checklist' });
  });

  it('reads a click, a word or nothing as no tab', () => {
    for (const x of [undefined, null, 'checklist', new Event('click'), { tab: 3 }]) expect(guideDetail(x), String(x)).toBeNull();
  });
});
