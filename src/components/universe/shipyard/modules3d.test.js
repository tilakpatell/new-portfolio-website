import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ACHIEVEMENTS } from '../../Achievements';
import { BUILT } from '../shipModels';
import { moduleById } from './parts';
import { STOCK_BUILD, rollBuild } from './build';
import { assemble } from './modules3d';

const ALL = Object.keys(ACHIEVEMENTS);
const meshes = (root) => {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
};

describe('a build put together', () => {
  it('is one ship about a ship-length long, centred across, nose forward', () => {
    for (let s = 1; s <= 20; s++) {
      const b = rollBuild(s * 104729, ALL);
      const ship = assemble(b);
      const box = new THREE.Box3().setFromObject(ship.group);
      const size = box.getSize(new THREE.Vector3());
      expect(size.z, JSON.stringify(b)).toBeLessThanOrEqual(BUILT * 1.15);
      expect(size.z).toBeGreaterThan(BUILT * 0.6);
      expect(Math.abs(box.min.x + box.max.x) / 2, JSON.stringify(b)).toBeLessThan(0.02);
      ship.dispose();
    }
  });

  it('puts the exhaust where the engines are: as many as the set has, on the hull’s layout', () => {
    for (const engines of ['twincans', 'quad', 'ring']) {
      for (const hull of ['dart', 'saucer', 'hauler', 'needle']) {
        const ship = assemble({ ...STOCK_BUILD, hull, engines });
        expect(ship.engines).toHaveLength(moduleById('engines', engines).count);
        for (const e of ship.engines) expect(e[2]).toBeGreaterThan(0.05); // (aft)
        ship.dispose();
      }
    }
  });

  it('falls back to the largest layout the hull has, never more engines than it has room for', () => {
    const hull = moduleById('hull', 'dart');
    const had = hull.sockets.engine[4];
    delete hull.sockets.engine[4];
    try {
      const ship = assemble({ ...STOCK_BUILD, engines: 'quad' });
      expect(ship.engines).toHaveLength(2);
      ship.dispose();
    } finally {
      hull.sockets.engine[4] = had;
    }
  });

  it('is a handful of draws, each with what a lit, painted mesh needs', () => {
    for (let s = 1; s <= 10; s++) {
      const ship = assemble(rollBuild(s * 7, ALL));
      const list = meshes(ship.group);
      expect(list.length).toBeLessThanOrEqual(10);
      for (const m of list) for (const a of ['position', 'normal', 'uv']) expect(m.geometry.attributes[a], a).toBeDefined();
      ship.dispose();
    }
  });

  it('mirrors its wings, wound the right way round on both sides', () => {
    for (const wings of ['swept', 'delta', 'twinboom', 'stub']) {
      const ship = assemble({ ...STOCK_BUILD, wings, tail: 'none', extras: 'lights' });
      const box = new THREE.Box3().setFromObject(ship.group);
      expect(box.min.x, wings).toBeCloseTo(-box.max.x, 5);
      // every triangle faces the way its normals say (the mirrored side's too)
      for (const m of meshes(ship.group)) {
        const g = m.geometry;
        const p = g.attributes.position;
        const n = g.attributes.normal;
        let agree = 0;
        let count = 0;
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        const face = new THREE.Vector3();
        const avg = new THREE.Vector3();
        for (let i = 0; i < p.count; i += 3) {
          a.fromBufferAttribute(p, i);
          b.fromBufferAttribute(p, i + 1);
          c.fromBufferAttribute(p, i + 2);
          face.subVectors(c, b).cross(a.clone().sub(b));
          if (face.lengthSq() < 1e-14) continue;
          avg.fromBufferAttribute(n, i).add(b.fromBufferAttribute(n, i + 1)).add(c.fromBufferAttribute(n, i + 2));
          count++;
          if (face.dot(avg) > 0) agree++;
        }
        expect(agree / Math.max(1, count), `${wings} ${m.name}`).toBeGreaterThan(0.97);
      }
      ship.dispose();
    }
  });

  it('hands the hangar its hull’s hardpoints', () => {
    const ship = assemble({ ...STOCK_BUILD, hull: 'hauler' });
    expect(ship.mounts).toBe(moduleById('hull', 'hauler').sockets.mounts);
    ship.dispose();
  });
});
