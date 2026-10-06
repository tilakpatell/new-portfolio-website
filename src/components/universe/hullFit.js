// A ship's shape for flying into, as spheres (ship.js's solids are spheres):
// fitted to points on its surface, so a Star Destroyer is solid out to its
// wings and not only down its spine (wars.js's HULLS, a line of spheres along
// its length, let you fly through everything off the middle).
//
// fitHull(points, { cells, max }) → [[x, y, z, r], ...]
// points: [x, y, z]s on the model's surface, in any frame (scripts/hull-shapes.mjs
// samples them from each model at length 1). The plan is cut into columns
// `cells` to its longest side; each column's points, top to bottom, go into
// as few spheres as cover them, and each sphere is as small as holds its own.
// More than `max` spheres and the columns grow until it's under.
//
// sampleSurface(root, { step }) → [[x, y, z], ...]: points over every face of
// the meshes under `root`, no further apart than `step`, in root's own frame.
// What draws without depth (an engine's glow, a shield's bubble) isn't hull;
// what's hidden is (a ship's kept out of sight while its shaders are made);
// of a THREE.LOD, only its nearest level counts.

import * as THREE from 'three';

const glow = (m) => m && m.transparent && !m.depthWrite;

export function sampleSurface(root, { step = 0.02 } = {}) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  const out = [];
  const visit = (o) => {
    if (o.isLOD) {
      if (o.levels[0]) visit(o.levels[0].object);
      return;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes.position && !mats.every(glow)) {
      m.multiplyMatrices(toRoot, o.matrixWorld);
      const pos = o.geometry.attributes.position;
      const index = o.geometry.index;
      const n = index ? index.count : pos.count;
      for (let t = 0; t + 2 < n; t += 3) {
        const [i, j, k] = index ? [index.getX(t), index.getX(t + 1), index.getX(t + 2)] : [t, t + 1, t + 2];
        a.fromBufferAttribute(pos, i).applyMatrix4(m);
        b.fromBufferAttribute(pos, j).applyMatrix4(m);
        c.fromBufferAttribute(pos, k).applyMatrix4(m);
        // (a grid over the face, as fine as `step`)
        const s = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / step));
        for (let u = 0; u <= s; u++)
          for (let v = 0; u + v <= s; v++) {
            const w = s - u - v;
            p.set(0, 0, 0).addScaledVector(a, u / s).addScaledVector(b, v / s).addScaledVector(c, w / s);
            out.push([p.x, p.y, p.z]);
          }
      }
    }
    for (const ch of o.children) visit(ch);
  };
  visit(root);
  return out;
}

const fit = (points, c) => {
  let mx = Infinity;
  let mz = Infinity;
  for (const [x, , z] of points) {
    if (x < mx) mx = x;
    if (z < mz) mz = z;
  }
  const cols = new Map();
  for (const p of points) {
    const k = `${Math.floor((p[0] - mx) / c)},${Math.floor((p[2] - mz) / c)}`;
    const col = cols.get(k);
    if (col) col.push(p);
    else cols.set(k, [p]);
  }
  const out = [];
  for (const col of cols.values()) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of col) {
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    // (stacked no further apart than keeps a column's corners covered)
    const n = Math.max(1, Math.ceil((y1 - y0) / (Math.SQRT2 * c) - 1e-9));
    const h = (y1 - y0) / n || 1;
    const parts = Array.from({ length: n }, () => []);
    for (const p of col) parts[Math.min(n - 1, Math.floor((p[1] - y0) / h))].push(p);
    for (const part of parts) {
      if (!part.length) continue;
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const p of part)
        for (let i = 0; i < 3; i++) {
          if (p[i] < lo[i]) lo[i] = p[i];
          if (p[i] > hi[i]) hi[i] = p[i];
        }
      const at = lo.map((v, i) => (v + hi[i]) / 2);
      let r = 0;
      for (const p of part) r = Math.max(r, Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]));
      out.push([...at, r]);
    }
  }
  return out;
};

// (to three places, the radius rounded up past what rounding the middle moved)
const tidy = ([x, y, z, r]) => [x, y, z].map((v) => Math.round(v * 1000) / 1000).concat(Math.ceil((r + 0.001) * 1000) / 1000);

export function fitHull(points, { cells = 14, max = 40 } = {}) {
  if (!points.length) return [];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      if (p[i] < lo[i]) lo[i] = p[i];
      if (p[i] > hi[i]) hi[i] = p[i];
    }
  let c = Math.max(1e-6, Math.max(hi[0] - lo[0], hi[2] - lo[2]) / cells);
  let spheres = fit(points, c);
  while (spheres.length > max) {
    c *= 1.15;
    spheres = fit(points, c);
  }
  return spheres.map(tidy);
}
