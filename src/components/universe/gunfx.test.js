import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bounce } from './gunfx';

const V = THREE.Vector3;
// flat ground at y = 0, and a planet's (a sphere of radius 10)
const flat = (p) => ({ h: p.y, n: new V(0, 1, 0) });
const sphere = (p) => ({ h: p.length() - 10, n: p.clone().normalize() });

describe('something small falling and bouncing', () => {
  it('falls, bounces lower each time, and comes to rest on the ground', () => {
    const p = new V(0, 1, 0);
    const v = new V(1, 2, 0);
    let bounces = 0;
    let peak = 0;
    let peaks = [];
    let rising = true;
    for (let t = 0; t < 6; t += 1 / 60) {
      if (bounce(p, v, 1 / 60, 1, flat, 0.35, 0.55)) bounces++;
      expect(p.y).toBeGreaterThanOrEqual(-1e-9); // never under the ground
      if (rising && v.y < 0) {
        peaks.push(p.y);
        rising = false;
      }
      if (v.y > 0) rising = true;
      peak = Math.max(peak, p.y);
    }
    expect(bounces).toBeGreaterThan(2);
    expect(peaks[1]).toBeLessThan(peaks[0] * 0.4); // a fraction of the height back
    expect(Math.abs(v.y)).toBeLessThan(0.3);
    expect(p.y).toBeLessThan(0.02);
    expect(p.x).toBeGreaterThan(0.2); // it went along a little before stopping
  });

  it('falls toward the middle of a planet, in its units', () => {
    const unit = 0.027;
    const p = new V(0, 0, 10 + 0.5 * unit);
    const v = new V();
    for (let t = 0; t < 2; t += 1 / 60) bounce(p, v, 1 / 60, unit, sphere);
    expect(p.length()).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(p.length()).toBeLessThan(10 + 0.05 * unit);
    expect(Math.abs(p.x) + Math.abs(p.y)).toBeLessThan(1e-9); // straight down
  });
});
