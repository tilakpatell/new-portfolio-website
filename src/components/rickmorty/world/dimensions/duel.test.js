import { describe, expect, it } from 'vitest';
import { SHOT, fire, inCone, newDuel, strike } from './duel';

describe('a duel', () => {
  it('lands a shot only on someone in front, within range', () => {
    const me = { x: 0, z: 0 };
    expect(inCone(me, 0, { x: 5, z: 0 })).toBe(true); // facing east, he's east
    expect(inCone(me, 0, { x: 5, z: 3 })).toBe(false); // too far round
    expect(inCone(me, Math.PI / 2, { x: 0, z: -5 })).toBe(true); // facing north, he's north
    expect(inCone(me, 0, { x: SHOT.range + 1, z: 0 })).toBe(false);
    expect(inCone(me, 0, { x: -5, z: 0 })).toBe(false);
  });
  it('takes a point off whoever is hit, and ends at nought', () => {
    let d = newDuel({ hp: 2, mortyHp: 2 });
    d = fire(d, { x: 0, z: 0 }, 0, { x: 3, z: 0 });
    expect(d).toMatchObject({ hp: 1, hit: true, down: false, over: false });
    d = fire(d, { x: 0, z: 0 }, 0, { x: 3, z: 6 });
    expect(d).toMatchObject({ hp: 1, hit: false });
    d = fire(d, { x: 0, z: 0 }, 0, { x: 3, z: 0 });
    expect(d).toMatchObject({ hp: 0, down: true, over: true });
    // (nothing lands on a duel that's over)
    expect(fire(d, { x: 0, z: 0 }, 0, { x: 3, z: 0 }).hit).toBe(false);
  });
  it('beats Morty after as many strikes as he has points', () => {
    let d = newDuel({ hp: 6, mortyHp: 2 });
    d = strike(d);
    expect(d).toMatchObject({ mortyHp: 1, beaten: false, over: false });
    d = strike(d);
    expect(d).toMatchObject({ mortyHp: 0, beaten: true, over: true });
    expect(strike(d).beaten).toBe(false);
  });
});
