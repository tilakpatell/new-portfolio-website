import { describe, expect, it } from 'vitest';
import { SITE, SITES as naboo } from './naboo';
import { SITES as core } from './core';
import { SITES, siteOf } from '.';
import { heightFor } from './validity';

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

describe('Naboo’s land and air', () => {
  it('the gorge: the plain at the falls’ foot is 22 m under the plateau’s edge and the pool is above the sea', () => {
    const site = siteOf('naboo');
    const h = heightFor(site);
    expect(h(-130, 300) - h(-100, 310)).toBeGreaterThan(18);
    expect(h(-100, 310)).toBeGreaterThan(-24);
    expect(h(-100, 310)).toBeLessThan(-18);
  });

  it('the swamp holds water and the sacred place stays dry', () => {
    const site = siteOf('naboo');
    const h = heightFor(site);
    expect(h(-360, -280)).toBeLessThan(-1.5);
    expect(h(-320, -230)).toBeGreaterThan(0.2);
  });

  it('the air is the foliage design’s', () => {
    const s = siteOf('naboo');
    expect(s.sky.zenith).toBe('#79a2c9');
    expect(s.sky.hazeColor).toBe('#8ca5b2');
    expect(s.ground.wind).toBe(0.5);
    expect(s.water.color).toBe('#2c3d3e');
  });
});
