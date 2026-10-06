import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEROES, HERO_KEY, HILTS, SABER_COLORS, defaultHeroId, heroKey, heroSpec, readHero, writeHero } from './heroes';
import { GUNS } from '../universe/gunplay';

describe('the heroes', () => {
  it('each have a rigged figure in the site, a weapon the hands know, and a word about them', () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(6);
    for (const h of HEROES) {
      // (a file in the site, or one of the Meshy cast: universe/footScene.js's)
      if (h.src.url) expect(existsSync(new URL(`../../../public${h.src.url}`, import.meta.url)), h.id).toBe(true);
      else expect(h.src.meshy, h.id).toBeTruthy();
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
    expect(readHero(null, 'xwing')).toMatchObject({ id: 'luke', color: 'green', hilt: 'luke' });
    expect(readHero(null, 'falcon').id).toBe('han');
    expect(readHero('{bad json', 'xwing').id).toBe('luke');
    expect(readHero({ id: 'vader' }).id).toBe(defaultHeroId('xwing'));
    expect(readHero(writeHero({ id: 'ahsoka', color: 'purple', hilt: 'dooku' }))).toMatchObject({ id: 'ahsoka', color: 'purple', hilt: 'dooku' });
    // a colour or hilt that isn't one goes back to the hero's own
    expect(readHero({ id: 'ahsoka', color: 'plaid', hilt: 'x' })).toMatchObject({ id: 'ahsoka', color: 'white', hilt: 'ahsoka' });
    // a gun hero keeps a saber colour for when they pick one up
    expect(readHero({ id: 'han' })).toMatchObject({ id: 'han', color: 'blue', hilt: 'skywalker' });
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

describe('every crew, and every weapon', () => {
  it('lands each ship’s own crew: Rick and Morty off the Space Cruiser, Walt and Jesse off the RV', () => {
    expect(readHero(null, 'cruiser').id).toBe('rick');
    expect(readHero(null, 'rv').id).toBe('walt');
    for (const id of ['rick', 'morty', 'walt', 'jesse']) expect(HEROES.some((h) => h.id === id), id).toBe(true);
    const rick = heroSpec(readHero(null, 'cruiser'));
    expect(rick.gun).toBe('portal');
    expect(rick.src.meshy).toBe('rick');
    expect(rick.saber).toBeNull();
  });

  it('gives anyone a lightsaber, and anyone a gun', () => {
    const han = heroSpec(readHero({ id: 'han', gun: 'saber', color: 'red' }));
    expect(han.gun).toBe('saber');
    expect(han.saber.color).toBe('#ff3b3b');
    expect(han.mods).toEqual([]);
    const rick = heroSpec(readHero({ id: 'rick', gun: 'saber' }));
    expect(rick.saber.color).toBe('#4aa8ff');
    expect(rick.saber.stance).toBe('single');
    const luke = heroSpec(readHero({ id: 'luke', gun: 'sniper', mods: ['scope'] }));
    expect(luke.gun).toBe('sniper');
    expect(luke.saber).toBeNull();
    expect(luke.mods).toEqual(['scope']);
    // (and back to their own)
    expect(heroSpec(readHero({ id: 'walt', gun: 'revolver' })).gun).toBe('revolver');
  });

  it('keeps each crew’s pick apart (the Star Wars ships share the one that was always kept)', () => {
    expect(heroKey('xwing')).toBe(HERO_KEY);
    expect(heroKey('falcon')).toBe(HERO_KEY);
    expect(heroKey('cruiser')).not.toBe(HERO_KEY);
    expect(heroKey('rv')).not.toBe(heroKey('cruiser'));
  });
});

describe('the stance, the gun and the mods', () => {
  it('reads a Jedi’s stance and a gunslinger’s gun and mods, and makes nonsense good', () => {
    expect(readHero({ id: 'luke', stance: 'double' }).stance).toBe('double');
    expect(readHero({ id: 'luke', stance: 'nope' }).stance).toBe('single');
    expect(readHero({ id: 'ahsoka' }).stance).toBe('dual');
    expect(readHero({ id: 'han', gun: 'sniper', mods: ['scope', 'scope', 'nope', 'cooling', 'choke'] })).toMatchObject({ gun: 'sniper', mods: ['scope', 'cooling'] });
    expect(readHero({ id: 'han', gun: 'nope' }).gun).toBe('blaster');
    expect(readHero({ id: 'luke', gun: 'nope' }).gun).toBe('saber');
    expect(readHero({ id: 'chewie' }).gun).toBe('bowcaster');
  });
  it('the spec carries them: the saber’s stance, the picked gun and its mods, a yellow bolt from elsewhere', () => {
    expect(heroSpec(readHero({ id: 'ahsoka', stance: 'double' })).saber.stance).toBe('double');
    const han = heroSpec(readHero({ id: 'han', gun: 'shotgun', mods: ['choke'] }));
    expect(han.gun).toBe('shotgun');
    expect(han.mods).toEqual(['choke']);
    expect(han.bolt).toBe('#ffd36b');
    expect(heroSpec(readHero({ id: 'han', gun: 'a280' })).bolt).toBe('#ff4a3d');
    expect(JSON.parse(writeHero(readHero({ id: 'leia', gun: 'smg', mods: ['trigger'] })))).toMatchObject({ gun: 'smg', mods: ['trigger'] });
  });
});

describe('the perks', () => {
  it('ride with the choice, three at most, nonsense dropped', () => {
    expect(readHero({ id: 'luke', perks: ['focus', 'nope', 'nimble', 'nimble', 'survivor', 'riposte'] }).perks).toEqual(['focus', 'nimble', 'survivor']);
    expect(readHero({ id: 'luke' }).perks).toEqual([]);
    expect(heroSpec(readHero({ id: 'han', perks: ['heatsink'] })).perks).toEqual(['heatsink']);
    expect(JSON.parse(writeHero(readHero({ id: 'leia', perks: ['deflector'] }))).perks).toEqual(['deflector']);
  });
});
