import { describe, expect, it } from 'vitest';
import { makeWalker, pushOut } from '../../middleearth/towns/walker';
import { HERD, newHerd, stepHerd } from './daycare';
import { COLLIDERS, PEN, WALLS, WORLD, inPen } from './layout';

const DT = 1 / 30;
const { push } = makeWalker({ radius: WORLD.radius, colliders: COLLIDERS, walls: WALLS });
const run = (herd, rick, secs, each) => {
  const events = [];
  for (let t = 0; t < secs; t += DT) {
    const r = typeof rick === 'function' ? rick(herd, t) : rick;
    events.push(...stepHerd(herd, r, DT, { push }));
    each?.(herd);
  }
  return events;
};
const alone = (x, z) => {
  const h = newHerd();
  h.mortys = [{ ...h.mortys[0], x, z }];
  return h;
};

describe('Morty Day Care', () => {
  it('lets six Mortys loose round the gate, clear of everything', () => {
    const h = newHerd();
    expect(h.mortys).toHaveLength(HERD.count);
    for (const m of h.mortys) {
      expect(inPen(m.x, m.z)).toBe(false);
      expect(m.penned).toBe(false);
      expect(Math.hypot(m.x - PEN.gate.x, m.z)).toBeLessThan(14);
      const [px, pz] = pushOut(m.x, m.z, HERD.radius, COLLIDERS, WALLS);
      expect(Math.hypot(px - m.x, pz - m.z)).toBeLessThan(1e-6);
    }
    expect(newHerd(1)).toEqual(newHerd(1));
    expect(h.state).toBe('loose');
  });
  it('lets them wander slowly while Rick’s far off', () => {
    const h = newHerd();
    let before = h.mortys.map((m) => [m.x, m.z]);
    run(h, { x: 20, z: 0 }, 3, (hh) => {
      hh.mortys.forEach((m, i) => expect(Math.hypot(m.x - before[i][0], m.z - before[i][1]) / DT).toBeLessThanOrEqual(HERD.wander + 1e-6));
      before = hh.mortys.map((m) => [m.x, m.z]);
    });
  });
  it('turns a wandering Morty that walks into something, without speeding up', () => {
    const h = alone(5.5, 0);
    h.mortys[0].face = Math.PI; // walking west, into the core
    let before = [5.5, 0];
    run(h, { x: 30, z: 30 }, 4, (hh) => {
      const m = hh.mortys[0];
      expect(Math.hypot(m.x - before[0], m.z - before[1]) / DT).toBeLessThanOrEqual(HERD.wander + 1e-6);
      before = [m.x, m.z];
    });
    expect(Math.hypot(h.mortys[0].x - 5.5, h.mortys[0].z)).toBeGreaterThan(1);
  });
  it('makes a Morty run from Rick when he comes close', () => {
    const h = alone(-6, 12);
    run(h, { x: -9, z: 12 }, 0.5);
    const m = h.mortys[0];
    expect(m.x).toBeGreaterThan(-6 + HERD.flee * 0.5 * 0.7);
    expect(Math.abs(m.z - 12)).toBeLessThan(0.6);
  });
  it('slides a cornered Morty along the wall, never out of the concourse', () => {
    const h = alone(38.5, 0);
    run(h, { x: 35, z: 0 }, 3, (hh) => expect(Math.hypot(hh.mortys[0].x, hh.mortys[0].z)).toBeLessThanOrEqual(WORLD.radius));
    const m = h.mortys[0];
    expect(Math.hypot(m.x - 38.5, m.z)).toBeGreaterThan(2);
  });
  it('slides round the core instead of freezing against it', () => {
    const h = alone(5.6, 0);
    run(h, { x: 8.5, z: 0.2 }, 3);
    expect(Math.hypot(h.mortys[0].x - 5.6, h.mortys[0].z)).toBeGreaterThan(2);
  });
  it('pens a Morty herded through the gate, once', () => {
    const h = alone(-14, 0);
    const ev = run(h, (hh) => ({ x: hh.mortys[0].x + 3, z: hh.mortys[0].z }), 6);
    expect(h.mortys[0].penned).toBe(true);
    expect(inPen(h.mortys[0].x, h.mortys[0].z)).toBe(true);
    expect(ev.filter((e) => e.type === 'penned')).toEqual([{ type: 'penned', id: h.mortys[0].id }]);
  });
  it('keeps a penned Morty in the pen', () => {
    const h = alone(-24, 0);
    run(h, { x: -10, z: 0 }, 0.2);
    expect(h.mortys[0].penned).toBe(true);
    run(h, (hh, t) => ({ x: -17 + Math.cos(t) * 1.5, z: Math.sin(t) * 3 }), 20, (hh) => expect(inPen(hh.mortys[0].x, hh.mortys[0].z)).toBe(true));
  });
  it('wins once when all six are in', () => {
    const h = newHerd();
    h.mortys.forEach((m, i) => Object.assign(m, { x: -28 + i, z: 0 }));
    const ev = run(h, { x: 0, z: 30 }, 1);
    expect(ev.filter((e) => e.type === 'won')).toHaveLength(1);
    expect(h.state).toBe('won');
  });
  it('runs out of time once, with Mortys still loose', () => {
    const h = newHerd();
    const ev = run(h, { x: 0, z: 30 }, HERD.time + 1);
    expect(ev.filter((e) => e.type === 'out')).toHaveLength(1);
    expect(h.state).toBe('out');
  });
});
