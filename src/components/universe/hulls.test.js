import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loft } from './hulls';

// the share of a geometry's triangles whose normals and winding both face
// away from the z axis (out of the hull)
function outward(g) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = new THREE.Vector3();
  const mid = new THREE.Vector3();
  let out = 0;
  let count = 0;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    mid.copy(a).add(b).add(c).divideScalar(3);
    face.subVectors(c, b).cross(a.clone().sub(b));
    if (face.lengthSq() < 1e-16) continue;
    const away = new THREE.Vector3(mid.x, mid.y, 0);
    if (away.lengthSq() < 1e-10 || Math.abs(face.clone().normalize().z) > 0.7) continue; // (the caps: the next test's)
    count++;
    if (face.dot(away) > 0 && new THREE.Vector3().fromBufferAttribute(n, i).dot(away) > 0) out++;
  }
  return out / count;
}

describe('loft', () => {
  it('faces out of the hull, its winding and its normals both', () => {
    const g = loft([
      { z: -0.1, w: 0.04, h: 0.03 },
      { z: 0.0, w: 0.06, h: 0.04 },
      { z: 0.1, w: 0.05, h: 0.03 },
    ]);
    expect(outward(g)).toBeGreaterThan(0.95);
  });

  it('caps its ends facing out along z', () => {
    const g = loft([
      { z: -0.1, w: 0.04, h: 0.03 },
      { z: 0.1, w: 0.04, h: 0.03 },
    ]);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      if (Math.abs(Math.abs(z) - 0.1) < 1e-9) expect(Math.sign(n.getZ(i))).toBe(Math.sign(z));
    }
  });
});
