// The Smith house's furniture and paint, for ./house.js and ./upstairs.js:
// the kitchen's counters, stove and fridge, the TV's stand, the couch, the
// yellow table and its chairs, the butter robot, desks, lamps, shelves, beds
// and dressers, each drawn on its rules.js collider (front to +z at turn 0);
// wood, lino and carpet for the floors; how the family look in shapes.

import * as THREE from 'three';
import { PLAN } from '../rules';
import { mergeParts, rng, speckle } from '../kit';
import { BALL, CYL8, lathe, TAU } from './shell';

export const CREAM = 0xf4e5c2;
export const TRIM = 0xf7f3ea;
export const BROWN = 0x7a4a2a;
export const WOOD_FLOOR = 0xc4a77a;
export const INNER = 0.24; // the walls between rooms (rules' half-thickness, twice)
export const HEIGHTS = { rick: 2.0, jerry: 1.95, beth: 1.88, summer: 1.8 };
// the show's people in shapes, if their models don't load
export const LOOKS = {
  rick: { skin: 0xd9c7b0, shirt: 0x9fc6d6, coat: 0xf2f2ee, pants: 0x6b4a32, hair: 0xa9c6d6, style: 'spiky' },
  jerry: { skin: 0xf2c9a0, shirt: 0x7d8a3c, pants: 0x9cc0dc, hair: 0x6b4126, belt: 0x5a3a22, sleeves: 'short' },
  beth: { skin: 0xf2c9a0, shirt: 0xc8362e, pants: 0x3a3f5a, hair: 0xf0d27a, style: 'bob' },
  summer: { skin: 0xf2c9a0, shirt: 0xf0559a, pants: 0x4a5a9a, hair: 0xe8762e, style: 'pony', sleeves: 'short' },
};

// ── paint ──

export const woodFloor = (base = '#d4b98e') => (g, w, h) => {
  const r = rng(11);
  const c = new THREE.Color(base);
  const rows = 8;
  const ph = h / rows;
  for (let y = 0; y < rows; y++) {
    let x = -r() * w * 0.5;
    while (x < w) {
      const len = w * (0.35 + r() * 0.4);
      const k = 0.88 + r() * 0.2;
      g.fillStyle = `#${c.clone().multiplyScalar(k).getHexString()}`;
      g.fillRect(x, y * ph, len, ph);
      g.fillStyle = 'rgba(80,50,25,0.12)';
      for (let i = 0; i < 3; i++) g.fillRect(x + 4, y * ph + ph * (0.25 + i * 0.25) + (r() - 0.5) * 3, len - 8, 1);
      g.fillStyle = 'rgba(60,35,15,0.6)';
      g.fillRect(x, y * ph, 2, ph);
      x += len;
    }
    g.fillStyle = 'rgba(60,35,15,0.55)';
    g.fillRect(0, y * ph, w, 2);
  }
};
export const lino = (g, w, h) => {
  const n = 4;
  const s = w / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? '#f3efe2' : '#d9d6c4';
      g.fillRect(x * s, y * s, s, s);
    }
  g.strokeStyle = 'rgba(120,110,90,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s, h);
    g.moveTo(0, i * s);
    g.lineTo(w, i * s);
    g.stroke();
  }
};
export const carpet = (g, w, h) => speckle(g, w, h, { base: '#e9e9e9', specks: ['#d6d6d6', '#f7f7f7', '#cfcfcf'], n: 1400, size: 1.5, seed: 21 });

// ── furniture ──

const at = (it, R) => R.frame(it.x, it.z, it.turn);

export function counter(R, it) {
  const f = at(it, R);
  const { w, d } = it;
  const cab = 0xc99a62;
  const door = 0xd6aa72;
  f.box(0x5a4030, 0, 0, -0.1, w, 0.1, d - 0.2);
  f.box(cab, 0, 0.1, -0.05, w, 0.8, d - 0.1);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w / n) * (i + 0.5);
    f.box(door, u, 0.16, d / 2 - 0.09, w / n - 0.05, 0.66, 0.02);
    f.box(0x8a8f96, u + (i % 2 ? -1 : 1) * (w / n / 2 - 0.12), 0.68, d / 2 - 0.07, 0.03, 0.14, 0.03);
  }
  f.box(0xe9e2cf, 0, 0.9, 0, w, 0.05, d);
  // the sink, the tap
  f.box(0x9aa3ab, 0.7, 0.9, 0.02, 0.8, 0.052, 0.55).box(0x6f7880, 0.7, 0.9, 0.02, 0.7, 0.054, 0.45);
  f.cyl(0xb9c0c7, 0.7, 0.95, -0.38, 0.025, 0.28).cbox(0xb9c0c7, 0.7, 1.22, -0.28, 0.04, 0.04, 0.22);
  // the backsplash and the cupboards over it
  f.decal('tiles', 0, 1.2, -d / 2 + 0.012, w, 0.5);
  f.box(cab, 0, 1.5, -d / 2 + 0.17, w, 0.68, 0.34);
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w / n) * (i + 0.5);
    f.box(door, u, 1.53, -d / 2 + 0.345, w / n - 0.05, 0.62, 0.02);
  }
  // on the counter: a toaster, a coffee maker, a fruit bowl, a knife block
  f.box(0xc8cdd2, -1.4, 0.95, -0.2, 0.28, 0.2, 0.18).box(0x2a2a2e, -1.4, 1.15, -0.2, 0.2, 0.01, 0.05);
  f.box(0x2b2b30, -0.6, 0.95, -0.35, 0.22, 0.34, 0.24).cyl(0x7a4a2a, -0.6, 0.97, -0.24, 0.07, 0.14);
  f.part(new THREE.SphereGeometry(0.16, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0xe9e2cf, 1.5, 1.1, 0.1);
  for (const [du, dv, c] of [
    [-0.05, 0, 0xe0402a],
    [0.06, 0.04, 0xf2c23c],
    [0.01, -0.07, 0x7ac74f],
  ])
    f.ball(c, 1.5 + du, 1.02, 0.1 + dv, 0.06);
  f.box(0x6b4426, 1.05, 0.95, -0.4, 0.14, 0.24, 0.12, 0, -0.2);
}

export function stove(R, it) {
  const f = at(it, R);
  const { d } = it;
  const cab = 0xc99a62;
  // cupboards either side of the range
  for (const s of [-1, 1]) {
    f.box(cab, s * 0.49, 0.1, -0.05, 0.22, 0.8, d - 0.1).box(0x5a4030, s * 0.49, 0, -0.1, 0.22, 0.1, d - 0.2);
    f.box(0xe9e2cf, s * 0.49, 0.9, 0, 0.22, 0.05, d);
  }
  f.box(0xf2f0e8, 0, 0, -0.05, 0.76, 0.92, d - 0.1);
  f.box(0x1d1d22, 0, 0.92, -0.05, 0.76, 0.03, d - 0.1);
  for (const [bu, bv] of [
    [-0.2, 0.15],
    [0.2, 0.15],
    [-0.2, -0.2],
    [0.2, -0.2],
  ])
    f.part(new THREE.TorusGeometry(0.08, 0.012, 6, 16), 0x4a4a52, bu, 0.955, bv, 0, 1, 1, 1, Math.PI / 2);
  // the oven door, its window and handle, the knobs, the backguard
  f.box(0xe6e3da, 0, 0.12, d / 2 - 0.1, 0.7, 0.6, 0.03).box(0x2a2a30, 0, 0.3, d / 2 - 0.08, 0.46, 0.26, 0.012);
  f.cbox(0xb9c0c7, 0, 0.7, d / 2 - 0.05, 0.5, 0.025, 0.025);
  f.box(0xf2f0e8, 0, 0.95, -d / 2 + 0.17, 0.76, 0.16, 0.06);
  for (let i = 0; i < 4; i++) f.cyl(0x2a2a30, -0.27 + i * 0.18, 1.0, -d / 2 + 0.205, 0.022, 0.03, Math.PI / 2);
  // a pot on the front burner, and the hood over it all
  f.cyl(0x9aa3ab, 0.2, 0.96, 0.15, 0.12, 0.16).cyl(0x9aa3ab, 0.2, 1.12, 0.15, 0.125, 0.015).cbox(0x2a2a30, 0.38, 1.09, 0.15, 0.14, 0.02, 0.025);
  f.box(0xd8d4c8, 0, 1.72, -d / 2 + 0.25, 0.86, 0.22, 0.5).box(0xcac5b8, 0, 1.94, -d / 2 + 0.12, 0.3, 0.66, 0.24);
}

export function fridge(R, it) {
  const f = at(it, R);
  const { d, h } = it;
  const W = 0.96;
  const c = 0xf1ecd9;
  f.box(c, 0, 0, -0.04, W, h - 0.02, d - 0.18);
  f.box(c, 0, 1.25, d / 2 - 0.13, W - 0.02, h - 1.28, 0.05).box(c, 0, 0.04, d / 2 - 0.13, W - 0.02, 1.18, 0.05);
  f.box(0x2b2b30, 0, 1.225, d / 2 - 0.13, W - 0.02, 0.02, 0.052);
  for (const [y0, hh] of [
    [1.32, 0.42],
    [0.55, 0.55],
  ])
    f.box(0xb9c0c7, -W / 2 + 0.08, y0, d / 2 - 0.06, 0.03, hh, 0.04);
  // drawings and magnets on the door
  f.decal('fridgeart', 0.08, 0.92, d / 2 - 0.1 + 0.003, 0.62, 0.5);
  // a cereal box on top
  f.box(0xe8a83a, 0.2, h - 0.02, -0.1, 0.24, 0.32, 0.08, 0.2);
}

export function tvStand(R, it) {
  const f = at(it, R);
  const { w, d } = it;
  const wood = 0x6b4426;
  f.box(wood, 0, 0.05, -0.08, w, 0.5, d - 0.16);
  for (const s of [-1, 1]) f.cyl(0x3a2414, s * (w / 2 - 0.1), 0, -0.08 + (d / 2 - 0.15), 0.025, 0.05).cyl(0x3a2414, s * (w / 2 - 0.1), 0, -0.08 - (d / 2 - 0.15), 0.025, 0.05);
  for (let i = 0; i < 3; i++) {
    const u = -w / 2 + (w / 3) * (i + 0.5);
    f.box(0x7c5232, u, 0.1, d / 2 - 0.16 + 0.005, w / 3 - 0.06, 0.4, 0.02).ball(0xd8b25a, u, 0.38, d / 2 - 0.14, 0.02);
  }
  // the flat TV on its foot, the screen goes on its front
  f.box(0x1d1d22, 0, 0.55, -0.1, 0.36, 0.03, 0.22).box(0x1d1d22, 0, 0.58, -0.12, 0.08, 0.1, 0.05);
  f.box(0x1d1d22, 0, 0.66, -0.12, 1.6, 0.92, 0.07);
  // a console and a stack of discs, a plant at one end, a lamp at the other
  f.box(0x2b2b30, 0.62, 0.55, 0.08, 0.36, 0.07, 0.24).box(0x5ab0e8, 0.75, 0.6, 0.2, 0.06, 0.012, 0.012);
  for (let i = 0; i < 5; i++) f.box([0x2f6fb0, 0xd8452f, 0x2b2b30, 0xf3c844, 0x7ac74f][i], -0.6, 0.55 + i * 0.016, 0.1, 0.14, 0.015, 0.19, i * 0.1);
  f.part(lathe([[0, 0], [0.11, 0], [0.13, 0.2], [0.12, 0.22]], 12), 0xb8603a, -w / 2 + 0.22, 0.55, 0, 0);
  for (let i = 0; i < 6; i++) f.part(new THREE.ConeGeometry(0.05, 0.38, 5), 0x4f9c3c, -w / 2 + 0.22 + Math.cos(i) * 0.06, 0.92, Math.sin(i * 2.1) * 0.06, 0, 1, 1, 1, Math.cos(i * 1.7) * 0.4, Math.sin(i * 1.3) * 0.4);
  // the table lamp: a round orange base, a white shade
  f.part(lathe([[0.03, 0], [0.1, 0.04], [0.11, 0.14], [0.06, 0.24], [0.02, 0.28]], 14), 0xe0902e, w / 2 - 0.22, 0.55, 0, 0).cyl(0x9a8a6a, w / 2 - 0.22, 0.83, 0, 0.01, 0.06);
  f.part(lathe([[0.17, 0], [0.11, 0.2]], 14), 0xfaf6ea, w / 2 - 0.22, 0.86, 0, 0);
  f.glow(CYL8, 0xfff2c8, 1.6, w / 2 - 0.22, 0.865, 0, 0, 0.3, 0.01, 0.3);
  return f;
}

export function couch(R, it, { body = 0x9b6f95, cushion = 0xb48aae } = {}) {
  const f = at(it, R);
  const { w, d } = it;
  f.box(body, 0, 0.1, 0.02, w - 0.4, 0.3, d - 0.08);
  for (const s of [-1, 1]) f.box(body, s * (w / 2 - 0.16), 0.1, 0, 0.32, 0.5, d).box(cushion, s * (w / 2 - 0.16), 0.6, 0, 0.34, 0.06, d + 0.02);
  f.box(body, 0, 0.1, -d / 2 + 0.15, w - 0.04, 0.78, 0.3);
  for (let i = 0; i < 3; i++) {
    const u = -(w - 0.64) / 2 + ((w - 0.64) / 3) * (i + 0.5);
    f.box(cushion, u, 0.4, 0.08, (w - 0.64) / 3 - 0.03, 0.15, d - 0.36);
    f.box(cushion, u, 0.52, -d / 2 + 0.34, (w - 0.64) / 3 - 0.05, 0.42, 0.16, 0, -0.18);
  }
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.cyl(0x3a2414, s * (w / 2 - 0.1), 0, t * (d / 2 - 0.1), 0.03, 0.1, 0, 0, CYL8);
  // a cushion thrown in the corner
  f.box(0xe8c45a, w / 2 - 0.5, 0.55, -0.12, 0.36, 0.34, 0.12, 0.3, -0.25);
}

export function table(R, it) {
  const f = at(it, R);
  const { w, d } = it;
  const yellow = 0xf1c63a;
  f.box(yellow, 0, 0.7, 0, w, 0.05, d).box(0xd9ab22, 0, 0.6, 0, w - 0.16, 0.1, d - 0.16);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(0xd9ab22, s * (w / 2 - 0.1), 0, t * (d / 2 - 0.1), 0.07, 0.6, 0.07);
  // chairs tucked in along each side
  for (const t of [-1, 1])
    for (const s of [-0.62, 0.62]) {
      const c = f.sub(s, t * 0.6, t > 0 ? 0 : Math.PI);
      c.box(0x8a5a34, 0, 0.44, 0, 0.44, 0.04, 0.42).box(0xe8c45a, 0, 0.48, 0.01, 0.4, 0.03, 0.38);
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.box(0x6b4426, a * 0.18, 0, b * 0.17, 0.035, 0.44, 0.035);
      for (const a of [-1, 1]) c.box(0x6b4426, a * 0.18, 0.44, 0.19, 0.035, 0.5, 0.035);
      c.box(0x8a5a34, 0, 0.78, 0.19, 0.4, 0.12, 0.03);
    }
  // place mats, the butter dish, salt and pepper, a bowl of fruit
  for (const s of [-0.62, 0.62]) for (const t of [-1, 1]) f.box(0xf4ecd8, s, 0.751, t * 0.42, 0.42, 0.004, 0.3);
  f.box(0xf4f0e6, 0.18, 0.751, 0.16, 0.2, 0.025, 0.12).box(0xf7e27a, 0.18, 0.776, 0.16, 0.12, 0.035, 0.06).box(0xf4f0e6, 0.18, 0.79, 0.16, 0.18, 0.05, 0.1);
  f.cyl(0xf4f0e6, -0.15, 0.75, -0.02, 0.022, 0.08).cyl(0x3a3a3e, -0.09, 0.75, -0.02, 0.022, 0.08);
  f.part(new THREE.SphereGeometry(0.15, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0x5ab0c8, -0.7, 0.9, 0);
  for (const [du, dv, c] of [
    [0, 0, 0xe0402a],
    [0.08, 0.03, 0xf2c23c],
    [-0.06, 0.05, 0xf08a2a],
    [0.02, -0.07, 0x7ac74f],
  ])
    f.ball(c, -0.7 + du, 0.81, dv, 0.055);
}

// The butter robot: a little silver-grey robot on two arms, a red light;
// it looks round now and then, its light blinking
export function butterRobot(R, x, y, z, face) {
  const parts = [];
  const f = R.frame(0, 0, 0, { list: parts });
  const silver = 0xb9c0c7;
  const dark = 0x6f7880;
  f.part(lathe([[0, 0], [0.07, 0], [0.085, 0.03], [0.085, 0.1], [0.06, 0.15], [0, 0.16]], 16), silver, 0, 0.05, 0, 0);
  f.cyl(dark, 0, 0.1, 0, 0.088, 0.012);
  for (const s of [-1, 1]) {
    // each arm: shoulder, upper arm down to the table, a little claw
    f.ball(dark, s * 0.08, 0.13, 0, 0.022);
    f.cyl(silver, s * 0.11, 0.09, 0.0, 0.013, 0.09, 0, s * 0.5);
    f.cyl(silver, s * 0.135, 0.03, 0.02, 0.012, 0.07, 0.2, 0);
    f.box(dark, s * 0.135, 0, 0.035, 0.03, 0.012, 0.05);
  }
  f.cyl(dark, 0, 0.21, -0.02, 0.008, 0.07);
  const robot = new THREE.Group();
  const body = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  body.castShadow = true;
  robot.add(body);
  const eye = new THREE.Mesh(BALL, R.kit.mats.glow(0xff2a20, 2.6));
  eye.scale.setScalar(0.04);
  eye.position.set(0, 0.17, 0.065);
  robot.add(eye);
  R.noInk.push(eye);
  robot.position.set(x, y, z);
  robot.scale.setScalar(1.35);
  robot.rotation.y = face + Math.PI / 2;
  R.group.add(robot);
  const turn0 = robot.rotation.y;
  R.tick((t) => {
    robot.rotation.y = turn0 + Math.sin(t * 0.6) * 0.5 + Math.sin(t * 1.7) * 0.08;
    eye.visible = Math.sin(t * 3) > -0.6;
    body.position.y = Math.abs(Math.sin(t * 1.2)) * 0.008;
  });
  return robot;
}

export function desk(R, it, { top = 0x9a6a3e, legs = 0x6b4426, pedestal = true } = {}) {
  const f = at(it, R);
  const { w, d, h } = it;
  f.box(top, 0, h - 0.04, 0, w, 0.04, d);
  if (pedestal) {
    f.box(legs, w / 2 - 0.25, 0, 0, 0.46, h - 0.04, d - 0.06);
    for (let i = 0; i < 3; i++) f.box(top, w / 2 - 0.25, 0.06 + i * 0.22, d / 2 - 0.02, 0.4, 0.19, 0.02).box(0xd8b25a, w / 2 - 0.25, 0.14 + i * 0.22, d / 2 - 0.005, 0.08, 0.02, 0.02);
    f.box(legs, -w / 2 + 0.03, 0, 0, 0.05, h - 0.04, d - 0.06);
  } else for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(legs, s * (w / 2 - 0.05), 0, t * (d / 2 - 0.05), 0.05, h - 0.04, 0.05);
  f.box(legs, 0, h - 0.4, -d / 2 + 0.03, w - 0.1, 0.35, 0.02);
  return f;
}
// a desk lamp with its shade over a glowing bulb
export function deskLamp(f, u, y, v, color = 0x3a6fb0) {
  f.cyl(color, u, y, v, 0.07, 0.025).cyl(0x9aa3ab, u, y + 0.02, v, 0.01, 0.28, -0.25, 0);
  f.part(lathe([[0.03, 0], [0.09, -0.1]], 12), color, u, y + 0.33, v + 0.06, 0, 1, 1, 1, 0.4);
  f.glow(BALL, 0xfff2c0, 1.8, u, y + 0.25, v + 0.09, 0, 0.05);
}
export function computer(f, u, y, v) {
  f.box(0xe8e3d6, u, y, v - 0.08, 0.42, 0.33, 0.36).box(0xe8e3d6, u, y + 0.33, v - 0.08, 0.38, 0.04, 0.3);
  f.decal('monitor', u, y + 0.17, v + 0.102, 0.32, 0.24, { bright: true });
  f.box(0xe8e3d6, u, y, v + 0.2, 0.44, 0.02, 0.14);
}
export function shelf(R, it, { wood = 0x7c5232, seed = 3 } = {}) {
  const f = at(it, R);
  const { w, d, h } = it;
  const r = rng(seed);
  f.box(wood, 0, 0, -d / 2 + 0.01, w, h, 0.02);
  for (const s of [-1, 1]) f.box(wood, s * (w / 2 - 0.02), 0, 0, 0.04, h, d);
  const levels = 5;
  for (let i = 0; i <= levels; i++) f.box(wood, 0, i === levels ? h - 0.03 : 0.05 + i * ((h - 0.1) / levels), 0, w - 0.06, 0.03, d - 0.02);
  const colours = [0xb8342a, 0x2f6fb0, 0x3f8f3a, 0xe8c45a, 0x6b3a7a, 0xe8e3d6, 0x2b2b30, 0xd87a2a];
  for (let i = 0; i < levels; i++) {
    const y0 = 0.08 + i * ((h - 0.1) / levels);
    let u = -w / 2 + 0.08;
    while (u < w / 2 - 0.12) {
      if (r() < 0.12) {
        // an ornament or a gap
        if (r() < 0.5) f.ball([0x5ab0c8, 0xd8b25a, 0xe08a9a][Math.floor(r() * 3)], u + 0.08, y0 + 0.07, 0, 0.07);
        u += 0.2;
        continue;
      }
      const bw = 0.03 + r() * 0.04;
      const bh = 0.2 + r() * 0.12;
      f.box(colours[Math.floor(r() * colours.length)], u + bw / 2, y0, 0.02, bw, bh, d - 0.12, 0, 0, r() < 0.08 ? 0.2 : 0);
      u += bw + 0.004;
    }
  }
}
export function bed(R, it, { frame = 0x7c5232, sheet = 0xf4f0e6, blanket = 0x5a7ab0, pillow = 0xf7f4ec, board = null } = {}) {
  const f = at(it, R);
  const { w, d } = it;
  // the head is at the back (against the wall), the foot is its front
  f.box(frame, 0, 0.1, 0, w, 0.2, d);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(frame, s * (w / 2 - 0.05), 0, t * (d / 2 - 0.05), 0.08, 0.12, 0.08);
  f.box(sheet, 0, 0.3, 0, w - 0.06, 0.2, d - 0.06);
  f.box(blanket, 0, 0.32, 0.18, w, 0.21, d - 0.42).box(blanket, 0, 0.12, d / 2 - 0.02, w, 0.4, 0.04);
  for (const s of [-1, 1]) f.box(blanket, s * (w / 2 + 0.005), 0.18, 0.18, 0.02, 0.32, d - 0.42);
  const np = w > 1.4 ? 2 : 1;
  for (let i = 0; i < np; i++) f.box(pillow, np === 1 ? 0 : (i - 0.5) * (w / 2), 0.5, -d / 2 + 0.25, w / np - 0.12, 0.12, 0.34, 0, 0.12);
  f.box(board ?? frame, 0, 0.1, -d / 2 + 0.03, w + 0.04, 0.9, 0.06);
  return f;
}
export function dresser(R, it, { wood = 0x9a6a3e } = {}) {
  const f = at(it, R);
  const { w, d, h } = it;
  f.box(wood, 0, 0.06, 0, w, h - 0.06, d - 0.04).box(0x5a3a22, 0, 0, 0, w - 0.06, 0.06, d - 0.1);
  f.box(new THREE.Color(wood).multiplyScalar(1.12), 0, h - 0.03, 0, w + 0.04, 0.03, d);
  for (let r = 0; r < 3; r++)
    for (const s of [-1, 1]) {
      const y = 0.1 + r * ((h - 0.16) / 3);
      f.box(new THREE.Color(wood).multiplyScalar(1.06), (s * w) / 4, y, d / 2 - 0.02, w / 2 - 0.05, (h - 0.16) / 3 - 0.04, 0.02).ball(0xd8b25a, (s * w) / 4, y + (h - 0.16) / 6, d / 2, 0.02);
    }
  return f;
}

// the rooms of a floor as [x0, x1, z0, z1], but for some
export const roomsOf = (area, but = []) => PLAN.filter((p) => p.area === area && !but.includes(p.id)).map((p) => [p.x0, p.x1, p.z0, p.z1]);
// (near white, so the show's colours come out as painted)
export const HOUSE_LIGHT = { sun: [0xfff6ea, 0.65], hemi: [0xffffff, 0xd6d0c6, 2.7], fog: null, background: 0x1e1712 };
