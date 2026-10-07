import { describe, expect, it } from 'vitest';
import { breathe, createGait, sway, turn } from './gait';

const TAU = Math.PI * 2;
// how far the phase moved from a to b, the short way round
const moved = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

describe('gait', () => {
  it('phase follows distance: a stride of ground is one cycle at any pace', () => {
    for (const speed of [0.3, 1.4, 4.5]) {
      const g = createGait({ stride: 1.5, cadence: [1, 1.6], seed: 3 });
      const dt = 1 / 120;
      let last = g.step(0, 0).phase;
      let total = 0;
      let ground = 0;
      while (ground < 1.5 - 1e-9) {
        const { phase } = g.step(dt, speed);
        total += moved(last, phase);
        last = phase;
        ground += speed * dt;
      }
      // a frame's worth of slack at the end of the stride
      expect(Math.abs(total - TAU)).toBeLessThan((speed * dt * TAU) / 1.5 + 1e-6);
    }
  });

  it('changing pace never jumps the phase', () => {
    const g = createGait({ stride: 1, cadence: [1, 1.6], seed: 1 });
    const dt = 1 / 60;
    let last;
    for (let i = 0; i < 30; i++) last = g.step(dt, 1).phase;
    const now = g.step(dt, 3).phase;
    // the frame it sped up covered 3 × dt of ground, so a third of that
    // cycle's turn: no pop from a clock that multiplied absolute time
    expect(moved(last, now)).toBeCloseTo((3 * dt * TAU) / 1, 6);
  });

  it('walks its legs backward when it backs up', () => {
    const g = createGait({ stride: 1, seed: 0 });
    const a = g.step(0, 0).phase;
    const b = g.step(0.05, -1).phase;
    expect(moved(a, b)).toBeCloseTo(-0.05 * TAU, 6);
  });

  it('amount eases from 0 to 1 over about a quarter second', () => {
    const g = createGait({ stride: 1, seed: 0 });
    expect(g.step(1 / 60, 0).amount).toBe(0);
    const dt = 1 / 60;
    const seen = [];
    for (let t = 0; t < 0.4; t += dt) seen.push(g.step(dt, 1.4).amount);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen[5]).toBeGreaterThan(0); // under a tenth of a second in: on its way
    expect(seen[5]).toBeLessThan(0.5);
    expect(seen[Math.round(0.3 / dt)]).toBe(1); // there by a quarter second and a bit
    // and back down when it stops
    let a = 1;
    for (let t = 0; t < 0.3; t += dt) a = g.step(dt, 0).amount;
    expect(a).toBe(0);
  });

  it('run eases in past the walking cadence and out below it', () => {
    const g = createGait({ stride: 1, cadence: [1, 1.6], seed: 0 });
    const dt = 1 / 60;
    let r = 0;
    for (let t = 0; t < 1; t += dt) r = g.step(dt, 0.9).run;
    expect(r).toBe(0); // under lo cycles a second: a walk
    const first = g.step(dt, 2).run;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.2); // eased, not switched
    for (let t = 0; t < 1; t += dt) r = g.step(dt, 2).run;
    expect(r).toBe(1);
    for (let t = 0; t < 1; t += dt) r = g.step(dt, 1).run;
    expect(r).toBe(0);
  });

  it('a 1 s frame is clamped and a 0 s one moves nothing', () => {
    const a = createGait({ stride: 1, seed: 5 });
    const b = createGait({ stride: 1, seed: 5 });
    const longOne = a.step(1, 1);
    const short = b.step(0.1, 1);
    expect(longOne.phase).toBeCloseTo(short.phase, 9);
    expect(longOne.amount).toBeCloseTo(short.amount, 9);
    const still = a.step(0, 1);
    expect(still.phase).toBeCloseTo(longOne.phase, 9);
    expect(still.amount).toBeCloseTo(longOne.amount, 9);
    const odd = a.step(NaN, NaN);
    expect(Number.isFinite(odd.phase) && Number.isFinite(odd.amount) && Number.isFinite(odd.run)).toBe(true);
  });

  it('seeds start figures out of step', () => {
    const p1 = createGait({ stride: 1, seed: 1 }).step(0, 0).phase;
    const p2 = createGait({ stride: 1, seed: 2 }).step(0, 0).phase;
    expect(Math.abs(moved(p1, p2))).toBeGreaterThan(0.1);
    expect(createGait({ stride: 1, seed: 1 }).step(0, 0).phase).toBe(p1);
  });
});

describe('turn', () => {
  it('turn eases by time, the same at 30 and 144 fps', () => {
    const at = (fps) => {
      let y = 0;
      for (let i = 0; i < fps / 2; i++) y = turn(y, 1.2, 1 / fps, 5);
      return y;
    };
    const a = at(30);
    const b = at(144);
    expect(a).toBeGreaterThan(0.5);
    expect(a).toBeLessThan(1.2);
    expect(Math.abs(a - b) / b).toBeLessThan(0.01);
  });

  it('goes the short way round and never past', () => {
    const y = turn(3, -3, 1 / 60, 5);
    expect(y).toBeGreaterThan(3); // through π, not back through 0
    let z = 0;
    for (let i = 0; i < 600; i++) z = turn(z, 1, 1 / 60, 5);
    expect(z).toBeLessThanOrEqual(1);
    expect(z).toBeCloseTo(1, 6);
  });

  it('a 1 s frame is clamped and a 0 s one does nothing', () => {
    expect(turn(0, 1, 1, 5)).toBeCloseTo(turn(0, 1, 0.1, 5), 12);
    expect(turn(0.4, 1, 0, 5)).toBe(0.4);
  });
});

describe('breathe', () => {
  it('breathe differs by seed, stays in −1…1 and repeats for one seed', () => {
    let diff = 0;
    for (let t = 0; t < 10; t += 0.1) {
      const a = breathe(t, 1);
      const b = breathe(t, 2);
      expect(a).toBeGreaterThanOrEqual(-1);
      expect(a).toBeLessThanOrEqual(1);
      expect(breathe(t, 1)).toBe(a);
      diff = Math.max(diff, Math.abs(a - b));
    }
    expect(diff).toBeGreaterThan(0.5);
  });

  it('rises and falls at a resting pace (a breath every three to five seconds)', () => {
    let crossings = 0;
    let last = breathe(0, 7);
    for (let t = 0.01; t < 30; t += 0.01) {
      const v = breathe(t, 7);
      if (last < 0 && v >= 0) crossings++;
      last = v;
    }
    expect(crossings).toBeGreaterThanOrEqual(6);
    expect(crossings).toBeLessThanOrEqual(10);
  });
});

describe('sway', () => {
  it('bobs twice a cycle and rolls once, both scaled by amount', () => {
    expect(sway(0.7, 0)).toEqual({ bob: 0, roll: 0 });
    // over each foot (phase 0, π): high and leaning onto it
    expect(sway(0, 1).bob).toBeCloseTo(1, 9);
    expect(sway(Math.PI, 1).bob).toBeCloseTo(1, 9);
    expect(sway(0, 1).roll).toBeCloseTo(-sway(Math.PI, 1).roll, 9);
    // both feet down between: low and upright
    expect(sway(Math.PI / 2, 1).bob).toBeCloseTo(0, 9);
    expect(sway(Math.PI / 2, 1).roll).toBeCloseTo(0, 9);
    for (let p = 0; p < TAU; p += 0.1) {
      const { bob, roll } = sway(p, 0.5);
      expect(bob).toBeGreaterThanOrEqual(0);
      expect(bob).toBeLessThanOrEqual(0.5 + 1e-12);
      expect(Math.abs(roll)).toBeLessThanOrEqual(0.5 + 1e-12);
    }
  });
});
