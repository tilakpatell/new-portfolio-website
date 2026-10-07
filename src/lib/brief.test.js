import { describe, expect, it } from 'vitest';
import { ASKED, BRIEFED, briefHere, briefKeyFor, sawBrief } from './brief';
import { WORLDS } from '../components/worlds/worlds';

describe('which basics a page gets', () => {
  it('gives every world on the map its own', () => {
    for (const w of WORLDS) expect(briefKeyFor(w.to), w.to).not.toBeNull();
  });

  it('shares one between the pages inside a world', () => {
    expect(briefKeyFor('/middle-earth/moria')).toBe('/middle-earth/place');
    expect(briefKeyFor('/middle-earth/shire')).toBe('/middle-earth/place');
    expect(briefKeyFor('/galaxy/hoth')).toBe('/galaxy');
    expect(briefKeyFor('/galaxy/hoth/surface')).toBe('/galaxy/surface');
    expect(briefKeyFor('/c-137/citadel')).toBe('/c-137/citadel');
  });

  it('gives none to the site’s own pages, the map or a mission briefing', () => {
    for (const p of ['/', '/home', '/universe', '/universe/marvel', '/terminal', '/projects/gameboy', '/galaxy/hoth/mission', '/nowhere']) expect(briefKeyFor(p), p).toBeNull();
  });

  it('never gives a page the basics it asks for itself by its path', () => {
    for (const key of ASKED) expect(briefKeyFor(key), key).toBeNull();
  });

  it('only names worlds it has basics for', () => {
    for (const key of BRIEFED) expect(briefKeyFor(key), key).toBe(key);
  });
});

describe('when the basics show', () => {
  it('shows them on a first arrival', () => {
    expect(briefHere('/c-137', null)).toBe(true);
    expect(briefHere('/c-137', ['/earth'])).toBe(true);
  });

  it('shows them once a world', () => {
    expect(briefHere('/c-137', ['/earth', '/c-137'])).toBe(false);
  });

  it('never shows them where there are none, or to a script', () => {
    expect(briefHere(null, null)).toBe(false);
    expect(briefHere('/c-137', null, true)).toBe(false);
  });

  it('keeps a short list of the worlds seen, the latest last and each once', () => {
    expect(sawBrief(null, '/earth')).toEqual(['/earth']);
    expect(sawBrief(['/earth', '/music'], '/earth')).toEqual(['/music', '/earth']);
    const long = Array.from({ length: 70 }, (_, i) => `/w${i}`);
    expect(sawBrief(long, '/c-137')).toHaveLength(60);
    expect(sawBrief(long, '/c-137').at(-1)).toBe('/c-137');
  });
});
