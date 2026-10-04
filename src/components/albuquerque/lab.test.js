import { describe, expect, it } from 'vitest';
import {
  CUSTOMERS,
  LAB,
  UPGRADES,
  bagScore,
  breakScore,
  buy,
  cookScore,
  grade,
  makeOrder,
  mixScore,
  newCareer,
  newDay,
  payFor,
  rankFor,
  rosterFor,
  waitScore,
} from './lab';
import { rng } from '../../stages/gb/font';

const order = (o = {}) => ({ customer: 'jesse', trays: 2, tint: 'blue', chili: true, purity: 92, cut: 'rocks', pack: 'baggie', ...o });

describe('the lab: orders', () => {
  it('opens on day one with the first three customers', () => {
    expect(rosterFor(1)).toEqual(['jesse', 'badger', 'pete']);
  });

  it('brings in more customers as the days go on, Gus by day four', () => {
    expect(rosterFor(3).length).toBeGreaterThan(rosterFor(1).length);
    expect(rosterFor(4)).toContain('gus');
    expect(rosterFor(12)).toEqual(expect.arrayContaining(Object.keys(CUSTOMERS).filter((id) => CUSTOMERS[id].from <= 12)));
  });

  it('writes orders that fit the customer: Gus never wants Chili P and always wants it pure', () => {
    const rand = rng(7);
    for (let i = 0; i < 40; i++) {
      const o = makeOrder('gus', 6, rand);
      expect(o.chili).toBe(false);
      expect(o.purity).toBeGreaterThanOrEqual(98);
      expect(o.pack).toBe('box');
    }
  });

  it('makes every order complete and in range', () => {
    const rand = rng(3);
    for (const id of Object.keys(CUSTOMERS)) {
      for (let day = 1; day <= 10; day++) {
        const o = makeOrder(id, day, rand);
        expect([1, 2, 3]).toContain(o.trays);
        expect(Object.keys(LAB.tints)).toContain(o.tint);
        expect(Object.keys(LAB.cuts)).toContain(o.cut);
        expect(Object.keys(LAB.packs)).toContain(o.pack);
        expect(typeof o.chili).toBe('boolean');
        expect(o.purity).toBeGreaterThanOrEqual(80);
        expect(o.purity).toBeLessThanOrEqual(99);
      }
    }
  });

  it('plans a shift with more customers on later days, the first at the door at once', () => {
    const d1 = newDay(newCareer(), rng(1));
    const d6 = newDay({ ...newCareer(), day: 6 }, rng(1));
    expect(d1.queue.length).toBe(3);
    expect(d6.queue.length).toBeGreaterThan(d1.queue.length);
    expect(d1.queue[0].arrive).toBe(0);
    for (let i = 1; i < d6.queue.length; i++) expect(d6.queue[i].arrive).toBeGreaterThan(d6.queue[i - 1].arrive);
  });
});

describe('the lab: scoring', () => {
  it('scores a mix by how close the pour and the tint come to the lines', () => {
    const o = order();
    const perfect = mixScore(o, { base: LAB.baseFor(o.trays), blue: LAB.tints[o.tint].level, chili: 1 });
    const off = mixScore(o, { base: LAB.baseFor(o.trays) + 0.12, blue: LAB.tints[o.tint].level - 0.1, chili: 1 });
    expect(perfect).toBe(100);
    expect(off).toBeLessThan(perfect);
    expect(off).toBeGreaterThan(0);
  });

  it('marks a mix down for Chili P the customer did not want, or left out', () => {
    const o = order({ chili: false });
    const lines = { base: LAB.baseFor(o.trays), blue: LAB.tints[o.tint].level };
    expect(mixScore(o, { ...lines, chili: 2 })).toBeLessThan(mixScore(o, { ...lines, chili: 0 }));
    const p = order({ chili: true });
    expect(mixScore(p, { ...lines, chili: 0 })).toBeLessThan(mixScore(p, { ...lines, chili: 1 }));
  });

  it('forgives a little more with Gale’s notes', () => {
    const o = order();
    const pour = { base: LAB.baseFor(o.trays) + 0.08, blue: LAB.tints[o.tint].level, chili: 1 };
    expect(mixScore(o, pour, ['notes'])).toBeGreaterThan(mixScore(o, pour));
  });

  it('scores a cook on purity, hard below what was ordered', () => {
    const o = order({ purity: 96 });
    expect(cookScore(o, LAB.topPurity)).toBe(100);
    expect(cookScore(o, 97)).toBeGreaterThan(cookScore(o, 95));
    expect(cookScore(o, 96) - cookScore(o, 95)).toBeGreaterThan(cookScore(o, 97) - cookScore(o, 96));
    expect(cookScore(o, 40)).toBe(0);
  });

  it('scores a break on how close each strike lands, and a missed crack counts for nothing', () => {
    expect(breakScore([1, 1, 1], 3)).toBe(100);
    expect(breakScore([1, 1], 3)).toBeLessThan(70);
    expect(breakScore([0.5, 0.5, 0.5], 3)).toBe(50);
    expect(breakScore([1, 1, 1], 3, 2)).toBeLessThan(100); // two wild swings
  });

  it('scores bagging on the scale, overfilling worse than coming in light', () => {
    const o = order({ pack: 'baggie', trays: 2 });
    const t = LAB.packs.baggie.weight;
    expect(bagScore(o, [t, t])).toBe(100);
    expect(bagScore(o, [t + 0.05, t + 0.05])).toBeLessThan(bagScore(o, [t - 0.05, t - 0.05]));
    expect(bagScore(o, [t])).toBeLessThan(60); // a bag short
  });

  it('keeps a quick serve at full marks and lets a long wait cost, but never to nothing', () => {
    expect(waitScore(5, 'jesse')).toBe(100);
    expect(waitScore(120, 'jesse')).toBeLessThan(100);
    expect(waitScore(99999, 'jesse')).toBeGreaterThan(0);
    expect(waitScore(60, 'tuco')).toBeLessThan(waitScore(60, 'jesse')); // Tuco has no patience
    expect(waitScore(80, 'jesse', ['huell'])).toBeGreaterThanOrEqual(waitScore(80, 'jesse'));
  });

  it('grades the whole order into a reaction', () => {
    expect(grade({ mix: 100, cook: 100, break: 100, bag: 100, wait: 100 })).toMatchObject({ total: 100, mood: 'great' });
    expect(grade({ mix: 20, cook: 30, break: 10, bag: 20, wait: 40 }).mood).toBe('bad');
  });

  it('pays more for bigger, better orders, and more with the billboard', () => {
    const small = payFor(order({ trays: 1 }), 90);
    const big = payFor(order({ trays: 3 }), 90);
    expect(big).toBeGreaterThan(small);
    expect(payFor(order(), 95)).toBeGreaterThan(payFor(order(), 60));
    expect(payFor(order(), 90, ['billboard'])).toBeGreaterThan(payFor(order(), 90));
    expect(payFor(order({ customer: 'gus' }), 90)).toBeGreaterThan(payFor(order({ customer: 'jesse' }), 90));
  });
});

describe('the lab: career', () => {
  it('climbs the titles with points', () => {
    expect(rankFor(0).title).toBe(LAB.ranks[0][1]);
    expect(rankFor(100000).title).toBe(LAB.ranks.at(-1)[1]);
    expect(rankFor(0).next).toBeGreaterThan(0);
  });

  it('buys an upgrade once, if you can afford it', () => {
    const rich = { ...newCareer(), money: 1000 };
    const u = UPGRADES[0];
    const after = buy(rich, u.id);
    expect(after.upgrades).toContain(u.id);
    expect(after.money).toBe(1000 - u.cost);
    expect(buy(after, u.id)).toBe(after);
    const poor = { ...newCareer(), money: 0 };
    expect(buy(poor, u.id)).toBe(poor);
  });

  it('restores a saved career and ignores junk', () => {
    expect(newCareer({ day: 4, money: 120, points: 80, upgrades: ['burner', 'nonsense'] })).toMatchObject({ day: 4, money: 120, points: 80, upgrades: ['burner'] });
    expect(newCareer({ day: -3, money: 'lots' })).toMatchObject({ day: 1, money: 0 });
    expect(newCareer(null).day).toBe(1);
  });
});
