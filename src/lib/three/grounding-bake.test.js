import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { liftSun } from './grounding-bake';

const DEG = Math.PI / 180;
const elevation = (d) => Math.asin(d.y / d.length()) / DEG;
const azimuth = (d) => Math.atan2(d.x, d.z);

describe('a low sun, lifted for the bake', () => {
  it('raises a sun on the horizon to the elevation asked for, facing the same way', () => {
    const dawn = new THREE.Vector3(0.973, 0.066, 0.221).normalize();
    const out = liftSun(dawn, 12.8);
    expect(elevation(out)).toBeCloseTo(12.8, 6);
    expect(azimuth(out)).toBeCloseTo(azimuth(dawn), 6);
    expect(out.length()).toBeCloseTo(1, 9);
  });

  it('leaves a sun that is already higher where it is', () => {
    const noon = new THREE.Vector3(0.1, 0.95, 0.3).normalize();
    const out = liftSun(noon, 12.8);
    expect(out.x).toBeCloseTo(noon.x, 9);
    expect(out.y).toBeCloseTo(noon.y, 9);
    expect(out.z).toBeCloseTo(noon.z, 9);
  });

  it('does nothing without an elevation, and never changes what it was given', () => {
    const dawn = new THREE.Vector3(1, 0.05, 0).normalize();
    const copy = dawn.clone();
    expect(liftSun(dawn).equals(copy)).toBe(true);
    liftSun(dawn, 20);
    expect(dawn.equals(copy)).toBe(true);
  });
});
