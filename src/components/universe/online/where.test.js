import { describe, expect, it } from 'vitest';
import { UNIVERSE, cleanWhere, isFlight, placeName, whereOf } from './where';

describe('whereOf', () => {
  it('keeps one place for the map, Middle-earth and the experience page', () => {
    expect(whereOf('/')).toBe(UNIVERSE);
    expect(whereOf('/universe/marvel')).toBe(UNIVERSE);
    expect(whereOf('/middle-earth/moria')).toBe('/middle-earth');
    expect(whereOf('/experience/aws')).toBe('/experience');
    expect(whereOf('/deathstar')).toBe('/deathstar');
  });
  it('keeps each of the galaxy\'s systems a place of its own', () => {
    expect(whereOf('/galaxy/hoth')).toBe('/galaxy/hoth');
    expect(whereOf('/galaxy')).toBe('/galaxy');
  });
});

describe('isFlight', () => {
  it('is the universe map and the galaxy\'s systems, not the pages', () => {
    expect(isFlight(UNIVERSE)).toBe(true);
    expect(isFlight('/galaxy')).toBe(true);
    expect(isFlight('/galaxy/endor')).toBe(true);
    expect(isFlight('/galaxy/endor/mission')).toBe(false);
    expect(isFlight('/deathstar')).toBe(false);
    expect(isFlight(null)).toBe(false);
  });
});

describe('cleanWhere', () => {
  it('takes a page key and nothing else', () => {
    expect(cleanWhere('/c-137')).toBe('/c-137');
    expect(cleanWhere('/projects/gameboy-emulator')).toBe('/projects/gameboy-emulator');
    expect(cleanWhere('javascript:alert(1)')).toBeNull();
    expect(cleanWhere('/<b>')).toBeNull();
    expect(cleanWhere('/' + 'a'.repeat(80))).toBeNull();
    expect(cleanWhere(7)).toBeNull();
  });
});

describe('placeName', () => {
  it('names the worlds and pages', () => {
    expect(placeName(UNIVERSE)).toBe('the universe');
    expect(placeName('/middle-earth')).toBe('Middle-earth');
    expect(placeName('/deathstar')).toBe('the Death Star');
    expect(placeName('/home')).toBe('Home');
    expect(placeName('/projects/something-else')).toBe('a project');
    expect(placeName('/scranton')).toBeTruthy();
    expect(placeName(null)).toBe('somewhere');
    expect(placeName('/galaxy')).toBe('a galaxy far, far away');
    expect(placeName('/galaxy/ahchto')).toBe('Ahch-To');
    expect(placeName('/galaxy/hoth/mission')).toBe('the Hoth briefing');
    expect(placeName('/galaxy/hoth/surface')).toBe('down on Hoth');
    expect(placeName('/galaxy/nowhere')).toBe('Galaxy');
  });
});
