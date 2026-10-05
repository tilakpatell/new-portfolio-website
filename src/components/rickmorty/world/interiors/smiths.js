// The Smith house as the show draws it, for ./house.js and ./upstairs.js:
// the rooms' paint (walls, trim, ceilings) and their furniture, each piece
// on its rules.js collider (front to +z at turn 0): the kitchen's tan and
// brown cupboards, the sink under its window, the range and its steel hood,
// the white fridge and the breakfast nook; the living room's mint couch,
// teal armchair, coffee table, bookcase and Snuffles' red bed; the dining
// table under its checked cloth and its six blue chairs; the grandfather
// clock; Morty's bed, blue nightstand, bookshelf of toys, red desk and
// chair; the pendants, curtains and the sconce. The pictures are
// ./smithpaint.js.

import * as THREE from 'three';
import { mergeParts, rng } from '../kit';
import { BALL, BALL8, BOX, CYL, CYL8, lathe, TAU, tube } from './shell';

// The show's colours, a little lighter than they look on screen (the
// house's light takes some off)
export const P = {
  // walls, trim, ceilings
  olive: 0xa0b184,
  oliveDark: 0x7a8a58,
  archCream: 0xf1efd6,
  pink: 0xffc9bb,
  cream: 0xfbefbe,
  creamDining: 0xfbf4da,
  trim: 0xfbf7ee,
  mortyWall: 0xebe0da,
  mortyTrim: 0x6aa0c8,
  ceilKitchen: 0xf3d6b8,
  ceilSlope: 0x93a46c,
  ceilLiving: 0xf4ead2,
  ceilEntry: 0xf0e0c4,
  ceilMorty: 0xd6d6d4,
  beam: 0xbc9068,
  // the kitchen
  cabFrame: 0x8c5a3e,
  cabDoor: 0xe6bc80,
  knob: 0x7a3a1e,
  kick: 0x5a3a28,
  top: 0xe3e8e5,
  steel: 0xc2cacc,
  steelDark: 0x5f686a,
  chrome: 0xd2d8dc,
  well: 0x7d878b,
  range: 0xf6f4ec,
  cooktop: 0x2a2a2e,
  fridge: 0xe6f2f0,
  fridgeDark: 0x9aa8a8,
  handle: 0x2a2a2e,
  nook: 0x9a643a,
  nookDark: 0x7a4a2a,
  nookSeat: 0xb0452e,
  curtainYellow: 0xfbf0a8,
  rod: 0x8a5a34,
  shade: 0xf6dc80,
  // the living room
  couch: 0xc2e4ce,
  couchLight: 0xd2eedc,
  teal: 0x5aaca8,
  tealLight: 0x6cbcb6,
  tealDark: 0x448c88,
  table: 0xc89666,
  tableDark: 0x6e4428,
  shelfWood: 0x6e4a32,
  dogBed: 0xd04a5e,
  dogBedIn: 0xead2c4,
  slider: 0x5c6872,
  // the dining room
  cloth: 0xccc95e,
  chairBlue: 0x3d7290,
  chairWood: 0x6a4524,
  salmon: 0xf4a28f,
  // the entry
  clock: 0x7a5038,
  clockDark: 0x4a3020,
  brass: 0xd8b04a,
  tread: 0x946446,
  riser: 0xf6ece4,
  rail: 0xfbf8f0,
  // Morty's room
  bedWood: 0x9a5a3e,
  headboard: 0xb0664e,
  spread: 0xebe6d4,
  pillow: 0xd8e4ee,
  nightstand: 0x6a9cba,
  drawerPink: 0xb8489a,
  lampRed: 0xb02c40,
  elephant: 0x6c6c78,
  shelfRed: 0x8a4a38,
  desk: 0xcc6660,
  deskDark: 0xaa5450,
  chairWindsor: 0x9a6438,
  jacket: 0x72a462,
};

const frameOf = (R, it, list = 'solid') => R.frame(it.x, it.z, it.turn, { list });

// ── the kitchen ──

// A run of cupboards, w wide at u, standing on y0, h high, its back at vb
// and d deep: the brown carcass, tan doors (a drawer over each, below the
// counter) and knobs
export function cupboards(f, u, w, y0, h, vb, d, { drawer = true, n = Math.max(1, Math.round(w / 0.5)), knobLow = false } = {}) {
  f.box(P.cabFrame, u, y0, vb + d / 2, w, h, d);
  const dw = w / n;
  const vf = vb + d + 0.012;
  for (let i = 0; i < n; i++) {
    const cu = u - w / 2 + dw * (i + 0.5);
    const side = i % 2 ? -1 : 1;
    if (drawer) {
      f.box(P.cabDoor, cu, y0 + h - 0.2, vf, dw - 0.08, 0.14, 0.024).ball(P.knob, cu, y0 + h - 0.13, vf + 0.02, 0.02, 1, BALL8);
      f.box(P.cabDoor, cu, y0 + 0.06, vf, dw - 0.08, h - 0.32, 0.024).ball(P.knob, cu + side * (dw / 2 - 0.09), y0 + h - 0.34, vf + 0.02, 0.02, 1, BALL8);
    } else f.box(P.cabDoor, cu, y0 + 0.05, vf, dw - 0.08, h - 0.1, 0.024).ball(P.knob, cu + side * (dw / 2 - 0.09), knobLow ? y0 + 0.13 : y0 + h - 0.13, vf + 0.02, 0.02, 1, BALL8);
  }
}

// A counter: cupboards under a pale grey top, and (unless `uppers` is
// false) cupboards on the wall over it
export function counter(R, it, { uppers = true } = {}) {
  const f = frameOf(R, it);
  const { w, d } = it;
  const vb = -d / 2;
  f.box(P.kick, 0, 0, vb + (d - 0.1) / 2, w, 0.1, d - 0.1);
  cupboards(f, 0, w, 0.1, 0.8, vb, d - 0.06);
  f.box(P.top, 0, 0.9, 0, w, 0.05, d).box(P.top, 0, 0.95, vb + 0.012, w, 0.07, 0.024);
  if (uppers) cupboards(f, 0, w, 1.45, 0.72, vb, 0.34, { drawer: false, knobLow: true });
  return f;
}

// what stands on the kitchen's counters, by the counter's id (u along it, v out from the wall)
export function onCounter(f, it) {
  const { w, d } = it;
  const top = 0.95;
  const vb = -d / 2;
  if (it.id === 'counter') {
    // a knife block, the coffee maker and mugs, a toaster; the paper towels under the cupboard
    knifeBlock(f, -w / 2 + 0.35, top, vb + 0.25);
    coffeeMaker(f, 0.35, top, vb + 0.2);
    mug(f, 0.65, top, 0.05, 0xf4f0e6);
    mug(f, 0.8, top, -0.08, 0xc8362e);
    f.box(0xc8cdd2, 1.3, top, vb + 0.2, 0.3, 0.2, 0.18).box(0x2a2a2e, 1.3, top + 0.2, vb + 0.2, 0.22, 0.01, 0.05);
    f.cyl(0x5a3a28, -0.55, 1.38, vb + 0.08, 0.014, 0.08).cyl(0x5a3a28, -0.25, 1.38, vb + 0.08, 0.014, 0.08);
    f.cyl(0xfbfaf4, -0.4, 1.33, vb + 0.16, 0.065, 0.3, 0, Math.PI / 2).cyl(0x9aa3ab, -0.4, 1.33, vb + 0.16, 0.02, 0.34, 0, Math.PI / 2);
  } else if (it.id === 'counter-w') {
    // three red canisters, a fruit bowl
    for (const [i, r, hh] of [
      [0, 0.08, 0.26],
      [1, 0.07, 0.21],
      [2, 0.06, 0.17],
    ]) {
      const u = 0.55 - i * 0.2;
      f.cyl(0xa0302a, u, top, vb + 0.16, r, hh).cyl(0x5a2a1e, u, top + hh, vb + 0.16, r * 0.9, 0.03).ball(0x3a1a12, u, top + hh + 0.04, vb + 0.16, 0.018, 1, BALL8);
    }
    f.part(new THREE.SphereGeometry(0.15, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0xe9e2cf, -0.45, top + 0.15, 0.02, 0, 1, 1, 1, Math.PI);
    for (const [du, dv, c] of [
      [0, 0, 0xe0402a],
      [0.07, 0.04, 0xf2c23c],
      [-0.06, 0.05, 0xf08a2a],
      [0.02, -0.07, 0x7ac74f],
    ])
      f.ball(c, -0.45 + du, top + 0.06, 0.02 + dv, 0.055, 1, BALL8);
  } else if (it.id === 'counter-nw') {
    // a bread box and a utensil pot
    f.box(0x9a6a3e, -0.3, top, vb + 0.2, 0.42, 0.2, 0.26).box(0x7a4a2a, -0.3, top + 0.2, vb + 0.2, 0.44, 0.02, 0.28);
    f.cyl(0xf4f0e6, 0.35, top, vb + 0.15, 0.06, 0.14);
    for (let i = 0; i < 4; i++) f.cyl([0x8a5a34, 0x2a2a2e, 0xc8cdd2, 0x8a5a34][i], 0.35 + (i - 1.5) * 0.02, top + 0.1, vb + 0.15, 0.008, 0.18 + (i % 2) * 0.04, (i - 1.5) * 0.15, 0);
  } else if (it.id === 'counter-ne') {
    // a dish rack, a mug
    f.box(0xd8dde0, 0, top, -0.02, 0.4, 0.04, 0.3);
    for (let i = 0; i < 4; i++) f.cyl(0xf6f6f2, -0.12 + i * 0.07, top + 0.13, -0.02, 0.11, 0.012, Math.PI / 2 - 0.15, 0);
    mug(f, 0.35, top, 0.1, 0x3a6fb0);
  } else if (it.id === 'counter-e') {
    // the coffee things where Beth stands in the show, a radio
    coffeeMaker(f, -0.8, top, vb + 0.18);
    mug(f, -0.5, top, 0.05, 0xf4f0e6);
    mug(f, -0.35, top, -0.05, 0xf2d23c);
    mug(f, 0.9, top, 0.05, 0x7ac74f);
    for (let i = 0; i < 3; i++) f.cyl(0x9a2a2a, 0.3 + i * 0.17, top, vb + 0.15, 0.065, 0.2 - i * 0.03).cyl(0x5a2a1e, 0.3 + i * 0.17, top + 0.2 - i * 0.03, vb + 0.15, 0.06, 0.03);
    f.box(0x8a5a34, 1.2, top, vb + 0.15, 0.3, 0.16, 0.12).box(0xd8c8a0, 1.12, top + 0.04, vb + 0.211, 0.1, 0.08, 0.002);
  }
  return f;
}
function knifeBlock(f, u, y, v) {
  f.box(0x8a5a34, u, y, v, 0.14, 0.2, 0.18, 0, -0.35);
  for (let i = 0; i < 4; i++) f.cbox(0x1d1d22, u - 0.045 + i * 0.03, y + 0.24, v - 0.04 - (i % 2) * 0.03, 0.022, 0.12, 0.03, 0, -0.35);
}
function coffeeMaker(f, u, y, v) {
  f.box(0x1d1d22, u, y, v, 0.22, 0.04, 0.24).box(0x1d1d22, u, y, v - 0.08, 0.22, 0.34, 0.08).box(0x1d1d22, u, y + 0.28, v, 0.22, 0.07, 0.24);
  f.cyl(0x9fc4d4, u, y + 0.04, v + 0.03, 0.07, 0.13).cyl(0x5a3420, u, y + 0.04, v + 0.03, 0.065, 0.06);
  f.glow(BOX, 0xff4030, 1.8, u + 0.07, y + 0.02, v + 0.121, 0, 0.02, 0.012, 0.004);
}
function mug(f, u, y, v, color) {
  f.cyl(color, u, y, v, 0.04, 0.1).part(TORUS_MUG, color, u + 0.045, y + 0.05, v, 0, 1, 1, 1, 0, 0);
  return f;
}
const TORUS_MUG = new THREE.TorusGeometry(0.025, 0.007, 6, 10);

// The sink: a counter with no cupboards over it (the window is), the steel
// basins and a tall tap
export function sink(R, it) {
  const f = counter(R, it, { uppers: false });
  const top = 0.95;
  f.box(P.steel, 0, top, -0.02, 0.92, 0.012, 0.5);
  for (const s of [-1, 1]) f.box(P.well, s * 0.215, top + 0.001, -0.02, 0.38, 0.012, 0.4);
  f.part(GOOSENECK, P.chrome, 0, 0, 0).cyl(P.chrome, 0, top, -0.28, 0.032, 0.05).cyl(P.chrome, 0.1, top, -0.28, 0.016, 0.09);
  // soap, a sponge, a plate drying
  f.cyl(0x5ab05a, -0.58, top, -0.2, 0.03, 0.17).cyl(0xf4f0e6, -0.58, top + 0.17, -0.2, 0.01, 0.04);
  f.box(0xf2d23c, 0.58, top, -0.15, 0.1, 0.035, 0.07).box(0x3f8f3a, 0.58, top + 0.035, -0.15, 0.1, 0.012, 0.07);
  plant(f, 0.5, top, -0.27, { s: 0.5, pot: 0xc8603a });
  return f;
}
const GOOSENECK = tube(
  [
    [0, 0.95, -0.28],
    [0, 1.22, -0.28],
    [0, 1.31, -0.2],
    [0, 1.26, -0.1],
    [0, 1.17, -0.08],
  ],
  0.016,
  20,
);

// The range: white, a black top with coil burners, the oven door, a pot on;
// the steel hood over it and a cupboard over that
export function stove(R, it) {
  const f = frameOf(R, it);
  const { w, d } = it;
  const vb = -d / 2;
  f.box(P.range, 0, 0, vb + (d - 0.03) / 2, w - 0.02, 0.92, d - 0.03);
  f.box(P.cooktop, 0, 0.92, 0, w - 0.04, 0.03, d - 0.05);
  for (const [bu, bv, r] of [
    [-0.19, 0.15, 0.09],
    [0.19, 0.15, 0.07],
    [-0.19, -0.13, 0.07],
    [0.19, -0.13, 0.09],
  ]) {
    f.part(TORUS_COIL, 0x4a4a52, bu, 0.955, bv, 0, r / 0.08, r / 0.08, r / 0.08, Math.PI / 2);
    f.cyl(0x4a4a52, bu, 0.95, bv, r * 0.35, 0.01);
  }
  // the backguard and its knobs, the oven door and window, the drawer
  f.box(P.range, 0, 0.95, vb + 0.05, w - 0.02, 0.18, 0.08);
  for (let i = 0; i < 4; i++) f.cyl(0x2a2a30, -0.27 + i * 0.18, 1.05, vb + 0.1, 0.022, 0.035, Math.PI / 2);
  f.box(0xebe8de, 0, 0.24, d / 2 - 0.035, w - 0.08, 0.6, 0.03).box(0x2a2a30, 0, 0.42, d / 2 - 0.02, 0.44, 0.24, 0.012);
  f.cbox(P.chrome, 0, 0.8, d / 2 + 0.01, 0.56, 0.025, 0.025).box(0xebe8de, 0, 0.04, d / 2 - 0.035, w - 0.08, 0.16, 0.03);
  // a pot on the front burner, a kettle on the back
  f.cyl(P.steel, -0.19, 0.96, 0.15, 0.12, 0.15).cyl(P.steel, -0.19, 1.11, 0.15, 0.125, 0.015).ball(0x2a2a30, -0.19, 1.135, 0.15, 0.02, 1, BALL8).cbox(0x2a2a30, -0.37, 1.06, 0.15, 0.14, 0.022, 0.025);
  f.part(lathe([[0.09, 0], [0.1, 0.06], [0.08, 0.14], [0.03, 0.17]], 12), 0xc8362e, 0.19, 0.96, -0.13, 0);
  f.cbox(0x2a2a30, 0.19, 1.18, -0.13, 0.03, 0.03, 0.14);
  // the hood: steel, a light under it
  f.box(P.steel, 0, 1.6, vb + 0.25, w, 0.15, 0.5).box(P.steelDark, 0, 1.595, vb + 0.25, w - 0.08, 0.01, 0.44);
  f.box(P.steel, 0, 1.53, vb + 0.5, w + 0.02, 0.2, 0.03, 0, 0.3);
  f.box(P.steelDark, -w / 2 + 0.12, 1.63, vb + 0.535, 0.1, 0.03, 0.01, 0, 0.3).box(P.steelDark, -w / 2 + 0.26, 1.63, vb + 0.535, 0.06, 0.03, 0.01, 0, 0.3);
  f.glow(BOX, 0xfff0c8, 1.4, 0, 1.592, vb + 0.36, 0, 0.3, 0.006, 0.06);
  cupboards(f, 0, w, 1.75, 0.42, vb, 0.34, { drawer: false, n: 2, knobLow: true });
  return f;
}
const TORUS_COIL = new THREE.TorusGeometry(0.08, 0.012, 6, 18);

// The fridge: pale and boxy, the freezer on top, black handles, notes and
// magnets on the door; a cupboard over it
export function fridge(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  f.box(P.fridgeDark, 0, 0, -0.06, w - 0.1, 0.07, d - 0.2);
  f.box(P.fridge, 0, 0.06, -0.04, w - 0.02, h - 0.07, d - 0.12);
  const vd = (d - 0.12) / 2 - 0.04 + 0.025;
  f.box(P.fridge, 0, 1.33, vd, w, h - 1.34, 0.05).box(P.fridge, 0, 0.07, vd, w, 1.23, 0.05);
  f.box(P.fridgeDark, 0, 1.3, vd - 0.01, w - 0.02, 0.03, 0.05);
  for (const [y0, hh] of [
    [1.4, 0.3],
    [0.72, 0.5],
  ]) {
    f.box(P.handle, -w / 2 + 0.08, y0, vd + 0.06, 0.035, hh, 0.035);
    for (const y of [y0 + 0.03, y0 + hh - 0.06]) f.box(P.handle, -w / 2 + 0.08, y, vd + 0.035, 0.03, 0.03, 0.03);
  }
  f.decal('fridgenotes', 0.1, 0.98, vd + 0.026, 0.66, 0.6);
  cupboards(f, 0, w, 1.97, 0.48, -d / 2, 0.4, { drawer: false, n: 2, knobLow: true });
  return f;
}

// The breakfast nook's little table, Summer's coffee on it
export function nookTable(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  f.box(P.nook, 0, h - 0.04, 0, w, 0.04, d).box(P.nookDark, 0, h - 0.13, 0, w - 0.1, 0.09, d - 0.1);
  for (const a of [-1, 1]) for (const b of [-1, 1]) f.box(P.nookDark, a * (w / 2 - 0.07), 0, b * (d / 2 - 0.07), 0.055, h - 0.04, 0.055);
  // a takeaway coffee, a mug, the salt and pepper, a napkin holder
  f.part(lathe([[0.035, 0], [0.045, 0.14]], 12), 0xf4f0e6, -0.2, h, 0.1, 0).cyl(0x8a5a34, -0.2, h + 0.05, 0.1, 0.043, 0.05).cyl(0xf4f0e6, -0.2, h + 0.14, 0.1, 0.047, 0.015);
  mug(f, 0.22, h, -0.15, 0xf2d23c);
  f.cyl(0xf4f0e6, 0.05, h, -0.25, 0.018, 0.07).cyl(0x3a3a3e, 0.1, h, -0.25, 0.018, 0.07);
  f.box(0xd8dde0, -0.1, h, -0.28, 0.12, 0.08, 0.06).box(0xffffff, -0.1, h + 0.02, -0.28, 0.1, 0.07, 0.04);
  return f;
}

// Chairs, in each room's style: 'nook' (wood, a red seat), 'dining' (a blue
// upholstered seat and back) and 'windsor' (Morty's, spindles)
export function chair(R, it, style = 'nook') {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  const wood = style === 'dining' ? P.chairWood : style === 'windsor' ? P.chairWindsor : P.nookDark;
  const sy = 0.46;
  const pw = 0.045;
  for (const a of [-1, 1]) for (const b of [-1, 1]) f.box(wood, a * (w / 2 - 0.04), 0, b * (d / 2 - 0.04), pw, sy, pw);
  for (const a of [-1, 1]) f.box(wood, a * (w / 2 - 0.04), 0.12, 0, 0.025, 0.025, d - 0.1);
  f.box(wood, 0, sy - 0.04, 0, w - 0.02, 0.04, d - 0.02);
  for (const a of [-1, 1]) f.box(wood, a * (w / 2 - 0.04), sy, -d / 2 + 0.04, pw, h - sy, pw);
  if (style === 'dining') {
    f.box(P.chairBlue, 0, sy, 0.01, w - 0.04, 0.06, d - 0.06);
    f.box(P.chairBlue, 0, sy + 0.14, -d / 2 + 0.045, w - 0.1, h - sy - 0.2, 0.05);
    f.box(wood, 0, h - 0.06, -d / 2 + 0.04, w - 0.04, 0.06, 0.05);
  } else if (style === 'nook') {
    f.box(P.nookSeat, 0, sy, 0.01, w - 0.06, 0.04, d - 0.08);
    for (const y of [sy + 0.18, h - 0.07]) f.box(wood, 0, y, -d / 2 + 0.04, w - 0.06, 0.06, 0.03);
  } else {
    // spindles up to a bowed top rail
    for (let i = 0; i < 5; i++) f.box(wood, -0.14 + i * 0.07, sy, -d / 2 + 0.05, 0.02, h - sy - 0.06, 0.02);
    f.box(wood, 0, h - 0.07, -d / 2 + 0.05, 0.2, 0.06, 0.035);
    for (const s of [-1, 1]) f.box(wood, s * 0.17, h - 0.09, -d / 2 + 0.06, 0.16, 0.06, 0.035, s * 0.35, 0, s * 0.12);
  }
  return f;
}

// A pendant lamp hanging from the ceiling at y top: a cord, a dome (or a wide
// cone) of a shade, lit underneath
export function pendant(f, u, v, top, { drop = 0.4, color = P.shade, wide = false } = {}) {
  const y = top - drop;
  f.cyl(0xf4f0e6, u, top - 0.03, v, 0.06, 0.03).cyl(0x3a3a3e, u, y + 0.12, v, 0.006, drop - 0.15);
  if (wide) {
    f.part(SHADE_WIDE, color, u, y, v, 0);
    f.glow(CYL, 0xfff2c8, 1.9, u, y + 0.015, v, 0, 0.66, 0.01, 0.66);
  } else {
    f.part(SHADE_DOME, color, u, y, v, 0);
    f.glow(CYL, 0xfff2c0, 2.1, u, y + 0.02, v, 0, 0.42, 0.01, 0.42);
  }
}
const SHADE_DOME = lathe([[0.23, 0], [0.22, 0.05], [0.17, 0.13], [0.08, 0.18], [0.03, 0.19]], 20);
const SHADE_WIDE = lathe([[0.36, 0], [0.33, 0.04], [0.14, 0.13], [0.04, 0.16]], 22);

// Curtains either side of a window at u (w wide), from a rod at y1 down to
// y0, pleated, `v` out from the wall; the rod and its ends
export function curtains(f, u, w, y0, y1, v, color, { panel = 0.5, rod = P.rod, over = panel * 0.3 } = {}) {
  const n = Math.max(3, Math.round(panel / 0.085));
  const pw = panel / n;
  const shade = new THREE.Color(color).multiplyScalar(0.84);
  for (const s of [-1, 1]) {
    const c = u + s * (w / 2 + panel / 2 - over);
    for (let i = 0; i < n; i++) f.box(i % 2 ? shade : color, c - panel / 2 + pw * (i + 0.5), y0, v + (i % 2 ? 0.03 : 0.08), pw + 0.012, y1 - y0 - 0.05, 0.03);
  }
  const len = w + panel * 2 - over * 2 + 0.2;
  f.cyl(rod, u, y1, v + 0.05, 0.016, len, 0, Math.PI / 2);
  for (const s of [-1, 1]) f.ball(rod, u + s * (len / 2 + 0.02), y1, v + 0.05, 0.03, 1, BALL8);
  for (let i = 0; i < 10; i++) f.part(TORUS_RING, rod, u - len / 2 + 0.1 + ((len - 0.2) * i) / 9, y1 - 0.01, v + 0.05, 0, 1, 1, 1, 0, 0);
}
const TORUS_RING = new THREE.TorusGeometry(0.022, 0.005, 5, 10);

// ── the living room ──

// The couch: mint green, rolled arms, three cushions on the seat and three
// against the back, two thrown pillows
export function couch(R, it) {
  const f = frameOf(R, it);
  const { w, d } = it;
  const vb = -d / 2;
  f.box(P.couch, 0, 0.1, 0.02, w - 0.36, 0.3, d - 0.1);
  for (const s of [-1, 1]) {
    f.box(P.couch, s * (w / 2 - 0.17), 0.1, 0.02, 0.32, 0.44, d - 0.08);
    f.cyl(P.couch, s * (w / 2 - 0.16), 0.57, 0.02, 0.17, d - 0.08, Math.PI / 2);
  }
  f.box(P.couch, 0, 0.1, vb + 0.15, w - 0.06, 0.66, 0.3);
  const cw = (w - 0.66) / 3;
  for (let i = 0; i < 3; i++) {
    const u = -(w - 0.66) / 2 + cw * (i + 0.5);
    f.box(P.couchLight, u, 0.4, 0.07, cw - 0.025, 0.14, d - 0.38);
    f.box(P.couchLight, u, 0.5, vb + 0.36, cw - 0.04, 0.38, 0.17, 0, -0.14);
  }
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.cyl(0x3a2414, s * (w / 2 - 0.12), 0, t * (d / 2 - 0.12), 0.03, 0.1, 0, 0, CYL8);
  // the pillows: one beige with a little picture on it, one cream
  f.box(0xe8d4a8, w / 2 - 0.55, 0.52, -0.1, 0.34, 0.32, 0.12, 0.25, -0.3).box(0xf4ecd6, -w / 2 + 0.55, 0.52, -0.1, 0.32, 0.3, 0.12, -0.25, -0.3);
  return f;
}

// The armchair: teal, a recliner's footrest seam
export function armchair(R, it) {
  const f = frameOf(R, it);
  const { w, d } = it;
  const vb = -d / 2;
  f.box(P.teal, 0, 0.08, 0.02, w - 0.3, 0.32, d - 0.06);
  for (const s of [-1, 1]) {
    f.box(P.teal, s * (w / 2 - 0.14), 0.06, 0.03, 0.26, 0.42, d - 0.1);
    f.cyl(P.teal, s * (w / 2 - 0.13), 0.5, 0.03, 0.14, d - 0.1, Math.PI / 2);
  }
  f.box(P.teal, 0, 0.06, vb + 0.13, w - 0.04, 0.66, 0.26);
  f.cyl(P.teal, 0, 0.74, vb + 0.14, 0.15, w - 0.08, 0, Math.PI / 2);
  f.box(P.tealLight, 0, 0.4, 0.08, w - 0.32, 0.13, d - 0.38);
  f.box(P.tealLight, 0, 0.5, vb + 0.32, w - 0.34, 0.3, 0.13, 0, -0.12);
  f.box(P.tealDark, 0, 0.1, d / 2 - 0.02, w - 0.34, 0.26, 0.02);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.cyl(0x2a2018, s * (w / 2 - 0.1), 0, t * (d / 2 - 0.1), 0.025, 0.06, 0, 0, CYL8);
  return f;
}

// The coffee table: wood, a remote and a magazine on it
export function coffeeTable(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  f.box(P.table, 0, h - 0.05, 0, w, 0.05, d).box(P.tableDark, 0, h - 0.11, 0, w - 0.08, 0.06, d - 0.08);
  for (const a of [-1, 1]) for (const b of [-1, 1]) f.box(P.tableDark, a * (w / 2 - 0.06), 0, b * (d / 2 - 0.06), 0.05, h - 0.05, 0.05);
  f.box(P.tableDark, 0, 0.1, 0, w - 0.14, 0.025, d - 0.12);
  f.box(0x2a2a2e, -0.25, h, 0.05, 0.05, 0.02, 0.17, 0.4).box(0xf2d23c, 0.25, h, -0.02, 0.22, 0.012, 0.28, -0.15).box(0xd8452f, 0.27, h + 0.012, -0.02, 0.2, 0.004, 0.12, -0.15);
  return f;
}

// A bookcase: shelves of books in `books` colours, with ornaments now and then
export function bookcase(R, it, { wood = P.shelfWood, books = BOOKS_LIVING, seed = 5, levels = 5, gaps = 0.14, toys = null } = {}) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  const r = rng(seed);
  const inner = new THREE.Color(wood).multiplyScalar(0.7);
  f.box(inner, 0, 0, -d / 2 + 0.01, w, h, 0.02);
  for (const s of [-1, 1]) f.box(wood, s * (w / 2 - 0.02), 0, 0, 0.04, h, d);
  f.box(wood, 0, h - 0.04, 0.01, w + 0.04, 0.04, d + 0.02).box(wood, 0, 0, 0, w, 0.07, d);
  const step = (h - 0.11) / levels;
  for (let i = 1; i < levels; i++) f.box(wood, 0, 0.07 + i * step - 0.025, 0, w - 0.06, 0.025, d - 0.02);
  for (let i = 0; i < levels; i++) {
    const y0 = 0.07 + i * step;
    if (toys?.[i]) {
      toys[i](f, y0, step);
      continue;
    }
    let u = -w / 2 + 0.07;
    while (u < w / 2 - 0.1) {
      if (r() < gaps) {
        if (r() < 0.5) f.ball([0x5ab0c8, 0xd8b25a, 0xe08a9a, 0xf4f0e6][Math.floor(r() * 4)], u + 0.07, y0 + 0.07, 0, 0.065);
        u += 0.17;
        continue;
      }
      const bw = 0.03 + r() * 0.035;
      const bh = Math.min(step - 0.06, 0.18 + r() * 0.1);
      f.box(books[Math.floor(r() * books.length)], u + bw / 2, y0, 0.02, bw, bh, d - 0.12, 0, 0, r() < 0.07 ? 0.18 : 0);
      u += bw + 0.004;
    }
  }
  return f;
}
const BOOKS_LIVING = [0x4a6a3a, 0x7a4a2a, 0xc8b07a, 0x3a5a6a, 0x8a3a2a, 0xd8c890, 0x5a7a4a, 0x9a8a5a];
export const BOOKS_MORTY = [0xb8342a, 0x2f6fb0, 0x3f8f3a, 0xe8c45a, 0x6b3a7a, 0xe8e3d6, 0x2b2b30, 0xd87a2a];

// A potted plant: a pot and a spray of leaves
export function plant(f, u, y, v, { pot = 0x3a6aa0, s = 1 } = {}) {
  f.part(lathe([[0, 0], [0.07 * s, 0], [0.09 * s, 0.16 * s], [0.095 * s, 0.17 * s]], 12), pot, u, y, v, 0);
  for (let i = 0; i < 7; i++) f.part(LEAF, 0x4f9c3c, u + Math.cos(i * 2.4) * 0.03 * s, y + 0.3 * s, v + Math.sin(i * 2.4) * 0.03 * s, i * 0.9, s, s, s, Math.cos(i * 1.7) * 0.45, Math.sin(i * 1.3) * 0.45);
  for (let i = 0; i < 5; i++) f.ball(0x6ab84a, u + Math.cos(i * 1.3) * 0.12 * s, y + (0.42 + (i % 3) * 0.08) * s, v + Math.sin(i * 1.3) * 0.12 * s, 0.035 * s, 1, BALL8);
}
const LEAF = new THREE.ConeGeometry(0.045, 0.34, 5);

// Snuffles' bed: a red ring round a cushion, low on the floor
export function dogBed(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  f.part(TORUS_BED, P.dogBed, 0, h * 0.55, 0, 0, w / 0.9, d / 0.9, (h * 1.1) / 0.24, Math.PI / 2);
  f.part(CYL, P.dogBedIn, 0, 0.07, 0, 0, w * 0.66, 0.08, d * 0.66).part(CYL, P.dogBed, 0, 0.02, 0, 0, w * 0.92, 0.04, d * 0.92);
  return f;
}
const TORUS_BED = new THREE.TorusGeometry(0.33, 0.12, 8, 22);

// ── the dining room ──

// The dining table under a yellow-green checked cloth that hangs over its
// edges; its legs below
export function diningTable(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  for (const a of [-1, 1]) for (const b of [-1, 1]) f.box(P.chairWood, a * (w / 2 - 0.12), 0, b * (d / 2 - 0.12), 0.07, h - 0.3, 0.07);
  const drop = 0.32;
  const ow = w + 0.04;
  const od = d + 0.04;
  f.box(P.cloth, 0, h - 0.02, 0, ow, 0.03, od);
  f.box(P.cloth, 0, h - drop, od / 2 - 0.01, ow, drop, 0.02, 0, -0.06).box(P.cloth, 0, h - drop, -od / 2 + 0.01, ow, drop, 0.02, 0, 0.06);
  f.box(P.cloth, ow / 2 - 0.01, h - drop, 0, 0.02, drop, od, 0, 0, 0.06).box(P.cloth, -ow / 2 + 0.01, h - drop, 0, 0.02, drop, od, 0, 0, -0.06);
  // the checks
  f.decal('cloth-top', 0, h + 0.012, 0, ow, od, { rx: -Math.PI / 2 });
  f.decal('cloth-side', 0, h - drop / 2, od / 2 + 0.002, ow, drop, { rx: -0.06 });
  f.decal('cloth-side', 0, h - drop / 2, -od / 2 - 0.002, ow, drop, { ry: Math.PI, rx: -0.06 });
  f.decal('cloth-end', ow / 2 + 0.002, h - drop / 2, 0, od, drop, { ry: Math.PI / 2, rx: -0.06 });
  f.decal('cloth-end', -ow / 2 - 0.002, h - drop / 2, 0, od, drop, { ry: -Math.PI / 2, rx: -0.06 });
  // a little vase of flowers at the far end
  f.part(lathe([[0.04, 0], [0.05, 0.06], [0.025, 0.14], [0.03, 0.16]], 10), 0x8fc4d4, -w / 2 + 0.45, h + 0.012, 0, 0);
  for (let i = 0; i < 4; i++) f.ball([0xf2d23c, 0xe0402a, 0xf4f0e6, 0xf2d23c][i], -w / 2 + 0.45 + Math.cos(i * 1.6) * 0.05, h + 0.24 + (i % 2) * 0.04, Math.sin(i * 1.6) * 0.05, 0.035, 1, BALL8);
  return f;
}

// ── the entry ──

// The grandfather clock: dark wood, its face in the hood, a pendulum
// swinging behind the trunk's door. Returns its tick.
export function clock(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  const vb = -d / 2;
  f.box(P.clockDark, 0, 0, 0, w, 0.08, d).box(P.clock, 0, 0.08, 0, w - 0.04, 0.32, d - 0.04).box(P.clockDark, 0, 0.4, 0, w, 0.05, d);
  // the trunk: its back, sides and a door frame open in the middle
  const tw = w - 0.12;
  f.box(P.clockDark, 0, 0.45, vb + 0.04, tw, 1.0, 0.04);
  for (const s of [-1, 1]) f.box(P.clock, s * (tw / 2 - 0.03), 0.45, 0, 0.06, 1.0, d - 0.08);
  for (const s of [-1, 1]) f.box(P.clock, s * (tw / 2 - 0.06), 0.45, d / 2 - 0.06, 0.06, 1.0, 0.03);
  f.box(P.clock, 0, 0.45, d / 2 - 0.06, tw, 0.08, 0.03).box(P.clock, 0, 1.37, d / 2 - 0.06, tw, 0.08, 0.03);
  f.box(P.clockDark, 0, 1.45, 0, w, 0.05, d);
  // the hood and its face, the pediment and its finials
  f.box(P.clock, 0, 1.5, -0.01, w - 0.04, 0.46, d - 0.06);
  f.decal('clockface', 0, 1.73, d / 2 - 0.03 + 0.001, 0.36, 0.36);
  f.box(P.clockDark, 0, 1.96, 0, w + 0.02, 0.05, d + 0.02);
  f.part(PEDIMENT, P.clock, 0, 2.01, 0, 0, w * 0.86, d - 0.08, 0.14, -Math.PI / 2, 0);
  for (const s of [-1, 0, 1]) f.ball(P.brass, s * (w / 2 - 0.05), s ? 2.04 : h - 0.02, 0, 0.025, 1, BALL8);
  // the pendulum: its own mesh, so it can swing
  const pend = new THREE.Group();
  const parts = [];
  const pf = R.frame(0, 0, 0, { list: parts });
  pf.box(P.brass, 0, -0.75, 0, 0.012, 0.75, 0.008).cyl(P.brass, 0, -0.85, 0, 0.075, 0.016, Math.PI / 2);
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  pend.add(mesh);
  const base = f.mat(0, 1.38, vb + 0.08);
  pend.position.setFromMatrixPosition(base);
  pend.quaternion.setFromRotationMatrix(base);
  R.group.add(pend);
  return (t) => {
    mesh.rotation.z = Math.sin(t * Math.PI * 0.9) * 0.14;
  };
}
const PEDIMENT = new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1, false, -Math.PI / 2, Math.PI);

// A wall sconce: a brass bracket and a white drum shade, lit
export function sconce(f, u, y, v = 0) {
  f.box(P.brass, u, y - 0.08, v + 0.01, 0.08, 0.16, 0.02).cbox(P.brass, u, y, v + 0.08, 0.02, 0.02, 0.14);
  f.cyl(P.brass, u, y, v + 0.16, 0.012, 0.06);
  f.part(SCONCE_SHADE, 0xf8f1de, u, y + 0.02, v + 0.16, 0);
  f.glow(CYL, 0xfff0c4, 2.0, u, y + 0.02, v + 0.16, 0, 0.19, 0.01, 0.19);
  f.glow(CYL, 0xfff6dc, 1.4, u, y + 0.2, v + 0.16, 0, 0.15, 0.01, 0.15);
}
const SCONCE_SHADE = lathe([[0.1, 0], [0.1, 0.02], [0.08, 0.19]], 18);

// ── Morty's room ──

// Morty's bed: the headboard against the wall, a beige spread hanging over
// its sides, the pillow
export function mortyBed(R, it) {
  const f = frameOf(R, it);
  const { w, d } = it;
  const vb = -d / 2;
  f.box(P.bedWood, 0, 0.08, 0, w, 0.16, d);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(P.bedWood, s * (w / 2 - 0.05), 0, t * (d / 2 - 0.05), 0.07, 0.1, 0.07);
  f.box(0xf4f0e6, 0, 0.24, 0.02, w - 0.06, 0.2, d - 0.1);
  // the spread: over the top and down the sides and the foot
  f.box(P.spread, 0, 0.42, 0.12, w + 0.02, 0.05, d - 0.3);
  for (const s of [-1, 1]) f.box(P.spread, s * (w / 2 + 0.005), 0.14, 0.12, 0.02, 0.32, d - 0.3);
  f.box(P.spread, 0, 0.14, d / 2 - 0.02, w + 0.03, 0.33, 0.02);
  f.box(new THREE.Color(P.spread).multiplyScalar(0.94), 0, 0.465, vb + 0.4, w + 0.03, 0.03, 0.1, 0, 0.1);
  f.box(P.pillow, 0, 0.47, vb + 0.24, w - 0.24, 0.14, 0.34, 0, 0.25);
  // the headboard
  f.box(P.headboard, 0, 0, vb + 0.03, w + 0.06, 1.0, 0.06).box(P.bedWood, 0, 0.98, vb + 0.03, w + 0.1, 0.05, 0.08);
  f.box(new THREE.Color(P.headboard).multiplyScalar(0.86), 0, 0.6, vb + 0.065, w - 0.2, 0.3, 0.012);
  // socks on the floor beside it
  f.box(0xd6dade, w / 2 + 0.25, 0, 0.3, 0.08, 0.02, 0.2, 0.6).box(0xd6dade, w / 2 + 0.4, 0, -0.1, 0.08, 0.02, 0.18, -0.3);
  return f;
}

// Morty's nightstand: blue, a pink drawer, the red lamp and a little elephant
export function nightstand(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  f.box(P.nightstand, 0, 0.04, 0, w, h - 0.07, d - 0.02).box(new THREE.Color(P.nightstand).multiplyScalar(0.8), 0, 0, 0, w - 0.06, 0.04, d - 0.06);
  f.box(P.nightstand, 0, h - 0.03, 0, w + 0.03, 0.03, d + 0.01);
  f.box(P.drawerPink, 0, h - 0.2, d / 2, w - 0.08, 0.14, 0.02).ball(0xe8e3d6, 0, h - 0.13, d / 2 + 0.015, 0.018, 1, BALL8);
  f.box(new THREE.Color(P.nightstand).multiplyScalar(0.55), 0, 0.1, d / 2 - 0.03, w - 0.08, 0.22, 0.01);
  f.box(0x3f8f3a, -0.08, 0.1, 0.05, 0.22, 0.04, 0.16, 0.1);
  // the lamp: a slim stand, a red pleated shade, lit
  f.cyl(0x8a5a34, -0.08, h, -0.06, 0.07, 0.02).cyl(0x8a5a34, -0.08, h + 0.02, -0.06, 0.012, 0.36);
  f.part(LAMP_SHADE, P.lampRed, -0.08, h + 0.28, -0.06, 0, 1.35, 1.3, 1.35);
  f.glow(CYL, 0xffd8a0, 1.6, -0.08, h + 0.285, -0.06, 0, 0.35, 0.01, 0.35);
  // the elephant
  const e = f.sub(0.13, 0.08, 0.6, h);
  e.base.multiply(new THREE.Matrix4().makeScale(1.45, 1.45, 1.45));
  e.ball(P.elephant, 0, 0.11, 0, 0.09, 0.8).ball(P.elephant, 0.09, 0.15, 0, 0.055);
  e.cyl(P.elephant, 0.14, 0.04, 0, 0.012, 0.11, 0, 0.3);
  for (const s of [-1, 1]) e.cyl(P.elephant, 0.08, 0.16, s * 0.045, 0.04, 0.008, Math.PI / 2, 0);
  for (const a of [-1, 1]) for (const b of [-1, 1]) e.cyl(P.elephant, a * 0.05, 0, b * 0.035, 0.018, 0.07);
  return f;
}
const LAMP_SHADE = lathe([[0.14, 0], [0.13, 0.03], [0.07, 0.19]], 14);

// Morty's desk: red, drawers both sides, papers, a rocket model and a lamp
export function mortyDesk(R, it) {
  const f = frameOf(R, it);
  const { w, d, h } = it;
  f.box(P.desk, 0, h - 0.04, 0, w, 0.04, d);
  for (const s of [-1, 1]) {
    f.box(P.deskDark, s * (w / 2 - 0.2), 0, 0, 0.38, h - 0.04, d - 0.06);
    for (let i = 0; i < 3; i++) f.box(P.desk, s * (w / 2 - 0.2), 0.05 + i * 0.22, d / 2 - 0.02, 0.33, 0.19, 0.02).box(P.brass, s * (w / 2 - 0.2), 0.13 + i * 0.22, d / 2, 0.08, 0.02, 0.02);
  }
  f.box(P.deskDark, 0, h - 0.18, -d / 2 + 0.03, w - 0.8, 0.14, 0.02);
  // papers, a pencil cup, the rocket on its stand, the desk lamp
  f.box(0xf4f0e6, -0.15, h, 0.08, 0.32, 0.006, 0.24, 0.15).box(0xe8e2d0, -0.05, h + 0.006, 0.12, 0.3, 0.006, 0.22, -0.2);
  f.cyl(0x3a6fb0, 0.2, h, 0.15, 0.04, 0.1);
  for (let i = 0; i < 3; i++) f.cyl([0xf2d23c, 0xe0402a, 0x3f8f3a][i], 0.2 + (i - 1) * 0.015, h + 0.08, 0.15, 0.006, 0.12, (i - 1) * 0.2, 0);
  const rk = f.sub(-0.5, 0.1, 0, h);
  rk.cyl(0x6b4426, 0, 0, 0, 0.07, 0.02).cyl(0x9aa3ab, 0, 0.02, 0, 0.008, 0.08);
  rk.cyl(0xf4f0e6, 0, 0.1, 0, 0.035, 0.22).part(new THREE.ConeGeometry(0.035, 0.1, 12), 0xd8362e, 0, 0.37, 0);
  for (let i = 0; i < 3; i++) rk.box(0xd8362e, Math.cos((i * TAU) / 3) * 0.045, 0.1, Math.sin((i * TAU) / 3) * 0.045, 0.05, 0.08, 0.008, -(i * TAU) / 3);
  // the lamp: grey, angled over the papers
  const lu = 0.52;
  f.cyl(0x6a7078, lu, h, -0.22, 0.07, 0.025).cyl(0x6a7078, lu, h + 0.02, -0.22, 0.01, 0.3, -0.25, 0);
  f.part(lathe([[0.03, 0], [0.09, -0.1]], 12), 0x6a7078, lu, h + 0.33, -0.15, 0, 1, 1, 1, 0.4);
  f.glow(BALL, 0xfff2c0, 1.7, lu, h + 0.26, -0.12, 0, 0.05);
  return f;
}

// The shelf on the wall over the bed's head: a robot toy and a gadget with wires
export function wallShelf(f, u, y, v = 0) {
  f.box(0x6a4a3a, u, y, v + 0.11, 0.6, 0.03, 0.22);
  for (const s of [-1, 1]) f.box(0x3a3a3e, u + s * 0.22, y - 0.12, v + 0.02, 0.02, 0.12, 0.03).box(0x3a3a3e, u + s * 0.22, y - 0.03, v + 0.1, 0.02, 0.02, 0.18, 0, -0.7);
  // the robot: blue-violet, arms up
  const ru = u - 0.15;
  f.box(0x5a6ac8, ru, y + 0.03, v + 0.11, 0.1, 0.12, 0.07).box(0x5a6ac8, ru, y + 0.15, v + 0.11, 0.08, 0.07, 0.06).box(0x9dd8ff, ru, y + 0.17, v + 0.142, 0.05, 0.02, 0.003);
  for (const s of [-1, 1]) f.cbox(0x7a8ad8, ru + s * 0.08, y + 0.14, v + 0.11, 0.03, 0.12, 0.03, 0, 0, s * 0.6);
  f.cyl(0x9aa3ab, ru, y + 0.22, v + 0.11, 0.004, 0.06).ball(0xe0402a, ru, y + 0.28, v + 0.11, 0.012, 1, BALL8);
  // the gadget: a grey box, a dial, a green light, wires down the wall
  const gu = u + 0.13;
  f.box(0x8a9096, gu, y + 0.03, v + 0.11, 0.22, 0.12, 0.15).box(0x5a6066, gu, y + 0.15, v + 0.11, 0.14, 0.04, 0.1);
  f.cyl(0x2a2a30, gu - 0.05, y + 0.09, v + 0.19, 0.025, 0.012, Math.PI / 2);
  f.glow(BALL, 0x9dff5a, 2.2, gu + 0.06, y + 0.1, v + 0.188, 0, 0.018);
  f.part(GADGET_WIRE, 0x2a2a30, gu + 0.08, y, v, 0);
}
const GADGET_WIRE = tube(
  [
    [0, 0.05, 0.1],
    [0.05, -0.05, 0.06],
    [0.02, -0.3, 0.02],
    [0.08, -0.6, 0.015],
  ],
  0.007,
  16,
);

// Morty's green jacket hanging from a hook
export function jacket(f, u, y, v = 0) {
  f.ball(P.brass, u, y + 0.04, v + 0.02, 0.018, 1, BALL8);
  f.ball(P.jacket, u, y - 0.06, v + 0.06, 0.1, 1.1);
  f.box(P.jacket, u, y - 0.72, v + 0.07, 0.36, 0.6, 0.1, 0, 0, 0.04).box(P.jacket, u, y - 0.18, v + 0.065, 0.26, 0.12, 0.09);
  for (const s of [-1, 1]) f.cyl(P.jacket, u + s * 0.17, y - 0.68, v + 0.07, 0.045, 0.5, 0, s * 0.08);
  f.box(new THREE.Color(P.jacket).multiplyScalar(0.8), u, y - 0.72, v + 0.122, 0.02, 0.5, 0.004);
}

// A round ceiling light: a dark band, a frosted dome, lit
export function domeLight(f, u, v, top) {
  f.cyl(0x4a4a50, u, top - 0.06, v, 0.17, 0.06);
  f.glow(DOME, 0xfff6e0, 1.6, u, top - 0.06, v, 0, 1, 1, 1, Math.PI);
}
const DOME = new THREE.SphereGeometry(0.15, 16, 6, 0, TAU, 0, Math.PI / 2);

// A door standing open against a wall: slab, panels, its knob at u = 0 end,
// the hinge at u = w
export function openDoor(f, w, { color = 0x7a5238, h = 2.05 } = {}) {
  f.box(color, w / 2, 0.01, 0, w, h, 0.04);
  const shade = new THREE.Color(color).multiplyScalar(0.84);
  for (const [py, ph] of [
    [0.16, 0.78],
    [1.08, 0.78],
  ])
    for (const s of [-1, 1]) f.box(shade, w / 2 + s * w * 0.22, py, 0.022, w * 0.32, ph, 0.01);
  f.ball(P.brass, 0.08, 0.98, 0.035, 0.03, 1, BALL8);
  return f;
}

