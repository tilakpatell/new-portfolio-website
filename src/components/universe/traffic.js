// Traffic: everyone else out here. Which traffic depends on who you fly
// with (the crew's side, sides.js; Albuquerque's for Walt and Jesse's RV:
// DEA SUVs, the cartel's lowriders, Pollos trucks, Madrigal freighters and
// the pest van, fleetBreakingbad.js): Star Wars for Luke's X-wing and Han's Falcon (ordinary freighters,
// Rebel transports and Corellian corvettes going about their business, TIE
// fighters in twos and threes, interceptors, X-wings in formation, an
// Imperial shuttle, Boba Fett's Slave I, and now and then a Star Destroyer
// high over the whole map), Rick and Morty for the cruiser (families in
// their saucers, junk haulers, Gear People in their gear, Galactic
// Federation patrols and a Federation cruiser, Gromflomite bugs, Mr.
// Meeseeks floating by, Birdperson); with no ship picked, a quieter mix of
// every side's.
// fleetStarwars.js and fleetRickmorty.js build the ordinary ships.
// trafficModels.js builds most of them; the X-wings, Slave I, the TIE
// interceptors, the Star Destroyers and the corvettes are models
// (glbFleet.js), loaded the first time they're wanted.
//
// Everyday traffic keeps to where you are: round the place you're at and
// leaving it (lanes.js), well above or below the disc, so it never meets a
// planet or you; and the ordinary ships come in to land there and launch
// from it (laneDock: in from the open, down on to the body high on one
// side, shrinking into it as they land, and the other way out), where it's
// somewhere to land; in the home system, at the station you're by. Out in deep space between places it crosses the space
// round you. With no ship picked it's the home system's.
// Every so often while you fly, a group comes to you instead: from ahead,
// at your height, past one side close enough to see and shoot, and away
// (the crew have something to say about it); a wing of fighters that's
// come past peels apart behind you, each rolling away to its own side. A
// shot that hits one ends it, with a pop. The director (director.js) can
// also send a convoy past you (a column of freighters under escort) or
// someone in distress across your bows (with hunters.js's pirates on its
// tail). While hunters are on you (`fight`), the ordinary ships near you run
// for it: faster, and weaving.
//
// The ordinary ships also run from a pilot they fear (`feared`: standing.js,
// you've shot too many of them), fight or no; and a patrol of the law going
// past a pilot the law wants (`wanted`) reports them: a `spotted` event, once
// a group, for the scene to send the law after you.
//
// createTraffic(parent, { small, engines }) → { setCrew(id), update(dt, t, ship, { fight, feared, wanted }) → events,
//   hit(from, to) → hit or null, near(p, r) → ships, bodies(p, r) → shipHits.js's bodies (the small
//   ships), solids(p, r) → ship.js's solids (the big ones), convoy(ship, side), distress(ship, side) → the one in
//   distress (an Object3D) or null, clear(), dispose() }
// Points are in `parent`'s space (the map's). `engines` (engines.js), when
// given, lights each ship's engines, brighter as it runs from a fight.

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { bezier, convoyLane, dockScale, dockable, flybyLane, laneDepart, laneDock, laneLength, laneLocal, laneNear, tangent } from './lanes';
import { DEEP, PLACES, nearestPlace, openness } from './deep';
import { HOME_RADIUS } from './layout';
import { SOLIDS, pacedAll, PACE } from './ship';
import { SIDES, sideFor } from './sides';

// size: its length in map units, nose to tail (a traveller who isn't a ship
// is his biggest side: Birdperson's wingspan, Meeseeks' height; shipFit.js);
// speed: map units a second; crew: how many
// fly together; weight: how often it comes up; big: high over the map, one
// at a time; flyby: whether it comes to you; civil: an ordinary ship (a
// convoy's, or one in distress)
export const TYPES = pacedAll({
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
  // Albuquerque's (fleetBreakingbad.js)
  suv: { size: 0.34, speed: 9, crew: [2, 3], weight: 3, flyby: true },
  lowrider: { size: 0.34, speed: 10, crew: [1, 2], weight: 2, flyby: true },
  pollostruck: { size: 0.5, speed: 5, crew: [1, 2], weight: 2.4, flyby: true, civil: true },
  madrigal: { size: 1.6, speed: 3.8, crew: [1, 1], weight: 1.6, civil: true },
  pestvan: { size: 0.4, speed: 5.5, crew: [1, 1], weight: 1.6, flyby: true, civil: true },
  mikesedan: { size: 0.36, speed: 8, crew: [1, 1], weight: 0, flyby: false },
  beater: { size: 0.36, speed: 7, crew: [1, 1], weight: 1.2, flyby: true },
  gusvolvo: { size: 0.36, speed: 7.5, crew: [1, 1], weight: 0.6, flyby: true },
  // a balloon from the fiesta, high and slow, one at a time
  balloon: { size: 1.4, speed: 1.2, crew: [1, 1], weight: 0.7, civil: true, big: true },
  // the rest of the Star Wars and Rick and Morty fighters (sides.js's traffic)
  tiebomber: { size: 0.34, speed: 7.5, crew: [2, 3], weight: 1.4, flyby: true },
  ywing: { size: 0.38, speed: 7.5, crew: [2, 3], weight: 1.4, flyby: true },
  awing: { size: 0.3, speed: 12, crew: [2, 3], weight: 1.2, flyby: true },
  gunship: { size: 0.44, speed: 7, crew: [1, 2], weight: 1.4, flyby: true },
  mortyfighter: { size: 0.28, speed: 10, crew: [3, 5], weight: 1.4, flyby: true },
  squanchship: { size: 0.36, speed: 8, crew: [1, 1], weight: 0.8, flyby: true },
  poopyship: { size: 0.3, speed: 9, crew: [1, 1], weight: 0.6, flyby: true },
}); // (at the ship's pace: ship.js's PACE)
// whose traffic each crew meets (sides.js: the side's everyday ships and
// its civilians, who guards a convoy, who calls for help); with no ship
// picked, every side's
const kindsFor = (side) => (side ? [...side.traffic, ...side.civil] : Object.values(SIDES).flatMap((s) => [...s.traffic, ...s.civil]));
const ALL = [...new Set(kindsFor(null))];
// how far a group flies straight in before its lane begins, and straight on
// after it ends (ten seconds' worth, 30 to 90 map units): it comes from, and
// goes to, well out of sight, so nobody pops into being or vanishes in front
// of you
const runOf = (speed) => Math.min(90, Math.max(30, speed * 10));
const DOCKING = 0.32; // how much of the everyday traffic at a place is coming in to land, or launching
const FLEE = { near: 70, faster: 0.9, ease: 1.2 }; // how near you a civil ship runs from a fight, how much faster it goes, how quickly it gets going
export const SPOT = 32; // how near a patrol of the law must pass a wanted pilot to report them
const PEEL = { from: 0.52, to: 0.88, roll: 0.95 }; // where along its lane a wing peels apart (past you), and how far each rolls
const FADE_OVER = 8; // map units over which a ship whose run was cut short fades into sight (or out of it)

// How far a straight run from `p` along the unit direction `u` can go, up to
// `run`, before it would meet anything solid (and a unit short of it): the
// runs before and after a lane aren't checked when the lane is, and from
// beside a planet one could go straight through it
function clearRun(p, u, run) {
  let most = run;
  for (const o of SOLIDS) {
    const mx = p[0] - o.at[0];
    const my = p[1] - o.at[1];
    const mz = p[2] - o.at[2];
    const R = o.r + 1;
    const b = mx * u[0] + my * u[1] + mz * u[2];
    const c = mx * mx + my * my + mz * mz - R * R;
    if (c < 0) return 0; // (it starts inside one's margin)
    if (b > 0) continue; // (going away from it)
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t < most) most = Math.max(0, t - 1);
  }
  return most;
}
const HIDDEN = 0.3; // a ship drawn smaller than this (landing, launching, fading) can't be hit
const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const between = (rand, a, b) => a + rand() * (b - a);
const HOME = { id: 'home', at: [0, 0, 0], reach: HOME_RADIUS }; // the home system, as a place to fly round
const STATIONS = PLACES.filter((p) => p.kind === 'station');
// in the home system, the station you're by (ships come in to it and go), if you're by one
const stationBy = (ship) => {
  let best = null;
  let gap = Infinity;
  for (const p of STATIONS) {
    const g = Math.hypot(ship.x - p.at[0], ship.y - p.at[1], ship.z - p.at[2]) - p.reach;
    if (g < gap) {
      gap = g;
      best = p;
    }
  }
  return gap < DEEP.near ? best : null;
};

export function createTraffic(parent, { small = false, fleet = createFleet(), engines = null } = {}) {
  const rand = Math.random;
  const MAX = small ? 8 : 18; // groups at once
  const pool = {}; // kind → models not in use
  const live = []; // groups in flight
  let crew = null;
  let clock = 0;
  let nextGroup = 1; // each group's own number (for checking)
  let nextAt = 1.5;
  let nextFlyby = 14;
  let forced = null; // a kind asked for by soon()
  let forcedCross; // and how it should come

  const ready = (kind) => fleet.has(kind);
  const kinds = () => kindsFor(sideFor(crew)).filter(ready);
  const pick = (list) => {
    const total = list.reduce((s, k) => s + TYPES[k].weight, 0);
    let r = rand() * total;
    for (const k of list) if ((r -= TYPES[k].weight) <= 0) return k;
    return list[list.length - 1];
  };
  const take = (kind) => {
    // a built stand-in waiting in the pool gives way once the model is here
    if (fleet.loaded(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) drop(m);
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1); // (the fleet's says how it's fitted, shipFit.js; a model with none, to its biggest dimension)
    // (its engines, once: lit while it's out, nothing while it's in the pool)
    if (engines && !model.engine) model.engine = engines.add(kind, model.group, { size: model.size });
    return model;
  };
  const drop = (model) => {
    engines?.remove(model.engine);
    model.dispose();
  };
  const give = (kind, model) => {
    model.group.removeFromParent();
    (pool[kind] ??= []).push(model);
  };
  // one shot down (or rammed): gone, its model back in the pool
  const down = (m) => {
    m.alive = false;
    give(m.kind, m.model);
  };
  // the kinds of the law and the police of the side you fly with
  const lawKindsNow = () => {
    const side = sideFor(crew);
    return side ? [side.law, side.police?.faction].flatMap((f) => side.factions[f]?.kinds.map(([k]) => side.kinds[k]?.model ?? k) ?? []) : [];
  };

  // a group on a lane: in a loose wedge behind its leader, or (a convoy) in
  // a column, each one its own kind; `speed` for one that's slower than its
  // kind (limping, in distress)
  function spawn(kind, pts, flyby = false, { kinds, column = false, speed, event, dock = null } = {}) {
    const type = TYPES[kind];
    // the way it's heading where the lane starts and where it ends, and the
    // straight runs in and out, as far as they're clear (one coming in to
    // land stops on the body, one launching starts on it); one cut short
    // fades into sight there, or out of it
    const dirIn = [0, 0, 0];
    const dirOut = [0, 0, 0];
    tangent(pts, 0, dirIn);
    tangent(pts, 1, dirOut);
    for (const v of [dirIn, dirOut]) {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      for (let i = 0; i < 3; i++) v[i] /= l;
    }
    const run = runOf(speed ?? type.speed);
    const runIn = dock === 'out' ? 0 : clearRun(pts[0], [-dirIn[0], -dirIn[1], -dirIn[2]], run);
    const runOut = dock === 'in' ? 0 : clearRun(pts[2], dirOut, run);
    const fadeIn = dock !== 'out' && runIn < run;
    const fadeOut = dock !== 'in' && runOut < run;
    // (one landing, launching or fading in by a planet comes alone: a wedge
    // behind it would be inside the planet)
    const alone = (dock || fadeIn || fadeOut) && !kinds;
    const n = kinds?.length ?? (alone ? 1 : Math.round(between(rand, type.crew[0], type.crew[1] + 0.49)));
    // a wing of fighters come past you peels apart behind you
    const peel = flyby && !column && !type.civil && !type.big && n >= 2;
    let back = 0;
    let escorts = 0;
    const members = Array.from({ length: n }, (_, i) => {
      const k = kinds?.[i] ?? kind;
      const model = take(k);
      parent.add(model.group);
      let offset;
      let peelTo = null;
      let roll = 0;
      if (peel) {
        // each away to its own side, up or down, and rolled into it
        const row = Math.ceil(i / 2) + 1;
        const sign = i % 2 ? 1 : -1;
        peelTo = [sign * (3 + row * 2.5 + rand() * 1.5), (i % 3 === 1 ? -1 : 1) * (0.8 + row * 0.6), -row * 1.4 - 1];
        roll = sign * PEEL.roll * (0.8 + rand() * 0.4);
      }
      if (column) {
        // single file, a ship's length and a half apart, the escorts out to
        // the sides (each the other side from the last) where they are in it:
        // at the front, in the middle and at the back
        const escort = !TYPES[k].civil;
        offset = escort ? [(escorts++ % 2 ? 1 : -1) * 2.4, 0.6, -Math.max(0, back - 0.6)] : [0, 0, -back];
        if (!escort) back += TYPES[k].size * 1.6 + 0.6;
      } else {
        // a loose wedge behind the leader: back, out to alternate sides, a little up or down
        const row = Math.ceil(i / 2);
        offset = i === 0 ? [0, 0, 0] : [(i % 2 ? 1 : -1) * row * type.size * 2.2, (rand() - 0.5) * type.size, -row * type.size * 2.6];
      }
      return { kind: k, size: TYPES[k].size, model, offset, peelTo, roll, phase: rand() * 10, alive: true };
    });
    const len = laneLength(pts);
    const g = { id: nextGroup++, kind, type, members, pts, len, runIn, runOut, total: len + runIn + runOut, t: 0, flyby, said: false, speed: speed ?? type.speed, event, dock, fadeIn, fadeOut, peel, flee: 0, weave: 0, k: 0, in: dirIn, out: dirOut };
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
  const bank = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);

  function place(g, t) {
    // in straight, along the lane, and on out straight
    const along = g.t * g.total;
    if (along < g.runIn) {
      g.k = 0;
      for (let i = 0; i < 3; i++) {
        P[i] = g.pts[0][i] - g.in[i] * (g.runIn - along);
        T[i] = g.in[i];
      }
    } else if (along > g.runIn + g.len) {
      g.k = 1;
      for (let i = 0; i < 3; i++) {
        P[i] = g.pts[2][i] + g.out[i] * (along - g.runIn - g.len);
        T[i] = g.out[i];
      }
    } else {
      g.k = (along - g.runIn) / g.len;
      bezier(g.pts, g.k, P);
      tangent(g.pts, g.k, T);
    }
    fwd.set(T[0], T[1], T[2]).normalize();
    right.crossVectors(fwd, up).normalize();
    lift.crossVectors(right, fwd);
    // nose (+z) along the lane, top (+y) up: in the parent's own space
    turn.setFromRotationMatrix(basis.makeBasis(side.crossVectors(lift, fwd), lift, fwd));
    // landing or launching: into the body, or out of it
    const grow = dockScale(g.dock, g.k) * (g.fadeIn ? smoothstep(0, FADE_OVER, along) : 1) * (g.fadeOut ? smoothstep(0, FADE_OVER, g.total - along) : 1);
    g.grow = grow;
    // a wing past you peels apart; ships running from a fight weave harder
    const apart = g.peel ? smoothstep(PEEL.from, PEEL.to, g.k) : 0;
    const weave = 0.15 + g.flee * 0.5;
    for (const m of g.members) {
      if (!m.alive) continue;
      const o = m.offset;
      const gr = m.model.group;
      gr.position.set(P[0], P[1], P[2]).addScaledVector(right, o[0]).addScaledVector(lift, o[1]).addScaledVector(fwd, o[2]);
      if (apart > 0 && m.peelTo) gr.position.addScaledVector(right, (m.peelTo[0] - o[0]) * apart).addScaledVector(lift, (m.peelTo[1] - o[1]) * apart).addScaledVector(fwd, (m.peelTo[2] - o[2]) * apart);
      // a little weave, each its own
      gr.position.addScaledVector(lift, Math.sin(g.weave + m.phase) * m.size * weave);
      gr.scale.setScalar(m.size * m.model.fit * Math.max(1e-3, grow));
      gr.quaternion.copy(turn);
      // (its engines a little harder running from a fight; easing off to land)
      if (m.model.engine) engines.set(m.model.engine, { throttle: (g.dock ? 0.3 : 0.45) + 0.45 * g.flee, boost: 0 });
      // rolled into the peel (most of the way through it), and a jink while running
      const lean = (m.roll ? m.roll * Math.sin(apart * Math.PI) : 0) + g.flee * 0.35 * Math.sin(t * 2.1 + m.phase);
      if (lean) gr.quaternion.multiply(bank.setFromAxisAngle(Z, lean));
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
      if (id) fleet.want(sideFor(id) ? kindsFor(sideFor(id)) : ALL);
      if ((sideFor(id)?.id ?? null) === (sideFor(crew)?.id ?? null)) {
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
    update(dt, t, ship, { fight = false, feared = false, wanted = false } = {}) {
      clock += dt;
      const events = [];
      // the law's own ships, in passing (the side's `law` faction's kinds)
      const side = sideFor(crew);
      const law = wanted && side?.law ? side.factions[side.law] : null;
      const bigs = live.filter((g) => g.type.big).length;
      if (clock >= nextAt && live.length < MAX) {
        nextAt = clock + between(rand, small ? 2.5 : 1, small ? 6 : 3);
        let kind = pick(kinds());
        if (TYPES[kind].big && bigs > 0) kind = pick(kinds().filter((k) => !TYPES[k].big));
        // round the place you're at (or the home system), leaving it now and
        // then, and the ordinary ships coming in to land there and launching;
        // out in the open between places it crosses the space round you
        let pts = null;
        let dock = null;
        if (ship && openness(ship.x, ship.y, ship.z) > 0.5) pts = laneNear(ship, rand);
        else {
          const near = ship ? nearestPlace(ship.x, ship.y, ship.z) : { place: null, gap: 0 };
          const place = near.gap < DEEP.near + 40 ? (near.place ?? HOME) : null;
          const port = place === HOME ? ship && stationBy(ship) : place;
          if (port && TYPES[kind].civil && dockable(port) && rand() < DOCKING) {
            dock = rand() < 0.5 ? 'in' : 'out';
            pts = laneDock(port, rand, { out: dock === 'out' });
            if (!pts) dock = null;
          }
          if (place && !pts) pts = TYPES[kind].big || rand() < 0.7 ? laneLocal(place, rand, { high: TYPES[kind].big }) : laneDepart(place, rand);
        }
        if (pts) spawn(kind, pts, false, { dock });
      }
      // now and then, something comes to you (only while you're flying)
      if (ship && clock >= nextFlyby) {
        nextFlyby = clock + between(rand, 10, 20);
        const kind = forced ?? pick(kinds().filter((k) => TYPES[k].flyby));
        const pts = flybyLane(ship, rand, forcedCross === undefined ? undefined : { cross: forcedCross });
        forced = null;
        forcedCross = undefined;
        if (pts) spawn(kind, pts, true);
      }
      for (const g of [...live]) {
        // the ordinary ships near you run from a fight (and settle once it's
        // over), and from a pilot they fear, fight or no
        let run = 0;
        if ((fight || feared) && ship && g.type.civil && !g.type.big && !g.dock) {
          const p = g.members.find((m) => m.alive)?.model.group.position;
          if (p && (p.x - ship.x) ** 2 + (p.y - ship.y) ** 2 + (p.z - ship.z) ** 2 < FLEE.near * FLEE.near) run = 1;
        }
        // a patrol of the law passing a wanted pilot reports them, once
        if (law && ship && !g.spotted && !g.type.civil && !g.type.big && law.kinds.some(([k]) => k === g.kind)) {
          const p = g.members.find((m) => m.alive)?.model.group.position;
          if (p && (p.x - ship.x) ** 2 + (p.y - ship.y) ** 2 + (p.z - ship.z) ** 2 < SPOT * SPOT) {
            g.spotted = true;
            events.push({ type: 'spotted', kind: g.kind, faction: side.law });
          }
        }
        g.flee += (run - g.flee) * Math.min(1, dt * FLEE.ease);
        g.weave += dt * (1.3 + g.flee * 2); // (its own phase, run on at its own rate: a rate times the clock would jump)
        g.t += (g.speed * (1 + FLEE.faster * g.flee) * dt) / g.total;
        if (g.t >= 1 || g.members.every((m) => !m.alive)) {
          end(g);
          continue;
        }
        place(g, t);
        if (g.flyby && !g.said && ship) {
          const lead = g.members.find((m) => m.alive)?.model.group.position;
          if (lead && (lead.x - ship.x) ** 2 + (lead.y - ship.y) ** 2 + (lead.z - ship.z) ** 2 < 64) {
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
    // the ships within `r` of `p` ({ x, y, z }): the witnesses to what you
    // just did (wanted.js), [{ ref (the ship: the same one frame to frame,
    // gone from the list once it's shot down or flown off), kind, civil,
    // law (one of the law's or the police's own) }]
    near(p, r) {
      const out = [];
      const lawKinds = lawKindsNow();
      for (const g of live) {
        if ((g.grow ?? 1) < HIDDEN) continue;
        for (const m of g.members) {
          if (!m.alive) continue;
          const q = m.model.group.position;
          if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2 > r * r) continue;
          out.push({ ref: m, kind: m.kind, civil: Boolean(TYPES[m.kind]?.civil), law: lawKinds.includes(m.kind) });
        }
      }
      return out;
    },

    // the small ships within `r` of `p`, as shipHits.js's bodies (one too
    // big to bring down is a solid), each civil, the law's or a foe as near
    // tells them; a ram brings one down as a shot does
    bodies(p, r) {
      const out = [];
      const lawKinds = lawKindsNow();
      for (const g of live) {
        if ((g.grow ?? 1) < HIDDEN) continue;
        g.members.forEach((m, i) => {
          const type = TYPES[m.kind];
          if (!m.alive || type.big || m.size > 2) return;
          const q = m.model.group.position;
          if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2 > r * r) return;
          const civil = Boolean(type.civil);
          const side = civil ? 'civil' : lawKinds.includes(m.kind) ? 'law' : 'foe';
          const hit = () => {
            if (!m.alive) return null;
            const at = q.clone();
            down(m);
            return { down: true, at, size: m.size, kind: m.kind, civil };
          };
          out.push({ key: `t:${g.id}:${i}`, id: `${g.id}:${i}`, kind: m.kind, at: q, size: m.size, side, hit });
        });
      }
      return out;
    },

    // the ships too big to bring down within `r` of `p` (a Star Destroyer, a
    // corvette), as ship.js's solids: flying into one is a planet's bump or crash
    solids(p, r) {
      const out = [];
      for (const g of live) {
        if ((g.grow ?? 1) < HIDDEN) continue;
        g.members.forEach((m, i) => {
          if (!m.alive || !(TYPES[m.kind].big || m.size > 2)) return;
          const q = m.model.group.position;
          const rr = m.size * 0.3;
          if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2 > (r + rr) ** 2) return;
          out.push({ id: `t:${g.id}:${i}`, at: [q.x, q.y, q.z], r: rr, reach: rr, ship: true });
        });
      }
      return out;
    },

    hit(from, to) {
      const sx = to.x - from.x;
      const sy = to.y - from.y;
      const sz = to.z - from.z;
      const ss = sx * sx + sy * sy + sz * sz || 1;
      for (const g of live) {
        if ((g.grow ?? 1) < HIDDEN) continue; // (landing, launching or fading: not there to hit)
        for (const m of g.members) {
          if (!m.alive) continue;
          const p = m.model.group.position;
          const type = TYPES[m.kind];
          const r = m.size * (type.big ? 0.3 : 0.6) + 0.12;
          const k = Math.min(1, Math.max(0, ((p.x - from.x) * sx + (p.y - from.y) * sy + (p.z - from.z) * sz) / ss));
          // (squares, not Math.hypot: every bolt, every ship, every frame)
          const ex = p.x - (from.x + sx * k);
          const ey = p.y - (from.y + sy * k);
          const ez = p.z - (from.z + sz * k);
          if (ex * ex + ey * ey + ez * ez < r * r) {
            // too big to bring down (a Star Destroyer, a corvette)
            if (type.big || m.size > 2) return { kind: m.kind, at: p.clone(), size: m.size, glance: true, civil: Boolean(type.civil) };
            down(m);
            return { kind: m.kind, at: p.clone(), size: m.size, civil: Boolean(type.civil) };
          }
        }
      }
      return null;
    },

    // a convoy past you: a column of the ordinary ships of your universe
    // (or of `family`'s) with an escort to either side. False when there's
    // no clear way past
    convoy(ship, side = sideFor(crew)) {
      const pts = side && ship && convoyLane(ship, rand);
      if (!pts) return false;
      const civil = side.civil;
      const n = 4 + Math.floor(rand() * 4);
      const freight = Array.from({ length: n }, () => civil[Math.floor(rand() * civil.length)]);
      // (a long one has an escort in the middle too)
      if (n >= 6) freight.splice(3, 0, side.convoy.escort);
      const kinds = [side.convoy.escort, ...freight, side.convoy.escort];
      spawn(kinds[1], pts, true, { kinds, column: true, speed: 3.6 * PACE, event: 'convoy' });
      return true;
    },

    // someone in distress across your bows (from your universe, or from
    // `family`'s), slow (they're hit): the ship the pirates are after, or null
    distress(ship, side = sideFor(crew)) {
      const pts = side && ship && (laneNear(ship, rand) ?? flybyLane(ship, rand, { cross: true }));
      if (!pts) return null;
      const g = spawn(side.distress.civil, pts, true, { kinds: [side.distress.civil], speed: 2.6 * PACE, event: 'distress' });
      return g.members[0].model.group;
    },

    // one of your universe's ordinary ships to see to the next place
    // (escort.js): on `path` from where it drops in to where it jumps, no
    // run in or out, at `speed` (quicker running from a fight, as any).
    // { ship: what the pirates are after, arrived (it got to the end),
    // kill() → where it went up, or null }; or null
    escort(path, speed, side = sideFor(crew)) {
      if (!side) return null;
      const g = spawn(side.distress.civil, path, false, { kinds: [side.distress.civil], speed, event: 'escort' });
      Object.assign(g, { runIn: 0, runOut: 0, total: g.len, fadeIn: false, fadeOut: false });
      const m = g.members[0];
      return {
        ship: m.model.group,
        get arrived() {
          return g.t >= 1 && m.alive;
        },
        kill() {
          if (!m.alive || !m.model.group.parent) return null;
          const at = m.model.group.position.clone();
          down(m);
          return at;
        },
      };
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
      return live.map((g) => ({ id: g.id, kind: g.kind, event: g.event, flyby: g.flyby, dock: g.dock, fade: g.fadeIn || g.fadeOut, peel: g.peel, flee: +g.flee.toFixed(2), t: +g.t.toFixed(3), alive: g.members.filter((m) => m.alive).length, offsets: g.members.map((m) => m.offset), peels: g.members.map((m) => m.peelTo), ships: g.members.filter((m) => m.alive).map((m) => m.model.group.position.toArray()), lead: g.members.find((m) => m.alive)?.model.group.position.toArray().map((v) => +v.toFixed(2)) }));
    },

    get count() {
      return live.reduce((n, g) => n + g.members.filter((m) => m.alive).length, 0);
    },

    dispose() {
      while (live.length) end(live[0]);
      for (const list of Object.values(pool)) for (const m of list) drop(m);
    },
  };
}
