import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES } from '../components/guide/routes';
import { THING_AUDIENCES, THINGS_TO_DO, isDone, todoFor } from './todo';

const src = join(import.meta.dirname, '..');

// The routes App.jsx declares, as regexes: `:param` is one segment, `:param?`
// one or none. Read as text, so the test needn't load React and every page.
const routes = () =>
  [...readFileSync(join(src, 'App.jsx'), 'utf8').matchAll(/<Route path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => p !== '*')
    .map((p) => new RegExp(`^${p.replace(/\/:[^/]+\?/g, '(?:/[^/]+)?').replace(/:[^/]+/g, '[^/]+')}$`));

// The achievement ids, read from the map's text: Achievements.jsx brings
// React, the theme and the universe's outfitting with it.
const achievementIds = () => {
  const text = readFileSync(join(src, 'components', 'Achievements.jsx'), 'utf8');
  const map = text.slice(text.indexOf('export const ACHIEVEMENTS = {'), text.indexOf('\n};', text.indexOf('export const ACHIEVEMENTS = {')));
  return new Set([...map.matchAll(/^ {2}(?:'([\w-]+)'|(\w+)): \{ name:/gm)].map((m) => m[1] ?? m[2]));
};

const KINDS = ['page', 'section', 'world', 'game', 'mission', 'mini-game', 'multiplayer', 'easter-egg', 'tool'];

describe('the things to do', () => {
  it('has about sixty, each with an id of its own', () => {
    expect(THINGS_TO_DO.length).toBeGreaterThanOrEqual(50);
    expect(THINGS_TO_DO.length).toBeLessThanOrEqual(75);
    expect(new Set(THINGS_TO_DO.map((t) => t.id)).size).toBe(THINGS_TO_DO.length);
  });

  it('goes somewhere the site has a route for', () => {
    const rs = routes();
    expect(rs.length).toBeGreaterThan(20);
    for (const t of THINGS_TO_DO) {
      const path = t.to.split(/[?#]/)[0];
      expect(rs.some((r) => r.test(path)), `${t.id}: ${t.to}`).toBe(true);
    }
  });

  it('groups under one of the guide’s pages', () => {
    for (const t of THINGS_TO_DO) expect(GUIDES[t.area], `${t.id}: ${t.area}`).toBeTruthy();
  });

  it('is ticked by a real achievement or a route', () => {
    const ids = achievementIds();
    expect(ids.size).toBeGreaterThan(200);
    const rs = routes();
    for (const t of THINGS_TO_DO) {
      const keys = Object.keys(t.done);
      expect(keys.length, t.id).toBe(1);
      if (t.done.achievement) expect(ids.has(t.done.achievement), `${t.id}: ${t.done.achievement}`).toBe(true);
      else for (const v of [].concat(t.done.visited)) expect(rs.some((r) => r.test(v)), `${t.id}: ${v}`).toBe(true);
    }
  });

  it('says who it’s for, what it is, how long it takes and whether a phone will do', () => {
    for (const t of THINGS_TO_DO) {
      expect(THING_AUDIENCES, t.id).toContain(t.audience);
      expect(KINDS, t.id).toContain(t.kind);
      expect(typeof t.seconds === 'number' && t.seconds > 0, t.id).toBe(true);
      expect(typeof t.phone, t.id).toBe('boolean');
      expect(t.title, t.id).toBeTruthy();
    }
  });

  it('keeps its copy short and its quotes curly', () => {
    for (const t of THINGS_TO_DO) {
      expect(t.blurb.length, t.id).toBeLessThan(140);
      for (const s of [t.title, t.blurb]) expect(s, t.id).not.toMatch(/['"]/);
    }
  });
});

describe('todoFor', () => {
  it('leaves the games out for a recruiter and the work out for a player', () => {
    const hire = todoFor('recruiter');
    expect(hire.length).toBeGreaterThan(10);
    expect(hire.every((t) => t.audience !== 'player')).toBe(true);
    expect(todoFor('player').every((t) => t.audience !== 'recruiter')).toBe(true);
  });

  it('gives everything to a mixed audience, or one it doesn’t know', () => {
    expect(todoFor('mixed')).toEqual(THINGS_TO_DO);
    expect(todoFor('nobody')).toEqual(THINGS_TO_DO);
  });
});

describe('isDone', () => {
  const ach = { done: { achievement: 'deathstar' } };
  const page = { done: { visited: '/projects/gameboy-emulator' } };
  const section = { done: { visited: '/experience' } };

  it('ticks an achievement row once it is unlocked', () => {
    expect(isDone(ach, { unlocked: ['deathstar'] })).toBe(true);
    expect(isDone(ach, { unlocked: ['trench'], visited: ['/deathstar'] })).toBe(false);
  });

  it('ticks a visited row on the path itself or deeper, not a sibling', () => {
    expect(isDone(page, { visited: ['/projects/gameboy-emulator'] })).toBe(true);
    expect(isDone(section, { visited: ['/experience/aws'] })).toBe(true);
    expect(isDone(section, { visited: ['/experiences'] })).toBe(false);
    expect(isDone(page, { visited: ['/projects'] })).toBe(false);
  });

  it('ticks a row with several pages once every one has been seen', () => {
    const both = { done: { visited: ['/home', '/universe'] } };
    expect(isDone(both, { visited: ['/universe/marvel'] })).toBe(false);
    expect(isDone(both, { visited: ['/universe/marvel', '/home'] })).toBe(true);
  });

  it('ticks nothing from what it can’t read, without throwing', () => {
    for (const visited of [null, 'x', 7, [null, 3]]) expect(isDone(page, { visited }), String(visited)).toBe(false);
    expect(isDone(ach, { unlocked: null })).toBe(false);
  });

  it('ticks nothing with nothing done', () => {
    expect(isDone(ach, {})).toBe(false);
    expect(isDone(page, {})).toBe(false);
  });
});
