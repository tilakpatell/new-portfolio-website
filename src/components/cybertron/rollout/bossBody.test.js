import { describe, expect, it } from 'vitest';
import { createBossBody } from './bossBody';

// a boss keeping station `dz` ahead while the road goes by at `v`
const run = (body, { frames = 60, dt = 1 / 60, v = 20, boss, g = { z: 0, x: 0 }, each = null } = {}) => {
  let out = null;
  const plays = [];
  const stops = [];
  for (let i = 0; i < frames; i++) {
    each?.(i, boss, g);
    out = body.step(dt, boss, g);
    plays.push(...out.plays.map((p) => p.name));
    stops.push(...out.stop);
    g.z += v * dt;
  }
  return { out, plays, stops };
};
const aBoss = (o = {}) => ({ alive: true, x: 0, dz: 28, attack: null, exposed: 0, ...o });

describe('a Roll out boss on its feet', () => {
  it('goes backward ahead of you at the road’s pace, its legs going back a stride a turn', () => {
    const body = createBossBody({ stride: 7 });
    const boss = aBoss();
    const { out } = run(body, { boss, frames: 120 });
    expect(out.motion.speed).toBeCloseTo(-20, 0);
    expect(Math.abs(out.motion.side)).toBeLessThan(0.1);
    expect(out.motion.move).toBe(1);
    // a second more of road: 20 m, so about 20/7 strides back
    const before = out.phase;
    const { out: later } = run(body, { boss, frames: 60, g: { z: 40, x: 0 } });
    expect(later.phase - before).toBeCloseTo((-20 / 7) * Math.PI * 2, 0);
  });

  it('steps sideways as it weaves across the road (to its right, facing you, is −x)', () => {
    const body = createBossBody();
    const boss = aBoss();
    const { out } = run(body, { boss, frames: 90, v: 0, each: (i, b) => (b.x = i * (2 / 60)) });
    expect(out.motion.side).toBeCloseTo(-2, 0);
    expect(Math.abs(out.motion.speed)).toBeLessThan(0.1);
  });

  it('takes a new boss, or a jump down the road, for a jump and not a sprint', () => {
    const body = createBossBody();
    const boss = aBoss();
    run(body, { boss, frames: 30, v: 0 });
    expect(Math.abs(body.step(1 / 60, boss, { z: 900, x: 0 }).motion.speed)).toBeLessThan(0.1);
    expect(Math.abs(body.step(1 / 60, aBoss(), { z: 1900, x: 0 }).motion.speed)).toBeLessThan(0.1);
  });

  it('taunts once as it comes out, and again only for the next boss', () => {
    const body = createBossBody({ taunt: 'taunt' });
    const boss = aBoss();
    const { plays } = run(body, { boss, frames: 200 });
    expect(plays.filter((n) => n === 'taunt')).toHaveLength(1);
    const { plays: next } = run(body, { boss: aBoss(), frames: 10 });
    expect(next).toEqual(['taunt']);
  });

  it('brings its cannon arm up at you through a charge and kicks with each shot', () => {
    const body = createBossBody();
    const boss = aBoss();
    run(body, { boss, frames: 10 });
    boss.attack = { type: 'fusion', t: 0, charge: 1.1, fired: 0, active: 0 };
    const { out, plays } = run(body, { boss, frames: 40, each: (i, b) => (b.attack.t = i / 60) });
    expect(out.aim).toBeGreaterThan(0.9);
    expect(plays).not.toContain('shoot');
    const { plays: shots } = run(body, { boss, frames: 30, each: (i, b) => (b.attack.fired = i < 10 ? 1 : 2) });
    expect(shots.filter((n) => n === 'shoot')).toHaveLength(2);
    // done: the arm comes down
    boss.attack = null;
    const { out: after } = run(body, { boss, frames: 60 });
    expect(after.aim).toBeLessThan(0.1);
  });

  it('shouts for its Vehicons, and beckons its drones', () => {
    const body = createBossBody();
    const boss = aBoss();
    run(body, { boss, frames: 5 });
    boss.attack = { type: 'reinforce', t: 0, dur: 0.8 };
    expect(run(body, { boss, frames: 5 }).plays).toEqual(['shout']);
    boss.attack = { type: 'drones', t: 0, dur: 0.8 };
    expect(run(body, { boss, frames: 5 }).plays).toEqual(['beckon']);
  });

  it('is thrown back when its charge is broken, dazed while exposed, and itself again after', () => {
    const body = createBossBody();
    const boss = aBoss({ attack: { type: 'beam', t: 0.5, charge: 0.9, fired: 0 } });
    run(body, { boss, frames: 30 });
    // staggered: the attack's gone and it's exposed
    boss.attack = null;
    boss.exposed = 1.6;
    const { out, plays } = run(body, { boss, frames: 60, each: (i, b) => (b.exposed = 1.6 - i / 60) });
    expect(plays).toEqual(['hit.chest', 'headache']);
    expect(out.aim).toBeLessThan(0.1);
    boss.exposed = 0;
    const { stops } = run(body, { boss, frames: 2 });
    expect(stops).toEqual(['upper']);
  });

  it('goes over on its back when it’s beaten, once, and looks at nothing', () => {
    const body = createBossBody();
    const boss = aBoss({ attack: { type: 'cannon', t: 0.5, fired: 1 } });
    run(body, { boss, frames: 30 });
    boss.alive = false;
    const { out, plays, stops } = run(body, { boss, frames: 60 });
    expect(plays).toEqual(['die.back']);
    expect(stops).toEqual(['upper']);
    expect(out.look).toBe(false);
    expect(out.motion).toEqual({ move: 0, speed: 0, side: 0 });
    const hold = body.step(1 / 60, boss, { z: 0, x: 0 });
    expect(hold.plays).toEqual([]);
    // the next one on the same model (a run begun again) is up on its feet
    const next = body.step(1 / 60, aBoss(), { z: 0, x: 0 });
    expect(next.stop).toEqual(['full', 'upper']);
    expect(next.plays.map((p) => p.name)).toEqual(['taunt']);
  });
});
