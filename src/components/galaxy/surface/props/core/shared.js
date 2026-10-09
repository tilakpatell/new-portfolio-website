// What more than one of the core worlds' parts builds with (props/core/
// index.js has the parts): a colour lit to glow, a colour varied, a lumpy
// ball and the posts along a straight edge you can't get past; and the
// traffic kit's shapes and painted textures, passed on from here so the
// core worlds reach into the universe's insides by one import, as when
// they were one file.
//
//   lit(color, k?) → THREE.Color      vary(color, rand, l?, h?) → THREE.Color
//   lump(seed, amp?, w?, h?) → geometry   rail(a, b, step?) → solids
//   canvasTexture, loft, trap8, turned: universe/trafficKit's

import * as THREE from 'three';
import { rng } from '../../noise';

export { canvasTexture, loft, trap8, turned } from '../../../../universe/trafficKit';

export const lit = (c, k = 2.5) => new THREE.Color(c).multiplyScalar(k);
export const vary = (c, r, l = 0.08, h = 0) => new THREE.Color(c).offsetHSL((r() - 0.5) * h, 0, (r() - 0.5) * l);

// a lumpy ball, 1 across (a canopy, a bubble, a cloud of leaves)
export function lump(seed, amp = 0.2, w = 12, h = 9) {
  const g = new THREE.SphereGeometry(0.5, w, h);
  const r = rng(seed);
  const bumps = Array.from({ length: 7 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.35) * amp * 2.4]);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 2;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// posts along a straight edge you can't get past, from a to b
export function rail(a, b, step = 0.8) {
  const out = [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) out.push({ circle: [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 0.45] });
  return out;
}
