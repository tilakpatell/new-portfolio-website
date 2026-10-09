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
    expect(h(-360, -280)).toBeLessThan(-2);
    expect(h(-360, -280)).toBeGreaterThan(-3.5);
    expect(h(-320, -230)).toBeGreaterThan(0.2);
  });

  it('the shore’s strip ends short of Padmé’s island, which stays an island', () => {
    const site = siteOf('naboo');
    const h = heightFor(site);
    const island = [300, 420];
    expect(h(...island)).toBeGreaterThan(2);
    // the strip's pad nearest the island, and its edge on the island's side
    const strip = site.ground.flats.filter((f) => f.h === 1.5 && f.r === 12);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const pad = strip.reduce((a, b) => (dist(b.at, island) < dist(a.at, island) ? b : a));
    const d = dist(pad.at, island);
    const toward = [(island[0] - pad.at[0]) / d, (island[1] - pad.at[1]) / d];
    const edge = [pad.at[0] + toward[0] * pad.r, pad.at[1] + toward[1] * pad.r];
    // the island's shore, walking out from its middle toward that edge
    let s = 0;
    while (h(island[0] - toward[0] * s, island[1] - toward[1] * s) > 0) s += 0.5;
    const shore = [island[0] - toward[0] * s, island[1] - toward[1] * s];
    expect(dist(edge, shore)).toBeGreaterThan(40);
    expect(h((edge[0] + shore[0]) / 2, (edge[1] + shore[1]) / 2)).toBeLessThan(-3);
  });

  it('the air is the foliage design’s', () => {
    const s = siteOf('naboo');
    expect(s.sky.zenith).toBe('#79a2c9');
    expect(s.sky.hazeColor).toBe('#8ca5b2');
    expect(s.ground.wind).toBe(0.5);
    expect(s.water.color).toBe('#2c3d3e');
  });
});
