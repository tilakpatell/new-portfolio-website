import { describe, expect, it } from 'vitest';
import { DROPS, dropped, nextFit } from './navFit';

describe('the nav fitting its bar', () => {
  it('keeps everything while it fits', () => {
    for (const item of DROPS) expect(dropped(0, item), item).toBe(false);
  });

  it('lets go of the shortcut hint first, and of the links only once all else but the view’s name is gone', () => {
    expect(DROPS[0]).toBe('kbd');
    expect(DROPS.at(-2)).toBe('links');
    expect(DROPS.at(-1)).toBe('viewActive');
    expect(dropped(1, 'kbd')).toBe(true);
    expect(dropped(1, 'social')).toBe(false);
    expect(dropped(DROPS.length - 2, 'links')).toBe(false);
    expect(dropped(DROPS.length - 1, 'links')).toBe(true);
  });

  it('never lets go of the Résumé button, nor the view switch', () => {
    for (const item of ['resume', 'view']) {
      expect(DROPS).not.toContain(item);
      for (let fit = 0; fit <= DROPS.length; fit++) expect(dropped(fit, item)).toBe(false);
    }
  });

  it('keeps the words on the view switch over the colour’s name and the social links, and the one you’re in longest', () => {
    const at = (item) => DROPS.indexOf(item);
    expect(at('viewLabel')).toBeGreaterThan(at('social'));
    expect(at('viewLabel')).toBeGreaterThan(at('colorName'));
    expect(at('viewActive')).toBeGreaterThan(at('viewLabel'));
    expect(at('viewActive')).toBeGreaterThan(at('links'));
  });

  it('steps on only while the bar overflows, and stops once everything is gone', () => {
    expect(nextFit(0, false)).toBe(0);
    expect(nextFit(0, true)).toBe(1);
    expect(nextFit(3, true)).toBe(4);
    expect(nextFit(DROPS.length, true)).toBe(DROPS.length);
  });
});
