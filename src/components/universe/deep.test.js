import { describe, expect, it } from 'vitest';
import { DEEP, DEEP_SOLIDS, STARS, WONDERS, beyondOf, nearestStar, openness, parseWonder, planetAt, reachOf, wonderById } from './deep';
import { GOALS } from './ship';
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

  it('makes the Citadel solid out to its domes and down its crystal, not in the space between', () => {
    const w = WONDERS.find((x) => x.id === 'citadel');
    const k = w.r / 18; // (deepspace.js draws it for a radius of 18)
    const at = (x, y, z) => [w.at[0] + x * k, w.at[1] + y * k, w.at[2] + z * k];
    const solidAt = (p) => DEEP_SOLIDS.some((o) => Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) < o.r);
    // the four domes out on its arms, and the crystal's tip
    for (const [x, y, z] of [
      [21.3, -2.2, 5.4],
      [-7.4, 6.2, 17.5],
      [-22, -3, -6.8],
      [2.7, 0.9, -17.8],
      [0.3, -33, 0.2],
    ])
      expect(solidAt(at(x, y, z)), `${x},${y},${z}`).toBe(true);
    // between its arms, out past the great dome: open space
    for (const [x, y, z] of [
      [17, 0, -17],
      [-17, 0, 17],
      [12, -24, 12],
    ])
      expect(solidAt(at(x, y, z)), `${x},${y},${z}`).toBe(false);
    // and crashing into any of it is crashing into the Citadel
    const parts = DEEP_SOLIDS.filter((o) => o.id.startsWith('citadel-'));
    expect(parts.length).toBeGreaterThan(4);
    for (const o of parts) {
      expect(o.id.split('-')[0]).toBe('citadel');
      expect(o.part).toBe(true);
      // and not somewhere to fly to: the autopilot takes you to the Citadel
      expect(GOALS[o.id]).toBeUndefined();
    }
    expect(GOALS.citadel).toBeTruthy();
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

  it('has a pulsar, a binary star, a rogue planet and a wreck field among its wonders, each solid its own way', () => {
    const ids = WONDERS.map((w) => w.id);
    for (const id of ['lantern', 'twins', 'wanderer', 'graveyard']) expect(ids).toContain(id);
    const solids = Object.fromEntries(DEEP_SOLIDS.map((s) => [s.id, s]));
    // nobody flies anywhere near a pulsar: solid out to ten radii
    expect(solids.lantern.r).toBe(wonderById('lantern').r * 10);
    // two suns: two solids, the first the place itself, the second a part of it (hitting either is hitting the Twins)
    expect(solids.twins).toBeTruthy();
    expect(solids['twins-2']).toBeTruthy();
    expect(solids['twins-2'].part).toBe(true);
    expect(Math.hypot(...[0, 1, 2].map((i) => solids['twins-2'].at[i] - solids.twins.at[i]))).toBe(wonderById('twins').pair.apart);
    expect(reachOf(wonderById('twins'))).toBe(wonderById('twins').pair.apart + wonderById('twins').pair.r);
    // a rogue planet with a ring reaches like any ringed world; the wreck field's hulls are a sight, not solid
    expect(reachOf(wonderById('wanderer'))).toBe(wonderById('wanderer').r * 2.3);
    expect(reachOf(wonderById('graveyard'))).toBe(wonderById('graveyard').field);
    expect(DEEP_SOLIDS.filter((s) => s.id.startsWith('graveyard'))).toHaveLength(1);
    // and none of them is a star a flare comes from
    expect(STARS.map((s) => s.id)).toEqual(['sun', 'ember', 'halcyon']);
  });

  it('reads a wonder from a link, and nothing else', () => {
    expect(parseWonder('aurelia')).toBe('aurelia');
    expect(parseWonder('lantern')).toBe('lantern');
    for (const bad of ['marvel', 'home', 'AURELIA', '__proto__', 'constructor', '', null, undefined, 3]) expect(parseWonder(bad)).toBeNull();
  });

  it('knows its stars, and which is nearest', () => {
    expect(STARS.map((s) => s.id)).toEqual(['sun', 'ember', 'halcyon']);
    expect(nearestStar(10, 0, 0).star.id).toBe('sun');
    const ember = WONDERS.find((w) => w.id === 'ember');
    expect(nearestStar(ember.at[0] + 200, ember.at[1], ember.at[2]).star.id).toBe('ember');
    expect(nearestStar(ember.at[0] + 200, ember.at[1], ember.at[2]).dist).toBeCloseTo(200, 3);
  });
});
