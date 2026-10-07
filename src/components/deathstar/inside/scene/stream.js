// Which of a station’s rooms stand in the scene, and which are drawn. A
// station is far too big to build whole and a room behind a shut door
// can’t be seen, so the stream keeps only the rooms round you: it builds
// a room once it is within two doors of where you stand (a lift ride is
// no door: the levels it joins are far apart), draws it only while you
// are in it or can see into it, and frees it once it is more than four
// doors away (the rooms between two and four doors stay as they are, so
// stepping back and forth through a door never frees what it built).
// Building is spread one room a frame, so walking on never stalls a
// frame on a whole floor’s worth of geometry. What it builds and frees
// is only the drawing: the people, bolts and doors in a room live in the
// game, which the stream never touches, so a fight goes on in a room it
// has freed and its figures stand where the game says when it is back.
//
// The lamps: three.js rebuilds every lit material’s shader when the
// number of lights in the scene changes, so the stream keeps a fixed
// pool of point lights, as many as the tier can afford (high 12, mid 8,
// low 4), dark while unused, and hands them each frame to the lamps of
// the shown rooms nearest the eye, easing each one up and down. A lamp
// left behind goes out at that pace before its light passes to a nearer
// one, so it never blinks out; and a lit lamp keeps its light until
// another is nearer by a clear margin, so an eye swaying about the point
// halfway between two lamps doesn’t trade them back and forth.
//
//   plan(layout, here, open: (doorId) → bool, built?) → { build, show, free }   pure: Sets of room ids
//     open: whether a doorway can be seen through at all (a leaf open the least bit, not yet
//       passable), so the room beyond is there as a door starts to slide and while it shuts
//     build: here and every room within 2 doors, open or shut, and whatever is shown
//     show: here, the room through each of its open doors and, when the way passes an open
//       arch, one room on from that; and from a control room, the bay its windows look onto
//     free: those of `built` (an iterable of room ids; every room when absent) more than 4
//       doors away, or reached only by lift
//   createStream(kit, layout, scene, { renderer, tier, small, builders }) → stream
//     stream.update(here, open, t, dt, ctx)   once a frame: frees the far rooms, builds at most
//       one (here first, then what can be seen, then the nearest), hides what can’t be seen, runs
//       each shown room’s update(t, dt, ctx) and lights the lamps nearest ctx.eye ({ x, y, z };
//       the middle of here without it). A `here` the layout lacks (null in a void) keeps the last.
//     stream.built: Map<roomId, { group, lamps, update?, dispose }>   what each builder made
//     stream.ready: Promise   settles once the builders are in hand; nothing is built before
//     stream.dispose()
//   builders: ROOM_BUILDERS[kind](kit, room, layout, { renderer, tier, small }) → { group, lamps:
//     [{ x, y, z, color, intensity, distance }], update?, dispose }, or a promise of them; loaded
//     from scene/rooms when absent. Lamps are in station coordinates, as the layout is, and are
//     read every frame, so a room may move or dim its own. A kind with no builder yet (or whose
//     builder fails) stands as a plain lit grey box the size of its room.

import * as THREE from 'three';

const NEAR = 2; // a room this many doors away or fewer is built
const FAR = 4; // a built room more doors away than this is freed
const LAMPS = { ultra: 12, high: 12, mid: 8, low: 4 }; // point lights a tier can afford at once
const FADE = 0.3; // seconds for a lamp to come up, or go down
const KEEP = 1; // metres nearer than a lit lamp another must be to take its light…
const KEEP_SHARE = 0.1; // …or this share of the lit lamp’s distance, if more: a far pair is told apart less finely
const EYE = 1.6; // how high the eye is taken to be when the caller doesn’t say
const TOUCH = 0.01; // walls nearer than this stand back to back (as kit.js’ windowsOf has it)

const across = (door, id) => (door.a === id ? door.b : door.a);

// How many doors each room within `limit` doors of `here` is, breadth
// first, so a room comes before any further than it.
function doorsAway(layout, here, limit) {
  const away = new Map([[here, 0]]);
  const queue = [here];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const n = away.get(id);
    if (n === limit) continue;
    for (const doorId of layout.rooms.get(id).doors) {
      const next = across(layout.doors.get(doorId), id);
      if (away.has(next) || !layout.rooms.has(next)) continue;
      away.set(next, n + 1);
      queue.push(next);
    }
  }
  return away;
}

// A doorway shows the room beyond it and nothing past: the next door is
// a slot seen at an angle across that room. An arch is a whole wall
// open (a bay’s mouth, a shaft’s rim), so a look that passes one, either
// door of the two, carries on into the room after.
function inSight(layout, here, open) {
  const show = new Set([here]);
  for (const first of layout.rooms.get(here).doors) {
    const d1 = layout.doors.get(first);
    const room = across(d1, here);
    if (!layout.rooms.has(room) || !open(first)) continue;
    show.add(room);
    for (const second of layout.rooms.get(room).doors) {
      const d2 = layout.doors.get(second);
      const beyond = across(d2, room);
      if (second === first || !layout.rooms.has(beyond) || (d1.kind !== 'arch' && d2.kind !== 'arch')) continue;
      if (open(second)) show.add(beyond);
    }
  }
  for (const id of baysSeenFrom(layout, layout.rooms.get(here))) show.add(id);
  return show;
}

// A control room has windows in each of its walls that a bay’s wall
// backs onto (kit.js’ windowsOf cuts them in both), so from inside it the
// bay is in sight whatever its door. Only that way: from the deck the
// office is a few lit panes high on a wall, too little to draw a room
// for, so the bay lights them itself.
function baysSeenFrom(layout, room) {
  if (room.kind !== 'control') return [];
  const c = room.box;
  const meet = (p, q) => p.some((a) => q.some((b) => Math.abs(a - b) < TOUCH));
  const seen = [];
  for (const r of layout.rooms.values()) {
    if (r.kind !== 'hangar') continue;
    const b = r.box;
    const alongX = meet([c.z0, c.z1], [b.z0, b.z1]) && c.x0 < b.x1 && b.x0 < c.x1;
    const alongZ = meet([c.x0, c.x1], [b.x0, b.x1]) && c.z0 < b.z1 && b.z0 < c.z1;
    if (alongX || alongZ) seen.push(r.id);
  }
  return seen;
}

export function plan(layout, here, open, built = layout.rooms.keys()) {
  const build = new Set();
  const show = new Set();
  const free = new Set();
  if (!layout.rooms.has(here)) return { build, show, free };
  const away = doorsAway(layout, here, FAR);
  for (const [id, n] of away) if (n <= NEAR) build.add(id);
  for (const id of inSight(layout, here, open)) {
    show.add(id);
    build.add(id);
  }
  for (const id of built) if (!away.has(id) && !show.has(id)) free.add(id);
  return { build, show, free };
}

export function createStream(kit, layout, scene, { renderer = null, tier = kit?.tier ?? 'high', small = kit?.small ?? false, builders } = {}) {
  const built = new Map();
  const coming = typeof builders?.then === 'function';
  let made = builders && !coming ? builders : null;
  // Without them in hand, the builders come with the rooms’ own code,
  // which this module doesn’t import so that plan stays light to load.
  // Should they fail, every room stands as a grey box: walkable still.
  const ready = made
    ? Promise.resolve()
    : Promise.resolve(builders ?? import('./rooms/index.js').then((m) => m.ROOM_BUILDERS))
        .then((b) => {
          made = b;
        })
        .catch((err) => {
          console.error('The Death Star’s rooms didn’t load; plain boxes stand in', err);
          made = {};
        });
  let grey = null; // the stand-in boxes’ material, made with the first
  let at = null; // the room you were last in
  let disposed = false;

  // each light: the lamp it shows, how far up it is, and the lamp waiting
  // for it to go dark (a nearer one, when no light was idle)
  const pool = Array.from({ length: LAMPS[tier] ?? LAMPS.high }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 0, 2);
    scene.add(light);
    return { light, lamp: null, glow: 0, next: null };
  });
  let held = new Set(); // the lamps wanted last frame

  function standIn(room) {
    const group = new THREE.Group();
    group.name = room.id;
    // the field across a bay’s mouth is space and shimmer, drawn by the bay
    if (room.kind === 'field') return { group, lamps: [], dispose() {} };
    // drawn from inside: from outside, the near walls vanish and a doorway shows the room
    grey ??= new THREE.MeshStandardMaterial({ color: 0x70747b, roughness: 0.85, side: THREE.BackSide });
    const geometry = room.round ? new THREE.CylinderGeometry(room.w / 2, room.w / 2, room.h, 24) : new THREE.BoxGeometry(room.w, room.h, room.d);
    const box = new THREE.Mesh(geometry, grey);
    box.position.set(room.x, room.y + room.h / 2, room.z);
    group.add(box);
    const lamp = { x: room.x, y: room.y + room.h * 0.8, z: room.z, color: 0xdfe6f0, intensity: 3 * room.h ** 2, distance: Math.hypot(room.w, room.h, room.d) };
    return { group, lamps: [lamp], dispose: () => geometry.dispose() };
  }

  function raise(id) {
    const room = layout.rooms.get(id);
    const build = made[room.kind];
    let r;
    try {
      r = build ? build(kit, room, layout, { renderer, tier, small }) : standIn(room);
    } catch (err) {
      console.error(`The Death Star’s ${room.kind} builder failed on ${id}; a plain box stands in`, err);
      r = standIn(room);
    }
    built.set(id, r);
    scene.add(r.group);
  }

  function drop(id) {
    const r = built.get(id);
    scene.remove(r.group);
    r.dispose();
    built.delete(id);
  }

  const unbuilt = (ids) => {
    for (const id of ids) if (!built.has(id)) return id;
    return null;
  };

  function light(show, eye, dt) {
    const lamps = [];
    for (const id of show) for (const lamp of built.get(id)?.lamps ?? []) lamps.push(lamp);
    // A lamp wanted last frame counts as nearer than it is, so it gives way
    // only to one clearly nearer, not each time the eye sways past halfway.
    const rank = new Map();
    for (const l of lamps) {
      const d = Math.hypot(l.x - eye.x, l.y - eye.y, l.z - eye.z);
      rank.set(l, held.has(l) ? d - Math.max(KEEP, d * KEEP_SHARE) : d);
    }
    lamps.sort((a, b) => rank.get(a) - rank.get(b));
    const wanted = new Set(lamps.slice(0, pool.length));
    held = wanted;
    // a light whose own lamp is wanted again comes back up from where it
    // was, and one whose waiting lamp is no longer wanted keeps no place for it
    for (const s of pool) if (s.next && (wanted.has(s.lamp) || !wanted.has(s.next))) s.next = null;
    for (const lamp of wanted) {
      if (pool.some((s) => s.lamp === lamp || s.next === lamp)) continue;
      const idle = pool.find((s) => s.lamp === null);
      if (idle) {
        idle.lamp = lamp;
        continue;
      }
      // else the dimmest of those going out with no lamp waiting yet, which
      // it takes once dark (there is always one: fewer lamps are wanted than
      // there are lights, and a waiting lamp is wanted)
      let slot = null;
      for (const s of pool) if (!wanted.has(s.lamp) && !s.next && (!slot || s.glow < slot.glow)) slot = s;
      slot.next = lamp;
    }
    const step = dt / FADE;
    for (const s of pool) {
      const on = s.lamp !== null && wanted.has(s.lamp);
      s.glow = on ? Math.min(1, s.glow + step) : Math.max(0, s.glow - step);
      if (!on && s.glow === 0) {
        s.lamp = s.next;
        s.next = null;
      }
      if (s.lamp) {
        s.light.position.set(s.lamp.x, s.lamp.y, s.lamp.z);
        s.light.color.set(s.lamp.color);
        s.light.distance = s.lamp.distance;
      }
      s.light.intensity = s.lamp ? s.lamp.intensity * s.glow : 0;
    }
  }

  function update(here, open, t, dt, ctx = {}) {
    if (disposed) return;
    if (layout.rooms.has(here)) at = here;
    if (at === null) return;
    const { build, show, free } = plan(layout, at, open, built.keys());
    for (const id of free) drop(id);
    const next = made && (unbuilt(show) ?? unbuilt(build));
    if (next) raise(next);
    for (const [id, r] of built) r.group.visible = show.has(id);
    for (const id of show) built.get(id)?.update?.(t, dt, ctx);
    const room = layout.rooms.get(at);
    light(show, ctx?.eye ?? { x: room.x, y: room.y + EYE, z: room.z }, dt);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const id of [...built.keys()]) drop(id);
    for (const s of pool) {
      scene.remove(s.light);
      s.light.dispose();
    }
    grey?.dispose();
  }

  return { update, built, ready, dispose };
}
