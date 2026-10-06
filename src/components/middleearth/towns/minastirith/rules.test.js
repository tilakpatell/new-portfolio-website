import { describe, expect, it } from 'vitest';
import { COVERS, PILE } from './layout';
import { RIDE, SIEGE, SNEAK, exposed, flightOf, lightBeacon, loose, newRide, newSiege, newSneak, rangeOf, stepRide, stepSiege, stepSneak } from './rules';

const run = (step, state, secs, input, dt = 0.05) => {
  const ev = [];
  for (let t = 0; t < secs; t += dt) ev.push(...step(state, dt, typeof input === 'function' ? input(state) : input));
  return ev;
};

describe('the seven gates', () => {
  const opts = { slots: [[20, 60]], gates: [10, 40, 90], len: 100 };
  it('puts things in the way only on the slots', () => {
    const r = newRide(5, opts);
    expect(r.things.length).toBeGreaterThan(2);
    for (const o of r.things) {
      expect(o.s).toBeGreaterThanOrEqual(20);
      expect(o.s).toBeLessThan(60);
      expect(Math.abs(o.lane)).toBeLessThanOrEqual(1);
    }
  });
  it('rides to the top, passing every gate in order', () => {
    const r = newRide(5, { ...opts, slots: [] });
    const ev = run(stepRide, r, 20, { spur: true });
    expect(ev.filter((e) => e.type === 'gate').map((e) => e.i)).toEqual([0, 1, 2]);
    expect(ev.at(-1).type).toBe('top');
    expect(r.state).toBe('done');
  });
  it('knocks into what is in its lane, once each, and slows', () => {
    const r = newRide(5, opts);
    r.things = [{ s: 30, lane: 0, kind: 'cart', hit: false }];
    const ev = run(stepRide, r, 6, { steer: 0 });
    expect(ev.filter((e) => e.type === 'knock')).toEqual([{ type: 'knock', kind: 'cart' }]);
    expect(r.knocks).toBe(1);
  });
  it('steers round it', () => {
    const r = newRide(5, opts);
    r.things = [{ s: 30, lane: -0.85, kind: 'hens', hit: false }];
    const ev = run(stepRide, r, 6, { steer: 1 });
    expect(ev.some((e) => e.type === 'knock')).toBe(false);
    expect(r.lane).toBe(1);
  });
  it('gallops faster than it canters', () => {
    const a = newRide(1, opts);
    const b = newRide(1, opts);
    a.things = [];
    b.things = [];
    run(stepRide, a, 3, { spur: false });
    run(stepRide, b, 3, { spur: true });
    expect(b.s).toBeGreaterThan(a.s);
    expect(a.v).toBeLessThanOrEqual(RIDE.canter + 0.01);
  });
});

describe('the beacon', () => {
  it('warns before the guard looks, then lets him eat again', () => {
    const n = newSneak(3);
    const ev = run(stepSneak, n, 20, 0).map((e) => e.type);
    const i = ev.indexOf('stir');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(ev[i + 1]).toBe('look');
    expect(ev[i + 2]).toBe('eat');
  });
  it('sends you back to the last rock if he sees you move', () => {
    const n = newSneak(3);
    n.s = COVERS[1].s + 2;
    n.phase = 'look';
    n.phaseT = 2;
    const ev = stepSneak(n, 0.05, 1);
    expect(ev.map((e) => e.type)).toContain('caught');
    expect(n.s).toBe(COVERS[1].s);
    expect(n.caught).toBe(1);
  });
  it('lets you keep still in the open while he looks, far off', () => {
    const n = newSneak(3);
    n.s = 3;
    n.phase = 'look';
    n.phaseT = 2;
    expect(stepSneak(n, 0.05, 0).map((e) => e.type)).not.toContain('caught');
    expect(exposed(n)).toBe(false);
  });
  it('sees you standing in the open close to him, short of the pile', () => {
    const n = newSneak(3);
    n.s = SNEAK.near + 1;
    n.phase = 'look';
    n.phaseT = 2;
    expect(stepSneak(n, 0.05, 0).map((e) => e.type)).toContain('caught');
  });
  it('goes along to the pile, up it and lights it, if he never looks', () => {
    const n = newSneak(3);
    const ev = [];
    for (let t = 0; t < 30 && n.state !== 'ready'; t += 0.05) {
      n.phase = 'eat';
      n.phaseT = 5;
      ev.push(...stepSneak(n, 0.05, 1));
    }
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['cover', 'pile', 'top']));
    expect(n.s).toBe(PILE.s);
    expect(n.climb).toBe(1);
    expect(lightBeacon(n)).toBe('lit');
    expect(n.state).toBe('lit');
  });
  it('will not light it from the ground', () => {
    expect(lightBeacon(newSneak(1))).toBe('notyet');
  });
});

describe('the siege', () => {
  it('swings the range out and back between near and far', () => {
    const g = newSiege(2);
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < SIEGE.sweep * 2; t += 0.05) {
      stepSiege(g, 0.05);
      lo = Math.min(lo, g.aim);
      hi = Math.max(hi, g.aim);
      if (g.state !== 'on') break;
    }
    expect(lo).toBeLessThan(0.1);
    expect(hi).toBeGreaterThan(0.9);
    expect(rangeOf(0)).toBe(SIEGE.near);
    expect(rangeOf(1)).toBe(SIEGE.far);
  });
  it('brings towers on, and loses if one reaches the wall', () => {
    const g = newSiege(4);
    const ev = run(stepSiege, g, 90, undefined).map((e) => e.type);
    expect(ev).toContain('tower');
    expect(ev).toContain('breach');
    expect(g.state).toBe('lost');
  });
  it('takes time to wind again after loosing', () => {
    const g = newSiege(4);
    expect(loose(g)).toBe('loosed');
    expect(loose(g)).toBe('loading');
    const ev = run(stepSiege, g, SIEGE.reload + 0.1, undefined).map((e) => e.type);
    expect(ev).toContain('loaded');
    expect(loose(g)).toBe('loosed');
  });
  it('fells a tower where the stone comes down', () => {
    const g = newSiege(4);
    g.towers.push({ i: 0, d: 120, v: 0, lane: 0, state: 'on' });
    g.made = 1;
    g.nextT = 99;
    g.aim = (120 - SIEGE.near) / (SIEGE.far - SIEGE.near);
    expect(loose(g)).toBe('loosed');
    expect(flightOf(g.shots[0])).toBe(0);
    const ev = [];
    for (let t = 0; t < SIEGE.flight + 0.1; t += 0.05) ev.push(...stepSiege(g, 0.05));
    expect(ev).toContainEqual({ type: 'fall', i: 0 });
    expect(g.felled).toBe(1);
  });
  it('misses when it lands wide', () => {
    const g = newSiege(4);
    g.towers.push({ i: 0, d: 200, v: 0, lane: 0, state: 'on' });
    g.nextT = 99;
    g.aim = 0;
    loose(g);
    const ev = [];
    for (let t = 0; t < SIEGE.flight + 0.1; t += 0.05) ev.push(...stepSiege(g, 0.05));
    expect(ev.find((e) => e.type === 'land')).toMatchObject({ hit: false });
  });
  it('is won when enough towers fall', () => {
    const g = newSiege(4);
    g.felled = SIEGE.need - 1;
    g.towers.push({ i: 0, d: 120, v: 0, lane: 0, state: 'on' });
    g.nextT = 99;
    g.aim = (120 - SIEGE.near) / (SIEGE.far - SIEGE.near);
    loose(g);
    const ev = [];
    for (let t = 0; t < SIEGE.flight + 0.1; t += 0.05) ev.push(...stepSiege(g, 0.05));
    expect(ev.at(-1)).toEqual({ type: 'won' });
    expect(g.state).toBe('won');
  });
  it('shakes the range when a fell beast screams', () => {
    const g = newSiege(4);
    g.nextT = 99;
    g.dreadT = 0.01;
    const ev = run(stepSiege, g, SIEGE.dreadFor + 0.3, undefined).map((e) => e.type);
    expect(ev).toEqual(expect.arrayContaining(['dread', 'calm']));
  });
});
