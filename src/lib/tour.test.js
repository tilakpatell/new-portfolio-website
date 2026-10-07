import { describe, expect, it } from 'vitest';
import { litBox, offerHere, placeCard, resolveSteps, tourFor } from './tour';

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
