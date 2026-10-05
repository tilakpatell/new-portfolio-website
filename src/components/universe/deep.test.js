import { describe, expect, it } from 'vitest';
import { DEEP, DEEP_SOLIDS, WONDERS, beyondOf, openness, planetAt, reachOf } from './deep';
import { HOME_RADIUS, ORDER, POSITIONS, REACH } from './layout';
import { byId } from './universes';

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
    expect(ids).toContain('citadel');
    expect(ids).toContain('ember-2');
    expect(ids).not.toContain('veil');
    const ember = WONDERS.find((w) => w.id === 'ember');
    expect(DEEP_SOLIDS.find((s) => s.id === 'ember-2').at).toEqual(planetAt(ember, ember.planets[1]));
  });

  it('keeps the wonders clear of the fandoms’ planets, and stays closed round each planet', () => {
    for (const w of WONDERS) {
      for (const id of ORDER) {
        const gap = Math.hypot(w.at[0] - POSITIONS[id][0], w.at[1] - POSITIONS[id][1], w.at[2] - POSITIONS[id][2]);
        expect(gap, `${w.id} and ${id}`).toBeGreaterThan(reachOf(w) + REACH[id] + 60);
      }
    }
    for (const id of ORDER) {
      const [x, y, z] = POSITIONS[id];
      expect(openness(x + REACH[id] + 10, y, z), id).toBe(0);
      if (byId(id).kind === 'core') continue; // (the stations share the home system's space)
      // and some way out from it (whichever way is clear of the others) it's open
      const open = [0, 1, 2, 3, 4, 5, 6, 7].some((i) => openness(x + Math.cos(i * 0.785) * (REACH[id] + DEEP.near + DEEP.ramp + 1), y, z + Math.sin(i * 0.785) * (REACH[id] + DEEP.near + DEEP.ramp + 1)) === 1);
      expect(open, id).toBe(true);
    }
  });

  it('has one black hole, which swallows, with a friend’s universe on its far side', () => {
    expect(DEEP_SOLIDS.filter((s) => s.swallow).map((s) => s.id)).toEqual(['maw']);
    expect(beyondOf('maw')).toMatchObject({ name: expect.any(String), what: expect.any(String), url: expect.stringMatching(/^https:\/\/\S+$/) });
    for (const w of WONDERS) if (w.kind !== 'black-hole') expect(beyondOf(w.id), w.id).toBeNull();
    expect(beyondOf('nope')).toBeNull();
  });

  it('opens up smoothly from the home system out to open space', () => {
    expect(openness(0, 0, 0)).toBe(0);
    expect(openness(HOME_RADIUS, 0, 0)).toBe(0);
    expect(openness(HOME_RADIUS + DEEP.near, 0, 0)).toBe(0);
    // leaving home the way none of the planets lie
    const clear = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * 0.785).find((a) => openness(Math.cos(a) * (DEEP.open + 1), 0, Math.sin(a) * (DEEP.open + 1)) === 1);
    expect(clear).toBeDefined();
    const half = HOME_RADIUS + DEEP.near + DEEP.ramp / 2;
    const mid = openness(Math.cos(clear) * half, 0, Math.sin(clear) * half);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });
});
