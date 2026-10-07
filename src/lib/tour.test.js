import { describe, expect, it } from 'vitest';
import { RUN_FOR, asScript, flatten, legsFor, litBox, markTour, offerHere, onLeg, placeCard, readRun, readyFor, resolveSteps, tourFor, tourInSearch, tourStatus } from './tour';

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
    for (const seen of ['offered', 'done', 'skipped']) expect(offerHere('/home', seen), seen).toBe(false);
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

describe('a script across pages', () => {
  const script = {
    id: 'demo',
    legs: [
      { id: 'a', path: '/home', ready: 'feed', stops: [{ id: 'a1' }, { id: 'a2', at: 'x', only: 'desktop' }] },
      { id: 'b', path: '/avengers', ready: 'world', only: 'touch', stops: [{ id: 'b1' }] },
      { id: 'c', path: '/universe', ready: 'map', stops: [{ id: 'c1', at: 'panel' }] },
    ],
  };

  it('keeps the legs and stops for this device', () => {
    expect(legsFor(script, { touch: false }).map((l) => l.id)).toEqual(['a', 'c']);
    expect(legsFor(script, { touch: false })[0].stops.map((s) => s.id)).toEqual(['a1', 'a2']);
    expect(legsFor(script, { touch: true }).map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(legsFor(script, { touch: true })[0].stops.map((s) => s.id)).toEqual(['a1']);
  });

  it('drops a leg left with no stops', () => {
    const only = { id: 'o', legs: [{ id: 'l', path: '/x', stops: [{ id: 's', only: () => false }] }] };
    expect(legsFor(only, { touch: false })).toEqual([]);
  });

  it('lays the stops in a row, each knowing its leg', () => {
    const flat = flatten(legsFor(script, { touch: false }));
    expect(flat.map((s) => `${s.leg}:${s.id}`)).toEqual(['0:a1', '0:a2', '1:c1']);
  });

  it('wraps one page’s stops as a script run where you are', () => {
    const s = asScript('classic', [{ id: 'hello' }], { title: 'Classic' });
    expect(s.title).toBe('Classic');
    expect(s.legs).toEqual([{ id: 'classic', path: null, ready: 'now', stops: [{ id: 'hello' }] }]);
  });

  it('knows whether the page is on a leg', () => {
    expect(onLeg({ path: '/experience' }, '/experience/aws')).toBe(true);
    expect(onLeg({ path: '/experience' }, '/experiences')).toBe(false);
    expect(onLeg({ path: '/universe' }, '/')).toBe(true);
    expect(onLeg({ path: '/universe/marvel' }, '/universe')).toBe(true);
    expect(onLeg({ path: null }, '/anywhere')).toBe(true);
  });

  describe('when a leg’s page is ready', () => {
    const probe = (over = {}) => ({ covered: false, gate: false, modal: false, has: () => true, ...over });

    it('is at once for a stop where you are', () => {
      expect(readyFor('now', probe({ covered: true, modal: true }))).toBe(true);
    });

    it('waits for the cover and any dialog', () => {
      expect(readyFor('feed', probe({ covered: true }), 'career')).toBe(false);
      expect(readyFor('map', probe({ modal: true }))).toBe(false);
    });

    it('waits for a world’s gate, then goes, 3D or light', () => {
      expect(readyFor('world', probe({ gate: true }))).toBe(false);
      expect(readyFor('world', probe({ has: () => false }))).toBe(true);
    });

    it('waits for the first stop’s target on a page, and the panel on the map', () => {
      expect(readyFor('feed', probe({ has: (n) => n === 'career' }), 'career')).toBe(true);
      expect(readyFor('feed', probe({ has: () => false }), 'career')).toBe(false);
      expect(readyFor('feed', probe({ has: () => false }))).toBe(true);
      expect(readyFor('map', probe({ has: (n) => n === 'panel' }))).toBe(true);
    });

    it('lets a leg decide for itself', () => {
      expect(readyFor((p) => p.gate, probe({ gate: true }))).toBe(true);
    });
  });
});

describe('what’s remembered', () => {
  it('reads the old string as the offer made, and the shell tour’s outcome', () => {
    expect(tourStatus(null)).toEqual({});
    expect(tourStatus('offered')).toEqual({ offered: true });
    expect(tourStatus('done')).toEqual({ offered: true, shell: 'done' });
    expect(tourStatus({ offered: true, recruiter: 'done' })).toEqual({ offered: true, recruiter: 'done' });
  });

  it('marks a mode’s outcome, keeping the others', () => {
    expect(markTour('skipped', 'recruiter', 'done')).toEqual({ offered: true, shell: 'skipped', recruiter: 'done' });
    expect(markTour(null, null, 'offered')).toEqual({ offered: true });
  });

  it('picks up a run from today, and not a broken or stale one', () => {
    const now = 1_000_000_000;
    expect(readRun({ mode: 'player', leg: 2, stop: 1, startedAt: now - 1000, path: '/avengers' }, now)).toEqual({ mode: 'player', leg: 2, stop: 1, startedAt: now - 1000, path: '/avengers' });
    expect(readRun({ mode: 'player', leg: 2, stop: 1, startedAt: now - RUN_FOR - 1 }, now)).toBe(null);
    expect(readRun({ mode: 'player', leg: -1, stop: 0, startedAt: now }, now)).toBe(null);
    expect(readRun({ leg: 0, stop: 0, startedAt: now }, now)).toBe(null);
    expect(readRun('player', now)).toBe(null);
  });

  it('reads the mode a link asks for', () => {
    expect(tourInSearch('?tour=recruiter', ['recruiter', 'player'])).toBe('recruiter');
    expect(tourInSearch('?tour=nope', ['recruiter'])).toBe(null);
    expect(tourInSearch('', ['recruiter'])).toBe(null);
  });
});
