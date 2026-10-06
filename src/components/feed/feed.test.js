import { describe, expect, it } from 'vitest';
import { FEED, byId, categoryAt, feedFrom, feedState, isFeedMove, nextOf, placeOf } from './feed';

describe('the feed order', () => {
  it('is the six portfolio pages, home first and contact last', () => {
    expect(FEED.map((c) => c.id)).toEqual(['home', 'experience', 'projects', 'resume', 'travel', 'contact']);
    for (const c of FEED) {
      expect(c.to).toBe(`/${c.id}`);
      expect(c.label).toBeTruthy();
      expect(c.blurb).toBeTruthy();
    }
  });

  it('wraps from contact round to home', () => {
    expect(nextOf('home').id).toBe('experience');
    expect(nextOf('contact').id).toBe('home');
    expect(nextOf('nowhere')).toBeNull();
  });

  it('runs the whole feed from any entry, each category once', () => {
    expect(feedFrom('travel').map((c) => c.id)).toEqual(['travel', 'contact', 'home', 'experience', 'projects', 'resume']);
    expect(feedFrom('home').map((c) => c.id)).toEqual(FEED.map((c) => c.id));
    expect(feedFrom('nowhere')).toEqual([]);
  });

  it('numbers each page from the entry', () => {
    expect(placeOf('travel', 'travel')).toBe(1);
    expect(placeOf('travel', 'resume')).toBe(6);
    expect(placeOf('home', 'contact')).toBe(6);
  });

  it('finds a category by id', () => {
    expect(byId('resume').label).toBe('Résumé');
    expect(byId('universe')).toBeNull();
  });
});

describe('which category a path belongs to', () => {
  it('matches each page exactly, with or without a trailing slash', () => {
    for (const c of FEED) {
      expect(categoryAt(c.to)?.id).toBe(c.id);
      expect(categoryAt(`${c.to}/`)?.id).toBe(c.id);
    }
  });

  it('keeps a role on the experience page in the experience page', () => {
    expect(categoryAt('/experience/aws')?.id).toBe('experience');
    expect(categoryAt('/experience/aws/')?.id).toBe('experience');
    expect(categoryAt('/experience/aws/more')).toBeNull();
  });

  it("leaves a project's own page out", () => {
    expect(categoryAt('/projects/gameboy-emulator')).toBeNull();
  });

  it('ignores search and hash', () => {
    expect(categoryAt('/resume?view=pdf')?.id).toBe('resume');
    expect(categoryAt('/travel?place=is#globe')?.id).toBe('travel');
  });

  it('is null for everything else', () => {
    for (const p of ['/', '/universe', '/universe/marvel', '/galaxy', '/terminal', '/deathstar', '/homes', '', undefined]) expect(categoryAt(p)).toBeNull();
  });
});

describe('telling the feed’s own moves apart', () => {
  it('is a replace that carries the feed state', () => {
    expect(isFeedMove({ state: feedState }, 'REPLACE')).toBe(true);
    expect(isFeedMove({ state: { feed: true } }, 'REPLACE')).toBe(true);
  });

  it('is not a push, a pop, or a replace without it', () => {
    expect(isFeedMove({ state: feedState }, 'PUSH')).toBe(false);
    expect(isFeedMove({ state: feedState }, 'POP')).toBe(false);
    expect(isFeedMove({ state: null }, 'REPLACE')).toBe(false);
    expect(isFeedMove({}, 'REPLACE')).toBe(false);
    expect(isFeedMove(null, 'REPLACE')).toBe(false);
  });
});
