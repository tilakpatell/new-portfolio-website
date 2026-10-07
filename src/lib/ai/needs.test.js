import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded';
import { createNeeds, pickPlace, release, reserve, slotOf, spotOf, taken, wantAt } from './needs';

const bench = (over = {}) => ({ id: 'bench', at: [10, 0], need: 'rest', slots: 2, clip: 'sit.idle', base: 'sit.idle', duration: 20, ...over });
const bar = (over = {}) => ({ id: 'bar', at: [5, 0], need: 'food', slots: 3, clip: 'drink', duration: 8, ...over });

describe('needs', () => {
  it('rise at their own rates, fall when met, and stay between 0 and 1', () => {
    const n = createNeeds({ needs: { rest: 0.1, food: 0.02 }, start: { rest: 0, food: 0 } });
    n.tick(5);
    expect(n.level('rest')).toBeCloseTo(0.5, 5);
    expect(n.level('food')).toBeCloseTo(0.1, 5);
    n.tick(100);
    expect(n.level('rest')).toBe(1);
    n.satisfy('rest', 0.4);
    expect(n.level('rest')).toBeCloseTo(0.6, 5);
    n.satisfy('rest');
    expect(n.level('rest')).toBe(0);
    // a need it doesn't have is never wanted
    expect(n.level('work')).toBe(0);
    expect(n.levels()).toEqual({ rest: 0, food: expect.any(Number) });
  });

  it('start where their seed puts them, so a crowd doesn’t want the same thing at once', () => {
    const a = createNeeds({ needs: { rest: 0.01 }, rand: seeded(1) });
    const b = createNeeds({ needs: { rest: 0.01 }, rand: seeded(2) });
    expect(a.level('rest')).not.toBe(b.level('rest'));
    expect(createNeeds({ needs: { rest: 0.01 }, rand: seeded(1) }).level('rest')).toBe(a.level('rest'));
  });
});

describe('picking a place', () => {
  it('goes where its strongest need is met, nearer over farther', () => {
    const me = { x: 0, z: 0, needs: { rest: 0.9, food: 0.2 } };
    expect(pickPlace(me, [bench(), bar()], { rand: seeded(3) }).id).toBe('bench');
    const hungry = { x: 0, z: 0, needs: { rest: 0.2, food: 0.9 } };
    expect(pickPlace(hungry, [bench(), bar()], { rand: seeded(3) }).id).toBe('bar');
    // two benches: the nearer
    const far = bench({ id: 'far', at: [60, 0] });
    expect(pickPlace(me, [far, bench()], { rand: seeded(3) }).id).toBe('bench');
    // a need that doesn't press is no reason to go
    expect(pickPlace({ x: 0, z: 0, needs: { rest: 0.05 } }, [bench()], { rand: seeded(3) })).toBeNull();
    // nor is a place out of reach
    expect(pickPlace(me, [bench({ at: [500, 0] })], { rand: seeded(3) })).toBeNull();
  });

  it('reads a createNeeds or a plain map, and not the place it just left', () => {
    const n = createNeeds({ needs: { rest: 0 }, start: { rest: 0.8 } });
    expect(pickPlace({ x: 0, z: 0, needs: n }, [bench()], { rand: seeded(1) }).id).toBe('bench');
    expect(pickPlace({ x: 0, z: 0, needs: n, last: 'bench' }, [bench()], { rand: seeded(1) })).toBeNull();
  });

  it('never overbooks a place’s slots', () => {
    const places = [bench(), bar({ slots: 1 })];
    const rand = seeded(7);
    let got = 0;
    for (let i = 0; i < 8; i++) {
      const who = { id: `p${i}`, x: (i % 3) - 1, z: i - 4, needs: { rest: 0.5 + (i % 4) * 0.1, food: 0.6 } };
      const p = pickPlace(who, places, { rand });
      if (!p) continue;
      expect(reserve(p, who.id)).toBe(true);
      got++;
      for (const q of places) expect(taken(q)).toBeLessThanOrEqual(q.slots);
    }
    expect(got).toBe(3);
    expect(taken(places[0])).toBe(2);
    expect(taken(places[1])).toBe(1);
    // full: no more, not even asked straight
    expect(reserve(places[0], 'late')).toBe(false);
    // one who holds a slot may still pick it (it's theirs)
    const holder = { id: 'p0', x: 0, z: 0, needs: { rest: 0.9 } };
    if (slotOf(places[0], 'p0') >= 0) expect(pickPlace(holder, [places[0]], { rand })?.id).toBe('bench');
  });

  it('gives each one in a place a spot of its own, and lets it go', () => {
    const b = bench({ spots: [[9.6, 0], [10.4, 0]] });
    expect(reserve(b, 'a')).toBe(true);
    expect(reserve(b, 'b')).toBe(true);
    expect(reserve(b, 'a')).toBe(true); // (already there: still one slot)
    expect(taken(b)).toBe(2);
    expect(spotOf(b, 'a')).toEqual([9.6, 0]);
    expect(spotOf(b, 'b')).toEqual([10.4, 0]);
    release(b, 'a');
    expect(taken(b)).toBe(1);
    expect(slotOf(b, 'a')).toBe(-1);
    // the next to come takes the spot that's free, not the other's
    expect(reserve(b, 'c')).toBe(true);
    expect(spotOf(b, 'c')).toEqual([9.6, 0]);
    // a place without spots: its own `at`
    const c = bar();
    reserve(c, 'x');
    expect(spotOf(c, 'x')).toEqual([5, 0]);
    // everyone out
    release(b);
    expect(taken(b)).toBe(0);
  });

  it('keeps on to where it was going over a near equal', () => {
    const a = bench({ id: 'a', at: [10, 0] });
    const b = bench({ id: 'b', at: [-10.5, 0] });
    const me = { x: 0, z: 0, needs: { rest: 0.8 } };
    expect(pickPlace(me, [a, b], {}).id).toBe('a');
    expect(pickPlace(me, [a, b], { current: 'b' }).id).toBe('b');
  });
});

describe('a schedule', () => {
  const work = { id: 'factory', at: [20, 0], need: 'work', slots: 10, clip: 'interact', duration: 60 };
  const day = [{ from: 9, to: 17, want: 'work' }];

  it('changes the pick by the hour', () => {
    const me = { x: 0, z: 0, needs: { work: 0.3, food: 0.6 } };
    expect(pickPlace(me, [work, bar()], { t: 12, schedule: day, rand: seeded(1) }).id).toBe('factory');
    expect(pickPlace(me, [work, bar()], { t: 20, schedule: day, rand: seeded(1) }).id).toBe('bar');
    // with no schedule, its needs alone
    expect(pickPlace(me, [work, bar()], { t: 12, rand: seeded(1) }).id).toBe('bar');
  });

  it('wraps past midnight, and names a place by its id as well as a need', () => {
    const night = [{ from: 21, to: 3, want: 'bar' }];
    expect(wantAt(night, 23)).toBe('bar');
    expect(wantAt(night, 1)).toBe('bar');
    expect(wantAt(night, 12)).toBeNull();
    expect(wantAt(day, 9)).toBe('work');
    expect(wantAt(day, 17)).toBeNull();
    expect(wantAt(null, 12)).toBeNull();
    const me = { x: 0, z: 0, needs: { rest: 0.7, food: 0.1 } };
    expect(pickPlace(me, [bench(), bar()], { t: 23, schedule: night, rand: seeded(1) }).id).toBe('bar');
  });
});
