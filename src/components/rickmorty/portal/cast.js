// Portal panic's cast, built from simple shapes in flat colour, the way the
// show draws them: big round eyes with dot pupils, a unibrow, Rick's spiky
// blue-grey hair and lab coat, Morty's yellow shirt. Each figure faces +z;
// animate() swings the legs and arms as it moves, bobs it, and squashes it
// when it's hit. Shapes and materials are shared between every copy.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from './toon';

const G = {};
const geo = (k) => {
  if (G[k]) return G[k];
  if (k === 'sphere') G[k] = new THREE.SphereGeometry(1, 22, 16);
  else if (k === 'lowsphere') G[k] = new THREE.SphereGeometry(1, 10, 8);
  else if (k === 'cyl') G[k] = new THREE.CylinderGeometry(1, 1, 1, 16);
  else if (k === 'cone') G[k] = new THREE.ConeGeometry(1, 1, 12);
  else if (k === 'box') G[k] = new THREE.BoxGeometry(1, 1, 1);
  else if (k === 'capsule') G[k] = new THREE.CapsuleGeometry(1, 1, 6, 14);
  else if (k === 'coat') {
    // a lab coat: an open cylinder, flared, its opening at the front
    const g = new THREE.CylinderGeometry(0.3, 0.44, 1, 20, 1, true, Math.PI * 0.62, Math.PI * 1.76);
    G[k] = g;
  } else if (k === 'torus') G[k] = new THREE.TorusGeometry(1, 0.18, 8, 24);
  return G[k];
};

const MATS = new Map();
const mat = (hex, o = {}) => {
  const key = `${hex}-${o.emissive ?? ''}-${o.opacity ?? ''}`;
  if (!MATS.has(key)) {
    const m = toon(hex, o.opacity ? { transparent: true, opacity: o.opacity, depthWrite: false } : {});
    if (o.emissive != null) {
      m.emissive = new THREE.Color(o.emissive);
      m.emissiveIntensity = o.k ?? 2;
    }
    m.userData.shared = true;
    MATS.set(key, m);
  }
  return MATS.get(key);
};

function part(parent, g, hex, s, p, r = [0, 0, 0], o) {
  const m = new THREE.Mesh(geo(g), mat(hex, o));
  m.scale.set(s[0], s[1], s[2]);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.castShadow = !o?.opacity;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// an eye: a white ball and a dot of a pupil, looking out along +z
function eye(parent, x, y, z, r, { pupil = 0.32, white = 0xffffff, lid = null } = {}) {
  const e = part(parent, 'sphere', white, [r, r, r * 0.9], [x, y, z]);
  part(e, 'lowsphere', 0x111111, [pupil, pupil, pupil * 0.6], [0, 0, 0.92]);
  if (lid) part(e, 'sphere', lid, [1.05, 0.55, 1.05], [0, 0.5, 0]);
  return e;
}

// a limb hung from a joint: the group turns at the hip or shoulder
function limb(parent, r, len, hex, at, end = null, endHex = null) {
  const j = new THREE.Group();
  j.position.set(at[0], at[1], at[2]);
  parent.add(j);
  part(j, 'capsule', hex, [r, len / 3, r], [0, -len / 2, 0]);
  if (end === 'shoe') part(j, 'box', endHex, [r * 2.2, r * 1.2, r * 3], [0, -len - r * 0.2, r * 0.6]);
  else if (end === 'hand') part(j, 'sphere', endHex, [r * 1.25, r * 1.25, r * 1.25], [0, -len - r * 0.4, 0]);
  return j;
}

function rig(kind) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  return { kind, group, body, legs: null, arms: null, bodyY: 0, stride: 10, gun: null };
}

const SKIN = 0xf2d3b8;

// ── the heroes ──

function rick({ coat = 0xf4f3ee, shirt = 0x8fd2e7, pants = 0x7c5a3f, hair = 0xa9d7e8, cap = null } = {}) {
  const c = rig('rick');
  const b = c.body;
  c.legs = [-1, 1].map((s) => limb(b, 0.1, 0.72, pants, [s * 0.13, 0.82, 0], 'shoe', 0x2b2b2b));
  part(b, 'capsule', shirt, [0.21, 0.17, 0.16], [0, 1.15, 0]);
  const coatM = part(b, 'coat', coat, [1, 0.95, 0.85], [0, 1.0, 0]);
  coatM.material = mat(coat);
  part(b, 'cyl', coat, [0.25, 0.08, 0.2], [0, 1.43, 0]); // shoulders
  c.arms = [-1, 1].map((s) => limb(b, 0.085, 0.58, coat, [s * 0.31, 1.42, 0], 'hand', SKIN));
  const head = new THREE.Group();
  head.position.set(0, 1.74, 0.02);
  b.add(head);
  part(head, 'sphere', SKIN, [0.25, 0.3, 0.25], [0, 0, 0]);
  eye(head, -0.1, 0.05, 0.18, 0.085, { pupil: 0.22 });
  eye(head, 0.1, 0.05, 0.18, 0.085, { pupil: 0.22 });
  part(head, 'box', 0x9fb7c2, [0.32, 0.035, 0.05], [0, 0.15, 0.22]); // the unibrow
  part(head, 'box', 0x5a3a32, [0.13, 0.02, 0.03], [0, -0.17, 0.22], [0, 0, -0.1]); // mouth
  part(head, 'sphere', SKIN, [0.05, 0.07, 0.06], [0, -0.04, 0.26]); // nose
  if (cap) {
    part(head, 'cyl', cap, [0.27, 0.12, 0.27], [0, 0.24, 0]);
    part(head, 'cyl', cap, [0.3, 0.02, 0.32], [0, 0.18, 0.06]);
    part(head, 'box', 0xe6c34a, [0.07, 0.06, 0.02], [0, 0.26, 0.27]);
  } else {
    // spiky hair: a crown of cones fanning back and up
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.85 + (i / 8) * Math.PI * 1.7;
      const up = 0.35 + Math.abs(Math.cos(a / 2)) * 0.15;
      part(head, 'cone', hair, [0.1, 0.32, 0.1], [Math.sin(a) * 0.22, 0.17 + up * 0.25, -Math.cos(a) * 0.17 - 0.03], [-Math.cos(a) * 0.9 - 0.3, 0, Math.sin(a) * 0.9]);
    }
    part(head, 'sphere', hair, [0.26, 0.2, 0.25], [0, 0.13, -0.05]);
  }
  c.head = head;
  c.gun = gun(c.arms[1]);
  c.bodyY = 0;
  c.height = 2;
  return c;
}

// the portal gun: grey, a glass bulb of green fluid on top, a green tip
function gun(arm) {
  const g = portalGun();
  g.position.set(0, -0.62, 0.12);
  g.rotation.x = -Math.PI / 2;
  arm.add(g);
  return g;
}
export function portalGun() {
  const g = new THREE.Group();
  part(g, 'box', 0xb9c3c9, [0.12, 0.3, 0.14], [0, 0.05, 0]);
  part(g, 'sphere', 0x7dff8a, [0.07, 0.07, 0.07], [0, 0.08, 0.1], [0, 0, 0], { emissive: 0x4dff6a, k: 1.6 });
  const tip = part(g, 'cyl', 0x7dff8a, [0.05, 0.06, 0.05], [0, 0.23, 0], [0, 0, 0], { emissive: 0x4dff6a, k: 2.4 });
  g.userData.tip = tip;
  return g;
}

function morty({ shirt = 0xf3d84b, pants = 0x3b65b8, hair = 0x6a3d1f, patch = false } = {}) {
  const c = rig('morty');
  const b = c.body;
  c.legs = [-1, 1].map((s) => limb(b, 0.1, 0.5, pants, [s * 0.12, 0.58, 0], 'shoe', 0xf1f1f1));
  part(b, 'capsule', shirt, [0.24, 0.13, 0.19], [0, 0.82, 0]);
  c.arms = [-1, 1].map((s) => limb(b, 0.075, 0.4, shirt, [s * 0.28, 1.0, 0], 'hand', SKIN));
  const head = new THREE.Group();
  head.position.set(0, 1.33, 0.02);
  b.add(head);
  part(head, 'sphere', SKIN, [0.31, 0.3, 0.29], [0, 0, 0]);
  eye(head, -0.11, 0.03, 0.22, 0.1, { pupil: 0.14 });
  if (patch) part(head, 'sphere', 0x111111, [0.11, 0.11, 0.06], [0.11, 0.03, 0.26]);
  else eye(head, 0.11, 0.03, 0.22, 0.1, { pupil: 0.14 });
  if (patch) part(head, 'box', 0x111111, [0.62, 0.025, 0.02], [0, 0.08, 0.2], [0, 0, -0.35]);
  part(head, 'box', 0x5a3a32, [0.11, 0.02, 0.03], [0, -0.14, 0.27]);
  part(head, 'sphere', hair, [0.32, 0.22, 0.3], [0, 0.11, -0.03]);
  c.head = head;
  c.gun = gun(c.arms[1]);
  c.gun.position.y = -0.44;
  c.height = 1.6;
  return c;
}

function pickle() {
  const c = rig('pickle');
  const b = c.body;
  const pk = new THREE.Group();
  pk.position.y = 0.62;
  b.add(pk);
  part(pk, 'capsule', 0x83b84a, [0.27, 0.22, 0.25], [0, 0, 0]);
  // bumps
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39;
    const y = -0.4 + (i / 13) * 0.75;
    part(pk, 'lowsphere', 0x6c9c3a, [0.05, 0.05, 0.05], [Math.cos(a) * 0.25, y, Math.sin(a) * 0.23 - 0.02]);
  }
  eye(pk, -0.09, 0.22, 0.21, 0.07, { pupil: 0.24 });
  eye(pk, 0.09, 0.22, 0.21, 0.07, { pupil: 0.24 });
  part(pk, 'box', 0x3e5e22, [0.26, 0.03, 0.04], [0, 0.32, 0.22]);
  part(pk, 'box', 0x3e2a22, [0.12, 0.02, 0.03], [0, 0.08, 0.25], [0, 0, 0.1]);
  c.pickle = pk;
  c.height = 1.3;
  return c;
}

// ── the enemies ──

function meeseeks(small = false) {
  const c = rig('meeseeks');
  const b = c.body;
  const blue = 0x6fc6ea;
  c.legs = [-1, 1].map((s) => limb(b, 0.07, 0.72, blue, [s * 0.1, 0.78, 0]));
  part(b, 'capsule', blue, [0.15, 0.2, 0.13], [0, 1.08, 0]);
  // arms up, as if existence were pain
  c.arms = [-1, 1].map((s) => {
    const a = limb(b, 0.055, 0.62, blue, [s * 0.2, 1.3, 0], 'hand', blue);
    a.rotation.z = s * 2.6;
    return a;
  });
  c.armsUp = true;
  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  b.add(head);
  part(head, 'sphere', blue, [0.22, 0.25, 0.21], [0, 0, 0]);
  eye(head, -0.08, 0.06, 0.16, 0.07, { pupil: 0.45 });
  eye(head, 0.08, 0.06, 0.16, 0.07, { pupil: 0.45 });
  part(head, 'sphere', 0x2a1a2a, [0.08, 0.07, 0.04], [0, -0.1, 0.19]);
  c.head = head;
  c.height = 1.85;
  if (small) c.group.scale.setScalar(0.75);
  return c;
}

function gromflomite() {
  const c = rig('gromflomite');
  const b = c.body;
  const suit = 0x2f3c4a;
  c.legs = [-1, 1].map((s) => limb(b, 0.09, 0.6, suit, [s * 0.13, 0.68, 0], 'shoe', 0x1a1a1a));
  part(b, 'capsule', suit, [0.22, 0.16, 0.17], [0, 0.98, 0]);
  part(b, 'box', 0xc8a63a, [0.12, 0.1, 0.03], [0.1, 1.1, 0.17]); // a badge
  c.arms = [-1, 1].map((s) => limb(b, 0.075, 0.48, suit, [s * 0.28, 1.2, 0], 'hand', 0x6f8a4a));
  const head = new THREE.Group();
  head.position.set(0, 1.45, 0.03);
  b.add(head);
  part(head, 'sphere', 0x7f9a52, [0.24, 0.28, 0.27], [0, 0.03, 0]);
  // compound eyes, glossy black
  for (const s of [-1, 1]) part(head, 'sphere', 0x101418, [0.1, 0.13, 0.08], [s * 0.12, 0.08, 0.2], [0, s * 0.4, 0]);
  part(head, 'cone', 0x5d7a3a, [0.05, 0.12, 0.05], [0, -0.22, 0.2], [Math.PI, 0, 0]);
  for (const s of [-1, 1]) {
    const ant = part(head, 'cyl', 0x5d7a3a, [0.012, 0.28, 0.012], [s * 0.08, 0.38, 0.02], [0, 0, -s * 0.35]);
    part(ant, 'lowsphere', 0x5d7a3a, [3, 0.12, 3], [0, 0.55, 0]);
  }
  c.head = head;
  c.gun = gun(c.arms[1]);
  c.gun.position.y = -0.5;
  c.height = 1.85;
  return c;
}

function cronenberg(scale = 1, eyes = 4) {
  const c = rig('cronenberg');
  const b = c.body;
  const flesh = 0xe79aa2;
  const blob = part(b, 'sphere', flesh, [0.7, 0.55, 0.62], [0, 0.6, 0]);
  part(b, 'sphere', 0xd9838d, [0.45, 0.38, 0.42], [0.25, 0.95, -0.1]);
  part(b, 'sphere', 0x8a2a3a, [0.22, 0.12, 0.08], [0, 0.45, 0.58]); // a mouth
  for (let i = 0; i < 6; i++) part(b, 'cone', 0xf4f0e6, [0.035, 0.08, 0.035], [-0.15 + i * 0.06, 0.51, 0.62], [Math.PI, 0, 0]);
  for (let i = 0; i < eyes; i++) {
    const a = -0.9 + (i / Math.max(1, eyes - 1)) * 1.8;
    eye(b, Math.sin(a) * 0.5, 0.82 + Math.cos(i * 2.1) * 0.15, Math.cos(a) * 0.5, 0.08 + (i % 3) * 0.03, { pupil: 0.3 });
  }
  // stumpy legs and a couple of wrong arms
  c.legs = [-1, 1].map((s) => limb(b, 0.12, 0.32, 0xd27a86, [s * 0.32, 0.32, 0.05]));
  c.arms = [-1, 1].map((s) => {
    const a = limb(b, 0.08, 0.5, 0xd27a86, [s * 0.6, 0.75, 0], 'hand', 0xd27a86);
    a.rotation.z = s * 0.6;
    return a;
  });
  c.blob = blob;
  c.stride = 6;
  c.group.scale.setScalar(scale);
  c.height = 1.3 * scale;
  return c;
}

function blob() {
  const c = rig('blob');
  const b = c.body;
  part(b, 'sphere', 0xef9fa8, [0.38, 0.32, 0.36], [0, 0.32, 0]);
  eye(b, -0.12, 0.42, 0.28, 0.08);
  eye(b, 0.13, 0.38, 0.29, 0.06);
  part(b, 'sphere', 0x8a2a3a, [0.1, 0.05, 0.04], [0, 0.22, 0.34]);
  c.stride = 14;
  c.height = 0.7;
  return c;
}

function gazorpian() {
  const c = rig('gazorpian');
  const b = c.body;
  const hide = 0xb75a3c;
  c.legs = [-1, 1].map((s) => limb(b, 0.17, 0.7, 0x7a3a26, [s * 0.28, 0.82, 0], 'shoe', 0x4a2418));
  part(b, 'sphere', hide, [0.62, 0.6, 0.5], [0, 1.35, 0]); // a barrel of a chest
  part(b, 'sphere', 0xd88a62, [0.4, 0.4, 0.2], [0, 1.25, 0.32]);
  c.arms = [-1, 1].map((s) => limb(b, 0.17, 0.95, hide, [s * 0.66, 1.65, 0], 'hand', 0x7a3a26));
  const head = new THREE.Group();
  head.position.set(0, 1.95, 0.25);
  b.add(head);
  part(head, 'sphere', hide, [0.26, 0.22, 0.24], [0, 0, 0]);
  part(head, 'box', 0x8e3f28, [0.36, 0.14, 0.26], [0, -0.16, 0.06]); // the underbite
  for (const s of [-1, 1]) part(head, 'cone', 0xf2ecd8, [0.04, 0.12, 0.04], [s * 0.13, -0.05, 0.18]);
  eye(head, -0.09, 0.07, 0.19, 0.05, { pupil: 0.4, lid: hide });
  eye(head, 0.09, 0.07, 0.19, 0.05, { pupil: 0.4, lid: hide });
  for (const s of [-1, 1]) part(head, 'cone', 0x4a2418, [0.05, 0.22, 0.05], [s * 0.16, 0.2, -0.05], [-0.4, 0, -s * 0.5]);
  c.head = head;
  c.stride = 6.5;
  c.height = 2.4;
  return c;
}

const MORTY_SHIRTS = [0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0];

// ── the bosses ──

function snowball() {
  const c = rig('snowball');
  const b = c.body;
  const fur = 0xf6f3ea;
  const steel = 0x8d97a3;
  // the mech: four jointed legs, a cradle, shoulder cannons
  const legs = [];
  for (const [x, z] of [[-0.9, 0.7], [0.9, 0.7], [-0.9, -0.7], [0.9, -0.7]]) {
    const j = new THREE.Group();
    j.position.set(x, 1.4, z);
    b.add(j);
    part(j, 'cyl', steel, [0.12, 0.8, 0.12], [x * 0.25, -0.35, 0], [0, 0, x > 0 ? 0.5 : -0.5]);
    part(j, 'cyl', 0x5f6873, [0.1, 0.9, 0.1], [x * 0.5, -0.95, 0]);
    part(j, 'cyl', 0x3f4650, [0.22, 0.08, 0.22], [x * 0.5, -1.38, 0]);
    legs.push(j);
  }
  c.legs = [legs[0], legs[1]];
  c.mechLegs = legs;
  part(b, 'box', steel, [1.7, 0.35, 1.5], [0, 1.45, 0]);
  part(b, 'box', 0x3f4650, [1.4, 0.12, 1.2], [0, 1.66, 0]);
  for (const s of [-1, 1]) {
    part(b, 'cyl', 0x5f6873, [0.16, 0.7, 0.16], [s * 0.85, 2.05, 0.2], [Math.PI / 2, 0, 0]);
    part(b, 'cyl', 0xff4a3a, [0.1, 0.05, 0.1], [s * 0.85, 2.05, 0.56], [Math.PI / 2, 0, 0], { emissive: 0xff3a2a, k: 2 });
  }
  // Snowball, in the cradle
  const dog = new THREE.Group();
  dog.position.set(0, 2.05, -0.05);
  b.add(dog);
  part(dog, 'capsule', fur, [0.38, 0.3, 0.36], [0, 0, -0.1], [Math.PI / 2, 0, 0]);
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.45);
  dog.add(head);
  part(head, 'sphere', fur, [0.38, 0.34, 0.36], [0, 0, 0]);
  part(head, 'sphere', fur, [0.2, 0.15, 0.22], [0, -0.1, 0.32]);
  part(head, 'sphere', 0x1a1a1a, [0.07, 0.05, 0.05], [0, -0.04, 0.52]);
  for (const s of [-1, 1]) part(head, 'sphere', fur, [0.11, 0.25, 0.06], [s * 0.3, 0.08, -0.05], [0, 0, s * 0.6]);
  eye(head, -0.14, 0.08, 0.3, 0.07, { pupil: 0.5 });
  eye(head, 0.14, 0.08, 0.3, 0.07, { pupil: 0.5 });
  part(head, 'box', 0x5a3a32, [0.3, 0.04, 0.04], [0, 0.2, 0.32], [0, 0, 0]); // a frown
  // the helmet's glass
  part(head, 'sphere', 0xbfe8ff, [0.55, 0.55, 0.55], [0, 0, 0.05], [0, 0, 0], { opacity: 0.25 });
  c.head = head;
  c.stride = 5;
  c.height = 3.2;
  c.group.scale.setScalar(1.15);
  return c;
}

function cromulon() {
  const c = rig('cromulon');
  const b = c.body;
  const skin = 0xf0b4a6;
  const head = new THREE.Group();
  b.add(head);
  part(head, 'sphere', skin, [1, 1.15, 0.95], [0, 0, 0]);
  part(head, 'sphere', 0xe89e90, [0.22, 0.3, 0.3], [0, -0.05, 0.92]); // nose
  for (const s of [-1, 1]) {
    eye(head, s * 0.36, 0.3, 0.72, 0.2, { pupil: 0.3, lid: skin });
    part(head, 'sphere', skin, [0.18, 0.3, 0.12], [s * 1.0, 0.05, 0]); // ears
  }
  const mouth = part(head, 'sphere', 0x3a1018, [0.38, 0.12, 0.12], [0, -0.48, 0.82]);
  for (let i = 0; i < 6; i++) part(head, 'box', 0xfaf7ee, [0.08, 0.06, 0.04], [-0.25 + i * 0.1, -0.42, 0.9]);
  part(head, 'box', 0x8a6a5e, [0.7, 0.05, 0.08], [0, 0.62, 0.78], [0.2, 0, 0]);
  c.head = head;
  c.mouth = mouth;
  c.group.scale.setScalar(4.2);
  c.height = 10;
  return c;
}

// ── a butter robot, a Meeseeks ally, Mega Seeds ──

function butterRobot() {
  const c = rig('butter');
  const b = c.body;
  part(b, 'box', 0xc7cdd3, [0.34, 0.2, 0.3], [0, 0.35, 0]);
  part(b, 'cyl', 0x6f7880, [0.05, 0.25, 0.05], [0, 0.15, 0]);
  part(b, 'cyl', 0x3f4650, [0.12, 0.05, 0.12], [0, 0.03, 0]);
  for (const s of [-1, 1]) part(b, 'cyl', 0x9aa3ab, [0.025, 0.3, 0.025], [s * 0.2, 0.4, 0.08], [0.6, 0, s * 0.3]);
  eye(b, -0.07, 0.4, 0.15, 0.04, { pupil: 0.5 });
  eye(b, 0.07, 0.4, 0.15, 0.04, { pupil: 0.5 });
  part(b, 'box', 0xf4dd6a, [0.12, 0.05, 0.08], [0, 0.48, 0.12]); // the butter
  c.height = 0.6;
  return c;
}

// Bake a figure: everything that moves together (the body, the head, each
// limb, the gun) becomes one mesh, coloured per vertex, so a whole figure is
// a handful of draws instead of thirty. Glowing and see-through parts stay
// as they are.
let baked = null;
const bakedMat = () => {
  if (!baked) {
    baked = toon(0xffffff, { vertexColors: true });
    baked.userData.shared = true;
  }
  return baked;
};
function bake(c) {
  c.group.updateMatrixWorld(true);
  const joints = [];
  c.group.traverse((o) => {
    if (o.isGroup) joints.push(o);
  });
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  for (const j of joints) {
    inv.copy(j.matrixWorld).invert();
    const plain = [];
    // the meshes that belong to this joint: its own, and those nested in them
    const walk = (o) => {
      for (const ch of o.children) {
        if (ch.isGroup) continue;
        if (ch.isMesh) {
          const m = ch.material;
          if (!m.transparent && !(m.emissiveIntensity > 0 && m.emissive?.getHex())) plain.push(ch);
          walk(ch);
        }
      }
    };
    walk(j);
    if (plain.length < 2) continue;
    const parts = plain.map((mesh) => {
      const g = mesh.geometry.index ? mesh.geometry.clone() : mesh.geometry.clone();
      rel.multiplyMatrices(inv, mesh.matrixWorld);
      g.applyMatrix4(rel);
      const col = mesh.material.color;
      const n = g.attributes.position.count;
      const cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        cols[i * 3] = col.r;
        cols[i * 3 + 1] = col.g;
        cols[i * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
      return g;
    });
    const merged = mergeGeometries(parts);
    if (!merged) continue;
    for (const mesh of plain) {
      // keep anything glowing that was nested in a merged mesh
      for (const ch of [...mesh.children]) if (!plain.includes(ch)) {
        rel.multiplyMatrices(inv, ch.matrixWorld);
        rel.decompose(ch.position, ch.quaternion, ch.scale);
        j.add(ch);
      }
      mesh.parent.remove(mesh);
    }
    const out = new THREE.Mesh(merged, bakedMat());
    out.castShadow = true;
    out.receiveShadow = true;
    out.userData.own = true;
    j.add(out);
  }
  return c;
}

export function makeCast(kind, variant = 0) {
  return bake(makeRaw(kind, variant));
}

function makeRaw(kind, variant) {
  if (kind === 'rick') return rick();
  if (kind === 'morty') return morty();
  if (kind === 'pickle') return pickle();
  if (kind === 'meeseeks') return meeseeks();
  if (kind === 'ally') return meeseeks(true);
  if (kind === 'gromflomite') return gromflomite();
  if (kind === 'cronenberg') return cronenberg(1, 4);
  if (kind === 'blob') return blob();
  if (kind === 'gazorpian') return gazorpian();
  if (kind === 'cop') return rick({ coat: 0x22325a, shirt: 0x3a4d7a, pants: 0x1f2738, cap: 0x1b2747 });
  if (kind === 'mortyclone') return morty({ shirt: MORTY_SHIRTS[variant % MORTY_SHIRTS.length] });
  if (kind === 'snowball') return snowball();
  if (kind === 'bigcronenberg') return cronenberg(2.9, 7);
  if (kind === 'cromulon') return cromulon();
  // Morty's height: a boss by what he does, not by size
  if (kind === 'evilmorty') return morty({ shirt: 0xc9b23a, pants: 0x2a3f78, patch: true });
  if (kind === 'butter') return butterRobot();
  return meeseeks();
}

// Moving: legs and arms swing with `move` (0..1), the body bobs; `hit`
// (0..1) squashes it; `t` is its own clock.
export function animate(c, t, move = 0, hit = 0) {
  if (c.update) return c.update(t, move, hit); // a Meshy figure (./meshyCast.js)
  const ph = t * c.stride;
  const sw = Math.sin(ph) * 0.75 * move;
  if (c.legs) {
    c.legs[0].rotation.x = sw;
    c.legs[1].rotation.x = -sw;
  }
  if (c.mechLegs) {
    c.mechLegs[2].rotation.x = -sw;
    c.mechLegs[3].rotation.x = sw;
  }
  if (c.arms) {
    if (c.armsUp) {
      // waving, as Meeseeks do
      c.arms[0].rotation.x = Math.sin(t * 7) * 0.5;
      c.arms[1].rotation.x = Math.cos(t * 7) * 0.5;
    } else {
      c.arms[0].rotation.x = -sw * 0.8;
      if (!c.gun) c.arms[1].rotation.x = sw * 0.8;
    }
  }
  if (c.gun) c.arms[1].rotation.x = -1.25; // the gun arm points ahead
  const bob = Math.abs(Math.sin(ph)) * 0.07 * move + Math.sin(t * 2.2) * 0.012;
  c.body.position.y = c.bodyY + bob;
  if (c.pickle) {
    // Pickle Rick hops
    c.body.position.y = Math.abs(Math.sin(t * 9)) * 0.28 * move;
    c.pickle.rotation.z = Math.sin(t * 9) * 0.25 * move;
  }
  if (c.blob) c.blob.scale.set(0.7 + Math.sin(t * 5) * 0.03, 0.55 + Math.cos(t * 5) * 0.03, 0.62);
  const sq = hit;
  c.body.scale.set(1 + sq * 0.2, 1 - sq * 0.22, 1 + sq * 0.2);
  if (c.head) c.head.rotation.z = Math.sin(t * 1.3) * 0.04;
}

// Software WebGL has no ink pass: give the cast an inverted-hull outline.
export function hull(c, width = 0.03, ink = 0x14101a) {
  const m = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(3)} / max(0.05, length(modelMatrix[0].xyz));`);
  };
  m.userData.shared = true;
  const add = [];
  c.group.traverse((o) => {
    if (o.isMesh && !o.material.transparent) add.push(o);
  });
  for (const o of add) {
    const h = new THREE.Mesh(o.geometry, m);
    h.castShadow = false;
    o.add(h);
  }
}
