import { describe, expect, it } from 'vitest';
import { FLY, newHero, stepHero } from './flight';
import { WORLD, buildWorld } from './map';
import { BODIES, SPACE, altitudeOf, intoSpace, outOfSpace, stepSpace } from './orbit';

const W = buildWorld();
const still = { fwd: 0, side: 0, up: 0, down: 0, boost: false, run: false, jump: false, look: [0, 1, 0] };
function go(h, input, t, dt = 1 / 30) {
  const ev = [];
  for (let s = 0; s < t; s += dt) {
    h = stepSpace(h, typeof input === 'function' ? input(h, s) : input, dt);
    ev.push(...h.ev);
  }
  return { h, ev };
}
const toward = (h, c) => {
  const d = [c[0] - h.p[0], c[1] - h.p[1], c[2] - h.p[2]];
  const l = Math.hypot(...d);
  return d.map((v) => v / l);
};

describe('leaving the sky', () => {
  it('lets him climb out of the city’s air, and says when he’s through', () => {
    let h = { ...newHero({ x: 0, y: WORLD.ceiling - 200, z: 0 }), mode: 'air' };
    const ev = [];
    for (let s = 0; s < 4; s += 1 / 30) {
      h = stepHero(h, { ...still, boost: true, look: [0, 1, 0] }, 1 / 30, W);
      ev.push(...h.ev);
    }
    expect(ev.filter((e) => e.type === 'exit')).toHaveLength(1);
  });
  it('puts him over the city, where he left it, going the same way', () => {
    const h = { ...newHero({ x: 300, y: WORLD.ceiling, z: -200 }), mode: 'air', v: [0, 250, 0], spd: 250, dir: [0, 1, 0] };
    const s = intoSpace(h);
    expect(s.zone).toBe('space');
    expect(altitudeOf(s)).toBeCloseTo(WORLD.ceiling, -1);
    expect(s.v[1]).toBeCloseTo(250, 5);
  });
});

describe('in space', () => {
  const start = () => intoSpace({ ...newHero({ x: 0, y: WORLD.ceiling, z: 0 }), mode: 'air', v: [0, 200, 0], spd: 200, dir: [0, 1, 0] });
  it('drifts where he was going, with nothing to slow him but himself', () => {
    const { h } = go(start(), still, 2);
    expect(altitudeOf(h)).toBeGreaterThan(WORLD.ceiling + 50);
  });
  it('goes far faster flat out than in the air', () => {
    const { h } = go(start(), { ...still, boost: true }, 6);
    expect(Math.hypot(...h.v)).toBeGreaterThan(SPACE.top * 0.9);
    expect(SPACE.top).toBeGreaterThan(FLY.top * 10);
  });
  it('gets to the Moon and stands on it', () => {
    const moon = BODIES.find((b) => b.id === 'moon');
    const { h, ev } = go(start(), (hh) => ({ ...still, boost: true, look: toward(hh, moon.c) }), 90);
    expect(ev.some((e) => e.type === 'land' && e.body === 'moon')).toBe(true);
    expect(h.mode).toBe('perch');
    expect(Math.hypot(h.p[0] - moon.c[0], h.p[1] - moon.c[1], h.p[2] - moon.c[2])).toBeCloseTo(moon.r, 0);
  });
  it('jumps off it again', () => {
    const moon = BODIES.find((b) => b.id === 'moon');
    const landed = go(start(), (hh) => ({ ...still, boost: true, look: toward(hh, moon.c) }), 90).h;
    const { h } = go(landed, (_, s) => ({ ...still, jump: s === 0 }), 1);
    expect(h.mode).toBe('air');
    expect(Math.hypot(h.p[0] - moon.c[0], h.p[1] - moon.c[1], h.p[2] - moon.c[2])).toBeGreaterThan(moon.r + 5);
  });
  it('comes back down into the air, and over the city again', () => {
    const { h, ev } = go(start(), { ...still, down: 1, look: [0, -1, 0], boost: true }, 10);
    expect(ev.some((e) => e.type === 'reenter')).toBe(true);
    const back = outOfSpace(h);
    expect(back.zone).toBe('city');
    expect(back.p[1]).toBeLessThan(WORLD.ceiling);
    expect(Math.abs(back.p[0])).toBeLessThanOrEqual(WORLD.half);
    expect(back.v[1]).toBeLessThan(0);
  });
});
