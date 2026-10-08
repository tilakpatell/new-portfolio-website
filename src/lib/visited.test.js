import { describe, expect, it } from 'vitest';
import { SHELL_KEYS, VISITED_CAP, VISITED_KEY, addVisited, hasVisited, storedKey } from './visited';

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

describe('what a shell key holds', () => {
  const stub = (local, session) => {
    const store = (m) => ({
      getItem: (k) => (k in m ? m[k] : null),
    });
    globalThis.window = { localStorage: store(local), sessionStorage: store(session) };
  };

  it('reads kept-across-visits first, then this visit’s', () => {
    stub({ 'tp-eggs': '["reactor"]' }, { 'tp-eggs': '["other"]', 'tp-theme-pin': '"jedi"' });
    expect(storedKey('tp-eggs')).toEqual(['reactor']);
    expect(storedKey('tp-theme-pin')).toBe('jedi');
    expect(storedKey('tp-sound')).toBeNull();
  });

  it('gives back a value that isn’t JSON as it is, and nothing when storage is out of reach', () => {
    stub({ 'tp-mode': 'dark' }, {});
    expect(storedKey('tp-mode')).toBe('dark');
    globalThis.window = {
      get localStorage() {
        throw new Error('denied');
      },
      get sessionStorage() {
        throw new Error('denied');
      },
    };
    expect(storedKey('tp-mode')).toBeNull();
    delete globalThis.window;
  });

  it('names only keys the shell writes', () => {
    for (const k of SHELL_KEYS) expect(k).toMatch(/^tp-[a-z-]+$/);
    expect(SHELL_KEYS).not.toContain('tp-tour');
  });
});
