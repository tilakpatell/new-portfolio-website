import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GEAR, GEAR_SLOTS } from './looks';
import { buildGear } from './gear';

const materials = (root) => {
  const set = new Set();
  root.traverse((o) => o.isMesh && set.add(o.material));
  return set;
};

describe('gear', () => {
  it('builds every piece there is, in a few materials', () => {
    for (const slot of GEAR_SLOTS) {
      for (const g of GEAR[slot]) {
        if (g.id === 'none') continue;
        const o = buildGear(g.id);
        expect(o, g.id).toBeInstanceOf(THREE.Object3D);
        let meshes = 0;
        o.traverse((m) => m.isMesh && meshes++);
        expect(meshes, g.id).toBeGreaterThan(0);
        expect(materials(o).size, g.id).toBeLessThan(6);
      }
    }
  });

  it('builds nothing for nothing', () => {
    expect(buildGear('none')).toBeNull();
    expect(buildGear('bazooka')).toBeNull();
  });

  it('holds what goes in a hand along −z, about a unit long', () => {
    for (const id of ['portalgun', 'plumbus', 'laserpistol']) {
      const box = new THREE.Box3().setFromObject(buildGear(id));
      const size = box.getSize(new THREE.Vector3());
      expect(size.z, id).toBeGreaterThan(size.y * 0.9);
      expect(size.z, id).toBeGreaterThan(0.6);
      expect(size.z, id).toBeLessThan(1.4);
    }
  });

  it('puts a hat on top and glasses in front: up from the head, forward from the face', () => {
    const hat = new THREE.Box3().setFromObject(buildGear('tophat'));
    expect(hat.max.y).toBeGreaterThan(0.3);
    const shades = new THREE.Box3().setFromObject(buildGear('shades'));
    expect(shades.max.z).toBeGreaterThan(0); // (the lenses: in front of the face)
    expect(shades.min.z).toBeLessThan(-0.2); // (the arms: back to the ears)
  });
});
