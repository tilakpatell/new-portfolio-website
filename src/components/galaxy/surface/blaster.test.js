import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBlaster, sweptHit } from './blaster';

describe('a bolt going by', () => {
  it('hits what a fast bolt passed through', () => {
    expect(sweptHit([0, 1, -2], [0, 1, 2], [0, 1, 0], 0.55)).toBe(true);
    expect(sweptHit([0, 1, -2], [0, 1, 2], [2, 1, 0], 0.55)).toBe(false);
  });

  it('misses over your head or short of you', () => {
    expect(sweptHit([0, 3.5, -2], [0, 3.5, 2], [0, 1, 0], 0.55)).toBe(false);
    expect(sweptHit([0, 1, -4], [0, 1, -2], [0, 1, 0], 0.55)).toBe(false);
  });
});

describe('a bolt at a raised blade', () => {
  // a stormtrooper 20 m ahead firing at your chest; you at the origin
  const shot = () => {
    const parent = new THREE.Group();
    const b = createBlaster({ parent, world: null });
    const bolt = b.enemy([0, 1.2, 20], new THREE.Vector3(0, 1.2, 0), 0, '#ff3b30', 8);
    return { b, bolt, from: bolt.m.position.clone() };
  };
  const you = { x: 0, y: 0, z: 0 };
  const fly = (b, crosses, deflect = () => {}) => {
    let hurt = 0;
    for (let i = 0; i < 60; i++) hurt += b.update(1 / 30, you, deflect, crosses);
    return hurt;
  };
  it('lands with the blade down', () => {
    const { b } = shot();
    expect(fly(b, null)).toBe(8);
  });
  it('is turned back along its line toward its shooter when it crosses the blade, and hurts nobody', () => {
    const { b, bolt, from } = shot();
    let at = null;
    // (a blade held up across, 0.5 m before you: the bolt's flown segment crosses it there)
    const crosses = (a, c) => (Math.min(a[2], c[2]) <= 0.5 && Math.max(a[2], c[2]) >= 0.5 ? { at: [0, 1.2, 0.5] } : null);
    const hurt = fly(b, crosses, (p) => (at = p.clone()));
    expect(hurt).toBe(0);
    expect(at.z).toBeCloseTo(0.5);
    expect(bolt.theirs).toBe(false);
    expect(bolt.v.clone().normalize().dot(from.clone().sub(new THREE.Vector3(0, 1.2, 0.5)).normalize())).toBeGreaterThan(0.99);
  });
  it('is not turned by a blade it passes beside', () => {
    const { b } = shot();
    expect(fly(b, () => null)).toBe(8);
  });
});
