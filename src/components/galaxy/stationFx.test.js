import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DISH, buildBeam, createShockwave, dishAt, faceDish } from './stationFx';

describe('a Death Star’s dish', () => {
  it('is where the models have it: up from the equator, toward the front', () => {
    for (const kind of ['deathstar', 'deathstar2']) {
      const d = new THREE.Vector3(...DISH[kind].dir);
      expect(d.length()).toBeCloseTo(1, 6);
      expect(d.y).toBeGreaterThan(0.3);
      expect(d.z).toBeGreaterThan(0.75);
    }
  });

  it('turns to face what it’s to fire on, and is found there', () => {
    const holder = new THREE.Group();
    holder.position.set(100, 20, -50);
    const target = new THREE.Vector3(-40, 0, 60);
    faceDish('deathstar', holder, target, holder.quaternion);
    const at = dishAt('deathstar', holder, 30, new THREE.Vector3());
    // on the surface, on the side toward the target
    expect(at.distanceTo(holder.position)).toBeCloseTo(30 * DISH.deathstar.out, 6);
    const toTarget = target.clone().sub(holder.position).normalize();
    const toDish = at.clone().sub(holder.position).normalize();
    expect(toDish.dot(toTarget)).toBeCloseTo(1, 6);
  });
});

describe('the superlaser’s beam', () => {
  it('is a core and a wider sheath, laid from the dish to the target', () => {
    const beam = buildBeam();
    expect(beam.mesh.children).toHaveLength(2);
    const [core, sheath] = beam.mesh.children;
    expect(sheath.scale.x).toBeGreaterThan(core.scale.x * 2);
    beam.lay(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 50), 1.5);
    expect(beam.mesh.visible).toBe(true);
    expect(beam.mesh.scale.z).toBeCloseTo(50, 6);
    beam.hide();
    expect(beam.mesh.visible).toBe(false);
    beam.dispose();
  });
});

describe('a shockwave', () => {
  it('rings out from where a station went, fading, and goes', () => {
    const parent = new THREE.Group();
    const wave = createShockwave(parent);
    wave.at(new THREE.Vector3(5, 0, 0), 40);
    const ring = parent.children[0];
    expect(ring.visible).toBe(true);
    wave.update(0.5);
    const early = ring.scale.x;
    wave.update(2);
    expect(ring.scale.x).toBeGreaterThan(early);
    expect(wave.busy).toBe(true);
    wave.update(10);
    expect(ring.visible).toBe(false);
    expect(wave.busy).toBe(false);
    wave.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
