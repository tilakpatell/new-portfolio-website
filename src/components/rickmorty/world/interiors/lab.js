// Rick's garage lab, for ../interiors.js, as the show's stills have it: dark
// wood-plank walls under a dark beamed ceiling with a long fluorescent light,
// a pale grey-green concrete floor; the L-shaped workbench (pale grey top,
// dark cupboards, one door open) under a pegboard of tools, reels and coils,
// with the round-bottomed flask on its stand and its glass tubing, conical
// flasks and beakers of glowing orange, green and pink, the green radio, the
// magnifier lamp, a teal gadget, a coil-wrapped gizmo, a plumbus and the
// Meeseeks box on it, the red office chair, and Rick at it; the corkboard of
// notes and red string, the round clock over the mountain calendar; the grey
// metal shelving ("Time travel stuff", jars, a spiky ball, a green alien
// head) under the orange floral wall lamp; the pinkish-tan machine on its
// stand (the plumbus factory); the cream washer and dryer; the Portal panic
// cabinet; and the portal, swirling green on the east wall. In the floor by
// the plumbus factory, the hatch down to Rick's secret lab (./basement.js),
// which lifts as Morty comes near; on the east wall, the door to the kitchen,
// pale in a white frame, a little window in it and a lamp over it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AREAS, FURNITURE, HATCH, LINKS, PEOPLE } from '../rules';
import { at, mergeParts, rng, speckle } from '../kit';
import { BALL, BALL8, BOX, CYL, CYL8, DOOR_H, PLANE, TAU, casing, fitText, lathe, makeRoom, tiledPaint, tube, wallLine } from './shell';
import { needCast, person } from './people';
import { LOOKS } from './furniture';
import { PINS, paintCells, planks } from './labpaint';

const H = 2.9; // the lab's walls, to its ceiling
const TOP = 0xc9ccc6; // the bench top
const CAB = 0x35312d; // its cupboards
const GREY = 0x8d949a; // the shelving

// ── the bench and what's on it ──

function bench(R, it, glass) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.box(TOP, 0, h - 0.06, 0, w, 0.06, d);
  f.box(0x1e1b18, 0, 0, -0.1, w - 0.04, 0.08, d - 0.2);
  // the cupboards: two doors to each metre, one of them standing open on a
  // cupboard with things in it
  const front = d / 2 - 0.1;
  const OPEN = 13;
  const uo = -w / 2 + 0.25 + OPEN * 0.5;
  const body = (u0, u1, v0, v1) => f.box(CAB, (u0 + u1) / 2, 0.08, (v0 + v1) / 2, u1 - u0, h - 0.14, v1 - v0);
  body(-w / 2 + 0.02, uo - 0.25, -d / 2, front);
  body(uo + 0.25, w / 2 - 0.02, -d / 2, front);
  body(uo - 0.25, uo + 0.25, -d / 2, front - 0.5);
  f.box(0x161310, uo, 0.08, front - 0.25, 0.5, 0.06, 0.5).box(0x161310, uo, 0.48, front - 0.25, 0.5, 0.025, 0.5);
  for (let i = 0; i < 16; i++) {
    const u = -w / 2 + 0.25 + i * 0.5;
    if (i === OPEN) {
      // inside: a can, a box, a coil of cable
      f.cyl(0x9aa3ab, u - 0.1, 0.14, front - 0.2, 0.06, 0.16).box(0xc9a46a, u + 0.1, 0.14, front - 0.28, 0.16, 0.14, 0.2);
      f.part(new THREE.TorusGeometry(0.07, 0.02, 6, 14), 0xd87a2a, u, 0.505, front - 0.25, 0, 1, 1, 1, Math.PI / 2);
      f.box(0x3a6fb0, u + 0.05, 0.505, front - 0.3, 0.12, 0.22, 0.08);
      const dr = f.sub(u - 0.23, front + 0.01, -1.25);
      dr.box(0x433e38, 0.23, 0.14, 0.012, 0.46, 0.72, 0.022).box(0x9aa3ab, 0.4, 0.42, 0.04, 0.025, 0.16, 0.025);
      continue;
    }
    f.box(0x433e38, u, 0.14, front + 0.012, 0.46, 0.72, 0.02);
    f.box(0x9aa3ab, u + (i % 2 ? -0.17 : 0.17), 0.66, front + 0.035, 0.025, 0.12, 0.025);
  }
  const y = h; // the bench top
  const back = -d / 2;
  // the pegboard over the bench, framed, with its tools
  f.decal('pegboard', -1.8, 1.82, back + 0.022, 4.4, 1.25);
  for (const [u0, y0, ww, hh] of [
    [-1.8, 2.45, 4.5, 0.05],
    [-1.8, 1.15, 4.5, 0.05],
    [-4.02, 1.8, 0.05, 1.3],
    [0.42, 1.8, 0.05, 1.3],
  ])
    f.cbox(0x5a3a20, u0, y0, back + 0.03, ww, hh, 0.04);
  pegTools(f, back + 0.04);
  // the corkboard over the east end, its pins
  const cb = { u: 1.95, y: 1.82, w: 2.5, h: 1.2 };
  f.decal('corkboard', cb.u, cb.y, back + 0.024, cb.w, cb.h);
  f.cbox(0x6b4426, cb.u, cb.y + cb.h / 2 + 0.03, back + 0.03, cb.w + 0.12, 0.06, 0.04).cbox(0x6b4426, cb.u, cb.y - cb.h / 2 - 0.03, back + 0.03, cb.w + 0.12, 0.06, 0.04);
  for (const s of [-1, 1]) f.cbox(0x6b4426, cb.u + s * (cb.w / 2 + 0.03), cb.y, back + 0.03, 0.06, cb.h + 0.12, 0.04);
  for (const [px, py] of PINS) f.ball(0xd0201c, cb.u - cb.w / 2 + px * cb.w, cb.y + cb.h / 2 - py * cb.h, back + 0.045, 0.018);

  // the flask on its ring stand over a burner, its tubing over to a conical flask
  const fu = -3.35;
  const fv = -0.2;
  f.box(0x2b2b30, fu, y, fv - 0.05, 0.24, 0.02, 0.32).cyl(0x9aa3ab, fu - 0.08, y, fv - 0.15, 0.012, 0.8);
  f.part(new THREE.TorusGeometry(0.1, 0.008, 6, 20), 0x9aa3ab, fu, y + 0.36, fv, 0, 1, 1, 1, Math.PI / 2).cbox(0x9aa3ab, fu - 0.06, y + 0.36, fv - 0.08, 0.04, 0.012, 0.14, 0.6);
  f.cyl(0x2b2b30, fu, y + 0.02, fv, 0.03, 0.12).part(new THREE.ConeGeometry(0.025, 0.08, 8), 0x000000, fu, y + 0.19, fv);
  f.glow(new THREE.ConeGeometry(0.022, 0.07, 8), 0x58a8ff, 2.2, fu, y + 0.19, fv);
  glass.add(BALL, glass.mat, f.mat(fu, y + 0.47, fv, 0, 0.24));
  glass.add(CYL, glass.mat, f.mat(fu, y + 0.65, fv, 0, 0.05, 0.22, 0.05));
  f.glow(new THREE.SphereGeometry(0.105, 16, 8, 0, TAU, Math.PI * 0.42, Math.PI * 0.58), 0x6dff4a, 1.6, fu, y + 0.47, fv);
  glass.add(tube([[fu, y + 0.76, fv], [fu + 0.12, y + 0.86, fv + 0.02], [fu + 0.38, y + 0.62, fv + 0.06], [fu + 0.55, y + 0.3, fv + 0.08]], 0.009), glass.mat, f.mat(0, 0, 0));
  // conical flasks, beakers and a measuring cylinder, liquids glowing
  const conical = lathe([[0, 0], [0.09, 0], [0.095, 0.01], [0.03, 0.16], [0.025, 0.24], [0.028, 0.25]], 16);
  const coneLiquid = lathe([[0, 0], [0.085, 0], [0.088, 0.01], [0.05, 0.1], [0, 0.1]], 16);
  const beaker = lathe([[0, 0], [0.06, 0], [0.062, 0.16], [0.07, 0.165]], 16);
  for (const [u, v, k, colour, kind] of [
    [-2.8, 0.08, 1, 0xff8a1e, 'cone'],
    [-2.52, -0.18, 1, 0xff5ab0, 'beaker'],
    [-2.32, 0.12, 0.75, 0x6dff4a, 'cone'],
    [-2.12, -0.22, 1, 0xff8a1e, 'tall'],
    [-1.92, 0.05, 0.8, 0xff5ab0, 'cone'],
  ]) {
    if (kind === 'cone') {
      glass.add(conical, glass.mat, f.mat(u, y, v, 0, k));
      f.glow(coneLiquid, colour, 1.5, u, y + 0.005, v, 0, k);
    } else if (kind === 'beaker') {
      glass.add(beaker, glass.mat, f.mat(u, y, v, 0, 1));
      f.glow(CYL, colour, 1.5, u, y + 0.055, v, 0, 0.11, 0.1, 0.11);
    } else {
      glass.add(CYL, glass.mat, f.mat(u, y + 0.16, v, 0, 0.06, 0.32, 0.06));
      f.glow(CYL, colour, 1.5, u, y + 0.1, v, 0, 0.05, 0.19, 0.05);
      f.cyl(0x2b2b30, u, y, v, 0.045, 0.012);
    }
  }
  // the green radio-like box: speaker, dial, knobs, aerial and handle
  const ru = -1.2;
  const rv = -0.2;
  f.box(0x5b8a44, ru, y, rv, 0.46, 0.27, 0.24).box(0x4a7236, ru, y + 0.27, rv, 0.44, 0.02, 0.22);
  f.cyl(0x22261e, ru - 0.1, y + 0.135, rv + 0.12, 0.085, 0.012, Math.PI / 2);
  f.glow(BOX, 0xd8ff8a, 1.4, ru + 0.12, y + 0.18, rv + 0.121, 0, 0.16, 0.05, 0.004);
  for (const du of [0.06, 0.18]) f.cyl(0xe8e3d6, ru + du, y + 0.07, rv + 0.12, 0.022, 0.03, Math.PI / 2);
  f.cyl(0x9aa3ab, ru + 0.18, y + 0.29, rv - 0.06, 0.006, 0.5, 0, -0.45);
  f.cbox(0x2b2b30, ru, y + 0.33, rv, 0.24, 0.025, 0.03);
  // the magnifier lamp: a clamp at the back, two arms, a ring and its lens
  const lu = -0.6;
  f.box(0x9aa3ab, lu, y, back + 0.1, 0.08, 0.06, 0.08).cyl(0x9aa3ab, lu, y + 0.265, back + 0.152, 0.012, 0.42, 0.25, 0);
  f.cyl(0x9aa3ab, lu, y + 0.46, back + 0.35, 0.012, 0.3, 1.64, 0);
  f.part(new THREE.TorusGeometry(0.1, 0.022, 8, 24), 0xe8e3d6, lu, y + 0.45, back + 0.55, 0, 1, 1, 1, 1.25);
  f.glow(new THREE.TorusGeometry(0.085, 0.008, 6, 24), 0xf4fff0, 1.6, lu, y + 0.44, back + 0.55, 0, 1, 1, 1, 1.25);
  glass.add(CYL, glass.mat, f.mat(lu, y + 0.45, back + 0.55, 0, 0.17, 0.01, 0.17, -0.32));
  // a teal gadget with buttons and a little screen
  const tu = 0.15;
  f.box(0x2fb5a8, tu, y, -0.12, 0.32, 0.14, 0.22).box(0x239086, tu, y + 0.14, -0.16, 0.3, 0.06, 0.12, 0, -0.5);
  f.glow(BOX, 0x8affe8, 1.5, tu - 0.05, y + 0.175, -0.13, 0, 0.12, 0.004, 0.05, -0.5);
  for (let i = 0; i < 3; i++) f.cyl([0xe0402a, 0xf2d23c, 0xe8e3d6][i], tu - 0.08 + i * 0.08, y + 0.14, 0.0, 0.016, 0.02, 0, 0, CYL8);
  // the coil-wrapped gizmo: a post with copper wound round it, a glowing tip
  const gu = 0.7;
  f.cyl(0x3a3d42, gu, y, -0.1, 0.09, 0.04).cyl(0x9aa3ab, gu, y + 0.04, -0.1, 0.035, 0.36);
  const helix = [];
  for (let i = 0; i <= 60; i++) helix.push([gu + Math.cos(i * 0.6) * 0.05, y + 0.08 + i * 0.0045, -0.1 + Math.sin(i * 0.6) * 0.05]);
  f.part(tube(helix, 0.008, 120), 0xc8743a, 0, 0, 0);
  f.glow(BALL, 0x8affe8, 2, gu, y + 0.42, -0.1, 0, 0.05);
  // a plumbus, pink, on a stand
  plumbus(f, 1.25, y, 0.0, 1);
  // the Meeseeks box: blue, a big button on top
  const mx = -297.5 - it.x;
  f.box(0x2f6fd0, mx, y, -0.05, 0.4, 0.26, 0.4).box(0x2459a8, mx, y + 0.26, -0.05, 0.42, 0.02, 0.42);
  f.cyl(0xe8eef8, mx, y + 0.28, -0.05, 0.11, 0.03).part(new THREE.SphereGeometry(0.1, 16, 8, 0, TAU, 0, Math.PI / 2), 0x9fd0ff, mx, y + 0.31, -0.05, 0, 1, 0.55, 1);
  // a vice on the end, a soldering iron, screws, papers, Rick's mug and flask
  f.box(0x3a5a8a, 3.55, y, 0.35, 0.22, 0.12, 0.16).box(0x3a5a8a, 3.55, y + 0.12, 0.35, 0.12, 0.1, 0.12).cyl(0x9aa3ab, 3.55, y + 0.17, 0.48, 0.012, 0.2, Math.PI / 2);
  f.cyl(0x2b2b30, 3.0, y, -0.25, 0.05, 0.04).cyl(0xd8452f, 3.0, y + 0.1, -0.22, 0.018, 0.16, 0.8, 0).cyl(0x9aa3ab, 3.0, y + 0.18, -0.12, 0.006, 0.1, 0.8, 0);
  f.decal('notes', 2.0, y + 0.004, 0.25, 0.28, 0.36, { rx: -Math.PI / 2, ry: 0.3 }).decal('notes', -0.2, y + 0.004, 0.3, 0.26, 0.32, { rx: -Math.PI / 2, ry: -0.2 });
  f.cyl(0xe8e3d6, 1.75, y, -0.25, 0.045, 0.1).cyl(0x9aa3ab, -1.6, y, 0.3, 0.035, 0.14).box(0x9aa3ab, -1.6, y + 0.14, 0.3, 0.02, 0.02, 0.02);
  const r = rng(31);
  for (let i = 0; i < 14; i++) f.box(0x9aa3ab, -3.8 + r() * 7.4, y, 0.2 + r() * 0.35, 0.012, 0.012, 0.035, r() * 3);
}

// tools on the pegboard: wrenches, hammers, screwdrivers, pliers, a saw, a
// level, reels of wire and coils
function pegTools(f, v) {
  for (let i = 0; i < 6; i++) {
    const u = -3.7 + i * 0.1;
    const len = 0.16 + i * 0.03;
    f.cbox(0xa3acb5, u, 1.95 - len / 2, v + 0.01, 0.022, len, 0.008);
    f.part(new THREE.TorusGeometry(0.02, 0.007, 6, 12), 0xa3acb5, u, 1.95, v + 0.01);
  }
  for (const [u, c] of [
    [-2.95, 0x6b4426],
    [-2.7, 0xc8302a],
  ]) {
    f.cbox(c, u, 1.78, v + 0.02, 0.03, 0.32, 0.03).cbox(0x3a3d42, u, 1.95, v + 0.03, 0.13, 0.045, 0.045);
  }
  for (let i = 0; i < 6; i++) {
    const u = -2.35 + i * 0.07;
    f.cyl([0xc8302a, 0xf2d23c, 0x2f6fb0, 0xc8302a, 0x3f8f3a, 0xf2d23c][i], u, 2.12, v + 0.03, 0.017, 0.1).cyl(0xa3acb5, u, 1.96, v + 0.03, 0.005, 0.16);
  }
  for (const s of [-1, 1]) f.cbox(0xc8302a, -1.75 + s * 0.02, 1.72, v + 0.02, 0.022, 0.18, 0.015, 0, 0, s * 0.12);
  f.cbox(0x3a3d42, -1.75, 1.84, v + 0.02, 0.04, 0.07, 0.02);
  // a saw, a level
  f.cbox(0xb9c0c7, -1.35, 1.45, v + 0.01, 0.42, 0.13, 0.006, 0, 0, 0.08).cbox(0x6b4426, -1.1, 1.45, v + 0.02, 0.1, 0.12, 0.03);
  f.cbox(0xf2c23c, -0.75, 1.32, v + 0.02, 0.62, 0.05, 0.03).glow(BOX, 0x9dff5a, 1.2, -0.75, 1.32, v + 0.036, 0, 0.05, 0.02, 0.004);
  // reels of wire: copper, red, green; coils and a coiled cable
  for (const [u, c] of [
    [-1.25, 0xc8743a],
    [-0.95, 0xc8302a],
    [-0.65, 0x3f8f3a],
  ]) {
    f.cyl(c, u, 1.72, v + 0.05, 0.075, 0.06, Math.PI / 2).cyl(0x3a3d42, u, 1.72, v + 0.05, 0.1, 0.012, Math.PI / 2, 0).cyl(0x3a3d42, u, 1.72, v + 0.085, 0.1, 0.012, Math.PI / 2, 0);
  }
  f.part(new THREE.TorusGeometry(0.11, 0.018, 8, 24), 0xc8743a, -0.28, 2.12, v + 0.03).part(new THREE.TorusGeometry(0.075, 0.014, 8, 20), 0xc8743a, -0.28, 2.12, v + 0.05);
  f.part(new THREE.TorusGeometry(0.13, 0.02, 8, 24), 0xd87a2a, 0.12, 1.6, v + 0.03).part(new THREE.TorusGeometry(0.11, 0.02, 8, 24), 0xd87a2a, 0.13, 1.58, v + 0.05);
  f.part(new THREE.TorusGeometry(0.09, 0.012, 6, 20), 0x2b2b30, -3.3, 1.52, v + 0.03).part(new THREE.TorusGeometry(0.07, 0.012, 6, 20), 0x2b2b30, -3.3, 1.5, v + 0.05);
  f.cbox(0xf2c23c, -2.0, 1.38, v + 0.04, 0.09, 0.09, 0.05);
}

// a plumbus: pink body, a knobbly top, a fleeb, a darker grip
function plumbus(f, u, y, v, k = 1) {
  f.cyl(0x8a5a34, u, y, v, 0.07 * k, 0.02);
  f.part(lathe([[0, 0], [0.05, 0.01], [0.07, 0.06], [0.06, 0.12], [0.035, 0.16], [0, 0.17]], 14), 0xf08fb4, u, y + 0.02, v, 0, k);
  f.ball(0xf6a8c8, u - 0.02 * k, y + 0.2 * k, v + 0.01, 0.045 * k);
  f.ball(0xd86a98, u + 0.05 * k, y + 0.12 * k, v + 0.03, 0.025 * k).ball(0xd86a98, u - 0.05 * k, y + 0.09 * k, v - 0.02, 0.02 * k);
  f.cyl(0xc75a8a, u + 0.07 * k, y + 0.07 * k, v, 0.018 * k, 0.12 * k, 0, Math.PI / 2);
}

// the L's other arm: a shallow counter round the north-east corner and down
// the east wall, as far as the door to the kitchen
function benchArm(R) {
  const f = R.frame(0, 0, 0);
  const runs = [
    [-295.95, -294, 94, 94.4],
    [-294.4, -294, 94.4, 96.3],
  ];
  for (const [x0, x1, z0, z1] of runs) {
    f.box(CAB, (x0 + x1) / 2, 0.08, (z0 + z1) / 2, x1 - x0, 0.86, z1 - z0).box(TOP, (x0 + x1) / 2, 0.94, (z0 + z1) / 2, x1 - x0 + 0.02, 0.06, z1 - z0 + 0.02);
  }
  for (let i = 0; i < 4; i++) f.box(0x433e38, -294.38, 0.14, 94.62 + i * 0.42, 0.02, 0.72, 0.38);
  // an old monitor on it, green text; a toolbox
  f.box(0xd8d4c8, -294.25, 1.0, 95.0, 0.36, 0.34, 0.38).glow(BOX, 0x9dff5a, 1.25, -294.43, 1.17, 95.0, 0, 0.004, 0.22, 0.28);
  f.box(0xc8302a, -294.2, 1.0, 95.9, 0.28, 0.16, 0.42).cbox(0x2b2b30, -294.2, 1.2, 95.9, 0.03, 0.03, 0.2);
  f.box(0x8d949a, -295.4, 1.0, 94.2, 0.3, 0.12, 0.2).box(0xc9a46a, -294.9, 1.0, 94.2, 0.3, 0.24, 0.24);
}

// the grey metal shelving, its boxes, jars and curios
function shelving(R, it, glass) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(GREY, s * (w / 2 - 0.03), 0, t * (d / 2 - 0.03), 0.04, h, 0.04);
  const levels = [0.1, 0.55, 1.0, 1.45, h - 0.03];
  for (const y of levels) f.box(0x9aa1a7, 0, y, 0, w, 0.03, d).box(0x7d848a, 0, y - 0.04, d / 2 - 0.02, w, 0.04, 0.02);
  const top = (i) => levels[i] + 0.03;
  // boxes
  f.box(0xc9a46a, -1.0, top(0), 0, 0.7, 0.4, 0.75).box(0xb8925a, -0.15, top(0), 0.05, 0.6, 0.36, 0.7).box(0xc9a46a, 0.85, top(0), 0, 0.8, 0.4, 0.78);
  f.decal('label', -0.15, top(0) + 0.2, 0.401, 0.3, 0.15);
  // "Time travel stuff"
  f.box(0xc9a46a, -0.8, top(1), 0, 0.82, 0.4, 0.8).decal('timetravel', -0.8, top(1) + 0.2, 0.401, 0.62, 0.3);
  f.box(0xb8925a, 0.3, top(1), 0.05, 0.6, 0.3, 0.7).box(0x8a6a4a, 1.05, top(1), 0, 0.5, 0.25, 0.6);
  // jars
  for (const [u, c, s] of [
    [-1.2, 0x6dff4a, 1],
    [-0.95, 0xff8a1e, 0.8],
    [-0.72, 0x9a5ab0, 1.1],
    [-0.5, 0xd8e8a0, 0.9],
  ]) {
    glass.add(CYL, glass.mat, f.mat(u, top(2) + 0.11 * s, 0.1, 0, 0.16, 0.22 * s, 0.16));
    f.cyl(c, u, top(2) + 0.005, 0.1, 0.07, 0.17 * s).cyl(0x9aa3ab, u, top(2) + 0.22 * s, 0.1, 0.082, 0.025);
  }
  // the spiky ball
  const su = 0.15;
  const sy = top(2) + 0.16;
  f.part(new THREE.IcosahedronGeometry(0.12, 0), 0x7a2a5a, su, sy, 0.1);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pts = ico.attributes.position;
  const seen = new Set();
  for (let i = 0; i < pts.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pts, i).normalize();
    const key = p.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p);
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    f.part(new THREE.ConeGeometry(0.03, 0.12, 6), 0xd8d0b0, su + p.x * 0.15, sy + p.y * 0.15, 0.1 + p.z * 0.15, e.y, 1, 1, 1, e.x, e.z);
  }
  // the green alien head: big black eyes, a little mouth
  const au = 0.8;
  const ay = top(2) + 0.17;
  f.ball(0x7ac74f, au, ay, 0.1, 0.15, 1.2).ball(0x6ab03f, au, ay - 0.14, 0.12, 0.08, 0.7);
  for (const s of [-1, 1]) f.part(BALL, 0x111111, au + s * 0.065, ay + 0.02, 0.22, s * 0.35, 0.09, 0.05, 0.04, 0, s * 0.5);
  f.box(0x2a4a1a, au, ay - 0.1, 0.235, 0.05, 0.01, 0.01);
  // the top shelf: an old gadget, a coil, a box
  f.box(0x6f7880, -0.9, top(3), 0, 0.5, 0.3, 0.5).glow(BOX, 0xff3a2a, 1.6, -0.75, top(3) + 0.22, 0.251, 0, 0.04, 0.04, 0.004).glow(BOX, 0x9dff5a, 1.6, -0.65, top(3) + 0.22, 0.251, 0, 0.04, 0.04, 0.004);
  f.part(new THREE.TorusGeometry(0.12, 0.03, 8, 20), 0xc8743a, 0.0, top(3) + 0.03, 0.05, 0, 1, 1, 1, Math.PI / 2);
  f.box(0xc9a46a, 0.85, top(3), 0, 0.7, 0.36, 0.7);
  f.box(0xb8925a, -0.5, top(4), 0, 0.8, 0.3, 0.7).box(0xc9a46a, 0.6, top(4), 0, 0.6, 0.25, 0.6);
}

// the orange floral lampshade on a wall arm, lit
function wallLamp(R, x, y, z, turn) {
  const f = R.frame(x, z, turn);
  f.cbox(0xb08a3a, 0, y, 0.02, 0.12, 0.18, 0.04).cyl(0xb08a3a, 0, y, 0.18, 0.012, 0.34, Math.PI / 2, 0).cyl(0xb08a3a, 0, y + 0.07, 0.35, 0.012, 0.14);
  const shade = lathe([[0.17, 0], [0.09, 0.22]], 20);
  f.decal('floral', 0, y - 0.04, 0.35, 1, 1, { geo: shade, bright: true });
  f.glow(BALL, 0xffc070, 2.0, 0, y + 0.02, 0.35, 0, 0.08);
  f.glow(new THREE.CircleGeometry(0.165, 20), 0xffb050, 1.6, 0, y - 0.035, 0.35, 0, 1, 1, 1, Math.PI / 2);
}

// the pinkish-tan machine on its stand: the plumbus factory, a fresh plumbus in its tray
function machine(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const tan = 0xd8a890;
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(0x6f7880, s * (w / 2 - 0.08), 0, t * (d / 2 - 0.06), 0.05, 0.7, 0.05);
  f.box(0x7d848a, 0, 0.2, 0, w - 0.1, 0.03, d - 0.06).box(0x7d848a, 0, 0.68, 0, w - 0.06, 0.04, d - 0.02);
  f.box(tan, -0.15, 0.72, -0.02, w - 0.5, 0.62, d - 0.08);
  f.part(new THREE.CylinderGeometry(0.21, 0.21, w - 0.5, 20, 1, false, 0, Math.PI), tan, -0.15, 1.34, -0.02, 0, 1, 1, 1, 0, Math.PI / 2);
  f.decal('gauges', -0.25, 1.15, d / 2 - 0.035, 0.84, 0.3);
  for (let i = 0; i < 5; i++) f.cyl(0x3a3d42, -0.6 + i * 0.18, 0.86, d / 2 - 0.04, 0.025, 0.03, Math.PI / 2);
  for (const [du, c] of [
    [0.3, 0xff3a2a],
    [0.42, 0x9dff5a],
    [0.54, 0xffc04a],
  ])
    f.glow(BALL, c, 1.8, -0.55 + du, 0.95, d / 2 - 0.035, 0, 0.04);
  // the hopper on top, the chute and its tray, the plumbus in it
  f.part(new THREE.CylinderGeometry(0.16, 0.06, 0.24, 14), 0xc99a82, -0.6, 1.68, -0.02);
  f.box(0xc99a82, w / 2 - 0.28, 0.82, 0, 0.36, 0.32, 0.3).box(0x9aa3ab, w / 2 - 0.2, 0.72, 0.05, 0.38, 0.04, 0.34);
  plumbus(f, w / 2 - 0.2, 0.76, 0.05, 0.85);
  f.cyl(0x6f7880, -0.15 + (w - 0.5) / 2 - 0.05, 1.3, -0.1, 0.03, 0.4);
}

// the Portal panic cabinet, its screen lit
function cabinet(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  const body = 0x1b1424;
  for (const s of [-1, 1]) {
    f.box(body, s * (w / 2 - 0.03), 0, 0, 0.06, h, d);
    f.decal('ppside', s * (w / 2 + 0.001), 1.0, 0, d - 0.06, 1.0, { ry: s * (Math.PI / 2) });
  }
  f.box(0x2a2236, 0, 0, -0.03, w - 0.1, 0.85, d - 0.08).box(0x2a2236, 0, 0.85, -0.12, w - 0.1, h - 0.85, d - 0.26);
  f.box(0x352c44, 0, 0.85, 0.08, w - 0.08, 0.06, 0.34, 0, -0.25);
  f.decal('ppscreen', 0, 1.3, 0.02, w - 0.3, 0.62, { bright: true, rx: -0.18 });
  f.decal('ppmarquee', 0, h - 0.13, d / 2 - 0.08, w - 0.12, 0.22, { bright: true });
  f.cyl(0x2b2b30, -0.3, 0.92, 0.14, 0.012, 0.12).ball(0xd0201c, -0.3, 1.06, 0.14, 0.035);
  for (let i = 0; i < 3; i++) f.cyl([0x97ce4c, 0x45c5e8, 0xf2d23c][i], 0.05 + i * 0.12, 0.9, 0.12 - i * 0.01, 0.028, 0.03, -0.25, 0);
  f.box(0x0f0b14, 0, 0.3, d / 2 - 0.035, 0.24, 0.12, 0.02).glow(BOX, 0xff8a1e, 1.4, 0, 0.36, d / 2 - 0.02, 0, 0.06, 0.03, 0.004);
}

// the cream washer and dryer, side by side, by the garage door
function laundry(R, it, glass) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const cream = 0xf0e8d0;
  const uw = w / 2 - 0.02;
  for (const s of [-1, 1]) {
    const u = (s * w) / 4;
    f.box(cream, u, 0.02, 0, uw, 0.88, d - 0.04).box(0xe2d9bf, u, 0.9, -d / 2 + 0.07, uw, 0.14, 0.1);
    f.part(new THREE.TorusGeometry(0.17, 0.035, 8, 24), 0xb9c0c7, u, 0.48, d / 2 - 0.01);
    f.cyl(0x3a3d42, u, 0.48, d / 2 - 0.03, 0.15, 0.02, Math.PI / 2);
    glass.add(CYL, glass.mat, f.mat(u, 0.48, d / 2 - 0.005, 0, 0.3, 0.02, 0.3, Math.PI / 2));
    for (let i = 0; i < 2; i++) f.cyl(0x9aa3ab, u - 0.15 + i * 0.1, 0.97, -d / 2 + 0.125, 0.025, 0.03, Math.PI / 2);
    f.glow(BOX, 0x9dff5a, 1.2, u + 0.15, 0.97, -d / 2 + 0.121, 0, 0.08, 0.03, 0.004);
  }
  f.box(0x3a6fb0, -w / 4, 0.9, 0.05, 0.42, 0.22, 0.32);
  f.box(0xe8f0f6, -w / 4, 1.05, 0.05, 0.36, 0.08, 0.26);
  f.cyl(0xf08a2a, w / 4 + 0.1, 0.9, 0.08, 0.06, 0.2).cyl(0xd8452f, w / 4 + 0.1, 1.1, 0.08, 0.025, 0.04);
}

// the red office chair, pushed in at the bench
function chair(R, x, z, turn) {
  const f = R.frame(x, z, turn);
  const red = 0xc8302a;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    f.cbox(0x2b2b30, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, 0.3, 0.035, 0.04, -a);
    f.ball(0x1a1a1e, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, 0.03, 1, BALL8);
  }
  f.cyl(0x9aa3ab, 0, 0.07, 0, 0.025, 0.36).cyl(0x2b2b30, 0, 0.3, 0, 0.04, 0.14);
  f.box(red, 0, 0.44, 0, 0.5, 0.09, 0.48).box(0x9a2420, 0, 0.44, 0, 0.46, 0.02, 0.44);
  f.box(0x2b2b30, 0, 0.47, 0.22, 0.06, 0.2, 0.04);
  f.box(red, 0, 0.62, 0.27, 0.46, 0.48, 0.08, 0, 0.12);
  for (const s of [-1, 1]) f.box(0x2b2b30, s * 0.25, 0.5, 0.0, 0.04, 0.18, 0.04).box(0x2b2b30, s * 0.25, 0.68, -0.02, 0.06, 0.03, 0.3);
}

// the garage door from inside: four panels, its rails and the opener
function garageDoor(f, u, v1, thick) {
  const w = 5.4;
  const h = 2.5;
  for (let i = 0; i < 4; i++) {
    const y = i * (h / 4);
    f.box(0xcdb58b, u, y + 0.01, v1 - thick / 2, w, h / 4 - 0.02, 0.05);
    for (const s of [-1, 1]) f.box(0xbfa67a, u + s * (w / 4), y + 0.08, v1 - thick / 2 + 0.03, w / 2 - 0.2, h / 4 - 0.16, 0.012);
  }
  f.box(0x9aa3ab, u, 0.12, v1 - thick / 2 + 0.05, 0.3, 0.04, 0.04);
  for (const s of [-1, 1]) f.box(0x7d848a, u + s * (w / 2 + 0.06), 0, v1 + 0.04, 0.06, h + 0.1, 0.08);
  f.glow(BOX, 0xfff4d8, 1.25, u, 0.015, v1 - thick / 2, 0, w - 0.04, 0.02, 0.04);
}

export async function buildGarage(kit) {
  const R = makeRoom(kit, 'garage');
  const m = kit.mats;
  const a = AREAS.garage;
  await needCast(kit, ['rick']);
  paintCells(R);
  const glass = { add: (geo, mat, matrix) => R.tiled.add(geo, mat, matrix), mat: m.glass };

  // concrete floor, plank walls, the beamed ceiling
  const concrete = tiledPaint(m, 'c137-lab-concrete', 256, 3.2, (g, w, h) => {
    speckle(g, w, h, { base: '#b5c0ad', specks: ['#a7b29f', '#c3ccbb', '#9da896', '#bcc6b3'], n: 4200, size: 2, seed: 17 });
    const r = rng(23);
    for (let i = 0; i < 4; i++) {
      const x = r() * w;
      const y = r() * h;
      const gr = g.createRadialGradient(x, y, 2, x, y, 30 + r() * 40);
      gr.addColorStop(0, 'rgba(70,80,60,0.18)');
      gr.addColorStop(1, 'rgba(70,80,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = 'rgba(80,90,75,0.5)';
    g.fillRect(0, h - 2, w, 2);
    g.fillRect(w - 2, 0, 2, h);
  });
  // (one surface with the hatch's hole in it: slabs side by side leave hairline cracks the ink finds)
  R.tiled.add(holed([a.x0 - 0.2, a.x1 + 0.2, a.z0 - 0.2, a.z1 + 0.2], [HATCH.x - HATCH.w / 2, HATCH.x + HATCH.w / 2, HATCH.z - HATCH.d / 2, HATCH.z + HATCH.d / 2]), concrete, at(0, 0, 0));
  const plank = tiledPaint(m, 'c137-lab-planks', 256, 2.2, planks('#5e3d26', 3));
  const ceiling = tiledPaint(m, 'c137-lab-ceiling', 256, 2.4, planks('#3e2a1c', 9, true));
  const wall = { mat: plank, skirt: 0x3a2618, h: H };
  const F = R.fixed;
  wallLine(R, F, [a.x0 - 0.2, a.z0], [a.x1 + 0.2, a.z0], { ...wall, into: [0, 1] });
  wallLine(R, F, [a.x0, a.z0 - 0.2], [a.x0, a.z1 + 0.2], { ...wall, into: [1, 0] });
  const kd = LINKS.find((l) => l.id === 'garage-kitchen');
  wallLine(R, F, [a.x1, a.z0 - 0.2], [a.x1, a.z1 + 0.2], { ...wall, into: [-1, 0] }, [{ c: kd.z, w: 0.92, y0: 0, y1: DOOR_H, draw: (f, u, wl) => kitchenDoor(f, u, wl) }]);
  const exit = LINKS.find((l) => l.id === 'garage-exit');
  wallLine(R, F, [a.x0 - 0.2, a.z1], [a.x1 + 0.2, a.z1], { ...wall, into: [0, -1] }, [{ c: exit.x, w: 5.4, y0: 0, y1: 2.5, draw: (f, u, wl) => garageDoor(f, u, wl.v1, wl.thick) }]);
  const ceil = new THREE.Matrix4().compose(new THREE.Vector3((a.x0 + a.x1) / 2, H + 0.05, (a.z0 + a.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(a.x1 - a.x0 + 0.4, 0.1, a.z1 - a.z0 + 0.4));
  R.tiled.add(BOX, ceiling, ceil);
  const top = R.frame(0, 0, 0, { list: 'fixed' });
  for (let z = a.z0 + 1.2; z < a.z1; z += 2.1) top.box(0x2e1f14, (a.x0 + a.x1) / 2, H - 0.24, z, a.x1 - a.x0, 0.24, 0.16);
  // the long fluorescent light, on chains
  const lx = (a.x0 + a.x1) / 2 + 0.6;
  const lz = (a.z0 + a.z1) / 2 - 0.5;
  top.box(0xd8dcd6, lx, 2.5, lz, 0.32, 0.08, 3.6).box(0xc2c7c0, lx, 2.47, lz, 0.28, 0.03, 3.5);
  for (const s of [-1, 1]) top.cyl(0x6f7880, lx, 2.58, lz + s * 1.4, 0.008, H - 2.58);
  for (const s of [-1, 1]) top.glow(CYL, 0xf2fff2, 2.4, lx + s * 0.07, 2.45, lz, 0, 0.04, 3.4, 0.04, Math.PI / 2);
  // the garage door's opener and its rails
  top.box(0x7d848a, -300, H - 0.3, 103.2, 0.3, 0.14, 0.36).box(0x9aa3ab, -300, H - 0.22, 104.7, 0.05, 0.04, 2.6);
  for (const s of [-1, 1]) top.box(0x7d848a, -300 + s * 2.76, 2.55, 104.4, 0.06, 0.08, 3.2);

  // the bench, its arm round the corner, the chair, the clock and the calendar
  const it = (id) => FURNITURE.find((f) => f.id === id);
  bench(R, it('workbench'), glass);
  benchArm(R);
  chair(R, -300.45, 95.12, 0.25);
  const nw = R.fixed(-295.05, a.z0, 0);
  nw.decal('calendar', 0, 1.55, 0.012, 0.42, 0.6).box(0x9aa3ab, 0, 1.86, 0.01, 0.02, 0.02, 0.02);
  nw.cyl(0x2b2b30, 0, 2.36, 0.025, 0.2, 0.05, Math.PI / 2).decal('clock', 0, 2.36, 0.052, 0.36, 0.36);
  shelving(R, it('shelf-garage'), glass);
  wallLamp(R, a.x0, 2.25, 96.9, Math.PI / 2);
  machine(R, it('plumbus'));
  cabinet(R, it('portalpanic'));
  laundry(R, it('laundry'), glass);
  // on the east wall past the portal: a shelf of paint cans, a coiled cable, the fuse box
  const ew = R.fixed(a.x1, 103.6, -Math.PI / 2);
  ew.box(0x5a3a20, 0, 1.45, 0.14, 1.3, 0.04, 0.28);
  for (let i = 0; i < 4; i++) ew.cyl([0xe8e3d6, 0x3a6fb0, 0xc8302a, 0xe8e3d6][i], -0.48 + i * 0.3, 1.49, 0.14, 0.09, 0.2);
  ew.part(new THREE.TorusGeometry(0.16, 0.025, 8, 24), 0xd87a2a, 0.9, 1.1, 0.05).part(new THREE.TorusGeometry(0.14, 0.025, 8, 24), 0xd87a2a, 0.92, 1.08, 0.08);
  ew.box(0x8d949a, -0.95, 1.4, 0.06, 0.4, 0.55, 0.12).box(0x7d848a, -0.95, 1.43, 0.125, 0.36, 0.49, 0.01);

  // the portal, swirling, on the east wall where Morty steps through
  const pl = LINKS.find((l) => l.id === 'garage-portal');
  const pm = R.own(kit.portal());
  const portal = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.0, 2.6)), pm);
  portal.position.set(a.x1 - 0.06, 1.42, pl.z);
  portal.rotation.y = -Math.PI / 2;
  portal.renderOrder = 2;
  R.add(portal, { ink: false });
  // its green light on the floor and the walls about it
  const spill = new THREE.Mesh(R.own(new THREE.PlaneGeometry(1, 1)), R.own(new THREE.MeshBasicMaterial({ map: R.own(glowSpot()), color: new THREE.Color(0x6dff4a).multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(a.x1 - 0.9, 0.012, pl.z);
  spill.scale.set(2.2, 3.4, 1);
  R.add(spill, { ink: false });
  R.tick((t) => {
    pm.uniforms.t.value = t;
    spill.material.opacity = 0.55 + Math.sin(t * 2.3) * 0.12;
  });

  // the hatch down to the secret lab, and the door's and the hatch's paint
  hatch(R);
  paintDoor(R);

  // Rick at the bench
  const rick = PEOPLE.find((p) => p.id === 'rick');
  person(R, 'rick', { ...rick, h: 2.0, look: LOOKS.rick });

  return R.build({ light: { sun: [0xffe9c8, 0.42], hemi: [0xf3ecdc, 0x5e5a4a, 1.6], fog: null, background: 0x0e0b09 } });
}

// ── the ways out: the kitchen door and the hatch ──

// The door to the kitchen: pale in a broad white frame, proud of the dark
// planks; a little window in it with the kitchen's light through it, a steel
// kick plate, the sign over it and a caged lamp beside that. (v out of the
// wall into the lab, u along it, southwards.)
function kitchenDoor(f, u, wl) {
  const w = 0.92;
  const h = DOOR_H;
  const v = wl.v1 - wl.thick / 2;
  const trim = 0xf7f3ea;
  f.box(0xefe6cf, u, 0, v, w, h, 0.05);
  for (const s of [-1, 1]) f.box(0xdccfb0, u + s * w * 0.22, 0.2, v + 0.03, w * 0.32, 0.78, 0.012);
  f.box(0xb9c0c7, u, 0.03, v + 0.032, w - 0.1, 0.14, 0.01);
  // the window: the kitchen through it, a frame and a glazing bar
  f.decal('kitchenview', u, 1.52, v + 0.034, 0.5, 0.6, { bright: true });
  for (const [du, y, ww, hh] of [
    [0, 1.2, 0.62, 0.06],
    [0, 1.84, 0.62, 0.06],
    [-0.28, 1.52, 0.06, 0.68],
    [0.28, 1.52, 0.06, 0.68],
    [0, 1.52, 0.5, 0.025],
  ])
    f.cbox(trim, u + du, y, v + 0.04, ww, hh, 0.03);
  for (const s of [-1, 1]) f.ball(0xd8b25a, u - w * 0.38, 0.98, v + s * 0.06, 0.035);
  casing(f, u, w, h, wl.v1 - wl.thick, wl.v1, trim, { both: false, width: 0.14 });
  // the sign over the door, and a lamp in a cage beside it
  f.cbox(0x2b2b30, u, h + 0.27, wl.v1 + 0.012, 0.6, 0.19, 0.024).decal('kitchensign', u, h + 0.27, wl.v1 + 0.025, 0.56, 0.15);
  const lu = u + 0.72;
  f.cbox(0x3a3d42, lu, 2.18, wl.v1 + 0.02, 0.12, 0.16, 0.04).cyl(0x3a3d42, lu, 2.18, wl.v1 + 0.1, 0.03, 0.14, Math.PI / 2);
  f.glow(BALL, 0xffd890, 2.4, lu, 2.18, wl.v1 + 0.2, 0, 0.11);
  for (const y of [2.12, 2.24]) f.part(new THREE.TorusGeometry(0.075, 0.006, 4, 16), 0x2b2b30, lu, y, wl.v1 + 0.2, 0, 1, 1, 1, Math.PI / 2);
  for (let i = 0; i < 4; i++) f.cbox(0x2b2b30, lu + Math.cos((i * TAU) / 4) * 0.075, 2.18, wl.v1 + 0.2 + Math.sin((i * TAU) / 4) * 0.075, 0.008, 0.16, 0.008);
  // a mat in front of it
  f.decal('doormat', u, 0.004, wl.v1 + 0.42, 0.88, 0.56, { rx: -Math.PI / 2 });
}

// the door's pictures, and the hatch's warning stripe
function paintDoor(R) {
  R.cell('kitchenview', 80, 96, (g, w, h) => {
    // the kitchen's olive wall in lamplight, a window with yellow curtains, the lamp
    const gr = g.createRadialGradient(w * 0.55, h * 0.18, 4, w * 0.55, h * 0.3, h * 0.9);
    gr.addColorStop(0, '#f6f0a8');
    gr.addColorStop(0.35, '#a9b25a');
    gr.addColorStop(1, '#5f6a2e');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#bfe6f4';
    g.fillRect(w * 0.08, h * 0.3, w * 0.34, h * 0.32);
    g.fillStyle = '#f2c84a';
    g.fillRect(w * 0.02, h * 0.26, w * 0.12, h * 0.42);
    g.fillRect(w * 0.36, h * 0.26, w * 0.12, h * 0.42);
    g.fillStyle = '#d8c39a';
    g.fillRect(0, h * 0.74, w, h * 0.26);
    g.fillStyle = '#3a3d42';
    g.fillRect(w * 0.55 - 1, 0, 2, h * 0.12);
    g.fillStyle = '#fff6c8';
    g.beginPath();
    g.arc(w * 0.55, h * 0.16, 7, 0, TAU);
    g.fill();
  });
  R.cell('kitchensign', 224, 60, (g, w, h) => {
    g.fillStyle = '#f2ecd8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#25503f';
    g.fillRect(4, 4, w - 8, h - 8);
    g.strokeStyle = '#f2ecd8';
    g.lineWidth = 2;
    g.strokeRect(9, 9, w - 18, h - 18);
    fitText(g, 'KITCHEN', w / 2, h / 2 + 1, w - 40, 34, { color: '#f2ecd8' });
  });
  R.cell('doormat', 128, 80, (g, w, h) => {
    speckle(g, w, h, { base: '#8a6238', specks: ['#76522c', '#9c7242', '#6a4826'], n: 1400, size: 1.6, seed: 41 });
    g.strokeStyle = '#3a2614';
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
  R.cell('hazard', 256, 32, hazardStripes);
}

// yellow and black, on the slant
export function hazardStripes(g, w, h) {
  g.fillStyle = '#f2c23c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1e1e22';
  for (let x = -h; x < w + h; x += h) {
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + h / 2, h);
    g.lineTo(x + h, 0);
    g.lineTo(x + h / 2, 0);
    g.fill();
  }
}

// The hatch (rules' HATCH): a steel lid flush in the floor, hinged on its west
// edge, in a steel rim with a warning stripe round it. It swings up as Morty
// comes within OPEN_R of it and down once he's gone. Open, it shows the shaft
// down, the top of the yellow ladder against its south side, and the secret
// lab's green light coming up it.
const OPEN_R = 2;
const LID_OPEN = 1.86; // how far it swings (radians: a little past upright)
const SHAFT = 2.4; // how deep the shaft is drawn
export const LADDER = 0xe0b62c; // the ladder's yellow, here and at its foot
function hatch(R) {
  const kit = R.kit;
  const [hx0, hx1, hz0, hz1] = [HATCH.x - HATCH.w / 2, HATCH.x + HATCH.w / 2, HATCH.z - HATCH.d / 2, HATCH.z + HATCH.d / 2];
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  // the shaft's lining, under the floor slab: concrete, darker further down
  for (const [x, z, w, d] of [
    [hx0 - 0.05, HATCH.z, 0.1, HATCH.d + 0.2],
    [hx1 + 0.05, HATCH.z, 0.1, HATCH.d + 0.2],
    [HATCH.x, hz0 - 0.05, HATCH.w, 0.1],
    [HATCH.x, hz1 + 0.05, HATCH.w, 0.1],
  ])
    f.box(0x4f5551, x, -0.7, z, w, 0.698, d).box(0x2a2f2c, x, -SHAFT, z, w, SHAFT - 0.7, d);
  // the green light from below: on the shaft's foot and up its walls
  f.glow(PLANE, 0x48ff6a, 0.95, HATCH.x, -SHAFT + 0.02, HATCH.z, 0, HATCH.w, HATCH.d, 1, -Math.PI / 2);
  for (const [x, z, ry, ww] of [
    [hx0 + 0.003, HATCH.z, Math.PI / 2, HATCH.d],
    [hx1 - 0.003, HATCH.z, -Math.PI / 2, HATCH.d],
    [HATCH.x, hz0 + 0.003, 0, HATCH.w],
    [HATCH.x, hz1 - 0.003, Math.PI, HATCH.w],
  ]) {
    f.glow(PLANE, 0x3ae860, 0.62, x, -SHAFT + 0.22, z, ry, ww, 0.44);
    f.glow(PLANE, 0x2cb04c, 0.34, x, -SHAFT + 0.66, z, ry, ww, 0.44);
  }
  // the top of the ladder, against the south side
  const lz = hz1 - 0.07;
  for (const s of [-1, 1]) {
    f.box(LADDER, HATCH.x + s * 0.25, -SHAFT, lz, 0.05, SHAFT - 0.05, 0.04);
    f.box(0x6f7880, HATCH.x + s * 0.25, -0.5, lz + 0.04, 0.04, 0.05, 0.06);
  }
  for (let y = -0.26; y > -SHAFT; y -= 0.28) f.cyl(0x9aa3ab, HATCH.x, y, lz, 0.017, 0.5, 0, Math.PI / 2);
  // the rim, flush round the hole, and the stripe round that
  const rim = 0x7d868c;
  f.box(rim, HATCH.x, 0, hz0 - 0.035, HATCH.w + 0.14, 0.014, 0.07).box(rim, HATCH.x, 0, hz1 + 0.035, HATCH.w + 0.14, 0.014, 0.07);
  f.box(rim, hx0 - 0.035, 0, HATCH.z, 0.07, 0.014, HATCH.d).box(rim, hx1 + 0.035, 0, HATCH.z, 0.07, 0.014, HATCH.d);
  const sw = 0.14;
  for (const s of [-1, 1]) {
    f.decal('hazard', HATCH.x, 0.003, HATCH.z + s * (HATCH.d / 2 + 0.07 + sw / 2), HATCH.w + 0.14 + sw * 2, sw, { rx: -Math.PI / 2 });
    f.decal('hazard', HATCH.x + s * (HATCH.w / 2 + 0.07 + sw / 2), 0.003, HATCH.z, HATCH.d + 0.14, sw, { rx: -Math.PI / 2, ry: Math.PI / 2 });
  }

  // the lid, on its own, hinged at the west edge (its pivot); +x across it
  const L = HATCH.w - 0.02;
  const parts = [];
  const p = (geo, color, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => parts.push({ geo, color, matrix: at(x, y, z, ry, sx, sy, sz, rx, rz) });
  p(BOX, 0x8f989e, L / 2, -0.0175, 0, 0, L, 0.035, L);
  // a raised lip round its top, rivets in it
  for (const s of [-1, 1]) {
    p(BOX, 0x7d868c, L / 2, 0.005, s * (L / 2 - 0.025), 0, L, 0.01, 0.05);
    p(BOX, 0x7d868c, L / 2 + s * (L / 2 - 0.025), 0.005, 0, 0, 0.05, 0.01, L - 0.1);
  }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) p(BALL8, 0xa9b1b7, 0.1 + i * 0.196, 0.01, s * (L / 2 - 0.025), 0, 0.02, 0.014, 0.02);
  // the warning stripe along the free edge
  for (let i = 0; i < 10; i++) p(BOX, i % 2 ? 0x1e1e22 : 0xf2c23c, L - 0.15, 0.0015, -L / 2 + 0.1 + i * 0.098 + 0.049, 0, 0.12, 0.003, 0.098);
  // the ring to lift it by, in its dish
  p(CYL, 0x4a5258, L - 0.42, 0.0005, 0, 0, 0.22, 0.002, 0.22);
  p(new THREE.TorusGeometry(0.07, 0.013, 6, 18), 0xb9c0c7, L - 0.42, 0.013, 0, 0, 1, 1, 1, Math.PI / 2);
  // the hinge's knuckles, and ribs under it (seen once it's up)
  for (const z of [-0.42, 0, 0.42]) p(CYL, 0x5d666c, 0, -0.012, z, 0, 0.05, 0.16, 0.05, Math.PI / 2);
  for (const z of [-0.3, 0.3]) p(BOX, 0x5a6268, L / 2, -0.06, z, 0, L - 0.12, 0.04, 0.04);
  p(BOX, 0x5a6268, L / 2, -0.06, 0, 0, 0.04, 0.04, L - 0.12);
  const lid = new THREE.Mesh(R.own(mergeParts(parts)), kit.mats.toon(0xffffff, { vertexColors: true }));
  lid.castShadow = true;
  lid.receiveShadow = true;
  const pivot = new THREE.Group();
  pivot.position.set(hx0 + 0.01, 0.012, HATCH.z);
  pivot.add(lid);
  R.add(pivot);

  // the green haze coming up out of it, while it's open
  const haze = new THREE.Mesh(
    R.own(crossed(HATCH.w * 0.9, SHAFT + 0.9)),
    R.own(new THREE.MeshBasicMaterial({ map: R.own(fadeUp()), color: new THREE.Color(0x5dff7a), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  );
  haze.position.set(HATCH.x, (0.9 - SHAFT) / 2, HATCH.z);
  haze.visible = false;
  R.add(haze, { ink: false });

  let k = 0;
  let last = -1;
  R.tick((t, dt, state) => {
    const m = state.morty;
    const want = m && Math.hypot(m.x - HATCH.x, m.z - HATCH.z) < OPEN_R ? 1 : 0;
    // (back in the lab after a while: where it should be, straight away)
    if (t - last > 0.25) k = want;
    else k = want > k ? Math.min(1, k + dt * 1.7) : Math.max(0, k - dt * 1.4);
    last = t;
    const e = k * k * (3 - 2 * k);
    pivot.rotation.z = e * LID_OPEN;
    haze.visible = e > 0.01;
    haze.material.opacity = e * 0.38;
  });
}

// A flat surface over [x0, x1, z0, z1] at y = 0 with a rectangular hole
// ([x0, x1, z0, z1]) in it, facing up (or down, `down`), in world space
export function holed([X0, X1, Z0, Z1], [x0, x1, z0, z1], down = false) {
  const v = (x, z) => new THREE.Vector2(x, down ? z : -z);
  const s = new THREE.Shape([v(X0, Z0), v(X0, Z1), v(X1, Z1), v(X1, Z0)]);
  s.holes.push(new THREE.Path([v(x0, z0), v(x1, z0), v(x1, z1), v(x0, z1)]));
  return new THREE.ShapeGeometry(s).rotateX(down ? Math.PI / 2 : -Math.PI / 2);
}

// two planes crossed at right angles, standing, w × h, for a glow seen from anywhere round it
export function crossed(w, h) {
  const a = new THREE.PlaneGeometry(w, h);
  const b = new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2);
  const g = mergeGeometries([a, b], false);
  a.dispose();
  b.dispose();
  return g;
}

// a soft glow, bright at the foot and gone by the top, faded at the sides
// (`down` turns it over: bright at the top)
export function fadeUp(down = false) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, down ? 0 : 128, 0, down ? 128 : 0);
  v.addColorStop(0, 'rgba(255,255,255,1)');
  v.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 32, 128);
  g.globalCompositeOperation = 'destination-in';
  const s = g.createLinearGradient(0, 0, 32, 0);
  s.addColorStop(0, 'rgba(0,0,0,0)');
  s.addColorStop(0.5, 'rgba(0,0,0,1)');
  s.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = s;
  g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a soft round spot, for the portal's light
export function glowSpot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
