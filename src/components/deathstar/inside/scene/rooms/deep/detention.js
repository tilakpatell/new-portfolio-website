// Detention Block AA-23’s control room, as A New Hope has it: the officer’s
// horseshoe of consoles in the middle of a glossy black deck, open behind
// him, its sloped faces thick with buttons and readouts; banks of consoles
// along the bare walls; the intercom he answers (“We had a slight weapons
// malfunction…”); the security cameras high in the corners; grey walls in
// tight ribbed bays; and hard white light panels overhead. Everything
// stands where rules/furnish.js puts it, as big as it says.
//
//   DETENTION_PROPS: { horseshoe, camera, intercom, console }   (prop) → parts about its foot (parts.js’ onProp)
//   buildDetention(kit, room, layout, { renderer }) → { group, lamps, update(t), dispose() }

import { furnish } from '../../../rules/furnish';
import { box, cyl, drawWith, finish, onProp, place, at, plate, slope, wedge } from './parts';

const COOL = 0xdfe8ff;
const WALL = { bay: 1.4, rib: 0.22, ribDepth: 0.12, lights: true, tall: 1.1, kick: 0.3, band: 0.42 };
const ARM = 0.45; // how deep each run of the horseshoe is (furnish.js’ solids for it)
const DESK = 0.82; // the height of a desk’s top, where its sloped face begins
const LIFT = 0.004; // a face laid on another stands this proud of it

// One run of the horseshoe, len long and ARM deep, its officer’s side
// towards +z: a black plinth, the body, a top sloping up away from him
// with a face of buttons and screens set in it, and a light band round
// the outside, as the film’s counter has.
function counter(len, h) {
  const [hi, lo] = [h - 0.9, 0.04];
  const run = Math.hypot(ARM, hi - lo);
  const parts = [
    box(len - 0.1, 0.1, ARM - 0.1, 0, 0.05, 0, 'black'),
    box(len - 0.02, 0.8, ARM - 0.04, 0, 0.5, 0, 'trim'),
    wedge(len, ARM, hi, lo, 0, 0.9, 0, 'trim'),
    slope(len - 0.12, run - 0.06, hi - lo, 0, 0.9 + (hi + lo) / 2 + LIFT, 0, 'console'),
    box(len - 0.12, 0.03, 0.008, 0, 0.78, -(ARM - 0.04) / 2 - 0.004, 'strip'),
    box(len - 0.06, 0.03, 0.01, 0, 0.12, -(ARM - 0.04) / 2 - 0.005, 'rail'),
  ];
  // grey panels down the outside under the band, a metal lip along the top’s outer edge
  const out = -(ARM - 0.04) / 2;
  const m = Math.max(1, Math.round(len / 0.6));
  for (let i = 0; i < m; i++) parts.push(box(len / m - 0.05, 0.56, 0.012, ((i + 0.5) / m - 0.5) * len, 0.44, out - 0.006, 'wall'));
  parts.push(box(len, 0.025, 0.02, 0, h - 0.0125, -ARM / 2 + 0.01, 'rail'));
  // readouts in the slope, a red light or two on the outside
  const n = Math.max(1, Math.floor(len / 0.7));
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n - 0.5) * (len - 0.3);
    parts.push(slope(0.3, 0.2, ((hi - lo) * 0.2) / ARM, x, 0.9 + (hi + lo) / 2 + 2.5 * LIFT, -0.02, 'screen'));
    if (i % 2 === 0) parts.push(box(0.05, 0.03, 0.01, x + 0.2, 0.86, -(ARM - 0.04) / 2 - 0.005, 'red'));
  }
  return parts;
}

// The horseshoe: its front run across the far side from the officer’s
// place, its arms back either side of it; the officer stands in the open
// end, a little behind its middle (furnish.js: 0.125 m), facing the front.
function horseshoe(p) {
  const { w, d, h } = p;
  return [
    ...place(counter(w, h), at(0, 0, d / 2 - ARM / 2, Math.PI)),
    ...place(counter(d - ARM, h), at(-w / 2 + ARM / 2, 0, -ARM / 2, Math.PI / 2)),
    ...place(counter(d - ARM, h), at(w / 2 - ARM / 2, 0, -ARM / 2, -Math.PI / 2)),
  ];
}

// A desk against a wall (its back at −z): a plinth, the body, a face of
// buttons leaning back to an upright that runs to the full height, and
// the upright’s own face (`face`, parts about its front middle, y up from the desk).
function desk(w, d, h, face) {
  const up = 0.14;
  const front = -d / 2 + up;
  const run = d / 2 - 0.01 - front;
  const [hi, lo] = [0.13, 0.02];
  return [
    box(w - 0.06, 0.1, d - 0.08, 0, 0.05, -0.02, 'black'),
    box(w - 0.02, DESK - 0.1, d - 0.02, 0, (DESK + 0.1) / 2, 0, 'trim'),
    box(w - 0.02, h - DESK, up, 0, (DESK + h) / 2, -d / 2 + up / 2, 'trim'),
    wedge(w - 0.02, run, hi, lo, 0, DESK, front + run / 2, 'trim'),
    slope(w - 0.1, Math.hypot(run, hi - lo) - 0.03, hi - lo, 0, DESK + (hi + lo) / 2 + LIFT, front + run / 2, 'console'),
    box(w - 0.1, 0.02, 0.006, 0, h - 0.05, front + 0.003, 'strip'),
    ...place(face, at(0, DESK, front + LIFT)),
  ];
}

// a bank’s console: two readouts in its upright
const bank = (p) => desk(p.w, p.d, p.h, [plate(p.w * 0.36, 0.22, -p.w * 0.22, 0.2, 0, 'screen'), plate(p.w * 0.36, 0.22, p.w * 0.22, 0.2, 0, 'screen')]);

// the intercom: a speaker’s grille, a readout, a handset and its call lights
function intercom(p) {
  const { w, d, h } = p;
  return desk(w, d, h, [
    plate(0.34, 0.24, -w * 0.25, 0.2, 0, 'black'),
    plate(0.3, 0.2, -w * 0.25, 0.2, 0.003, 'grate'),
    plate(0.3, 0.18, w * 0.12, 0.22, 0, 'screen'),
    box(0.07, 0.24, 0.05, w * 0.36, 0.2, 0.025, 'black'),
    box(0.05, 0.05, 0.012, w * 0.36, 0.37, 0.006, 'red'),
    box(0.05, 0.03, 0.01, -w * 0.25, 0.36, 0.005, 'strip'),
  ]);
}

// A camera on its block, looking along +z, a little down: body, hood, lens and its red light.
function camera(p) {
  const [w, h] = [Math.min(0.16, p.w - 0.04), p.h];
  return [
    box(w, 0.14, p.d - 0.1, 0, h - 0.17, 0.03, 'trim'),
    box(w + 0.02, 0.02, p.d - 0.08, 0, h - 0.09, 0.02, 'black'),
    cyl(0.05, 0.05, 0.03, 0, h - 0.18, p.d / 2 - 0.015, 'black', { axis: 'z', sides: 16 }),
    box(0.025, 0.025, 0.01, w / 2 - 0.02, h - 0.13, p.d / 2 - 0.02, 'red'),
    box(0.06, 0.08, 0.06, 0, h - 0.04, -p.d / 2 + 0.08, 'rail'),
  ];
}

export const DETENTION_PROPS = { horseshoe, camera, intercom, console: bank };

export function buildDetention(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = kit.shell(room, layout, { ...WALL, seed: 2187 });
  const top = room.y + room.h;
  const b = room.box;
  for (const p of props) parts.push(...drawWith(DETENTION_PROPS, p));
  // each camera hangs from the ceiling on a rod
  for (const p of props.filter((q) => q.kind === 'camera')) {
    const len = top - (p.y + p.h);
    if (len > 0.01) parts.push(...onProp(p, [cyl(0.02, 0.02, len, 0, p.h + len / 2, -p.d / 2 + 0.08, 'rail')]));
  }
  // the hard white panels overhead, each in a deep frame, three by two
  const [w, d] = [b.x1 - b.x0, b.z1 - b.z0];
  for (const i of [-1, 0, 1]) {
    for (const j of [-0.5, 0.5]) {
      const [x, z] = [room.x + (i * w) / 3.3, room.z + (j * d) / 2.1];
      parts.push(box(w / 3.6 + 0.3, 0.16, d / 3 + 0.3, x, top - 0.08, z, 'trim'));
      parts.push(plate(w / 3.6, d / 3, x, top - 0.165, z, 'strip', 'down'));
    }
  }
  // a band round the horseshoe, flush in the deck
  const shoe = props.find((p) => p.kind === 'horseshoe');
  if (shoe) {
    const [hw, hd] = [shoe.w / 2 + 0.5, shoe.d / 2 + 0.5];
    const band = [plate(hw * 2, 0.05, 0, 0.003, -hd, 'rail', 'up'), plate(hw * 2, 0.05, 0, 0.003, hd, 'rail', 'up'), plate(0.05, hd * 2, -hw, 0.003, 0, 'rail', 'up'), plate(0.05, hd * 2, hw, 0.003, 0, 'rail', 'up')];
    parts.push(...onProp(shoe, band));
  }
  const lamps = [
    { x: shoe?.x ?? room.x, y: top - 0.4, z: shoe?.z ?? room.z, color: COOL, intensity: 22, distance: 11 },
    { x: b.x1 - 2, y: top - 0.4, z: b.z1 - 2, color: COOL, intensity: 12, distance: 8 },
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: room.x - 2, y: room.y + 1.5, z: room.z } });
}
