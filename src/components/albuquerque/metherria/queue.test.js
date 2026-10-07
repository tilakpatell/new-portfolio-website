import { describe, expect, it } from 'vitest';
import { QUEUE, createQueue } from './queue';

const DT = 1 / 60;
const ENTER = { x: -7.4, z: -2.6 };
const LEAVE = { x: -1.4, z: -2.4 };
const spot = (id, x, z, face = 0) => ({ id, x, z, face });
const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
// every frame's step, checked: never faster than the pace, never turning faster than the cap
const walk = (q, seconds, wanted, seen = new Map()) => {
  let out = [];
  for (let i = 0; i < seconds / DT; i++) {
    out = q.step(DT, wanted);
    for (const w of out) {
      const was = seen.get(w.id);
      if (was) {
        expect(Math.hypot(w.x - was.x, w.z - was.z), w.id).toBeLessThanOrEqual(QUEUE.pace * DT + 1e-6);
        expect(Math.abs(wrap(w.yaw - was.yaw)), w.id).toBeLessThanOrEqual(QUEUE.turnMax * DT + 1e-6);
      }
      seen.set(w.id, { x: w.x, z: w.z, yaw: w.yaw });
    }
  }
  return out;
};

describe('the line at the hatch', () => {
  it('walks a newcomer in from the side to their place, and turns them to the hatch', () => {
    const q = createQueue({ enter: ENTER, leave: LEAVE });
    const first = q.step(DT, [spot('saul', -4.4, -1.25, 0)]);
    expect(first[0]).toMatchObject({ id: 'saul' });
    expect(Math.hypot(first[0].x - ENTER.x, first[0].z - ENTER.z)).toBeLessThan(0.05);
    const out = walk(q, 8, [spot('saul', -4.4, -1.25, 0)]);
    const s = out.find((w) => w.id === 'saul');
    expect(Math.hypot(s.x + 4.4, s.z + 1.25)).toBeLessThan(0.02);
    expect(Math.abs(wrap(s.yaw))).toBeLessThan(0.05);
    expect(s.arrived).toBe(true);
    expect(s.speed).toBeLessThan(0.05);
  });

  it('moves everyone up a place when the front one’s served, a step at a time', () => {
    const q = createQueue({ enter: ENTER, leave: LEAVE });
    const line = [spot('a', -4.4, -1.25), spot('b', -4.75, -1.85), spot('c', -4.05, -2.2)];
    walk(q, 12, line);
    // a is served and goes; b and c step up
    const seen = new Map();
    const out = walk(q, 10, [spot('b', -4.4, -1.25), spot('c', -4.75, -1.85)], seen);
    const at = (id) => out.find((w) => w.id === id);
    expect(Math.hypot(at('b').x + 4.4, at('b').z + 1.25)).toBeLessThan(0.02);
    expect(Math.hypot(at('c').x + 4.75, at('c').z + 1.85)).toBeLessThan(0.02);
    // and a walked off, and is gone
    expect(at('a')).toBeUndefined();
    expect(q.has('a')).toBe(false);
  });

  it('walks one who leaves off toward the side, facing the way they go', () => {
    const q = createQueue({ enter: ENTER, leave: LEAVE });
    walk(q, 10, [spot('a', -4.4, -1.25)]);
    let out = [];
    for (let i = 0; i < 40; i++) out = q.step(DT, []);
    const a = out.find((w) => w.id === 'a');
    expect(a.leaving).toBe(true);
    expect(a.x).toBeGreaterThan(-4.4);
    // (facing roughly toward where they're going)
    const to = Math.atan2(LEAVE.x - a.x, LEAVE.z - a.z);
    expect(Math.abs(wrap(a.yaw - to))).toBeLessThan(0.8);
  });

  it('turns back one who leaves and is wanted again', () => {
    const q = createQueue({ enter: ENTER, leave: LEAVE });
    walk(q, 10, [spot('a', -4.4, -1.25)]);
    for (let i = 0; i < 30; i++) q.step(DT, []);
    const out = walk(q, 8, [spot('a', -4.4, -1.25)]);
    expect(out[0].leaving).toBe(false);
    expect(Math.hypot(out[0].x + 4.4, out[0].z + 1.25)).toBeLessThan(0.02);
  });

  it('puts someone straight where they’re wanted when there’s been no time (a jump in the clock)', () => {
    const q = createQueue({ enter: ENTER, leave: LEAVE });
    const out = q.step(0, [spot('a', -4.4, -1.25)]);
    expect(Number.isFinite(out[0].x)).toBe(true);
  });
});
