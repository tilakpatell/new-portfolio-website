// A skirmish: someone else's fight, out ahead of you, as plain rules. Pure
// (no three.js), so it's tested in Node; skirmishes.js draws it.
//
// A freighter goes about its business, circling slowly, and a pack of
// hunters is on it (hunterRules.js's own fight, with the freighter as the
// one they're after: they swing out, come in on their runs and fire); its
// escort, a wing of two (wingRules.js), covers it, going after the ones on a
// run at it. Both sides' shots are real: the hunters' lasers that reach the
// freighter take a piece off it, the escort's bolts take the hunters down,
// and a hunter with an escort in its sights fires at that instead, the
// odd shot of which brings one down. You come on it from a distance, the
// flashes first: fly in and shoot (the hunters can be locked on to and hit,
// skirmish.targets and skirmish.hit) and it's over sooner. When the hunters
// are gone the freighter and what's left of its escort go on their way;
// when the freighter's gone the hunters do, each removed once it's well
// away from you.
//
// createSkirmish({ rand, factions, kinds, solids }) → { start({ at, heading,
//   faction, escort, ship }), update(dt) → events, hit(from, to, damage),
//   targets, hunt, wing, freighter, shots, active, clear() }
// Events: { type: 'down', side: 'enemy' | 'escort' | 'freighter', at, kind },
// { type: 'over', winner: 'escort' | 'enemy' | 'jumped', at? } and { type:
// 'away', at, heading } (the freighter, on its way after it's won, jumps).
// A skirmish that drags on (SKIRMISH.longest) ends with the freighter
// jumping away.
//
// placeAt(node, solids) → { x, y, z }: where one goes at a waypoint
// (waypoints.js's NODES, a ramp or a beacon), so it's seen from far off.

import { FACTIONS, HUNTER_KINDS, clearOf, createHunt, hasTrait } from './hunterRules';
import { sweptHit } from './targeting';
import { createWing } from './wingRules';
import { PACE, SOLIDS } from './ship';

export const SKIRMISH = {
  circle: 0.12, // radians a second the freighter turns, going round
  speed: 2.6 * PACE, // its speed (at the ship's pace)
  away: 8 * PACE, // and on its way, once it's over
  hp: 16, // laser hits the freighter takes
  pack: [3, 4], // hunters on it
  escort: 2, // its escort
  escortHp: 2, // hits an escort takes
  sights: 0.96, // how near a hunter's nose must be on an escort to fire at it
  range: 13, // and how near
  fire: [1.2, 2.4], // seconds between its shots at an escort
  spread: 0.1, // how far off true they go
  shot: 30, // their speed
  life: 0.9, // seconds a shot flies
  hitR: 0.45, // how near an escort a shot must pass
  preroll: 4, // seconds it's been going before you see it
  linger: 14, // seconds the freighter is about once it's over, going
  freighterR: 0.6, // how near it a laser must pass to hit it (it's bigger than a fighter)
  clear: 6, // past anything solid's surface, the nearest it goes before it jumps away
  longest: 75, // seconds, at most: then the freighter jumps away, and the hunters lose it
};

const between = (rand, [a, b]) => a + rand() * (b - a);

// A skirmish at a node sits PLACE_OFF above it (or below, or to a side,
// should that be in something), out of the ramp's ring and the way coming
// in level to it, and PLACE_GAP clear of anything solid (the freighter goes
// round in a ring some 26 across, and jumps away if it comes within
// SKIRMISH.clear of one). Never more than PLACE_NEAR from the node.
const PLACE_OFF = 90;
const PLACE_GAP = 40;
const PLACE_NEAR = 200;
const PLACE_WAYS = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function placeAt(node, solids = SOLIDS) {
  const [x, y, z] = node.at;
  let best = null;
  for (const [i, j, k] of PLACE_WAYS) {
    const p = clearOf({ x: x + i * PLACE_OFF, y: y + j * PLACE_OFF, z: z + k * PLACE_OFF }, solids, PLACE_GAP);
    const d = Math.hypot(p.x - x, p.y - y, p.z - z);
    const clear = solids.every((o) => Math.hypot(p.x - o.at[0], p.y - o.at[1], p.z - o.at[2]) > o.r + SKIRMISH.clear);
    if (clear && d <= PLACE_NEAR) return p;
    // (none both near and clear: the nearest of the clear ones)
    if (clear && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? clearOf({ x, y: y + PLACE_OFF, z }, solids, PLACE_GAP);
}

// (someone else's fight is with the line fighters: the kinds made to fight
// you, the medics, missile boats, rammers and snipers, stay out of it, or
// the freighter's escort never has a chance)
const FOR_YOU = ['medic', 'missile', 'rammer', 'sniper'];
const lineOnly = (factions, kinds) =>
  Object.fromEntries(
    Object.entries(factions).map(([id, f]) => {
      const keep = f.kinds.filter(([k]) => !FOR_YOU.some((t) => kinds[k] && hasTrait(kinds[k], t)));
      return [id, keep.length && keep.length < f.kinds.length ? { ...f, kinds: keep } : f];
    }),
  );

export function createSkirmish({ rand = Math.random, factions = FACTIONS, kinds = HUNTER_KINDS, solids = [] } = {}) {
  const hunt = createHunt({ rand, factions: lineOnly(factions, kinds), kinds, solids, lasers: 20, firstId: 1e6, nerve: false }); // (numbered apart from your own hunters: the lock follows a number; and fought to the end: the freighter is their quarry, not you)
  const wing = createWing({ rand, bolts: 12, solids });
  const shots = Array.from({ length: 10 }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, faction: null }));
  // the freighter, as the hunt sees "you": where it is and the way it goes
  const freighter = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, vy: 0, hp: 0, alive: false, leaving: 0, kind: null, faction: null, on: false };
  const stay = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, vy: 0 }; // (where it was, once it's gone, when nobody's looking)
  const allSolids = typeof solids === 'function' ? solids : () => solids;
  const near = []; // the solids near this one
  const escortHp = new Map();
  const cool = new Map(); // a hunter's seconds to its next shot at an escort
  const events = [];
  const from = { x: 0, y: 0, z: 0 };
  let over = false;
  let clock = 0;
  const was = []; // where each laser was, before the frame

  // the freighter gone (shot down, or jumped away): the hunters give up and
  // fly off, each removed once well away from whoever's looking
  const lost = () => {
    freighter.alive = false;
    Object.assign(stay, { x: freighter.x, y: freighter.y, z: freighter.z });
    hunt.leave();
  };

  const step = (dt, viewer = null) => {
    const out = [];
    if (!freighter.on) return out;
    const f = freighter;
    // the freighter: round, slowly; on its way once it's over
    if (f.alive) {
      if (over) {
        f.leaving += dt;
        f.speed = Math.min(SKIRMISH.away, f.speed + dt * 2);
      } else f.heading += SKIRMISH.circle * dt;
      f.x += -Math.sin(f.heading) * f.speed * dt;
      f.z += -Math.cos(f.heading) * f.speed * dt;
      // on its way, it jumps once it's been about long enough, or before it
      // would meet anything solid (nothing steers it round one)
      if (over && (f.leaving > SKIRMISH.linger || near.some((o) => Math.hypot(f.x - o.at[0], f.y - o.at[1], f.z - o.at[2]) < o.r + SKIRMISH.clear))) {
        f.alive = false;
        out.push({ type: 'away', at: { x: f.x, y: f.y, z: f.z }, heading: f.heading });
      }
    }
    clock += dt;
    // too long: the freighter jumps away (to lightspeed, or through a
    // portal), and the hunters, having lost it, peel off
    if (!over && f.alive && clock > SKIRMISH.longest) {
      over = true;
      lost();
      out.push({ type: 'over', winner: 'jumped', at: { x: f.x, y: f.y, z: f.z } });
    }
    // the hunters' fight, with the freighter as their prey ("you" to them).
    // A laser that hits is counted against it (and one passing within its
    // size: the hunt's own test is for a fighter)
    hunt.lasers.forEach((m, i) => {
      const p = (was[i] ??= { on: false, x: 0, y: 0, z: 0 });
      p.on = m.on;
      p.x = m.x;
      p.y = m.y;
      p.z = m.z;
    });
    const before = { x: f.x - -Math.sin(f.heading) * f.speed * dt, y: f.y, z: f.z - -Math.cos(f.heading) * f.speed * dt };
    let struck = 0;
    // (once it's gone, the hunt's "you" is whoever's looking, so they're
    // removed out of their sight; its lasers still in flight hit nothing)
    for (const e of hunt.update(dt, f.alive ? f : (viewer ?? stay))) if (e.type === 'laser' && f.alive) struck += 1;
    if (f.alive && !over) {
      hunt.lasers.forEach((m, i) => {
        if (!m.on || !was[i].on) return;
        if (sweptHit(was[i], m, before, f, SKIRMISH.freighterR) === null) return;
        m.on = false;
        struck += 1;
      });
    }
    if (f.alive && !over && struck) {
      f.hp -= struck;
      if (f.hp <= 0) {
        lost();
        out.push({ type: 'down', side: 'freighter', at: { x: f.x, y: f.y, z: f.z }, kind: f.kind });
      }
    }
    // its escort, covering it
    const targets = hunt.targets;
    const r = wing.update(dt, f.alive && !over ? f : null, f.alive ? targets : []);
    for (const h of r.hits) {
      const got = hunt.damage(h.id, h.damage);
      if (got?.down) out.push({ type: 'down', side: 'enemy', at: got.at, kind: got.kind });
    }
    // the hunters fire at an escort in their sights
    for (const h of hunt.live) {
      if (!h.alive || h.pack.gone || h.mode === 'set') continue;
      const c = (cool.get(h.id) ?? between(rand, SKIRMISH.fire)) - dt;
      cool.set(h.id, c);
      if (c > 0) continue;
      const s0 = Math.hypot(h.vel.x, h.vel.y, h.vel.z) || 1;
      for (const w of wing.live) {
        const dx = w.pos.x - h.pos.x;
        const dy = w.pos.y - h.pos.y;
        const dz = w.pos.z - h.pos.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > SKIRMISH.range || d < 1e-3 || (h.vel.x * dx + h.vel.y * dy + h.vel.z * dz) / (s0 * d) < SKIRMISH.sights) continue;
        const t = d / SKIRMISH.shot;
        let ax = dx + w.vel.x * t + (rand() - 0.5) * SKIRMISH.spread * 2 * d;
        let ay = dy + w.vel.y * t + (rand() - 0.5) * SKIRMISH.spread * 2 * d;
        let az = dz + w.vel.z * t + (rand() - 0.5) * SKIRMISH.spread * 2 * d;
        const l = Math.hypot(ax, ay, az) || 1;
        ax /= l;
        ay /= l;
        az /= l;
        const m = shots.find((o) => !o.on) ?? shots[0];
        m.on = true;
        m.x = h.pos.x;
        m.y = h.pos.y;
        m.z = h.pos.z;
        m.vx = ax * SKIRMISH.shot;
        m.vy = ay * SKIRMISH.shot;
        m.vz = az * SKIRMISH.shot;
        m.life = SKIRMISH.life;
        m.faction = h.pack.faction;
        cool.set(h.id, between(rand, SKIRMISH.fire));
        break;
      }
    }
    for (const m of shots) {
      if (!m.on) continue;
      m.life -= dt;
      if (m.life <= 0) {
        m.on = false;
        continue;
      }
      from.x = m.x;
      from.y = m.y;
      from.z = m.z;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      for (const w of wing.live) {
        if (sweptHit(from, m, w.prev, w.pos, SKIRMISH.hitR) === null) continue;
        m.on = false;
        const hp = (escortHp.get(w.id) ?? SKIRMISH.escortHp) - 1;
        escortHp.set(w.id, hp);
        if (hp <= 0) {
          out.push({ type: 'down', side: 'escort', at: { x: w.pos.x, y: w.pos.y, z: w.pos.z }, kind: w.kind });
          wing.down(w.id);
        }
        break;
      }
    }
    // over: the hunters gone (the freighter goes on its way), or the freighter
    if (!over && f.alive && hunt.count === 0) {
      over = true;
      out.push({ type: 'over', winner: 'escort' });
    } else if (!over && !f.alive) {
      over = true;
      out.push({ type: 'over', winner: 'enemy', at: { x: f.x, y: f.y, z: f.z } });
    }
    // all of it gone, and nothing still flying: over
    if (over && !f.alive && !hunt.count && !wing.active && !hunt.lasers.some((m) => m.on) && !shots.some((m) => m.on) && !wing.bolts.some((b) => b.on)) f.on = false;
    return out;
  };

  return {
    hunt,
    wing,
    freighter,
    shots,

    // one starting `at` ({ x, y, z }), the freighter going `heading`, a pack
    // of `faction` on it and a wing of `escort` ('xwing' or 'birdperson')
    // covering it, a few seconds in. `civil`: what the freighter is (for the
    // drawing). False if one's going already.
    start({ at, heading = 0, faction = 'empire', escort = 'xwing', civil = 'transport', size } = {}) {
      if (freighter.on) return false;
      hunt.clear();
      wing.clear();
      escortHp.clear();
      cool.clear();
      for (const m of shots) m.on = false;
      over = false;
      clock = 0;
      // (the solids near it: it goes no more than 130 or so from here)
      near.length = 0;
      for (const o of allSolids()) if (Math.hypot(at.x - o.at[0], at.y - o.at[1], at.z - o.at[2]) < o.r + 200) near.push(o);
      Object.assign(freighter, { x: at.x, y: at.y, z: at.z, heading, pitch: 0, speed: SKIRMISH.speed, vy: 0, hp: SKIRMISH.hp, alive: true, leaving: 0, kind: civil, faction, on: true });
      const n = size ?? Math.round(between(rand, SKIRMISH.pack));
      hunt.pack(faction, freighter, { size: n, ace: false, ahead: true });
      wing.join(escort, freighter, SKIRMISH.escort, { back: 3 });
      // already going when you come on it
      for (let t = 0; t < SKIRMISH.preroll; t += 1 / 20) step(1 / 20);
      events.length = 0;
      return true;
    },

    // `viewer`: where you are ({ x, y, z }), or null: once the freighter's
    // gone its hunters are removed only once well away from you
    update(dt, viewer = null) {
      events.length = 0;
      events.push(...step(dt, viewer));
      return events;
    },

    // a shot of yours from `from` to `to`: the hunter it hit, if any (as
    // hunterRules' hit: { id, kind, at, size, down, hunter })
    hit(a, b, damage = 1) {
      if (!freighter.on) return null;
      return hunt.hit(a, b, damage);
    },

    // the hunters, for the guns to lock on to (none of them after you)
    get targets() {
      if (!freighter.on) return [];
      const t = hunt.targets;
      for (const o of t) o.threat = 0;
      return t;
    },

    // something to see: it's going on, or still in sight going away
    get active() {
      return freighter.on;
    },
    get over() {
      return over;
    },

    clear() {
      hunt.clear();
      wing.clear();
      for (const m of shots) m.on = false;
      freighter.on = false;
      freighter.alive = false;
      over = false;
    },
  };
}
