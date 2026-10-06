import { describe, expect, it } from 'vitest';
import { BODIES, CASTS, EVERYONE, GEAR, GEAR_SLOTS, LOOK_KEY, REGIONS, SWATCHES, WHO, bodyOf, castOf, castOfCrew, defaultLook, gearById, gearOf, gearWorn, readLook, readLookWire, readLooks, swatchById, swatchesOf, wornFiles, writeLook } from './looks';

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

  it('keeps every look under one key (Walt and Jesse beside Rick and Morty)', () => {
    expect(LOOK_KEY).toBe('tp-wardrobe');
    expect(readLooks({ rick: { body: 'suitrick' }, morty: 7, zzz: {} })).toEqual({ rick: readLook('rick', { body: 'suitrick' }), morty: defaultLook('morty'), walt: defaultLook('walt'), jesse: defaultLook('jesse') });
    expect(readLooks('x')).toEqual({ rick: defaultLook('rick'), morty: defaultLook('morty'), walt: defaultLook('walt'), jesse: defaultLook('jesse') });
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

  it('names the model files a pair of looks wears (for their credits)', () => {
    expect(wornFiles(readLooks(null))).toEqual([]);
    const armed = readLooks({ rick: { body: 'rick', gear: { hand: 'portalgun' } }, morty: { body: 'morty', gear: { hand: 'portalgun', face: 'shades' } } });
    expect(wornFiles(armed)).toEqual(['/models/wardrobe/portalgun.glb']);
    expect(wornFiles(readLooks({ rick: { gear: { hand: 'plumbus' } } }))).toEqual([]); // (built in code: nobody else's)
  });
});

describe('the casts', () => {
  it('groups who it dresses by cast, and knows which crew is which', () => {
    expect(CASTS).toEqual({ rickmorty: ['rick', 'morty'], breakingbad: ['walt', 'jesse'] });
    expect(EVERYONE).toEqual(['rick', 'morty', 'walt', 'jesse']);
    expect(WHO).toEqual(CASTS.rickmorty); // (Rick and Morty’s, as it always was)
    expect(castOf('walt')).toBe('breakingbad');
    expect(castOf('morty')).toBe('rickmorty');
    expect(castOf('han')).toBeNull();
    expect(castOfCrew('cruiser')).toBe('rickmorty');
    expect(castOfCrew('rv')).toBe('breakingbad');
    expect(castOfCrew('falcon')).toBeNull();
    expect(castOfCrew(null)).toBeNull();
  });

  it('dresses Walt and Jesse in the site’s own figures of them, the one the site shows first', () => {
    expect(BODIES.walt.map((b) => b.id)).toEqual(['walt', 'mrwhite', 'heisenberg']);
    expect(BODIES.jesse.map((b) => b.id)).toEqual(['jesse', 'jesselab']);
    for (const who of EVERYONE) {
      expect(BODIES[who][0].id).toBe(who);
      for (const b of BODIES[who]) {
        expect(b.name).toMatch(/\w/);
        expect(b.h).toBeGreaterThan(1.2);
        expect(Object.keys(b.regions).length).toBeGreaterThan(0);
        for (const r of Object.keys(b.regions)) expect(REGIONS).toContain(r);
      }
    }
    // (a figure of the site’s, by its whole path, rather than one of Portal panic’s cast)
    for (const b of [...BODIES.walt, ...BODIES.jesse]) expect(b.asset).toMatch(/^\/models\/[\w/-]+\.glb$/);
    expect(bodyOf('walt', 'heisenberg').hat).toBe(true);
  });

  it('has each cast’s own swatches, named for its show, none shared between them', () => {
    expect(swatchesOf('rick')).toBe(SWATCHES);
    expect(swatchesOf('jesse')).toBe(swatchesOf('walt'));
    const bb = swatchesOf('walt');
    expect(bb).toHaveLength(16);
    for (const s of bb) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(bb.map((s) => s.id)).toEqual(expect.arrayContaining(['hazmatyellow', 'bluesky', 'heisenbergblack', 'waltgreen', 'tanjacket', 'pollosyellow', 'beaniegrey', 'rvbeige', 'deserttan', 'hoodiered', 'hoodieyellow']));
    const all = [...SWATCHES, ...bb].map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
    expect(swatchById('bluesky').name).toMatch(/Blue Sky/);
  });

  it('has each cast’s own gear, nothing first in every slot', () => {
    expect(gearOf('morty')).toBe(GEAR);
    const bb = gearOf('jesse');
    expect(gearOf('walt')).toBe(bb);
    for (const slot of GEAR_SLOTS) {
      expect(bb[slot][0].id).toBe('none');
      expect(new Set(bb[slot].map((g) => g.id)).size).toBe(bb[slot].length);
    }
    expect(bb.head.map((g) => g.id)).toEqual(expect.arrayContaining(['porkpie', 'jessebeanie']));
    expect(bb.face.map((g) => g.id)).toEqual(expect.arrayContaining(['glasses', 'respirator']));
    expect(bb.hand.map((g) => g.id)).toContain('bluebag');
    expect(gearById('head', 'porkpie').bone).toBe('Head');
    expect(gearById('hand', 'portalgun').bone).toBe('RightHand');
  });

  it('keeps a cast’s colours and gear to its own', () => {
    const w = readLook('walt', { body: 'mrwhite', colors: { outer: 'bluesky', legs: 'portalgreen' }, gear: { head: 'crown', face: 'respirator', hand: 'bluebag' } });
    expect(w).toEqual({ body: 'mrwhite', colors: { outer: 'bluesky' }, gear: { head: 'none', face: 'respirator', hand: 'bluebag' } });
    expect(readLook('rick', { colors: { outer: 'bluesky' }, gear: { head: 'porkpie' } })).toEqual(defaultLook('rick'));
    expect(readLook('jesse', { body: 'heisenberg' }).body).toBe('jesse'); // (Jesse can’t be Heisenberg)
  });

  it('puts Heisenberg’s own hat on him, whatever’s asked for his head', () => {
    const h = readLook('walt', { body: 'heisenberg', gear: { head: 'jessebeanie', face: 'glasses' } });
    expect(h.gear).toEqual({ head: 'none', face: 'glasses', hand: 'none' });
    expect(gearWorn(h)).toEqual({ head: 'porkpie', face: 'glasses', hand: 'none' });
    expect(gearWorn(readLook('jesse', { gear: { head: 'jessebeanie' } }))).toEqual({ head: 'jessebeanie', face: 'none', hand: 'none' });
    expect(gearWorn(defaultLook('rick'))).toEqual(defaultLook('rick').gear);
  });

  it('sends Walt’s and Jesse’s looks as ids too, and never one cast’s body as another’s', () => {
    for (const who of ['walt', 'jesse']) {
      for (const b of BODIES[who]) {
        const regions = Object.keys(b.regions);
        const bb = swatchesOf(who);
        const look = readLook(who, { body: b.id, colors: Object.fromEntries(regions.map((r, i) => [r, bb[i].id])), gear: { head: b.hat ? 'none' : 'porkpie', face: 'respirator', hand: 'bluebag' } });
        expect(readLookWire(who, writeLook(look))).toEqual(look);
      }
    }
    expect(readLookWire('walt', writeLook(defaultLook('rick')))).toBeNull();
    expect(readLookWire('rick', writeLook(defaultLook('walt')))).toBeNull();
  });

  it('reads looks kept before Walt and Jesse had any as the show has them', () => {
    const l = readLooks({ rick: { body: 'cop' }, morty: { body: 'evilmorty' } });
    expect(l.rick.body).toBe('cop');
    expect(l.walt).toEqual(defaultLook('walt'));
    expect(l.jesse).toEqual(defaultLook('jesse'));
    expect(wornFiles(readLooks({ walt: { gear: { hand: 'bluebag' } } }))).toEqual([]); // (built in code)
  });

  it('starts Jesse in his beanie, which he can take off', () => {
    expect(defaultLook('jesse').gear).toEqual({ head: 'jessebeanie', face: 'none', hand: 'none' });
    expect(readLook('jesse', {}).gear.head).toBe('jessebeanie');
    expect(readLook('jesse', { gear: { head: 'none' } }).gear.head).toBe('none');
    expect(readLookWire('jesse', writeLook(readLook('jesse', { gear: { head: 'none' } }))).gear.head).toBe('none');
    // (only him: Walt, Rick and Morty start bare-headed)
    for (const who of ['walt', 'rick', 'morty']) expect(defaultLook(who).gear.head, who).toBe('none');
  });
});
