import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createPalette } from '../../../lib/three/palette';
import { createBuggy } from './buggy';
import { LOOK, PAINT } from './look';

const state = (suspension, forwardSpeed = 0) => ({ forwardSpeed, wheels: [0, 1, 2, 3].map(() => ({ suspension, contact: true })) });

describe('createBuggy', () => {
  it('is a body and four wheels', () => {
    const b = createBuggy({ palette: createPalette(LOOK.palette) });
    expect(b.group).toBeInstanceOf(THREE.Group);
    expect(b.wheels).toHaveLength(4);
  });

  it('is painted from the strip: the body one mesh, every part on one material', () => {
    const palette = createPalette(LOOK.palette);
    const material = palette.material();
    const b = createBuggy({ palette, paint: PAINT, material });
    const meshes = [];
    b.group.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes).toHaveLength(5); // (the body and four tyres)
    expect(new Set(meshes.map((m) => m.material))).toEqual(new Set([material]));
    const us = new Set();
    const uv = b.body.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) us.add(uv.getX(i));
    expect([...us].sort()).toEqual([PAINT.body, PAINT.cab, PAINT.dark].map((i) => palette.uv(i)[0]).sort());
    const freed = vi.spyOn(material, 'dispose');
    b.dispose();
    expect(freed).not.toHaveBeenCalled(); // (the crates still draw with it)
  });

  it('hangs its wheels on the springs, eased, never above half a metre down', () => {
    const b = createBuggy({});
    for (let i = 0; i < 120; i++) b.update(state(0.8), 0, 1 / 60);
    expect(b.wheels[0].position.y).toBeCloseTo(-0.8, 3);
    for (let i = 0; i < 120; i++) b.update(state(0.1), 0, 1 / 60);
    expect(b.wheels[0].position.y).toBeCloseTo(-0.5, 3);
  });

  it('spins the wheels with the speed and turns the front ones with the steer', () => {
    const b = createBuggy({});
    b.update(state(0.8, 4), 1, 1 / 60);
    expect(b.wheels[2].userData.spin).toBeCloseTo(-(4 / 0.4) / 60, 5);
    for (let i = 0; i < 120; i++) b.update(state(0.8, 4), 1, 1 / 60);
    expect(b.wheels[0].rotation.y).toBeCloseTo(-0.5, 2);
    expect(b.wheels[2].rotation.y).toBe(0);
    b.dispose();
  });
});
