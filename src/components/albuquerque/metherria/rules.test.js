import { describe, expect, it } from 'vitest';
import {
  CUSTOMERS,
  M,
  UPGRADES,
  breakScore,
  buildScore,
  buy,
  cookScore,
  grade,
  makeOrder,
  newCareer,
  newDay,
  packScore,
  payFor,
  rankFor,
  rosterFor,
  unlocked,
  waitScore,
} from './rules';
import { rng } from '../../../lib/texture';

const order = (o = {}) => ({ customer: 'jesse', size: 'medium', mix: { blue: 2, chili: 1 }, purity: 92, cut: 'rocks', pack: 'baggie', stickers: [], ...o });
const exact = (o) => ({ size: o.size, base: M.sizes[o.size].base, mix: { ...o.mix } });

describe('Walt’s Metherria: who comes, and what they ask for', () => {
  it('opens on day one with Jesse, Badger and Skinny Pete', () => {
    expect(rosterFor(1)).toEqual(['jesse', 'badger', 'pete']);
  });

  it('brings in Gus by day four and everyone by day six', () => {
    expect(rosterFor(4)).toContain('gus');
    expect(rosterFor(6)).toEqual(Object.keys(CUSTOMERS).filter((id) => CUSTOMERS[id].from <= 6));
  });

  it('writes orders in each customer’s taste: Gus wants no Chili P, a Pollos box and 98 or better', () => {
    const rand = rng(7);
    for (let i = 0; i < 40; i++) {
      const o = makeOrder('gus', 8, rand, 5);
      expect(o.mix.chili ?? 0).toBe(0);
      expect(o.pack).toBe('box');
      expect(o.purity).toBeGreaterThanOrEqual(98);
    }
  });

  it('always asks Jesse’s batches for Chili P', () => {
    const rand = rng(2);
    for (let i = 0; i < 30; i++) expect(makeOrder('jesse', 1, rand, 0).mix.chili).toBeGreaterThanOrEqual(1);
  });

  it('only asks for what has been unlocked at the current rank', () => {
    const rand = rng(3);
    for (const id of Object.keys(CUSTOMERS)) {
      const o = makeOrder(id, 9, rand, 0);
      expect(o.mix.seeds ?? 0).toBe(0);
      expect(o.mix.spice ?? 0).toBe(0);
      expect(o.stickers).toEqual([]);
      expect(o.cut).not.toBe('dust');
    }
    const later = Array.from({ length: 60 }, () => makeOrder('gus', 9, rand, 5));
    expect(later.some((o) => o.stickers.length > 0)).toBe(true);
    expect(later.some((o) => (o.mix.spice ?? 0) > 0)).toBe(true);
  });

  it('keeps every order complete and in range', () => {
    const rand = rng(4);
    for (const id of Object.keys(CUSTOMERS)) {
      for (let r = 0; r < M.ranks.length; r++) {
        const o = makeOrder(id, 10, rand, r);
        expect(Object.keys(M.sizes)).toContain(o.size);
        expect(o.mix.blue).toBeGreaterThanOrEqual(1);
        expect(o.mix.blue).toBeLessThanOrEqual(M.mixins.blue.max);
        expect(Object.keys(M.cuts)).toContain(o.cut);
        expect(Object.keys(M.packs)).toContain(o.pack);
        for (const s of o.stickers) {
          expect(Object.keys(M.stickers)).toContain(s.kind);
          expect(s.x).toBeGreaterThan(0.1);
          expect(s.x).toBeLessThan(0.9);
        }
        expect(o.purity).toBeGreaterThanOrEqual(80);
        expect(o.purity).toBeLessThanOrEqual(99);
      }
    }
  });

  it('unlocks more as the rank rises', () => {
    expect(unlocked(0).mixins).toEqual(['blue', 'chili']);
    expect(unlocked(5).mixins.length).toBeGreaterThan(2);
    expect(unlocked(0).stickers).toEqual([]);
    expect(unlocked(5).stickers.length).toBeGreaterThan(0);
  });

  it('plans a shift: more customers on later days, the first at the door at once', () => {
    const d1 = newDay(newCareer(), rng(1));
    const d6 = newDay({ ...newCareer(), day: 6 }, rng(1));
    expect(d1.queue.length).toBe(3);
    expect(d6.queue.length).toBeGreaterThan(3);
    expect(d1.queue[0].arrive).toBe(0);
  });
});

describe('Walt’s Metherria: scoring the stations', () => {
  it('gives a perfect build full marks', () => {
    const o = order();
    expect(buildScore(o, exact(o))).toBe(100);
  });

  it('marks a build down for the wrong size, a bad pour, or the wrong mix-ins', () => {
    const o = order();
    expect(buildScore(o, { ...exact(o), size: 'small', base: M.sizes.small.base })).toBeLessThan(70);
    expect(buildScore(o, { ...exact(o), base: M.sizes.medium.base + 0.12 })).toBeLessThan(100);
    const offByOne = buildScore(o, { ...exact(o), mix: { blue: 3, chili: 1 } });
    const offByTwo = buildScore(o, { ...exact(o), mix: { blue: 2, chili: 3 } });
    expect(offByOne).toBeLessThan(100);
    expect(offByTwo).toBeLessThan(offByOne);
    expect(buildScore(o, { ...exact(o), mix: { blue: 2, chili: 1, seeds: 2 } })).toBeLessThan(100); // extras they didn't want
  });

  it('forgives a pour a little more with Gale’s notes', () => {
    const o = order();
    const pour = { ...exact(o), base: M.sizes.medium.base + 0.08 };
    expect(buildScore(o, pour, ['notes'])).toBeGreaterThan(buildScore(o, pour));
  });

  it('scores a cook on purity, hard below what was ordered', () => {
    const o = order({ purity: 96 });
    expect(cookScore(o, M.topPurity)).toBe(100);
    expect(cookScore(o, 96) - cookScore(o, 95)).toBeGreaterThan(cookScore(o, 97) - cookScore(o, 96));
  });

  it('scores a break on each strike, and a crack never struck counts for nothing', () => {
    expect(breakScore([1, 1, 1], 3)).toBe(100);
    expect(breakScore([1, 1], 3)).toBeLessThan(70);
  });

  it('scores packing on the right pack, the fill and the stickers', () => {
    const o = order({ pack: 'box', size: 'medium', stickers: [{ kind: 'pollos', x: 0.5, y: 0.4 }] });
    const w = M.packs.box.weight;
    const right = { pack: 'box', weights: [w, w], stickers: [{ kind: 'pollos', x: 0.5, y: 0.4 }] };
    expect(packScore(o, right)).toBe(100);
    expect(packScore(o, { ...right, pack: 'baggie' })).toBeLessThan(80);
    expect(packScore(o, { ...right, stickers: [{ kind: 'pollos', x: 0.7, y: 0.6 }] })).toBeLessThan(100);
    expect(packScore(o, { ...right, stickers: [] })).toBeLessThan(packScore(o, { ...right, stickers: [{ kind: 'pollos', x: 0.6, y: 0.45 }] }));
    expect(packScore(o, { ...right, stickers: [{ kind: 'hat', x: 0.5, y: 0.4 }] })).toBeLessThan(70); // the wrong sticker
    expect(packScore(o, { ...right, weights: [w + 0.06, w + 0.06] })).toBeLessThan(packScore(o, { ...right, weights: [w - 0.06, w - 0.06] }));
  });

  it('keeps a quick serve at full marks, lets a long wait cost, but never to nothing', () => {
    expect(waitScore(5, 'jesse')).toBe(100);
    expect(waitScore(200, 'jesse')).toBeLessThan(100);
    expect(waitScore(99999, 'jesse')).toBeGreaterThan(0);
    expect(waitScore(70, 'tuco')).toBeLessThan(waitScore(70, 'jesse'));
  });

  it('grades the whole order into a reaction', () => {
    expect(grade({ build: 100, cook: 100, break: 100, pack: 100, wait: 100 })).toMatchObject({ total: 100, mood: 'great' });
    expect(grade({ build: 20, cook: 30, break: 10, pack: 20, wait: 40 }).mood).toBe('bad');
  });

  it('pays more for bigger, better orders, with the billboard, and from Gus', () => {
    expect(payFor(order({ size: 'large' }), 90)).toBeGreaterThan(payFor(order({ size: 'small' }), 90));
    expect(payFor(order(), 95)).toBeGreaterThan(payFor(order(), 60));
    expect(payFor(order(), 90, ['billboard'])).toBeGreaterThan(payFor(order(), 90));
    expect(payFor(order({ customer: 'gus' }), 90)).toBeGreaterThan(payFor(order(), 90));
  });
});

describe('Walt’s Metherria: the career', () => {
  it('climbs the titles with points', () => {
    expect(rankFor(0).title).toBe(M.ranks[0][1]);
    expect(rankFor(1e6).title).toBe(M.ranks.at(-1)[1]);
  });

  it('buys an upgrade once, if you can afford it', () => {
    const rich = { ...newCareer(), money: 1000 };
    const after = buy(rich, UPGRADES[0].id);
    expect(after.upgrades).toContain(UPGRADES[0].id);
    expect(buy(after, UPGRADES[0].id)).toBe(after);
    const poor = newCareer();
    expect(buy(poor, UPGRADES[0].id)).toBe(poor);
  });

  it('restores a saved career and ignores junk', () => {
    expect(newCareer({ day: 4, money: 120, points: 80, upgrades: ['burner', 'nope'] })).toMatchObject({ day: 4, money: 120, points: 80, upgrades: ['burner'] });
    expect(newCareer({ day: -1, money: 'lots' })).toMatchObject({ day: 1, money: 0 });
  });
});
