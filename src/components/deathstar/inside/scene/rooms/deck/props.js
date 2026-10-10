// What stands on the first Death Star’s officers’ deck, drawn about each
// thing’s foot as rules/furnish.js puts it (x across, +z its front, y up),
// each inside the footprint and height it is given, so what you see is
// what you bump into: the conference room’s round black table with its lit
// rim and the holo-disc in the middle, and its chairs; the overbridge’s
// tulip stations (a stem flaring to a cup with the operator’s console in
// it), the great window’s mullions and the pentagon screen; fire control’s
// master console and its banks of green buttons; the archive’s stacks of
// data tapes, the librarian’s desk, the security feed and the terminal
// that keeps the plans; and Vader’s meditation pod (inspired: its jaw
// open on the seat). The detention level’s camera is shared.
//
//   DECK_PROPS: { table, chair, tulip, 'window-frame', 'pentagon-screen', 'fire-console', 'button-bank',
//     desk, feed, terminal, stacks, 'meditation-pod', camera }   (prop) → local parts
//   Parts naming 'green' take the room’s own green light (finish’s `own`).

import * as THREE from 'three';
import { DETENTION_PROPS } from '../deep/detention';
import { box, cyl, plate, slope, wedge } from '../deep/parts';

const LIFT = 0.004; // a face laid on another stands this proud of it

function table({ w, h }) {
  const r = w / 2;
  return [
    cyl(0.55, 0.7, 0.08, 0, 0.04, 0, 'black', { sides: 32 }),
    cyl(0.42, 0.42, h - 0.14, 0, (h - 0.14) / 2 + 0.06, 0, 'trim', { sides: 32 }),
    cyl(r, r, 0.07, 0, h - 0.035, 0, 'black', { sides: 64 }),
    // the light under the rim, and the holo-disc let into the middle
    cyl(r - 0.06, r - 0.06, 0.025, 0, h - 0.085, 0, 'strip', { sides: 64 }),
    cyl(0.6, 0.6, 0.006, 0, h + 0.003, 0, 'screen', { sides: 40 }),
    cyl(0.66, 0.66, 0.004, 0, h + 0.002, 0, 'rail', { sides: 40 }),
  ];
}

function chair({ w, d, h }) {
  const seat = 0.46;
  return [
    cyl(0.22, 0.26, 0.04, 0, 0.02, 0, 'black', { sides: 20 }),
    cyl(0.05, 0.05, seat - 0.08, 0, seat / 2, 0, 'rail', { sides: 10 }),
    box(w - 0.08, 0.08, d - 0.12, 0, seat, 0.02, 'black'),
    box(w - 0.08, h - seat - 0.04, 0.07, 0, (seat + h) / 2, -d / 2 + 0.06, 'black'),
    box(w - 0.16, 0.02, 0.02, 0, h - 0.06, -d / 2 + 0.1, 'trim'),
  ];
}

// a stem flaring up to a cup, the operator’s console set in its top, leaning towards them (+z)
function tulip({ w, h }) {
  const r = w / 2;
  const cup = 0.34;
  return [
    cyl(r * 0.62, r * 0.7, 0.06, 0, 0.03, 0, 'black', { sides: 20 }),
    cyl(0.1, 0.15, h - cup - 0.06, 0, (h - cup + 0.06) / 2, 0, 'trim', { sides: 14 }),
    cyl(r, 0.16, cup, 0, h - cup / 2, 0, 'trim', { sides: 20 }),
    slope(r * 1.1, r * 0.95, 0.1, 0, h + LIFT - 0.06, 0.02, 'console'),
    plate(r * 0.7, 0.16, 0, h - cup / 2, r * 0.62, 'screen'),
    box(0.04, 0.03, 0.01, r * 0.45, h - cup + 0.06, r * 0.5, 'red'),
  ];
}

// the great window’s mullions and sills, the glass between them the builder’s
function windowFrame({ w, d, h }) {
  const parts = [box(w, 0.32, d, 0, 0.16, 0, 'trim'), box(w, 0.26, d, 0, h - 0.13, 0, 'trim'), box(w - 0.4, 0.04, 0.03, 0, 0.34, d / 2 - 0.02, 'strip')];
  const n = Math.max(1, Math.round(w / 3));
  for (let i = 0; i <= n; i++) parts.push(box(i === 0 || i === n ? 0.3 : 0.16, h, d, -w / 2 + (w * i) / n + (i === 0 ? 0.15 : i === n ? -0.15 : 0), h / 2, 0, 'trim'));
  return parts;
}

// a flat five-sided disc of radius r facing +z, a point up
const pentagon = (r, depth, y, z, mat) => ({ geo: new THREE.CylinderGeometry(r, r, depth, 5).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(0, y, z), mat });

// (a pentagon of circumradius r is 2r·sin 72° wide and r(1 + cos 36°) tall, its middle cos 36° r over its foot)
function pentagonScreen({ w, d, h }) {
  const [k, c] = [2 * Math.sin((2 * Math.PI) / 5), Math.cos(Math.PI / 5)];
  const r = Math.min(w / k, h / (1 + c)) - 0.02;
  const y = (h - r * (1 + c)) / 2 + r * c;
  return [pentagon(r, d * 0.6, y, -d * 0.2, 'trim'), pentagon(r - 0.12, 0.01, y, d * 0.1 + LIFT, 'screen'), pentagon(r - 0.06, 0.02, y, d * 0.1 - 0.005, 'black')];
}

// A long console standing free: a plinth, the body, a top sloping up away from whoever works it (+z),
// a row of lit keys along it and `face` (parts about the slope’s middle) set in it.
function counter(w, d, h, face = []) {
  const [hi, lo] = [Math.min(0.2, h * 0.18), 0.03];
  const body = h - hi;
  return [
    box(w - 0.08, 0.1, d - 0.08, 0, 0.05, 0, 'black'),
    box(w - 0.02, body - 0.1, d - 0.02, 0, (body + 0.1) / 2, 0, 'trim'),
    wedge(w - 0.02, d - 0.02, hi, lo, 0, body, 0, 'trim'),
    slope(w - 0.1, Math.hypot(d - 0.06, hi - lo), hi - lo, 0, body + (hi + lo) / 2 + LIFT, 0, 'console'),
    box(w - 0.1, 0.03, 0.008, 0, body - 0.08, d / 2 - 0.006, 'strip'),
    ...face.map((p) => ({ geo: p.geo.clone().translate(0, body + (hi + lo) / 2 + 2 * LIFT, 0), mat: p.mat })),
  ];
}

function keysAcross(w, n, mat, z = 0.06) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(box(0.07, 0.02, 0.05, ((i + 0.5) / n - 0.5) * (w - 0.3), 0.01, z, mat));
  return out;
}

const fireConsole = ({ w, d, h }) => counter(w, d, h, [...keysAcross(w, 14, 'green'), ...keysAcross(w, 5, 'red', -0.08)]);

// a bank against its wall (its back at −z): green keys in rows up its face over a black plinth
function buttonBank({ w, d = 0.4, h }) {
  const parts = [box(w - 0.02, h, d - 0.02, 0, h / 2, 0, 'trim'), box(w - 0.06, 0.1, d, 0, 0.05, 0, 'black'), plate(w - 0.2, h - 0.6, 0, h / 2 + 0.15, d / 2 - 0.01 + LIFT, 'black')];
  const [cols, rows] = [Math.max(2, Math.floor((w - 0.3) / 0.16)), Math.max(2, Math.floor((h - 0.8) / 0.14))];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mat = (r * 7 + c * 3) % 11 === 0 ? 'red' : 'green';
      parts.push(box(0.08, 0.05, 0.02, ((c + 0.5) / cols - 0.5) * (w - 0.34), 0.62 + (r + 0.5) * ((h - 0.9) / rows), d / 2 - 0.004, mat));
    }
  }
  return parts;
}

function desk({ w, d, h }) {
  return [
    box(w, 0.05, d, 0, h - 0.025, 0, 'black'),
    box(0.06, h - 0.05, d - 0.06, -w / 2 + 0.05, (h - 0.05) / 2, 0, 'trim'),
    box(0.06, h - 0.05, d - 0.06, w / 2 - 0.05, (h - 0.05) / 2, 0, 'trim'),
    box(w - 0.1, h * 0.5, 0.03, 0, h * 0.55, -d / 2 + 0.03, 'trim'),
    // (its keys and readout are let into the top, which is as high as it stands)
    plate(0.42, 0.24, -w * 0.2, h + LIFT, 0, 'console', 'up'),
    plate(0.5, 0.3, w * 0.2, h + LIFT, -0.02, 'screen', 'up'),
  ];
}

const feed = ({ w, d, h }) => [box(w, h, d, 0, h / 2, 0, 'trim'), plate(w - 0.08, h - 0.08, 0, h / 2, d / 2 + LIFT, 'screen')];

function terminal({ w, d, h }) {
  return [
    box(w - 0.02, h - 0.4, d - 0.02, 0, (h - 0.4) / 2, -0.0, 'trim'),
    box(w - 0.06, 0.1, d, 0, 0.05, 0, 'black'),
    wedge(w - 0.02, d - 0.02, 0.4, 0.06, 0, h - 0.4, 0, 'trim'),
    slope(w - 0.12, Math.hypot(d - 0.06, 0.34), 0.34, 0, h - 0.4 + 0.23 + LIFT, 0, 'screen'),
    box(w - 0.12, 0.03, 0.008, 0, h - 0.5, d / 2 - 0.006, 'strip'),
  ];
}

// shelves of data tapes, open both sides: posts, a shelf every half metre, the tapes’ ribbed faces
function stacks({ w, d, h }) {
  const parts = [];
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) parts.push(box(0.08, h, d, x, h / 2, 0, 'trim'));
  const n = Math.max(1, Math.floor((h - 0.2) / 0.5));
  for (let i = 0; i <= n; i++) parts.push(box(w - 0.08, 0.03, d, 0, 0.1 + (i * (h - 0.25)) / n, 0, 'trim'));
  for (let i = 0; i < n; i++) {
    const y = 0.1 + ((i + 0.5) * (h - 0.25)) / n;
    const tall = (h - 0.25) / n - 0.1;
    parts.push(box(w - 0.2, tall, d - 0.12, 0, y, 0, 'black'));
    for (const s of [-1, 1]) parts.push(plate(w - 0.24, tall - 0.04, 0, y, s * (d / 2 - 0.06 + LIFT), 'grate', s > 0 ? 'front' : 'back'));
  }
  parts.push(box(w - 0.1, 0.02, 0.02, 0, h - 0.02, d / 2 - 0.02, 'strip'), box(w - 0.1, 0.02, 0.02, 0, h - 0.02, -d / 2 + 0.02, 'strip'));
  return parts;
}

// Vader’s pod, as the station’s own is imagined: a round black plinth, the seat, and the upper shell
// lifted back on its hinge like a jaw, open to the front (+z)
function pod({ w, h }) {
  const r = w / 2;
  const shell = new THREE.SphereGeometry(r - 0.25, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-0.35).translate(0, h * 0.42, -0.15);
  return [
    cyl(r, r, 0.4, 0, 0.2, 0, 'black', { sides: 40 }),
    cyl(r - 0.12, r - 0.12, 0.02, 0, 0.41, 0, 'strip', { sides: 40 }),
    cyl(r - 0.1, r - 0.1, 0.5, 0, 0.65, 0, 'trim', { sides: 40 }),
    box(0.7, 0.45, 0.6, 0, 0.9 + 0.225, -0.1, 'black'),
    box(0.7, 0.9, 0.12, 0, 1.12 + 0.45, -0.42, 'black'),
    { geo: shell, mat: 'black' },
  ];
}

export const DECK_PROPS = {
  table,
  chair,
  tulip,
  'window-frame': windowFrame,
  'pentagon-screen': pentagonScreen,
  'fire-console': fireConsole,
  'button-bank': buttonBank,
  desk,
  feed,
  terminal,
  stacks,
  'meditation-pod': pod,
  camera: DETENTION_PROPS.camera,
};
