import { describe, expect, it } from 'vitest';
import { apart, awayFrom, candidates, cover, nearTo, offLine, pickPlace, scorePlace, visible } from './spatial';

const P = (x, z) => ({ x, y: 0, z });
// a wall along x = 5: nothing sees across it
const wall = (a, b) => (a.x < 5) === (b.x < 5);

describe('picking a place', () => {
  it('candidates ring a point and keep to what’s walkable', () => {
    expect(candidates(P(0, 0), { ring: 2, n: 4 })).toHaveLength(4);
    expect(candidates(P(0, 0), { ring: 2, n: 4, walkable: (x) => x >= 0 })).toHaveLength(3);
  });

  it('cover picks the point the threat can’t see; visible the one it can', () => {
    const threat = P(0, 0);
    const pts = [P(2, 0), P(8, 0)];
    expect(pickPlace(pts, [cover([threat], wall)]).at).toEqual(P(8, 0));
    expect(pickPlace(pts, [visible(threat, wall)]).at).toEqual(P(2, 0));
    expect(pickPlace([], [cover([threat], wall)])).toBeNull();
  });

  it('keeps its point under hysteresis, and swaps past it', () => {
    const tests = [nearTo(P(0, 0), 10)];
    const kept = pickPlace([P(0, 1.2)], tests, { current: P(0, 1.5) });
    expect(kept.kept).toBe(true);
    expect(kept.at).toEqual(P(0, 1.5));
    const swapped = pickPlace([P(0, 0.5)], tests, { current: P(0, 5) });
    expect(swapped.kept).toBe(false);
    expect(swapped.at).toEqual(P(0, 0.5));
  });

  it('bias breaks a symmetric tie the same way every time', () => {
    const tests = [nearTo(P(0, 0), 10)];
    const pts = [P(-3, 0), P(3, 0)];
    const bias = (p) => (p.x > 0 ? 0.02 : 0);
    for (let i = 0; i < 5; i++) expect(pickPlace(pts, tests, { bias }).at).toEqual(P(3, 0));
  });

  it('offLine keeps out of a friend’s fire; apart keeps spacing; awayFrom runs', () => {
    const ally = P(0, 0);
    const threat = P(10, 0);
    expect(scorePlace(P(5, 0.3), [offLine([ally], threat, 1)])).toBe(0);
    expect(scorePlace(P(5, 3), [offLine([ally], threat, 1)])).toBe(1);
    expect(scorePlace(P(0, 0), [apart([P(1, 0)], 2)])).toBe(0);
    expect(scorePlace(P(0, 0), [apart([P(3, 0)], 2)])).toBe(1);
    expect(pickPlace([P(1, 0), P(9, 0)], [awayFrom(P(0, 0), 10)]).at).toEqual(P(9, 0));
  });

  it('normalisation: relative ranks within the set, unclamped keeps growing, targeted peaks', () => {
    const count = (p) => p.x; // "enemies in range"
    const rel = { value: count, norm: 'relative' };
    expect(scorePlace(P(2, 0), [rel], [[1, 2, 3]])).toBeCloseTo(0.5);
    const un = { value: count, norm: 'unclamped', bookends: [0, 1], weight: -2 };
    expect(scorePlace(P(3, 0), [un])).toBe(-6);
    const tg = { value: count, norm: 'targeted', target: 30, width: 10 };
    expect(scorePlace(P(30, 0), [tg])).toBe(1);
    expect(scorePlace(P(35, 0), [tg])).toBeCloseTo(0.5);
    expect(scorePlace(P(50, 0), [tg])).toBe(0);
  });
});
