import { describe, expect, it } from 'vitest';
import { arc, flight, launch } from './ballistics';
import { createBolts } from './bolt';

const BOLT = { speed: 350, gravity: 0, drag: 0, ttl: 3 };
const GRENADE = { speed: 18, gravity: -9.8, drag: 0.4, ttl: 20 };

// fly a thing from `from` until it comes down through y = 0; where it lands
function landing(row, dt) {
  const b = { pos: [0, 1.5, 0], vel: launch(row, [1, 1, 0], row.speed), life: 0 };
  for (let i = 0; i < 100000; i++) {
    const was = b.pos;
    flight(row, b, dt);
    if (b.pos[1] <= 0) {
      const t = was[1] / (was[1] - b.pos[1]);
      return [was[0] + (b.pos[0] - was[0]) * t, 0, was[2] + (b.pos[2] - was[2]) * t];
    }
  }
  return null;
}

describe('a bolt’s flight by its row', () => {
  it('with no gravity and no drag moves speed · dt, as bolt.js does, over 60 steps', () => {
    const row = { ...BOLT, speed: 90 };
    const b = { pos: [1, 2, 3], vel: launch(row, [0.3, 0.1, -1]), life: 0 };
    const l = Math.hypot(0.3, 0.1, -1);
    const dir = [0.3 / l, 0.1 / l, -1 / l];
    const plain = [1, 2, 3];
    for (let i = 0; i < 60; i++) {
      flight(row, b, 1 / 60);
      for (let k = 0; k < 3; k++) plain[k] += dir[k] * 90 * (1 / 60);
      for (let k = 0; k < 3; k++) expect(Math.abs(b.pos[k] - plain[k])).toBeLessThan(1e-9);
    }
  });

  it('flies the same in bolt.js with a gravity-0 row as without one', () => {
    const plain = createBolts();
    const rowed = createBolts();
    const a = plain.fire({ from: [0, 1, 0], dir: [0, 0.05, 1], speed: 90, range: 1000 });
    const b = rowed.fire({ from: [0, 1, 0], dir: [0, 0.05, 1], speed: 90, range: 1000, ballistic: { ...BOLT, ttl: 0 } });
    for (let i = 0; i < 60; i++) {
      plain.step(1 / 60, null);
      rowed.step(1 / 60, null);
      for (let k = 0; k < 3; k++) expect(Math.abs(a.pos[k] - b.pos[k])).toBeLessThan(1e-9);
    }
  });

  it('applies drag per second over dt: the landing point is the same at 1/30 and 1/120', () => {
    const coarse = landing(GRENADE, 1 / 30);
    const fine = landing(GRENADE, 1 / 120);
    expect(Math.hypot(coarse[0] - fine[0], coarse[2] - fine[2])).toBeLessThan(0.01);
  });

  it('lands where the closed form says (no drag)', () => {
    const row = { speed: 10, gravity: -9.8, drag: 0, ttl: 0 };
    const at = landing({ ...row }, 1 / 60);
    // from 1.5 m at 45°: x where 1.5 + v t − g t²/2 = 0
    const v = 10 / Math.SQRT2;
    const t = (v + Math.sqrt(v * v + 2 * 9.8 * 1.5)) / 9.8;
    expect(at[0]).toBeCloseTo(v * t, 3);
  });

  it('is gone once its life reaches the ttl, and stops there', () => {
    const b = { pos: [0, 0, 0], vel: [0, 0, 100], life: 0 };
    let gone = false;
    for (let i = 0; i < 200 && !gone; i++) gone = flight({ ...BOLT, ttl: 1 }, b, 1 / 60).gone;
    expect(gone).toBe(true);
    expect(b.life).toBeCloseTo(1, 9);
    expect(b.pos[2]).toBeCloseTo(100, 6);
  });

  it('holds the speed under maxSpeed', () => {
    const row = { speed: 8000, maxSpeed: 1000, gravity: 0, drag: 0, ttl: 3 };
    const v = launch(row, [0, 0, 1]);
    expect(v[2]).toBe(1000);
    const b = { pos: [0, 0, 0], vel: [0, 0, 1000], life: 0 };
    flight({ ...row, gravity: -500 }, b, 1);
    expect(Math.hypot(...b.vel)).toBeCloseTo(1000, 6);
  });

  it('a ballistic bolt in bolt.js falls, hits the floor and reports gone at its ttl', () => {
    const bolts = createBolts();
    const floor = (a, e) => (e[1] < 0 ? { at: [a[0] + ((e[0] - a[0]) * a[1]) / (a[1] - e[1]), 0, a[2] + ((e[2] - a[2]) * a[1]) / (a[1] - e[1])], normal: [0, 1, 0] } : null);
    bolts.fire({ from: [0, 1, 0], dir: [0, 0, 1], speed: 10, range: 1000, ballistic: { speed: 10, gravity: -9.8, drag: 0, ttl: 5 } });
    let hit = null;
    for (let i = 0; i < 120 && !hit; i++) hit = bolts.step(1 / 60, { solids: floor }).find((e) => e.type === 'solid');
    expect(hit).toBeTruthy();
    expect(hit.at[2]).toBeCloseTo(10 * Math.sqrt(2 / 9.8), 1);
    const late = createBolts();
    late.fire({ from: [0, 100, 0], dir: [1, 0, 0], speed: 5, range: 1000, ballistic: { speed: 5, gravity: 0, drag: 0, ttl: 0.5 } });
    const events = [];
    for (let i = 0; i < 40; i++) events.push(...late.step(1 / 60, null));
    expect(events.filter((e) => e.type === 'gone')).toHaveLength(1);
    expect(late.live()).toHaveLength(0);
  });

  it('draws a thrown thing’s arc, stopped under the floor', () => {
    const pts = arc({ speed: 12, gravity: -9.8, drag: 0, ttl: 10 }, [0, 1.5, 0], [0, 1, 1], { floor: 0 });
    expect(pts[0]).toEqual([0, 1.5, 0]);
    expect(pts.at(-1)[1]).toBeLessThan(0);
    expect(pts.at(-2)[1]).toBeGreaterThanOrEqual(0);
  });
});
