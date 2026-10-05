import { describe, expect, it } from 'vitest';
import { RESCUE, SEAT_GAZE, SKIP, UNSEEN, gazeIn, gazeOn, newRescue, newSeat, newSkipping, newStone, newUnseen, newWood, pickStick, pressSkip, reach, samUp, skipsFor, stepRescue, stepSeat, stepSkipping, stepUnseen, stoneAt, strengthAt, tiltAt } from './rules';

const run = (n, fn) => {
  for (let i = 0; i < n; i++) if (fn(i) === false) break;
};

describe('wood for the fire', () => {
  it('is all gathered once every stick is picked up, each once', () => {
    const w = newWood(3);
    expect(pickStick(w, 0)).toBe('got');
    expect(pickStick(w, 0)).toBe(null);
    expect(pickStick(w, 2)).toBe('got');
    expect(pickStick(w, 7)).toBe(null);
    expect(pickStick(w, 1)).toBe('all');
  });
});

describe('getting away with the Ring on', () => {
  const goal = { x: 20, z: 0 };
  it('gets you to the stair if you go steadily', () => {
    const u = newUnseen();
    const h = { x: 0, z: 0, running: false };
    let end = null;
    run(4000, () => {
      h.x += 1.6 * 0.05;
      for (const e of stepUnseen(u, 0.05, h, goal)) end = e.type;
      return !end;
    });
    expect(end).toBe('away');
    expect(u.pull).toBeLessThan(1);
  });
  it('is too much if you dawdle', () => {
    const u = newUnseen();
    const h = { x: 0, z: 0, running: false };
    let end = null;
    run(4000, () => {
      for (const e of stepUnseen(u, 0.05, h, goal)) end = e.type;
      return !end;
    });
    expect(end).toBe('found');
    expect(u.t).toBeCloseTo(1 / UNSEEN.rise, 0);
  });
  it('pulls harder while you run', () => {
    const a = newUnseen();
    const b = newUnseen();
    stepUnseen(a, 1, { x: 0, z: 0, running: false }, goal);
    stepUnseen(b, 1, { x: 0, z: 0, running: true }, goal);
    expect(b.pull).toBeGreaterThan(a.pull);
  });
});

describe('the Seat of Seeing', () => {
  const play = (policy) => {
    const st = newSeat();
    let end = null;
    run(2000, () => {
      for (const e of stepSeat(st, 0.05, policy(st))) if (e.type === 'off' || e.type === 'seen') end = e.type;
      return !end;
    });
    return { st, end };
  };
  it('lets the Ring off if you pull just after the gaze has passed', () => {
    const { end } = play((st) => !gazeOn(st) && st.t > SEAT_GAZE.first);
    expect(end).toBe('off');
  });
  it('finds you if you never pull', () => {
    const { end, st } = play(() => false);
    expect(end).toBe('seen');
    expect(st.heat).toBe(SEAT_GAZE.passes);
  });
  it('finds you if you only start pulling as the gaze comes round', () => {
    const { end } = play((st) => gazeIn(st) < SEAT_GAZE.off * 0.6 && gazeIn(st) > 0);
    expect(end).toBe('seen');
  });
  it('says how long till the gaze comes round', () => {
    const st = newSeat();
    expect(gazeIn(st)).toBeCloseTo(SEAT_GAZE.first);
    st.t = SEAT_GAZE.first + 0.1;
    expect(gazeIn(st)).toBe(0);
    st.t = SEAT_GAZE.first + SEAT_GAZE.on + 0.1;
    expect(gazeIn(st)).toBeCloseTo(SEAT_GAZE.period - SEAT_GAZE.on - 0.1);
  });
});

describe('Sam in the water', () => {
  it('is got by paddling back and reaching while he’s up', () => {
    const r = newRescue();
    let got = null;
    run(2000, () => {
      stepRescue(r, 0.05, r.gap > RESCUE.near * 0.7);
      if (r.gap <= RESCUE.near && samUp(r)) got = reach(r);
      return !got;
    });
    expect(got).toBe('got');
  });
  it('is out of reach till you paddle back', () => {
    const r = newRescue();
    run(60, () => void stepRescue(r, 0.05, false));
    expect(reach(r)).toBe('far');
  });
  it('is missed while he’s under', () => {
    const r = newRescue();
    r.gap = 1;
    r.t = 0;
    expect(samUp(r)).toBe(false);
    expect(reach(r)).toBe('under');
    expect(r.misses).toBe(1);
  });
});

describe('ducks and drakes', () => {
  it('skips a flat stone, thrown low and hard, more than Pippin ever did', () => {
    const { skips, touches } = skipsFor(SKIP.best, 1, 1);
    expect(skips).toBeGreaterThan(SKIP.pippin);
    expect(touches).toHaveLength(skips + 1);
    // each hop shorter than the last, and further out
    for (let i = 2; i < touches.length; i++) {
      expect(touches[i].d - touches[i - 1].d).toBeLessThan(touches[i - 1].d - (touches[i - 2]?.d ?? 0) + 1e-9);
      expect(touches[i].t).toBeGreaterThan(touches[i - 1].t);
    }
  });
  it('skips less off the best tilt, thrown softer, or with a lumpier stone', () => {
    const best = skipsFor(SKIP.best, 1, 1).skips;
    expect(skipsFor(SKIP.best + 10, 1, 1).skips).toBeLessThan(best);
    expect(skipsFor(2, 1, 1).skips).toBeLessThan(best);
    expect(skipsFor(SKIP.best, 0.4, 1).skips).toBeLessThan(best);
    expect(skipsFor(SKIP.best, 1, 0.6).skips).toBeLessThan(best);
  });
  it('goes straight in, too steep or too feeble', () => {
    expect(skipsFor(SKIP.sink + 2, 1, 1)).toMatchObject({ skips: 0 });
    expect(skipsFor(SKIP.best, 0, 1).skips).toBe(0);
  });
  it('swings the needle from flat to steep and back, and the strength up and down', () => {
    expect(tiltAt(0)).toBeCloseTo(0);
    expect(tiltAt(SKIP.swing / 2)).toBeCloseTo(SKIP.steep);
    expect(tiltAt(SKIP.swing)).toBeCloseTo(0);
    expect(strengthAt(0)).toBeCloseTo(0);
    expect(strengthAt(SKIP.rise)).toBeCloseTo(1);
    expect(strengthAt(SKIP.rise * 1.5)).toBeCloseTo(0.5);
  });
  it('flies the stone out of your hand and along the water, then it’s gone', () => {
    const { touches } = skipsFor(SKIP.best, 1, 1);
    expect(stoneAt(touches, 0, 1)).toEqual({ d: 0, y: 1 });
    const mid = stoneAt(touches, (touches[1].t + touches[2].t) / 2, 1);
    expect(mid.y).toBeGreaterThan(0);
    expect(mid.d).toBeGreaterThan(touches[1].d);
    expect(stoneAt(touches, touches[2].t, 1).y).toBeCloseTo(0);
    expect(stoneAt(touches, touches.at(-1).t + 0.1, 1)).toBeNull();
  });
  it('is thrown in two presses: the tilt, then the strength', () => {
    const sk = newSkipping(4);
    // catch the needle at the best tilt, and the bar at the top
    const tBest = (SKIP.swing / (2 * Math.PI)) * Math.acos(1 - (2 * SKIP.best) / SKIP.steep);
    stepSkipping(sk, tBest);
    expect(pressSkip(sk)).toBe('tilt');
    expect(sk.tilt).toBeCloseTo(SKIP.best, 1);
    stepSkipping(sk, SKIP.rise);
    sk.flat = 1;
    expect(pressSkip(sk)).toBe('throw');
    expect(pressSkip(sk)).toBeNull();
    const ev = [];
    for (let i = 0; i < 400 && sk.phase !== 'tilt'; i++) ev.push(...stepSkipping(sk, 0.05));
    const touches = ev.filter((e) => e.type === 'touch');
    const sank = ev.find((e) => e.type === 'sank');
    expect(sank.skips).toBeGreaterThan(SKIP.pippin);
    expect(touches).toHaveLength(sank.skips + 1);
    expect(touches.filter((e) => e.skip)).toHaveLength(sank.skips);
    expect(sk.best).toBe(sank.skips);
    expect(ev.at(-1).type).toBe('ready');
    expect(sk.throws).toBe(1);
  });
  it('says why a stone went straight in, and keeps the best', () => {
    const sk = newSkipping(4);
    sk.best = 3;
    stepSkipping(sk, SKIP.swing / 2);
    pressSkip(sk);
    pressSkip(sk);
    const ev = [];
    for (let i = 0; i < 200 && sk.phase === 'flying'; i++) ev.push(...stepSkipping(sk, 0.05));
    expect(ev.find((e) => e.type === 'sank')).toMatchObject({ skips: 0, why: 'steep', best: 3 });
  });
  it('lets you look for a flatter stone before you throw, not after', () => {
    const sk = newSkipping(9);
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      expect(newStone(sk)).toBe(true);
      expect(sk.flat).toBeGreaterThanOrEqual(0.55);
      expect(sk.flat).toBeLessThanOrEqual(1);
      seen.add(sk.flat.toFixed(2));
    }
    expect(seen.size).toBeGreaterThan(5);
    pressSkip(sk);
    pressSkip(sk);
    expect(newStone(sk)).toBe(false);
  });
});
