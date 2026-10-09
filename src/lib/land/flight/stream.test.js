import { describe, expect, it } from 'vitest';
import { createLeafStream } from './stream';
import { keyOf, leafOf } from './quadtree';

const want = (...keys) => new Map(keys.map((k) => [k, leafOf(...k.split(':').map(Number))]));
const far = (i) => keyOf(6, 1000 + i * 3, 1000);
const kids = (d, ix, iz) => [0, 1].flatMap((dz) => [0, 1].map((dx) => keyOf(d + 1, ix * 2 + dx, iz * 2 + dz)));

// ask, begin and answer every leaf it wants, in order
const settle = (s, leaves) => {
  for (let i = 0; i < 20; i++) {
    const { ask } = s.update(leaves);
    if (!ask.length) return;
    for (const k of ask) s.began(k, s.gen);
    for (const k of ask) s.done(k, s.gen);
  }
};

describe('createLeafStream', () => {
  it('asks in the Map’s order, up to inFlight', () => {
    const s = createLeafStream({ inFlight: 3 });
    const keys = [0, 1, 2, 3, 4].map(far);
    expect(s.update(want(...keys)).ask).toEqual(keys.slice(0, 3));
  });

  it('asks nothing new while they fly', () => {
    const s = createLeafStream({ inFlight: 3 });
    const leaves = want(far(0), far(1));
    for (const k of s.update(leaves).ask) s.began(k, s.gen);
    expect(s.update(leaves).ask).toEqual([]);
  });

  it('loads what comes back in time', () => {
    const s = createLeafStream();
    const leaves = want(far(0));
    s.update(leaves);
    s.began(far(0), s.gen);
    expect(s.done(far(0), s.gen)).toBe(true);
    expect(s.loaded.has(far(0))).toBe(true);
    expect(s.flying.size).toBe(0);
  });

  it('refuses an older generation', () => {
    const s = createLeafStream();
    s.update(want(far(0)));
    s.began(far(0), s.gen);
    const old = s.gen;
    s.reset();
    expect(s.done(far(0), old)).toBe(false);
    expect(s.loaded.size).toBe(0);
  });

  it('drops a leaf wanted by nothing on the keep-th update, not before', () => {
    const s = createLeafStream({ keep: 2 });
    settle(s, want(far(0)));
    const elsewhere = want(far(9));
    expect(s.update(elsewhere).drop).toEqual([]);
    expect(s.update(elsewhere).drop).toEqual([far(0)]);
    expect(s.loaded.has(far(0))).toBe(false);
  });

  it('cancels a flying leaf no longer wanted, and refuses its answer', () => {
    const s = createLeafStream();
    s.update(want(far(0)));
    s.began(far(0), s.gen);
    expect(s.update(want(far(1))).cancel).toEqual([far(0)]);
    expect(s.done(far(0), s.gen)).toBe(false);
    expect(s.loaded.has(far(0))).toBe(false);
  });

  it('lets a failed leaf be asked again', () => {
    const s = createLeafStream();
    const leaves = want(far(0));
    s.update(leaves);
    s.began(far(0), s.gen);
    s.failed(far(0), s.gen);
    expect(s.update(leaves).ask).toEqual([far(0)]);
  });

  it('resets: a new gen, nothing loaded or flying', () => {
    const s = createLeafStream();
    settle(s, want(far(0), far(1)));
    s.update(want(far(2)));
    s.began(far(2), s.gen);
    const gen = s.gen;
    const out = s.reset();
    expect(s.gen).toBe(gen + 1);
    expect(s.loaded.size).toBe(0);
    expect(s.flying.size).toBe(0);
    expect(out.drop.sort()).toEqual([far(0), far(1)].sort());
    expect(out.cancel).toEqual([far(2)]);
  });

  describe('a split, with no hole and no double', () => {
    const parent = keyOf(4, 2, 3);
    const children = kids(4, 2, 3);

    it('keeps the parent drawn until all four children are in, then swaps', () => {
      const s = createLeafStream({ keep: 2, inFlight: 6 });
      settle(s, want(parent));
      const split = want(...children);
      const { ask } = s.update(split);
      expect(ask).toEqual(children);
      for (const k of ask) s.began(k, s.gen);
      for (const k of children.slice(0, 3)) s.done(k, s.gen);
      // three in: the parent still covers them, they wait unseen
      for (let i = 0; i < 4; i++) expect(s.update(split).drop).toEqual([]);
      expect(s.shows(parent)).toBe(true);
      for (const k of children.slice(0, 3)) expect(s.shows(k)).toBe(false);
      s.done(children[3], s.gen);
      expect(s.update(split).drop).toEqual([parent]);
      for (const k of children) expect(s.shows(k)).toBe(true);
    });

    it('keeps the children drawn until the parent is in, on a merge', () => {
      const s = createLeafStream({ keep: 2 });
      settle(s, want(...children));
      const merged = want(parent);
      const { ask } = s.update(merged);
      expect(ask).toEqual([parent]);
      s.began(parent, s.gen);
      for (let i = 0; i < 4; i++) expect(s.update(merged).drop).toEqual([]);
      s.done(parent, s.gen);
      expect(s.shows(parent)).toBe(false);
      expect(s.update(merged).drop.sort()).toEqual([...children].sort());
      expect(s.shows(parent)).toBe(true);
    });
  });

  describe('a leaf that keeps failing', () => {
    const parent = keyOf(4, 2, 3);
    const children = kids(4, 2, 3);

    it('is not asked again until a reset, and its parent stays drawn over it', () => {
      const s = createLeafStream({ keep: 1, inFlight: 6 });
      settle(s, want(parent));
      const split = want(...children);
      for (const k of s.update(split).ask) s.began(k, s.gen);
      for (const k of children.slice(0, 3)) s.done(k, s.gen);
      s.failed(children[3], s.gen);
      s.block(children[3]);
      for (let i = 0; i < 5; i++) {
        const { ask, drop } = s.update(split);
        expect(ask).toEqual([]);
        expect(drop).toEqual([]);
      }
      // the parent, never a hole: its children wait unseen
      expect(s.shows(parent)).toBe(true);
      for (const k of children.slice(0, 3)) expect(s.shows(k)).toBe(false);
      s.reset();
      expect(s.blocked.size).toBe(0);
      expect(s.update(split).ask).toContain(children[3]);
    });
  });
});
