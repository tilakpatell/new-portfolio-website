import { describe, expect, it } from 'vitest';
import { contested, holders, loadWar, newWar, owner, resolve, saveWar } from './war';
import { WARS } from './wars';

const war = WARS.starwars;
const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('the front', () => {
  it('starts in the middle, the first side attacking the sector across it', () => {
    const s = newWar(war);
    expect(s).toEqual({ front: 3, attacker: 0, wins: [0, 0], battles: 0, won: null });
    expect(contested(s)).toBe(3);
    expect(owner(s, 2)).toBe(0);
    expect(owner(s, 3)).toBe(1);
  });

  it('moves on when the attacker wins, and the winner attacks again', () => {
    const s = resolve(newWar(war), war, 0);
    expect(s.front).toBe(4);
    expect(s.attacker).toBe(0);
    expect(contested(s)).toBe(4);
    expect(s.wins).toEqual([1, 0]);
    expect(s.battles).toBe(1);
  });

  it('holds when the defender wins, and the defender attacks next, across the same line', () => {
    const s = resolve(newWar(war), war, 1);
    expect(s.front).toBe(3);
    expect(s.attacker).toBe(1);
    expect(contested(s)).toBe(2);
    const t = resolve(s, war, 1);
    expect(t.front).toBe(2);
    expect(owner(t, 2)).toBe(1);
  });

  it('is won when one side holds every sector', () => {
    let s = newWar(war);
    for (let i = 0; i < 4; i++) s = resolve(s, war, 0);
    expect(s.front).toBe(7);
    expect(s.won).toBe(0);
    let t = resolve(newWar(war), war, 1);
    for (let i = 0; i < 3; i++) t = resolve(t, war, 1);
    expect(t.front).toBe(0);
    expect(t.won).toBe(1);
  });

  it('says who holds each sector', () => {
    const h = holders(war, resolve(newWar(war), war, 0));
    expect(h).toEqual({ yavin: 0, hoth: 0, bespin: 0, endor: 0, scarif: 1, mustafar: 1, coruscant: 1 });
  });
});

describe('the save', () => {
  it('round-trips', () => {
    const st = memory();
    const s = resolve(resolve(newWar(war), war, 0), war, 1);
    saveWar(st, war, s);
    expect(st.m.has('tp-war-starwars')).toBe(true);
    expect(loadWar(st, war)).toEqual(s);
  });

  it('a bad save loads as a new war', () => {
    const fresh = newWar(war);
    for (const bad of ['{bad', JSON.stringify({ front: 99 }), JSON.stringify({ front: 3, attacker: 2, wins: [0, 0], battles: 0, won: null }), JSON.stringify(null), '"x"']) {
      const st = memory();
      st.setItem('tp-war-starwars', bad);
      expect(loadWar(st, war), bad).toEqual(fresh);
    }
    expect(loadWar(memory(), war)).toEqual(fresh);
    const throws = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadWar(throws, war)).toEqual(fresh);
    expect(() => saveWar(throws, war, fresh)).not.toThrow();
    expect(loadWar(null, war)).toEqual(fresh);
  });
});
