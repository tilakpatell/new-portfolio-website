import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGadgetFx } from './gadgetFx';

const V = THREE.Vector3;
// a figure standing on the ground: a body and a head, its own material each
const figure = () => {
  const parent = new THREE.Group();
  const root = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#884422' });
  const head = new THREE.MeshStandardMaterial({ color: '#ffccaa' });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.3), body));
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.15), head));
  parent.add(root);
  return { parent, root, mats: [body, head] };
};
const run = (fx, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60) fx.update(1 / 60);
};

describe('the freeze ray', () => {
  it('stops them dead, ices them over, and shatters them at a second and a half', () => {
    const { parent, root, mats } = figure();
    const fx = createGadgetFx({ parent });
    const heard = [];
    const h = fx.freeze({ root, tall: 1.8, up: new V(0, 1, 0), push: new V(1, 0, 0), on: (e) => heard.push(e) });
    const at = root.position.clone();
    run(fx, 0.8);
    expect(root.visible).toBe(true);
    expect(root.position.distanceTo(at)).toBeLessThan(0.05); // (stopped where they stood)
    // the figure's own materials are untouched; its copies have gone to ice
    expect(mats[0].color.getHexString()).toBe('884422');
    const iced = root.children[0].material;
    expect(iced).not.toBe(mats[0]);
    expect(iced.color.b).toBeGreaterThan(iced.color.r);
    expect(parent.children.length).toBeGreaterThan(1); // (the ice round them)
    run(fx, 0.9);
    expect(heard).toEqual(['shatter']);
    expect(root.visible).toBe(false);
    expect(h.done).toBe(false);
    run(fx, 1.6);
    expect(h.done).toBe(true);
    h.dispose();
    expect(root.children[0].material).toBe(mats[0]);
    expect(root.visible).toBe(true);
    expect(parent.children).toEqual([root]);
    expect(fx.count).toBe(0);
  });

  it('throws the shards out and down onto the ground, never under it', () => {
    const { parent, root } = figure();
    const fx = createGadgetFx({ parent });
    const h = fx.freeze({ root, tall: 1.8, up: new V(0, 1, 0), push: new V(0, 0, 1) });
    run(fx, 1.55);
    expect(h.shards().length).toBeGreaterThan(20);
    run(fx, 0.5);
    const shards = h.shards();
    const spread = Math.max(...shards.map((s) => Math.hypot(s.x, s.z)));
    expect(spread).toBeGreaterThan(0.6);
    for (const s of shards) expect(s.y).toBeGreaterThanOrEqual(-1e-6);
    h.dispose();
  });
});

describe('the shrink ray', () => {
  it('takes them down to a tenth in half a second, squeaks, and pops', () => {
    const { parent, root } = figure();
    root.scale.setScalar(2);
    const fx = createGadgetFx({ parent });
    const heard = [];
    const h = fx.shrink({ root, tall: 1.8, up: new V(0, 1, 0), on: (e) => heard.push(e) });
    run(fx, 0.25);
    expect(root.scale.y).toBeLessThan(2);
    expect(root.scale.y).toBeGreaterThan(0.3);
    run(fx, 0.35);
    expect(root.scale.x).toBeCloseTo(0.2, 1);
    expect(heard).toContain('squeak');
    expect(root.visible).toBe(true);
    run(fx, 0.7);
    expect(heard).toEqual(['squeak', 'pop']);
    expect(root.visible).toBe(false);
    run(fx, 0.6);
    expect(h.done).toBe(true);
    h.dispose();
    expect(root.scale.x).toBe(2);
    expect(parent.children).toEqual([root]);
  });
});
