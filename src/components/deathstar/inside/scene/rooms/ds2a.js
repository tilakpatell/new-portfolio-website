// The room builders for the second Death Star’s working half, as Return
// of the Jedi has it: the dock where ST 321 sets Vader down (Lambda
// shuttles on a glossy black deck under a cool white-blue light, their
// folded wings rising into wells in the ceiling, the magnetic field across
// the mouth with space beyond); the command centre (rows of crew stations
// facing the window on the trench, the firing switch that beeps, the big
// targeting screen and a smaller one, a rack of A280s, Jerjerrod’s desk
// with his nameplate); the tower’s antechamber (grey benches in alcoves,
// columns, the guarded turbolift); and Hangar 272, vast, where the Emperor
// lands (the troops’ ranks marked on the deck either side of his aisle,
// his shuttle at its foot, no red in it but his Royal Guards’). Everything
// that stands in a room is drawn from furnish(room, layout.station), where
// the walker and the paths find it too; what is worked out first (a
// shuttle’s fit, her ramp, the wells, the ranks, the alcoves) is
// ./ds2/plan.js’. Each room is merged one mesh a material, lit by its
// panels and a few lamps, with its own reflection probe, and freed whole.
//
//   DS2_A: { dock, command, holding, hangar }   (kind → builder; see ./index.js for the contract)

import * as THREE from 'three';
import { furnish } from '../../rules/furnish';
import { roomWalls } from '../kit';
import { probeRoom } from '../probe';
import { blinker, columnParts, consoleParts, crateParts, deskParts, nameFace, onProp, plateParts, postParts, rackOn, screenParts, switchParts, targetFace } from './ds2/fittings';
import { ceilingOf, seamsOf, walkway } from './ds2/frame';
import { padParts, rampParts, standLambda } from './ds2/lambda';
import { alcovesOf, rackOf, rampFor, ranksOf, screensOf, wellOver } from './ds2/plan';
import { fieldOver, lipOf, starsRound } from './ds2/space';

const COOL = 0xdfe8ff;
const SKY = 0x9fc4ff;
const otherSide = (door, id) => (door.a === id ? door.b : door.a);
const doorsOf = (room, layout) => room.doors.map((id) => layout.doors.get(id)).filter(Boolean);
const spotsIn = (room, layout) =>
  Object.entries(layout.station.spots ?? {})
    .filter(([, s]) => s.room === room.id)
    .map(([name, s]) => ({ ...s, name }));
const mouthOf = (room, layout) => doorsOf(room, layout).find((d) => d.kind === 'arch' && layout.rooms.get(otherSide(d, room.id))?.kind === 'field') ?? null;
const deckOf = (kit, room) => room.floors.map((f) => kit.plate(f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, f.y, (f.z0 + f.z1) / 2, 'floor', 'up'));

// The pale paint of the deck’s markings: matt, a little lit, so it reads
// on the black deck from across a hangar; drawn just over the deck.
const paintMaterial = () => new THREE.MeshStandardMaterial({ color: 0x8c949e, roughness: 0.62, metalness: 0.1, emissive: 0x9aa6b4, emissiveIntensity: 0.16, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: 'ds2-paint' });

// A room’s merged parts and whatever else it holds, its probe, and a
// dispose that frees all of it but what is shared (the kit’s materials,
// the models and the guns, which their own modules keep).
function finish(kit, room, parts, { renderer, lamps, probeAt, extras = [], owned = [], updates = [] }) {
  const built = kit.merge(parts);
  const group = new THREE.Group();
  group.name = room.id;
  group.add(built, ...extras);
  const keep = [...owned];
  let reflection = probeRoom(renderer, group, probeAt, { lamps });
  let gone = false;
  return {
    group,
    lamps,
    // late arrivals (the shuttles’ models) join the room, which takes its reflection again
    adopt(objects, keepers) {
      if (gone) return false;
      group.add(...objects);
      keep.push(...keepers);
      reflection.dispose();
      reflection = probeRoom(renderer, group, probeAt, { lamps });
      return true;
    },
    update(t, dt, ctx) {
      for (const u of updates) u(t, dt, ctx);
    },
    dispose() {
      gone = true;
      reflection.dispose();
      kit.free(built);
      for (const o of keep) o.dispose();
      group.removeFromParent();
    },
  };
}

// The Lambdas a bay’s furnish puts down, loaded and stood on their props;
// the room takes them in together (one new reflection, not one a ship),
// or frees them if it went first.
function berth(room, built, ships, renderer) {
  if (!ships.length) return;
  const stand = (prop) =>
    standLambda(prop, renderer).catch((err) => {
      console.error(`${room.name}: a Lambda shuttle could not be stood on the deck; the bay stands without her`, err);
      return null;
    });
  Promise.all(ships.map(stand)).then((stood) => {
    const got = stood.filter(Boolean);
    if (got.length && !built.adopt(got.map((s) => s.holder), got)) for (const s of got) s.dispose();
  });
}

// What a bay has in common: its deck in plates, the ceiling (holed by the
// shuttles’ wells), the lip and the field at its mouth with the stars past
// it, the shuttles’ pads and ramps, and the crates furnish stacks along
// its walls.
function bayParts(kit, room, layout, { props, ships, paint, step, ceiling }) {
  const spots = spotsIn(room, layout);
  const wells = ships.map((s) => wellOver(s, room)).filter(Boolean);
  const mouth = mouthOf(room, layout);
  const parts = [...deckOf(kit, room), ...seamsOf(kit, room.box, room.y, step), ...ceilingOf(kit, room, { ...ceiling, wells })];
  if (mouth) parts.push(...lipOf(kit, mouth, room));
  for (const ship of ships) {
    parts.push(...padParts(kit, ship, paint));
    const ramp = rampFor(ship, spots);
    if (ramp) parts.push(...rampParts(kit, ramp));
  }
  for (const p of props.filter((q) => q.kind === 'crate')) parts.push(...onProp(kit, p, crateParts(kit, p.w, p.d, p.h)));
  return { parts, mouth };
}

function spaceOf(room, mouth, renderer, kit) {
  const field = mouth ? fieldOver(mouth) : null;
  const stars = starsRound(renderer, { x: room.x, y: room.y + room.h / 2, z: room.z }, { small: kit.small });
  return { field, stars, extras: [stars.points, ...(field ? [field.mesh] : [])], owned: [stars, ...(field ? [field] : [])] };
}

// ── ST 321’s dock ──

function buildDock(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const ships = props.filter((p) => p.kind === 'lambda');
  const paint = paintMaterial();
  const b = room.box;
  const parts = kit.shell(room, layout, { floor: false, ceiling: false, bay: 4, rib: 0.7, ribDepth: 0.55, tall: 2.4, lights: true, seed: 321 });
  const bay = bayParts(kit, room, layout, { props, ships, paint, step: 6, ceiling: { step: 8, depth: 1.4 } });
  parts.push(...bay.parts);
  // the gantry along the back wall, over the corridor’s door
  parts.push(...walkway(kit, { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + 2.4 }, room.y + 10, ['south'], 'north'));
  const space = spaceOf(room, bay.mouth, renderer, kit);
  const top = room.y + room.h;
  const lamps = [
    ...ships.map((s) => ({ x: s.x, y: top - 3, z: s.z, color: COOL, intensity: 700, distance: 40 })),
    { x: room.x, y: room.y + 8, z: b.z0 + 3, color: 0xe8efff, intensity: 200, distance: 24 },
    ...(bay.mouth ? [{ x: bay.mouth.x, y: room.y + 10, z: bay.mouth.z - 4, color: SKY, intensity: 300, distance: 35 }] : []),
  ];
  const built = finish(kit, room, parts, {
    renderer,
    lamps,
    probeAt: { x: room.x + 1, y: room.y + 2.5, z: b.z0 + 8 },
    extras: space.extras,
    owned: [...space.owned, paint],
    updates: [(t) => space.field?.update(t)],
  });
  berth(room, built, ships, renderer);
  return built;
}

// ── Hangar 272 ──

function buildHangar272(kit, room, layout, { renderer = null } = {}) {
  const { props, solids } = furnish(room, layout.station);
  const ships = props.filter((p) => p.kind === 'lambda');
  const paint = paintMaterial();
  const b = room.box;
  // (no red but the Royal Guards’: the blast door’s warning light is left off)
  const parts = kit.shell(room, layout, { floor: false, ceiling: false, bay: 5, rib: 0.9, ribDepth: 0.7, tall: 3, lights: true, seed: 272 }).filter((p) => p.mat !== 'red');
  const bay = bayParts(kit, room, layout, { props, ships, paint, step: 8, ceiling: { step: 10, depth: 2, wide: 1.2 } });
  parts.push(...bay.parts);
  // two galleries round the back and the sides, braced to the walls
  for (const y of [room.y + 12, room.y + 21]) {
    parts.push(...walkway(kit, { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + 3 }, y, ['south'], 'north'));
    parts.push(...walkway(kit, { x0: b.x0, x1: b.x0 + 3, z0: b.z0 + 3, z1: b.z1 - 4 }, y, ['east'], 'west'));
    parts.push(...walkway(kit, { x0: b.x1 - 3, x1: b.x1, z0: b.z0 + 3, z1: b.z1 - 4 }, y, ['west'], 'east'));
  }
  // the ranks: each block edged in paint, a square for every place in it
  const ranks = ranksOf(room, { spots: spotsIn(room, layout), solids, doors: doorsOf(room, layout) });
  for (const block of ranks.blocks) {
    const [x0, x1, z0, z1] = [block.x0 - 0.6, block.x1 + 0.6, block.z0 - 0.6, block.z1 + 0.6];
    for (const [w, d, x, z] of [[x1 - x0, 0.1, (x0 + x1) / 2, z0], [x1 - x0, 0.1, (x0 + x1) / 2, z1], [0.1, z1 - z0, x0, (z0 + z1) / 2], [0.1, z1 - z0, x1, (z0 + z1) / 2]]) parts.push(kit.plate(w, d, x, room.y + 0.004, z, paint, 'up'));
    for (const p of block.places) parts.push(kit.plate(0.34, 0.34, p.x, room.y + 0.004, p.z, paint, 'up'));
  }
  // the aisle’s edges lit, from the foot of the ramp up to the far wall
  if (ranks.aisle) {
    const { a, b: end, half } = ranks.aisle;
    const len = Math.hypot(end.x - a.x, end.z - a.z);
    const [fx, fz] = [(end.x - a.x) / len, (end.z - a.z) / len];
    for (const s of [-1, 1]) {
      for (let t = 0.5; t + 2 < len - 1.5; t += 3) {
        const [cx, cz] = [a.x + fx * (t + 1) - fz * s * (half - 1.5), a.z + fz * (t + 1) + fx * s * (half - 1.5)];
        parts.push(kit.plate(Math.abs(fx) > 0.5 ? 2 : 0.14, Math.abs(fx) > 0.5 ? 0.14 : 2, cx, room.y + 0.006, cz, 'strip', 'up'));
      }
    }
  }
  const space = spaceOf(room, bay.mouth, renderer, kit);
  const top = room.y + room.h;
  const lamps = [
    ...ships.map((s) => ({ x: s.x, y: top - 4, z: s.z, color: COOL, intensity: 1400, distance: 60 })),
    { x: room.x - 16, y: top - 8, z: room.z - 12, color: COOL, intensity: 900, distance: 45 },
    { x: room.x + 16, y: top - 8, z: room.z - 12, color: COOL, intensity: 900, distance: 45 },
    { x: room.x, y: room.y + 14, z: b.z0 + 5, color: 0xe8efff, intensity: 500, distance: 35 },
    ...(bay.mouth ? [{ x: bay.mouth.x, y: room.y + 16, z: bay.mouth.z - 5, color: SKY, intensity: 600, distance: 50 }] : []),
  ];
  const built = finish(kit, room, parts, {
    renderer,
    lamps,
    probeAt: { x: ranks.aisle?.a.x ?? room.x, y: room.y + 2.5, z: room.z - 10 },
    extras: space.extras,
    owned: [...space.owned, paint],
    updates: [(t) => space.field?.update(t)],
  });
  berth(room, built, ships, renderer);
  return built;
}

// ── the command centre ──

// A room’s window (its `window`: its centre and size, on the named wall) as a world rect on that wall.
function windowOf(room) {
  const win = room.window;
  if (!win || win.round) return null;
  const b = room.box;
  const [y0, y1] = [win.y - win.h / 2, win.y + win.h / 2];
  if (win.wall === 'north' || win.wall === 'south') return { x0: win.x - win.w / 2, x1: win.x + win.w / 2, z0: win.wall === 'north' ? b.z0 : b.z1, z1: win.wall === 'north' ? b.z0 : b.z1, y0, y1 };
  const x = win.wall === 'west' ? b.x0 : b.x1;
  return { x0: x, x1: x, z0: win.z - win.w / 2, z1: win.z + win.w / 2, y0, y1 };
}

// The window’s surround (furnish’s frame): a deep bezel and mullions every
// three metres, a ledge under it; the glass on the wall’s line.
function bezelParts(kit, frame, win) {
  const [w, h] = [frame.w, frame.h];
  const [ow, oh] = [w - 1, h - 1];
  const local = [kit.box(w, 0.5, 0.36, 0, 0.25, 0, 'trim'), kit.box(w, 0.5, 0.36, 0, h - 0.25, 0, 'trim'), kit.box(0.5, h, 0.36, -w / 2 + 0.25, h / 2, 0, 'trim'), kit.box(0.5, h, 0.36, w / 2 - 0.25, h / 2, 0, 'trim')];
  const n = Math.max(1, Math.round(ow / 3));
  for (let i = 1; i < n; i++) local.push(kit.box(0.16, oh, 0.24, -ow / 2 + (ow * i) / n, h / 2, -0.04, 'trim'));
  local.push(kit.box(w - 0.6, 0.08, 0.5, 0, 0.42, 0.3, 'trim'), kit.box(w - 1.2, 0.03, 0.03, 0, 0.4, 0.56, 'strip'));
  const parts = onProp(kit, frame, local);
  const len = Math.hypot(win.x1 - win.x0, win.z1 - win.z0);
  const glass = new THREE.PlaneGeometry(len, win.y1 - win.y0).rotateY(Math.atan2(-(win.z1 - win.z0), win.x1 - win.x0));
  const f = { x: Math.sin(frame.yaw), z: -Math.cos(frame.yaw) };
  glass.translate((win.x0 + win.x1) / 2 + f.x * 0.05, (win.y0 + win.y1) / 2, (win.z0 + win.z1) / 2 + f.z * 0.05);
  parts.push({ geo: glass, mat: 'glass' });
  return parts;
}

function buildCommand(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const of = (kind) => props.filter((p) => p.kind === kind);
  const win = windowOf(room);
  const target = targetFace(kit, renderer);
  const blink = blinker();
  const parts = kit.shell(room, layout, { floor: false, openings: win ? [win] : [], bay: 1.6, rib: 0.24, ribDepth: 0.12, lights: true, tall: 1.4, seed: 4 });
  parts.push(...deckOf(kit, room));
  const frame = of('window-frame')[0];
  if (frame && win) parts.push(...bezelParts(kit, frame, win));
  // the aisle from the door up to the firing switch, a darker runner lit along its edges
  const door = doorsOf(room, layout)[0];
  const sw = of('switch')[0];
  if (door && sw) {
    const [z0, z1] = [Math.min(door.z, sw.z + 0.5), Math.max(door.z, sw.z + 0.5)];
    parts.push(kit.plate(1.6, z1 - z0, door.x, room.y + 0.003, (z0 + z1) / 2, 'trim', 'up'));
    for (const s of [-1, 1]) for (let z = z0 + 0.6; z < z1 - 0.6; z += 1.5) parts.push(kit.plate(0.06, 0.9, door.x + s * 0.86, room.y + 0.005, z + 0.45, 'strip', 'up'));
  }
  // light panels in coffers over the rows
  const top = room.y + room.h;
  for (let z = room.box.z0 + 3; z < room.box.z1 - 1; z += 4) {
    for (let x = room.box.x0 + 3; x < room.box.x1 - 2; x += 6) parts.push(kit.box(3, 0.16, 1.1, x + 1.5, top - 0.08, z, 'trim'), kit.plate(2.6, 0.7, x + 1.5, top - 0.165, z, 'strip', 'down'));
  }
  for (const p of of('station')) parts.push(...onProp(kit, p, consoleParts(kit, p.w, p.d)));
  for (const p of of('switch')) parts.push(...onProp(kit, p, switchParts(kit, p.w, p.d, blink.material)));
  for (const p of of('desk')) parts.push(...onProp(kit, p, deskParts(kit, p.w, p.d, p.h)));
  const names = of('nameplate').map((p) => ({ p, face: nameFace(kit, p.text ?? '', renderer) }));
  for (const { p, face } of names) parts.push(...onProp(kit, p, plateParts(kit, p.w, p.h, p.d, face.material)));
  // the screen the desk faces is the big targeting one; the other, smaller, keeps the log
  for (const s of screensOf(props)) {
    const [w, h] = s.size === 'big' ? [s.w, s.h] : [s.w * 0.65, s.h * 0.7];
    parts.push(...onProp(kit, { ...s, y: s.y + (s.h - h) / 2 }, screenParts(kit, w, h, s.size === 'big' ? target.material : 'screen')));
  }
  const rack = rackOn(kit, { ...rackOf(room, layout, props), y: room.y });
  parts.push(...rack.parts);
  const stars = starsRound(renderer, { x: room.x, y: room.y + 3, z: room.z }, { small: kit.small, seed: 4 });
  const lamps = [
    { x: room.x, y: top - 0.4, z: room.z - 3, color: COOL, intensity: 110, distance: 26 },
    { x: room.x, y: top - 0.4, z: room.box.z1 - 4, color: COOL, intensity: 80, distance: 22 },
  ];
  return finish(kit, room, parts, {
    renderer,
    lamps,
    probeAt: { x: room.x, y: room.y + 1.4, z: room.z + 2 },
    extras: [stars.points, rack.group],
    owned: [stars, target, blink, ...names.map((n) => n.face)],
    updates: [(t) => kit.update(t), (t) => target.update(t), (t) => blink.update(t)],
  });
}

// ── the tower’s antechamber ──

// A bench alcove let into a wall, in the wall’s own frame (x along it, −z
// into it): its back, sides and head, a light under the head, and a grey
// bench along the back, its front well behind the wall’s line.
function alcoveParts(kit, a, room, { deep = 0.7 } = {}) {
  const len = Math.hypot(a.x1 - a.x0, a.z1 - a.z0);
  const high = a.y1 - a.y0;
  const local = [
    kit.box(len + 0.2, high + 0.2, 0.1, len / 2, high / 2, -deep - 0.05, 'wall'),
    kit.box(0.1, high, deep, -0.05, high / 2, -deep / 2, 'trim'),
    kit.box(0.1, high, deep, len + 0.05, high / 2, -deep / 2, 'trim'),
    kit.box(len + 0.2, 0.1, deep, len / 2, high + 0.05, -deep / 2, 'trim'),
    kit.plate(len, deep, len / 2, 0, -deep / 2, 'floor', 'up'),
    kit.box(len - 0.3, 0.04, 0.06, len / 2, high - 0.06, -deep * 0.4, 'strip'),
    kit.box(len - 0.2, 0.07, 0.42, len / 2, 0.45, -deep + 0.21, 'rail'),
    kit.box(len - 0.2, 0.3, 0.06, len / 2, 0.75, -deep + 0.03, 'rail'),
  ];
  for (const t of [0.4, len / 2, len - 0.4]) local.push(kit.box(0.08, 0.42, 0.34, t, 0.21, -deep + 0.21, 'trim'));
  const turn = Math.atan2(-(a.z1 - a.z0), a.x1 - a.x0);
  return kit.place(local, kit.at(a.x0, room.y, a.z0, turn));
}

// The lift’s portal: pilasters either side of its door to the ceiling,
// lit down their faces, a deep lintel with a band of light over it and a
// dark panel above, in the wall’s own frame.
function portalParts(kit, run, hole, room) {
  const [c, w, h] = [(hole.x0 + hole.x1) / 2, hole.x1 - hole.x0, hole.y1 - hole.y0];
  const tall = run.y1 - run.y0;
  const local = [kit.box(w + 2.6, 0.7, 0.42, c, h + 0.6, 0.21, 'trim'), kit.box(w + 1.4, 0.12, 0.05, c, h + 1.1, 0.03, 'strip'), kit.box(w + 1.6, tall - h - 1.6, 0.06, c, (h + 1.3 + tall - 0.3) / 2, 0.03, 'black')];
  for (const s of [-1, 1]) {
    const x = c + s * (w / 2 + 0.75);
    local.push(kit.box(0.8, tall, 0.4, x, tall / 2, 0.2, 'trim'), kit.box(0.1, tall - 1.2, 0.02, x, tall / 2, 0.41, 'strip'));
  }
  return kit.place(local, kit.at(run.x0, room.y, run.z0, run.angle));
}

function buildHolding(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const alcoves = alcovesOf(room, layout);
  const parts = kit.shell(room, layout, { floor: false, openings: alcoves.map((a) => ({ ...a, frame: 'door' })), bay: 2, rib: 0.3, ribDepth: 0.18, lights: true, tall: 1.8, seed: 41 });
  parts.push(...deckOf(kit, room));
  for (const a of alcoves) parts.push(...alcoveParts(kit, a, room));
  for (const p of props.filter((q) => q.kind === 'column')) parts.push(...onProp(kit, p, columnParts(kit, p.w, p.h)));
  for (const p of props.filter((q) => q.kind === 'guard-post')) parts.push(...onProp(kit, p, postParts(kit, p.w, p.d)));
  // the way from the corridor to the lift: a runner lit along its edges
  const doors = doorsOf(room, layout);
  const lift = doors.find((d) => layout.rooms.get(otherSide(d, room.id))?.kind === 'lift');
  const way = doors.find((d) => d !== lift);
  if (lift && way && lift.axis === 'x' && Math.abs(lift.x - way.x) < 0.05) {
    const [z0, z1] = [Math.min(lift.z, way.z), Math.max(lift.z, way.z)];
    parts.push(kit.plate(2.2, z1 - z0 - 2, lift.x, room.y + 0.003, (z0 + z1) / 2, 'trim', 'up'));
    for (const s of [-1, 1]) parts.push(kit.plate(0.06, z1 - z0 - 2.4, lift.x + s * 1.16, room.y + 0.005, (z0 + z1) / 2, 'strip', 'up'));
  }
  for (const run of roomWalls(layout, room.id)) {
    for (const h of run.holes) if (h.door === lift?.id) parts.push(...portalParts(kit, run, h, room));
  }
  // a coffer down the middle, lit, and a light panel either side
  const top = room.y + room.h;
  const [w, d] = [room.box.x1 - room.box.x0, room.box.z1 - room.box.z0];
  parts.push(kit.box(3.2, 0.3, d - 4, room.x, top - 0.15, room.z, 'trim'), kit.plate(2.6, d - 4.6, room.x, top - 0.305, room.z, 'strip', 'down'));
  for (const s of [-1, 1]) parts.push(kit.plate(1.2, d - 6, room.x + s * w * 0.28, top - 0.01, room.z, 'strip', 'down'));
  const lamps = [
    { x: room.x, y: top - 0.5, z: room.z - d * 0.25, color: COOL, intensity: 90, distance: 22 },
    { x: room.x, y: top - 0.5, z: room.z + d * 0.25, color: COOL, intensity: 70, distance: 20 },
  ];
  return finish(kit, room, parts, { renderer, lamps, probeAt: { x: room.x, y: room.y + 1.4, z: room.z } });
}

export const DS2_A = { dock: buildDock, command: buildCommand, holding: buildHolding, hangar: buildHangar272 };
