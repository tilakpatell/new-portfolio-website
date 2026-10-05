import { describe, expect, it } from 'vitest';
import { RESCUE, SEAT_GAZE, UNSEEN, gazeIn, gazeOn, newRescue, newSeat, newUnseen, newWood, pickStick, reach, samUp, stepRescue, stepSeat, stepUnseen } from './rules';

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
