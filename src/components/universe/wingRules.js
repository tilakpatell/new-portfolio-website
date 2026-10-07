// Wingmen: friends who come to help when a fight drags on, as plain rules.
// Pure (no three.js), so it's tested in Node; wingmen.js gives each one a
// model and draws its shots.
//
// A wing of two (or three) comes up from behind you at speed, slots in off
// your wings (WING.settle seconds of it, the crew saying hello), and covers
// you: each goes after a hunter coming at you (on a run, or on your tail;
// not one another of the wing has while there's a choice), makes a pass at
// it of a few seconds (WING.chase), and comes back on your wing a while
// (WING.rest) before the next. It flies in behind its hunter at the fight's
// pace (hunterRules.js's fightSpeed, against the hunter's speed: a little
// quicker than it), turns like a fighter, and fires when it has it in its
// sights and in range. Its shots are real: bolts that fly, tested over the
// whole frame against where the hunter was and is (targeting.js's
// sweptHit), off true and leading short, so it's a help and not a turret. A
// hit is handed back for the scene to put on the hunter (hunters.damage).
// With nobody left to fight it forms up on you a while, then peels away,
// climbing, and goes.
//
// createWing({ rand, solids }) → { join(kind, ship, n), update(dt, ship, targets, { grudge }) →
//   { hits: [{ id, damage, at }], events }, down(id), live, bolts, active,
//   leaving, fired, clear() }
// `ship` is yours ({ x, y, z, heading, pitch, speed, vy }); `targets` the
// hunters' (hunters.targets: [{ id, at, vel, size, threat }]); `grudge` the
// id of the hunter that hit you last, which a wingman goes for first when
// it's near enough to be a choice (people read revenge as sense). Events:
// { type: 'joined', kind }, { type: 'leaving' }, { type: 'gone' }.

import { clearOf, fightSpeed, shipVelocity, turnToward } from './hunterRules';
import { RIGHT, UP, fromAngles, rotate } from './orient';
import { intercept, nose, sweptHit } from './targeting';
import { alliesOf } from './sides';

// how each kind of friend flies (sides.js's allies, every side's): top
// speed, how quick its nose is, seconds between shots (a range), how true
// they are (radians off, each way); and, for some, what a bolt is worth
// (`damage`: a Y-wing's hit hard), how long they form up on you with nobody
// to fight (`stay`, WING.stay's otherwise) and how long they help before
// going whatever's on (`tour`: an A-wing strafes and is off)
export const WING_KINDS = {
  ...alliesOf(null),
  // (and the galaxy's wars' wings, for whichever side you swore to there:
  // galaxy/roamRules.js's escorts; nobody's ally on the universe map)
  tie: { speed: 25, accel: 21, turn: 2.8, fire: [0.8, 1.4], spread: 0.15, size: 0.3, colour: [0.5, 5.5, 0.9] },
  interceptor: { speed: 29, accel: 25, turn: 3.1, fire: [0.6, 1.1], spread: 0.18, size: 0.32, stay: 3, tour: 20, colour: [0.5, 5.5, 0.9] },
  arc170: { speed: 22, accel: 18, turn: 2.2, fire: [1.0, 1.7], spread: 0.12, size: 0.46, damage: 2, colour: [5.8, 0.75, 0.55] },
  delta7: { speed: 30, accel: 26, turn: 3.3, fire: [0.6, 1.0], spread: 0.15, size: 0.3, colour: [5.8, 0.75, 0.55] },
  vulture: { speed: 24, accel: 20, turn: 2.7, fire: [0.9, 1.6], spread: 0.25, size: 0.3, colour: [6.0, 2.5, 0.5] },
  trifighter: { speed: 27, accel: 23, turn: 3.0, fire: [0.7, 1.2], spread: 0.2, size: 0.32, colour: [6.0, 2.5, 0.5] },
};
export const WING = {
  from: 34, // map units behind you they come in from
  slot: [2.6, 0.35, 1.6], // out off your wing, up, back: where one forms up
  range: 15, // they fire inside this
  sights: 0.96, // how near its nose must be on the target (the cosine: about 16°)
  bolt: 46, // a bolt's speed, over the shooter's
  life: 0.7, // seconds a bolt flies
  behind: 3, // how far behind its target it flies in at
  lead: 0.75, // of the true lead it allows for (a hunter jinks)
  stay: 7, // seconds formed up with nobody to fight before it goes
  settle: 2.5, // seconds on your wing, first, before it breaks off after one
  chase: 5, // seconds on one pass at a hunter, at most
  rest: 3.5, // and back on your wing between passes
  leave: 8, // seconds flying off before it's gone
  floor: 0.42, // (as a hunter's: of its top, the least it flies at)
  catchUp: 1.8, // of your speed, to get back on your wing from far off
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const between = (rand, [a, b]) => a + rand() * (b - a);

export function createWing({ rand = Math.random, bolts: boltCount = 16, solids = [] } = {}) {
  const allSolids = typeof solids === 'function' ? solids : () => solids;
  const near = []; // the solids near the wing this frame (it's kept out of them)
  const live = [];
  const bolts = Array.from({ length: boltCount }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, target: null }));
  let nextId = 1;
  let idle = 0; // seconds with nobody to fight
  let leaving = false;
  let stay = WING.stay; // (the wing that joined last's: how long it forms up with nobody to fight)
  let tour = Infinity; // and how long it helps before it goes anyway
  let touring = 0; // seconds since it joined
  let fired = 0; // shots, all told (for checking)
  const yourVel = [0, 0, 0];
  const dir = [0, 0, -1];
  const want = [0, 0, -1];
  const hits = [];
  let events = []; // (two lists, swapped each update: the one handed back, and the one join() fills)
  let spare = [];
  const out = { hits, events };
  const alive = [];
  const p0 = { x: 0, y: 0, z: 0 };
  const from = { x: 0, y: 0, z: 0 };

  // the hunter each goes for: only one coming at you (on a run, or on your
  // tail: they're covering you, not clearing the sky), the nearest to it
  // (the one that hit you last counted as half as far), and not one
  // another of the wing has while there's a choice
  let grudge = null;
  const choose = (w, targets) => {
    let best = null;
    let score = Infinity;
    for (const t of targets) {
      if (!(t.threat > 0)) continue;
      const dx = t.at.x - w.pos.x;
      const dy = t.at.y - w.pos.y;
      const dz = t.at.z - w.pos.z;
      const taken = live.some((o) => o !== w && o.alive && o.target === t.id);
      const k = Math.sqrt(dx * dx + dy * dy + dz * dz) * (t.id === grudge ? 0.5 : 1) + (taken ? 1e6 : 0); // (one nobody has, wherever it is, first)
      if (k < score) {
        score = k;
        best = t;
      }
    }
    return best;
  };

  const fire = (w, t) => {
    const speed = WING.bolt + Math.sqrt(w.vel.x ** 2 + w.vel.y ** 2 + w.vel.z ** 2);
    const meet = intercept(w.pos, speed, t.at, t.vel);
    const lt = (meet ? meet.t : 0) * WING.lead;
    let ax = t.at.x + t.vel.x * lt - w.pos.x;
    let ay = t.at.y + t.vel.y * lt - w.pos.y;
    let az = t.at.z + t.vel.z * lt - w.pos.z;
    let l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    const wide = w.type.spread * 2;
    ax = ax / l + (rand() - 0.5) * wide;
    ay = ay / l + (rand() - 0.5) * wide;
    az = az / l + (rand() - 0.5) * wide;
    l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    const b = bolts.find((o) => !o.on) ?? bolts[0];
    b.on = true;
    b.x = w.pos.x + (ax / l) * w.type.size * 0.6;
    b.y = w.pos.y + (ay / l) * w.type.size * 0.6;
    b.z = w.pos.z + (az / l) * w.type.size * 0.6;
    b.vx = (ax / l) * speed;
    b.vy = (ay / l) * speed;
    b.vz = (az / l) * speed;
    b.life = WING.life;
    b.target = t.id;
    b.damage = w.type.damage ?? 1;
    w.cool = between(rand, w.type.fire);
    fired += 1;
  };

  return {
    live,
    bolts,

    // a wing of `n` of `kind` comes up from behind `ship` (`back` behind it:
    // a skirmish's escort is already with its freighter)
    join(kind, ship, n = 2, { back: from0 = WING.from } = {}) {
      const type = WING_KINDS[kind] ?? WING_KINDS.xwing;
      const f = nose(ship);
      leaving = false;
      idle = 0;
      stay = type.stay ?? WING.stay;
      tour = type.tour ?? Infinity;
      touring = 0;
      // (any still about are called back, and the new ones take the slots behind them)
      for (const w of live) w.gone = 0;
      const already = live.length;
      for (let i = 0; i < n; i++) {
        const side = (already + i) % 2 ? 1 : -1;
        const row = Math.floor((already + i) / 2);
        // level, across your nose
        let sx = -f[2];
        let sz = f[0];
        const sl = Math.sqrt(sx * sx + sz * sz) || 1;
        sx /= sl;
        sz /= sl;
        const back = from0 + row * 4;
        const pos = clearOf({ x: ship.x - f[0] * back + sx * side * (4 + row * 2), y: ship.y - f[1] * back + 0.8, z: ship.z - f[2] * back + sz * side * (4 + row * 2) }, allSolids());
        live.push({ id: nextId++, kind, type, pos, prev: { ...pos }, vel: { x: f[0] * type.speed, y: f[1] * type.speed, z: f[2] * type.speed }, side, row, target: null, cool: between(rand, [0.6, 1.4]), bank: 0, age: 0, chase: 0, rest: 0, alive: true, gone: 0, view: null });
      }
      events.push({ type: 'joined', kind });
    },

    update(dt, ship, targets = [], { grudge: hitBy = null } = {}) {
      grudge = hitBy;
      hits.length = 0;
      const ev = events;
      events = spare;
      spare = ev;
      events.length = 0;
      out.events = ev;
      if (!live.length && !bolts.some((b) => b.on)) return out;
      alive.length = 0;
      for (const w of live) if (w.alive) alive.push(w);
      const fighting = targets.length > 0 && Boolean(ship);
      idle = fighting ? 0 : idle + dt;
      touring += dt;
      const done = touring > tour; // (its passes made: it's off, fight or no fight)
      // flying off, and someone comes at you again: back they come
      if (leaving && !done && ship && alive.length && targets.some((o) => o.threat > 0)) {
        leaving = false;
        for (const w of alive) w.gone = 0;
      }
      if (!leaving && alive.length && (!ship || idle > stay || done)) {
        leaving = true;
        ev.push({ type: 'leaving' });
      }
      const f = ship ? nose(ship) : [0, 0, -1];
      // your own right and up (not level ones: in a loop those turn over, and the wing would cross through itself)
      const q = ship ? fromAngles(ship.heading || 0, ship.pitch || 0, ship.bank || 0) : null;
      const yr = q ? rotate(q, RIGHT) : RIGHT;
      const yu = q ? rotate(q, UP) : UP;
      if (ship) shipVelocity(ship, yourVel);
      // what's solid near the wing
      near.length = 0;
      const c0 = alive[0]?.pos;
      if (c0) for (const o of allSolids()) if (Math.hypot(o.at[0] - c0.x, o.at[1] - c0.y, o.at[2] - c0.z) < o.r + 200) near.push(o);
      const yourSpeed = ship ? Math.abs(ship.speed || 0) : 0;
      for (const w of alive) {
        const { pos, vel, type } = w;
        w.age += dt;
        w.rest = Math.max(0, w.rest - dt);
        w.prev.x = pos.x;
        w.prev.y = pos.y;
        w.prev.z = pos.z;
        const s0 = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        if (s0 > 1e-4) {
          dir[0] = vel.x / s0;
          dir[1] = vel.y / s0;
          dir[2] = vel.z / s0;
        }
        let speed = type.speed;
        let t = null;
        if (leaving) {
          // away, climbing, faster
          w.gone += dt;
          want[0] = dir[0];
          want[1] = dir[1] + 0.25;
          want[2] = dir[2];
          speed = type.speed * 1.15;
        } else if (fighting && w.age > WING.settle && w.rest <= 0) {
          if (w.target !== null) t = targets.find((o) => o.id === w.target) ?? null;
          // (doubled up on one while another's coming at you unwatched: the later of the two moves over)
          if (t && live.some((o) => o !== w && o.alive && o.id < w.id && o.target === t.id) && targets.some((o) => o.threat > 0 && o.id !== t.id && !live.some((x) => x.alive && x.target === o.id))) t = null;
          // (one that's swung away off you again is let go, unless it's close)
          if (t && !(t.threat > 0) && Math.sqrt((t.at.x - pos.x) ** 2 + (t.at.y - pos.y) ** 2 + (t.at.z - pos.z) ** 2) > WING.range) t = null;
          if (!t) {
            t = choose(w, targets);
            w.target = t?.id ?? null;
          }
        }
        if (t) {
          // in behind it, where it's going, at a little over its speed
          const tv = Math.sqrt(t.vel.x ** 2 + t.vel.y ** 2 + t.vel.z ** 2) || 1;
          const bx = t.at.x - (t.vel.x / tv) * WING.behind + t.vel.x * 0.4 - pos.x;
          const by = t.at.y - (t.vel.y / tv) * WING.behind + t.vel.y * 0.4 - pos.y;
          const bz = t.at.z - (t.vel.z / tv) * WING.behind + t.vel.z * 0.4 - pos.z;
          want[0] = bx;
          want[1] = by;
          want[2] = bz;
          const gap = Math.sqrt((t.at.x - pos.x) ** 2 + (t.at.y - pos.y) ** 2 + (t.at.z - pos.z) ** 2);
          speed = fightSpeed(type, tv, gap);
          // a pass at it, then back on your wing a while
          w.chase += dt;
          if (w.chase > WING.chase) {
            w.chase = 0;
            w.rest = WING.rest;
            w.target = null;
          }
          // firing: in its sights and in range
          w.cool -= dt;
          if (w.cool <= 0 && gap < WING.range) {
            const on = (dir[0] * (t.at.x - pos.x) + dir[1] * (t.at.y - pos.y) + dir[2] * (t.at.z - pos.z)) / (gap || 1);
            if (on > WING.sights) fire(w, t);
          }
        } else if (!leaving && ship) {
          // on your wing: its slot off your nose, going your way
          const wide = WING.slot[0] * (1 + w.row * 0.8) * w.side;
          const back = WING.slot[2] * (1 + w.row);
          const px = ship.x + yr[0] * wide + yu[0] * WING.slot[1] - f[0] * back;
          const py = ship.y + yr[1] * wide + yu[1] * WING.slot[1] - f[1] * back;
          const pz = ship.z + yr[2] * wide + yu[2] * WING.slot[1] - f[2] * back;
          const dx = px - pos.x;
          const dy = py - pos.y;
          const dz = pz - pos.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          // your velocity, and a pull onto the slot
          want[0] = yourVel[0] + dx * 1.5;
          want[1] = yourVel[1] + dy * 1.5;
          want[2] = yourVel[2] + dz * 1.5;
          speed = clamp(Math.sqrt(want[0] ** 2 + want[1] ** 2 + want[2] ** 2), Math.min(2, yourSpeed), Math.max(type.speed, yourSpeed * WING.catchUp));
          if (d < 0.6) speed = Math.max(yourSpeed, Math.min(speed, yourSpeed + d * 2));
          w.target = null;
        } else if (!leaving) {
          want[0] = dir[0];
          want[1] = dir[1];
          want[2] = dir[2];
        }
        const wl = Math.sqrt(want[0] * want[0] + want[1] * want[1] + want[2] * want[2]);
        if (wl > 1e-6) {
          want[0] /= wl;
          want[1] /= wl;
          want[2] /= wl;
          const bx0 = dir[0];
          const bz0 = dir[2];
          turnToward(dir, want, type.turn * dt, w.side);
          const yaw = dt > 0 ? (bx0 * dir[2] - bz0 * dir[0]) / dt : 0;
          w.bank += (clamp(yaw * 0.45, -1.1, 1.1) - w.bank) * Math.min(1, dt * 4);
        }
        const s1 = s0 + clamp(speed - s0, -type.accel * dt, type.accel * dt);
        vel.x = dir[0] * s1;
        vel.y = dir[1] * s1;
        vel.z = dir[2] * s1;
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        pos.z += vel.z * dt;
        // never inside anything solid
        if (near.length) clearOf(pos, near, type.size * 0.5);
        if (leaving && w.gone > WING.leave) w.alive = false;
      }
      for (let i = live.length - 1; i >= 0; i--) if (!live[i].alive) live.splice(i, 1);
      if (leaving && !live.length) {
        leaving = false;
        ev.push({ type: 'gone' });
      }

      // the bolts: on their way, and into their hunter (or any hunter they pass through)
      for (const b of bolts) {
        if (!b.on) continue;
        b.life -= dt;
        if (b.life <= 0) {
          b.on = false;
          continue;
        }
        from.x = b.x;
        from.y = b.y;
        from.z = b.z;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        for (const t of targets) {
          const r = (t.size ?? 0.3) * 0.9 + 0.12;
          p0.x = t.at.x - t.vel.x * dt;
          p0.y = t.at.y - t.vel.y * dt;
          p0.z = t.at.z - t.vel.z * dt;
          if (sweptHit(from, b, p0, t.at, r) !== null) {
            b.on = false;
            hits.push({ id: t.id, damage: b.damage ?? 1, at: { x: b.x, y: b.y, z: b.z } });
            break;
          }
        }
      }
      return out;
    },

    // one of the wing shot down (a skirmish's escort: skirmish.js): gone at
    // once, and true if it was there
    down(id) {
      const i = live.findIndex((w) => w.id === id && w.alive);
      if (i < 0) return false;
      live[i].alive = false;
      live.splice(i, 1);
      return true;
    },

    // a wing in the sky (flying with you, fighting, or going)
    get active() {
      return live.some((w) => w.alive);
    },
    get leaving() {
      return leaving;
    },
    get fired() {
      return fired;
    },

    clear() {
      live.length = 0;
      for (const b of bolts) b.on = false;
      leaving = false;
      idle = 0;
    },
  };
}
