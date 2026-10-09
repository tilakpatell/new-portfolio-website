// The second Death Star’s heights and depths, as Return of the Jedi has
// them (see ../index.js for the contract): the Emperor’s throne room at the
// top of his tower, dark grey and cold, the throne on its dais up a flight
// of steps, the great round window behind it spoked like a wheel, Luke’s
// saber on the armrest, and the open shaft in the floor that drops all the
// way to the reactor; the reactor shaft itself, a long dark well with the
// reactor’s glow far down; the gallery that opens onto it, consoles along
// its walls and no rail at its edge; and the unfinished superstructure,
// walkways over a void, girders standing bare round it, crates on its
// platforms and the reactor chamber glowing far below. Everything stands
// where rules/furnish.js puts it, as big as it says.
//
//   HEIGHT_PROPS: { throne, saber, 'guard-post', 'window-frame', crate, console }   (prop) → local parts
//   roundWindowHole(room) → { x0, z0, x1, z1, y0, y1 } | null   pure: the square hole round a round window
//   buildThrone, buildReactorShaft, buildGallery, buildSuperstructure
//     (kit, room, layout, { renderer }) → { group, lamps, update(t, dt, ctx), dispose() }

import * as THREE from 'three';
import { furnish } from '../../../rules/furnish';
import { DETENTION_PROPS } from '../deep/detention';
import { box, cyl, drawWith, finish, onProp, plate } from '../deep/parts';
import { glowMaterial, hazeOf, lips, slab } from '../shaft/depths';
import { hazeLayers, openEdges } from '../shaft/plan';

const COOL = 0xc8d6ff;
const REACTOR = 0xffd9a0; // the reactor’s light, far down
const SPOKES = 12; // the round window’s
const DEEP = 40; // metres the throne room’s shaft is drawn down before the dark takes it

// ── the things in them ──

// the Emperor’s throne: a plinth, the seat, a tall back flaring at its head, the arms with their panels
function throne({ w, d, h }) {
  const seat = 0.55;
  return [
    box(w, 0.2, d, 0, 0.1, 0, 'black'),
    // (the seat as deep as one sits in, from the back to its edge 0.25 m before the middle: rules/seats.js)
    box(w - 0.3, seat - 0.2, d / 2 - 0.2 + 0.25, 0, 0.2 + (seat - 0.2) / 2, (0.25 - d / 2 + 0.2) / 2, 'trim'),
    box(w - 0.5, 0.12, d / 2 - 0.325 + 0.25, 0, seat + 0.06, (0.25 - d / 2 + 0.325) / 2, 'black'),
    box(w - 0.4, h - seat - 0.1, 0.25, 0, (seat + h) / 2, -d / 2 + 0.2, 'black'),
    box(w, 0.35, 0.3, 0, h - 0.175, -d / 2 + 0.15, 'trim'),
    ...[-1, 1].flatMap((s) => [box(0.22, 0.32, d - 0.4, s * (w / 2 - 0.11), seat + 0.16, 0.05, 'trim'), plate(0.14, d - 0.6, s * (w / 2 - 0.11), seat + 0.321, 0.05, 'console', 'up')]),
  ];
}

// a lightsaber’s hilt lying along its prop (+z), its emitter forward
const saber = ({ w, d, h }) => [cyl(w / 2, w / 2, d, 0, h / 2, 0, 'rail', { axis: 'z', sides: 12 }), cyl(w / 2 + 0.002, w / 2 + 0.002, d * 0.35, 0, h / 2, -d * 0.2, 'black', { axis: 'z', sides: 12 })];

// a Royal Guard’s place, marked on the deck
const guardPost = ({ w, d }) => [plate(w, d, 0, 0.003, 0, 'black', 'up'), plate(w - 0.1, 0.04, 0, 0.005, d / 2 - 0.07, 'red', 'up'), plate(w - 0.1, 0.04, 0, 0.005, -d / 2 + 0.07, 'red', 'up')];

// The round window’s surround, about its foot (its square’s bottom middle), facing +z: the corners
// of the square filled, a deep rim, the spokes from a hub to it, and the glass.
function roundWindow({ w, h, d }) {
  const r = Math.min(w, h) / 2 - 0.5;
  const y = h / 2;
  const fill = new THREE.Shape();
  fill.moveTo(-w / 2, 0);
  fill.lineTo(w / 2, 0);
  fill.lineTo(w / 2, h);
  fill.lineTo(-w / 2, h);
  fill.lineTo(-w / 2, 0);
  const hole = new THREE.Path();
  hole.absarc(0, y, r, 0, Math.PI * 2, true);
  fill.holes.push(hole);
  const parts = [
    { geo: new THREE.ShapeGeometry(fill, 48).translate(0, 0, -d / 2 + 0.02), mat: 'wall' },
    // (the rim a flat ring and a round edge, both inside the frame’s depth)
    { geo: new THREE.RingGeometry(r - 0.05, r + 0.45, 64).translate(0, y, d / 2 - 0.01), mat: 'trim' },
    { geo: new THREE.TorusGeometry(r, 0.09, 8, 64).translate(0, y, 0), mat: 'trim' },
    { geo: new THREE.CircleGeometry(r, 64).translate(0, y, -d / 2), mat: 'glass' },
    cyl(0.6, 0.6, d, 0, y, 0, 'trim', { axis: 'z', sides: 24 }),
  ];
  for (let k = 0; k < SPOKES; k++) {
    const a = (k / SPOKES) * Math.PI * 2;
    parts.push({ geo: new THREE.BoxGeometry(0.14, r - 0.5, 0.16).translate(0, (r + 0.5) / 2, 0).rotateZ(a).translate(0, y, 0), mat: 'trim' });
  }
  return parts;
}

// an unfinished crate: a box banded at its edges
const crate = ({ w, d, h }) => [box(w - 0.04, h - 0.04, d - 0.04, 0, h / 2, 0, 'trim'), box(w, 0.06, d, 0, 0.03, 0, 'black'), box(w, 0.06, d, 0, h - 0.03, 0, 'black'), box(w, h, 0.05, 0, h / 2, 0, 'black')];

export const HEIGHT_PROPS = { throne, saber, 'guard-post': guardPost, 'window-frame': roundWindow, crate, console: DETENTION_PROPS.console };

export function roundWindowHole(room) {
  const win = room.window;
  if (!win?.round) return null;
  const b = room.box;
  const [y0, y1] = [win.y - win.r, win.y + win.r];
  if (win.wall === 'north' || win.wall === 'south') {
    const z = win.wall === 'north' ? b.z0 : b.z1;
    return { x0: win.x - win.r, x1: win.x + win.r, z0: z, z1: z, y0, y1 };
  }
  const x = win.wall === 'west' ? b.x0 : b.x1;
  return { x0: x, x1: x, z0: win.z - win.r, z1: win.z + win.r, y0, y1 };
}

// the floor’s steps and the dais stood on the deck: a block under each raised floor
function risers(room) {
  const base = Math.min(...room.floors.map((f) => f.y));
  return room.floors.filter((f) => f.y > base + 1e-6).map((f) => box(f.x1 - f.x0, f.y - base, f.z1 - f.z0, (f.x0 + f.x1) / 2, (f.y + base) / 2, (f.z0 + f.z1) / 2, 'black'));
}

// ── the throne room ──

export function buildThrone(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const hole = roundWindowHole(room);
  const parts = kit.shell(room, layout, { bay: 2.4, rib: 0.3, ribDepth: 0.2, kick: 0.4, band: 0.6, tall: 2.4, lights: false, openings: hole ? [hole] : [], seed: 4 });
  parts.push(...risers(room));
  parts.push(...lips(kit, openEdges(room), { thick: 0.3 }));
  for (const p of props) if (p.tag !== 'armrest-saber') parts.push(...drawWith(HEIGHT_PROPS, p));
  // the shaft under the gap in the floor, its walls drawn down until the dark takes them
  const shaft = layout.rooms.get('reactorshaft');
  const extra = [];
  // (Luke's saber on the armrest on its own, to be gone from it once it is taken: scene/index.js)
  const held = props.find((p) => p.tag === 'armrest-saber');
  if (held) {
    const saber = kit.merge(drawWith(HEIGHT_PROPS, held));
    saber.name = 'armrest-saber';
    extra.push(saber);
  }
  const owned = [];
  if (shaft) {
    const b = shaft.box;
    const y0 = room.y - DEEP;
    for (const [x, z, w, d] of [[b.x0, shaft.z, 0.3, b.z1 - b.z0], [b.x1, shaft.z, 0.3, b.z1 - b.z0], [shaft.x, b.z0, b.x1 - b.x0, 0.3], [shaft.x, b.z1, b.x1 - b.x0, 0.3]]) {
      parts.push(box(w, DEEP, d, x, (y0 + room.y) / 2, z, 'wall'));
      for (let y = room.y - 4; y > y0; y -= 6) parts.push(box(w + 0.02, 0.06, d + 0.02, x, y, z, 'strip'));
    }
    const haze = hazeOf(b, hazeLayers({ near: room.y - 1.5, far: y0 + 1, n: kit.small ? 5 : 9, keep: 0.04 }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0).rotateX(-Math.PI / 2).translate(shaft.x, y0 + 0.5, shaft.z), glowMaterial({ color: REACTOR, base: y0, fall: 30, strength: 1.4, rim: false }));
    extra.push(haze, glow);
    owned.push(haze, glow);
  }
  // pools of cold light from overhead, one on the throne
  const top = room.y + room.h;
  const seat = props.find((p) => p.kind === 'throne');
  for (const [x, z] of [[room.x - 8, room.z + 4], [room.x + 8, room.z + 8], [room.x - 6, room.z + 11]]) parts.push(cyl(0.9, 0.9, 0.1, x, top - 0.05, z, 'strip', { sides: 24 }));
  const lamps = [
    { x: seat?.x ?? room.x, y: (seat?.y ?? room.y) + 6, z: (seat?.z ?? room.z) + 2, color: COOL, intensity: 90, distance: 16 },
    { x: room.x, y: top - 1, z: room.z + 6, color: COOL, intensity: 160, distance: 28 },
    { x: room.x - 9, y: top - 2, z: room.z - 2, color: COOL, intensity: 60, distance: 16 },
    ...(hole ? [{ x: (hole.x0 + hole.x1) / 2, y: (hole.y0 + hole.y1) / 2, z: hole.z0 + 3, color: 0x9fb4ff, intensity: 60, distance: 18 }] : []),
    ...(shaft ? [{ x: shaft.x, y: room.y - 3, z: shaft.z, color: REACTOR, intensity: 20, distance: 10 }] : []),
  ];
  return finish(kit, room, parts, {
    lamps,
    renderer,
    extra,
    probeAt: { x: room.x, y: room.y + 1.6, z: room.z + 8 },
    update(t) {
      for (const m of owned) if (m.material.uniforms?.uTime) m.material.uniforms.uTime.value = t;
    },
    dispose() {
      for (const m of owned) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  });
}

// ── the reactor shaft, the gallery and the superstructure ──

// the reactor’s light rising from the bottom of a room, under the dark of its haze
function reactorBelow(rect, bottom, near, n) {
  const haze = hazeOf(rect, hazeLayers({ near, far: bottom + 1, n, keep: 0.05 }));
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(rect.x1 - rect.x0, rect.z1 - rect.z0).rotateX(-Math.PI / 2).translate((rect.x0 + rect.x1) / 2, bottom + 0.5, (rect.z0 + rect.z1) / 2),
    glowMaterial({ color: REACTOR, base: bottom, fall: 30, strength: 1.6, rim: false }),
  );
  return [haze, glow];
}

const freeing = (meshes) => () => {
  for (const m of meshes) {
    m.geometry.dispose();
    m.material.dispose();
  }
};
const ticking = (meshes) => (t) => {
  for (const m of meshes) if (m.material.uniforms?.uTime) m.material.uniforms.uTime.value = t;
};

export function buildReactorShaft(kit, room, layout, { renderer = null } = {}) {
  const parts = kit.shell(room, layout, { floor: false, ceiling: false, bay: 2.4, rib: 0.34, ribDepth: 0.22, kick: 0, band: 0.5, tall: 3, lights: false, seed: 13 });
  for (let y = room.y + 6; y < room.y + room.h - 2; y += 8) {
    const b = room.box;
    parts.push(box(b.x1 - b.x0 - 0.1, 0.08, 0.08, room.x, y, b.z0 + 0.06, 'strip'), box(b.x1 - b.x0 - 0.1, 0.08, 0.08, room.x, y, b.z1 - 0.06, 'strip'));
  }
  const meshes = reactorBelow(room.box, room.y, room.y + room.h - 4, kit.small ? 6 : 12);
  const lamps = [{ x: room.x, y: room.y + 8, z: room.z, color: REACTOR, intensity: 200, distance: 40 }];
  return finish(kit, room, parts, { lamps, renderer, extra: meshes, probeAt: { x: room.x, y: room.y + room.h / 2, z: room.z }, update: ticking(meshes), dispose: freeing(meshes) });
}

export function buildGallery(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = kit.shell(room, layout, { bay: 1.8, rib: 0.26, ribDepth: 0.16, tall: 1.6, kick: 0.3, band: 0.45, lights: true, every: 3, seed: 21 });
  for (const p of props) parts.push(...drawWith(HEIGHT_PROPS, p));
  // the opening onto the shaft, its lip lit, the reactor’s light coming up through it
  const mouth = room.doors.map((id) => layout.doors.get(id)).find((d) => d?.kind === 'arch');
  if (mouth) parts.push(box(mouth.w, 0.05, 0.08, mouth.x, room.y + 0.02, mouth.z - 0.04, 'strip'));
  const top = room.y + room.h;
  const lamps = [
    { x: room.x, y: top - 0.5, z: room.z, color: COOL, intensity: 18, distance: 12 },
    ...(mouth ? [{ x: mouth.x, y: room.y + 0.5, z: mouth.z + 1.5, color: REACTOR, intensity: 30, distance: 10 }] : []),
  ];
  return finish(kit, room, parts, { lamps, renderer, probeAt: { x: room.x, y: room.y + 1.4, z: room.z } });
}

export function buildSuperstructure(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const down = kit.small ? 40 : 80;
  const parts = kit.shell(room, layout, { floor: false, ceiling: false, bay: 3, rib: 0.4, ribDepth: 0.3, kick: 0, band: 0.6, tall: 3, lights: false, seed: 31 });
  for (const f of room.floors) parts.push(...slab(kit, f, { thick: 0.3 }));
  parts.push(...lips(kit, openEdges(room), { thick: 0.3 }));
  for (const p of props) parts.push(...drawWith(HEIGHT_PROPS, p));
  // the bare frame: columns round the walls from far below to the roof, girders across at each level
  const b = room.box;
  const bottom = room.y - down;
  const top = room.y + room.h;
  for (let x = b.x0 + 4; x < b.x1 - 2; x += 8) {
    for (const z of [b.z0 + 1, b.z1 - 1]) parts.push(box(0.6, top - bottom, 0.6, x, (top + bottom) / 2, z, 'trim'));
  }
  for (let z = b.z0 + 4; z < b.z1 - 2; z += 8) {
    for (const x of [b.x0 + 1, b.x1 - 1]) parts.push(box(0.6, top - bottom, 0.6, x, (top + bottom) / 2, z, 'trim'));
  }
  for (let y = room.y + 8; y < top; y += 8) {
    parts.push(box(b.x1 - b.x0 - 2, 0.5, 0.4, room.x, y, b.z0 + 1, 'trim'), box(b.x1 - b.x0 - 2, 0.5, 0.4, room.x, y, b.z1 - 1, 'trim'));
    parts.push(box(0.4, 0.5, b.z1 - b.z0 - 2, b.x0 + 1, y, room.z, 'trim'), box(0.4, 0.5, b.z1 - b.z0 - 2, b.x1 - 1, y, room.z, 'trim'));
  }
  // a girder under each walkway, and a work light on a pole at each platform
  for (const f of room.floors) {
    const alongX = f.x1 - f.x0 >= f.z1 - f.z0;
    parts.push(alongX ? box(f.x1 - f.x0, 0.6, 0.4, (f.x0 + f.x1) / 2, f.y - 0.6, (f.z0 + f.z1) / 2, 'trim') : box(0.4, 0.6, f.z1 - f.z0, (f.x0 + f.x1) / 2, f.y - 0.6, (f.z0 + f.z1) / 2, 'trim'));
  }
  const platforms = room.floors.filter((f) => Math.min(f.x1 - f.x0, f.z1 - f.z0) >= 2.5);
  for (const f of platforms) {
    const [x, z] = [f.x0 + 0.3, f.z0 + 0.3];
    parts.push(cyl(0.05, 0.05, 2.6, x, f.y + 1.3, z, 'rail', { sides: 8 }), ...onProp({ x, y: f.y + 2.6, z, yaw: Math.PI / 4 }, [box(0.4, 0.25, 0.2, 0, 0, 0.1, 'trim'), plate(0.34, 0.18, 0, 0, 0.21, 'strip')]));
  }
  const meshes = reactorBelow(b, bottom, room.y - 2, kit.small ? 6 : 12);
  const lamps = [
    { x: room.x, y: room.y - 20, z: room.z, color: REACTOR, intensity: 1400, distance: 90 },
    { x: room.x, y: room.y + room.h - 4, z: room.z, color: COOL, intensity: 160, distance: 40 },
    ...platforms.slice(0, 3).map((f) => ({ x: (f.x0 + f.x1) / 2, y: f.y + 2.5, z: (f.z0 + f.z1) / 2, color: COOL, intensity: 30, distance: 12 })),
  ];
  return finish(kit, room, parts, { lamps, renderer, extra: meshes, probeAt: { x: room.x, y: room.y + 1.6, z: room.z }, update: ticking(meshes), dispose: freeing(meshes) });
}
