// What the game’s happenings look like, and what its windows look out on:
// a muzzle’s flash on every shot, sparks and a scorch where a bolt strikes
// the wall, sparks off whoever it hits, a burst where a camera or a panel
// is blown, a blade’s clash where it meets a bolt or a body; the
// lightsabers in the hands of whoever carries one (yours, swung when you
// strike; Vader’s and Obi-Wan’s lit once they fight); the faint ripple at
// your throat when Vader takes it; and the view through each window
// (Alderaan from the first station’s overbridge, Endor from the second’s
// command centre, the battle from the Emperor’s round window), made when
// its room is built and let go when the room is freed. It draws nothing
// the game needs, and reads the game only to draw it.
//
//   VIEWS → { [station]: { [roomId]: { kind, wall? } } }   which rooms look out on what
//   wallYaw(wall) → radians   the turn that points a view’s −z out through 'north' | 'south' | 'east' | 'west'
//   viewsOf(layout) → [{ room, kind, x, y, z, yaw }]   pure: each window’s view, at the window’s middle
//   bladeColour(c) → 'red' | 'green' | 'blue' | number | null   the rules’ name or the cast’s number, as saber.js takes it
//   bladeDir(yaw, k) → { x, y, z }   pure: a held blade’s way, up and forward at rest (k null), and k of
//     the way through a swing from high on the right to low on the left
//   effectsOf(event) → [{ kind: 'spark' | 'scorch' | 'flare' | 'clash' | 'explode' | 'smoke', at, … }]   pure
//   createShow(scene, { renderer, tier, layout, people, fx }) → show
//     hear(events)   the game’s events since the last frame
//     sync({ g, at, yaw, crouch, rooms, dt, t })   once a frame after the people: `at` where you are drawn
//     warm(renderer, camera, target?) → Promise;  dispose()

import * as THREE from 'three';
import { CAST } from '../rules/cast';
import { createSabers } from './saber';
import { createView } from './views';

export const VIEWS = {
  ds1: { overbridge: { kind: 'alderaan', wall: 'north' } },
  ds2: { command: { kind: 'endor' }, throne: { kind: 'endor-battle' } },
};
const SWING = 0.3; // seconds a swing of your blade takes
const CHOKE = 1.6; // seconds the ripple stays at your throat
const FIGHTING = new Set(['fight', 'wary', 'search']);
// where a blade’s hilt is held, from the feet: to the right, up and forward of whoever holds it
const GRIP = { right: 0.28, up: 1.02, forward: 0.3, crouch: 0.4 };
// the way out of the fist along a Meshy right hand's own axes: across the palm, by the thumb
const HILT_AXIS = { x: 0, y: 0, z: 1 };

const YAWS = { north: 0, south: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 };
export const wallYaw = (wall) => YAWS[wall] ?? 0;

export function viewsOf(layout) {
  const out = [];
  for (const [id, v] of Object.entries(VIEWS[layout.station.id] ?? {})) {
    const room = layout.rooms.get(id);
    if (!room) continue;
    const win = room.window;
    const wall = win?.wall ?? v.wall ?? 'north';
    const b = room.box;
    const y = win?.y ?? room.y + room.h / 2;
    const along = wall === 'north' || wall === 'south';
    const x = along ? (win?.x ?? room.x) : wall === 'east' ? b.x1 : b.x0;
    const z = along ? (wall === 'north' ? b.z0 : b.z1) : (win?.z ?? room.z);
    out.push({ room: id, kind: v.kind, x, y, z, yaw: wallYaw(wall) });
  }
  return out;
}

export const bladeColour = (c) => (c == null ? null : c);

export function bladeDir(yaw, k) {
  // right, up and forward in the holder’s own frame
  const [r, u, f] = k == null ? [0.1, 0.83, 0.55] : [Math.cos(Math.PI * k) * 0.85, 0.55 - 0.9 * k, 0.35 + Math.sin(Math.PI * k) * 0.9];
  const n = Math.hypot(r, u, f);
  const [s, c] = [Math.sin(yaw), Math.cos(yaw)];
  return { x: (r * c + f * s) / n, y: u / n, z: (r * s - f * c) / n };
}

const point = (e) => ({ x: e.x, y: e.y, z: e.z });

export function effectsOf(e) {
  switch (e.type) {
    case 'impact':
      return [
        { kind: 'spark', at: point(e), n: 6, normal: e.normal ?? null },
        { kind: 'scorch', at: point(e), normal: e.normal ?? { x: 0, y: 1, z: 0 } },
      ];
    case 'shot':
      return e.at ? [{ kind: 'flare', at: e.at, by: e.by }] : [];
    case 'hit':
      return [e.by === 'blade' ? { kind: 'clash', at: point(e), how: 'hit' } : { kind: 'spark', at: point(e), n: 4, normal: null }];
    case 'deflect':
      return [{ kind: 'clash', at: point(e), how: 'deflect' }];
    case 'broke':
      return [
        { kind: 'explode', at: { x: e.x, y: e.y + 1, z: e.z }, size: 0.8 },
        { kind: 'smoke', at: { x: e.x, y: e.y + 1.4, z: e.z }, size: 0.7 },
      ];
    case 'blast':
      return [{ kind: 'explode', at: { x: e.at.x, y: e.at.y + 1.2, z: e.at.z }, size: 1.2 }];
    // the station coming apart: a panel bursting off the wall, sparks raining off it, and the smoke after
    case 'quake':
      return e.at
        ? [
            { kind: 'explode', at: point(e.at), size: 0.5 + 0.7 * (e.size ?? 1) },
            { kind: 'spark', at: point(e.at), n: 10, normal: null },
            { kind: 'smoke', at: { x: e.at.x, y: e.at.y + 0.4, z: e.at.z }, size: 0.9 },
          ]
        : [];
    default:
      return [];
  }
}

export function createShow(scene, { renderer, tier = 'high', layout, people, fx }) {
  const sabers = createSabers(scene, { tier });
  const places = viewsOf(layout);
  const views = new Map(); // roomId → view
  const blades = new Map(); // id → { handle, anchor }
  const muzzle = new THREE.Vector3();
  let clock = 0;
  let swungAt = -Infinity;
  let chokeUntil = -Infinity;

  function bladeFor(id, colour) {
    let b = blades.get(id);
    if (!b) {
      const anchor = new THREE.Object3D();
      scene.add(anchor);
      b = { anchor, on: anchor, handle: sabers.blade(id, colour).attach(anchor) };
      blades.set(id, b);
    }
    return b;
  }
  function dropBlade(id) {
    const b = blades.get(id);
    b.handle.release();
    b.anchor.removeFromParent();
    blades.delete(id);
  }
  // In its owner's fist when the figure has one (its right hand's bone, the hilt along the hand's
  // HILT_AXIS, swung by the figure's own sabre clips); else at the grip in front of the body, aimed
  // as bladeDir has it
  function hold(b, at, yaw, low, dir, lit, hand = null) {
    if (hand) {
      if (b.on !== hand) {
        b.on = hand;
        b.handle.attach(hand, HILT_AXIS);
      }
      b.handle.aim(null).on(lit);
      return;
    }
    if (b.on !== b.anchor) {
      b.on = b.anchor;
      b.handle.attach(b.anchor);
    }
    const [s, c] = [Math.sin(yaw), Math.cos(yaw)];
    b.anchor.position.set(at.x + GRIP.right * c + GRIP.forward * s, at.y + GRIP.up - (low ? GRIP.crouch : 0), at.z + GRIP.right * s - GRIP.forward * c);
    b.handle.aim(dir).on(lit);
  }

  function apply(f) {
    if (f.kind === 'spark') fx.spark(f.at, f.n, f.normal ?? undefined);
    else if (f.kind === 'scorch') fx.scorch(f.at, f.normal);
    else if (f.kind === 'flare') fx.flare(f.by !== 'you' ? (people.muzzle(f.by, muzzle) ?? f.at) : f.at);
    else if (f.kind === 'clash') sabers.clash(f.at, f.how);
    else if (f.kind === 'explode') fx.explode(f.at, f.size);
    else if (f.kind === 'smoke') fx.smoke(f.at, f.size);
  }

  function hear(events) {
    for (const e of events ?? []) {
      if (e.type === 'swing') swungAt = clock;
      else if (e.type === 'choked') chokeUntil = clock + CHOKE;
      for (const f of effectsOf(e)) apply(f);
    }
  }

  function syncViews(rooms, t, dt) {
    for (const p of places) {
      const v = views.get(p.room);
      if (!rooms.built(p.room)) {
        if (v) {
          v.dispose();
          views.delete(p.room);
        }
        continue;
      }
      if (!v) {
        const made = createView(p.kind, { renderer, tier });
        made.object.position.set(p.x, p.y, p.z);
        made.object.rotation.y = p.yaw;
        scene.add(made.object);
        views.set(p.room, made);
        continue;
      }
      v.object.visible = rooms.shown(p.room);
      if (v.object.visible) v.update(t, dt);
    }
  }

  function sync({ g, at, yaw, crouch = false, rooms, dt = 0, t = 0, hand = null }) {
    clock += dt;
    const you = g.you;
    const k = clock - swungAt < SWING ? (clock - swungAt) / SWING : null;
    if (you.blade && you.hp > 0) hold(bladeFor('you', bladeColour(you.blade)), at, yaw, crouch, bladeDir(yaw, k), true, hand);
    else if (blades.has('you')) dropBlade('you');
    const seen = new Set(['you']);
    const duel = g.scene?.id === 'duel' || g.scene?.id === 'throw';
    for (const p of g.crew?.people ?? []) {
      const blade = CAST[p.kind]?.blade;
      if (blade?.type !== 'saber' || p.hp <= 0 || !rooms.shown(p.room)) continue;
      seen.add(p.id);
      // (lit in a fight, a scene's duel, or the blade fight rules/play/duel.js runs, scripted or not)
      const lit = FIGHTING.has(p.mode) || duel || Boolean(p.mind?.duel) || p.hostile === true;
      hold(bladeFor(p.id, bladeColour(blade.colour)), p, p.yaw ?? 0, false, bladeDir(p.yaw ?? 0, null), lit, people.handOf?.(p.id) ?? null);
    }
    for (const id of [...blades.keys()]) if (!seen.has(id)) dropBlade(id);
    sabers.choke({ x: at.x, y: at.y + 1.6, z: at.z }, clock < chokeUntil);
    syncViews(rooms, t, dt);
    sabers.update(dt);
  }

  return {
    hear,
    sync,
    // the Emperor's lightning from a point (or his two hands) to another, for a scene (cinematics.js)
    lightning: (from, to, on = true) => sabers.lightning(from, to, on),
    warm: (r, camera, target = null) => sabers.warm(r, camera, target),
    dispose() {
      for (const id of [...blades.keys()]) dropBlade(id);
      for (const v of views.values()) v.dispose();
      views.clear();
      sabers.dispose();
    },
  };
}
