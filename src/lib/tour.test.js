import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  SHELL_STOPS,
  WAIT_MS,
  compose,
  flatten,
  isLightRoute,
  litBox,
  nextIndex,
  offerHere,
  parseTourLink,
  placeCard,
  planFor,
  readProgress,
  readyFor,
  resolveSteps,
  stepState,
  stopIndexFor,
  tourFor,
  unfinished,
  waitUntil,
  writeProgress,
} from './tour';

describe('which tour a page gets', () => {
  it('gives the map the universe’s, at the front door and every place on it', () => {
    for (const p of ['/', '/universe', '/universe/marvel']) expect(tourFor(p), p).toBe('universe');
  });

  it('gives every other page the classic site’s', () => {
    for (const p of ['/home', '/experience/aws', '/projects', '/terminal', '/c-137']) expect(tourFor(p), p).toBe('classic');
  });
});

describe('the offer on a first arrival', () => {
  it('is made on the map and the feed’s pages', () => {
    for (const p of ['/', '/universe', '/universe/marvel', '/home', '/experience', '/experience/aws', '/projects', '/resume', '/contact', '/travel']) expect(offerHere(p, null), p).toBe(true);
  });

  it('is never made over a world, a project or the terminal', () => {
    for (const p of ['/c-137', '/galaxy/hoth', '/middle-earth', '/projects/gameboy', '/terminal', '/changes', '/nowhere']) expect(offerHere(p, null), p).toBe(false);
  });

  it('is made once: once it’s been offered, taken or turned down, never again', () => {
    for (const seen of ['offered', 'done', 'skipped']) expect(offerHere('/home', readProgress(seen)), seen).toBe(false);
    expect(offerHere('/home', readProgress({ offered: true, done: [] }))).toBe(false);
  });

  it('is made when nothing’s been kept, or what was kept is unreadable', () => {
    expect(offerHere('/home', readProgress(null))).toBe(true);
    expect(offerHere('/home', readProgress(undefined))).toBe(true);
  });
});

describe('the stops that show on this screen', () => {
  const steps = [{ id: 'hello' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'bye' }];

  it('keeps a stop whose target is showing, and the cards with none', () => {
    expect(resolveSteps(steps, (at) => at === 'search').map((s) => s.id)).toEqual(['hello', 'search', 'bye']);
  });

  it('swaps the nav’s stops for the menu’s on a phone', () => {
    expect(resolveSteps(steps, (at) => at === 'menu').map((s) => s.id)).toEqual(['hello', 'menu', 'bye']);
  });

  it('keeps every stop of a world’s basics, in the middle where its target isn’t showing', () => {
    const kept = resolveSteps(steps, (at) => at === 'menu', true);
    expect(kept.map((s) => s.id)).toEqual(['hello', 'search', 'menu', 'bye']);
    expect(kept.map((s) => s.at)).toEqual([undefined, undefined, 'menu', undefined]);
  });
});

describe('where the card goes', () => {
  const view = { w: 1280, h: 800 };
  const card = { w: 320, h: 200 };
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

  it('goes in the middle with nothing to point at', () => {
    expect(placeCard(null, card, view)).toEqual({ side: 'center', top: 300, left: 480 });
  });

  it('goes below a target near the top, centred under it', () => {
    const at = placeCard(rect(600, 10, 80, 40), card, view);
    expect(at.side).toBe('bottom');
    expect(at.top).toBeGreaterThan(50);
    expect(at.left).toBe(480);
  });

  it('goes above a target near the bottom', () => {
    const at = placeCard(rect(600, 740, 80, 40), card, view);
    expect(at.side).toBe('top');
    expect(at.top + card.h).toBeLessThan(740);
  });

  it('goes beside a target as tall as the page', () => {
    const at = placeCard(rect(900, 80, 360, 700), card, view);
    expect(at.side).toBe('left');
    expect(at.left + card.w).toBeLessThan(900);
  });

  it('stays on the screen beside a target in a corner', () => {
    const at = placeCard(rect(1240, 10, 36, 36), card, view);
    expect(at.left + card.w).toBeLessThanOrEqual(view.w - 16);
    expect(at.left).toBeGreaterThanOrEqual(16);
  });

  it('takes the side with the most room when none has enough, still on the screen', () => {
    const phone = { w: 390, h: 760 };
    const at = placeCard(rect(0, 150, 390, 500), card, phone);
    expect(at.side).toBe('top');
    expect(at.top).toBeGreaterThanOrEqual(16);
    expect(at.left).toBeGreaterThanOrEqual(16);
    expect(at.left + card.w).toBeLessThanOrEqual(phone.w - 16);
  });
});

describe('the lit box', () => {
  const view = { w: 390, h: 780 };

  it('stands a little off its target', () => {
    expect(litBox({ left: 100, top: 100, right: 200, bottom: 140 }, view, 6)).toEqual({ left: 94, top: 94, width: 112, height: 52 });
  });

  it('stops at the window’s edges, for a list longer than a phone’s sheet', () => {
    expect(litBox({ left: 0, top: 480, right: 390, bottom: 1100 }, view, 6)).toEqual({ left: 2, top: 474, width: 386, height: 304 });
  });

  it('is nothing for a target off the screen', () => {
    expect(litBox({ left: 0, top: 900, right: 100, bottom: 940 }, view, 6)).toBe(null);
  });
});

describe('what the tour remembers', () => {
  it('reads what older visits kept: the three words', () => {
    expect(readProgress('done')).toEqual({ offered: true, done: ['view'] });
    expect(readProgress('offered')).toEqual({ offered: true, done: [] });
    expect(readProgress('skipped')).toEqual({ offered: true, done: [] });
  });

  it('reads nothing kept as nothing, so the offer’s still made', () => {
    expect(readProgress(null)).toBeNull();
    expect(readProgress(undefined)).toBeNull();
  });

  it('reads anything else it can’t make sense of as offered, without throwing', () => {
    for (const raw of ['{not json', 42, true, [], 'gibberish', { done: 'recruiter' }, { audience: 7, done: [1, 'player'] }]) {
      const p = readProgress(raw);
      expect(p.offered, JSON.stringify(raw)).toBe(true);
      expect(Array.isArray(p.done), JSON.stringify(raw)).toBe(true);
      expect(p.done.every((d) => typeof d === 'string'), JSON.stringify(raw)).toBe(true);
    }
    expect(readProgress({ audience: 7, done: [1, 'player'] })).toEqual({ offered: true, done: ['player'] });
  });

  it('reads the new shape back as written', () => {
    const p = { offered: true, audience: 'recruiter', chapter: 'projects', stop: 'cartridges', done: ['player'] };
    expect(readProgress(p)).toEqual(p);
  });

  it('drops an audience it doesn’t know, and where it was with it', () => {
    expect(readProgress({ offered: true, audience: 'pirate', chapter: 'x', stop: 'y', done: [] })).toEqual({ offered: true, done: [] });
  });

  it('writes a stop over the last, and adds a finished tour once', () => {
    let p = writeProgress(null, { audience: 'recruiter', chapter: 'home', stop: 'github' });
    expect(p).toEqual({ offered: true, audience: 'recruiter', chapter: 'home', stop: 'github', done: [] });
    p = writeProgress(p, { done: ['recruiter'] });
    p = writeProgress(p, { done: ['recruiter', 'player'] });
    expect(p.done).toEqual(['recruiter', 'player']);
  });

  it('forgets where it was when told, keeping what was finished', () => {
    const p = writeProgress({ offered: true, audience: 'player', chapter: 'worlds', stop: 'c137', done: ['view'] }, { audience: undefined, chapter: undefined, stop: undefined });
    expect(p).toEqual({ offered: true, done: ['view'] });
  });

  it('says which tour is unfinished, and how far in', () => {
    expect(unfinished(null)).toBeNull();
    expect(unfinished({ offered: true, done: [] })).toBeNull();
    expect(unfinished({ offered: true, audience: 'player', chapter: 'worlds', done: [] })).toEqual({ audience: 'player', chapter: 'worlds' });
    expect(unfinished({ offered: true, audience: 'player', chapter: 'worlds', done: ['player'] })).toBeNull();
  });
});

describe('a link that starts a tour', () => {
  it('reads the audience, with all meaning the whole tour', () => {
    expect(parseTourLink('?tour=recruiter')).toEqual({ audience: 'recruiter' });
    expect(parseTourLink('?tour=player')).toEqual({ audience: 'player' });
    expect(parseTourLink('?tour=all&chapter=worlds')).toEqual({ audience: 'mixed', chapter: 'worlds' });
    expect(parseTourLink('?place=hoth&tour=recruiter&chapter=resume')).toEqual({ audience: 'recruiter', chapter: 'resume' });
  });

  it('ignores a link without one, or with one it doesn’t know', () => {
    for (const s of ['', '?', '?place=hoth', '?tour=', '?tour=pirate', '?tour=mixed', undefined]) expect(parseTourLink(s), String(s)).toBeNull();
  });

  it('names three audiences', () => {
    expect(AUDIENCES).toEqual(['recruiter', 'player', 'mixed']);
  });
});

describe('the pages a tour may take you to', () => {
  it('are the light pages: the feed, a project, the terminal, the log and the map', () => {
    for (const p of ['/home', '/experience', '/projects', '/projects/gameboy-emulator', '/resume', '/contact', '/travel', '/terminal', '/changes', '/universe']) expect(isLightRoute(p), p).toBe(true);
  });

  it('are never the front door, a place on the map, or a world', () => {
    for (const p of ['/', '/universe/marvel', '/experience/aws', '/galaxy', '/deathstar', '/c-137', '/dot-matrix/64', '/projects/', '/homes', '']) expect(isLightRoute(p), p).toBe(false);
  });
});

// two small audience tours, as steps.js gives them (the shell's not in them)
const fixture = () => ({
  universe: [{ id: 'hello' }, { id: 'panel', at: 'panel' }, { id: 'ships', at: 'ships' }, { id: 'view', at: 'view' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'guide', at: 'guide' }, { id: 'resume', at: 'resume' }, { id: 'done' }],
  classic: [{ id: 'hello' }, { id: 'pages', at: 'pages' }, { id: 'view', at: 'view' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'terminal', at: 'terminal' }, { id: 'guide', at: 'guide' }, { id: 'resume', at: 'resume' }, { id: 'done' }],
  recruiter: [
    { id: 'home', title: 'Home', path: '/home', stops: [{ id: 'github', at: 'home-github', todo: 'github' }, { id: 'gameboy' }] },
    { id: 'projects', title: 'Projects', path: '/projects', stops: [{ id: 'cartridges', todo: 'gameboy-emulator' }] },
    { id: 'end', title: 'That’s the tour', path: '/home', stops: [{ id: 'bye' }] },
  ],
  player: [
    { id: 'flying', title: 'Flying', path: '/universe', stops: [{ id: 'stick' }] },
    { id: 'worlds', title: 'The worlds', path: '/universe', stops: [{ id: 'c137', todo: 'c137' }, { id: 'scranton' }] },
    { id: 'end', title: 'That’s the tour', path: '/universe', stops: [{ id: 'bye' }] },
  ],
});

describe('a tour’s plan', () => {
  it('opens on the shell of the view you’re in, cut to the stops for this audience', () => {
    const tours = fixture();
    const u = planFor(tours, 'recruiter', 'universe', '/universe/marvel');
    expect(u[0].id).toBe('shell');
    expect(u[0].path).toBe('/universe');
    expect(u[0].stops.map((s) => s.id)).toEqual(tours.universe.map((s) => s.id).filter((id) => SHELL_STOPS.recruiter.includes(id)));
    expect(u[0].stops.every((s) => s.optional)).toBe(true);
    expect(u.slice(1).map((c) => c.id)).toEqual(['home', 'projects', 'end']);
    const c = planFor(tours, 'recruiter', 'classic', '/resume');
    expect(c[0].path).toBe('/resume');
    expect(c[0].stops.map((s) => s.id)).toContain('pages');
    expect(planFor(tours, 'player', 'classic', '/c-137')[0].path).toBe('/home');
  });

  it('never opens or closes on the shell’s own hello and goodbye', () => {
    for (const a of ['recruiter', 'player']) expect(SHELL_STOPS[a]).not.toContain('hello'), expect(SHELL_STOPS[a]).not.toContain('done');
  });

  it('folds two tours together by chapter number, the shell counting as one', () => {
    const tours = fixture();
    const end = { id: 'end', title: 'That’s the tour', path: '/universe', stops: [{ id: 'both' }] };
    const mixed = compose(tours, [['recruiter', 1, 3], ['player', 2, 3], 'end'], { end });
    expect(mixed.map((c) => c.id)).toEqual(['home', 'projects', 'flying', 'worlds', 'end']);
    expect(mixed.at(-1)).toBe(end);
    expect(new Set(mixed.map((c) => c.id)).size).toBe(mixed.length);
    tours.mixed = mixed;
    expect(planFor(tours, 'mixed', 'universe', '/universe').map((c) => c.id)).toEqual(['shell', 'home', 'projects', 'flying', 'worlds', 'end']);
  });

  it('says plainly when a recipe names something it hasn’t got', () => {
    expect(() => compose(fixture(), ['end'])).toThrow(/end/);
    expect(() => compose(fixture(), [['pirate', 1, 2]])).toThrow(/pirate/);
  });

  it('gives no plan for a tour that isn’t there', () => {
    expect(planFor(fixture(), 'mixed', 'universe', '/universe')).toEqual([]);
  });

  it('lays the chapters out as one run of stops, each knowing its chapter and page', () => {
    const stops = flatten(planFor(fixture(), 'recruiter', 'classic', '/home'));
    expect(stops.at(-1)).toMatchObject({ id: 'bye', chapter: 'end', path: '/home' });
    const github = stops.find((s) => s.id === 'github');
    expect(github).toMatchObject({ chapter: 'home', path: '/home', at: 'home-github' });
    expect(github.chapterTitle).toBe('Home');
    expect(new Set(stops.map((s) => s.key)).size).toBe(stops.length);
  });

  it('steps on and back within the run', () => {
    const stops = [1, 2, 3];
    expect(nextIndex(stops, 0, 1)).toBe(1);
    expect(nextIndex(stops, 2, 1)).toBe(2);
    expect(nextIndex(stops, 0, -1)).toBe(0);
    expect(nextIndex(stops, 2, -1)).toBe(1);
  });

  it('finds where a link, a chapter or a thing to do starts it', () => {
    const stops = flatten(planFor(fixture(), 'recruiter', 'classic', '/home'));
    const at = (id) => stops.findIndex((s) => s.id === id);
    expect(stopIndexFor(stops, {})).toBe(0);
    expect(stopIndexFor(stops, { chapter: 'projects' })).toBe(at('cartridges'));
    expect(stopIndexFor(stops, { chapter: 'home', stop: 'gameboy' })).toBe(at('gameboy'));
    expect(stopIndexFor(stops, { stop: 'gameboy' })).toBe(at('gameboy'));
    expect(stopIndexFor(stops, { todo: 'gameboy-emulator' })).toBe(at('cartridges'));
    expect(stopIndexFor(stops, { chapter: 'nowhere' })).toBe(-1);
    expect(stopIndexFor(stops, { todo: 'nothing' })).toBe(-1);
    expect(stopIndexFor(stops, { chapter: 'home', stop: 'cartridges' })).toBe(-1);
  });
});

describe('when a stop is ready to show', () => {
  const page = (o = {}) => ({ busy: () => false, rendered: () => true, hasTarget: () => true, ...o });

  it('is ready when nothing covers the page, it’s drawn, and its target is there', () => {
    expect(readyFor({ at: 'x' }, page())).toBe(true);
    expect(readyFor({ at: 'x' }, page({ busy: () => true }))).toBe(false);
    expect(readyFor({ at: 'x' }, page({ rendered: () => false }))).toBe(false);
    expect(readyFor({ at: 'x' }, page({ hasTarget: () => false }))).toBe(false);
  });

  it('doesn’t look for a target a stop hasn’t got', () => {
    const hasTarget = () => {
      throw new Error('asked');
    };
    expect(readyFor({}, page({ hasTarget }))).toBe(true);
  });

  it('waits, then shows the card in the middle after eight seconds; skips a shell stop not on this screen', () => {
    expect(WAIT_MS).toBe(8000);
    const gone = page({ hasTarget: () => false });
    expect(stepState({ at: 'x' }, gone, 100)).toBe('wait');
    expect(stepState({ at: 'x' }, gone, WAIT_MS)).toBe('timeout');
    expect(stepState({ at: 'x', optional: true }, gone, 100)).toBe('wait');
    expect(stepState({ at: 'x', optional: true }, gone, 1500)).toBe('skip');
    expect(stepState({ at: 'x', optional: true }, page({ busy: () => true, hasTarget: () => false }), 5000)).toBe('wait');
    expect(stepState({ at: 'x' }, page(), 0)).toBe('ready');
  });

  it('resolves on the tick that passes, or times out, with no real clock', async () => {
    let t = 0;
    let ticks = 0;
    const timers = { now: () => t, tick: (fn) => (t += 100, ticks++, Promise.resolve().then(fn)) };
    let n = 0;
    await expect(waitUntil(() => (++n >= 3 ? 'ready' : null), timers)).resolves.toBe('ready');
    expect(n).toBe(3);
    t = 0;
    ticks = 0;
    await expect(waitUntil(() => null, { ...timers, timeout: 1000 })).resolves.toBe('timeout');
    expect(ticks).toBe(10);
  });

  it('stops waiting when told to', async () => {
    let t = 0;
    const ctl = { cancelled: false };
    const timers = { now: () => t, tick: (fn) => ((t += 100), (ctl.cancelled = t >= 300), Promise.resolve().then(fn)) };
    await expect(waitUntil(() => null, { ...timers, cancelled: () => ctl.cancelled })).resolves.toBe('cancelled');
  });
});
