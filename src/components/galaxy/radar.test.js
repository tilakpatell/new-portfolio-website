import { describe, expect, it } from 'vitest';
import { forward } from '../universe/ship';
import { RANGE, radarPoints, rangeFor } from './radar';

const ship = { x: 0, y: 0, z: 0, heading: 0 };
// forward(h) is the ship's nose as [x, z]: ahead is where it points, whatever the convention
const [fx, fz] = forward(0);
const ahead = (d) => ({ x: fx * d, y: 0, z: fz * d });

describe('radar', () => {
  it('puts what is ahead at the top, on the centre line', () => {
    const [p] = radarPoints(ship, [{ id: 'a', kind: 'hostile', at: ahead(20) }], 40);
    expect(p.y).toBeCloseTo(0.5);
    expect(Math.abs(p.x)).toBeLessThan(1e-6);
    expect(p.rim).toBe(false);
  });
  it('pins what is out of range to the rim', () => {
    const [p] = radarPoints(ship, [{ id: 'a', kind: 'hostile', at: ahead(400) }], 40);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1);
    expect(p.rim).toBe(true);
  });
  it('says above or below', () => {
    const pts = radarPoints(
      ship,
      [
        { id: 'u', kind: 'ally', at: { ...ahead(10), y: 8 } },
        { id: 'd', kind: 'ally', at: [fx * 10, -8, fz * 10] },
        { id: 'l', kind: 'ally', at: [fx * 10, 1, fz * 10] },
      ],
      40,
    );
    expect(pts.map((p) => p.up)).toEqual([1, -1, 0]);
  });
  it('turns with the ship: what was ahead is behind after half a turn', () => {
    const [p] = radarPoints({ ...ship, heading: Math.PI }, [{ id: 'a', kind: 'hostile', at: ahead(20) }], 40);
    expect(p.y).toBeCloseTo(-0.5);
  });
  it('puts the ship’s right on the right', () => {
    // a quarter turn round from the nose, clockwise seen from above (the right of a ship whose up is +y)
    const right = { x: -fz * 10, y: 0, z: fx * 10 };
    const [r] = radarPoints(ship, [{ id: 'r', kind: 'hostile', at: right }], 40);
    expect(r.x).toBeCloseTo(0.25);
    expect(Math.abs(r.y)).toBeLessThan(1e-6);
    const [l] = radarPoints(ship, [{ id: 'l', kind: 'hostile', at: { x: fz * 10, y: 0, z: -fx * 10 } }], 40);
    expect(l.x).toBeCloseTo(-0.25);
  });
  it('closes in when a hostile is near', () => {
    expect(rangeFor(ship, [{ at: ahead(30) }])).toBe(RANGE.fight);
    expect(rangeFor(ship, [{ at: ahead(90) }])).toBe(RANGE.cruise);
    expect(rangeFor(ship, [])).toBe(RANGE.cruise);
  });
});
