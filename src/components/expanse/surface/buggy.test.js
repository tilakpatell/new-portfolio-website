import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBuggy } from './buggy';

const state = (suspension, forwardSpeed = 0) => ({ forwardSpeed, wheels: [0, 1, 2, 3].map(() => ({ suspension, contact: true })) });

describe('createBuggy', () => {
  it('is a body and four wheels', () => {
    const b = createBuggy({ palette: { body: 0xd8572a, dark: 0x2a2a2a } });
    expect(b.group).toBeInstanceOf(THREE.Group);
    expect(b.wheels).toHaveLength(4);
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

describe('the buggy’s visible half', () => {
  it('squashes and leans its body on the wheels, and bends its antenna', () => {
    const b = createBuggy({});
    b.group.updateMatrixWorld(true);
    const under = new THREE.Box3().setFromObject(b.body).min.y;
    expect(under).toBeCloseTo(-0.35, 3);
    expect(b.antenna.parent).toBe(b.body);
    b.update(state(0.8), 0, 1 / 60, { squash: 0.2, pitch: -0.05, roll: 0.1, antenna: [0.5, 0] });
    expect(b.body.scale.y).toBeCloseTo(0.8, 6);
    expect(b.body.rotation.z).toBeCloseTo(0.05, 6);
    expect(b.body.rotation.x).toBeCloseTo(0.1, 6);
    expect(b.antenna.rotation.z).toBeCloseTo(0.6, 6);
    // the wheels hang on the springs, not on the body
    expect(b.wheels.every((w) => w.parent === b.group)).toBe(true);
    b.dispose();
  });

  it('stands as before without a feel', () => {
    const b = createBuggy({});
    b.update(state(0.8), 0, 1 / 60);
    expect(b.body.scale.toArray()).toEqual([1, 1, 1]);
    expect(b.body.rotation.x).toBe(0);
    b.dispose();
  });
});
