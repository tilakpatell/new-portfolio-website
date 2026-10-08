import { describe, expect, it } from 'vitest';
import { GALLOP, TROT, createShot, createStride, createTracker, ease, footAt, gaitOffsets, legRig, legSwing, twoBone } from './creatures';

const DT = 1 / 60;

describe('creatures: what a creature’s own position says', () => {
  it('reads its speed from where the scene put it, forward along its heading', () => {
    const track = createTracker();
    let m;
    for (let i = 0; i <= 60; i++) m = track(i * DT, i * DT * 3, 0, 0);
    expect(m.speed).toBeCloseTo(3, 1);
    expect(m.fwd).toBeCloseTo(3, 1);
    expect(Math.abs(m.side)).toBeLessThan(0.01);
    // facing the other way, the same motion is backing up
    const back = createTracker();
    for (let i = 0; i <= 60; i++) m = back(i * DT, i * DT * 3, 0, Math.PI);
    expect(m.fwd).toBeCloseTo(-3, 1);
    // heading +z is a heading of -π/2 (x round to (cos, -sin))
    const south = createTracker();
    for (let i = 0; i <= 60; i++) m = south(i * DT, 0, i * DT * 2, -Math.PI / 2);
    expect(m.fwd).toBeCloseTo(2, 1);
  });

  it('counts in its own units when it is scaled', () => {
    const track = createTracker();
    let m;
    for (let i = 0; i <= 60; i++) m = track(i * DT, i * DT * 3, 0, 0, 2);
    expect(m.speed).toBeCloseTo(1.5, 1);
  });

  it('takes a jump across the map for a jump, not a sprint', () => {
    const track = createTracker();
    let m;
    for (let i = 0; i <= 30; i++) m = track(i * DT, i * DT, 0, 0);
    m = track(31 * DT, 400, 0, 0);
    expect(m.speed).toBeLessThan(1.5);
    m = track(32 * DT, 400 + DT, 0, 0);
    expect(m.speed).toBeLessThan(1.5);
  });

  it('moves nothing on a repeated or a backward clock', () => {
    const track = createTracker();
    let m;
    for (let i = 0; i <= 30; i++) m = track(i * DT, i * DT * 2, 0, 0);
    const before = m.speed;
    m = track(30 * DT, 5, 0, 0);
    expect(m.dt).toBe(0);
    expect(m.speed).toBeCloseTo(before, 9);
    m = track(0, 0, 0, 0);
    expect(m.dt).toBe(0);
  });

  it('reads how fast it is turning', () => {
    const track = createTracker();
    let m;
    for (let i = 0; i <= 60; i++) m = track(i * DT, 0, 0, i * DT * 1.5);
    expect(m.turn).toBeCloseTo(1.5, 1);
  });
});

describe('creatures: a stride from the ground covered', () => {
  it('is a cycle per stride of ground, the stride its own at its easy pace', () => {
    const s = createStride({ stride: 2, hz: 1, seed: 1 });
    let ground = 0;
    let cycles = 0;
    let last = s.step(0, 0).cycle;
    while (ground < 20) {
      const g = s.step(DT, 2);
      let d = g.cycle - last;
      if (d < -0.5) d += 1;
      cycles += d;
      last = g.cycle;
      ground += 2 * DT;
    }
    expect(cycles).toBeCloseTo(10, 1);
  });

  it('lengthens its stride as it speeds up, to its longest, and shortens it slowing down', () => {
    const s = createStride({ stride: 1, hz: 2, longest: 1.5 });
    expect(s.at(2).reach).toBeCloseTo(1, 6);
    expect(s.at(4).reach).toBeGreaterThan(1.3);
    expect(s.at(40).reach).toBeCloseTo(1.5, 6);
    expect(s.at(0.5).reach).toBeLessThan(1);
    expect(s.at(0).reach).toBe(0);
    // and the cadence rises with it, never capped
    expect(s.at(40).hz).toBeCloseTo(40 / 1.5, 6);
  });

  it('keeps a planted foot where it was put, at any pace', () => {
    for (const v of [0.4, 1.4, 3.4, 7]) {
      const s = createStride({ stride: 1.2, hz: 1.4, longest: 1.6, stance: 0.6, seed: 2 });
      for (let i = 0; i < 60; i++) s.step(DT, v); // eased in
      let body = 0;
      let planted = null;
      let worst = 0;
      for (let i = 0; i < 240; i++) {
        const g = s.step(DT, v);
        body += v * DT;
        const f = footAt(g.cycle, 0.6);
        const foot = body + (f.x * g.travel) / 2;
        if (f.lift === 0) {
          if (planted == null) planted = foot;
          worst = Math.max(worst, Math.abs(foot - planted));
        } else planted = null;
      }
      expect(worst).toBeLessThan(0.02);
    }
  });

  it('stands still with its legs still', () => {
    const s = createStride({ stride: 1, hz: 2, seed: 4 });
    let g;
    for (let i = 0; i < 60; i++) g = s.step(DT, 2);
    for (let i = 0; i < 60; i++) g = s.step(DT, 0);
    const c = g.cycle;
    expect(g.amount).toBe(0);
    g = s.step(DT, 0);
    expect(g.cycle).toBe(c);
  });

  it('walks its legs backward when it backs away', () => {
    const s = createStride({ stride: 1, hz: 1 });
    const a = s.step(DT, 0).cycle;
    const b = s.step(0.05, -1).cycle;
    let d = b - a;
    if (d > 0.5) d -= 1;
    expect(d).toBeLessThan(0);
  });

  it('seeds start a crowd out of step', () => {
    const a = createStride({ stride: 1, hz: 1, seed: 1 }).step(0, 0).cycle;
    const b = createStride({ stride: 1, hz: 1, seed: 2 }).step(0, 0).cycle;
    expect(Math.abs(a - b)).toBeGreaterThan(0.01);
  });
});

describe('creatures: a foot through its cycle', () => {
  it('goes back at an even pace on the ground, then lifts and comes through', () => {
    expect(footAt(0, 0.6)).toEqual({ x: 1, lift: 0 });
    expect(footAt(0.3, 0.6).x).toBeCloseTo(0, 9);
    expect(footAt(0.3, 0.6).lift).toBe(0);
    expect(footAt(0.8, 0.6).lift).toBeCloseTo(1, 9);
    expect(footAt(0.999, 0.6).x).toBeCloseTo(1, 2);
    // a cycle past one wraps
    expect(footAt(1.3, 0.6).x).toBeCloseTo(footAt(0.3, 0.6).x, 9);
  });
});

describe('creatures: stiff legs and gaits', () => {
  it('swings a stiff leg to put its foot where footAt says', () => {
    for (const c of [0, 0.1, 0.3, 0.55]) {
      const { angle } = legSwing(c, 0.6, 0.8, 0.5);
      expect(0.5 * Math.sin(angle)).toBeCloseTo((footAt(c, 0.6).x * 0.8) / 2, 9);
    }
    // a stride too long for the leg is held short of straight out
    expect(Math.abs(legSwing(0, 0.5, 9, 0.5).angle)).toBeLessThan(Math.PI / 2 - 0.2);
  });

  it('swings a bowed leg about its hip so its foot still goes where it should', () => {
    const lean = 0.3;
    const L = 1.8;
    for (const c of [0, 0.2, 0.45]) {
      const { angle, rise } = legSwing(c, 0.5, 1.2, L, lean);
      // ahead of the hip as footAt says, straight beneath it mid-stride
      expect(L * Math.sin(angle + lean)).toBeCloseTo((footAt(c, 0.5).x * 1.2) / 2, 9);
      // and the hip stands as high as that leg holds it
      expect(L * Math.cos(angle + lean) - L * Math.cos(lean)).toBeCloseTo(rise, 9);
    }
    // a straight leg holds it highest straight down, lower either side
    expect(legSwing(0.25, 0.5, 1.2, L).rise).toBeCloseTo(0, 9);
    expect(legSwing(0, 0.5, 1.2, L).rise).toBeLessThan(0);
  });

  it('reaches a jointed limb to its point, the knee forward or the elbow back', () => {
    const end = ([a1, a2], L1, L2) => [Math.sin(a1) * L1 + Math.sin(a2) * L2, -Math.cos(a1) * L1 - Math.cos(a2) * L2];
    for (const [x, y] of [[0.3, -1.6], [-0.6, -1.2], [0.9, -1.4], [0, -1.9]]) {
      const knee = twoBone(x, y, 1, 1, 1);
      const [ex, ey] = end(knee, 1, 1);
      expect(ex).toBeCloseTo(x, 6);
      expect(ey).toBeCloseTo(y, 6);
      // a knee bends forward: the thigh ahead of the shin
      expect(knee[0]).toBeGreaterThan(knee[1]);
      const elbow = twoBone(x, y, 1, 1, -1);
      expect(elbow[0]).toBeLessThan(elbow[1]);
    }
    // out of reach: as far as it goes, toward the point
    const [a1, a2] = twoBone(0, -5, 1, 1, 1);
    expect(Math.abs(a1)).toBeLessThan(0.1);
    expect(Math.abs(a2)).toBeLessThan(0.1);
  });

  it('puts a rigged leg’s foot where it’s asked, standing as it was built at home', () => {
    const rig = legRig({ knee: [0.3, -0.84], foot: [0.28, -0.95], rest: [0.04, -0.1] });
    const [t0, s0] = rig.reach(rig.home[0], rig.home[1]);
    expect(t0).toBeCloseTo(0.04, 6);
    expect(s0).toBeCloseTo(-0.1, 6);
    // and a step ahead and a little up: the foot goes there
    const [a, b] = rig.reach(rig.home[0] + 0.2, rig.home[1] + 0.15);
    const k = [Math.sin(Math.atan2(0.3, 0.84) + a) * rig.upper, -Math.cos(Math.atan2(0.3, 0.84) + a) * rig.upper];
    const s = Math.atan2(0.28, 0.95) + a + b;
    expect(k[0] + Math.sin(s) * rig.lower).toBeCloseTo(rig.home[0] + 0.2, 6);
    expect(k[1] - Math.cos(s) * rig.lower).toBeCloseTo(rig.home[1] + 0.15, 6);
    // a long stride wants the hips lower than a short one; a short leg
    // under a high hip none at all
    expect(rig.sink(1.6)).toBeGreaterThan(rig.sink(0.2) + 0.1);
    expect(legRig({ knee: [0, -1], foot: [0, -1], rest: [0.3, -0.6] }).sink(0.2)).toBe(0);
  });

  it('eases the legs from one gait to another without a jump', () => {
    expect(gaitOffsets(0)).toEqual(TROT);
    expect(gaitOffsets(1)).toEqual(GALLOP);
    const a = gaitOffsets(0.5);
    const b = gaitOffsets(0.51);
    a.forEach((o, i) => expect(Math.abs(o - b[i])).toBeLessThan(0.01));
  });
});

describe('creatures: easing and one-shots', () => {
  it('eases by time, the same at any frame rate', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = ease(a, 1, 1 / 30, 4);
    for (let i = 0; i < 144; i++) b = ease(b, 1, 1 / 144, 4);
    expect(a).toBeCloseTo(b, 6);
  });

  it('plays a one-shot through once', () => {
    const roar = createShot(1.5);
    expect(roar.step(DT)).toBe(-1);
    roar.fire();
    expect(roar.step(0)).toBe(0);
    expect(roar.step(0.75)).toBeCloseTo(0.5, 6);
    expect(roar.step(1)).toBe(-1);
    expect(roar.active).toBe(false);
  });
});
