import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { chaseRadius, createChaseView, optimalArea } from './view';

describe('optimalArea', () => {
  it('is the ground the screen sees at the orbit’s furthest: 25 to 40 m round on a 16:9 screen', () => {
    const a = optimalArea({ fov: 25, aspect: 16 / 9, phi: 0.31 * Math.PI, theta: Math.PI / 4, radius: 42 });
    expect(a.radius).toBeGreaterThan(25);
    expect(a.radius).toBeLessThan(40);
    expect(a.near).toBeLessThan(a.far);
    expect(a.base).toHaveLength(2);
  });
});

describe('chaseRadius', () => {
  it('is 15 standing, pulls out with speed on high, not on low, and further on a narrow screen', () => {
    expect(chaseRadius(0, { tier: 'high' })).toBeCloseTo(15, 5);
    expect(chaseRadius(40, { tier: 'high' })).toBeGreaterThan(chaseRadius(0, { tier: 'high' }));
    expect(chaseRadius(40, { tier: 'high' })).toBeCloseTo(15 * 1.4, 5);
    expect(chaseRadius(40, { tier: 'low' })).toBe(chaseRadius(0, { tier: 'low' }));
    expect(chaseRadius(0, { tier: 'high', aspect: 0.6 })).toBeCloseTo(24, 5);
    expect(chaseRadius(0, { tier: 'high', base: 22 })).toBe(22);
  });
});

describe('createChaseView', () => {
  it('is his camera, and settles on its orbit round a still car', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    const view = createChaseView({ camera, tier: 'high' });
    expect(camera.fov).toBe(25);
    const target = { x: 10, y: 2, z: -4 };
    for (let i = 0; i < 300; i++) view.update(1 / 60, target, 0);
    const r = chaseRadius(0, { tier: 'high' });
    const want = new THREE.Vector3().setFromSphericalCoords(r, 0.31 * Math.PI, Math.PI / 4).add(new THREE.Vector3(10, 2, -4));
    expect(camera.position.distanceTo(want)).toBeLessThan(0.01);
    expect(view.focus.distanceTo(new THREE.Vector3(10, 2, -4))).toBeLessThan(0.01);
    // the area follows the focus
    expect(Math.abs(view.area.centre[0] - (10 + view.area.base[0]))).toBeLessThan(0.01);
    expect(view.area.radius).toBeGreaterThan(20);
  });

  it('looks steeper on a phone', () => {
    const camera = new THREE.PerspectiveCamera(50, 0.5, 0.1, 1000);
    createChaseView({ camera, small: true, tier: 'mid' });
    const view = createChaseView({ camera, small: true, tier: 'mid' });
    for (let i = 0; i < 300; i++) view.update(1 / 60, { x: 0, y: 0, z: 0 }, 0);
    const s = new THREE.Spherical().setFromVector3(camera.position);
    expect(s.phi).toBeCloseTo(0.27 * Math.PI, 2);
  });

  it('shakes, and the shake dies away within 3 s', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    const view = createChaseView({ camera, tier: 'high' });
    view.shake(1);
    let most = 0;
    for (let i = 0; i < 30; i++) {
      view.update(1 / 60, { x: 0, y: 0, z: 0 }, 0);
      most = Math.max(most, Math.abs(view.roll));
    }
    expect(most).toBeGreaterThan(0.01);
    for (let i = 0; i < 150; i++) view.update(1 / 60, { x: 0, y: 0, z: 0 }, 0);
    expect(Math.abs(view.roll)).toBeLessThan(0.01);
  });
});
