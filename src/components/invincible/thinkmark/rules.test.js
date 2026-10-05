import { describe, expect, it } from 'vitest';
import { CITY, HALF, RIVER, boxes, buildCity, cellKind, clear, index, inside } from './city';
import { BOSSES, CHAPTERS, MARK, RINGS, buildRings, city, dodge, newGame, pilot, punch, setInput, startChapter, step } from './rules';

const DT = 1 / 120;
const run = (g, secs, brain) => {
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    brain?.(g, t);
    ev.push(...step(g, DT));
  }
  return ev;
};
const types = (ev) => ev.map((e) => e.type);
// a chapter with nobody in it but Mark, high over the river, for setting things up by hand
const quiet = (chapter = 1) => {
  const g = newGame({ seed: 4 });
  startChapter(g, chapter);
  g.portal && (g.portal.closing = false);
  g.waveT = 1e9;
  g.mark.p = [0, 120, 330];
  return g;
};
const flaxan = (g, p, extra = {}) => {
  const e = { id: g.nextId++, kind: 'flaxan', age: 0, p, v: [0, 0, 0], r: 0.8, hp: 1, state: 'fly', t: 0, orbit: 0, rad: 1e-3, lift: 0, shot: 1e9, spin: 0, ...extra };
  g.enemies.push(e);
  return e;
};

describe('the city', () => {
  const c = buildCity(7);
  it('is the same every time', () => {
    expect(buildCity(7)).toEqual(c);
  });
  it('keeps its towers in their blocks, off the streets and out of the river', () => {
    const lot = (CITY.cell - CITY.street) / 2;
    for (const t of c.towers) {
      const i = Math.floor((t.x + HALF) / CITY.cell);
      const j = Math.floor((t.z + HALF) / CITY.cell);
      expect(cellKind(i, j)).toBe('built');
      const cx = -HALF + (i + 0.5) * CITY.cell;
      const cz = -HALF + (j + 0.5) * CITY.cell;
      expect(Math.abs(t.x - cx) + t.w / 2).toBeLessThanOrEqual(lot + 1e-6);
      expect(Math.abs(t.z - cz) + t.d / 2).toBeLessThanOrEqual(lot + 1e-6);
      expect(t.z + t.d / 2).toBeLessThan(RIVER.z0);
    }
  });
  it('has a downtown: tall towers in the middle, low blocks at the edge', () => {
    const tall = c.towers.filter((t) => t.h > 120);
    expect(tall.length).toBeGreaterThan(8);
    for (const t of tall) expect(Math.hypot(t.x, t.z)).toBeLessThan(260);
    expect(Math.max(...c.towers.map((t) => t.h + (t.top?.h ?? 0)))).toBeLessThanOrEqual(260);
  });
  it('knows what is clear and what is not', () => {
    const idx = index(boxes(c));
    const t = c.towers.find((x) => x.h > 100);
    expect(inside(idx, t.x, t.h / 2, t.z)).not.toBeNull();
    expect(clear(idx, [t.x - 200, t.h / 2, t.z], [t.x + 200, t.h / 2, t.z])).toBe(false);
    expect(clear(idx, [-300, 300, -300], [300, 300, 300])).toBe(true);
  });
});

describe('the ring course', () => {
  it('runs from over the river into the city, every leg clear of the towers', () => {
    const rings = buildRings();
    expect(rings).toHaveLength(RINGS.n);
    const { idx } = city();
    let from = CHAPTERS[0].start;
    for (const r of rings) {
      expect(clear(idx, from, r.p, RINGS.r)).toBe(true);
      expect(Math.hypot(...r.n)).toBeCloseTo(1, 5);
      from = r.p;
    }
    expect(rings[0].p[2]).toBeLessThan(CHAPTERS[0].start[2]);
  });
});

describe('the chapters', () => {
  it('each start in the open air, and each Viltrumite flies in over the roofs', () => {
    const { idx } = city();
    CHAPTERS.forEach((ch, i) => {
      expect(inside(idx, ...ch.start, 4), ch.id).toBeNull();
      const g = newGame();
      startChapter(g, i);
      if (g.boss) expect(inside(idx, ...g.boss.p, 4), ch.id).toBeNull();
    });
  });
});

describe('flying', () => {
  it('reaches cruising speed and no more, faster with the boost, and stops when let go', () => {
    const g = quiet();
    // along the river, where there's nothing to hit
    g.mark.p = [-300, 40, 360];
    setInput(g, [1, 0, 0]);
    run(g, 3);
    expect(Math.hypot(...g.mark.v)).toBeCloseTo(MARK.cruise, 0);
    setInput(g, [1, 0, 0], true);
    run(g, 3);
    expect(Math.hypot(...g.mark.v)).toBeGreaterThan(MARK.cruise * 2);
    expect(Math.hypot(...g.mark.v)).toBeLessThanOrEqual(MARK.boost + 1e-6);
    setInput(g, [0, 0, 0]);
    run(g, 3);
    expect(Math.hypot(...g.mark.v)).toBeLessThan(1);
  });
  it('never goes into a tower, however fast he flies at it', () => {
    const g = quiet();
    const { towers, idx } = city();
    // a tower that has its block to itself, from the street in front of it
    const t = towers.find((x) => x.h > 100 && x.d > 30 && x.w > 30);
    g.mark.p = [t.x, t.h * 0.5, t.z + t.d / 2 + 8];
    expect(inside(idx, ...g.mark.p)).toBeNull();
    setInput(g, [0, 0, -1], true);
    run(g, 4, () => expect(inside(idx, ...g.mark.p, -0.05)).toBeNull());
    expect(g.mark.p[2]).toBeGreaterThan(t.z + t.d / 2);
  });
  it('stays over the street and under the sky', () => {
    const g = quiet();
    setInput(g, [0, -1, 0], true);
    run(g, 6);
    expect(g.mark.p[1]).toBeGreaterThan(0.5);
    setInput(g, [0, 1, 0], true);
    run(g, 12);
    expect(g.mark.p[1]).toBeLessThanOrEqual(330);
  });
});

describe('fighting', () => {
  it('dashes at what he is locked on to and knocks it out', () => {
    const g = quiet();
    const e = flaxan(g, [0, 120, 300]);
    run(g, 0.05);
    expect(g.lock).toBe(e.id);
    punch(g);
    const ev = run(g, 1);
    expect(types(ev)).toContain('dash');
    expect(types(ev)).toContain('ko');
    expect(e.state).toBe('ko');
    expect(g.score).toBeGreaterThan(0);
  });
  it('jabs when nothing is near', () => {
    const g = quiet();
    punch(g);
    const ev = run(g, 0.5);
    expect(types(ev)).toContain('jab');
    expect(types(ev)).toContain('whiff');
  });
  it('can’t be hurt in a dodge, and a dodge just in time is a perfect one', () => {
    const g = quiet();
    const shoot = (ahead) => g.bolts.push({ id: g.nextId++, p: [g.mark.p[0], g.mark.p[1], g.mark.p[2] - ahead], v: [0, 0, 34], life: 3, from: 0 });
    // the bolt all but on him: he can't get out of its way, but it can't hurt him
    shoot(1.2);
    dodge(g);
    let ev = run(g, 0.4);
    expect(types(ev)).toContain('perfect');
    expect(g.mark.hp).toBe(MARK.hp);
    // a little further off, a dodge to the side takes him out of its way: a near miss is perfect too
    run(g, 1);
    shoot(3);
    setInput(g, [1, 0, 0]);
    dodge(g);
    ev = run(g, 0.4);
    setInput(g, [0, 0, 0]);
    expect(types(ev)).toContain('perfect');
    expect(g.mark.hp).toBe(MARK.hp);
    // and without the dodge, it hurts
    run(g, 1);
    shoot(6);
    ev = run(g, 0.4);
    expect(types(ev)).toContain('hurt');
    expect(g.mark.hp).toBeLessThan(MARK.hp);
  });
  it('a boss blocks a punch and hits back, unless he’s recovering from a charge', () => {
    const g = newGame({ seed: 2 });
    startChapter(g, 2);
    const b = g.boss;
    Object.assign(b, { state: 'circle', timer: 99, p: [g.mark.p[0], g.mark.p[1], g.mark.p[2] - 12] });
    punch(g);
    let ev = run(g, 0.6);
    expect(types(ev)).toContain('block');
    expect(g.mark.hp).toBeLessThan(MARK.hp);
    expect(b.hp).toBe(b.max);
    run(g, 1);
    Object.assign(b, { state: 'recover', timer: 99, p: [g.mark.p[0], g.mark.p[1], g.mark.p[2] - 12], v: [0, 0, 0] });
    punch(g);
    ev = run(g, 0.6);
    expect(types(ev)).toContain('hit');
    expect(b.hp).toBeLessThan(b.max);
  });
  it('a charge that lands knocks him flying', () => {
    const g = newGame({ seed: 2 });
    startChapter(g, 2);
    const b = g.boss;
    Object.assign(b, { state: 'windup', timer: 0.01, p: [g.mark.p[0], g.mark.p[1], g.mark.p[2] - 25], v: [0, 0, 0] });
    const ev = run(g, 1);
    expect(types(ev)).toContain('charge');
    expect(types(ev)).toContain('hurt');
    expect(g.mark.hp).toBeCloseTo(MARK.hp - BOSSES.omni.dmg.charge, 0);
  });
  it('loses when he’s out of strength', () => {
    const g = quiet();
    g.mark.hp = 1;
    g.bolts.push({ id: 99, p: [g.mark.p[0], g.mark.p[1], g.mark.p[2] - 5], v: [0, 0, 34], life: 3, from: 0 });
    const ev = run(g, 1);
    expect(types(ev)).toContain('lost');
    expect(g.phase).toBe('lost');
  });
});

describe('the whole story, on the autopilot', () => {
  const story = (difficulty, seed = 3) => {
    const g = newGame({ seed, difficulty });
    const log = [];
    for (let i = 0; i < CHAPTERS.length; i++) {
      startChapter(g, i);
      const ev = run(g, 300, (x) => pilot(x));
      log.push({ id: CHAPTERS[i].id, phase: g.phase, ev: types(ev) });
      if (g.phase === 'lost') break;
    }
    return { g, log };
  };
  it('flies the lesson, sends the Flaxans back, sees off Omni-Man and beats Thragg, as a Hero', () => {
    const { g, log } = story('hero');
    expect(log.map((l) => l.phase)).toEqual(['clear', 'clear', 'clear', 'won']);
    expect(log[0].ev.filter((t) => t === 'ring')).toHaveLength(RINGS.n);
    expect(log[1].ev.filter((t) => t === 'wave')).toHaveLength(3);
    expect(log[2].ev).toContain('leave');
    expect(log[3].ev).toContain('down');
    expect(g.done).toEqual([0, 1, 2, 3]);
    expect(g.score).toBeGreaterThan(5000);
  });
  it('plays the same way twice from the same seed', () => {
    const a = story('guardian', 9).g;
    const b = story('guardian', 9).g;
    expect(a.score).toBe(b.score);
    expect(a.mark.p).toEqual(b.mark.p);
  });
});
