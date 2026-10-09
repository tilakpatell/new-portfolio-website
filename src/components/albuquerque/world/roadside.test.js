import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createStreetProps } from './roadside';
import { STREET_PROPS } from './rules';

const cone = STREET_PROPS.find((p) => p.kind === 'cone');
const coneAt = (parent) => {
  const mesh = parent.children.find((m) => m.name === 'knockable-cone');
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};

describe('the street’s props', () => {
  it('stand still, drawn, on a phone or with Data Saver: no engine loaded', async () => {
    for (const dev of [{ tier: 'mid', phone: true }, { tier: 'high', saveData: true }]) {
      const parent = new THREE.Group();
      const r = await createStreetProps({ parent, dev, impacts: null });
      expect(r.physical).toBe(false);
      r.step(1 / 60, { x: cone.x, z: cone.z });
      expect(coneAt(parent).x).toBeCloseTo(cone.x, 4);
      r.dispose();
    }
  });

  it('go flying when the Aztek drives through them, and are heard', async () => {
    const parent = new THREE.Group();
    const impacts = { onHit: vi.fn() };
    const r = await createStreetProps({ parent, dev: { tier: 'high' }, impacts });
    expect(r.physical).toBe(true);
    // along the gutter at 15 m/s, through the first cone
    for (let i = 0; i < 120; i++) r.step(1 / 60, { x: cone.x - 12 + i * 0.25, z: cone.z });
    expect(coneAt(parent).distanceTo(new THREE.Vector3(cone.x, coneAt(parent).y, cone.z))).toBeGreaterThan(1);
    expect(impacts.onHit).toHaveBeenCalled();
    r.dispose();
  });
});
