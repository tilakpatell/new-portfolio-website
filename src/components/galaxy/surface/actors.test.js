import { describe, expect, it } from 'vitest';
import { fogCutoff, think } from './actors';
import { pickWant, relate } from './needs';

describe('the people out in the fog', () => {
  it('knows where the fog swallows people', () => {
    expect(fogCutoff(0.01)).toBeCloseTo(Math.sqrt(-Math.log(0.03)) / 0.01, 3);
    // (no fog: never)
    expect(fogCutoff(0)).toBe(Infinity);
  });
});

describe('what a wanderer does with what it wants and fears', () => {
  const wants = [{ id: 'diner', kind: 'food', at: [20, 0], pause: 4 }];
  const r = () => 0.5;
  const fresh = () => ({ x: 0, z: 0, yaw: 0, home: [0, 0], speed: 0, to: null, wait: 0, leg: 0, visited: {}, last: null });
  it('goes to a want of its kind, waits there as long as it says, and remembers it', () => {
    const b = fresh();
    const spec = { needs: ['food'], speed: 1.5 };
    let t = 0;
    for (; t < 40 && b.visited.diner == null; t += 1 / 30) think(b, spec, 1 / 30, r, { wants, t });
    expect(Math.hypot(b.x - 20, b.z)).toBeLessThan(1);
    expect(b.visited.diner).toBeGreaterThan(0);
    expect(b.last).toBe('diner');
    expect(b.wait).toBeCloseTo(4);
    // (and it doesn't go straight back there)
    expect(pickWant(spec, wants, b, t + 5, r)).toBe(null);
  });
  it('runs from what it fears once it has seen it, faster than it walks, and not from one behind a wall', () => {
    const b = fresh();
    const spec = { fears: ['stormtrooper'], speed: 1 };
    const trooper = { kind: 'stormtrooper', x: 6, z: 0 };
    expect(relate(b, spec, [trooper], 1, { seesThrough: () => true })).toBeTruthy();
    for (let t = 1; t < 4; t += 1 / 30) think(b, spec, 1 / 30, r, { t });
    expect(b.x).toBeLessThan(-2); // (away from +x, at 1.6×: further than a walk would get)
    const c = fresh();
    expect(relate(c, spec, [trooper], 1, { seesThrough: () => false })).toBe(null);
    for (let t = 1; t < 4; t += 1 / 30) think(c, spec, 1 / 30, r, { t });
    expect(b.x).toBeLessThan(c.x - 1); // (the one that saw it is further off, at a run)
  });
});
