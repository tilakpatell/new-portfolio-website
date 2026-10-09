// Legs for the people who came as statues (a Sketchfab Ewok, Geonosian or
// Gungan with no skeleton): found in the model, skinned, and walked. The
// crotch is the lowest height where the two legs stop being apart, the hips
// a little over it, the knees half way down, the ankles near the ground;
// each leg's vertices are weighed to its thigh, shin and foot (blended over
// a band at each joint, so nothing tears) and the rest to the body. Then the
// legs swing by the ground the figure covers (a stride a little over its leg
// long, each foot down half the cycle, the knee bending as it comes
// through), the foot kept flat, the hips dipping over each step. A figure
// whose legs never part (a Jawa's robe to the ground) gets none: it's left
// to its sway (actors.js).
//
// surfacePoints(positions, index, count) → about `count` points spread over
//   the triangles by their area (pure, the same each time): a low-poly
//   model's legs have vertices only at the hip and the ankle, so a slice
//   through them finds none of its vertices
// findLegs(points, { bottom, top }) → { crotch, hip, knee, ankle, legs:
//   [{ x, z }, { x, z }] } (left, +x, first) or null (pure)
// legWeights(p, legs) → [[bone, w] …] (pure)
// legGait(g, dt, speed, legs) → g, and legPose(g, i, legs) → { thigh, knee,
//   foot } in radians about the leg's axis (pure)
// leggedFigure(scene, { seed, tall }) → a figure (actors.js's shape) or null

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { NO_CALLS } from '../../../lib/three/figureCalls';

const SLICE = 0.015; // of its height: how thick a slice through it is
const GAP = 0.015; // of its height: an empty band this wide between the legs keeps them apart

export function surfacePoints(positions, index, count) {
  const tri = index ? index.length / 3 : positions.length / 9;
  const at = (t, k) => (index ? index[t * 3 + k] : t * 3 + k) * 3;
  const area = new Float64Array(tri);
  let total = 0;
  for (let t = 0; t < tri; t++) {
    const a = at(t, 0);
    const b = at(t, 1);
    const c = at(t, 2);
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    area[t] = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    total += area[t];
  }
  const out = [];
  if (!(total > 0)) return out;
  let carry = 0;
  let i = 0;
  for (let t = 0; t < tri; t++) {
    carry += (area[t] / total) * count;
    const a = at(t, 0);
    const b = at(t, 1);
    const c = at(t, 2);
    for (; carry >= 1; carry -= 1, i++) {
      // (a low-discrepancy pair, folded into the triangle)
      let r = (0.5 + i * 0.7548776662466927) % 1;
      let q = (0.5 + i * 0.5698402909980532) % 1;
      if (r + q > 1) [r, q] = [1 - r, 1 - q];
      const p = 1 - r - q;
      out.push([0, 1, 2].map((k) => positions[a + k] * p + positions[b + k] * r + positions[c + k] * q));
    }
  }
  return out;
}

// two clusters of points in the ground plane (k-means, seeded from the
// two points furthest apart): [{ x, z, n }, { x, z, n }]
function twoOf(pts) {
  let a = pts[0];
  let b = pts[0];
  for (const p of pts) if (Math.hypot(p[0] - a[0], p[2] - a[2]) > Math.hypot(b[0] - a[0], b[2] - a[2])) b = p;
  a = b;
  for (const p of pts) if (Math.hypot(p[0] - a[0], p[2] - a[2]) > Math.hypot(b[0] - a[0], b[2] - a[2])) b = p;
  let c = [
    { x: a[0], z: a[2], n: 0 },
    { x: b[0], z: b[2], n: 0 },
  ];
  for (let it = 0; it < 12; it++) {
    const s = [
      { x: 0, z: 0, n: 0 },
      { x: 0, z: 0, n: 0 },
    ];
    for (const p of pts) {
      const k = Math.hypot(p[0] - c[0].x, p[2] - c[0].z) <= Math.hypot(p[0] - c[1].x, p[2] - c[1].z) ? 0 : 1;
      s[k].x += p[0];
      s[k].z += p[2];
      s[k].n += 1;
    }
    if (!s[0].n || !s[1].n) return null;
    c = s.map((q) => ({ x: q.x / q.n, z: q.z / q.n, n: q.n }));
  }
  return c;
}
// the widest empty band across the axis between two legs, near its middle
function gapAlong(pts, mid, u, reach) {
  const t = pts.map((p) => (p[0] - mid[0]) * u[0] + (p[2] - mid[1]) * u[1]).filter((v) => Math.abs(v) < reach).sort((x, y) => x - y);
  if (t.length < 6) return 0;
  // (empty either side of the middle counts, so a gap at the middle is found whole)
  let best = 0;
  for (let i = 1; i < t.length; i++) if (t[i - 1] <= 0.25 * reach && t[i] >= -0.25 * reach) best = Math.max(best, t[i] - t[i - 1]);
  return best;
}

export function findLegs(points, { bottom = 0, top = null, crotch: at = null, x: legX = null } = {}) {
  const hTop = top ?? points.reduce((m, p) => Math.max(m, p[1]), -Infinity);
  const h = hTop - bottom;
  if (!(h > 0)) return null;
  const slice = (y) => points.filter((p) => Math.abs(p[1] - y) < SLICE * h);
  // the legs where they're surely apart: low down
  const low = slice(bottom + 0.15 * h);
  if (low.length < 12) return null;
  // (legs said where they are: a catalogue row's, for a model whose spear or
  // stance would fool the looking)
  const zMid = low.reduce((a, p) => a + p[2], 0) / low.length;
  const c = legX != null ? [{ x: legX, z: zMid, n: low.length }, { x: -legX, z: zMid, n: low.length }] : twoOf(low);
  if (!c) return null;
  const dx = c[0].x - c[1].x;
  const dz = c[0].z - c[1].z;
  const d = Math.hypot(dx, dz);
  // (two legs a plausible way apart, neither a stray spear's point)
  if (d < 0.06 * h || d > 0.6 * h || Math.min(c[0].n, c[1].n) < 0.2 * low.length) return null;
  const u = [dx / d, dz / d];
  const mid = [(c[0].x + c[1].x) / 2, (c[0].z + c[1].z) / 2];
  if (legX == null && gapAlong(low, mid, u, d) < GAP * h) return null;
  // up from there until the space between them fills (in from either side
  // as much as a fifth of its points: the crotch); a tail or a cloak's hem
  // behind or before the legs is left out of it
  const deep = Math.max(0.5 * d, 0.15 * h);
  const filled = (y) => {
    let n = 0;
    let inner = 0;
    for (const p of slice(y)) {
      const t = (p[0] - mid[0]) * u[0] + (p[2] - mid[1]) * u[1];
      const s = -(p[0] - mid[0]) * u[1] + (p[2] - mid[1]) * u[0];
      if (Math.abs(s) > deep || Math.abs(t) > 1.5 * d) continue;
      n += 1;
      if (Math.abs(t) < 0.2 * d) inner += 1;
    }
    return n >= 6 && inner / n > 0.2;
  };
  let crotch = at != null ? bottom + at * h : null;
  for (let y = bottom + 0.15 * h; crotch == null && y < bottom + 0.75 * h; y += 0.01 * h) {
    if (filled(y)) {
      crotch = y;
      break;
    }
  }
  if (crotch == null || crotch - bottom < 0.15 * h) return null;
  // left (+x) first
  const legs = c[0].x >= c[1].x ? [c[0], c[1]] : [c[1], c[0]];
  const sign = legs[0] === c[0] ? 1 : -1;
  const legLen = crotch - bottom;
  return {
    crotch,
    mid,
    axis: [u[0] * sign, u[1] * sign], // (from the right leg toward the left)
    half: d / 2,
    hip: crotch + 0.06 * legLen,
    knee: bottom + 0.52 * legLen,
    ankle: bottom + 0.1 * legLen,
    bottom,
    legs: legs.map((q) => ({ x: q.x, z: q.z })),
  };
}

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// bones: 0 the body (and pelvis), then each side's thigh, shin, foot: left 1–3, right 4–6
export function legWeights(p, legs) {
  const legLen = legs.hip - legs.bottom;
  const band = 0.12 * legLen;
  const [x, y, z] = p;
  const t = (x - legs.mid[0]) * legs.axis[0] + (z - legs.mid[1]) * legs.axis[1];
  const side = t >= 0 ? 0 : 1;
  // (into the leg below the hips; a vertex near the middle, above the crotch, stays the body's)
  const inLeg = 1 - smooth(legs.hip - band * 0.5, legs.hip + band, y);
  const off = Math.abs(t) / Math.max(1e-6, legs.half);
  const w = inLeg * (y < legs.crotch ? 1 : smooth(0.15, 0.75, off));
  const shin = smooth(legs.knee + band * 0.5, legs.knee - band * 0.5, y);
  const foot = smooth(legs.ankle + band * 0.4, legs.ankle - band * 0.2, y);
  const b = 1 + side * 3;
  return [
    [0, 1 - w],
    [b, w * (1 - shin)],
    [b + 1, w * shin * (1 - foot)],
    [b + 2, w * shin * foot],
  ];
}

// the stride's clock, by the ground covered (a cycle: two steps)
export function legGait(g, dt, speed, legs) {
  const cycle = 1.6 * (legs.hip - legs.bottom);
  g.phase = (((g.phase + (speed * dt) / cycle) % 1) + 1) % 1;
  const want = Math.abs(speed) > 0.05 ? 1 : 0;
  g.amount += (want - g.amount) * Math.min(1, dt * (want ? 5 : 3));
  return g;
}
// a leg's swing at that point in the cycle: through about ±23°, each foot
// sweeping back as far as the body goes over it (half the cycle down), the
// knee folding as it swings through, the foot level
export function legPose(g, i, legs) {
  const legLen = legs.hip - legs.bottom;
  const swing = Math.asin(Math.min(0.6, (1.6 * legLen) / 4 / legLen));
  const a = (g.phase + i * 0.5) * Math.PI * 2;
  const thigh = -Math.sin(a) * swing * g.amount;
  const knee = Math.max(0, Math.sin(a + 0.6)) * 0.9 * g.amount;
  return { thigh, knee, foot: -(thigh + knee) };
}

// standing, the weight shifted from foot to foot: one knee eased, the
// thigh forward half as far and the foot level, so the ankle stays under
// the hip; none of it while it walks (amount 1)
export function standPose(clock, seed, i, amount) {
  const bend = (1 - amount) * 0.1 * (0.5 + 0.5 * Math.sin(clock * 0.45 + seed + i * Math.PI));
  return { thigh: -bend / 2, knee: bend, foot: 0 - bend / 2 };
}

// every vertex of the model, as floats in its own frame: [{ mesh, positions }]
function baked(scene) {
  scene.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const g = o.geometry.clone();
    const raw = g.attributes.position;
    const f = new Float32Array(raw.count * 3);
    for (let k = 0; k < raw.count; k++) f.set([raw.getX(k), raw.getY(k), raw.getZ(k)], k * 3);
    g.setAttribute('position', new THREE.BufferAttribute(f, 3));
    m.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(m);
    out.push({ mesh: o, geometry: g });
  });
  return out;
}

// One kind's legged template, skinned once; each figure of it a copy.
const templates = new WeakMap(); // the loaded scene → template | null
function templateOf(scene, given = {}) {
  if (templates.has(scene)) return templates.get(scene);
  const parts = baked(scene);
  const pts = [];
  for (const { geometry } of parts) {
    const p = geometry.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 6000));
    for (let k = 0; k < p.count; k += step) pts.push([p.getX(k), p.getY(k), p.getZ(k)]);
  }
  // (and points over the surface, for legs too low-poly for their vertices to show)
  const tris = parts.reduce((n, { geometry: g }) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  for (const { geometry: g } of parts) {
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    pts.push(...surfacePoints(g.attributes.position.array, g.index?.array ?? null, Math.round((12000 * n) / Math.max(1, tris))));
  }
  const bottom = pts.reduce((a, p) => Math.min(a, p[1]), Infinity);
  const legs = findLegs(pts, { bottom, ...given });
  if (!legs) {
    for (const { geometry } of parts) geometry.dispose();
    templates.set(scene, null);
    return null;
  }
  const root = new THREE.Group();
  const body = new THREE.Bone();
  body.name = 'Hips';
  body.position.set(legs.mid[0], legs.hip, legs.mid[1]);
  const bones = [body];
  legs.legs.forEach((l, i) => {
    const s = i === 0 ? 'Left' : 'Right';
    const thigh = new THREE.Bone();
    thigh.name = `${s}UpLeg`;
    thigh.position.set(l.x - body.position.x, 0, l.z - body.position.z);
    const shin = new THREE.Bone();
    shin.name = `${s}Leg`;
    shin.position.set(0, legs.knee - legs.hip, 0);
    const foot = new THREE.Bone();
    foot.name = `${s}Foot`;
    foot.position.set(0, legs.ankle - legs.knee, 0);
    body.add(thigh);
    thigh.add(shin);
    shin.add(foot);
    bones.push(thigh, shin, foot);
  });
  root.add(body);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const { mesh, geometry } of parts) {
    const p = geometry.attributes.position;
    const idx = new Uint16Array(p.count * 4);
    const wts = new Float32Array(p.count * 4);
    for (let k = 0; k < p.count; k++) {
      const ws = legWeights([p.getX(k), p.getY(k), p.getZ(k)], legs);
      ws.forEach(([b, w], j) => {
        idx[k * 4 + j] = b;
        wts[k * 4 + j] = w;
      });
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(wts, 4));
    const sk = new THREE.SkinnedMesh(geometry, mesh.material);
    sk.name = mesh.name;
    sk.castShadow = mesh.castShadow;
    sk.receiveShadow = mesh.receiveShadow;
    sk.frustumCulled = false;
    root.add(sk);
    sk.bind(skeleton, new THREE.Matrix4());
  }
  const t = { root, legs };
  templates.set(scene, t);
  return t;
}

export function leggedFigure(scene, { seed = 0, legs = {} } = {}) {
  const t = templateOf(scene, legs);
  if (!t) return null;
  const inner = cloneSkinned(t.root);
  const bone = (n) => inner.getObjectByName(n);
  const hips = bone('Hips');
  const sides = ['Left', 'Right'].map((s) => ({ thigh: bone(`${s}UpLeg`), shin: bone(`${s}Leg`), foot: bone(`${s}Foot`) }));
  const restY = hips.position.y;
  const model = new THREE.Group();
  model.add(inner);
  const box = new THREE.Box3().setFromObject(scene);
  const tall = box.max.y - box.min.y;
  const g = { phase: (seed % 1000) / 1000, amount: 0 };
  let clock = 0;
  return {
    model,
    tall,
    anim: null,
    update(dt, move, motion = null) {
      clock += dt;
      const k = model.scale.x || 1;
      const speed = (motion ? (motion.speed ?? 0) : move * 2.4) / k;
      legGait(g, dt, speed, t.legs);
      sides.forEach((s, i) => {
        const p = legPose(g, i, t.legs);
        const w = standPose(clock, seed, i, g.amount);
        s.thigh.rotation.x = p.thigh + w.thigh;
        s.shin.rotation.x = p.knee + w.knee;
        s.foot.rotation.x = p.foot + w.foot;
      });
      // (the hips dip as each foot passes under them, and breathe standing)
      const legLen = t.legs.hip - t.legs.bottom;
      hips.position.y = restY - legLen * 0.035 * g.amount * (0.5 + 0.5 * Math.cos(g.phase * Math.PI * 4)) + Math.sin(clock * 1.7 + seed) * 0.003 * legLen * (1 - g.amount);
      hips.rotation.z = Math.sin(g.phase * Math.PI * 2) * 0.04 * g.amount;
    },
    ...NO_CALLS,
    sway: () => ({ y: 0, roll: 0 }),
    dispose() {},
  };
}
