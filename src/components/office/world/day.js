// The Scranton branch's working day: who gets up from their desk, where
// they go and what they do there, as the show has it. Kevin to the vending
// machine and Pam's jelly beans, Meredith for coffee, Angela to check on her
// yogurt, Oscar to the copier, Creed into the supply room, Kelly to the
// water cooler to talk, Toby into Michael's office (to be told no). Each
// has needs that rise as the day goes (lib/ai/needs.js: coffee, food, work,
// company), picks a place that gives the one that's pressing, and goes:
// stands up out of the chair, turns and walks the way round the desks
// (./paths.js), eases into a stop, turns to the counter, does the thing,
// and walks back and sits down again. Two at the kitchen or the cooler at
// once fall to talking, taking turns. Someone walking makes way for Jim,
// stops and looks at him; spoken to, they stop and turn to him. The fire
// drill sends everyone back to their desks (its runners are its own:
// panicAt). Pure: no three.js, no Math.random; seeded, and the same each
// visit.
//
// createOfficeDay({ seats, places, people, route, seed }) → { step(dt, ctx)
//   → [entry…], entry(who), out() → how many are up, reset() }
//   seats: { [who]: { yaw, stand: { x, z }, exit: [{ x, z }…] } }: which way
//     they face sat, where their feet are as they stand up (between the chair
//     and the desk), and the steps from there out round the chair to where
//     their ways start (the last of them)
//   places: [{ id, need, spots: [{ x, z }…], face, clip, loop?, duration,
//     chat?, with?, look? }]: where each is stood at (a spot a slot), the way
//     it's faced while it's used (a yaw), the clip it's used with and for how
//     long; chat: two there at once talk; with: whom, sat, they talk to there
//     (Michael in his office, Erin at reception); look: { x, z } what the eyes
//     are on while it's used
//   people: [{ who, needs: { [need]: rate a second }, places? (the ids they'll
//     go to, else any), walk? (m/s), start?
//     ({ [need]: level } to begin at, else the seed's), rest? (seconds sat
//     before the first trip, else the seed's) }]
//   route(who, place, slot) → [{ x, z }…] | null: the way from the last of
//     who's exit to the place's spot for that slot (the caller's paths.js
//     findPath, kept); the way back is the same, reversed
//   ctx: { jim: { x, z } | null, talkTo: who | null (Jim's talking to them),
//     hold: Set (not to get up now), closed: Set (places not to go to now),
//     stop: true (everyone at their desks at once: the fire drill) }
//   entry: { who, state, x, z, yaw, speed, age, place, clip, loop, look, talk,
//     with, leg }
//     state: 'seated' | 'rising' | 'walking' | 'facing' | 'using' | 'sitting'
//     (age: seconds in it); yaw: a figure's (0 along +z, toward +x); speed:
//     m/s over the ground; leg: 'out' or 'home' while walking or facing;
//     clip/loop: the place's, while using; look: 'jim', a who (in a talk, the
//     one talking), a point { x, z }, or null; talk: their turn to talk (or
//     Jim's talking to them)
// panicAt(a, b, { speed, phase, t, side }) → { x, z, yaw, speed }: a runner
//   in the fire drill, up and down the line from a to b at `speed`, slowing
//   into each end and turning there (no flip at full tilt), `side` metres to
//   one side of the line (so two on one line don't run through each other)
// lengthOf(path), pointAt(path, s) → { x, z, i } the point s metres along

import { createNeeds, pickPlace, release, reserve, slotOf } from '../../../lib/ai/needs';
import { turn } from '../../../lib/three/gait';
import { seeded } from '../../../lib/seeded';

export const DAY = {
  walk: 1.05, // an office's stroll (m/s)
  accel: 1.6, // m/s², setting off
  decel: 1.8, // m/s², coming to a stop
  carrot: 0.6, // metres ahead along the way the body faces (corners turned into, not snapped)
  turnRate: 7, // how fast a turn eases in (gait.js's)
  turnMax: 3.2, // rad/s at most: a body turns on its feet, not a turntable
  faceFirst: 0.7, // radians off the way: turned on the spot before setting off
  faced: 0.08, // radians: turned to the counter (or the desk)
  rise: 1.1, // seconds standing up out of the chair (the clip's own)
  sit: 1.35, // and sitting down into it
  want: 0.7, // a need this pressing gets them up
  rest: [20, 55], // seconds sat between trips
  retry: 6, // seconds before trying again when nowhere would do
  maxOut: 4, // up at once, at most: the office still looks at work
  yieldNear: 1.0, // metres: Jim this close ahead, they stop for him
  bumpNear: 0.8, // and another walker this close ahead
  wait: 2.5, // seconds waiting on another walker before going on anyway
  chatNear: 2.8, // metres apart at a place, two can talk
  turn: [1.6, 4.2], // seconds a turn to talk
  turns: [3, 6], // turns a talk
  chatRest: 30, // seconds before they'll talk at a place again
};

const TAU = Math.PI * 2;
const wrap = (a) => a - TAU * Math.round(a / TAU);
const span = (rand, [lo, hi]) => lo + (hi - lo) * rand();
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

export function lengthOf(path) {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return n;
}
export function pointAt(path, s) {
  let d = Math.max(0, s);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= l || i === path.length - 1) {
      const k = l > 1e-9 ? Math.min(1, d / l) : 1;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, i };
    }
    d -= l;
  }
  const p = path[path.length - 1] ?? { x: 0, z: 0 };
  return { x: p.x, z: p.z, i: path.length - 1 };
}

// a body turned toward `want` by time, no faster than turnMax
function ease(yaw, want, dt) {
  const next = turn(yaw, want, dt, DAY.turnRate);
  const most = DAY.turnMax * Math.min(Math.max(dt, 0), 0.1);
  const d = wrap(next - yaw);
  return Math.abs(d) <= most ? next : yaw + Math.sign(d) * most;
}

// joined end to start, without a point twice where they meet
const join = (...parts) => {
  const out = [];
  for (const part of parts)
    for (const p of part ?? []) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 1e-3) out.push({ x: p.x, z: p.z });
    }
  return out;
};

export function createOfficeDay({ seats = {}, places = [], people = [], route = () => null, seed = 7 } = {}) {
  const rand = seeded(seed);
  // places as needs.js reads them, each with its slots' spots
  const where = places.map((p) => ({ ...p, at: [p.spots[0].x, p.spots[0].z], slots: p.slots ?? p.spots.length }));
  const byId = new Map(where.map((p) => [p.id, p]));
  const folk = people
    .filter((p) => seats[p.who])
    .map((p, i) => {
      const seat = seats[p.who];
      const r = seeded(seed * 31 + i * 977 + 1);
      return {
        who: p.who,
        seat,
        pace: p.walk ?? DAY.walk,
        allow: p.places ? new Set(p.places) : null,
        needs: createNeeds({ needs: p.needs ?? {}, rand: r, start: p.start ?? null }),
        rand: r,
        state: 'seated',
        age: 0,
        x: seat.stand.x,
        z: seat.stand.z,
        yaw: seat.yaw,
        v: 0,
        rest: p.rest ?? span(r, DAY.rest) * 0.5,
        place: null,
        leg: null,
        path: null,
        s: 0,
        len: 0,
        use: 0,
        last: null,
        waited: 0,
        ignore: 0,
        chat: null,
        chatRest: 0,
        engaged: false,
        out: null,
      };
    });
  const byWho = new Map(folk.map((f) => [f.who, f]));
  let chats = [];

  const home = (f) => {
    if (f.place) release(f.place, f.who);
    f.place = null;
    f.state = 'seated';
    f.age = 0;
    f.leg = null;
    f.path = null;
    f.v = 0;
    f.x = f.seat.stand.x;
    f.z = f.seat.stand.z;
    f.yaw = f.seat.yaw;
    f.chat = null;
  };

  const startWalk = (f, path, leg) => {
    f.state = 'walking';
    f.age = 0;
    f.leg = leg;
    f.path = path;
    f.s = 0;
    f.len = lengthOf(path);
    f.v = 0;
    f.waited = 0;
  };

  // up from the desk, if something's pressing and somewhere gives it
  const tryOut = (f, ctx, outNow) => {
    if (outNow >= DAY.maxOut || ctx.hold?.has(f.who) || f.rest > 0) return false;
    const lv = f.needs.levels();
    const top = Math.max(0, ...Object.values(lv));
    if (top < DAY.want) return false;
    const open = where.filter((p) => !ctx.closed?.has(p.id) && (!f.allow || f.allow.has(p.id)) && p.need in lv && lv[p.need] >= DAY.want * 0.75);
    const place = pickPlace({ id: f.who, x: f.seat.stand.x, z: f.seat.stand.z, needs: f.needs, last: f.last }, open, { rand: f.rand });
    if (!place || !reserve(place, f.who)) {
      f.rest = DAY.retry;
      return false;
    }
    const slot = slotOf(place, f.who);
    const way = route(f.who, place, slot);
    if (!way || way.length < 2) {
      release(place, f.who);
      f.rest = DAY.retry;
      return false;
    }
    const spot = place.spots[slot] ?? place.spots[0];
    f.place = place;
    f.out = join([f.seat.stand], f.seat.exit, way, [spot]);
    f.state = 'rising';
    f.age = 0;
    f.yaw = f.seat.yaw;
    return true;
  };

  // along the way: off once turned to it, easing up to pace and down into
  // the end, the body facing a little ahead along it; stopping for Jim and
  // for a walker in the way
  const walk = (f, dt, ctx, walkers) => {
    const ahead = pointAt(f.path, Math.min(f.len, f.s + DAY.carrot));
    const left = f.len - f.s;
    let want = left > 0.02 ? yawTo(f, ahead) : f.yaw;
    let stop = false;
    let look = null;
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    const jim = ctx.jim;
    if (jim) {
      const dx = jim.x - f.x;
      const dz = jim.z - f.z;
      const d = Math.hypot(dx, dz);
      if (d < DAY.yieldNear && (dx * fx + dz * fz) / Math.max(d, 1e-6) > 0.3) {
        stop = true;
        look = 'jim';
      }
    }
    // (another walker close ahead: wait for them to pass; two waiting on
    // each other, the wait runs out and one goes on)
    if (!stop && f.ignore <= 0)
      for (const o of walkers) {
        if (o === f) continue;
        const dx = o.x - f.x;
        const dz = o.z - f.z;
        const d = Math.hypot(dx, dz);
        if (d < DAY.bumpNear && (dx * fx + dz * fz) / Math.max(d, 1e-6) > 0.5) {
          stop = true;
          break;
        }
      }
    f.ignore = Math.max(0, f.ignore - dt);
    if (stop && !look) {
      f.waited += dt;
      if (f.waited > DAY.wait) {
        f.ignore = 2;
        f.waited = 0;
      }
    } else if (!stop) f.waited = 0;
    // turned on the spot first, setting off or round a sharp corner from a stand
    const off = Math.abs(wrap(want - f.yaw));
    const cap = stop || (f.v < 0.15 && off > DAY.faceFirst) ? 0 : Math.min(f.pace, Math.sqrt(2 * DAY.decel * Math.max(0, left)));
    f.v = cap > f.v ? Math.min(cap, f.v + DAY.accel * dt) : Math.max(cap, f.v - DAY.decel * 1.5 * dt);
    f.s = Math.min(f.len, f.s + f.v * dt);
    const p = pointAt(f.path, f.s);
    f.x = p.x;
    f.z = p.z;
    if (look === 'jim') want = f.yaw; // (stopped for him: the head turns, not the body)
    f.yaw = ease(f.yaw, want, dt);
    return { arrived: f.len - f.s < 0.01 && f.v < 0.05, look };
  };

  // two or three using places near each other that talk: a talk each, by turns
  const startChats = (users) => {
    const free = users.filter((f) => !f.chat && f.chatRest <= 0 && f.place?.chat);
    for (const f of free) {
      if (f.chat) continue;
      const with_ = free.filter((o) => o !== f && !o.chat && Math.hypot(o.x - f.x, o.z - f.z) < DAY.chatNear);
      if (!with_.length) continue;
      const members = [f, ...with_.slice(0, 2)];
      const c = { members, speaker: Math.floor(rand() * members.length), left: span(rand, DAY.turn), turns: Math.round(span(rand, DAY.turns)) + (members.length > 2 ? 1 : 0) };
      for (const m of members) m.chat = c;
      chats.push(c);
    }
  };
  const stepChats = (dt) => {
    for (const c of chats) {
      c.members = c.members.filter((m) => m.chat === c && m.state === 'using');
      if (c.members.length < 2) c.turns = 0;
      if (c.turns <= 0) continue;
      c.left -= dt;
      if (c.left <= 0) {
        c.turns -= 1;
        c.speaker = (c.speaker + 1 + Math.floor(rand() * (c.members.length - 1))) % c.members.length;
        c.left = span(rand, DAY.turn);
      }
    }
    for (const c of chats)
      if (c.turns <= 0)
        for (const m of c.members)
          if (m.chat === c) {
            m.chat = null;
            m.chatRest = DAY.chatRest;
          }
    chats = chats.filter((c) => c.turns > 0);
  };

  const entryOf = (f) => {
    const e = { who: f.who, state: f.state, x: f.x, z: f.z, yaw: f.yaw, speed: f.v, age: f.age, place: f.place?.id ?? null, clip: null, loop: false, look: null, talk: false, with: null, leg: f.leg };
    if (f.state === 'using') {
      e.clip = f.place.clip ?? null;
      e.loop = Boolean(f.place.loop);
      e.with = f.place.with ?? null;
      e.look = f.place.look ?? null;
      if (f.chat) {
        const sp = f.chat.members[f.chat.speaker];
        e.talk = sp === f;
        e.look = sp === f ? (f.chat.members.find((m) => m !== f)?.who ?? null) : sp.who;
      }
    }
    if (f.engaged) {
      e.look = 'jim';
      e.talk = true;
    } else if (f.state === 'walking' && f.look) e.look = f.look;
    return e;
  };

  const api = {
    step(dt, ctx = {}) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      if (ctx.stop) {
        for (const f of folk) if (f.state !== 'seated') home(f);
        chats = [];
      }
      let outNow = folk.filter((f) => f.state !== 'seated').length;
      const walkers = folk.filter((f) => f.state === 'walking');
      for (const f of folk) {
        f.needs.tick(d);
        f.age += d;
        f.chatRest = Math.max(0, f.chatRest - d);
        f.look = null;
        // Jim talking to them, out of their chair: they stop and turn to him
        f.engaged = Boolean(ctx.talkTo === f.who && ctx.jim && (f.state === 'walking' || f.state === 'facing' || f.state === 'using'));
        if (f.engaged) {
          f.v = Math.max(0, f.v - DAY.decel * 2 * d);
          if (f.state === 'walking') {
            f.s = Math.min(f.len, f.s + f.v * d);
            const p = pointAt(f.path, f.s);
            f.x = p.x;
            f.z = p.z;
          }
          f.yaw = ease(f.yaw, yawTo(f, ctx.jim), d);
          continue;
        }
        if (f.state === 'seated') {
          f.rest -= d;
          if (!ctx.stop && tryOut(f, ctx, outNow)) outNow += 1;
        } else if (f.state === 'rising') {
          if (f.age >= DAY.rise) startWalk(f, f.out, 'out');
        } else if (f.state === 'walking') {
          const { arrived, look } = walk(f, d, ctx, walkers);
          f.look = look;
          if (arrived) {
            f.state = 'facing';
            f.age = 0;
            f.v = 0;
          }
        } else if (f.state === 'facing') {
          const want = f.leg === 'out' ? (f.place?.face ?? f.yaw) : f.seat.yaw;
          f.yaw = ease(f.yaw, want, d);
          if (Math.abs(wrap(want - f.yaw)) < DAY.faced) {
            f.yaw = want;
            f.age = 0;
            if (f.leg === 'out') {
              f.state = 'using';
              f.use = f.place.duration ?? 6;
            } else f.state = 'sitting';
          }
        } else if (f.state === 'using') {
          // (a talk keeps them there until it's done)
          if (!f.chat) f.use -= d;
          if (f.chat) {
            const sp = f.chat.members[f.chat.speaker];
            const others = f.chat.members.filter((m) => m !== f);
            const to = sp === f ? { x: others.reduce((n, m) => n + m.x, 0) / others.length, z: others.reduce((n, m) => n + m.z, 0) / others.length } : sp;
            f.yaw = ease(f.yaw, yawTo(f, to), d);
          } else if (f.place.face != null) f.yaw = ease(f.yaw, f.place.face, d);
          if (f.use <= 0 && !f.chat) {
            f.needs.satisfy(f.place.need, 1);
            f.last = f.place.id;
            const back = [...f.out].reverse();
            release(f.place, f.who);
            startWalk(f, back, 'home');
          }
        } else if (f.state === 'sitting') {
          if (f.age >= DAY.sit) {
            home(f);
            f.rest = span(f.rand, DAY.rest);
          }
        }
      }
      startChats(folk.filter((f) => f.state === 'using' && !f.engaged));
      stepChats(d);
      return folk.map((f) => entryOf(f));
    },
    entry(who) {
      const f = byWho.get(who);
      return f ? entryOf(f) : null;
    },
    out: () => folk.filter((f) => f.state !== 'seated').length,
    reset() {
      for (const f of folk) home(f);
      chats = [];
    },
    places: byId,
  };
  return api;
}

// ── the fire drill ──
export function panicAt(a, b, { speed = 3, phase = 0, t = 0, side = 0 } = {}) {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  // a leg takes what it would at `speed`, eased in and out (the same time
  // overall, faster in the middle)
  const legT = len / speed;
  const u = Math.max(0, t + phase * legT * 2) / legT;
  const n = Math.floor(u);
  const k = u - n;
  const there = n % 2 === 0;
  const e = (1 - Math.cos(Math.PI * k)) / 2;
  const f = there ? e : 1 - e;
  const ux = (b.x - a.x) / len;
  const uz = (b.z - a.z) / len;
  // (a little to one side of the line: the side it's on, left of a → b)
  const x = a.x + (b.x - a.x) * f + uz * side;
  const z = a.z + (b.z - a.z) * f - ux * side;
  const v = ((Math.PI / 2) * Math.sin(Math.PI * k) * len) / legT;
  const yaw = there ? Math.atan2(ux, uz) : Math.atan2(-ux, -uz);
  return { x, z, yaw, speed: v };
}
