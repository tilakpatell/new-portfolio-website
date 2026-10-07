// The traffic and the people walking (./traffic.js), drawn: four kinds of
// car (a saloon, an SUV, a yellow cab, a van), each kind one instanced
// draw, its paint the instance's colour and its glass and tyres dark in
// the vertex colours under it; their head and tail lights, brighter at
// night; and the people, a few dozen triangles each, legs swinging.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RIVER } from './map';
import { carAt, headingOf, walkerAt } from './traffic';

// a part with its own vertex colour, ready to merge
function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0] } = {}) {
  const g = (geo.index ? geo.toNonIndexed() : geo).clone();
  g.rotateX(r[0]).rotateY(r[1]).rotateZ(r[2]).translate(...p);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

const PAINT = 0xffffff;
const GLASS = 0x15191e;
const TYRE = 0x111112;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const wheel = () => new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8);

// one kind of car, front toward +z: [geometry, its length]
function carGeometry(kind) {
  const parts = [];
  const wheels = (wid, len, y = 0.34) => {
    for (const [x, z] of [
      [wid / 2 - 0.1, len * 0.32],
      [-wid / 2 + 0.1, len * 0.32],
      [wid / 2 - 0.1, -len * 0.32],
      [-wid / 2 + 0.1, -len * 0.32],
    ])
      parts.push(part(wheel(), TYRE, { p: [x, y, z], r: [0, 0, Math.PI / 2] }));
  };
  if (kind === 0 || kind === 2) {
    // a saloon (and the cab, with its sign)
    parts.push(part(box(1.8, 0.66, 4.5), PAINT, { p: [0, 0.6, 0] }));
    parts.push(part(box(1.62, 0.52, 2.3), GLASS, { p: [0, 1.18, -0.25] }));
    parts.push(part(box(1.64, 0.08, 2.0), PAINT, { p: [0, 1.46, -0.25] }));
    if (kind === 2) parts.push(part(box(0.7, 0.22, 0.28), 0xf4f1e6, { p: [0, 1.6, -0.2] }));
    wheels(1.8, 4.5);
  } else if (kind === 1) {
    // an SUV
    parts.push(part(box(1.95, 0.9, 4.7), PAINT, { p: [0, 0.75, 0] }));
    parts.push(part(box(1.86, 0.66, 3.1), GLASS, { p: [0, 1.52, -0.35] }));
    parts.push(part(box(1.88, 0.08, 2.9), PAINT, { p: [0, 1.88, -0.35] }));
    wheels(1.95, 4.7, 0.4);
  } else {
    // a van
    parts.push(part(box(2.0, 2.0, 5.4), PAINT, { p: [0, 1.25, -0.2] }));
    parts.push(part(box(1.96, 0.7, 0.9), GLASS, { p: [0, 1.6, 2.15] }));
    parts.push(part(box(2.0, 0.95, 1.2), PAINT, { p: [0, 0.75, 2.55] }));
    wheels(2.0, 5.4, 0.38);
  }
  return mergeGeometries(parts, false);
}

// the lights: two at the front, two at the back
function lightsGeometry(len, wid, y) {
  const parts = [];
  for (const sx of [-1, 1]) {
    parts.push(part(box(0.32, 0.14, 0.05), 0xfff1d6, { p: [sx * (wid / 2 - 0.3), y, len / 2 + 0.01] }));
    parts.push(part(box(0.3, 0.14, 0.05), 0xff1a10, { p: [sx * (wid / 2 - 0.3), y, -len / 2 - 0.01] }));
  }
  return mergeGeometries(parts, false);
}

const CAR_PAINT = [0xf2f2f0, 0xb8bcc2, 0x1b1d22, 0xa8261f, 0x23448a, 0x2d4a39, 0xc9b99a, 0x6b6e74];
const TAXI = 0xf2c018;
const SHIRTS = [0xc94b3a, 0x3a6fb5, 0x2f8a5f, 0xe2b13c, 0x7a4fa0, 0xe8e6e0, 0x2c2f36, 0xd67b3a, 0x4fa3b8, 0xb83d6e];
const LEGS = [0x2c3a55, 0x3b3b3e, 0x6b5a45, 0x1d1f24, 0x8a7c66, 0x41556b];
const SKIN = [0xf2cfb4, 0xe0ac8a, 0xc68863, 0x9b6747, 0x6e4632];

export function buildLife(state) {
  const group = new THREE.Group();
  group.name = 'life';
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0);

  // ── the cars, a draw for each kind ──
  const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38, metalness: 0.35 });
  const dims = [
    [4.5, 1.8, 0.62],
    [4.7, 1.95, 0.8],
    [4.5, 1.8, 0.62],
    [6.4, 2.0, 0.8],
  ];
  const byKind = [0, 1, 2, 3].map((k) => state.cars.filter((c) => c.kind === k));
  const carMeshes = byKind.map((list, k) => {
    const m = new THREE.InstancedMesh(carGeometry(k), carMat, Math.max(1, list.length));
    list.forEach((c, i) => m.setColorAt(i, new THREE.Color(k === 2 ? TAXI : CAR_PAINT[Math.floor(c.colour * CAR_PAINT.length)])));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  const lightMeshes = byKind.map((list, k) => {
    const [len, wid, y] = dims[k];
    const m = new THREE.InstancedMesh(lightsGeometry(len, wid, y), lightMat, Math.max(1, list.length));
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  });
  const yaw = new Map(); // what's drawn eases round a corner

  // ── the people: a torso, a head, two legs ──
  const n = state.walkers.length;
  const torso = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.62, 0.24).translate(0, 1.16, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), Math.max(1, n));
  const head = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0).translate(0, 1.62, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), Math.max(1, n));
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.85, 0.16).translate(0, -0.425, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), Math.max(1, n * 2));
  state.walkers.forEach((w, i) => {
    torso.setColorAt(i, new THREE.Color(SHIRTS[(w.id * 7 + w.kind) % SHIRTS.length]));
    head.setColorAt(i, new THREE.Color(SKIN[(w.id * 3) % SKIN.length]));
    const leg = new THREE.Color(LEGS[(w.id * 5 + w.kind) % LEGS.length]);
    legs.setColorAt(i * 2, leg);
    legs.setColorAt(i * 2 + 1, leg);
  });
  for (const m of [torso, head, legs]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
  }
  const legQ = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0);
  // each walker's last place and the way they're drawn facing
  const was = new Float32Array(Math.max(1, n) * 2);
  const facing = new Float32Array(Math.max(1, n));
  const seen = new Uint8Array(Math.max(1, n));

  let lastNight = -1;
  return {
    group,
    update(st, dt, camera, night = 0) {
      // the cars
      for (let k = 0; k < 4; k++) {
        const list = byKind[k];
        const count = list.length;
        for (let i = 0; i < count; i++) {
          const c = st.cars[list[i].id];
          const [x, z] = carAt(c);
          const want = headingOf(c);
          let a = yaw.get(c.id) ?? want;
          a += Math.atan2(Math.sin(want - a), Math.cos(want - a)) * Math.min(1, dt * 7);
          yaw.set(c.id, a);
          const y = x > RIVER.x0 - 20 && x < RIVER.x1 + 20 ? 0.42 : 0.02;
          M4.compose(P.set(x, y, z), Q.setFromAxisAngle(UP, a), S);
          carMeshes[k].setMatrixAt(i, M4);
          lightMeshes[k].setMatrixAt(i, M4);
        }
        carMeshes[k].count = lightMeshes[k].count = count;
        carMeshes[k].instanceMatrix.needsUpdate = true;
        lightMeshes[k].instanceMatrix.needsUpdate = true;
      }
      if (Math.abs(night - lastNight) > 0.01) {
        lastNight = night;
        lightMat.color.setScalar(0.35 + night * 3.2);
      }
      // the people: each facing the way they're going (worked out from how
      // they moved since the last frame, so a walk back to the pavement
      // faces back to it, not along the street), turned round to it the way
      // the cars are, not snapped
      const count = n;
      for (let i = 0; i < count; i++) {
        const w = st.walkers[i];
        const [x, z] = walkerAt(w);
        const along = w.flee > 0 ? Math.atan2(w.fx, w.fz) : w.axis === 'x' ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : w.dir > 0 ? 0 : Math.PI;
        const px = was[i * 2];
        const pz = was[i * 2 + 1];
        const step = Math.hypot(x - px, z - pz);
        let want = along;
        if (step > 4 || !seen[i]) facing[i] = along; // (put somewhere new: straight round)
        else if (step > 1e-4 && dt > 0) {
          // mostly how they moved, the street's way breaking the tie when they barely did
          const k = Math.min(1, step / (dt * 0.6));
          const mx = Math.sin(along) * (1 - k) + ((x - px) / step) * k;
          const mz = Math.cos(along) * (1 - k) + ((z - pz) / step) * k;
          want = Math.atan2(mx, mz);
        }
        seen[i] = 1;
        was[i * 2] = x;
        was[i * 2 + 1] = z;
        facing[i] += Math.atan2(Math.sin(want - facing[i]), Math.cos(want - facing[i])) * Math.min(1, dt * (w.flee > 0 ? 10 : 6));
        const heading = facing[i];
        Q.setFromAxisAngle(UP, heading);
        M4.compose(P.set(x, 0, z), Q, S);
        torso.setMatrixAt(i, M4);
        head.setMatrixAt(i, M4);
        const swing = Math.sin(w.phase * 5.5) * (w.flee > 0 ? 0.75 : 0.42);
        for (const [j, sgn, off] of [
          [0, 1, 0.1],
          [1, -1, -0.1],
        ]) {
          legQ.copy(Q).multiply(new THREE.Quaternion().setFromAxisAngle(AX, swing * sgn));
          const ox = Math.cos(heading) * off;
          const oz = -Math.sin(heading) * off;
          M4.compose(P.set(x + ox, 0.86, z + oz), legQ, S);
          legs.setMatrixAt(i * 2 + j, M4);
        }
      }
      torso.count = head.count = count;
      legs.count = count * 2;
      for (const m of [torso, head, legs]) m.instanceMatrix.needsUpdate = true;
    },
  };
}
