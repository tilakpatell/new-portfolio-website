// Traffic: everyone else out here. Which traffic depends on who you fly
// with: Star Wars for Luke's X-wing and Han's Falcon (TIE fighters in
// twos and threes, interceptors, X-wings in formation, an Imperial shuttle,
// a Rebel corvette, Boba Fett's Slave I, and now and then a Star Destroyer
// high over the whole map), Rick and Morty for the cruiser (Galactic
// Federation patrols and a Federation cruiser, Gromflomite bugs, Mr. Meeseeks
// floating by, Birdperson); both for Walt and Jesse's RV, which belongs to
// neither; with no ship picked, a quieter mix of both.
// trafficModels.js builds most of them; the X-wings and Slave I are the site
// owner's Meshy models (scripts/build-universe.py), and the corvette is
// Daniel Andersson's, from Sketchfab (scripts/sketchfab-batch.mjs, credited
// in data/modelCredits.json), loaded the first time they're wanted (the
// X-wings are built until then; Slave I and the corvette just don't fly
// until they've come).
//
// Everyday traffic flies lanes between the places, well above or below the
// disc (lanes.js), so it never meets a planet or you. Every so often while
// you fly, a group comes to you instead: from ahead, at your height, past one
// side close enough to see and shoot, and away (the crew have something to
// say about it). A shot that hits one ends it, with a pop.
//
// createTraffic(parent, { small }) → { setCrew(id), update(dt, t, ship) → events,
//   hit(point) → hit or null, clear(), dispose() }
// Points are in `parent`'s space (the map's).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TRAFFIC, buildTraffic } from './trafficModels';
import { bezier, flybyLane, laneBetween, laneLength, tangent } from './lanes';

// size: its biggest dimension in map units (a TIE's height, Birdperson's
// wingspan, Meeseeks' height); speed: map units a second; crew: how many
// fly together; weight: how often it comes up; big: high over the map, one
// at a time; tough: a shot only glances off it; flyby: whether it comes to you
const TYPES = {
  tie: { size: 0.3, speed: 9, crew: [2, 3], weight: 3, flyby: true },
  interceptor: { size: 0.32, speed: 10.5, crew: [1, 2], weight: 2, flyby: true },
  xwing: { size: 0.36, speed: 8.7, crew: [2, 4], weight: 2, flyby: true },
  shuttle: { size: 0.55, speed: 4.5, crew: [1, 1], weight: 1.4 },
  corvette: { size: 1.7, speed: 5.2, crew: [1, 1], weight: 0.9, tough: true },
  destroyer: { size: 11, speed: 1.6, crew: [1, 1], weight: 0.5, big: true },
  patrol: { size: 0.34, speed: 9.5, crew: [2, 3], weight: 3, flyby: true },
  federation: { size: 5, speed: 2, crew: [1, 1], weight: 0.6, big: true },
  gromflomite: { size: 0.28, speed: 7.3, crew: [2, 4], weight: 2, flyby: true },
  meeseeks: { size: 0.3, speed: 1.8, crew: [1, 3], weight: 1.4, flyby: true },
  birdperson: { size: 0.4, speed: 5.9, crew: [1, 1], weight: 1, flyby: true },
  slave1: { size: 0.55, speed: 8.4, crew: [1, 1], weight: 0.9, flyby: true },
};
const KINDS = { starwars: [...TRAFFIC.starwars, 'corvette', 'slave1'], rickmorty: TRAFFIC.rickmorty };
const BOTH = [...KINDS.starwars, ...KINDS.rickmorty];
// the ones that are models, and which way their noses point (to turn to +z)
const MODELS = {
  xwing: { url: '/models/universe/xwing-traffic.glb', nose: 0 },
  slave1: { url: '/models/universe/slave1.glb', nose: 0 },
  corvette: { url: '/models/sketchfab/corvette.glb', nose: 0 },
};
// whose traffic each ship meets (a ship that isn't here meets both)
const FAMILY = { cruiser: 'rickmorty', xwing: 'starwars', falcon: 'starwars' };
const FADE = 1.6; // map units over which a ship grows in at the start of its lane and goes at the end

const between = (rand, a, b) => a + rand() * (b - a);

export function createTraffic(parent, { small = false } = {}) {
  const rand = Math.random;
  const MAX = small ? 3 : 6; // groups at once
  const pool = {}; // kind → models not in use
  const live = []; // groups in flight
  let crew = null;
  let clock = 0;
  let nextAt = 1.5;
  let nextFlyby = 14;
  let forced = null; // a kind asked for by soon()
  let forcedCross; // and how it should come

  // the models: loaded once each, the first time their family flies, then
  // copied (sharing geometry and texture) for each ship
  const templates = {};
  const loading = new Set();
  let dead = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const want = (list) => {
    for (const kind of list) {
      const def = MODELS[kind];
      if (!def || loading.has(kind)) continue;
      loading.add(kind);
      loader
        .loadAsync(def.url)
        .then((gltf) => {
          const root = gltf.scene;
          if (dead) return;
          // centred, nose to +z, its biggest side 1 long
          const turn = new THREE.Group();
          turn.rotation.y = def.nose;
          turn.add(root);
          const box = new THREE.Box3().setFromObject(turn);
          root.position.sub(box.getCenter(new THREE.Vector3()).applyAxisAngle(new THREE.Vector3(0, 1, 0), -def.nose));
          const holder = new THREE.Group();
          holder.add(turn);
          const size = box.getSize(new THREE.Vector3());
          holder.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
          root.traverse((o) => {
            if (o.isMesh && o.material && 'roughness' in o.material) o.material.roughness = Math.min(o.material.roughness ?? 1, 0.7);
          });
          templates[kind] = { holder, size: size.divideScalar(Math.max(size.x, size.y, size.z)) };
        })
        .catch(() => {});
    }
  };
  const ready = (kind) => !MODELS[kind] || templates[kind] || kind === 'xwing'; // the X-wing is built until its model comes
  const kinds = () => (FAMILY[crew] ? KINDS[FAMILY[crew]] : BOTH).filter(ready);
  const pick = (list) => {
    const total = list.reduce((s, k) => s + TYPES[k].weight, 0);
    let r = rand() * total;
    for (const k of list) if ((r -= TYPES[k].weight) <= 0) return k;
    return list[list.length - 1];
  };
  const fromTemplate = (kind) => {
    const t = templates[kind];
    const group = new THREE.Group();
    group.add(t.holder.clone());
    return { group, size: t.size, model: true, update() {}, dispose() {} }; // shares its template's geometry and texture
  };
  const take = (kind) => {
    // a built X-wing waiting in the pool gives way once the model is here
    if (templates[kind] && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) m.dispose();
    const model = pool[kind]?.pop() ?? (templates[kind] ? fromTemplate(kind) : buildTraffic(kind));
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1); // to its biggest dimension
    return model;
  };
  const give = (kind, model) => {
    model.group.removeFromParent();
    (pool[kind] ??= []).push(model);
  };

  function spawn(kind, pts, flyby = false) {
    const type = TYPES[kind];
    const n = Math.round(between(rand, type.crew[0], type.crew[1] + 0.49));
    const members = Array.from({ length: n }, (_, i) => {
      const model = take(kind);
      parent.add(model.group);
      // a loose wedge behind the leader: back, out to alternate sides, a little up or down
      const row = Math.ceil(i / 2);
      const offset = i === 0 ? [0, 0, 0] : [(i % 2 ? 1 : -1) * row * type.size * 2.2, (rand() - 0.5) * type.size, -row * type.size * 2.6];
      return { model, offset, phase: rand() * 10, alive: true };
    });
    live.push({ kind, type, members, pts, len: laneLength(pts), t: 0, flyby, said: false });
  }

  const P = [0, 0, 0];
  const T = [0, 0, 0];
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const lift = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const turn = new THREE.Quaternion();

  function place(g, t) {
    bezier(g.pts, g.t, P);
    tangent(g.pts, g.t, T);
    fwd.set(T[0], T[1], T[2]).normalize();
    right.crossVectors(fwd, up).normalize();
    lift.crossVectors(right, fwd);
    // nose (+z) along the lane, top (+y) up: in the parent's own space
    turn.setFromRotationMatrix(basis.makeBasis(side.crossVectors(lift, fwd), lift, fwd));
    const along = g.t * g.len;
    const grow = Math.min(1, along / FADE, (g.len - along) / FADE);
    for (const m of g.members) {
      if (!m.alive) continue;
      const o = m.offset;
      const gr = m.model.group;
      gr.position.set(P[0], P[1], P[2]).addScaledVector(right, o[0]).addScaledVector(lift, o[1]).addScaledVector(fwd, o[2]);
      // a little weave, each its own
      gr.position.addScaledVector(lift, Math.sin(t * 1.3 + m.phase) * g.type.size * 0.15);
      gr.scale.setScalar(g.type.size * m.model.fit * Math.max(0.001, grow));
      gr.quaternion.copy(turn);
      m.model.update(t + m.phase);
    }
  }

  function end(g) {
    for (const m of g.members) if (m.alive) give(g.kind, m.model);
    live.splice(live.indexOf(g), 1);
  }

  return {
    // the crew picked (or null): changes what flies, from now
    setCrew(id) {
      // any ship's traffic is worth its models (looking round without one isn't)
      if (id) want(FAMILY[id] ? KINDS[FAMILY[id]] : BOTH);
      if ((FAMILY[id] ?? null) === (FAMILY[crew] ?? null)) {
        crew = id;
        return;
      }
      crew = id;
      while (live.length) end(live[0]);
      nextAt = clock + 1;
      nextFlyby = clock + 14;
    },

    // ship: the player's ship ({ x, y, z, heading, speed }) or null. Returns
    // what happened: [{ type: 'traffic', kind }] as a group goes past you
    update(dt, t, ship) {
      clock += dt;
      const events = [];
      const bigs = live.filter((g) => g.type.big).length;
      if (clock >= nextAt && live.length < MAX) {
        nextAt = clock + between(rand, small ? 5 : 3, small ? 11 : 8);
        let kind = pick(kinds());
        if (TYPES[kind].big && bigs > 0) kind = pick(kinds().filter((k) => !TYPES[k].big));
        // one asked for by soon() that keeps to the lanes
        if (forced && !TYPES[forced].flyby) {
          kind = forced;
          forced = null;
        }
        spawn(kind, laneBetween(rand, { high: TYPES[kind].big }));
      }
      // now and then, something comes to you (only while you're flying)
      if (ship && clock >= nextFlyby) {
        nextFlyby = clock + between(rand, 22, 40);
        const kind = forced ?? pick(kinds().filter((k) => TYPES[k].flyby));
        const pts = flybyLane(ship, rand, forcedCross === undefined ? undefined : { cross: forcedCross });
        forced = null;
        forcedCross = undefined;
        if (pts) spawn(kind, pts, true);
      }
      for (const g of [...live]) {
        g.t += (g.type.speed * dt) / g.len;
        if (g.t >= 1 || g.members.every((m) => !m.alive)) {
          end(g);
          continue;
        }
        place(g, t);
        if (g.flyby && !g.said && ship) {
          const lead = g.members.find((m) => m.alive)?.model.group.position;
          if (lead && Math.hypot(lead.x - ship.x, lead.y - ship.y, lead.z - ship.z) < 8) {
            g.said = true;
            events.push({ type: 'traffic', kind: g.kind });
          }
        }
      }
      return events;
    },

    // a shot that went from `from` to `to` this frame (a shot covers more
    // ground in a frame than a fighter is wide, so it's the whole stretch that
    // counts): the ship it hit, if any ({ kind, at, size }), which is gone.
    // Shots fly level and you can't aim up or down, so a near miss above or
    // below still counts
    hit(from, to) {
      const sx = to.x - from.x;
      const sz = to.z - from.z;
      const ss = sx * sx + sz * sz || 1;
      for (const g of live) {
        for (const m of g.members) {
          if (!m.alive) continue;
          const p = m.model.group.position;
          const r = g.type.size * (g.type.big || g.type.tough ? 0.3 : 0.6) + 0.06; // the long ones are narrow for their length
          const k = Math.min(1, Math.max(0, ((p.x - from.x) * sx + (p.z - from.z) * sz) / ss));
          if (Math.hypot(p.x - (from.x + sx * k), p.z - (from.z + sz * k)) < r && Math.abs(p.y - to.y) < r + 0.55) {
            if (g.type.big || g.type.tough) return { kind: g.kind, at: p.clone(), size: g.type.size, glance: true }; // too big to bring down
            m.alive = false;
            give(g.kind, m.model);
            return { kind: g.kind, at: p.clone(), size: g.type.size };
          }
        }
      }
      return null;
    },

    clear() {
      while (live.length) end(live[0]);
    },

    // bring the next flyby (and the next everyday traffic) forward: for
    // checking from a browser
    soon(kind, cross) {
      nextFlyby = clock;
      nextAt = clock;
      forced = kind ?? null;
      forcedCross = cross;
    },

    // what's flying, for checking from a browser
    get groups() {
      return live.map((g) => ({ kind: g.kind, flyby: g.flyby, t: +g.t.toFixed(3), alive: g.members.filter((m) => m.alive).length, lead: g.members.find((m) => m.alive)?.model.group.position.toArray().map((v) => +v.toFixed(2)) }));
    },

    get count() {
      return live.reduce((n, g) => n + g.members.filter((m) => m.alive).length, 0);
    },

    dispose() {
      dead = true;
      while (live.length) end(live[0]);
      for (const list of Object.values(pool)) for (const m of list) m.dispose();
      // the models' own geometry and textures (the copies only shared them)
      for (const t of Object.values(templates)) {
        t.holder.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const value of Object.values(o.material)) if (value?.isTexture) value.dispose();
          o.material.dispose();
        });
      }
    },
  };
}
