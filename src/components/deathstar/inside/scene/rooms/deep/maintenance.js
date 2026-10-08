// Level 6’s maintenance corridors: the station’s back passages, tighter
// and dimmer than its corridors. A grating underfoot over a trough of
// pipes, a cable tray and close beams overhead, pipe runs along both long
// walls under the ceiling, junction boxes, a canister or two, caged amber
// work-lights instead of light grids (one of them failing), and on the
// wall of the first corridor a note about a thermal exhaust port for
// whoever stops to read it. Everything furnish.js puts there stands where
// it says.
//
//   MAINTENANCE_PROPS: { pipes, 'junction-box', sign, canister }   (prop) → parts about its foot
//   buildMaintenance(kit, room, layout, { renderer }) → { group, lamps, update(t), dispose() }

import * as THREE from 'three';
import { roomWalls } from '../../kit';
import { furnish } from '../../../rules/furnish';
import { grimeOf } from './cells';
import { at, box, cyl, drawWith, finish, place, plate } from './parts';

const AMBER = 0xffa24a;
const WORK = { every: 5, y: 2.05 }; // the work-lights along a long wall, and how high
const TROUGH = 0.4; // how deep the pipe trough runs under the grating
const KERB = 0.28; // the solid strip each side of the grating

// ── the drawers ──

// Three pipes along the wall, a flange now and then, held off it by brackets.
function pipes(p) {
  const { w, d, h } = p;
  const back = -d / 2;
  const parts = [
    cyl(0.075, 0.075, w, 0, 0.085, back + 0.085, 'rail', { axis: 'x', sides: 12 }),
    cyl(0.055, 0.055, w, 0, h - 0.08, back + 0.07, 'trim', { axis: 'x', sides: 10 }),
    cyl(0.04, 0.04, w, 0, 0.16, d / 2 - 0.06, 'black', { axis: 'x', sides: 8 }),
  ];
  for (let x = -w / 2 + 0.4; x < w / 2 - 0.2; x += 1.5) parts.push(box(0.05, h, 0.04, x, h / 2, back + 0.02, 'black'), box(0.04, 0.03, d - 0.05, x, 0.012, 0, 'black'));
  for (let x = -w / 2 + 1.2; x < w / 2 - 0.5; x += 3) parts.push(cyl(0.084, 0.084, 0.05, x, 0.085, back + 0.085, 'trim', { axis: 'x', sides: 12 }));
  return parts;
}

// a grey box with its door, a lamp and a conduit up out of its top
function junctionBox(p) {
  const { w, d, h } = p;
  return [
    box(w, h - 0.08, d - 0.02, 0, (h - 0.08) / 2, -0.01, 'trim'),
    box(w - 0.06, h - 0.16, 0.02, 0, (h - 0.08) / 2, d / 2 - 0.01, 'wall'),
    box(0.05, 0.05, 0.02, w / 2 - 0.07, h - 0.16, d / 2 - 0.01, 'amber'),
    cyl(0.025, 0.025, 0.08, -w / 4, h - 0.04, -0.02, 'black', { sides: 8 }),
  ];
}

// a plaque of close lines in a frame, pale enough to be read in the dim
function sign(p) {
  const { w, h, d } = p;
  const z = -d / 2;
  const parts = [box(w, h, 0.012, 0, h / 2, z + 0.006, 'trim'), plate(w - 0.06, h - 0.06, 0, h / 2, z + 0.013, 'paper')];
  const lines = 7;
  for (let i = 0; i < lines; i++) {
    const long = i === 0 ? 0.5 : i === lines - 1 ? 0.35 : 0.82 - ((i * 37) % 5) * 0.06;
    parts.push(box((w - 0.12) * long, 0.012, 0.003, -(w - 0.12) * (1 - long) * 0.5, h - 0.07 - i * ((h - 0.12) / lines), z + 0.016, 'black'));
  }
  return parts;
}

// a gas canister: its body, two bands, its cap and valve
function canister(p) {
  const r = Math.min(p.w, p.d) / 2;
  return [
    cyl(r - 0.03, r - 0.03, p.h * 0.86, 0, (p.h * 0.86) / 2, 0, 'drum', { sides: 18 }),
    cyl(r, r, 0.04, 0, p.h * 0.16, 0, 'rail', { sides: 18 }),
    cyl(r, r, 0.04, 0, p.h * 0.72, 0, 'rail', { sides: 18 }),
    cyl(r * 0.45, r * 0.7, p.h * 0.07, 0, p.h * 0.895, 0, 'trim', { sides: 14 }),
    cyl(0.04, 0.04, p.h * 0.07, 0, p.h * 0.965, 0, 'black', { sides: 8 }),
  ];
}

export const MAINTENANCE_PROPS = { pipes, 'junction-box': junctionBox, sign, canister };

// ── the room ──

// a work-light on its wall bracket, in its cage, its glass lit amber
function workLight() {
  const parts = [box(0.26, 0.08, 0.12, 0, 0, 0.06, 'trim'), box(0.18, 0.1, 0.1, 0, -0.09, 0.1, 'amber')];
  for (const x of [-0.1, 0, 0.1]) parts.push(box(0.012, 0.13, 0.012, x, -0.09, 0.16, 'black'));
  parts.push(box(0.22, 0.012, 0.13, 0, -0.155, 0.1, 'black'));
  return parts;
}

export function buildMaintenance(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const own = {
    wall: grimeOf(kit, 0x50535a),
    amber: new THREE.MeshStandardMaterial({ name: 'ds-amber', color: 0x1a0e04, roughness: 0.4, metalness: 0, emissive: AMBER, emissiveIntensity: 2.2 }),
    paper: new THREE.MeshStandardMaterial({ name: 'ds-paper', color: 0xb9b49e, roughness: 0.9, metalness: 0, emissive: 0x2c2a22, emissiveIntensity: 1 }),
    drum: new THREE.MeshStandardMaterial({ name: 'ds-drum', color: 0x3a3d33, roughness: 0.55, metalness: 0.5 }),
  };
  const parts = kit.shell(room, layout, { floor: false, bay: 1, rib: 0.18, ribDepth: 0.1, tall: 0.9, kick: 0.25, band: 0.35, seed: room.id.length * 41 });
  const long = room.w >= room.d;
  const [len, wide] = long ? [room.w, room.d] : [room.d, room.w];
  const top = room.y + room.h;
  const y = room.y;
  // in the corridor’s own frame (x along it from its middle, z across), then turned into place
  const local = [];
  const grating = wide - 2 * KERB;
  local.push(plate(len, grating, 0, y, 0, 'grate', 'up'), plate(len, grating, 0, y - TROUGH, 0, 'black', 'up'));
  for (const s of [-1, 1]) {
    local.push(box(len, TROUGH, 0.04, 0, y - TROUGH / 2, s * (grating / 2 + 0.02), 'black'), plate(len, KERB, 0, y, s * (wide / 2 - KERB / 2), 'floor', 'up'), box(len, 0.04, 0.06, 0, y - 0.02, s * (grating / 2 + 0.03), 'trim'));
    local.push(cyl(0.09, 0.09, len, 0, y - TROUGH + 0.12, s * grating * 0.22, s < 0 ? 'rail' : 'trim', { axis: 'x', sides: 10 }));
  }
  // close beams across the ceiling and a cable tray down its middle
  for (let x = -len / 2 + 0.8; x < len / 2 - 0.3; x += 1.6) local.push(box(0.2, 0.22, wide, x, top - 0.11, 0, 'trim'));
  local.push(box(len, 0.08, 0.5, 0, top - 0.3, 0, 'black'), box(len, 0.03, 0.06, 0, top - 0.355, 0.2, 'rail'), box(len, 0.03, 0.06, 0, top - 0.355, -0.2, 'rail'));
  parts.push(...place(local, at(room.x, 0, room.z, long ? 0 : Math.PI / 2)));
  for (const p of props) parts.push(...drawWith(MAINTENANCE_PROPS, p));

  // the work-lights along each long wall, clear of its doors, a few metres apart
  const lamps = [];
  for (const run of roomWalls(layout, room.id)) {
    if (run.len < len - 0.5) continue;
    const n = Math.max(1, Math.round(run.len / WORK.every));
    const d = { x: (run.x1 - run.x0) / run.len, z: (run.z1 - run.z0) / run.len };
    for (let i = 0; i < n; i++) {
      const t = ((i + (lamps.length % 2 ? 0.25 : 0.75)) * run.len) / n;
      if (run.holes.some((h) => t > h.x0 - 1 && t < h.x1 + 1)) continue;
      parts.push(...place(workLight(), at(run.x0, run.y0, run.z0, run.angle).multiply(new THREE.Matrix4().makeTranslation(t, WORK.y + 0.3 - (run.y0 - y), 0))));
      lamps.push({ x: run.x0 + d.x * t + run.n.x * 0.45, y: y + WORK.y, z: run.z0 + d.z * t + run.n.z * 0.45, color: AMBER, intensity: 6, distance: 7 });
    }
  }
  // (fewer lamps than lights: every other one lights the corridor; the rest only glow)
  const lit = lamps.filter((_, i) => i % 2 === 0);
  const failing = lit[1] ?? null;
  return finish(kit, room, parts, {
    lamps: lit,
    own,
    renderer,
    probeAt: { x: room.x, y: y + 1.3, z: room.z },
    update(t) {
      // one work-light on its way out, catching and dropping
      if (failing) failing.intensity = Math.sin(t * 23) + Math.sin(t * 7.3) > 1.2 ? 1.2 : 6;
    },
  });
}
