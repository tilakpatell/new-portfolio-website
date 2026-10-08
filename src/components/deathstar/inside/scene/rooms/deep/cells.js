// The cell bay of AA-23 and what opens off it, as A New Hope has it. The
// bay is a long grey bend (drawn as two straight rooms, its light strip
// and floor bands turned round the corner so the bend reads as one), each
// cell’s number lit over its door (2180 to 2190) beside the panel that
// opens it, and the garbage chute’s heavy grate in the wall past the
// bend, gone once it has been blasted (the story’s flag `grate`). A cell
// is a dark box with a bench along its back wall and one dim panel
// overhead; when its door slides open the bay’s white light spills in
// across the floor and through the air. Cell 2187 has the IT-O floating
// over the bench. The chute is a grimy closet round a square mouth in the
// floor, the drop under it fading to a murky glow.
//
//   CELL_PROPS: { 'cell-number', 'door-panel', grate, bench, ito, 'chute-mouth' }   (prop) → parts about its foot
//   spillOf(room, layout) → { door, x, y, z, w, h, dir: { x, z } } | null   a cell’s doorway and the way into it
//   bendOf(room, layout) → { c, r, a0, a1, from, to } | null   the arc a bay’s centreline turns through to meet
//     the next bay’s, about c (from the doorway’s middle to `to` on this bay’s centreline), when this bay
//     holds the corner
//   buildCellbay, buildCell, buildChute (kit, room, layout, { renderer }) → { group, lamps, update(t, dt, ctx), dispose() }

import * as THREE from 'three';
import { furnish } from '../../../rules/furnish';
import { at, box, cyl, digitRects, drawWith, finish, flagsOf, hazeMaterial, openOf, place, plate, resolve } from './parts';

const COOL = 0xdfe8ff;
const BAND = 1.25; // the floor bands either side of a bay’s centreline
const STRIP = 0.34; // the width of a bay’s light strip

const alongX = (room) => room.w >= room.d;

// ── the drawers ──

// Lit digits on a black plate, the number as big as the plate allows.
// furnish.js hangs it a hand off the wall over the door, which is inside
// the door frame’s lintel (kit.js FRAME.slide stands 0.14 m out), so the
// plate stands on the lintel’s face, on a block back to the wall.
const LINTEL = 0.14;
function cellNumber(p) {
  const text = String(p.text ?? '');
  const size = Math.min(p.h * 0.62, (p.w * 0.86) / Math.max(digitRects(text, 1).w, 1e-6));
  const lift = (p.h - size) / 2;
  const back = -p.d / 2;
  const face = back - 0.01 + LINTEL;
  const parts = [
    box(p.w * 0.92, p.h, face - back, 0, p.h / 2, (back + face) / 2, 'trim'),
    box(p.w, p.h, 0.02, 0, p.h / 2, face + 0.01, 'black'),
    box(p.w, 0.012, 0.024, 0, p.h - 0.006, face + 0.012, 'trim'),
    box(p.w, 0.012, 0.024, 0, 0.006, face + 0.012, 'trim'),
  ];
  for (const r of digitRects(text, size).rects) parts.push(box(r.x1 - r.x0, r.y1 - r.y0, 0.006, (r.x0 + r.x1) / 2, lift + (r.y0 + r.y1) / 2, face + 0.023, 'digits'));
  return parts;
}

function doorPanel(p) {
  const z = -p.d / 2;
  return [
    box(p.w, p.h, 0.03, 0, p.h / 2, z + 0.015, 'trim'),
    plate(p.w - 0.06, p.h * 0.45, 0, p.h * 0.64, z + 0.031, 'console'),
    box(0.04, 0.04, 0.012, -0.05, p.h * 0.2, z + 0.036, 'red'),
    box(0.04, 0.04, 0.012, 0.05, p.h * 0.2, z + 0.036, 'strip'),
  ];
}

// the chute’s grate: a heavy frame and close bars across the hatch
function grate(p) {
  const { w, h, d } = p;
  const f = 0.08;
  const parts = [box(w, f, d, 0, h - f / 2, 0, 'trim'), box(w, f, d, 0, f / 2, 0, 'trim'), box(f, h - 2 * f, d, -w / 2 + f / 2, h / 2, 0, 'trim'), box(f, h - 2 * f, d, w / 2 - f / 2, h / 2, 0, 'trim')];
  const n = Math.max(2, Math.round((w - 2 * f) / 0.11));
  for (let i = 1; i < n; i++) parts.push(box(0.025, h - 2 * f, d * 0.6, -w / 2 + f + ((w - 2 * f) * i) / n, h / 2, 0, 'rail'));
  for (const y of [0.33, 0.5, 0.67]) parts.push(box(w - 2 * f, 0.04, d * 0.8, 0, h * y, 0, 'trim'));
  return parts;
}

// a slab on a solid black base, its lip catching the light
function bench(p) {
  const { w, d, h } = p;
  return [box(w, 0.06, d, 0, h - 0.03, 0, 'trim'), box(w - 0.04, h - 0.06, d - 0.02, 0, (h - 0.06) / 2, -0.01, 'black'), box(w, 0.035, 0.025, 0, h - 0.08, d / 2 - 0.0125, 'rail')];
}

// The IT-O: a glossy black ball, its red eye forward, a ring round its
// middle, the syringe out of one side and a pincer out of the other.
function ito(p) {
  const r = Math.min(p.w, p.h) * 0.28;
  const y = p.h / 2;
  return [
    { geo: new THREE.SphereGeometry(r, 24, 16).translate(0, y, 0), mat: 'gloss' },
    { geo: new THREE.TorusGeometry(r * 1.01, 0.008, 6, 36).rotateX(Math.PI / 2).translate(0, y, 0), mat: 'rail' },
    { geo: new THREE.SphereGeometry(0.026, 12, 8).translate(0, y + 0.02, r * 0.95), mat: 'red' },
    cyl(0.004, 0.004, 0.08, 0.03, y + r + 0.04, 0, 'rail', { sides: 6 }),
    cyl(0.008, 0.008, 0.1, r + 0.04, y - 0.03, 0, 'rail', { axis: 'x', sides: 6 }),
    cyl(0.018, 0.018, 0.09, r + 0.08, y - 0.03, 0.04, 'trim', { axis: 'z', sides: 10 }),
    cyl(0.003, 0.003, 0.06, r + 0.08, y - 0.03, 0.115, 'rail', { axis: 'z', sides: 6 }),
    cyl(0.008, 0.008, 0.1, -r - 0.04, y - 0.04, 0, 'rail', { axis: 'x', sides: 6 }),
    box(0.01, 0.05, 0.012, -r - 0.09, y - 0.07, 0.012, 'rail'),
    box(0.01, 0.05, 0.012, -r - 0.09, y - 0.07, -0.012, 'rail'),
  ];
}

// the chute’s rim round its mouth (the mouth itself is a hole the room leaves in its floor)
function chuteMouth(p) {
  const t = 0.12;
  return [
    box(p.w, p.h, t, 0, p.h / 2, -p.d / 2 + t / 2, 'trim'),
    box(p.w, p.h, t, 0, p.h / 2, p.d / 2 - t / 2, 'trim'),
    box(t, p.h, p.d - 2 * t, -p.w / 2 + t / 2, p.h / 2, 0, 'trim'),
    box(t, p.h, p.d - 2 * t, p.w / 2 - t / 2, p.h / 2, 0, 'trim'),
    box(p.w - 2 * t, 0.02, 0.03, 0, p.h - 0.01, -p.d / 2 + t + 0.015, 'red'),
  ];
}

export const CELL_PROPS = { 'cell-number': cellNumber, 'door-panel': doorPanel, grate, bench, ito, 'chute-mouth': chuteMouth };

// ── the room maths ──

export function spillOf(room, layout) {
  const door = room.doors.map((id) => layout.doors.get(id)).find(Boolean);
  if (!door) return null;
  const dir = door.axis === 'x' ? { x: 0, z: Math.sign(room.z - door.z) || 1 } : { x: Math.sign(room.x - door.x) || 1, z: 0 };
  return { door: door.id, x: door.x, y: door.y, z: door.z, w: door.w, h: door.h, dir };
}

export function bendOf(room, layout) {
  for (const id of room.doors) {
    const door = layout.doors.get(id);
    const other = layout.rooms.get(door.a === room.id ? door.b : door.a);
    if (other?.kind !== room.kind || alongX(other) === alongX(room)) continue;
    // where the two centrelines cross, if it is in this bay
    const P = alongX(room) ? { x: other.x, z: room.z } : { x: room.x, z: other.z };
    const b = room.box;
    if (!(P.x > b.x0 && P.x < b.x1 && P.z > b.z0 && P.z < b.z1)) continue;
    const from = { x: door.x, z: door.z };
    const r = Math.hypot(from.x - P.x, from.z - P.z);
    const to = alongX(room) ? { x: P.x + Math.sign(room.x - P.x) * r, z: P.z } : { x: P.x, z: P.z + Math.sign(room.z - P.z) * r };
    const c = alongX(room) ? { x: to.x, z: from.z } : { x: from.x, z: to.z };
    return { c, r, from, to, a0: Math.atan2(from.z - c.z, from.x - c.x), a1: Math.atan2(to.z - c.z, to.x - c.x) };
  }
  return null;
}

// ── the bay ──

// A light strip and its two floor bands along a straight stretch of
// centreline from a to b, in lengths with dark joints; and the same round an arc.
function runOf(a, b, y0, y1) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const turn = Math.atan2(-(b.z - a.z), b.x - a.x);
  const n = Math.max(1, Math.floor(len / 2));
  const local = [];
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * len) / n;
    local.push(box(len / n - 0.1, 0.04, STRIP + 0.16, x, y1 - 0.02, 0, 'black'), plate(len / n - 0.3, STRIP, x, y1 - 0.045, 0, 'strip', 'down'));
  }
  for (const s of [-1, 1]) local.push(plate(len, 0.06, len / 2, y0 + 0.003, s * BAND, 'rail', 'up'));
  return place(local, at(a.x, 0, a.z, turn));
}

function arcOf(bend, y0, y1) {
  const parts = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const [u, v] = [bend.a0 + ((bend.a1 - bend.a0) * i) / n, bend.a0 + ((bend.a1 - bend.a0) * (i + 1)) / n];
    for (const [r, w, y, role] of [[bend.r, STRIP, y1 - 0.045, 'strip'], [bend.r - BAND, 0.06, y0 + 0.003, 'rail'], [bend.r + BAND, 0.06, y0 + 0.003, 'rail']]) {
      const [p, q] = [{ x: bend.c.x + r * Math.cos(u), z: bend.c.z + r * Math.sin(u) }, { x: bend.c.x + r * Math.cos(v), z: bend.c.z + r * Math.sin(v) }];
      const len = Math.hypot(q.x - p.x, q.z - p.z) + (role === 'strip' ? -0.06 : 0.01);
      const face = role === 'strip' ? 'down' : 'up';
      parts.push(...place([plate(len, w, 0, y, 0, role, face)], at((p.x + q.x) / 2, 0, (p.z + q.z) / 2, Math.atan2(-(q.z - p.z), q.x - p.x))));
    }
  }
  return parts;
}

const digitsMat = () => new THREE.MeshStandardMaterial({ name: 'ds-digits', color: 0x050608, roughness: 0.3, metalness: 0, emissive: 0xd4ecff, emissiveIntensity: 2.4 });

export function buildCellbay(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = kit.shell(room, layout, { bay: 1.5, rib: 0.24, ribDepth: 0.12, lights: true, tall: 1.2, seed: room.id.length * 7 + 21 });
  const [y0, y1] = [room.y, room.y + room.h];
  const b = room.box;
  const bend = bendOf(room, layout);
  // the centreline, end to end, or from the far end to where it turns
  const ends = alongX(room) ? [{ x: b.x0, z: room.z }, { x: b.x1, z: room.z }] : [{ x: room.x, z: b.z0 }, { x: room.x, z: b.z1 }];
  if (bend) {
    const far = ends.sort((p, q) => Math.hypot(q.x - bend.to.x, q.z - bend.to.z) - Math.hypot(p.x - bend.to.x, p.z - bend.to.z))[0];
    parts.push(...runOf(far, bend.to, y0, y1), ...arcOf(bend, y0, y1));
  } else parts.push(...runOf(ends[0], ends[1], y0, y1));
  const own = { digits: digitsMat() };
  // the grate stands apart, to go when it is blasted
  let blasted = null;
  const extra = [];
  for (const p of props) {
    if (p.kind !== 'grate') parts.push(...drawWith(CELL_PROPS, p));
    else {
      blasted = kit.merge(drawWith(CELL_PROPS, p));
      blasted.name = 'chute-grate';
      extra.push(blasted);
    }
  }
  const lamps = [-0.25, 0.25].map((s) => ({ x: room.x + (alongX(room) ? s * room.w : 0), y: y1 - 0.4, z: room.z + (alongX(room) ? 0 : s * room.d), color: COOL, intensity: 14, distance: 10 }));
  return finish(kit, room, parts, {
    lamps,
    own,
    extra,
    renderer,
    update(t, dt, ctx) {
      if (blasted) blasted.visible = !flagsOf(ctx).has('grate');
    },
  });
}

// ── a cell ──

// The light let in at an open door: a pool on the floor, widening into the
// cell, and the air it passes through, from the doorway down to the pool.
function spillMeshes(spill, room) {
  const L = Math.min(2.6, (alongX(room) ? room.w : room.d) - 0.3);
  const wide = spill.w + 1.1;
  const across = { x: -spill.dir.z, z: spill.dir.x };
  const point = (s, f, y) => [spill.x + across.x * s + spill.dir.x * f, y, spill.z + across.z * s + spill.dir.z * f];
  const quad = (corners, uvs) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  };
  const y = spill.y + 0.012;
  const pool = quad([point(-spill.w / 2, 0.02, y), point(spill.w / 2, 0.02, y), point(wide / 2, L, y), point(-wide / 2, L, y)], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  // the air: four sides of the frustum from the doorway to the pool, open at both ends
  const top = spill.y + spill.h - 0.05;
  const near = [point(-spill.w / 2, 0.02, y), point(spill.w / 2, 0.02, y), point(spill.w / 2, 0.02, top), point(-spill.w / 2, 0.02, top)];
  const far = [point(-wide / 2, L, y), point(wide / 2, L, y), point(wide / 2, L * 0.55, y + 0.02), point(-wide / 2, L * 0.55, y + 0.02)];
  const pos = [];
  const uv = [];
  const index = [];
  for (let k = 0; k < 4; k++) {
    const [a, b] = [k, (k + 1) % 4];
    const base = pos.length;
    pos.push(near[a], near[b], far[b], far[a]);
    uv.push([0, 1], [1, 1], [1, 0], [0, 0]);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const air = new THREE.BufferGeometry();
  air.setAttribute('position', new THREE.Float32BufferAttribute(pos.flat(), 3));
  air.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
  air.setIndex(index);
  air.computeVertexNormals();
  const poolMat = hazeMaterial({ color: 0xe6eeff, strength: 0, flat: true });
  const airMat = hazeMaterial({ color: 0xdfe8ff, strength: 0 });
  const meshes = [new THREE.Mesh(pool, poolMat), new THREE.Mesh(air, airMat)];
  meshes.forEach((m, i) => {
    m.name = i ? 'spill-air' : 'spill-pool';
    m.renderOrder = 3;
    m.visible = false;
  });
  return { meshes, poolMat, airMat };
}

export function buildCell(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const parts = kit.shell(room, layout, { bay: 1, rib: 0.16, ribDepth: 0.08, tall: 1, kick: 0.25, band: 0.35, seed: room.id.length * 13 + Number(/\d+/.exec(room.id)?.[0] ?? 0) });
  const top = room.y + room.h;
  // one dim panel overhead, in a frame
  parts.push(box(0.9, 0.08, 0.9, room.x, top - 0.04, room.z, 'trim'), plate(0.7, 0.7, room.x, top - 0.085, room.z, 'dim', 'down'));
  const own = { dim: new THREE.MeshStandardMaterial({ name: 'ds-dim', color: 0x08090b, roughness: 0.4, metalness: 0, emissive: 0xc8d6f0, emissiveIntensity: 0.5 }), gloss: new THREE.MeshStandardMaterial({ name: 'ds-gloss', color: 0x040405, roughness: 0.14, metalness: 0.7 }) };
  const extra = [];
  let hover = null;
  let rest = 0;
  for (const p of props) {
    if (p.kind !== 'ito') {
      parts.push(...drawWith(CELL_PROPS, p));
      continue;
    }
    // the droid floats on its own, a slow bob and a slower turn
    hover = new THREE.Group();
    hover.name = 'ito';
    hover.add(kit.merge(resolve(CELL_PROPS.ito(p), own)));
    hover.position.set(p.x, p.y, p.z);
    hover.rotation.y = Math.PI - p.yaw;
    rest = p.y;
    extra.push(hover);
  }
  const spill = spillOf(room, layout);
  const shaft = spill ? spillMeshes(spill, room) : null;
  if (shaft) extra.push(...shaft.meshes);
  const lamp = spill
    ? { x: spill.x + spill.dir.x * 0.7, y: spill.y + 2, z: spill.z + spill.dir.z * 0.7, color: COOL, intensity: 0.8, distance: 5 }
    : { x: room.x, y: top - 0.3, z: room.z, color: COOL, intensity: 0.8, distance: 5 };
  const turn = hover?.rotation.y ?? 0;
  return finish(kit, room, parts, {
    lamps: [lamp],
    own,
    extra,
    renderer,
    probeAt: { x: room.x, y: room.y + 1.2, z: room.z },
    update(t, dt, ctx) {
      if (hover) {
        hover.position.y = rest + Math.sin(t * 1.7) * 0.03;
        hover.rotation.y = turn + Math.sin(t * 0.37) * 0.5;
      }
      if (!shaft) return;
      const open = openOf(ctx, spill.door);
      lamp.intensity = 0.8 + 9 * open;
      shaft.poolMat.uniforms.uStrength.value = 0.55 * open;
      shaft.airMat.uniforms.uStrength.value = 0.09 * open;
      shaft.poolMat.uniforms.uTime.value = t;
      shaft.airMat.uniforms.uTime.value = t;
      for (const m of shaft.meshes) m.visible = open > 0.01;
    },
    dispose() {
      for (const m of shaft?.meshes ?? []) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  });
}

// ── the chute ──

export function buildChute(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const own = { wall: grimeOf(kit), murk: new THREE.MeshStandardMaterial({ name: 'ds-murk', color: 0x0a0c06, roughness: 0.9, metalness: 0, emissive: 0x3b4a1c, emissiveIntensity: 0.6 }) };
  const parts = kit.shell(room, layout, { floor: false, bay: 1.2, rib: 0.2, ribDepth: 0.1, tall: 1.1, seed: 3263 });
  const b = room.box;
  const y = room.y;
  const mouth = props.find((p) => p.kind === 'chute-mouth');
  const hole = mouth ? { x0: mouth.x - mouth.w / 2 + 0.12, x1: mouth.x + mouth.w / 2 - 0.12, z0: mouth.z - mouth.d / 2 + 0.12, z1: mouth.z + mouth.d / 2 - 0.12 } : null;
  if (hole) {
    // the deck round the hole, and the drop under it: black sides down to a slope of murk
    for (const [x0, x1, z0, z1] of [[b.x0, b.x1, b.z0, hole.z0], [b.x0, b.x1, hole.z1, b.z1], [b.x0, hole.x0, hole.z0, hole.z1], [hole.x1, b.x1, hole.z0, hole.z1]]) {
      if (x1 - x0 > 0.01 && z1 - z0 > 0.01) parts.push(plate(x1 - x0, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, 'floor', 'up'));
    }
    const [hw, hd, deep] = [hole.x1 - hole.x0, hole.z1 - hole.z0, 3];
    const [cx, cz] = [(hole.x0 + hole.x1) / 2, (hole.z0 + hole.z1) / 2];
    parts.push(
      plate(hw, deep, cx, y - deep / 2, hole.z0, 'black', 'front'),
      plate(hw, deep, cx, y - deep / 2, hole.z1, 'black', 'back'),
      ...place([plate(hd, deep, 0, y - deep / 2, 0, 'black', 'front')], at(hole.x0, 0, cz, Math.PI / 2)),
      ...place([plate(hd, deep, 0, y - deep / 2, 0, 'black', 'front')], at(hole.x1, 0, cz, -Math.PI / 2)),
      ...place([plate(hw, hd * 1.2, 0, 0, 0, 'murk', 'up')], new THREE.Matrix4().makeTranslation(cx, y - deep + 0.4, cz).multiply(new THREE.Matrix4().makeRotationX(0.6))),
    );
  } else parts.push(...room.floors.map((f) => plate(f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, f.y, (f.z0 + f.z1) / 2, 'floor', 'up')));
  for (const p of props) parts.push(...drawWith(CELL_PROPS, p));
  // pipes along the back wall under the ceiling, and a caged lamp over the mouth
  const back = { z: b.z0 + 0.25 };
  for (const [r, dy] of [[0.07, 0.35], [0.05, 0.55]]) parts.push(cyl(r, r, b.x1 - b.x0, room.x, y + room.h - dy, back.z + (dy > 0.4 ? 0.1 : 0), 'rail', { axis: 'x', sides: 10 }));
  parts.push(box(0.3, 0.12, 0.16, room.x, y + room.h - 0.9, b.z0 + 0.08, 'trim'), box(0.22, 0.06, 0.08, room.x, y + room.h - 0.98, b.z0 + 0.12, 'strip'));
  const lamps = [{ x: room.x, y: y + room.h - 1.1, z: b.z0 + 0.6, color: 0xdde6f5, intensity: 5, distance: 6 }];
  return finish(kit, room, parts, { lamps, own, renderer, probeAt: { x: room.x, y: y + 1.4, z: room.z + 0.8 } });
}

// The station’s grey plating gone dull and brown with what passes through:
// the kit’s wall worn darker (its maps stay the kit’s).
export function grimeOf(kit, color = 0x6d6a58) {
  const m = kit.mat('wall').clone();
  m.name = 'ds-grime';
  m.color.set(color);
  m.roughness = 0.9;
  m.envMapIntensity = 0.35;
  return m;
}
