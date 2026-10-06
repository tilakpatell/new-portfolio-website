import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CME, createEjection, ejectionAt } from './cme';

const opts = { rise: 3, speed: 150, starR: 32, reach: 400 };

describe('ejectionAt', () => {
  it('holds at the star while it rises, the glare swelling', () => {
    const a = ejectionAt(0, opts);
    expect(a.on).toBe(false);
    expect(a.radius).toBe(32);
    expect(a.glow).toBe(0);
    expect(ejectionAt(1.5, opts).glow).toBeGreaterThan(0);
    expect(ejectionAt(1.5, opts).on).toBe(false);
  });

  it('leaves the star when the rise is over and runs out at its speed', () => {
    const a = ejectionAt(3, opts);
    expect(a.on).toBe(true);
    expect(a.radius).toBe(32);
    expect(ejectionAt(5, opts).radius).toBeCloseTo(32 + 2 * 150, 9);
  });

  it('is over once it reaches as far as it goes', () => {
    const end = 3 + (400 - 32) / 150;
    const a = ejectionAt(end + 0.01, opts);
    expect(a.on).toBe(false);
    expect(a.life).toBe(1);
  });

  it('ages one way only', () => {
    let last = -1;
    for (let age = 0; age < 6; age += 0.1) {
      const { life } = ejectionAt(age, opts);
      expect(life).toBeGreaterThanOrEqual(last);
      last = life;
    }
  });
});

describe('createEjection', () => {
  it('launches toward the ship, plays out and puts itself away', () => {
    const parent = new THREE.Group();
    const e = createEjection(parent, { small: true });
    expect(e.busy).toBe(false);
    e.launch({ at: [0, 0, 0], r: 32, color: '#ffcc88' }, { x: 0, y: 0, z: 200 }, { rise: 3, speed: 150, reach: 260 });
    expect(e.busy).toBe(true);
    // the cone's axis is within its half-width of the ship
    expect(e.axis.angleTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(CME.half);
    const cam = new THREE.PerspectiveCamera();
    for (let k = 0; k < 120; k++) e.update(0.05, k * 0.05, cam);
    expect(e.busy).toBe(false);
    e.dispose();
  });
});
