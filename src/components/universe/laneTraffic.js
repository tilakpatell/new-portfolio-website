// The lane traffic near you, as real ships: laneFlow.js says where every ship
// in every hyperlane is, and laneStreaks.js draws them all as light; this
// gives the RESOLVE (12) of them nearest you, within NEAR (400), models from
// the traffic kit (trafficModels.js, glbFleet.js) that ride the lane beside
// you and can be shot.
//
// A pool of models, a kind’s spares kept as traffic.js keeps them, is handed
// round the flow each frame: a flow ship that’s still among the nearest keeps
// the model it has, one that’s come among them takes one (and grows out of
// its streak, from nothing to its size over GROW seconds), and one that’s
// fallen out of them gives its model back. Each is posed where its flow ship
// is (laneFlow’s positionOf), its nose along the carriageway and its top up
// the tube’s up (ride.js’s frame), its engines lit high: they’re at
// hyperspeed. A big kind (a Star Destroyer is 11 map units long) is drawn no
// bigger than BIG_DRAWN, as the tube’s only 6 across.
//
// A shot that hits one ends it (laneFlow’s kill, into the scene’s `dead`
// map, so the streaks leave it out too, until it comes round its lane
// again); a big one, or one over 2 units, only takes a glancing blow. The
// scene pops and counts a hit as it does traffic.js’s.
//
// On a phone (`small`) there’s none of it: the streaks are all there is.
//
// createLaneTraffic(parent, { fleet, engines, small, types }) → { update(dt, t, ship, dead, { side }) → events,
//   hit(from, to) → { kind, at, size, civil, glance? } or null, count, list, clear(), dispose() }
// Points are in `parent`’s space (the map’s); `t` is laneFlow.js’s clock,
// the wall’s in seconds, the same the streaks are given. `events`: [{ type: 'kill',
// kind }] for each ship hit() brought down since the last update (the same
// kills hit() returned, for anything that listens to the update instead).

import * as THREE from 'three';
import { NEAR, RESOLVE, flowNear, kill, nearest, positionOf } from './laneFlow';
import { frame } from './ride';
import { TYPES } from './traffic';
import { buildTraffic } from './trafficModels';

export const GROW = 0.4; // seconds a ship takes to grow out of its streak
export const BIG_DRAWN = 4; // map units: the most a ship is drawn, in a tube 6 across
// a model past HEAVY triangles (the X-wing and the TIE interceptor are 120,000
// each, made here at the desktop's cut, and a convoy has X-wings front and
// back) is drawn for the nearest one of its kind only, HEAVY_MAX at a time;
// the rest get the kit's built stand-in, a few thousand, at a pixel or two a
// ship this far off (measured at the far-rim pose: four X-wings near were
// half a million triangles)
export const HEAVY = 20000;
export const HEAVY_MAX = 1;
const HIDDEN = 0.3; // a ship drawn smaller than this (still growing) can’t be hit, as traffic.js’s
const THROTTLE = 0.9; // their engines (at hyperspeed)

const keyOf = (f) => `${f.lane.id}|${f.way}|${f.i}|${f.m}`;

export function createLaneTraffic(parent, { fleet, engines = null, small = false, types = TYPES, build = buildTraffic } = {}) {
  const pool = {}; // kind → models not in use
  const live = new Map(); // key → { lane, way, i, m, kind, size, model, age }
  const own = new Map(); // the dead, when the scene keeps none of its own
  let lastDead = own;
  let lastT = 0;
  let kills = []; // since the last update
  const wanted = new Set(); // the kinds asked of the fleet, once each
  const heavy = new Set(); // the kinds whose model is past HEAVY
  const trianglesOf = (group) => {
    let n = 0;
    group.traverse((o) => {
      if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : (o.geometry.attributes.position?.count ?? 0)) / 3;
    });
    return n;
  };

  // ── The pool (traffic.js’s take, give and drop) ──
  const drop = (model) => {
    engines?.remove(model.engine);
    model.dispose();
  };
  const take = (kind, light = false) => {
    // (a heavy kind's stand-in, built from the kit: in a pool of its own)
    if (light) {
      const model = pool[`~${kind}`]?.pop() ?? { ...build(kind), light: true };
      model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
      if (engines && !model.engine) model.engine = engines.add(kind, model.group, { size: model.size });
      return model;
    }
    // a built stand-in waiting in the pool gives way once the model is here
    if (fleet.loaded?.(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) drop(m);
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1); // to its biggest dimension
    // (its engines, once: lit while it’s out, nothing while it’s in the pool)
    if (engines && !model.engine) model.engine = engines.add(kind, model.group, { size: model.size });
    if (model.model && !heavy.has(kind) && trianglesOf(model.group) > HEAVY) heavy.add(kind);
    return model;
  };
  const give = (kind, model) => {
    model.group.removeFromParent();
    (pool[model.light ? `~${kind}` : kind] ??= []).push(model);
  };
  const end = (key) => {
    const r = live.get(key);
    if (!r) return;
    give(r.kind, r.model);
    live.delete(key);
  };
  const clear = () => {
    for (const key of [...live.keys()]) end(key);
  };

  // ── Posing ──
  const fwd = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const probe = new THREE.Vector3();

  function place(r, f, t) {
    const at = positionOf(f.lane, f.way, f.s, f.off);
    const fr = frame(f.lane, f.way, f.s);
    const gr = r.model.group;
    gr.position.set(at[0], at[1], at[2]);
    // nose (+z) along the carriageway, top (+y) the tube’s up: in the parent’s own space
    fwd.set(fr.along[0], fr.along[1], fr.along[2]);
    lift.set(fr.up[0], fr.up[1], fr.up[2]);
    gr.quaternion.setFromRotationMatrix(basis.makeBasis(side.crossVectors(lift, fwd), lift, fwd));
    // (smoothstep: out of the streak, easing into its size)
    const k = Math.min(1, r.age / GROW);
    r.grow = k * k * (3 - 2 * k);
    gr.scale.setScalar(r.size * r.model.fit * Math.max(1e-3, r.grow));
    if (r.model.engine) engines.set(r.model.engine, { throttle: THROTTLE, boost: 1 });
    r.model.update(t);
  }

  return {
    // ship: the player’s ship ({ x, y, z }) or null (not flying: everything
    // goes back in the pool). dead: the scene’s Map of ships shot down
    // (laneFlow.js’s), shared with the streaks. side: the crew’s side’s id,
    // for a lane no side holds.
    update(dt, t, ship, dead = null, { side: crewSide = null } = {}) {
      const events = kills;
      kills = [];
      lastDead = dead ?? own;
      lastT = t;
      if (small) return events;
      if (!ship) {
        clear();
        return events;
      }
      const all = flowNear(ship, t, lastDead, NEAR, { side: crewSide });
      // (the models among them start loading the first time they’re near: the
      // express’s capital ships and a convoy’s escorts needn’t be the crew’s
      // side’s, which is all traffic.js asks the fleet for)
      for (const f of all) {
        if (wanted.has(f.kind)) continue;
        wanted.add(f.kind);
        fleet.want?.([f.kind]);
      }
      const flow = all.filter((f) => types[f.kind] && fleet.has(f.kind));
      const near = nearest(flow, ship, RESOLVE, NEAR);
      const keep = new Set(near.map(keyOf));
      // the ones no longer nearest give theirs back first, so the new ones can take them
      for (const key of [...live.keys()]) if (!keep.has(key)) end(key);
      // (the heavy models to the nearest of them, HEAVY_MAX at a time; near is nearest first)
      let heavies = 0;
      for (const f of near) {
        const key = keyOf(f);
        let r = live.get(key);
        // (a lane no side holds is the crew’s side’s: pick another crew and the
        // same slot carries another kind, so its model goes back for the right one)
        const known = heavy.has(f.kind);
        const light = known && heavies >= HEAVY_MAX;
        if (known && !light) heavies++;
        if (r && (r.kind !== f.kind || Boolean(r.model.light) !== light)) {
          end(key);
          r = null;
        }
        if (!r) {
          const model = take(f.kind, light);
          if (!known && heavy.has(f.kind)) heavies++; // (found heavy just now, making it)
          parent.add(model.group);
          r = { lane: f.lane, way: f.way, i: f.i, m: f.m, kind: f.kind, size: Math.min(types[f.kind].size, BIG_DRAWN), model, age: 0, grow: 0 };
          live.set(key, r);
        } else r.age += dt;
        Object.assign(r, { s: f.s, off: f.off, speed: f.speed }); // (for hit, which runs on the clock it's given)
        place(r, f, t);
      }
      return events;
    },

    // a shot that went from `from` to `to` this frame: the ship it hit, if
    // any ({ kind, at, size, civil }, and `glance` for one too big to bring
    // down). A little forgiving, as traffic.js’s: a near miss counts. `t`:
    // the clock now, as the shot is (at a trunk’s speed a ship goes 25 map
    // units a frame, so where it was posed at the last update won’t do: it’s
    // tested where its flow ship is at t).
    hit(from, to, t = lastT) {
      if (!live.size) return null;
      const sx = to.x - from.x;
      const sy = to.y - from.y;
      const sz = to.z - from.z;
      const ss = sx * sx + sy * sy + sz * sz || 1;
      for (const [key, r] of live) {
        if (r.grow < HIDDEN) continue; // (still coming out of its streak)
        const q = positionOf(r.lane, r.way, Math.min(1, r.s + (r.speed * (t - lastT)) / r.lane.length), r.off);
        const p = probe.set(q[0], q[1], q[2]);
        const type = types[r.kind];
        const rad = r.size * (type.big ? 0.3 : 0.6) + 0.12;
        const k = Math.min(1, Math.max(0, ((p.x - from.x) * sx + (p.y - from.y) * sy + (p.z - from.z) * sz) / ss));
        const ex = p.x - (from.x + sx * k);
        const ey = p.y - (from.y + sy * k);
        const ez = p.z - (from.z + sz * k);
        if (ex * ex + ey * ey + ez * ez >= rad * rad) continue;
        const civil = Boolean(type.civil);
        // too big to bring down (a Star Destroyer, a corvette)
        if (type.big || type.size > 2) return { kind: r.kind, at: p.clone(), size: r.size, glance: true, civil };
        const at = p.clone();
        kill(lastDead, r.lane, r.way, r.i, r.m, t);
        end(key);
        kills.push({ type: 'kill', kind: r.kind });
        return { kind: r.kind, at, size: r.size, civil };
      }
      return null;
    },

    // how many are out, and how many of them are heavy models
    get count() {
      return live.size;
    },
    get heavy() {
      return [...live.values()].filter((r) => heavy.has(r.kind) && !r.model.light).length;
    },

    // what’s out, for checking from a browser
    get list() {
      return [...live.values()].map((r) => ({ lane: r.lane.id, way: r.way, i: r.i, m: r.m, kind: r.kind, at: r.model.group.position.toArray(), grow: r.grow, light: Boolean(r.model.light) }));
    },

    clear,

    dispose() {
      clear();
      for (const list of Object.values(pool)) for (const m of list) drop(m);
      for (const k of Object.keys(pool)) delete pool[k];
    },
  };
}
