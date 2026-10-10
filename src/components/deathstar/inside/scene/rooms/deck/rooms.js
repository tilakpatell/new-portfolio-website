// The first Death Star’s officers’ deck, room by room (see ../index.js for
// the contract), each drawing what rules/furnish.js puts in it where it
// stands (./props.js): the conference room, Tarkin’s table under a ring of
// light in grey walls; the overbridge, rows of tulip stations up the aisle
// to the great window onto space (the view through it is scene/show.js’s),
// the pentagon screen on the wall to its right; superlaser fire control,
// banked in green buttons round the master console, the beam’s tunnel a
// green ring in the wall it faces; the records archive, aisles of data
// tapes under strip lights, the plans on their terminal; and Vader’s
// meditation chamber (inspired), round and black, his pod lit from below.
//
//   buildConference, buildOverbridge, buildFirecontrol, buildArchive, buildMeditation
//     (kit, room, layout, { renderer }) → { group, lamps, update(t), dispose() }
//   windowRect(room, prop) → { x0, z0, x1, z1, y0, y1 } | null   pure: the hole in its wall a window
//     frame stands in, between its sills, on the wall’s line
//   facedWall(room, at, yaw) → 'north' | 'south' | 'east' | 'west'   pure: the wall someone at `at` facing yaw looks at

import * as THREE from 'three';
import { furnish } from '../../../rules/furnish';
import { box, cyl, drawWith, finish, plate } from '../deep/parts';
import { DECK_PROPS } from './props';

const COOL = 0xdfe8ff;
const GREEN = 0x39ff6a;
const WALL = { bay: 1.6, rib: 0.24, ribDepth: 0.14, tall: 1.3, kick: 0.3, band: 0.45 };
const SILL = 0.32; // the window frame’s sill (props.js)
const HEAD = 0.26; // and its head

const greenMaterial = () => new THREE.MeshStandardMaterial({ color: 0x06200c, emissive: GREEN, emissiveIntensity: 2.2, roughness: 0.4, metalness: 0.1, name: 'ds-green' });

export function windowRect(room, p) {
  const b = room.box;
  const [y0, y1] = [p.y + SILL, p.y + p.h - HEAD];
  const near = (a, v) => Math.abs(a - v) < 0.5;
  if (near(p.z, b.z0) || near(p.z, b.z1)) {
    const z = near(p.z, b.z0) ? b.z0 : b.z1;
    return { x0: p.x - p.w / 2 + 0.3, x1: p.x + p.w / 2 - 0.3, z0: z, z1: z, y0, y1 };
  }
  if (near(p.x, b.x0) || near(p.x, b.x1)) {
    const x = near(p.x, b.x0) ? b.x0 : b.x1;
    return { x0: x, x1: x, z0: p.z - p.w / 2 + 0.3, z1: p.z + p.w / 2 - 0.3, y0, y1 };
  }
  return null;
}

export function facedWall(room, at, yaw) {
  const [dx, dz] = [Math.sin(yaw), -Math.cos(yaw)];
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'east' : 'west';
  return dz > 0 ? 'south' : 'north';
}

// where on a wall its middle is, and the turn that faces a part drawn towards +z out of it into the room
function wallMiddle(room, wall) {
  const b = room.box;
  if (wall === 'north') return { x: room.x, z: b.z0, turn: 0 };
  if (wall === 'south') return { x: room.x, z: b.z1, turn: Math.PI };
  if (wall === 'east') return { x: b.x1, z: room.z, turn: -Math.PI / 2 };
  return { x: b.x0, z: room.z, turn: Math.PI / 2 };
}

// panels of light let into the ceiling, `n` along the room’s length, each in its frame
function ceilingLights(room, n, { wide = 0.9, long = 2.4 } = {}) {
  const top = room.y + room.h;
  const alongX = room.w >= (room.d ?? room.w);
  const len = alongX ? room.w : (room.d ?? room.w);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n - 0.5) * len * 0.82;
    const [x, z] = alongX ? [room.x + t, room.z] : [room.x, room.z + t];
    const [w, d] = alongX ? [long, wide] : [wide, long];
    parts.push(box(w + 0.24, 0.12, d + 0.24, x, top - 0.06, z, 'trim'), plate(w, d, x, top - 0.125, z, 'strip', 'down'));
  }
  return parts;
}

const drawAll = (props, parts) => {
  for (const p of props) parts.push(...drawWith(DECK_PROPS, p));
  return parts;
};

export function buildConference(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = drawAll(props, kit.shell(room, layout, { ...WALL, lights: true, every: 3, seed: 1977 }));
  const table = props.find((p) => p.kind === 'table') ?? { x: room.x, z: room.z, w: 4.6 };
  // the ring of light over the table, and a dark disc of ceiling within it
  const top = room.y + room.h;
  const r = table.w / 2 + 0.4;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    parts.push(box(0.7, 0.04, 0.18, table.x + Math.cos(a) * r, top - 0.05, table.z + Math.sin(a) * r, 'strip'));
  }
  parts.push(cyl(r - 0.2, r - 0.2, 0.06, table.x, top - 0.03, table.z, 'black', { sides: 48 }));
  const lamps = [
    { x: table.x, y: top - 0.3, z: table.z, color: COOL, intensity: 26, distance: 10 },
    { x: room.x, y: top - 0.4, z: room.box.z1 - 1.5, color: COOL, intensity: 8, distance: 8 },
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: table.x + r + 1, y: room.y + 1.4, z: table.z } });
}

export function buildOverbridge(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const frame = props.find((p) => p.kind === 'window-frame');
  const hole = frame ? windowRect(room, frame) : null;
  const parts = drawAll(props, kit.shell(room, layout, { ...WALL, lights: false, openings: hole ? [hole] : [], seed: 1138 }));
  if (hole) {
    // the glass on the wall’s line, the window’s whole width
    const len = Math.hypot(hole.x1 - hole.x0, hole.z1 - hole.z0);
    const glass = new THREE.PlaneGeometry(len, hole.y1 - hole.y0).rotateY(hole.x0 === hole.x1 ? (hole.x0 === room.box.x0 ? Math.PI / 2 : -Math.PI / 2) : hole.z0 === room.box.z1 ? Math.PI : 0);
    glass.translate((hole.x0 + hole.x1) / 2, (hole.y0 + hole.y1) / 2, (hole.z0 + hole.z1) / 2);
    parts.push({ geo: glass, mat: 'glass' });
  }
  parts.push(...ceilingLights(room, 4, { wide: 0.5, long: 3.2 }));
  // a lit strip down each side of the aisle, flush in the deck
  const alongZ = (room.d ?? room.w) >= room.w;
  for (const s of [-1.6, 1.6]) parts.push(alongZ ? plate(0.06, (room.d ?? room.w) - 3, room.x + s, room.y + 0.003, room.z + 1, 'strip', 'up') : plate(room.w - 3, 0.06, room.x, room.y + 0.003, room.z + s, 'strip', 'up'));
  const top = room.y + room.h;
  const lamps = [
    { x: room.x, y: top - 0.6, z: room.z, color: COOL, intensity: 60, distance: 18 },
    { x: room.x - room.w / 4, y: top - 0.6, z: room.z + 3, color: COOL, intensity: 30, distance: 12 },
    { x: room.x + room.w / 4, y: top - 0.6, z: room.z + 3, color: COOL, intensity: 30, distance: 12 },
    { x: room.x, y: room.y + 3, z: hole ? (hole.z0 + room.z) / 2 : room.z, color: 0xbcd0ff, intensity: 24, distance: 12 },
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: room.x, y: room.y + 1.6, z: room.z + 2 } });
}

export function buildFirecontrol(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const green = greenMaterial();
  const parts = drawAll(props, kit.shell(room, layout, { ...WALL, lights: false, seed: 1 }));
  const master = props.find((p) => p.kind === 'fire-console');
  // the beam’s tunnel: a green ring in the wall the master console faces, and its glow within
  const wall = master ? facedWall(room, master, master.yaw + Math.PI) : 'north';
  const m = wallMiddle(room, wall);
  const R = Math.min(room.h / 2 - 0.4, 2.2);
  const y = room.y + room.h / 2;
  const ring = [
    { geo: new THREE.TorusGeometry(R, 0.22, 10, 48).translate(0, y, 0.15), mat: 'trim' },
    { geo: new THREE.TorusGeometry(R - 0.32, 0.06, 8, 48).translate(0, y, 0.2), mat: 'green' },
    { geo: new THREE.CircleGeometry(R - 0.4, 48).translate(0, y, 0.04), mat: 'black' },
    { geo: new THREE.CircleGeometry(R * 0.35, 32).translate(0, y, 0.05), mat: 'green' },
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ring.push(box(0.12, 0.5, 0.18, Math.cos(a) * (R + 0.35), y + Math.sin(a) * (R + 0.35), 0.1, 'rail'));
  }
  parts.push(...ring.map((p) => ({ geo: p.geo.rotateY(m.turn).translate(m.x, 0, m.z), mat: p.mat })));
  parts.push(...ceilingLights(room, 2, { wide: 0.6, long: 2 }));
  const top = room.y + room.h;
  // (the tunnel’s green light stands a little out from its wall)
  const inward = { north: [0, 1.5], south: [0, -1.5], east: [-1.5, 0], west: [1.5, 0] }[wall];
  const lamps = [
    { x: master?.x ?? room.x, y: top - 0.5, z: master?.z ?? room.z, color: COOL, intensity: 14, distance: 9 },
    { x: m.x + inward[0], y, z: m.z + inward[1], color: GREEN, intensity: 18, distance: 9 },
  ];
  return finish(kit, room, parts, { lamps, own: { green }, renderer, probeAt: { x: room.x, y: room.y + 1.5, z: room.z } });
}

export function buildArchive(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = drawAll(props, kit.shell(room, layout, { ...WALL, bay: 1.2, lights: false, seed: 42 }));
  // a strip of light over every aisle between the stacks, and a lamp over the librarian
  parts.push(...ceilingLights(room, 3, { wide: 0.25, long: (room.d ?? room.w) * 0.8 }));
  const desk = props.find((p) => p.kind === 'desk');
  const plans = props.find((p) => p.tag === 'plans');
  const top = room.y + room.h;
  const lamps = [
    { x: room.x, y: top - 0.4, z: room.z - 1.5, color: COOL, intensity: 26, distance: 10 },
    { x: room.x, y: top - 0.4, z: room.z + 2, color: COOL, intensity: 18, distance: 8 },
    { x: desk?.x ?? room.x, y: top - 0.6, z: desk?.z ?? room.z, color: 0xffe2b0, intensity: 10, distance: 5 },
    ...(plans ? [{ x: plans.x, y: plans.y + 1.8, z: plans.z, color: 0x9fd0ff, intensity: 5, distance: 4 }] : []),
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: room.x, y: room.y + 1.4, z: room.z } });
}

export function buildMeditation(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = drawAll(props, kit.shell(room, layout, { ...WALL, bay: 1.1, lights: false, seed: 66 }));
  const pod = props.find((p) => p.kind === 'meditation-pod') ?? { x: room.x, z: room.z, y: room.y, w: 2.8 };
  const r = room.w / 2;
  // a ring of light round the deck’s edge and one round the pod’s foot; a dark dome overhead
  parts.push(cyl(r - 0.35, r - 0.35, 0.01, room.x, room.y + 0.004, room.z, 'black', { sides: 48 }));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    parts.push(box(0.5, 0.012, 0.06, room.x + Math.cos(a) * (r - 0.25), room.y + 0.006, room.z + Math.sin(a) * (r - 0.25), 'red'));
  }
  parts.push(cyl(pod.w / 2 + 0.25, pod.w / 2 + 0.25, 0.012, pod.x, pod.y + 0.006, pod.z, 'strip', { sides: 40 }));
  const top = room.y + room.h;
  const lamps = [
    { x: pod.x, y: pod.y + 0.3, z: pod.z, color: 0xff3a2a, intensity: 8, distance: 6 },
    { x: pod.x, y: top - 0.3, z: pod.z, color: COOL, intensity: 6, distance: 6 },
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: room.x + r * 0.5, y: room.y + 1.4, z: room.z } });
}
