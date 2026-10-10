import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createLawnProps } from './lawnProps';
import { LAWN_PROPS } from './rules';

const cone = LAWN_PROPS.find((p) => p.kind === 'cone');
const coneAt = (parent) => {
  const mesh = parent.children.find((m) => m.name === 'knockable-cone');
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};

describe('the lawn’s props', () => {
  it('stand still, drawn, on a phone or with Data Saver: no engine loaded', async () => {
    for (const dev of [{ tier: 'mid', phone: true }, { tier: 'high', saveData: true }]) {
      const parent = new THREE.Group();
      const r = await createLawnProps({ parent, dev, impacts: null });
      expect(r.physical).toBe(false);
      r.step(1 / 60, { x: cone.x, y: 0, z: cone.z });
      expect(coneAt(parent).x).toBeCloseTo(cone.x, 4);
      r.dispose();
    }
  });

  it('go flying when he runs through them, and are heard', async () => {
    const parent = new THREE.Group();
    const impacts = { onHit: vi.fn() };
    const r = await createLawnProps({ parent, dev: { tier: 'high' }, impacts });
    expect(r.physical).toBe(true);
    // stood still a second away, then through the first cone at 9.5 m/s (his run)
    for (let i = 0; i < 30; i++) r.step(1 / 60, { x: cone.x - 8, y: 0, z: cone.z });
    for (let i = 0; i < 90; i++) r.step(1 / 60, { x: cone.x - 8 + i * (9.5 / 60), y: 0, z: cone.z });
    expect(coneAt(parent).distanceTo(new THREE.Vector3(cone.x, coneAt(parent).y, cone.z))).toBeGreaterThan(0.5);
    expect(impacts.onHit).toHaveBeenCalled();
    r.dispose();
  });
});
