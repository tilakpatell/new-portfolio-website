import { describe, expect, it } from 'vitest';
import { DEEP, DEEP_SOLIDS, WONDERS, openness, planetAt, reachOf } from './deep';
import { MAP_RADIUS } from './layout';

describe('deep space', () => {
  it('puts every wonder well out past the home system and inside the edge, within the ceiling', () => {
    for (const w of WONDERS) {
      const r = Math.hypot(w.at[0], w.at[2]);
      expect(r - reachOf(w), w.id).toBeGreaterThan(DEEP.open + 40);
      expect(r + reachOf(w), w.id).toBeLessThan(DEEP.edge - 20);
      expect(Math.abs(w.at[1]) + (w.kind === 'nebula' ? 0 : w.r), w.id).toBeLessThan(DEEP.ceiling); // (a nebula's middle: it's thin at its edges)
    }
  });

  it('keeps the wonders clear of each other', () => {
    for (const a of WONDERS) {
      for (const b of WONDERS) {
        if (a.id >= b.id) continue;
        const gap = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]);
        expect(gap, `${a.id} and ${b.id}`).toBeGreaterThan(reachOf(a) + reachOf(b) + 30);
      }
    }
  });

  it('makes everything but the nebulae solid, a sun with its planets', () => {
    const ids = DEEP_SOLIDS.map((s) => s.id);
    expect(ids).toContain('aurelia');
    expect(ids).toContain('deathstar');
    expect(ids).toContain('ember-2');
    expect(ids).not.toContain('veil');
    const ember = WONDERS.find((w) => w.id === 'ember');
    expect(DEEP_SOLIDS.find((s) => s.id === 'ember-2').at).toEqual(planetAt(ember, ember.planets[1]));
  });

  it('opens up smoothly from the home system out to open space', () => {
    expect(openness(0, 0)).toBe(0);
    expect(openness(MAP_RADIUS, 0)).toBe(0);
    expect(openness(DEEP.open + 1, 0)).toBe(1);
    const mid = openness((DEEP.system + DEEP.open) / 2, 0);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });
});
