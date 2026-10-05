import { describe, expect, it } from 'vitest';
import { buildWorld, groundAt, near } from './map';
import { CARDS, RINGS, newQuests, stepQuests } from './quests';

const W = buildWorld();
const inside = (b, p, pad = 0) => p[0] > b.x0 - pad && p[0] < b.x1 + pad && p[2] > b.z0 - pad && p[2] < b.z1 + pad && p[1] > b.y0 - pad && p[1] < b.y1 + pad;
const hero = (p, mode = 'air') => ({ p: [...p], v: [0, 0, 0], mode });
// run the quests for t seconds with the hero where `at` puts him
function run(q, at, t, dt = 1 / 30) {
  const ev = [];
  for (let s = 0; s < t; s += dt) {
    const h = typeof at === 'function' ? at(s, q) : at;
    q = stepQuests(q, h, dt, W);
    ev.push(...q.ev);
  }
  return { q, ev };
}

describe('the ring course', () => {
  it('has ten rings, none of them in a building', () => {
    expect(RINGS).toHaveLength(10);
    for (const r of RINGS) for (const b of near(W, r.p[0], r.p[2], r.r + 2)) expect(inside(b, r.p, r.r * 0.6), `ring at ${r.p}`).toBe(false);
  });
  it('starts at the first ring, takes them in order and keeps the best time', () => {
    let q = newQuests();
    // fly from ring to ring, a straight line through each
    const path = (s) => {
      const k = Math.min(RINGS.length - 1, Math.floor(s / 2));
      const a = RINGS[Math.max(0, k - 1)].p;
      const b = RINGS[k].p;
      const f = k === 0 ? 1 : Math.min(1.3, (s - k * 2) / 1.5); // (on past each ring, through it)
      return hero([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 1, a[2] + (b[2] - a[2]) * f]);
    };
    const { q: done, ev } = run(q, path, 22);
    q = done;
    expect(ev.filter((e) => e.type === 'ring')).toHaveLength(RINGS.length - 1);
    expect(ev.some((e) => e.type === 'lesson-start')).toBe(true);
    const end = ev.find((e) => e.type === 'lesson-done');
    expect(end).toBeTruthy();
    expect(q.lesson.best).toBeCloseTo(end.time, 5);
    expect(q.lesson.on).toBe(false);
  });
  it('doesn’t count a ring flown round instead of through', () => {
    const q = { ...newQuests(), lesson: { on: true, next: 1, t: 0, best: null } };
    const r = RINGS[1].p;
    const { ev } = run(q, (s) => hero([r[0] + 30 - s * 20, r[1] + 25, r[2]]), 3);
    expect(ev.some((e) => e.type === 'ring')).toBe(false);
  });
});

describe('the title cards', () => {
  it('hides eight, one an episode, each somewhere he can get to', () => {
    expect(CARDS.map((c) => c.ep)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const at = CARDS.map((c) => c.at(W));
    for (const p of at) {
      expect(p[1]).toBeGreaterThanOrEqual(groundAt(p[0], p[2]));
      for (const b of near(W, p[0], p[2], 3)) expect(inside(b, p)).toBe(false);
    }
  });
  it('picks one up when he flies through it, once', () => {
    const p = CARDS[3].at(W);
    const { q, ev } = run(newQuests(), hero([p[0], p[1] - 1, p[2]]), 1);
    expect(q.cards).toEqual([4]);
    expect(ev.filter((e) => e.type === 'card')).toHaveLength(1);
  });
  it('keeps what was found', () => {
    expect(newQuests({ cards: [2, 5], best: 41.5, saved: 3 }).cards).toEqual([2, 5]);
  });
});

// run until an event comes, or give up after `max` seconds
function until(q, h, type, max = 120, dt = 1 / 30) {
  for (let s = 0; s < max; s += dt) {
    q = stepQuests(q, h, dt, W);
    if (q.ev.some((e) => e.type === type)) return q;
  }
  return q;
}

describe('rescues', () => {
  it('calls one in after a while, somewhere near him', () => {
    const q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    expect(q.rescue).toBeTruthy();
    expect(q.rescue.t).toBeLessThan(1);
    expect(Math.hypot(q.rescue.p[0], q.rescue.p[2] - 600)).toBeLessThan(1600);
  });
  it('is saved by catching them and setting them down', () => {
    let q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const r = q.rescue;
    // catch them where they are, then come down
    ({ q } = run(q, (_, qq) => hero(qq.rescue ? [qq.rescue.p[0], qq.rescue.p[1] - 1, qq.rescue.p[2]] : [0, 0, 0]), 0.5));
    expect(q.rescue.carried).toBe(true);
    const g = [r.p[0] + 40, 0, r.p[2]];
    const { q: after, ev } = run(q, hero(g, 'ground'), 0.5);
    expect(ev.some((e) => e.type === 'saved')).toBe(true);
    expect(after.rescue).toBe(null);
    expect(after.saved).toBe(1);
  });
  it('goes wrong if nobody catches them', () => {
    const q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const { ev, q: after } = run(q, hero([3000, 50, -3000]), 60);
    expect(ev.some((e) => e.type === 'missed')).toBe(true);
    expect(after.saved).toBe(0);
  });
});
