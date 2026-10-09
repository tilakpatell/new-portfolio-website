import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { attachVehicleBody } from './vehicleBody';

// a body of two boxes under one pivot, its underside at y −0.35
function car() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.set(0, 0.1, 0);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.7));
  lower.position.y = -0.15;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 1.3));
  cab.position.y = 0.35;
  body.add(lower, cab);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.7));
  body.add(antenna);
  group.add(body);
  return { group, body, antenna };
}
const bottom = (group, body) => {
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(body).min.y;
};
const still = { squash: 0, roll: 0, pitch: 0, antenna: [0, 0] };

describe('attachVehicleBody', () => {
  it('squashes about the base: shorter, wider, its underside where it was', () => {
    const { group, body } = car();
    const under = bottom(group, body);
    const b = attachVehicleBody({ body, base: under });
    b.apply({ ...still, squash: 0.2 });
    expect(body.scale.y).toBeCloseTo(0.8, 9);
    expect(body.scale.x).toBeCloseTo(1.1, 9);
    expect(body.scale.z).toBeCloseTo(1.1, 9);
    expect(bottom(group, body)).toBeCloseTo(under, 6);
    b.apply({ ...still, squash: -0.1 });
    expect(bottom(group, body)).toBeCloseTo(under, 6);
  });

  it('pitches and rolls a car that faces +x, as lib/physics/vehicle.js’s does', () => {
    const { body } = car();
    const b = attachVehicleBody({ body });
    b.apply({ ...still, pitch: -0.05, roll: 0.1 });
    expect(body.rotation.z).toBeCloseTo(0.05, 9); // the nose up
    expect(body.rotation.x).toBeCloseTo(0.1, 9); // the right (+z) side down
    expect(body.rotation.y).toBe(0);
  });

  it('pitches and rolls a car that faces +z', () => {
    const { body } = car();
    const b = attachVehicleBody({ body, forward: 'z' });
    b.apply({ ...still, pitch: 0.05, roll: 0.1 });
    expect(body.rotation.x).toBeCloseTo(0.05, 9);
    expect(body.rotation.z).toBeCloseTo(0.1, 9);
  });

  it('bends the antenna away from the acceleration', () => {
    const { body, antenna } = car();
    const b = attachVehicleBody({ body, antenna });
    b.apply({ ...still, antenna: [0.5, 0.25] });
    expect(antenna.rotation.z).toBeCloseTo(0.6, 9);
    expect(antenna.rotation.x).toBeCloseTo(-0.3, 9);
    // the tip goes back (−x) and left (−z) of the base
    antenna.updateMatrixWorld(true);
    const tip = new THREE.Vector3(0, 1, 0).applyEuler(antenna.rotation);
    expect(tip.x).toBeLessThan(0);
    expect(tip.z).toBeLessThan(0);
  });

  it('puts the body back as it found it', () => {
    const { body, antenna } = car();
    const b = attachVehicleBody({ body, antenna });
    b.apply({ squash: 0.2, pitch: 0.05, roll: 0.1, antenna: [0.3, 0.3] });
    b.dispose();
    expect(body.scale.toArray()).toEqual([1, 1, 1]);
    expect(body.position.toArray()).toEqual([0, 0.1, 0]);
    expect([body.rotation.x, body.rotation.z, antenna.rotation.x, antenna.rotation.z]).toEqual([0, 0, 0, 0]);
  });
});
