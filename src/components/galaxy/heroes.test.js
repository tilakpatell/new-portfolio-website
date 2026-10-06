import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEROES, HILTS, SABER_COLORS, defaultHeroId, heroSpec, readHero, writeHero } from './heroes';
import { GUNS } from '../universe/gunplay';

describe('the heroes', () => {
  it('each have a rigged figure in the site, a weapon the hands know, and a word about them', () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(6);
    for (const h of HEROES) {
      expect(existsSync(new URL(`../../../public${h.src.url}`, import.meta.url)), h.id).toBe(true);
      expect(h.tall).toBeGreaterThan(1);
      expect(GUNS[h.weapon], `${h.id} carries ${h.weapon}`).toBeTruthy();
      if (h.weapon === 'saber') {
        expect(SABER_COLORS.some((c) => c.id === h.saber.color), h.id).toBe(true);
        expect(HILTS.some((x) => x.id === h.saber.hilt), h.id).toBe(true);
      }
      expect(h.blurb.length).toBeGreaterThan(10);
    }
    expect(new Set(HEROES.map((h) => h.id)).size).toBe(HEROES.length);
  });

  it('reads the kept choice, and falls back to the ship’s lead on nothing or nonsense', () => {
    expect(readHero(null, 'xwing')).toEqual({ id: 'luke', color: 'green', hilt: 'luke' });
    expect(readHero(null, 'falcon').id).toBe('han');
    expect(readHero('{bad json', 'xwing').id).toBe('luke');
    expect(readHero({ id: 'vader' }).id).toBe(defaultHeroId('xwing'));
    expect(readHero(writeHero({ id: 'ahsoka', color: 'purple', hilt: 'dooku' }))).toEqual({ id: 'ahsoka', color: 'purple', hilt: 'dooku' });
    // a colour or hilt that isn't one goes back to the hero's own
    expect(readHero({ id: 'ahsoka', color: 'plaid', hilt: 'x' })).toEqual({ id: 'ahsoka', color: 'white', hilt: 'ahsoka' });
    // a gun hero keeps a saber colour for when they pick one up
    expect(readHero({ id: 'han' })).toEqual({ id: 'han', color: 'blue', hilt: 'skywalker' });
  });

  it('makes a party spec: a saber hero holds the saber kind with the blade’s colour, a gun hero their gun', () => {
    const luke = heroSpec({ id: 'luke', color: 'blue', hilt: 'skywalker' });
    expect(luke.gun).toBe('saber');
    expect(luke.saber.color).toBe('#4aa8ff');
    expect(luke.saber.hilt.id).toBe('skywalker');
    expect(luke.bolt).toBe('#4aa8ff');
    expect(luke.src.url).toMatch(/luke\.glb$/);
    const han = heroSpec({ id: 'han', color: 'blue', hilt: 'skywalker' });
    expect(han.gun).toBe('blaster');
    expect(han.saber).toBeNull();
    expect(han.name).toBe('Han');
  });
});
