import { describe, expect, it } from 'vitest';
import { DROPS, dropped, nextFit } from './navFit';

describe('the nav fitting its bar', () => {
  it('keeps everything while it fits', () => {
    for (const item of DROPS) expect(dropped(0, item), item).toBe(false);
  });

  it('lets go of the shortcut hint first and the links last', () => {
    expect(DROPS[0]).toBe('kbd');
    expect(DROPS.at(-1)).toBe('links');
    expect(dropped(1, 'kbd')).toBe(true);
    expect(dropped(1, 'social')).toBe(false);
    expect(dropped(DROPS.length - 1, 'links')).toBe(false);
    expect(dropped(DROPS.length, 'links')).toBe(true);
  });

  it('never lets go of the Résumé button', () => {
    expect(DROPS).not.toContain('resume');
    for (let fit = 0; fit <= DROPS.length; fit++) expect(dropped(fit, 'resume')).toBe(false);
  });

  it('steps on only while the bar overflows, and stops once everything is gone', () => {
    expect(nextFit(0, false)).toBe(0);
    expect(nextFit(0, true)).toBe(1);
    expect(nextFit(3, true)).toBe(4);
    expect(nextFit(DROPS.length, true)).toBe(DROPS.length);
  });
});
