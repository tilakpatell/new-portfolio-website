import { describe, expect, it } from 'vitest';
import { SKY, STREAKS, createSkyTraffic, laneLinks, streakAt } from './skyTraffic';
import { SYSTEMS, courseTo, systemById } from './systems';
import { routeBetween } from './routes';

const seeded = (seed = 5) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe('laneLinks', () => {
  it('joins a system on the lanes to every system the lanes take it to, along the course to each', () => {
    const links = laneLinks('tatooine');
    expect(links.map((l) => l.id)).toContain('coruscant');
    expect(links.map((l) => l.id)).not.toContain('tatooine');
    for (const l of links) {
      expect(routeBetween('tatooine', l.id).onLane, l.id).toBe(true);
      expect(l.dir).toEqual(courseTo(systemById('tatooine'), systemById(l.id)));
      expect(len(l.dir)).toBeCloseTo(1, 9);
    }
    // and every one the lanes do take it to
    const want = SYSTEMS.filter((o) => o.id !== 'tatooine' && routeBetween('tatooine', o.id).onLane).map((o) => o.id);
    expect(links.map((l) => l.id).sort()).toEqual(want.sort());
  });
  it('leaves a backwater off the lanes quiet: no traffic at all', () => {
    for (const id of ['dagobah', 'kamino', 'endor', 'lothal', 'scarif']) {
      expect(routeBetween(id, 'coruscant').onLane, id).toBe(false);
      expect(laneLinks(id), id).toEqual([]);
    }
    expect(laneLinks('jakku')).toEqual([]); // (nowhere it knows)
  });
  it('has Coruscant, where the great lanes start, as busy as anywhere', () => {
    const most = Math.max(...SYSTEMS.map((s) => laneLinks(s.id).length));
    expect(laneLinks('coruscant').length).toBe(most);
  });
});

describe('createSkyTraffic', () => {
  const links = laneLinks('coruscant');

  it('keeps three to six ships streaking at a time, over a long run', () => {
    const sky = createSkyTraffic({ links, rand: seeded() });
    const seen = new Set();
    let total = 0;
    for (let i = 0; i < 60 * 120; i++) {
      const live = sky.update(i % 97 === 0 ? 0.4 : 1 / 60); // (a slow frame now and then)
      expect(live.length).toBeGreaterThanOrEqual(STREAKS.min);
      expect(live.length).toBeLessThanOrEqual(STREAKS.max);
      for (const s of live) {
        expect(s.k).toBeGreaterThanOrEqual(0);
        expect(s.k).toBeLessThan(1);
        expect(['leave', 'arrive']).toContain(s.kind);
        expect(links.some((l) => l.dir === s.dir)).toBe(true);
        seen.add(s.kind);
      }
      total += live.length;
    }
    expect(seen.size).toBe(2); // both ways
    // and not just the least the whole time
    expect(total / (60 * 120)).toBeGreaterThan(STREAKS.min + 0.5);
  });
  it('lives each ship STREAKS.life seconds (2.5)', () => {
    expect(STREAKS).toEqual({ min: 3, max: 6, life: 2.5 });
    const sky = createSkyTraffic({ links, rand: seeded(11) });
    sky.update(0);
    const born = new Map();
    const gone = [];
    let t = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const live = sky.update(1 / 60);
      t += 1 / 60;
      const now = new Set(live);
      for (const s of live) if (!born.has(s) && s.k < 0.01) born.set(s, t - s.k * STREAKS.life);
      for (const [s, at] of born) if (!now.has(s)) (gone.push(t - at), born.delete(s));
    }
    expect(gone.length).toBeGreaterThan(20);
    for (const life of gone) expect(Math.abs(life - STREAKS.life)).toBeLessThan(1 / 60 + 1e-9);
  });
  it('is the same run for the same rand', () => {
    const a = createSkyTraffic({ links, rand: seeded(3) });
    const b = createSkyTraffic({ links, rand: seeded(3) });
    for (let i = 0; i < 300; i++) expect(a.update(1 / 30).map((s) => [s.kind, s.k, s.dir])).toEqual(b.update(1 / 30).map((s) => [s.kind, s.k, s.dir]));
  });
  it('has none at all with no links', () => {
    const sky = createSkyTraffic({ links: [], rand: seeded() });
    for (let i = 0; i < 600; i++) expect(sky.update(1 / 60)).toEqual([]);
  });
});

describe('streakAt', () => {
  const dir = courseTo(systemById('coruscant'), systemById('tatooine'));
  const r = 60;
  const at = (kind, k) => streakAt({ dir, kind, k, off: [0.4, -0.7] }, { r, sky: SKY });

  it('runs a ship leaving from just off the planet, on the side of its course, out to the sky', () => {
    const s0 = at('leave', 0);
    expect(dot(s0.head, dir)).toBeCloseTo(r * 1.3, 6); // (past the limb that way: seen pulling away from behind it, or in front)
    expect(len(s0.head)).toBeGreaterThan(r);
    expect(len(s0.head)).toBeLessThan(r * 1.6);
    expect(s0.tail).toEqual(s0.head);
    expect(s0.fade).toBe(0);
    const s1 = at('leave', 1);
    expect(dot(s1.head, dir)).toBeCloseTo(SKY, 6);
    // the head and the tail both along its course, the tail behind
    for (const k of [0.2, 0.5, 0.9]) {
      const s = at('leave', k);
      expect(dot(s.head, dir)).toBeGreaterThan(dot(s.tail, dir));
      const across = sub(s.head, s.tail);
      expect(dot(across, dir) / len(across)).toBeCloseTo(1, 6);
      expect(s.fade).toBeGreaterThan(0);
      expect(s.fade).toBeLessThanOrEqual(1);
    }
  });
  it('accelerates as it goes, the streak stretching', () => {
    const lens = [0.2, 0.4, 0.6, 0.8].map((k) => len(sub(at('leave', k).head, at('leave', k).tail)));
    for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeGreaterThan(lens[i - 1]);
    const step = (k) => dot(at('leave', k + 0.05).head, dir) - dot(at('leave', k).head, dir);
    expect(step(0.8)).toBeGreaterThan(step(0.1) * 3);
  });
  it('runs an arriving one the other way: in from the sky, slowing, ending off the planet', () => {
    const s0 = at('arrive', 0);
    expect(dot(s0.head, dir)).toBeCloseTo(SKY, 6);
    expect(s0.fade).toBe(0);
    const s1 = at('arrive', 1);
    expect(dot(s1.head, dir)).toBeCloseTo(r * 1.3, 6);
    for (const k of [0.2, 0.5, 0.9]) {
      const s = at('arrive', k);
      expect(dot(s.tail, dir)).toBeGreaterThan(dot(s.head, dir)); // (the tail out behind it)
    }
    const lens = [0.2, 0.4, 0.6, 0.8].map((k) => len(sub(at('arrive', k).head, at('arrive', k).tail)));
    for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeLessThan(lens[i - 1]);
  });
  it('keeps each ship to a line of its own, a little off the course, and gone at the end of its life', () => {
    const a = streakAt({ dir, kind: 'leave', k: 0.5, off: [0, 0] }, { r, sky: SKY });
    const b = streakAt({ dir, kind: 'leave', k: 0.5, off: [1, 1] }, { r, sky: SKY });
    const apart = sub(b.head, a.head);
    expect(Math.abs(dot(apart, dir))).toBeLessThan(1e-6);
    expect(len(apart)).toBeGreaterThan(r * 0.3);
    expect(len(apart)).toBeLessThan(r);
    expect(at('leave', 1).fade).toBe(0);
    expect(at('arrive', 1).fade).toBe(0);
  });
});
