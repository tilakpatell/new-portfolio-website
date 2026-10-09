import { describe, expect, it } from 'vitest';
import { SITE, SITES as naboo } from './naboo';
import { SITES as core } from './core';
import { SITES } from '.';

describe('Naboo’s site, in a file of its own', () => {
  it('is the site the galaxy lands on', () => {
    expect(naboo).toEqual({ naboo: SITE });
    expect(SITES.naboo).toBe(SITE);
    expect(SITE.place).toBe('The Great Grass Plains');
  });

  it('has left the core worlds’ file, and comes before them', () => {
    expect(Object.keys(core)).toEqual(['kamino', 'geonosis']);
    const ids = Object.keys(SITES);
    expect(ids.slice(ids.indexOf('yavin'), ids.indexOf('coruscant') + 1)).toEqual(['yavin', 'naboo', 'kamino', 'geonosis', 'coruscant']);
  });
});
