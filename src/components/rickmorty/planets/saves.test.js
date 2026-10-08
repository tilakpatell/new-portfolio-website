import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOUND_KEY, MISSIONS_KEY, QUESTS_KEY, readBests, readDone, readFound, writeBest, writeDone, writeFound } from './saves';

// a browser's localStorage, as a plain map
const store = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('the planets’ saves', () => {
  let ls;
  beforeEach(() => {
    ls = store();
    vi.stubGlobal('window', { localStorage: ls });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keep to their own three keys', () => {
    expect([FOUND_KEY, QUESTS_KEY, MISSIONS_KEY]).toEqual(['tp-rm-found', 'tp-rm-quests', 'tp-rm-missions']);
    writeFound('gazorpazorp', ['gate']);
    writeDone('gazorpazorp', ['marsha']);
    writeBest('gazorpazorp', { t: 30, stars: 2 });
    expect([...ls.m.keys()].sort()).toEqual(['tp-rm-found', 'tp-rm-missions', 'tp-rm-quests']);
  });

  it('read as nothing at all on a first visit, or when a key is not JSON or not a book', () => {
    expect(readFound()).toEqual({});
    expect(readDone()).toEqual({});
    expect(readBests()).toEqual({});
    ls.setItem(FOUND_KEY, '{not json');
    ls.setItem(QUESTS_KEY, '"a string"');
    ls.setItem(MISSIONS_KEY, '[1, 2]');
    expect(readFound()).toEqual({});
    expect(readDone()).toEqual({});
    expect(readBests()).toEqual({});
  });

  it('read as nothing where there is no storage at all (a private window)', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('denied');
      },
    });
    expect(readFound()).toEqual({});
    expect(() => writeFound('gazorpazorp', ['gate'])).not.toThrow();
  });

  it('keep each planet’s places and quests apart', () => {
    writeFound('gazorpazorp', ['gate']);
    writeFound('squanch', ['arch']);
    writeDone('gazorpazorp', ['marsha', 'pit']);
    expect(readFound()).toEqual({ gazorpazorp: ['gate'], squanch: ['arch'] });
    expect(readDone()).toEqual({ gazorpazorp: ['marsha', 'pit'] });
  });

  it('keep the better of two runs at a mission: faster, or more stars', () => {
    expect(writeBest('gazorpazorp', { t: 40, stars: 1 })).toBe(true);
    expect(writeBest('gazorpazorp', { t: 45, stars: 1 })).toBe(false);
    expect(readBests().gazorpazorp).toEqual({ t: 40, stars: 1 });
    expect(writeBest('gazorpazorp', { t: 32, stars: 2 })).toBe(true);
    expect(readBests().gazorpazorp).toEqual({ t: 32, stars: 2 });
    // (more stars wins though slower: a timed survival's stars aren't its time)
    expect(writeBest('gazorpazorp', { t: 50, stars: 3 })).toBe(true);
    expect(readBests().gazorpazorp).toEqual({ t: 50, stars: 3 });
    expect(writeBest('gazorpazorp', { t: 20, stars: 2 })).toBe(false);
    expect(readBests().gazorpazorp).toEqual({ t: 50, stars: 3 });
  });
});
