// Rocks in space: Geonosis' asteroid ring, the Hoth asteroid field, what's
// left of Alderaan. A handful of rock shapes (icosahedra pushed in and out
// by noise, chipped flat here and there, faceted), drawn instanced, a few
// draw calls for hundreds of rocks; each tumbling slowly where it is. Where
// they are, how big, which way they turn: all from the seed, so every
// pilot sees the same field and the big rocks the ship can hit stay put.
//
// createRocks({ kind = 'field', at = [0, 0, 0], count = 400, seed = 1, small = false, ...shape })
//   → { group, solids, update(t, camera), dispose() }
// kind 'ring': { inner, outer, thickness, tilt: [x, z] } round a planet at `at`
//      'field': { radius } a loose cloud, a few huge rocks, many small
//      'debris': { radius } a planet's remains, chunks scorched and still glowing
// solids: [{ id: 'rock-N', at: [x, y, z] (world), r, reach }], the big rocks (at most 60)

import * as THREE from 'three';

const MAX_SOLIDS = 60;

// a seeded random sequence
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 3D value noise, for the rocks' shapes
const hash = (x, y, z, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
const vnoise = (x, y, z, s) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz, s);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz) * 2 - 1;
};
const fbm = (x, y, z, s, n = 3) => {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < n; i++) {
    v += a * vnoise(x, y, z, s + i * 17);
    x *= 2.1;
    y *= 2.1;
    z *= 2.1;
    a *= 0.5;
  }
  return v;
};

// one rock shape: a lumpy, chipped, stretched icosahedron, about unit size
function rockGeometry(seed, detail, chunky) {
  const rand = rng(seed * 31 + 7);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const stretch = new THREE.Vector3(1 + rand() * 0.35, 0.75 + rand() * 0.25, 0.85 + rand() * 0.3);
  // chips: flat faces where a piece broke off
  const cuts = [];
  for (let i = 0; i < (chunky ? 6 : 3); i++) {
    const n = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    cuts.push({ n, d: (chunky ? 0.55 : 0.7) + rand() * 0.25 });
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k = 1 + 0.32 * fbm(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3, seed, 3) + 0.1 * vnoise(v.x * 4, v.y * 4, v.z * 4, seed + 5);
    v.multiplyScalar(k);
    for (const c of cuts) {
      const d = v.dot(c.n);
      if (d > c.d) v.addScaledVector(c.n, -(d - c.d) * 0.85);
    }
    v.multiply(stretch);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  // (sized so its mean radius is about 1: what the collision sphere is)
  geo.computeBoundingSphere();
  let sum = 0;
  for (let i = 0; i < pos.count; i++) sum += v.fromBufferAttribute(pos, i).length();
  const mean = sum / pos.count;
  geo.scale(1 / mean, 1 / mean, 1 / mean);
  geo.computeBoundingSphere();
  return geo;
}

const PALETTES = {
  field: ['#5a5550', '#6b625a', '#4a4744', '#5e5a56', '#3f3b38'],
  ring: ['#7a5240', '#8a6a52', '#5e4a3e', '#9a7a60', '#6e4430'],
  debris: ['#4a4440', '#6a5a4a', '#3a3632', '#8a8070', '#5a4434'],
};

// where each rock goes and how big it is
function layout(kind, count, rand, shape) {
  const out = [];
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  if (kind === 'ring') {
    const { inner = 50, outer = 80, thickness = 4 } = shape;
    for (let i = 0; i < count; i++) {
      const u = (rand() + rand()) / 2;
      const rr = inner + (outer - inner) * u;
      const a = rand() * Math.PI * 2;
      const big = rand() < 0.05;
      const size = big ? 1.4 + rand() * 1.8 : 0.18 + Math.pow(rand(), 3) * 1.2;
      out.push({ p: new THREE.Vector3(Math.cos(a) * rr, gauss() * thickness * 0.5, Math.sin(a) * rr), size });
    }
  } else {
    const R = shape.radius ?? 60;
    const debris = kind === 'debris';
    for (let i = 0; i < count; i++) {
      // a few huge, many small
      const u = rand();
      const size = debris ? 0.15 + Math.pow(u, 5) * 3.2 : 0.25 + Math.pow(u, 7) * 7.75;
      const d = new THREE.Vector3(gauss(), gauss() * (debris ? 0.45 : 0.6), gauss()).normalize();
      const rr = R * Math.pow(rand(), debris ? 0.6 : 0.45);
      out.push({ p: d.multiplyScalar(rr), size });
    }
  }
  return out;
}

export function createRocks({ kind = 'field', at = [0, 0, 0], count = 400, seed = 1, small = false, ...shape } = {}) {
  const rand = rng(seed);
  const group = new THREE.Group();
  group.position.set(...at);
  if (kind === 'ring' && shape.tilt) group.rotation.set(shape.tilt[0] ?? 0, 0, shape.tilt[1] ?? 0);
  group.updateMatrixWorld(true);
  const made = [];
  const n = Math.max(1, Math.round(count * (small ? 0.6 : 1)));
  const rocks = layout(kind, n, rand, shape);

  // the big ones can't overlap each other: nudge them apart
  const order = rocks.map((_, i) => i).sort((a, b) => rocks[b].size - rocks[a].size);
  const bigs = order.slice(0, MAX_SOLIDS).filter((i) => rocks[i].size >= (kind === 'debris' ? 1 : 1.2));
  for (let pass = 0; pass < 4; pass++) {
    for (let a = 0; a < bigs.length; a++) {
      for (let b = a + 1; b < bigs.length; b++) {
        const A = rocks[bigs[a]];
        const B = rocks[bigs[b]];
        const d = A.p.distanceTo(B.p);
        const min = (A.size + B.size) * 1.15;
        if (d < min) {
          const push = B.p.clone().sub(A.p).normalize().multiplyScalar((min - d) * 0.5 + 0.01);
          if (!Number.isFinite(push.x)) push.set(min, 0, 0);
          A.p.sub(push);
          B.p.add(push);
        }
      }
    }
  }

  // the shapes, the materials
  const variants = small ? 3 : 5;
  const detail = small ? 1 : 2;
  const geos = [];
  for (let v = 0; v < variants; v++) geos.push(rockGeometry(seed * 13 + v, v === 0 && !small ? 3 : detail, kind === 'debris'));
  made.push(...geos);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, metalness: 0.04, flatShading: true });
  const hotMat = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.8, metalness: 0, emissive: new THREE.Color('#ff9a3a'), emissiveIntensity: 3, flatShading: true });
  made.push(rockMat, hotMat);
  const palette = (PALETTES[kind] ?? PALETTES.field).map((c) => new THREE.Color(c));

  // which rock is drawn by which mesh; the hot ones (debris) apart
  const spin = [];
  const buckets = new Map();
  const tmpC = new THREE.Color();
  rocks.forEach((rk, i) => {
    const hot = kind === 'debris' && rk.size < 1.6 && rand() < 0.14;
    const v = Math.floor(rand() * variants);
    const key = `${hot ? 'h' : 'r'}${v}`;
    if (!buckets.has(key)) buckets.set(key, { v, hot, list: [] });
    const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    const speed = (0.03 + rand() * 0.25) / Math.sqrt(rk.size) * (rand() < 0.5 ? -1 : 1);
    const phase = rand() * Math.PI * 2;
    const scorched = kind === 'debris' && rand() < 0.35;
    tmpC.copy(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.8 + rand() * 0.4);
    if (scorched) tmpC.lerp(new THREE.Color('#2a221c'), 0.6);
    const s = { i, axis, speed, phase, size: rk.size, p: rk.p, color: tmpC.clone() };
    spin.push(s);
    buckets.get(key).list.push(s);
  });

  const meshes = [];
  for (const b of buckets.values()) {
    const mesh = new THREE.InstancedMesh(geos[b.v], b.hot ? hotMat : rockMat, b.list.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    b.list.forEach((s, j) => {
      s.mesh = mesh;
      s.j = j;
      if (!b.hot) mesh.setColorAt(j, s.color);
    });
    group.add(mesh);
    meshes.push(mesh);
  }

  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const sc = new THREE.Vector3();
  const place = (t) => {
    for (const s of spin) {
      q.setFromAxisAngle(s.axis, s.phase + t * s.speed);
      sc.setScalar(s.size);
      m.compose(s.p, q, sc);
      s.mesh.setMatrixAt(s.j, m);
    }
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  for (const mesh of meshes) {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  // the big rocks, in the world
  const w = new THREE.Vector3();
  const solids = bigs.map((i, k) => {
    w.copy(rocks[i].p).applyMatrix4(group.matrixWorld);
    const r = rocks[i].size * 0.95;
    return { id: `rock-${k}`, at: [w.x, w.y, w.z], r, reach: r };
  });

  const centre = new THREE.Vector3(...at);
  const far = (kind === 'ring' ? shape.outer ?? 80 : shape.radius ?? 60) * 8;
  return {
    group,
    solids,
    update(t, camera) {
      hotMat.emissiveIntensity = 2.8 + 0.5 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
      // (too far off to see them turn: leave them)
      if (camera && camera.position.distanceTo(centre) > far) return;
      place(t);
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const x of made) x.dispose();
      made.length = 0;
    },
  };
}
