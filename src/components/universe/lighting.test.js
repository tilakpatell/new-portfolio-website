import { describe, expect, it } from 'vitest';
import { STARS, dayYaw, daySideApproach, lightAt, sunFor, weightOf } from './lighting';
import { POSITIONS, SUN } from './layout';
import { WONDERS } from './deep';

const len = (a) => Math.hypot(...a);
const norm = (a) => a.map((v) => v / len(a));
const neg = (a) => a.map((v) => -v);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const close = (want) => ({ asymmetricMatch: (got) => got.every((v, i) => Math.abs(v - want[i]) < 1e-3), toString: () => `close to ${want}` });

describe('which star lights a point', () => {
  it('knows every star: the home sun, the suns out there, both Twins, the pulsar and the dwarf', () => {
    const ids = STARS.map((s) => s.id);
    for (const id of ['sun', 'ember', 'halcyon', 'twins', 'twins-2', 'lantern', 'graveyard']) expect(ids).toContain(id);
    expect(STARS.find((s) => s.id === 'sun').at).toEqual(SUN.at);
  });

  it('weighs a star by the square of its distance, cut softly past its reach', () => {
    const sun = STARS.find((s) => s.id === 'sun');
    expect(weightOf(sun, [200, 0, 0]) / weightOf(sun, [400, 0, 0])).toBeCloseTo(4, 3);
    expect(weightOf(sun, [sun.reach * 1.5 + 1, 0, 0])).toBe(0);
    // (never more than at its own surface)
    expect(weightOf(sun, [1, 0, 0])).toBeCloseTo(weightOf(sun, [SUN.r, 0, 0]), 9);
  });

  it('the home sun lights the home system from where it is', () => {
    const l = lightAt([200, 0, 0]);
    expect(l.key.dir).toEqual(close([1, 0, 0]));
    expect(l.key.strength).toBeCloseTo(2.35, 1);
  });

  it('Ember lights its own neighbourhood in its colour', () => {
    const ember = STARS.find((s) => s.id === 'ember');
    const l = lightAt([ember.at[0] + 300, ember.at[1], ember.at[2]]);
    expect(l.key.colour[0]).toBeGreaterThan(l.key.colour[2]); // orange
    expect(l.key.dir).toEqual(close([1, 0, 0]));
  });

  it('between stars the key turns over, never under the floor', () => {
    expect(lightAt([0, 0, -6000]).key.strength).toBeGreaterThanOrEqual(0.9);
    expect(lightAt([0, 0, 8800]).key.strength).toBeGreaterThanOrEqual(0.9);
  });

  it('has a fill opposite when there’s no second star, and a second star’s when there is', () => {
    const l = lightAt([200, 0, 0]);
    expect(dot(l.fill.dir, l.key.dir)).toBeLessThan(0.5);
    expect(l.ambient.length).toBe(3);
    const twins = STARS.filter((s) => s.id.startsWith('twins'));
    const mid = [0, 1, 2].map((i) => (twins[0].at[i] + twins[1].at[i]) / 2 + (i === 1 ? 400 : 0));
    const both = lightAt(mid);
    expect(['twins', 'twins-2']).toContain(both.key.id);
    expect(['twins', 'twins-2']).toContain(both.fill.id);
  });

  it('tints the ambient toward a nebula you’re in', () => {
    const plain = lightAt([200, 0, 0]).ambient;
    const veil = lightAt(WONDERS.find((w) => w.id === 'veil').at).ambient;
    expect(veil).not.toEqual(plain);
  });

  it('a planet’s sun is the home sun for the fandoms’ worlds near home', () => {
    const d = sunFor('middleearth');
    const p = POSITIONS.middleearth;
    expect(dot(d, norm(neg(p)))).toBeGreaterThan(0.99);
    // and every world has one, however far out
    for (const id of Object.keys(POSITIONS)) expect(len(sunFor(id))).toBeCloseTo(1, 6);
  });

  it('a nova is a star while it burns', () => {
    const l = lightAt([100, 0, 100], { nova: { at: [120, 0, 100], colour: '#ffffff', strength: 3 } });
    expect(l.key.dir).toEqual(close([-1, 0, 0]));
  });
});

describe('arriving on the day side', () => {
  it('turns the map so a world’s sun is behind the camera (which looks from +z)', () => {
    for (const s of [[1, 0, 0], [0, 0, -1], norm([-0.3, 0.2, 0.8]), sunFor('rickmorty'), sunFor('caribbean')]) {
      const y = dayYaw(s);
      // (three's turn about y: x' = x cos + z sin, z' = −x sin + z cos)
      const x = s[0] * Math.cos(y) + s[2] * Math.sin(y);
      const z = -s[0] * Math.sin(y) + s[2] * Math.cos(y);
      expect(x).toBeCloseTo(0, 9);
      expect(z).toBeGreaterThan(0);
    }
  });

  const at = [0, 0, 0];
  const sun = [1, 0, 0];
  it('from the night side, comes round to the edge of the day', () => {
    const p = daySideApproach(at, sun, 10, [-50, 0, 3]);
    expect(dot(norm(p), sun)).toBeGreaterThanOrEqual(-1e-9);
    expect(len(p)).toBeCloseTo(22, 6);
  });
  it('from the day side, keeps the way it came', () => {
    const p = daySideApproach(at, sun, 10, [30, 0, 40]);
    expect(norm(p)).toEqual(close(norm([30, 0, 40])));
  });
  it('straight from behind, still somewhere on the day side', () => {
    const p = daySideApproach(at, sun, 10, [-30, 0, 0]);
    expect(dot(norm(p), sun)).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('the worlds in their stars’ light', () => {
  // (the map scaled up puts the worlds thousands out from the home sun: they
  // must still be lit as brightly as the map always lit them)
  it('every world is lit at full strength, by whichever star is its own', () => {
    for (const [id, at] of Object.entries(POSITIONS)) expect(lightAt(at).key.strength, id).toBeCloseTo(2.35, 2);
  });
  it('far out past the stars the light falls toward its floor', () => {
    // (out past the main map's edge on the far side from the Rick and Morty
    // sector, layout.js: past both their suns' reaches since the spread)
    const l = lightAt([0, 0, 90000]);
    expect(l.key.strength).toBeLessThan(1.5);
    expect(l.key.strength).toBeGreaterThanOrEqual(0.9);
  });
});

