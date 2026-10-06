import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitHull, sampleSurface } from './hullFit';

// points on a box's faces, every `step`
const boxPoints = ([w, h, l], step = 0.02) => {
  const pts = [];
  for (let x = -w / 2; x <= w / 2 + 1e-9; x += step)
    for (let z = -l / 2; z <= l / 2 + 1e-9; z += step) pts.push([x, -h / 2, z], [x, h / 2, z]);
  for (let y = -h / 2; y <= h / 2 + 1e-9; y += step)
    for (let z = -l / 2; z <= l / 2 + 1e-9; z += step) pts.push([-w / 2, y, z], [w / 2, y, z]);
  return pts;
};
// a Star Destroyer's plan: a flat wedge, wide at the back (z −0.5), a point at the nose (z +0.5)
const wedgePoints = (step = 0.01) => {
  const pts = [];
  for (let z = -0.5; z <= 0.5 + 1e-9; z += step) {
    const half = 0.28 * (0.5 - z);
    for (let x = -half; x <= half + 1e-9; x += step) pts.push([x, -0.04, z], [x, 0.04, z]);
  }
  return pts;
};
const inside = (p, spheres) => spheres.some(([x, y, z, r]) => Math.hypot(p[0] - x, p[1] - y, p[2] - z) <= r + 1e-9);

describe('fitHull', () => {
  it('puts every point of the surface inside a sphere', () => {
    const pts = boxPoints([0.5, 0.2, 1]);
    const spheres = fitHull(pts);
    expect(pts.every((p) => inside(p, spheres))).toBe(true);
  });

  it('covers a wedge out to its wings, not just down its spine', () => {
    const pts = wedgePoints();
    const spheres = fitHull(pts);
    expect(pts.every((p) => inside(p, spheres))).toBe(true);
    // (the back corners, where the old spine of spheres left you flying through)
    expect(inside([0.27, 0, -0.48], spheres)).toBe(true);
    expect(inside([-0.27, 0, -0.48], spheres)).toBe(true);
  });

  it('leaves the open space by the narrow nose open', () => {
    const spheres = fitHull(wedgePoints());
    expect(inside([0.25, 0, 0.45], spheres)).toBe(false);
  });

  it('keeps to the most spheres it is given', () => {
    const spheres = fitHull(boxPoints([0.6, 0.3, 1]), { max: 24 });
    expect(spheres.length).toBeLessThanOrEqual(24);
    expect(spheres.length).toBeGreaterThan(1);
  });

  it('gives nothing for no points', () => {
    expect(fitHull([])).toEqual([]);
  });
});

describe('sampleSurface', () => {
  it('samples a mesh in the root’s own frame, over its faces and not only its corners', () => {
    const root = new THREE.Group();
    root.position.set(5, 0, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.4), new THREE.MeshStandardMaterial());
    box.position.set(0, 1, 0);
    root.add(box);
    const pts = sampleSurface(root, { step: 0.1 });
    // (in the root's frame: the root's own move doesn't show)
    expect(Math.min(...pts.map((p) => p[0]))).toBeCloseTo(-0.5);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(1.1);
    // a point in the middle of the big top face, far from any corner
    expect(pts.some((p) => Math.abs(p[0]) < 0.06 && Math.abs(p[1] - 1.1) < 1e-6 && Math.abs(p[2]) < 0.06)).toBe(true);
  });

  it('samples a ship kept out of sight for now (its shaders still being made)', () => {
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.visible = false;
    inner.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    root.add(inner);
    expect(sampleSurface(root, { step: 0.5 }).length).toBeGreaterThan(0);
  });

  it('leaves out glows that draw without depth (engine flares, shields)', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    root.add(new THREE.Mesh(new THREE.SphereGeometry(5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    const pts = sampleSurface(root, { step: 0.5 });
    expect(Math.max(...pts.map((p) => Math.abs(p[0])))).toBeCloseTo(0.5);
  });
});
