import { describe, expect, it } from 'vitest';
import { VISITED_CAP, VISITED_KEY, addVisited, hasVisited } from './visited';

describe('the pages the site has shown you', () => {
  it('keeps its list under its own key', () => {
    expect(VISITED_KEY).toBe('tp-visited-ever');
  });

  it('adds a page once, however often it’s seen', () => {
    let list = addVisited([], '/home');
    list = addVisited(list, '/projects');
    list = addVisited(list, '/home');
    expect(list).toEqual(['/projects', '/home']);
  });

  it('writes a page one way: no trailing slash, no search', () => {
    expect(addVisited([], '/projects/gameboy-emulator/')).toEqual(['/projects/gameboy-emulator']);
    expect(addVisited([], '/travel?place=hoi-an')).toEqual(['/travel']);
    expect(addVisited([], '/')).toEqual(['/']);
  });

  it('starts again from nothing kept, or something unreadable', () => {
    for (const bad of [null, undefined, 'x', 7, { a: 1 }]) expect(addVisited(bad, '/home')).toEqual(['/home']);
    expect(addVisited(['/home', 3, null], '/contact')).toEqual(['/home', '/contact']);
  });

  it('ignores a page it can’t name', () => {
    for (const bad of ['', null, undefined, 'home']) expect(addVisited(['/home'], bad)).toEqual(['/home']);
  });

  it('keeps the newest when it’s full', () => {
    let list = [];
    for (let n = 0; n < VISITED_CAP + 20; n++) list = addVisited(list, `/universe/p${n}`);
    expect(list).toHaveLength(VISITED_CAP);
    expect(list[0]).toBe('/universe/p20');
    expect(list.at(-1)).toBe(`/universe/p${VISITED_CAP + 19}`);
  });

  it('counts a page as seen when you were on it, or deeper in it', () => {
    const list = ['/experience/aws', '/galaxy/hoth/surface', '/home'];
    expect(hasVisited(list, '/home')).toBe(true);
    expect(hasVisited(list, '/experience')).toBe(true);
    expect(hasVisited(list, '/galaxy')).toBe(true);
    expect(hasVisited(list, '/galaxy/hoth')).toBe(true);
    expect(hasVisited(list, '/gal')).toBe(false);
    expect(hasVisited(list, '/contact')).toBe(false);
    expect(hasVisited(null, '/home')).toBe(false);
  });
});
