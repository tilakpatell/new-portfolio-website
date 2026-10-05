import { describe, expect, it } from 'vitest';
import { BODIES, GEAR, GEAR_SLOTS, LOOK_KEY, REGIONS, SWATCHES, WHO, bodyOf, defaultLook, readLook, readLookWire, readLooks, writeLook } from './looks';

describe('the wardrobe', () => {
  it('dresses Rick and Morty, each in bodies the site has rigged', () => {
    expect(WHO).toEqual(['rick', 'morty']);
    expect(BODIES.rick.map((b) => b.id)).toEqual(expect.arrayContaining(['rick', 'tinyrick', 'cowboyrick', 'factoryrick', 'constructionrick', 'sweaterrick', 'suitrick', 'detectiverick', 'cop', 'councilrick-a', 'councilrick-b', 'councilrick-c']));
    expect(BODIES.morty.map((b) => b.id)).toEqual(['morty', 'evilmorty', 'copmorty']);
    for (const who of WHO) {
      expect(BODIES[who][0].id).toBe(who); // (the one from the show first)
      for (const b of BODIES[who]) {
        expect(b.name).toMatch(/\w/);
        expect(b.h).toBeGreaterThan(1.2);
        for (const r of Object.keys(b.regions)) expect(REGIONS).toContain(r);
      }
    }
  });

  it('has sixteen named swatches and gear for the head, the face and a hand, none first', () => {
    expect(SWATCHES).toHaveLength(16);
    expect(new Set(SWATCHES.map((s) => s.id)).size).toBe(16);
    for (const s of SWATCHES) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(GEAR_SLOTS).toEqual(['head', 'face', 'hand']);
    for (const slot of GEAR_SLOTS) {
      expect(GEAR[slot][0].id).toBe('none');
      expect(new Set(GEAR[slot].map((g) => g.id)).size).toBe(GEAR[slot].length);
    }
    expect(GEAR.hand.map((g) => g.id)).toContain('portalgun');
  });

  it('starts each as the show has them', () => {
    expect(defaultLook('rick')).toEqual({ body: 'rick', colors: {}, gear: { head: 'none', face: 'none', hand: 'none' } });
    expect(defaultLook('morty').body).toBe('morty');
  });

  it('reads back what it can, and keeps a colour only where the body has that region', () => {
    const l = readLook('rick', { body: 'cowboyrick', colors: { hair: 'voidblack', outer: 'portalgreen', shoes: 'mortyyellow' }, gear: { face: 'shades' } });
    expect(l.body).toBe('cowboyrick');
    expect(l.colors).toEqual(Object.fromEntries(Object.entries({ hair: 'voidblack', outer: 'portalgreen', shoes: 'mortyyellow' }).filter(([r]) => r in bodyOf('rick', 'cowboyrick').regions)));
    expect(l.gear.face).toBe('shades');
    expect(readLook('rick', { body: 'morty' }).body).toBe('rick'); // (Rick can't wear Morty)
    expect(readLook('morty', { colors: { inner: '#ff0000', legs: 'nope' } }).colors).toEqual({});
    expect(readLook('morty', { gear: { hand: 'bazooka', head: 'crown' } }).gear).toEqual({ head: 'crown', face: 'none', hand: 'none' });
    expect(readLook('rick', null)).toEqual(defaultLook('rick'));
    expect(readLook('rick', [1, 2])).toEqual(defaultLook('rick'));
  });

  it('takes no hat on a head that already has one', () => {
    for (const body of ['cowboyrick', 'constructionrick', 'detectiverick', 'cop']) expect(readLook('rick', { body, gear: { head: 'tophat' } }).gear.head).toBe('none');
    expect(readLook('morty', { body: 'copmorty', gear: { head: 'beanie' } }).gear.head).toBe('none');
    expect(readLook('rick', { body: 'rick', gear: { head: 'tophat' } }).gear.head).toBe('tophat');
  });

  it('keeps both looks under one key', () => {
    expect(LOOK_KEY).toBe('tp-wardrobe');
    expect(readLooks({ rick: { body: 'suitrick' }, morty: 7, zzz: {} })).toEqual({ rick: readLook('rick', { body: 'suitrick' }), morty: defaultLook('morty') });
    expect(readLooks('x')).toEqual({ rick: defaultLook('rick'), morty: defaultLook('morty') });
  });

  it('goes over the wire as ids, and only ids come back', () => {
    for (const who of WHO) {
      for (const b of BODIES[who]) {
        const regions = Object.keys(b.regions);
        const look = readLook(who, { body: b.id, colors: Object.fromEntries(regions.map((r, i) => [r, SWATCHES[i].id])), gear: { head: b.hat ? 'none' : 'crown', face: 'goggles', hand: 'portalgun' } });
        expect(readLookWire(who, writeLook(look))).toEqual(look);
      }
    }
    expect(readLookWire('morty', [[]])).toBeNull();
    expect(readLookWire('morty', 'x'.repeat(400))).toBeNull();
    expect(readLookWire('morty', 7)).toBeNull();
    expect(readLookWire('morty', ['morty', { a: 1 }, null, null, null, null, 'none', 'none', 'none'])).toBeNull();
  });
});
