import { describe, expect, it, vi } from 'vitest';
import { CONTACT } from '../../lib/combat/contact';
import { createShipHits } from './shipHits';

// your ship flies along −z (heading 0): `from` z to `to` z at `speed`
const way = (from, to, speed = 6) => [
  { x: 0, y: 0, z: from, heading: 0, pitch: 0, speed, vy: 0 },
  { x: 0, y: 0, z: to, heading: 0, pitch: 0, speed, vy: 0 },
];
const body = (key, z, extra = {}) => ({ key, id: key, kind: 'tie', at: { x: 0, y: 0, z }, size: 0.3, side: 'foe', hit: vi.fn(() => null), ...extra });

describe('the ship contact collector', () => {
  it('answers the earliest body along the way, and asks none of them to take a hit', () => {
    const far = body('far', -0.9);
    const near = body('near', -0.4);
    const hits = createShipHits({ sources: [() => [far], () => [near]] });
    const h = hits.sweep(...way(0, -1), 1 / 60, 0);
    expect(h.body).toBe(near);
    expect(far.hit).not.toHaveBeenCalled();
    expect(near.hit).not.toHaveBeenCalled();
  });

  it('never sweeps a body out of reach of the way', () => {
    const out = body('out', -0.5, { at: { x: 30, y: 0, z: -0.5 }, r: 0.2 });
    const hits = createShipHits({ sources: [() => [out]] });
    expect(hits.sweep(...way(0, -1), 1 / 60, 0)).toBeNull();
  });

  it('holds a ship for the cooldown after a contact, then lets it count again', () => {
    const b = body('b', -0.5);
    const hits = createShipHits({ sources: [() => [b]] });
    expect(hits.sweep(...way(0, -1), 1 / 60, 10)).not.toBeNull();
    expect(hits.sweep(...way(0, -1), 1 / 60, 10.34)).toBeNull();
    expect(hits.sweep(...way(0, -1), 1 / 60, 10.36)).not.toBeNull();
  });

  it('is a glance off a friend at any speed', () => {
    const w = body('w', -0.5, { side: 'friend', vel: { x: 0, y: 0, z: 14 } });
    const hits = createShipHits({ sources: [() => [w]] });
    const h = hits.sweep(...way(0, -1, 6), 1 / 60, 0);
    expect(h.into).toBeCloseTo(20, 5);
    expect(h.outcome).toEqual({ kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance });
  });

  it('a ram off a foe at the same speed', () => {
    const f = body('f', -0.5, { vel: { x: 0, y: 0, z: 14 } });
    const hits = createShipHits({ sources: [() => [f]] });
    expect(hits.sweep(...way(0, -1, 6), 1 / 60, 0).outcome.kind).toBe('ram');
  });

  it('finds a body in the middle of a way 40 units long', () => {
    const mid = body('mid', -20);
    const hits = createShipHits({ sources: [() => [mid]] });
    const h = hits.sweep(...way(0, -40, 12), 1 / 60, 0);
    expect(h.body).toBe(mid);
    expect(h.into).toBeCloseTo(12, 5); // from the velocities, never the way over dt
  });

  it('sweeps a body with no last place where it is, closing at your speed alone', () => {
    const still = body('still', -0.5);
    const hits = createShipHits({ sources: [() => [still]] });
    const h = hits.sweep(...way(0, -1, 6), 1 / 60, 0);
    expect(h.into).toBeCloseTo(6, 5);
  });

  it('takes a body’s speed from where it was last frame when it gives no velocity', () => {
    const coming = body('coming', -0.5, { prev: { x: 0, y: 0, z: -0.6 }, at: { x: 0, y: 0, z: -0.5 } });
    const hits = createShipHits({ sources: [() => [coming]] });
    const h = hits.sweep(...way(0, -1, 6), 0.05, 0);
    expect(h.into).toBeCloseTo(6 + 0.1 / 0.05, 5);
  });

  it('answers where you met, where the other was then, and a unit normal from it toward you', () => {
    const r = 0.23 + 0.15; // bodyRadius(0.3) + SHIP.radius
    const side = body('side', -0.5, { at: { x: 0.2, y: 0, z: -0.5 } });
    const hits = createShipHits({ sources: [() => [side]] });
    const h = hits.sweep(...way(0, -1), 1 / 60, 0);
    // you came within r of it at z = −0.5 + sqrt(r² − 0.2²)
    const z = -0.5 + Math.sqrt(r * r - 0.04);
    expect(h.k).toBeCloseTo(-z, 5);
    expect(h.at).toEqual({ x: 0, y: 0, z: expect.closeTo(z, 5) });
    expect(h.place).toEqual({ x: 0.2, y: 0, z: -0.5 });
    expect(Math.hypot(h.normal.x, h.normal.y, h.normal.z)).toBeCloseTo(1, 6);
    expect(h.normal.x).toBeLessThan(0); // it is to your right, so the push is to your left
    expect(h.normal.z).toBeGreaterThan(0); // and back the way you came
  });

  it('skips a source that is missing or answers nothing', () => {
    const b = body('b', -0.5);
    const hits = createShipHits({ sources: [null, () => null, () => [b]] });
    expect(hits.sweep(...way(0, -1), 1 / 60, 0).body).toBe(b);
  });
});
