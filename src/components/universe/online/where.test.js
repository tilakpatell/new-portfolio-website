import { describe, expect, it } from 'vitest';
import { UNIVERSE, cleanWhere, placeName, whereOf } from './where';

describe('whereOf', () => {
  it('keeps one place for the map, Middle-earth and the experience page', () => {
    expect(whereOf('/')).toBe(UNIVERSE);
    expect(whereOf('/universe/marvel')).toBe(UNIVERSE);
    expect(whereOf('/middle-earth/moria')).toBe('/middle-earth');
    expect(whereOf('/experience/aws')).toBe('/experience');
    expect(whereOf('/deathstar')).toBe('/deathstar');
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
    expect(placeName('/deathstar')).toBe('Death Star');
    expect(placeName('/home')).toBe('Home');
    expect(placeName('/projects/something-else')).toBe('a project');
    expect(placeName('/scranton')).toBeTruthy();
    expect(placeName(null)).toBe('somewhere');
  });
});
