// Docking Control 327, the office over the bay, as A New Hope has it: low
// consoles under its windows onto the bay, taller banks of screens along
// its sides, the closet in the back wall, the scomp link socket where
// Artoo plugs in, a security camera high in a corner, and the low door
// from the landing (a heavy header over a 2 m opening: the one a trooper
// knocks his helmet on). Built for any room of kind 'control': the windows
// come from the bay its wall backs onto, the socket from a `scomp…` spot.
//
//   buildControl(kit, room, layout, { renderer }) → { group, lamps, update(t), dispose() }

import * as THREE from 'three';
import { panelLayout, roomWalls, windowsOf } from '../kit';
import { probeRoom } from '../probe';

const WALL = { bay: 1.6, rib: 0.22, ribDepth: 0.12, lights: true, tall: 1.2 };
const COOL = 0xdfe8ff;
const SLOPE = 1.13; // how far a console’s face leans back from upright (65°)

// A face leaning back from upright, w × h, centred at x, y, z (a console’s top).
const leaning = (w, h, x, y, z, role) => ({ geo: new THREE.PlaneGeometry(w, h).rotateX(-SLOPE).translate(x, y, z), mat: role });

// A bank of consoles `len` long against a wall (x along it, +z into the
// room, y up from the floor): a desk with a sloped face of buttons and
// screens set in it; a tall bank adds an upright with screens above.
function bank(kit, len, tall) {
  const parts = [
    kit.box(len, 0.72, 0.62, len / 2, 0.36, 0.31, 'trim'),
    kit.box(len, 0.22, 0.13, len / 2, 0.83, 0.065, 'trim'),
    kit.box(len - 0.1, 0.12, 0.04, len / 2, 0.06, 0.64, 'black'),
    leaning(len - 0.06, 0.5, len / 2, 0.83, 0.36, 'console'),
  ];
  const n = Math.max(1, Math.round(len / 1.1));
  const lift = new THREE.Vector3(0, Math.sin(SLOPE), Math.cos(SLOPE)).multiplyScalar(0.004);
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * len) / n;
    parts.push(leaning(0.4, 0.24, x, 0.83 + lift.y, 0.36 + lift.z, 'screen'));
    if (tall) parts.push(kit.plate(0.55, 0.34, x, 1.32, 0.085, 'screen'));
  }
  if (tall) parts.push(kit.box(len, 0.75, 0.08, len / 2, 1.31, 0.04, 'trim'), kit.box(len, 0.05, 0.3, len / 2, 1.71, 0.15, 'trim'));
  return parts;
}

// The stretches of a run free of its holes, its light grids and its corners.
function freeSpans(run, { clear = 0.45, min = 1 } = {}) {
  const lay = panelLayout(run.len, run.y1 - run.y0, { ...WALL, holes: run.holes });
  const blocked = [...run.holes.map((h) => [h.x0 - 0.3, h.x1 + 0.3]), ...lay.lights.map((l) => [l.x - l.w / 2 - 0.15, l.x + l.w / 2 + 0.15])].sort((p, q) => p[0] - q[0]);
  const free = [];
  let t = clear;
  for (const [b0, b1] of blocked) {
    if (b0 - t >= min) free.push([t, b0]);
    t = Math.max(t, b1);
  }
  if (run.len - clear - t >= min) free.push([t, run.len - clear]);
  return free;
}

// Where along a run a point stands, in the run’s metres.
const along = (run, p) => ((p.x - run.x0) * (run.x1 - run.x0) + (p.z - run.z0) * (run.z1 - run.z0)) / run.len;
const onRun = (run, p) => Math.abs(run.n.x * p.x + run.n.z * p.z - run.off) < 0.05;
const sameWall = (a, b) => Boolean(a && b) && Math.abs(a.n.x - b.n.x) < 1e-6 && Math.abs(a.n.z - b.n.z) < 1e-6 && Math.abs(a.off - b.off) < 1e-4;
const pointAt = (run, t) => ({ x: run.x0 + ((run.x1 - run.x0) * t) / run.len, z: run.z0 + ((run.z1 - run.z0) * t) / run.len });

// The round port a droid’s arm turns in, on a plate, with its light.
function socket(kit) {
  return [
    kit.box(0.42, 0.42, 0.04, 0, 0.85, 0.02, 'trim'),
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20).rotateX(Math.PI / 2).translate(0, 0.85, 0.05), mat: 'rail' },
    { geo: new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20).rotateX(Math.PI / 2).translate(0, 0.85, 0.08), mat: 'black' },
    kit.box(0.06, 0.03, 0.02, 0.15, 1.02, 0.045, 'red'),
  ];
}

// A camera on a bracket, looking along +z and down.
function camera(kit) {
  return [
    kit.box(0.22, 0.22, 0.04, 0, 0, 0.02, 'trim'),
    kit.beam({ x: 0, y: 0, z: 0.03 }, { x: 0, y: -0.1, z: 0.28 }, 0.06, 0.06, 'rail'),
    { geo: new THREE.BoxGeometry(0.16, 0.14, 0.38).rotateX(0.4).translate(0, -0.2, 0.42), mat: 'trim' },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16).rotateX(Math.PI / 2 + 0.4).translate(0, -0.28, 0.6), mat: 'black' },
    kit.box(0.04, 0.04, 0.04, 0.05, -0.1, 0.4, 'red'),
  ];
}

export function buildControl(kit, room, layout, { renderer = null } = {}) {
  const windows = windowsOf(room, layout);
  const plain = roomWalls(layout, room.id, windows);
  const front = plain.find((r) => windows.some((w) => onRun(r, { x: w.x0, z: w.z0 })));
  const back = front ? plain.find((r) => Math.abs(r.n.x + front.n.x) < 1e-6 && Math.abs(r.n.z + front.n.z) < 1e-6) : null;
  const scomps = Object.entries(layout.station.spots ?? {})
    .filter(([name, s]) => s.room === room.id && name.startsWith('scomp'))
    .map(([, s]) => s);

  // the closet: in the back wall’s free stretch farthest from any socket
  let closet = null;
  if (back) {
    const spans = freeSpans(back).filter(([a, b]) => b - a >= 1.3);
    const far = (s) => Math.min(Infinity, ...scomps.map((p) => Math.abs((s[0] + s[1]) / 2 - along(back, p))));
    const span = spans.sort((p, q) => far(q) - far(p))[0];
    if (span) {
      const c = (span[0] + span[1]) / 2;
      const [p, q] = [pointAt(back, c - 0.5), pointAt(back, c + 0.5)];
      closet = { x0: p.x, z0: p.z, x1: q.x, z1: q.z, y0: room.y, y1: room.y + 2, frame: 'door', c };
    }
  }
  const openings = closet ? [...windows, closet] : windows;
  const parts = kit.shell(room, layout, { ...WALL, openings, seed: 327 });
  const runs = roomWalls(layout, room.id, openings);
  const onWall = (run, local) => kit.place(local, kit.at(run.x0, run.y0, run.z0, run.angle));

  for (const run of runs) {
    const isFront = sameWall(run, front);
    const isBack = sameWall(run, back);
    if (isFront) {
      // low consoles under each window, and the heavy header over the low door
      for (const w of windows) {
        const [t0, t1] = [along(run, { x: w.x0, z: w.z0 }), along(run, { x: w.x1, z: w.z1 })];
        parts.push(...onWall(run, kit.place(bank(kit, Math.abs(t1 - t0), false), kit.at(Math.min(t0, t1), 0, 0))));
      }
      for (const h of run.holes.filter((hh) => hh.door)) parts.push(...onWall(run, [kit.box(h.x1 - h.x0 + 0.64, 0.26, 0.36, (h.x0 + h.x1) / 2, h.y1 + 0.11, 0.18, 'trim')]));
    } else if (isBack) {
      // the closet’s shut leaf, a display between the grids, the socket
      if (closet) parts.push(...onWall(run, [kit.plate(1, 2, closet.c, 1, -0.01, 'trim'), kit.box(0.05, 0.3, 0.04, closet.c + 0.38, 1.05, 0.02, 'rail'), kit.box(0.06, 0.06, 0.02, closet.c + 0.38, 1.3, 0.02, 'red')]));
      const spans = freeSpans(run).filter(([a, b]) => !closet || b < closet.c - 0.8 || a > closet.c + 0.8);
      const mid = spans.find(([a, b]) => b - a >= 1.4 && !scomps.some((p) => along(run, p) > a - 0.4 && along(run, p) < b + 0.4)) ?? null;
      if (mid) {
        const c = (mid[0] + mid[1]) / 2;
        parts.push(...onWall(run, [kit.box(1.36, 0.86, 0.06, c, 1.85, 0.03, 'trim'), kit.plate(1.2, 0.7, c, 1.85, 0.065, 'screen')]));
      }
    } else {
      // tall banks of screens along the sides, between the grids
      for (const [a, b] of freeSpans(run)) parts.push(...onWall(run, kit.place(bank(kit, b - a, true), kit.at(a, 0, 0))));
    }
  }
  for (const s of scomps) {
    // on the wall it faces
    const f = { x: Math.sin(s.yaw), z: -Math.cos(s.yaw) };
    const b = room.box;
    const t = Math.min(f.x > 0 ? (b.x1 - s.x) / f.x : f.x < 0 ? (b.x0 - s.x) / f.x : Infinity, f.z > 0 ? (b.z1 - s.z) / f.z : f.z < 0 ? (b.z0 - s.z) / f.z : Infinity);
    if (Number.isFinite(t)) parts.push(...kit.place(socket(kit), kit.at(s.x + f.x * t, room.y, s.z + f.z * t, Math.atan2(-f.x, -f.z))));
  }
  // the camera high in the corner farthest from the door, watching the room
  const door = front?.holes.find((h) => h.door);
  const doorAt = door ? pointAt(front, (door.x0 + door.x1) / 2) : { x: room.x, z: room.z };
  const corners = [
    [room.box.x0, room.box.z0],
    [room.box.x1, room.box.z0],
    [room.box.x0, room.box.z1],
    [room.box.x1, room.box.z1],
  ].sort((p, q) => Math.hypot(q[0] - doorAt.x, q[1] - doorAt.z) - Math.hypot(p[0] - doorAt.x, p[1] - doorAt.z) || q[0] - p[0]);
  const [cx, cz] = corners[0];
  const inX = Math.sign(room.x - cx) * 0.25;
  const inZ = Math.sign(room.z - cz) * 0.25;
  parts.push(...kit.place(camera(kit), kit.at(cx + inX, room.y + room.h - 0.25, cz + inZ, Math.atan2(room.x - cx, room.z - cz))));
  // light panels in the ceiling, and this side’s pane of the windows
  for (const dx of [-1, 1]) parts.push(kit.plate(0.5, Math.min(3, room.box.z1 - room.box.z0 - 2), room.x + dx * (room.box.x1 - room.box.x0) * 0.22, room.y + room.h - 0.01, room.z, 'strip', 'down'));
  for (const w of windows) {
    const g = new THREE.PlaneGeometry(Math.hypot(w.x1 - w.x0, w.z1 - w.z0), w.y1 - w.y0);
    g.rotateY(Math.atan2(-(w.z1 - w.z0), w.x1 - w.x0)).translate((w.x0 + w.x1) / 2 + front.n.x * 0.03, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2 + front.n.z * 0.03);
    parts.push({ geo: g, mat: 'glass' });
  }

  const group = kit.merge(parts);
  group.name = room.id;
  const lamps = [{ x: room.x, y: room.y + room.h - 0.35, z: room.z, color: COOL, intensity: 18, distance: 10 }];
  const reflection = probeRoom(renderer, group, { x: room.x, y: room.y + 1.4, z: room.z }, { lamps });
  return {
    group,
    lamps,
    update(t) {
      kit.update(t);
    },
    dispose() {
      reflection.dispose();
      kit.free(group);
      group.removeFromParent();
    },
  };
}
