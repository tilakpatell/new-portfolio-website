import { describe, expect, it } from 'vitest';
import { STARS, daySideApproach, lightAt, sunFor, weightOf } from './lighting';
import { ORDER, POSITIONS } from './layout';
import { WONDERS, binaryAt } from './deep';
import { byId } from './universes';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const norm = (a) => a.map((v) => v / len(a));
const neg = (a) => a.map((v) => -v);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const near = (a, b, eps = 1e-3) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('the stars', () => {
  it('are the home sun and deep space’s stars, each with a colour, a strength and a reach', () => {
    const ids = STARS.map((s) => s.id);
    expect(ids[0]).toBe('sun');
    for (const id of ['ember', 'halcyon', 'twins', 'twins-2', 'lantern', 'graveyard']) expect(ids).toContain(id);
    for (const s of STARS) {
      expect(s.colour, s.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.strength, s.id).toBeGreaterThan(0);
      expect(s.reach, s.id).toBeGreaterThan(0);
    }
  });

  it('weigh nothing past half again their reach, and most close in', () => {
    const sun = STARS[0];
    expect(weightOf(sun, [sun.reach * 1.5 + 1, 0, 0])).toBe(0);
    expect(weightOf(sun, [300, 0, 0])).toBeGreaterThan(weightOf(sun, [600, 0, 0]));
    // (no nearer than the star's own radius: inside it isn't brighter still)
    expect(weightOf(sun, [1, 0, 0])).toBe(weightOf(sun, [0.5, 0, 0]));
  });
});

describe('the light at a point', () => {
  it('the home sun lights the home system from where it is', () => {
    const l = lightAt([200, 0, 0]);
    expect(l.star).toBe('sun');
    expect(near(l.key.dir, [1, 0, 0])).toBe(true);
    expect(l.key.strength).toBeCloseTo(2.35, 1);
  });

  it('the fandoms’ worlds are in the home sun’s full light', () => {
    for (const id of ORDER.filter((i) => byId(i).kind !== 'core')) {
      const l = lightAt(POSITIONS[id]);
      expect(l.star, id).toBe('sun');
      expect(l.key.strength, id).toBeGreaterThan(2);
    }
  });

  it('Ember lights its own neighbourhood in its colour', () => {
    const ember = STARS.find((s) => s.id === 'ember');
    const l = lightAt([ember.at[0] + 200, ember.at[1], ember.at[2]]);
    expect(l.star).toBe('ember');
    expect(near(l.key.dir, [1, 0, 0])).toBe(true);
    expect(l.key.colour[0]).toBeGreaterThan(l.key.colour[2] * 1.5); // orange
    const home = lightAt([200, 0, 0]);
    expect(l.key.colour[2] / l.key.colour[0]).toBeLessThan(home.key.colour[2] / home.key.colour[0]);
  });

  it('Halcyon’s light is bluer than the home sun’s', () => {
    const h = STARS.find((s) => s.id === 'halcyon');
    const l = lightAt([h.at[0], h.at[1], h.at[2] + 300]);
    expect(l.star).toBe('halcyon');
    expect(l.key.colour[2]).toBeGreaterThan(l.key.colour[0]);
  });

  it('between stars the key turns over, never under the floor', () => {
    for (const p of [[0, 0, -6000], [0, 0, 8800], [-8000, 0, 0], [7000, 1000, 4000]]) {
      const l = lightAt(p);
      expect(l.key.strength, p.join()).toBeGreaterThanOrEqual(0.9);
      expect(len(l.key.dir)).toBeCloseTo(1, 6);
    }
  });

  it('turns over slowly on the way from home to Ember: the colour never jumps', () => {
    const ember = STARS.find((s) => s.id === 'ember');
    let last = null;
    for (let k = 0.05; k <= 0.95; k += 0.01) {
      const l = lightAt(ember.at.map((v) => v * k));
      if (last) for (let i = 0; i < 3; i++) expect(Math.abs(l.key.colour[i] - last[i])).toBeLessThan(0.06);
      last = l.key.colour;
    }
  });

  it('has a fill from a second star where there is one, else the sky’s cool fill', () => {
    const open = lightAt([200, 0, 0]);
    expect(open.fill.sky).toBe(true);
    expect(open.fill.colour[2]).toBeGreaterThan(open.fill.colour[0]); // cool
    // between the Twins both suns light you
    const w = WONDERS.find((x) => x.id === 'twins');
    const { a, b } = binaryAt(w, 0);
    const mid = a.map((v, i) => (v + b[i]) / 2);
    const l = lightAt([mid[0], mid[1] + 40, mid[2]], { now: 0 });
    expect(l.fill.sky).toBe(false);
    expect(dot(l.key.dir, l.fill.dir)).toBeLessThan(0);
  });

  it('says where its key star is, how big and what colour', () => {
    const ember = STARS.find((s) => s.id === 'ember');
    const l = lightAt([ember.at[0] + 200, ember.at[1], ember.at[2]]);
    expect(l.source).toEqual({ id: 'ember', at: ember.at, r: ember.r, colour: ember.colour });
    const w = WONDERS.find((x) => x.id === 'twins');
    const t = w.pair.period / 3;
    const { b } = binaryAt(w, t);
    expect(lightAt([b[0], b[1] + 50, b[2]], { now: t }).source.at).toEqual(b);
  });

  it('follows the Twins round as they turn', () => {
    const w = WONDERS.find((x) => x.id === 'twins');
    const t = w.pair.period / 4;
    const { a } = binaryAt(w, t);
    const p = [a[0], a[1] + 60, a[2]];
    expect(near(lightAt(p, { now: t }).key.dir, [0, 1, 0])).toBe(true);
  });

  it('a nova is a star while it burns', () => {
    const l = lightAt([100, 0, 100], { nova: { at: [120, 0, 100], colour: '#ffffff', strength: 3 } });
    expect(l.star).toBe('nova');
    expect(near(l.key.dir, [-1, 0, 0])).toBe(true);
  });

  it('tints the ambient toward a nebula you’re in', () => {
    const veil = WONDERS.find((x) => x.id === 'veil');
    const inside = lightAt(veil.at).ambient.colour;
    const out = lightAt([200, 0, 0]).ambient.colour;
    expect(near(inside, out, 0.01)).toBe(false);
  });
});

describe('a planet’s sun', () => {
  it('is the home sun for the fandoms’ worlds', () => {
    for (const id of ORDER.filter((i) => byId(i).kind !== 'core')) {
      const d = sunFor(id);
      expect(dot(d, norm(neg(POSITIONS[id]))), id).toBeGreaterThan(0.999);
    }
  });

  it('is the heaviest star where another outweighs it', () => {
    const ember = STARS.find((s) => s.id === 'ember');
    const at = [ember.at[0] + 300, ember.at[1], ember.at[2]];
    expect(near(sunFor('x', { positions: { x: at } }), [-1, 0, 0])).toBe(true);
  });
});

describe('the day side', () => {
  const at = [1000, 0, 0];
  const sun = [-1, 0, 0];
  it('arrives on the day side, nearest where you came from', () => {
    for (const from of [[2000, 0, 0], [1000, 0, 900], [1600, 300, -800], [1000, 0, -50]]) {
      const p = daySideApproach(at, sun, 10, from);
      expect(len(sub(p, at))).toBeCloseTo(22, 6);
      expect(dot(norm(sub(p, at)), sun), from.join()).toBeGreaterThanOrEqual(0);
    }
    // from the night side: round past the terminator on the side nearest,
    // a way into the day (so the planet shows more than a half moon)
    const p = daySideApproach(at, sun, 10, [1500, 0, 900]);
    const d = norm(sub(p, at));
    expect(dot(d, [0, 0, 1])).toBeGreaterThan(0.8);
    expect(dot(d, sun)).toBeCloseTo(0.5, 6);
  });

  it('keeps the direction you came from when that’s already the day side', () => {
    const from = [400, 200, 300];
    const p = daySideApproach(at, sun, 10, from, { dist: 3 });
    expect(dot(norm(sub(p, at)), norm(sub(from, at)))).toBeGreaterThan(0.9999);
  });

  it('comes in toward the sun from straight behind the planet', () => {
    const p = daySideApproach(at, sun, 10, [2000, 0, 0]);
    expect(dot(norm(sub(p, at)), sun)).toBeGreaterThanOrEqual(0);
    expect(p.every(Number.isFinite)).toBe(true);
  });
});
