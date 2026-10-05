// Traffic: everyone else out here. Which traffic depends on who you fly
// with: Star Wars for Luke's X-wing and Han's Falcon (ordinary freighters,
// Rebel transports and Corellian corvettes going about their business, TIE
// fighters in twos and threes, interceptors, X-wings in formation, an
// Imperial shuttle, Boba Fett's Slave I, and now and then a Star Destroyer
// high over the whole map), Rick and Morty for the cruiser (families in
// their saucers, junk haulers, Gear People in their gear, Galactic
// Federation patrols and a Federation cruiser, Gromflomite bugs, Mr.
// Meeseeks floating by, Birdperson); both for Walt and Jesse's RV, which
// belongs to neither; with no ship picked, a quieter mix of both.
// fleetStarwars.js and fleetRickmorty.js build the ordinary ships.
// trafficModels.js builds most of them; the X-wings, Slave I, the TIE
// interceptors, the Star Destroyers and the corvettes are models
// (glbFleet.js), loaded the first time they're wanted.
//
// Everyday traffic flies lanes between the places, well above or below the
// disc (lanes.js), so it never meets a planet or you; out in deep space,
// where there are no places to go between, it crosses the space round you.
// Every so often while you fly, a group comes to you instead: from ahead,
// at your height, past one side close enough to see and shoot, and away
// (the crew have something to say about it). A shot that hits one ends it,
// with a pop. The director (director.js) can also send a convoy past you (a
// column of freighters under escort) or someone in distress across your
// bows (with hunters.js's pirates on its tail).
//
// createTraffic(parent, { small }) → { setCrew(id), update(dt, t, ship) → events,
//   hit(from, to) → hit or null, convoy(ship), distress(ship) → the one in
//   distress (an Object3D) or null, clear(), dispose() }
// Points are in `parent`'s space (the map's).

import * as THREE from 'three';
import { TRAFFIC } from './trafficModels';
import { createFleet } from './glbFleet';
import { bezier, convoyLane, flybyLane, laneBetween, laneLength, laneNear, tangent } from './lanes';
import { openness } from './deep';

// size: its biggest dimension in map units (a TIE's height, Birdperson's
// wingspan, Meeseeks' height); speed: map units a second; crew: how many
// fly together; weight: how often it comes up; big: high over the map, one
// at a time; flyby: whether it comes to you; civil: an ordinary ship (a
// convoy's, or one in distress)
const TYPES = {
  freighter: { size: 0.7, speed: 7.5, crew: [1, 2], weight: 3, flyby: true, civil: true },
  transport: { size: 1.8, speed: 4.2, crew: [1, 2], weight: 2, civil: true },
  corvette: { size: 3.2, speed: 5, crew: [1, 1], weight: 1.2, civil: true },
  saucer: { size: 0.45, speed: 5.5, crew: [1, 3], weight: 3, flyby: true, civil: true },
  hauler: { size: 0.9, speed: 4.2, crew: [1, 1], weight: 2.2, civil: true },
  gearship: { size: 1.2, speed: 3.2, crew: [1, 1], weight: 1.2, civil: true },
  tie: { size: 0.3, speed: 9, crew: [2, 3], weight: 3, flyby: true },
  interceptor: { size: 0.32, speed: 10.5, crew: [1, 2], weight: 2, flyby: true },
  xwing: { size: 0.36, speed: 8.7, crew: [2, 4], weight: 2, flyby: true },
  shuttle: { size: 0.55, speed: 4.5, crew: [1, 1], weight: 1.4 },
  destroyer: { size: 11, speed: 1.6, crew: [1, 1], weight: 0.5, big: true },
  patrol: { size: 0.34, speed: 9.5, crew: [2, 3], weight: 3, flyby: true },
  federation: { size: 5, speed: 2, crew: [1, 1], weight: 0.6, big: true },
  gromflomite: { size: 0.28, speed: 7.3, crew: [2, 4], weight: 2, flyby: true },
  meeseeks: { size: 0.3, speed: 1.8, crew: [1, 3], weight: 1.4, flyby: true },
  birdperson: { size: 0.4, speed: 5.9, crew: [1, 1], weight: 1, flyby: true },
  slave1: { size: 0.55, speed: 8.4, crew: [1, 1], weight: 0.9, flyby: true },
};
const CIVIL = { starwars: ['freighter', 'transport', 'corvette'], rickmorty: ['saucer', 'hauler', 'gearship'] };
const KINDS = { starwars: [...TRAFFIC.starwars, 'slave1', ...CIVIL.starwars], rickmorty: [...TRAFFIC.rickmorty, ...CIVIL.rickmorty] };
const ESCORT = { starwars: 'xwing', rickmorty: 'patrol' }; // who guards a convoy
const DISTRESS = { starwars: 'transport', rickmorty: 'saucer' }; // who calls for help
const BOTH = [...KINDS.starwars, ...KINDS.rickmorty];
// whose traffic each ship meets (a ship that isn't here meets both)
const FAMILY = { cruiser: 'rickmorty', xwing: 'starwars', falcon: 'starwars' };
// how far a group flies straight in before its lane begins, and straight on
// after it ends (ten seconds' worth, 30 to 90 map units): it comes from, and
// goes to, well out of sight, so nobody pops into being or vanishes in front
// of you
const runOf = (speed) => Math.min(90, Math.max(30, speed * 10));

const between = (rand, a, b) => a + rand() * (b - a);

export function createTraffic(parent, { small = false, fleet = createFleet() } = {}) {
  const rand = Math.random;
  const MAX = small ? 6 : 14; // groups at once
  const pool = {}; // kind → models not in use
  const live = []; // groups in flight
  let crew = null;
  let clock = 0;
  let nextAt = 1.5;
  let nextFlyby = 14;
  let forced = null; // a kind asked for by soon()
  let forcedCross; // and how it should come

  const ready = (kind) => fleet.has(kind);
  const kinds = () => (FAMILY[crew] ? KINDS[FAMILY[crew]] : BOTH).filter(ready);
  const pick = (list) => {
    const total = list.reduce((s, k) => s + TYPES[k].weight, 0);
    let r = rand() * total;
    for (const k of list) if ((r -= TYPES[k].weight) <= 0) return k;
    return list[list.length - 1];
  };
  const take = (kind) => {
    // a built stand-in waiting in the pool gives way once the model is here
    if (fleet.loaded(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) m.dispose();
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1); // to its biggest dimension
    return model;
  };
  const give = (kind, model) => {
    model.group.removeFromParent();
    (pool[kind] ??= []).push(model);
  };

  // a group on a lane: in a loose wedge behind its leader, or (a convoy) in
  // a column, each one its own kind; `speed` for one that's slower than its
  // kind (limping, in distress)
  function spawn(kind, pts, flyby = false, { kinds, column = false, speed, event } = {}) {
    const type = TYPES[kind];
    const n = kinds?.length ?? Math.round(between(rand, type.crew[0], type.crew[1] + 0.49));
    let back = 0;
    const members = Array.from({ length: n }, (_, i) => {
      const k = kinds?.[i] ?? kind;
      const model = take(k);
      parent.add(model.group);
      let offset;
      if (column) {
        // single file, a ship's length and a half apart, the escorts out to the sides
        const escort = !TYPES[k].civil;
        offset = escort ? [(i % 2 ? 1 : -1) * 2.4, 0.6, -back * 0.5] : [0, 0, -back];
        if (!escort) back += TYPES[k].size * 1.6 + 0.6;
      } else {
        // a loose wedge behind the leader: back, out to alternate sides, a little up or down
        const row = Math.ceil(i / 2);
        offset = i === 0 ? [0, 0, 0] : [(i % 2 ? 1 : -1) * row * type.size * 2.2, (rand() - 0.5) * type.size, -row * type.size * 2.6];
      }
      return { kind: k, size: TYPES[k].size, model, offset, phase: rand() * 10, alive: true };
    });
    const len = laneLength(pts);
    const run = runOf(speed ?? type.speed);
    const g = { kind, type, members, pts, len, run, total: len + run * 2, t: 0, flyby, said: false, speed: speed ?? type.speed, event, in: [0, 0, 0], out: [0, 0, 0] };
    // the way it's heading where the lane starts and where it ends
    tangent(pts, 0, g.in);
    tangent(pts, 1, g.out);
    for (const v of [g.in, g.out]) {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      for (let i = 0; i < 3; i++) v[i] /= l;
    }
    live.push(g);
    return g;
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
    // in straight, along the lane, and on out straight
    const along = g.t * g.total;
    if (along < g.run) {
      for (let i = 0; i < 3; i++) {
        P[i] = g.pts[0][i] - g.in[i] * (g.run - along);
        T[i] = g.in[i];
      }
    } else if (along > g.run + g.len) {
      for (let i = 0; i < 3; i++) {
        P[i] = g.pts[2][i] + g.out[i] * (along - g.run - g.len);
        T[i] = g.out[i];
      }
    } else {
      const k = (along - g.run) / g.len;
      bezier(g.pts, k, P);
      tangent(g.pts, k, T);
    }
    fwd.set(T[0], T[1], T[2]).normalize();
    right.crossVectors(fwd, up).normalize();
    lift.crossVectors(right, fwd);
    // nose (+z) along the lane, top (+y) up: in the parent's own space
    turn.setFromRotationMatrix(basis.makeBasis(side.crossVectors(lift, fwd), lift, fwd));
    for (const m of g.members) {
      if (!m.alive) continue;
      const o = m.offset;
      const gr = m.model.group;
      gr.position.set(P[0], P[1], P[2]).addScaledVector(right, o[0]).addScaledVector(lift, o[1]).addScaledVector(fwd, o[2]);
      // a little weave, each its own
      gr.position.addScaledVector(lift, Math.sin(t * 1.3 + m.phase) * m.size * 0.15);
      gr.scale.setScalar(m.size * m.model.fit);
      gr.quaternion.copy(turn);
      m.model.update(t + m.phase);
    }
  }

  function end(g) {
    for (const m of g.members) if (m.alive) give(m.kind, m.model);
    live.splice(live.indexOf(g), 1);
  }

  return {
    // the crew picked (or null): changes what flies, from now
    setCrew(id) {
      // any ship's traffic is worth its models (looking round without one isn't)
      if (id) fleet.want(FAMILY[id] ? KINDS[FAMILY[id]] : BOTH);
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
        nextAt = clock + between(rand, small ? 3 : 1.4, small ? 7 : 4);
        let kind = pick(kinds());
        if (TYPES[kind].big && bigs > 0) kind = pick(kinds().filter((k) => !TYPES[k].big));
        // out in deep space it crosses the space round you instead
        const pts = ship && openness(ship.x, ship.z) > 0.5 ? laneNear(ship, rand) : laneBetween(rand, { high: TYPES[kind].big });
        if (pts) spawn(kind, pts);
      }
      // now and then, something comes to you (only while you're flying)
      if (ship && clock >= nextFlyby) {
        nextFlyby = clock + between(rand, 14, 26);
        const kind = forced ?? pick(kinds().filter((k) => TYPES[k].flyby));
        const pts = flybyLane(ship, rand, forcedCross === undefined ? undefined : { cross: forcedCross });
        forced = null;
        forcedCross = undefined;
        if (pts) spawn(kind, pts, true);
      }
      for (const g of [...live]) {
        g.t += (g.speed * dt) / g.total;
        if (g.t >= 1 || g.members.every((m) => !m.alive)) {
          end(g);
          continue;
        }
        place(g, t);
        if (g.flyby && !g.said && ship) {
          const lead = g.members.find((m) => m.alive)?.model.group.position;
          if (lead && Math.hypot(lead.x - ship.x, lead.y - ship.y, lead.z - ship.z) < 8) {
            g.said = true;
            events.push({ type: 'traffic', kind: g.kind, event: g.event });
          }
        }
      }
      return events;
    },

    // a shot that went from `from` to `to` this frame (a shot covers more
    // ground in a frame than a fighter is wide, so it's the whole stretch that
    // counts): the ship it hit, if any ({ kind, at, size }), which is gone.
    // A little forgiving: a near miss counts
    hit(from, to) {
      const sx = to.x - from.x;
      const sy = to.y - from.y;
      const sz = to.z - from.z;
      const ss = sx * sx + sy * sy + sz * sz || 1;
      for (const g of live) {
        for (const m of g.members) {
          if (!m.alive) continue;
          const p = m.model.group.position;
          const type = TYPES[m.kind];
          const r = m.size * (type.big ? 0.3 : 0.6) + 0.12;
          const k = Math.min(1, Math.max(0, ((p.x - from.x) * sx + (p.y - from.y) * sy + (p.z - from.z) * sz) / ss));
          if (Math.hypot(p.x - (from.x + sx * k), p.y - (from.y + sy * k), p.z - (from.z + sz * k)) < r) {
            // too big to bring down (a Star Destroyer, a corvette)
            if (type.big || m.size > 2) return { kind: m.kind, at: p.clone(), size: m.size, glance: true, civil: Boolean(type.civil) };
            m.alive = false;
            give(m.kind, m.model);
            return { kind: m.kind, at: p.clone(), size: m.size, civil: Boolean(type.civil) };
          }
        }
      }
      return null;
    },

    // a convoy past you: a column of the ordinary ships of your universe
    // (or of `family`'s) with an escort to either side. False when there's
    // no clear way past
    convoy(ship, family = FAMILY[crew]) {
      const pts = family && ship && convoyLane(ship, rand);
      if (!pts) return false;
      const civil = CIVIL[family];
      const n = 3 + Math.floor(rand() * 3);
      const kinds = [ESCORT[family], ...Array.from({ length: n }, () => civil[Math.floor(rand() * civil.length)]), ESCORT[family]];
      spawn(kinds[1], pts, true, { kinds, column: true, speed: 3.6, event: 'convoy' });
      return true;
    },

    // someone in distress across your bows (from your universe, or from
    // `family`'s), slow (they're hit): the ship the pirates are after, or null
    distress(ship, family = FAMILY[crew]) {
      const pts = family && ship && (laneNear(ship, rand) ?? flybyLane(ship, rand, { cross: true }));
      if (!pts) return null;
      const g = spawn(DISTRESS[family], pts, true, { kinds: [DISTRESS[family]], speed: 2.6, event: 'distress' });
      return g.members[0].model.group;
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
      return live.map((g) => ({ kind: g.kind, event: g.event, flyby: g.flyby, t: +g.t.toFixed(3), alive: g.members.filter((m) => m.alive).length, lead: g.members.find((m) => m.alive)?.model.group.position.toArray().map((v) => +v.toFixed(2)) }));
    },

    get count() {
      return live.reduce((n, g) => n + g.members.filter((m) => m.alive).length, 0);
    },

    dispose() {
      while (live.length) end(live[0]);
      for (const list of Object.values(pool)) for (const m of list) m.dispose();
    },
  };
}
