import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { ALLIES_KEY, ALLIES_MAX, BLOCKED_KEY, BLOCKED_MAX, createAllies } from './allies';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m };
};
const broken = () => ({
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
  removeItem() {
    throw new Error('denied');
  },
});
const pilot = (n) => n.toString(16).padStart(64, '0'); // (a pilot's id is their key: 64 hex digits)
const clock = (t = 1000) => {
  const c = { t, now: () => c.t };
  return c;
};

describe('createAllies', () => {
  it('keeps allies and blocks, and reads them back next visit', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const c = clock();
    const a = createAllies({ saves, now: c.now });
    a.saveAlly(pilot(1), 'Han');
    c.t = 2000;
    a.seenAlly(pilot(1), 'Han Solo');
    a.block(pilot(2), 'Jabba');
    expect(a.isAlly(pilot(1))).toBe(true);
    expect(a.isBlocked(pilot(2))).toBe(true);
    expect(a.isAlly(pilot(2))).toBe(false);
    // kept as version 1 of each key
    expect(JSON.parse(local.raw.get(ALLIES_KEY))).toEqual({ v: 1, data: { [pilot(1)]: { name: 'Han Solo', since: 1000, seen: 2000 } } });
    expect(JSON.parse(local.raw.get(BLOCKED_KEY))).toEqual({ v: 1, data: { [pilot(2)]: { name: 'Jabba', at: 2000 } } });
    // the next visit
    const next = createAllies({ saves: createSaves({ local, session: memory() }), now: c.now });
    expect(next.allies()).toEqual([{ id: pilot(1), name: 'Han Solo', since: 1000, seen: 2000 }]);
    expect(next.isBlocked(pilot(2))).toBe(true);
  });

  it('lists the newest seen first, and knows only those it saved', () => {
    const c = clock();
    const a = createAllies({ saves: null, now: c.now });
    for (const n of [1, 2, 3]) {
      c.t = 1000 * n;
      a.saveAlly(pilot(n), `Pilot ${n}`);
    }
    c.t = 9000;
    a.seenAlly(pilot(1), 'Pilot 1');
    a.seenAlly(pilot(7), 'Stranger'); // (never saved: nothing to see)
    expect(a.allies().map((x) => x.id)).toEqual([pilot(1), pilot(3), pilot(2)]);
    expect(a.isAlly(pilot(7))).toBe(false);
    // saved again: the same alliance, seen now, since when it was made
    a.saveAlly(pilot(2), 'Pilot 2');
    expect(a.allies().find((x) => x.id === pilot(2))).toEqual({ id: pilot(2), name: 'Pilot 2', since: 2000, seen: 9000 });
  });

  it('forgets an ally, and a block ends an alliance', () => {
    const a = createAllies({ saves: null });
    a.saveAlly(pilot(1), 'Han');
    a.saveAlly(pilot(2), 'Leia');
    a.dropAlly(pilot(1));
    expect(a.isAlly(pilot(1))).toBe(false);
    a.block(pilot(2), 'Leia');
    expect(a.isAlly(pilot(2))).toBe(false);
    expect(a.isBlocked(pilot(2))).toBe(true);
    a.unblock(pilot(2));
    expect(a.isBlocked(pilot(2))).toBe(false);
    expect(a.allies()).toEqual([]);
  });

  it('keeps 64 allies at most: past that, the one least recently seen goes', () => {
    expect(ALLIES_MAX).toBe(64);
    const c = clock();
    const a = createAllies({ saves: createSaves({ local: memory(), session: memory() }), now: c.now });
    for (let n = 1; n <= 64; n++) {
      c.t = n;
      a.saveAlly(pilot(n), `Pilot ${n}`);
    }
    c.t = 100;
    a.seenAlly(pilot(1), 'Pilot 1'); // (the first, seen again: not the one to go)
    c.t = 101;
    a.saveAlly(pilot(65), 'Pilot 65');
    expect(a.allies()).toHaveLength(64);
    expect(a.isAlly(pilot(65))).toBe(true);
    expect(a.isAlly(pilot(1))).toBe(true);
    expect(a.isAlly(pilot(2))).toBe(false);
  });

  it('keeps 128 blocks at most: past that, the oldest goes', () => {
    expect(BLOCKED_MAX).toBe(128);
    const c = clock();
    const a = createAllies({ saves: null, now: c.now });
    for (let n = 1; n <= 129; n++) {
      c.t = n;
      a.block(pilot(n), null);
    }
    expect(a.isBlocked(pilot(1))).toBe(false);
    expect(a.isBlocked(pilot(2))).toBe(true);
    expect(a.isBlocked(pilot(129))).toBe(true);
  });

  it('reads a corrupt save as nothing, or as what’s good in it, and cuts one too long to size', () => {
    for (const raw of ['not json', '[1,2,3]', '{"v":1,"data":"x"}', 'null', '{"v":1,"data":[]}']) {
      const local = memory();
      local.setItem(ALLIES_KEY, raw);
      local.setItem(BLOCKED_KEY, raw);
      const a = createAllies({ saves: createSaves({ local, session: memory() }) });
      expect(a.allies()).toEqual([]);
      expect(a.isBlocked(pilot(1))).toBe(false);
    }
    const local = memory();
    const data = {
      [pilot(1)]: { name: 'Han‮<b>', since: 5, seen: 'later' },
      [pilot(2)]: 7,
      'not-a-pilot': { name: 'Nope', since: 1, seen: 1 },
      [pilot(3)]: { name: 42, since: -4, seen: 6 },
      ['A'.repeat(64)]: { name: 'Shouty', since: 1, seen: 1 },
    };
    local.setItem(ALLIES_KEY, JSON.stringify({ v: 1, data }));
    const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [pilot(1000 + i), { name: null, at: i }]));
    local.setItem(BLOCKED_KEY, JSON.stringify({ v: 1, data: { ...many, [pilot(5)]: 'blocked' } }));
    const a = createAllies({ saves: createSaves({ local, session: memory() }) });
    expect(a.allies()).toEqual([
      { id: pilot(3), name: 'Pilot', since: 0, seen: 6 },
      { id: pilot(1), name: 'Han<b>', since: 5, seen: 5 },
    ]);
    expect(a.isBlocked(pilot(5))).toBe(false);
    expect(a.isBlocked(pilot(1000))).toBe(false); // (the oldest of 300 let go)
    expect(a.isBlocked(pilot(1299))).toBe(true);
  });

  it('tells whoever’s listening of each change, and stops when asked', () => {
    const a = createAllies({ saves: null });
    let heard = 0;
    const off = a.on(() => (heard += 1));
    a.saveAlly(pilot(1), 'Han');
    a.block(pilot(2), 'Greedo');
    a.dropAlly(pilot(9)); // (nobody: no change)
    expect(heard).toBe(2);
    off();
    a.unblock(pilot(2));
    expect(heard).toBe(2);
  });

  it('keeps them for the visit when there’s no storage to be had', () => {
    const a = createAllies({ saves: createSaves({ local: broken(), session: broken() }) });
    a.saveAlly(pilot(1), 'Han');
    a.block(pilot(2), 'Greedo');
    expect(a.isAlly(pilot(1))).toBe(true);
    expect(a.isBlocked(pilot(2))).toBe(true);
  });

  it('remembers which of your keys an alliance was made with', () => {
    const local = memory();
    const saves = createSaves({ local, session: memory() });
    const a = createAllies({ saves });
    const mine = 'c'.repeat(64);
    a.saveAlly(pilot(1), 'Han', mine);
    expect(a.madeAs(pilot(1))).toBe('c'.repeat(16));
    a.seenAlly(pilot(1), 'Han');
    a.saveAlly(pilot(1), 'Han'); // (saved again with no key said: the one it had)
    expect(createAllies({ saves }).madeAs(pilot(1))).toBe('c'.repeat(16));
    expect(a.allies()).toEqual([{ id: pilot(1), name: 'Han', since: expect.any(Number), seen: expect.any(Number) }]);
    // one made with another key since
    a.saveAlly(pilot(1), 'Han', 'd'.repeat(64));
    expect(a.madeAs(pilot(1))).toBe('d'.repeat(16));
    // none said, or junk: none known
    a.saveAlly(pilot(2), 'Leia');
    expect(a.madeAs(pilot(2))).toBeNull();
    expect(a.madeAs(pilot(9))).toBeNull();
    local.setItem(ALLIES_KEY, JSON.stringify({ v: 1, data: { [pilot(3)]: { name: 'Lando', since: 1, seen: 1, as: '<b>' } } }));
    expect(createAllies({ saves: createSaves({ local, session: memory() }) }).madeAs(pilot(3))).toBeNull();
  });

  it('hears another tab’s changes to the same storage', () => {
    const saves = createSaves({ local: memory(), session: memory() });
    const one = createAllies({ saves });
    const two = createAllies({ saves });
    let heard = 0;
    two.on(() => (heard += 1));
    one.saveAlly(pilot(1), 'Han');
    one.block(pilot(2), 'Greedo');
    expect(two.isAlly(pilot(1))).toBe(true);
    expect(two.isBlocked(pilot(2))).toBe(true);
    expect(heard).toBe(2);
    // and what it saves keeps the other's
    two.saveAlly(pilot(3), 'Leia');
    expect(createAllies({ saves }).allies().map((x) => x.id).sort()).toEqual([pilot(1), pilot(3)]);
  });
});
