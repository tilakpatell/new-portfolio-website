import { describe, expect, it } from 'vitest';
import { HITSTOP, KNOCK_MASS, atLeast, deadZone, knockForce } from './mapFeel';
import { createFeel } from '../../lib/three/feel';
import { createImpacts } from '../../lib/impact';

describe('the drag stick’s dead zone', () => {
  const full = 70;
  it('reads a drag inside a tenth of the throw as no drag', () => {
    expect(deadZone(3, -4, full)).toEqual([0, 0]);
    expect(deadZone(6.9, 0, full)).toEqual([0, 0]);
  });
  it('rescales past it, so the full throw is still the full throw', () => {
    const [x, y] = deadZone(full, 0, full);
    expect(x).toBeCloseTo(full, 9);
    expect(y).toBe(0);
    const [a, b] = deadZone(0, -full, full);
    expect(a).toBeCloseTo(0, 9);
    expect(b).toBeCloseTo(-full, 9);
  });
  it('keeps the drag’s direction, and grows from nothing at the edge', () => {
    const [x, y] = deadZone(30, 40, full);
    expect(y / x).toBeCloseTo(40 / 30, 9);
    const [e] = deadZone(7.01, 0, full);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(0.1);
  });
  it('a bigger drag setting (a shorter throw) shrinks the dead zone with it', () => {
    expect(deadZone(5, 0, 70)).toEqual([0, 0]);
    expect(deadZone(3, 0, 35)).toEqual([0, 0]);
    expect(deadZone(5, 0, 35)[0]).toBeGreaterThan(0);
  });
});

describe('a knock’s force', () => {
  const crash = 2.4;
  it('is the speed into it times the mass, so a crash is a full hit', () => {
    expect(knockForce({ type: 'crash', speed: crash }, crash)).toBeCloseTo(crash * KNOCK_MASS, 9);
    expect(createImpacts().hit(knockForce({ type: 'crash', speed: crash }, crash), 'x').gain).toBe(1);
  });
  it('reads a bump’s speed when it carries one, else guesses by how hard', () => {
    expect(knockForce({ type: 'bump', into: 1 }, crash)).toBeCloseTo(KNOCK_MASS, 9);
    const soft = knockForce({ type: 'bump', hard: false }, crash);
    const hard = knockForce({ type: 'bump', hard: true }, crash);
    expect(hard).toBeGreaterThan(soft);
    expect(hard).toBeLessThan(crash * KNOCK_MASS);
  });
  it('makes a hard bump louder than a soft one, and both quieter than a crash', () => {
    const law = createImpacts({ gap: 0 });
    const g = (e) => law.hit(knockForce(e, crash), Math.random())?.gain ?? 0;
    expect(g({ type: 'bump', hard: true })).toBeGreaterThan(g({ type: 'bump', hard: false }));
    expect(g({ type: 'crash', speed: crash })).toBeGreaterThan(g({ type: 'bump', hard: true }));
  });
});

describe('the shake held at least', () => {
  it('raises the trauma to k, never past what it has', () => {
    const feel = createFeel({ calm: true });
    atLeast(feel, 0.4);
    expect(feel.state().trauma).toBeCloseTo(0.4, 9);
    atLeast(feel, 0.2);
    expect(feel.state().trauma).toBeCloseTo(0.4, 9);
    atLeast(feel, 0.9);
    expect(feel.state().trauma).toBeCloseTo(0.9, 9);
  });
  it('holds a held shake steady rather than piling it up', () => {
    const feel = createFeel({ calm: true });
    for (let i = 0; i < 60; i++) atLeast(feel, 0.3);
    expect(feel.state().trauma).toBeCloseTo(0.3, 9);
  });
});

describe('hitstop', () => {
  it('holds a crash longer than a kill, both short', () => {
    expect(HITSTOP.crash).toBeGreaterThan(HITSTOP.kill);
    expect(HITSTOP.kill).toBeGreaterThanOrEqual(60);
    expect(HITSTOP.crash).toBeLessThanOrEqual(90);
  });
});
