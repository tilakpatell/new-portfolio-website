import { describe, expect, it } from 'vitest';
import { AXES, DEEDS, FADE, LEVELS, RANGE, createStanding, levelOf } from './standing';
import { SIDES } from './sides';

// a storage in memory, the shape of lib/hooks' `local`
const memory = (init = {}) => {
  const m = { ...init };
  return { m, get: (k, f = null) => (k in m ? JSON.parse(JSON.stringify(m[k])) : f), set: (k, v) => (m[k] = JSON.parse(JSON.stringify(v))) };
};
const fresh = (storage = null) => {
  const s = createStanding({ storage });
  s.side('starwars');
  return s;
};

describe('your standing', () => {
  it('starts at nought on every measure, with no level, and counts nothing without a side', () => {
    const s = createStanding();
    expect(s.note('killCivil')).toEqual([]);
    expect(s.value('law')).toBe(0);
    s.side('starwars');
    for (const a of AXES) {
      expect(s.value(a)).toBe(0);
      expect(s.level(a)).toBeNull();
    }
    expect(s.wanted).toBe(false);
    expect(s.feared).toBe(false);
    expect(s.friend).toBe(false);
  });

  it('knows every deed, each moving at least one measure, and stays within range', () => {
    for (const [what, deed] of Object.entries(DEEDS)) {
      expect(Object.keys(deed).length, what).toBeGreaterThan(0);
      for (const a of Object.keys(deed)) expect(AXES, `${what} ${a}`).toContain(a);
    }
    const s = fresh();
    s.note('capitalKill', 10);
    expect(s.value('law')).toBe(-RANGE);
    expect(s.value('outlaw')).toBe(RANGE);
    expect(s.note('nonsense')).toEqual([]);
  });

  it('falls out with the law step by step: suspect, then wanted, and says so once each', () => {
    const s = fresh();
    const got = [];
    for (let i = 0; i < 12; i++) got.push(...s.note('killHunter'));
    expect(got.filter((e) => e.axis === 'law').map((e) => e.level)).toEqual(['suspect', 'wanted']);
    expect(got[0]).toMatchObject({ type: 'standing', axis: 'law', level: 'suspect', was: null });
    expect(got[1]).toMatchObject({ axis: 'law', level: 'wanted', was: 'suspect' });
    expect(s.wanted).toBe(true);
    expect(s.suspect).toBe(true);
    // and the pirates like you a little for it
    expect(s.value('outlaw')).toBeGreaterThan(0);
  });

  it('is feared by the ordinary ships for shooting them, a hero for saving them, a friend to pirates for paying up', () => {
    const feared = fresh();
    feared.note('killCivil', 2);
    expect(feared.feared).toBe(true);
    expect(feared.level('law')).toBe('suspect'); // (the law minds too)
    const hero = fresh();
    hero.note('rescued', 2);
    expect(hero.hero).toBe(true);
    const friend = fresh();
    friend.note('paidToll', 5);
    expect(friend.friend).toBe(true);
    friend.note('killPirate', 3);
    expect(friend.friend).toBe(false);
  });

  it('fades back toward nought with time, and the levels fall away with it', () => {
    const s = fresh();
    s.note('rescued', 2);
    expect(s.hero).toBe(true);
    const got = [];
    for (let t = 0; t < FADE * 0.5; t += 1) got.push(...s.tick(1));
    expect(s.value('civil')).toBeCloseTo(3 - 0.5, 1);
    expect(got.map((e) => e.level)).toEqual([null]); // (hero no more)
    for (let t = 0; t < FADE * 4; t += 1) s.tick(1);
    for (const a of AXES) expect(s.value(a)).toBe(0);
  });

  it('is kept in storage by side, fades while the page was closed, and reads nothing it does not understand', () => {
    const store = memory();
    const s = createStanding({ storage: store });
    s.side('rickmorty');
    s.note('busted', 4);
    expect(s.wanted).toBe(true);
    s.side('starwars');
    expect(s.wanted).toBe(false); // (the Empire hasn't heard)
    s.side('rickmorty');
    expect(s.wanted).toBe(true);
    // another visit: still wanted
    const again = createStanding({ storage: store });
    again.side('rickmorty');
    expect(again.wanted).toBe(true);
    // a visit long after: faded
    store.m['tp:universe-standing'].rickmorty.at = Date.now() - FADE * 10 * 1000;
    const later = createStanding({ storage: store });
    later.side('rickmorty');
    expect(later.value('law')).toBe(0);
    // nonsense in storage
    const junk = createStanding({ storage: memory({ 'tp:universe-standing': { starwars: { law: 'lots', civil: Infinity, outlaw: -99 } } }) });
    junk.side('starwars');
    expect(junk.value('law')).toBe(0);
    expect(junk.value('civil')).toBe(0);
    expect(junk.value('outlaw')).toBe(-RANGE);
    const broken = createStanding({ storage: memory({ 'tp:universe-standing': 'nope' }) });
    broken.side('starwars');
    expect(broken.state()).toMatchObject({ side: 'starwars', law: 0 });
  });

  it('names the levels in order, and every side has a law faction to fall out with', () => {
    expect(levelOf('law', -5)).toBe('wanted');
    expect(levelOf('law', -2)).toBe('suspect');
    expect(levelOf('law', -1.9)).toBeNull();
    expect(levelOf('law', 3)).toBe('trusted');
    expect(levelOf('civil', -3)).toBe('feared');
    expect(levelOf('outlaw', 6)).toBe('friend');
    for (const [axis, list] of Object.entries(LEVELS)) for (const [at] of list) expect(Math.abs(at), axis).toBeLessThanOrEqual(RANGE);
    for (const side of Object.values(SIDES)) expect(side.factions[side.law]?.role, side.id).toBe('hunt');
  });
});
