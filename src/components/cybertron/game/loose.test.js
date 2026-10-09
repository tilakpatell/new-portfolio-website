import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AREAS } from './areas';
import { createLoose } from './loose';

const iacon = AREAS.iacon;
const first = iacon.loose[0];
const crateAt = (parent) => {
  const mesh = parent.children.find((m) => m.name === 'knockable-energon');
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};

describe('an area’s loose crates', () => {
  it('stand still, drawn, without the engine (a phone, Data Saver)', async () => {
    const parent = new THREE.Group();
    const l = await createLoose({ area: iacon, parent, dev: { tier: 'mid', phone: true }, impacts: null });
    expect(l.physical).toBe(false);
    l.step(1 / 60, { mode: 'robot', x: first.x, y: 0, z: first.z });
    expect(crateAt(parent).x).toBeCloseTo(first.x, 4);
    l.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('go flying when the truck drives through, and are heard', async () => {
    const parent = new THREE.Group();
    const impacts = { onHit: vi.fn() };
    const l = await createLoose({ area: iacon, parent, dev: { tier: 'high' }, impacts });
    expect(l.physical).toBe(true);
    for (let i = 0; i < 120; i++) l.step(1 / 60, { mode: 'vehicle', x: first.x, y: 0, z: first.z - 15 + i * 0.25 });
    const now = crateAt(parent);
    expect(Math.hypot(now.x - first.x, now.z - first.z)).toBeGreaterThan(1);
    expect(impacts.onHit).toHaveBeenCalled();
    l.dispose();
  });

  it('have none to make where an area has none', async () => {
    const l = await createLoose({ area: AREAS.kaon, parent: new THREE.Group(), dev: { tier: 'high' }, impacts: null });
    expect(l.physical).toBe(false);
    l.step(1 / 60, { mode: 'robot', x: 0, y: 0, z: 0 });
    l.dispose();
  });
});
