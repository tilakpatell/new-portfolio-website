// The Death Star’s inside, drawn: what module.js draws through each frame.
// It holds nothing the game needs. The rooms come and go with the stream
// (built near you, drawn while seen, freed far off); the doors’ leaves are
// drawn here from the game’s door states, since a room leaves its doorways
// open in their frames (a sliding door parts sideways into the wall, a
// blast door drops from above, a hatch swings on its hinge); the player
// is a rigged figure (figures.js), a stormtrooper whenever in armour; the
// people aboard are drawn from the game’s crew (people.js) and the bolts
// in the air from its combat (fx.js); and the camera stands over the
// shoulder or at the eyes, kept out of the walls (camera.js). The game
// steps at 30 Hz and a frame falls between two steps, so the player is
// drawn between where the last two steps put them. Everything is in the
// house look (lib/three/house.js); bloom is the module’s (rt.gfx.post), so
// render() draws just the scene through the camera.
//
//   leafPlaces(door, open) → [{ x0, x1, y0, y1, lead, swing? }]   pure: the leaves’ rects still in the
//     doorway (x along the door from its middle, y up from its floor), `lead` the edge that moves;
//     a hatch’s one leaf is always whole, turned `swing` radians on its x0 edge
//   createTrack() → { push(time, body), at(alpha) → { x, y, z, yaw }, speed() }   pure: a body between
//     its last two steps; a jump of more than 3 m (a lift ride, a teleport) is drawn where it lands
//   roomsOf(stream) → { shown(roomId), built(roomId), dt }   what people.js is told of the rooms: drawn
//     while the stream shows them, standing from when they are built until the stream frees them (a
//     body is let go only then, so the two mustn’t be swapped: a door shut on the dead would take them)
//   createScene(renderer, { tier, small, station }) → { scene, camera, layout, ready, sync, warm, resize, render, dispose }
//     sync(g, alpha, look?)   once a frame, after the game’s steps: g as rules/game.js keeps it
//       ({ side, you: body & { room, crouch, hp, gun, armour, hero, pitch? }, doors, time, crew?, combat? }),
//       alpha how far the frame is from the last step to the next; look: { yaw, pitch, view, aim } as
//       the module holds them (the mouse turns the eye every frame, not every step); without it, the
//       body’s yaw, level, third person. crew: rules/brains.js’s ({ people }), each person drawn;
//       combat: rules/combat.js’s ({ bolts }), every bolt in the air given to the effects, then they step
//     ready: settles once the rooms’ builders are in hand
//     warm(target?) → Promise   compiles the fight’s effects for where the scene is drawn (the bloom
//       chain’s buffer, or the screen without one), so the first shot doesn’t stall a frame
//     resize(w, h), render(), dispose() (puts the renderer’s tone mapping back as it found it)

import * as THREE from 'three';
import { houseOn } from '../../../../lib/three/house';
import { passable } from '../rules/doors';
import { buildLayout } from '../rules/layout';
import { STATIONS } from '../rules/stations';
import { CAMERA, cameraPose, wallHits } from './camera';
import { loadPerson, playerKind } from './figures';
import { createFx } from './fx';
import { createKit } from './kit';
import { createPeople } from './people';
import { createStream } from './stream';

const STEP = 1 / 30; // the game’s step (rules/game.js)
const JUMP = 3; // metres between two steps that are a ride or a teleport, not a stride
const EASE_OUT = 3; // metres a second the camera eases back out once a wall is passed
const FOV = 70; // degrees, top to bottom, on a screen wider than tall
const THICK = { slide: 0.08, hatch: 0.1, blast: 0.3 }; // a leaf’s thickness
const LEAF = { color: 0x666b72, roughness: 0.42, metalness: 0.45 }; // the leaves’ grey: lighter than the trim, darker than the walls
const SWING = (100 * Math.PI) / 180; // how far an open hatch has turned on its hinge: past square, back towards the wall
const TINY = 1e-3; // metres: a leaf thinner than this has gone into the wall

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function leafPlaces(door, open) {
  const { w, h } = door;
  const k = clamp(open ?? 0, 0, 1);
  const rects = [];
  if (door.kind === 'arch') return rects;
  if (door.kind === 'slide') {
    const s = (k * w) / 2;
    // each half slides out by s; what has gone past the jamb is in the wall
    rects.push({ x0: -w / 2, x1: 0 - s, y0: 0, y1: h, lead: 'x1' }, { x0: 0 + s, x1: w / 2, y0: 0, y1: h, lead: 'x0' });
  } else if (door.kind === 'hatch') {
    // a hatch is one leaf hung on its x0 edge: it turns out of the way whole, so it is always there
    rects.push({ x0: -w / 2, x1: w / 2, y0: 0, y1: h, lead: 'x1', swing: k * SWING });
  } else rects.push({ x0: -w / 2, x1: w / 2, y0: k * h, y1: h, lead: 'y0' });
  return rects.filter((r) => r.x1 - r.x0 > TINY && r.y1 - r.y0 > TINY);
}

export function createTrack() {
  let prev = null;
  let cur = null;
  const snap = (time, b) => ({ time, x: b.x, y: b.y, z: b.z, yaw: b.yaw ?? 0 });
  return {
    push(time, body) {
      if (cur && time === cur.time) return;
      const next = snap(time, body);
      // a new game (time going back), a ride or a teleport: drawn where it is, not swept there
      const jumped = !cur || time < cur.time || Math.hypot(next.x - cur.x, next.y - cur.y, next.z - cur.z) > JUMP;
      prev = jumped ? next : cur;
      cur = next;
    },
    at(alpha) {
      if (!cur) return { x: 0, y: 0, z: 0, yaw: 0 };
      const a = clamp(alpha, 0, 1);
      return { x: prev.x + (cur.x - prev.x) * a, y: prev.y + (cur.y - prev.y) * a, z: prev.z + (cur.z - prev.z) * a, yaw: prev.yaw + wrap(cur.yaw - prev.yaw) * a };
    },
    speed() {
      if (!cur || cur.time <= prev.time) return 0;
      return Math.hypot(cur.x - prev.x, cur.z - prev.z) / (cur.time - prev.time);
    },
  };
}

export function roomsOf(stream) {
  return {
    shown: (id) => stream.built.get(id)?.group.visible ?? false,
    built: (id) => stream.built.has(id),
    dt: 0,
  };
}

export function createScene(renderer, { tier = 'high', small = false, station = 'ds1' } = {}) {
  const layout = buildLayout(STATIONS[station] ?? STATIONS.ds1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 2000);
  // a faint cool fill under the lamps, so a face turned from every lamp
  // isn’t lost, and the house look has a sky light to take its shade from
  const hemi = new THREE.HemisphereLight(0x9aa6b8, 0x0d0f13, 0.35);
  scene.add(hemi);
  const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure };
  renderer.toneMappingExposure = 1;
  const house = houseOn({ renderer, scene, hemi, look: { fog: false } });
  const kit = createKit(renderer, { tier, small });
  const stream = createStream(kit, layout, scene, { renderer, tier, small });
  const rooms = roomsOf(stream);
  // (each figure and gun takes the house look as it comes into the scene, before it is first drawn)
  const people = createPeople(scene, kit, { tier, renderer, adopt: house.adopt });
  const fx = createFx(scene, { small });
  const leafMat = new THREE.MeshStandardMaterial(LEAF);
  // every leaf’s body and edge, a unit cube scaled to its part
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const leaves = new Map(); // doorId → { group, parts: [{ body, edge }] }
  const track = createTrack();
  let person = null;
  let wanted = null; // the kind the player should be drawn as
  let downed = false;
  let held = CAMERA.back; // how far behind the shoulder the camera stood last frame
  let shown = -1; // the last displayed time
  let frames = 0;
  let seenRooms = -1;
  let disposed = false;

  // ── the player ──

  function becomes(kind) {
    if (kind === wanted) return;
    wanted = kind;
    loadPerson(kind, { renderer })
      .then((p) => {
        if (disposed || wanted !== kind) return p.dispose();
        person?.dispose();
        person = p;
        downed = false;
        scene.add(p.object);
        house.adopt(p.object);
      })
      .catch((err) => console.error(`Aboard the Death Star: the player’s figure (${kind}) didn’t load`, err));
  }

  // ── the doors’ leaves ──

  // One leaf a moving part: a box for its body, scaled each frame to the
  // part still in the doorway, and a dark seam (a sliding door’s meeting
  // edge, a hatch’s free edge) or a lip (a dropping door’s foot) riding its
  // leading edge. Both hang from a pivot on the leaf’s x0 edge, which only
  // a hatch turns.
  function leavesFor(door) {
    const group = new THREE.Group();
    group.name = `door-${door.id}`;
    group.position.set(door.x, door.y, door.z);
    group.rotation.y = door.axis === 'z' ? Math.PI / 2 : 0;
    const t = THICK[door.kind] ?? THICK.slide;
    const parts = leafPlaces(door, 0).map(({ lead }) => {
      const pivot = new THREE.Group();
      const body = new THREE.Mesh(unitBox, leafMat);
      body.scale.z = t;
      const edge = new THREE.Mesh(unitBox, kit.mat(door.kind === 'blast' ? 'trim' : 'black'));
      edge.scale.z = t + 0.02;
      pivot.add(body, edge);
      group.add(pivot);
      return { lead, pivot, body, edge };
    });
    scene.add(group);
    house.adopt(group);
    return { group, parts };
  }

  function placeLeaves(door, entry, open) {
    const rects = leafPlaces(door, open);
    for (const { lead, pivot, body, edge } of entry.parts) {
      const r = rects.find((q) => q.lead === lead);
      pivot.visible = Boolean(r);
      if (!r) continue;
      const [w, h, t] = [r.x1 - r.x0, r.y1 - r.y0, body.scale.z];
      pivot.position.x = r.x0;
      pivot.rotation.y = r.swing ?? 0;
      body.scale.set(w, h, t);
      body.position.set(w / 2, (r.y0 + r.y1) / 2, 0);
      if (lead === 'y0') {
        const lip = Math.min(0.12, h);
        edge.scale.set(w, lip, t + 0.02);
        edge.position.set(w / 2, r.y0 + lip / 2, 0);
      } else {
        const seam = Math.min(0.03, w);
        edge.scale.set(seam, h, t + 0.02);
        edge.position.set(lead === 'x1' ? w - seam / 2 : seam / 2, body.position.y, 0);
      }
    }
  }

  function dropLeaves(id) {
    leaves.get(id).group.removeFromParent();
    leaves.delete(id);
  }

  function syncLeaves(doors) {
    for (const door of layout.doors.values()) {
      if (door.kind === 'arch') continue;
      const near = stream.built.has(door.a) || stream.built.has(door.b);
      if (!near) {
        if (leaves.has(door.id)) dropLeaves(door.id);
        continue;
      }
      if (!leaves.has(door.id)) leaves.set(door.id, leavesFor(door));
      const entry = leaves.get(door.id);
      entry.group.visible = rooms.shown(door.a) || rooms.shown(door.b);
      if (entry.group.visible) placeLeaves(door, entry, doors?.[door.id]?.open ?? 0);
    }
  }

  // ── a frame ──

  function sync(g, alpha = 1, look = {}) {
    if (disposed || !g?.you) return;
    const you = g.you;
    const time = g.time ?? performance.now() / 1000;
    track.push(time, you);
    const now = time - STEP * (1 - clamp(alpha, 0, 1));
    const dt = shown < 0 ? 0 : clamp(now - shown, 0, 0.25);
    shown = now;
    const at = track.at(alpha);
    const yaw = look.yaw ?? you.yaw ?? 0;
    const pitch = look.pitch ?? you.pitch ?? 0;
    const view = look.view ?? g.view ?? 'third';
    const aim = Boolean(look.aim);

    // the camera: snapped in to a wall at once, eased back out after it
    const hits = wallHits(layout, (id) => passable(g.doors, id));
    const pose = cameraPose({ ...at, crouch: you.crouch }, { view, yaw, pitch, aim, reach: view === 'first' ? Infinity : held + EASE_OUT * dt }, hits);
    held = view === 'first' ? 0 : pose.dist;
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    camera.lookAt(pose.look.x, pose.look.y, pose.look.z);

    becomes(playerKind({ side: g.side ?? you.side, hero: you.hero, armour: you.armour }));
    if (person) {
      const o = person.object;
      o.position.set(at.x, at.y, at.z);
      o.rotation.y = -at.yaw;
      // (in first person the eye is inside the head)
      o.visible = view !== 'first';
      person.hold(you.gun ?? null);
      person.setAim(wrap(yaw - at.yaw), pitch, aim);
      if ((you.hp ?? 1) <= 0 && !downed) person.play('die');
      if ((you.hp ?? 1) > 0 && downed) person.play(null);
      downed = (you.hp ?? 1) <= 0;
      person.update(dt, track.speed());
    }

    stream.update(you.room, (id) => (g.doors?.[id]?.open ?? 0) > 0, now, dt, { eye: camera.position, g });
    // the people after the stream, so they are drawn in the rooms as it now has them; every bolt
    // in the air given before the effects step (one not given again is gone)
    rooms.dt = dt;
    if (g.crew) people.sync(g.crew, alpha, camera.position, rooms);
    for (const b of g.combat?.bolts ?? []) fx.bolt(b);
    fx.update(dt);
    // a room just built, the Falcon berthed late, a reflection made again:
    // each brings materials the house look hasn’t met (adopting is once a material)
    if (frames++ % 30 === 0 || stream.built.size !== seenRooms) {
      seenRooms = stream.built.size;
      house.adopt(scene);
    }
    syncLeaves(g.doors);
  }

  function resize(w, h) {
    const aspect = Math.max(1e-3, w / Math.max(1, h));
    camera.aspect = aspect;
    // on a screen taller than wide, as much to either side as a wide one shows
    const half = (FOV / 2) * (Math.PI / 180);
    camera.fov = aspect >= 1 ? FOV : Math.min(100, (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    person?.dispose();
    person = null;
    people.dispose();
    fx.dispose();
    for (const id of [...leaves.keys()]) dropLeaves(id);
    stream.dispose();
    kit.dispose();
    leafMat.dispose();
    unitBox.dispose();
    scene.remove(hemi);
    renderer.toneMapping = was.toneMapping;
    renderer.toneMappingExposure = was.exposure;
  }

  const warm = (target = null) => fx.warm(renderer, camera, target);

  return { scene, camera, layout, ready: stream.ready, sync, warm, resize, render: () => renderer.render(scene, camera), dispose };
}
