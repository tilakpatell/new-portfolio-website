import { describe, expect, it } from 'vitest';
import { KINDS, LANE, RUN, STONE_AT, leap, moveLane, newRun, smash, speedAt, startRun, stepRun, upcoming } from './rules';

const DT = 1 / 120;
const run = (g, secs, brain) => {
  const ev = [];
  for (let t = 0; t < secs; t += DT) {
    brain?.(g, t);
    ev.push(...stepRun(g, DT));
    if (g.phase !== 'run') break;
  }
  return ev;
};
const until = (g, d, brain) => {
  const ev = [];
  while (g.phase === 'run' && g.d < d) {
    brain?.(g);
    ev.push(...stepRun(g, DT));
  }
  return ev;
};
// a run with an empty street, for placing things by hand
const empty = (seed = 1) => {
  const g = newRun({ seed });
  startRun(g);
  g.obstacles = [];
  g.chariots = [];
  g.built = 1e9; // lay out nothing more
  return g;
};
const place = (g, kind, ahead, lane = 0, extra = {}) => {
  const K = KINDS[kind];
  const o = { id: g.nextId++, kind, at: g.d + ahead, lane, x: lane * LANE, w: K.w, len: K.len, broken: false, passed: false, ...extra };
  if (extra.wide) Object.assign(o, { x: 0, w: LANE * 3 });
  g.obstacles.push(o);
  return o;
};
const inLane = (o, lane) => Math.abs(o.x - lane * LANE) < o.w / 2 + RUN.halfWidth;

// A sensible Hulk: get out of a lane that's about to burn; take the lane whose
// next thing is best (something to smash beats an open road beats a crater
// beats a wall); smash a little late; leap craters at the right moment.
export function hulkBot(g, { lateness = 1 } = {}) {
  const H = g.hulk;
  if (g.phase !== 'run') return;
  const sp = g.speed;
  const burning = new Set(g.chariots.filter((c) => c.state === 'warn' || c.state === 'burn').map((c) => c.lane));
  const next = upcoming(g, 48);
  const first = (lane) => next.find((o) => inLane(o, lane) && o.at + o.len > g.d - 0.3);
  const cost = (lane) => {
    let c = Math.abs(lane - H.lane) * 2;
    if (burning.has(lane)) c += 200;
    const o = first(lane);
    if (!o) return c;
    const ahead = o.at - g.d;
    if (o.kind === 'barrier') c += 150 - ahead;
    else if (o.kind === 'crater') c += o.w > LANE * 2 ? 0 : 30 - ahead * 0.3;
    else c -= 3; // something to smash
    return c;
  };
  // the lane he's heading for, one step at a time, and not into something close
  if (Math.abs(H.x - H.lane * LANE) < 0.2) {
    const best = [-1, 0, 1].reduce((a, b) => (cost(b) < cost(a) ? b : a), H.lane);
    if (best !== H.lane) {
      const step = H.lane + Math.sign(best - H.lane);
      const o = first(step);
      if (!o || o.at - g.d > 3.5 || o.kind === 'crater') moveLane(g, best - H.lane);
    }
  }
  // a burning lane he can't leave: leap as it goes up
  const burn = g.chariots.find((c) => c.state === 'burn' && c.lane === H.lane);
  if (burn) leap(g);
  const o = first(H.lane);
  if (!o) return;
  const ahead = o.at - g.d;
  if (KINDS[o.kind].smash) {
    if (ahead < 2.2 * lateness + sp * 0.02 && ahead > -0.3) smash(g);
  } else if (o.kind === 'crater') {
    if (ahead < 0.9 + sp * 0.04) leap(g);
  }
}

describe('Smash Run: the street', () => {
  it('gets faster the further he runs', () => {
    expect(speedAt(0)).toBe(RUN.speed[0]);
    expect(speedAt(1000)).toBeGreaterThan(speedAt(200));
    expect(speedAt(5000)).toBeLessThan(RUN.speed[1] + 0.01);
  });

  it('opens gently: only soldiers in the first 150 m, well spaced', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = newRun({ seed });
      startRun(g);
      const early = g.obstacles.filter((o) => o.at < RUN.safe).sort((a, b) => a.at - b.at);
      expect(early.length).toBeGreaterThan(2);
      expect(early.every((o) => o.kind === 'soldier')).toBe(true);
      expect(early[0].at).toBeGreaterThan(35);
      for (let i = 1; i < early.length; i++) expect(early[i].at - early[i - 1].at).toBeGreaterThan(15);
    }
  });

  it('brings each kind in on its own before mixing them', () => {
    const g = newRun({ seed: 7 });
    startRun(g);
    until(g, 1600, (q) => hulkBot(q));
    const firsts = {};
    for (const s of g.sections) if (s.kind === 'intro') firsts[s.pool[0]] = s.start;
    expect(Object.keys(firsts)).toEqual(['barricade', 'car', 'crater', 'barrier', 'chariot']);
    const order = Object.values(firsts);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('always leaves a way through: never three walls across', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = newRun({ seed });
      startRun(g);
      g.d = 0;
      // lay out 3 km
      until(g, 3000, (q) => {
        q.hulk.hurt = 1; // nothing hurts: we're only looking
      });
      const walls = g.obstacles.filter((o) => o.kind === 'barrier');
      for (const w of walls) {
        const beside = walls.filter((v) => v !== w && Math.abs(v.at - w.at) < 6);
        expect(new Set([w.lane, ...beside.map((v) => v.lane)]).size).toBeLessThan(3);
      }
    }
  });
});

describe('Smash Run: smashing', () => {
  it('breaks a soldier with a swing in time, and fills rage', () => {
    const g = empty();
    place(g, 'soldier', 6);
    smash(g);
    const ev = run(g, 0.5);
    expect(ev.some((e) => e.type === 'smash' && e.kind === 'soldier')).toBe(true);
    expect(g.hulk.hp).toBe(RUN.hearts);
    expect(g.hulk.rage).toBeGreaterThan(0);
  });

  it('whiffs a swing that comes too early, and the soldier gets him', () => {
    const g = empty();
    place(g, 'soldier', 24);
    smash(g);
    const ev = run(g, 2);
    expect(ev.some((e) => e.type === 'whiff')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.by === 'soldier')).toBe(true);
    expect(g.hulk.hp).toBe(RUN.hearts - 1);
  });

  it('counts a late swing as perfect, for more', () => {
    const g = empty();
    const o = place(g, 'car', 1.4);
    smash(g);
    const ev = run(g, 0.2);
    const s = ev.find((e) => e.type === 'smash' && e.id === o.id);
    expect(s.perfect).toBe(true);
    expect(s.score).toBe(Math.round(KINDS.car.score * 1.5));
  });

  it('cannot break a wall or a crater', () => {
    const g = empty();
    place(g, 'barrier', 2);
    smash(g);
    const ev = run(g, 0.6);
    expect(ev.some((e) => e.type === 'hit' && e.by === 'barrier')).toBe(true);
  });

  it('runs into what he does nothing about', () => {
    const g = empty();
    place(g, 'barricade', 10);
    const ev = run(g, 1.5);
    expect(ev.some((e) => e.type === 'hit' && e.by === 'barricade')).toBe(true);
  });
});

describe('Smash Run: leaping and lanes', () => {
  it('clears a crater with a leap at the right moment', () => {
    const g = empty();
    place(g, 'crater', 3, 0, { wide: true });
    let ev = [];
    ev = run(g, 2, (q) => {
      const o = q.obstacles[0];
      if (o.at - q.d < 1.2) leap(q);
    });
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    expect(ev.some((e) => e.type === 'land')).toBe(true);
  });

  it('falls into a crater he doesn’t leap', () => {
    const g = empty();
    place(g, 'crater', 8, 0, { wide: true });
    const ev = run(g, 1.5);
    expect(ev.some((e) => e.type === 'hit' && e.by === 'crater')).toBe(true);
  });

  it('goes round a wall by changing lane', () => {
    const g = empty();
    place(g, 'barrier', 12, 0);
    moveLane(g, 1);
    const ev = run(g, 1.5);
    expect(g.hulk.x).toBeCloseTo(LANE, 5);
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
  });

  it('can’t leave the street', () => {
    const g = empty();
    expect(moveLane(g, -1)).toBe(true);
    expect(moveLane(g, -1)).toBe(false);
    expect(g.hulk.lane).toBe(-1);
  });

  it('can’t smash in the air or leap mid-swing', () => {
    const g = empty();
    leap(g);
    expect(smash(g)).toBe(false);
    run(g, 1);
    smash(g);
    expect(leap(g)).toBe(false);
  });
});

describe('Smash Run: chariots', () => {
  const chariot = (g, lane, at) => g.chariots.push({ id: g.nextId++, at: g.d + at, lane, state: 'waiting', t: 0 });

  it('burns the lane it painted red', () => {
    const g = empty();
    chariot(g, 0, 60);
    g.rand = () => 0.99; // keep the lane it picked
    const ev = run(g, 3);
    expect(ev.findIndex((e) => e.type === 'warn')).toBeLessThan(ev.findIndex((e) => e.type === 'burn'));
    expect(ev.some((e) => e.type === 'hit' && e.by === 'chariot')).toBe(true);
  });

  it('misses him if he gets out of the lane, or is in the air', () => {
    let g = empty();
    chariot(g, 0, 60);
    g.rand = () => 0.99;
    let ev = run(g, 3, (q) => q.chariots[0].state === 'warn' && q.hulk.lane === 0 && moveLane(q, 1));
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    g = empty();
    chariot(g, 0, 60);
    g.rand = () => 0.99;
    ev = run(g, 3, (q) => q.chariots[0].state === 'warn' && q.chariots[0].t > 1.25 && leap(q));
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
  });
});

describe('Smash Run: rage', () => {
  it('turns full rage into HULK SMASH, through walls, for eight seconds', () => {
    const g = empty();
    g.hulk.rage = 95;
    place(g, 'soldier', 5);
    smash(g);
    let ev = run(g, 0.4);
    expect(ev.some((e) => e.type === 'rage')).toBe(true);
    expect(g.hulk.raging).toBeGreaterThan(7);
    place(g, 'barrier', 12, 0);
    place(g, 'crater', 40, 0, { wide: true });
    ev = run(g, 4);
    expect(ev.some((e) => e.type === 'smash' && e.kind === 'barrier' && e.rage)).toBe(true);
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    ev = run(g, 5);
    expect(ev.some((e) => e.type === 'calm')).toBe(true);
    expect(g.hulk.rage).toBe(0);
  });
});

describe('Smash Run: the run', () => {
  it('is over for a Hulk who does nothing, early', () => {
    for (const seed of [1, 2, 3]) {
      const g = newRun({ seed });
      startRun(g);
      const ev = until(g, 5000);
      expect(g.phase).toBe('lost');
      expect(ev.filter((e) => e.type === 'hit').length).toBe(RUN.hearts);
      expect(g.d).toBeLessThan(600);
    }
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`gets through the opening for a Hulk who only smashes (seed ${seed})`, () => {
      const g = newRun({ seed });
      startRun(g);
      until(g, RUN.safe, (q) => {
        const o = upcoming(q, 10).find((x) => inLane(x, q.hulk.lane));
        if (o && o.at - q.d < 3) smash(q);
      });
      expect(g.phase).toBe('run');
      expect(g.hulk.hp).toBe(RUN.hearts);
    });
  }

  for (const seed of [1, 2, 3]) {
    it(`takes the Time Stone at 2,000 m for a sensible Hulk (seed ${seed})`, () => {
      const g = newRun({ seed });
      startRun(g);
      const ev = until(g, STONE_AT + 50, (q) => hulkBot(q));
      expect(g.phase).toBe('run');
      expect(ev.some((e) => e.type === 'stone')).toBe(true);
      expect(g.stone).toBe(true);
      expect(ev.some((e) => e.type === 'rage')).toBe(true);
    });
  }

  it('gives a heart back every 500 m', () => {
    const g = empty();
    g.hulk.hp = 1;
    g.d = 499;
    const ev = run(g, 0.2);
    expect(ev.some((e) => e.type === 'heal')).toBe(true);
    expect(g.hulk.hp).toBe(2);
  });

  it('plays the same way from the same seed', () => {
    const play = () => {
      const g = newRun({ seed: 11 });
      startRun(g);
      until(g, 900, (q) => hulkBot(q, { lateness: 1.3 }));
      return [Math.round(g.score), g.hulk.hp, g.smashes, g.obstacles.length, Math.round(g.d)];
    };
    expect(play()).toEqual(play());
  });

  it('starts fresh after a run ends', () => {
    const g = newRun({ seed: 3 });
    startRun(g);
    until(g, 5000);
    expect(g.phase).toBe('lost');
    startRun(g);
    expect(g.phase).toBe('run');
    expect(g.d).toBe(0);
    expect(g.hulk.hp).toBe(RUN.hearts);
    expect(g.hulk.rage).toBe(0);
    expect(g.score).toBe(0);
    expect(g.stone).toBe(false);
    expect(g.obstacles.every((o) => !o.broken)).toBe(true);
  });
});

describe('Smash Run: a press that lands (lib/press.js)', () => {
  const DT = 1 / 120;
  const go = () => {
    const g = newRun({ seed: 3 });
    startRun(g);
    g.obstacles = [];
    g.chariots = [];
    g.built = 1e9; // nothing in his way
    return g;
  };
  const steps = (g, secs) => {
    const ev = [];
    for (let t = 0; t < secs - 1e-9; t += DT) ev.push(...stepRun(g, DT));
    return ev;
  };
  it('a smash pressed just before he lands from a leap swings as he lands', () => {
    const g = go();
    expect(leap(g)).toBe(true);
    steps(g, RUN.leapTime - 0.08);
    expect(smash(g)).toBe(false); // still in the air
    const ev = steps(g, 0.2);
    expect(ev.filter((e) => e.type === 'swing')).toHaveLength(1);
  });
  it('one pressed long before is dropped, as it was', () => {
    const g = go();
    leap(g);
    steps(g, 0.05);
    smash(g);
    const ev = steps(g, RUN.leapTime + 0.3);
    expect(ev.filter((e) => e.type === 'swing')).toHaveLength(0);
  });
  it('a leap pressed at the end of a swing leaps as it ends', () => {
    // how long a swing keeps him from leaping
    const g = go();
    expect(smash(g)).toBe(true);
    let t = 0;
    while (g.hulk.smash >= 0 && t < 2) {
      stepRun(g, DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(0.1);
    // again, pressing 0.08 s before the swing would end
    const g2 = go();
    smash(g2);
    steps(g2, t - 0.08);
    expect(leap(g2)).toBe(false);
    const ev = steps(g2, 0.2);
    expect(ev.filter((e) => e.type === 'leap')).toHaveLength(1);
  });
});
