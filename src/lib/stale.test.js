import { describe, expect, it } from 'vitest';
import { RETRY_AFTER, STALE_KEY, cleanHref, freshHref, isStale, mayReload } from './stale';

// a stand-in for sessionStorage, over a Map
const storage = (entries = {}) => {
  const m = new Map(Object.entries(entries));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    get: (k) => m.get(k),
  };
};

describe('a file from the build before the last deploy', () => {
  it('is recognised however the browser or Vite words it', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://tilakpatell.com/assets/Front-BeKYKVyy.js', // Chrome, Edge
      'error loading dynamically imported module: https://tilakpatell.com/assets/Front-BeKYKVyy.js', // Firefox
      'Importing a module script failed.', // Safari
      'Unable to preload CSS for https://tilakpatell.com/assets/Front-CrTcrRm4.css', // Vite, a stylesheet that's gone
      'Loading chunk 3 failed.',
      'Failed to fetch',
    ])
      expect(isStale(new Error(message)), message).toBe(true);
  });

  it('is told apart from a bug in the page', () => {
    expect(isStale(new TypeError("Cannot read properties of undefined (reading 'palette')"))).toBe(false);
    expect(isStale(null)).toBe(false);
    expect(isStale({})).toBe(false);
  });
});

describe('reloading for the new build', () => {
  it('reloads, and notes when', () => {
    const s = storage();
    expect(mayReload(s, 1000)).toBe(true);
    expect(s.get(STALE_KEY)).toBe('1000');
  });

  it("doesn't reload again straight after a reload that didn't help (so an outage can't loop)", () => {
    const s = storage({ [STALE_KEY]: '1000' });
    expect(mayReload(s, 1000 + RETRY_AFTER - 1)).toBe(false);
  });

  it('reloads for a later deploy in the same tab', () => {
    const s = storage({ [STALE_KEY]: '1000' });
    expect(mayReload(s, 1000 + RETRY_AFTER + 1)).toBe(true);
    // (and a tab that still has the old once-a-session mark reloads too)
    expect(mayReload(storage({ [STALE_KEY]: '1' }), 1000 + RETRY_AFTER + 1)).toBe(true);
  });

  it("doesn't reload when it can't keep count", () => {
    expect(mayReload(null, 1000)).toBe(false);
    const broken = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    expect(mayReload(broken, 1000)).toBe(false);
  });
});

describe('the address for a fresh copy', () => {
  it('asks past any cached index.html, keeping the page it was on', () => {
    expect(freshHref('https://tilakpatell.com/#/universe/marvel', 1700000000000)).toBe('https://tilakpatell.com/?fresh=loyw3v28#/universe/marvel');
    expect(freshHref('https://tilakpatell.com/', 1700000000000)).toBe('https://tilakpatell.com/?fresh=loyw3v28');
  });

  it('keeps what else is in the query', () => {
    expect(freshHref('https://tilakpatell.com/?quality=low#/', 1700000000000)).toBe('https://tilakpatell.com/?quality=low&fresh=loyw3v28#/');
  });

  it('is tidied away once the page has loaded', () => {
    expect(cleanHref('https://tilakpatell.com/?fresh=loyw3v28#/universe/marvel')).toBe('/#/universe/marvel');
    expect(cleanHref('https://tilakpatell.com/?quality=low&fresh=loyw3v28#/')).toBe('/?quality=low#/');
  });

  it('leaves an address without it alone', () => {
    expect(cleanHref('https://tilakpatell.com/?quality=low#/')).toBe(null);
    expect(cleanHref('https://tilakpatell.com/#/')).toBe(null);
  });
});
