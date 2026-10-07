// The concourse's people about their day (the spec's "Ambient and social
// life"): the crowd that walked its loops round and round now goes
// somewhere, as the show's Citadel does. Each has needs (lib/ai/needs.js)
// and a part to play by the Citadel's clock: the wafer-line Ricks to Simple
// Rick's doors in their shift, the office Ricks to the Council's doors
// with a petition, anyone to a kiosk at lunch, a bench for a sit, the rail
// for the view of the city, the holo-ads on the core. A Morty walks with
// his Rick (social.js's groups: beside him, waited for), two who want
// company stop a step apart and take turns talking (its conversations),
// one who knows Rick C-137 looks round at him and waves the first time
// (its greeting), and anyone ahead of Rick steps out of his way, or is
// shoved and looks round (its making way). They walk by context steering
// (steer.js), round the core and the kiosks rather than into them, their
// pace eased up and down and their turns eased round, and pushOut keeps
// them out of whatever's left. Nothing here is the story's: Rick never
// bumps into them (they aren't in his walker), so they can do as they like.
// Pure, seeded, no three.js: ./people.js draws what it says.
//
//   createConcourse({ kinds, seed, start }) → { people, step(t, dt, { rick, mood }) → people }
//     kinds: the walkers' kinds in order (people.js's); a 'daycare' (a
//     Morty) walks with the Rick before him. start: { [need]: level } for
//     everyone (a test's). rick: the walker ({ x, z, face, speed }), or null
//     when he's not on the concourse; mood: 'day' | 'election' (the crowds
//     that stand about, in the way too)
//   person (every frame): { id, kind, role, x, z, yaw, speed, mode, place,
//     look, base, loop, cue, talk, wave, shove, seated, leader }
//     yaw: body.js's (0 along +z, toward +x); mode: 'walk' | 'wait' | 'use' |
//     'talk' | 'listen' | 'makeway'; place: the id of the place it's going to
//     or using; look: { x, y?, z } where its head is turned, or null;
//     base: 'sit' on a bench; loop: a clip on its upper half while it lasts
//     ('talk': a petition, or its turn in a conversation); cue: a one-shot to
//     play this frame ('interact' at a kiosk); talk: its turn to speak;
//     wave: it's greeting Rick (this frame); shove: Rick walked into it (this
//     frame); seated: on a bench, or getting on or off one
//     hold: seconds it stays where it is (a world's moment for it), making
//     way for Rick all the same
//   PLACES, SCHEDULES, citadelHour(t)

import { createNeeds, pickPlace, release, reserve, spotOf } from '../../../lib/ai/needs';
import { createSocial } from '../../../lib/ai/social';
import { avoid, clear, createContext, resolve, seek, separate } from '../../../lib/ai/steer';
import { turn } from '../../../lib/three/gait';
import { seeded } from '../../../lib/seeded';
import { pushOut } from '../../middleearth/towns/walker';
import { BENCHES, COLLIDERS, CROWD_LOOPS, DOORS, KIOSKS, PEN, WALLS, WORLD, crowdColliders } from './layout';
import { easeTurn, yawOf } from './bodies';

// The Citadel's clock: eight in the morning when you come through the
// portal, an hour every half minute (a day in twelve).
export const citadelHour = (t) => (((8 + t / 30) % 24) + 24) % 24;

// ── where people go ──
// face: the point a user faces; look: where its head goes (above its eyes:
// the holo-ads), else the face point; skip: the collider it's right by,
// not steered round on the way to it; seat: sat on, from `approach` metres in front
const railAt = (a, r = 39) => [Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * 100) / 100];
const kioskFront = (k, d = 2.1) => {
  const l = Math.hypot(k.x, k.z);
  return [k.x - (k.x / l) * d, k.z - (k.z / l) * d];
};
const benchSpots = (b) => [-0.62, 0.62].map((s) => [b.x + Math.cos(b.turn) * s, b.z - Math.sin(b.turn) * s]);
export const PLACES = [
  // Simple Rick's: the shift at its doors
  { id: 'factory', at: [35.4, -2.8], spots: [[35.6, -2.2], [34.8, -3.5]], need: 'work', slots: 2, clip: 'interact', every: [4, 7], duration: 22, face: [DOORS.factory.x, DOORS.factory.z] },
  // the kiosks: something to eat, or what passes for it
  ...KIOSKS.map((k, i) => ({ id: `kiosk${i}`, at: kioskFront(k), need: 'food', slots: 1, clip: 'interact', every: [2.5, 4.5], duration: 8, face: [k.x, k.z], skip: `kiosk${i}` })),
  // the Council's doors: a petition, argued
  { id: 'petition-w', at: [-4.5, -31.3], spots: [[-4.6, -31.2], [-3.3, -30.5]], need: 'council', slots: 2, loop: 'talk', duration: 12, face: [0, -40] },
  { id: 'petition-e', at: [4.5, -31.3], spots: [[4.6, -31.2], [3.3, -30.5]], need: 'council', slots: 2, loop: 'talk', duration: 12, face: [0, -40] },
  // the benches, facing the core
  ...BENCHES.map((b, i) => ({ id: `bench${i}`, at: [b.x, b.z], spots: benchSpots(b), need: 'rest', slots: 2, base: 'sit', seat: true, approach: 0.55, duration: 18, face: [0, 0], skip: `bench${i}` })),
  // the rail, and the city past it (between the crowds that stand there and the doors)
  ...[-0.62, -0.95, -1.22, 1.1, 1.32, 2.92, -2.95].map((a, i) => ({ id: `rail${i}`, at: railAt(a), spots: [railAt(a - 0.018), railAt(a + 0.018)], need: 'view', slots: 2, duration: 14, face: railAt(a, 80) })),
  // the holo-ads on the core, its north-east side (the day's watchers have the south-west)
  ...[-0.55, 0.2].map((a, i) => ({ id: `ads${i}`, at: railAt(a, 7.4), spots: [railAt(a - 0.1, 7.4), railAt(a + 0.1, 7.4)], need: 'view', slots: 2, duration: 10, face: [0, 0], look: { x: 0, y: 9, z: 0 } })),
];

// what each part wants, by the clock (the rest of the day, its needs say)
export const SCHEDULES = {
  worker: [
    { from: 8, to: 12, want: 'work' },
    { from: 12, to: 13, want: 'food' },
    { from: 13, to: 18, want: 'work' },
  ],
  official: [
    { from: 9, to: 12.5, want: 'council' },
    { from: 12.5, to: 13.5, want: 'food' },
    { from: 13.5, to: 17, want: 'council' },
  ],
  citizen: [
    { from: 12, to: 13.5, want: 'food' },
    { from: 19, to: 22, want: 'view' },
  ],
};
const ROLES = { factoryrick: 'worker', constructionrick: 'worker', suitrick: 'official', sweaterrick: 'official', detectiverick: 'official', daycare: 'morty' };
// how fast each need rises (a second); a shift and a petition are the
// clock's, not a need's (nobody works the line at midnight)
const NEEDS = {
  worker: { food: 0.006, rest: 0.008, view: 0.004, company: 0.006 },
  official: { food: 0.006, rest: 0.004, view: 0.005, company: 0.008 },
  citizen: { food: 0.007, rest: 0.007, view: 0.01, company: 0.01, council: 0.002 },
};

const RADIUS = 0.3; // a person, kept out of things
const ARRIVE = 0.35; // metres from where it's going: there
const PACE = [1.15, 1.45]; // metres a second, its own
const HURRY = 1.7; // out of Rick's way
const ACCEL = 4; // how quickly its pace comes round to what it wants (1/s)
const TURN = 6; // how quickly its body comes round (1/s)
const SPIN = 1.8; // and no quicker than this standing (rad/s): its feet don't step
const SPACING = 0.9; // kept between people
const ROOM = 0.75; // Rick's: anyone nearer is shoved out of it
const SIT = 0.7; // seconds getting on or off a bench
const STUCK = 3; // seconds getting nowhere before it gives up and goes elsewhere
const PAUSE = [1, 4.5]; // seconds it stands at a stop on a stroll
const KNOWS = 0.35; // the share who know Rick C-137 by sight
const RIM = WORLD.radius - 0.7;

const span = (r, [lo, hi]) => lo + (hi - lo) * r();
const apart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// the things to steer round, by mood: everything as a circle (a box as the
// circle round it), the pen as one, and the crowds that stand about
const obstaclesFor = (() => {
  const by = new Map();
  const round = (c) => (c.kind === 'circle' ? { id: c.id, at: { x: c.x, z: c.z }, r: c.r } : { id: c.id, at: { x: c.x, z: c.z }, r: Math.hypot(c.w, c.d) / 2 });
  return (mood) => {
    if (!by.has(mood)) {
      const crowd = crowdColliders(mood);
      by.set(mood, {
        steer: [...COLLIDERS.map(round), { id: 'pen', at: { x: PEN.x, z: PEN.z }, r: Math.hypot(PEN.w, PEN.d) / 2 }, ...crowd.map(round)],
        push: [...COLLIDERS, ...crowd],
      });
    }
    return by.get(mood);
  };
})();

// where a stroll goes: the old loops' corners, and round the ring
const STROLL = [...CROWD_LOOPS.flat(), ...Array.from({ length: 8 }, (_, i) => railAt((i / 8) * Math.PI * 2 + 0.2, 17))].map(([x, z]) => ({ x, z }));

// a point along a closed loop, `s` metres round it (people.js's along, for the start)
function onLoop(loop, s) {
  const lengths = loop.map((a, i) => Math.hypot(loop[(i + 1) % loop.length][0] - a[0], loop[(i + 1) % loop.length][1] - a[1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let d = ((s % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    if (d <= lengths[i]) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const k = lengths[i] ? d / lengths[i] : 0;
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), total };
    }
    d -= lengths[i];
  }
  return { x: loop[0][0], z: loop[0][1], yaw: 0, total };
}

export function createConcourse({ kinds = [], seed = 1, start = null } = {}) {
  const rand = seeded(seed);
  const places = PLACES.map((p) => ({ ...p })); // (this concourse's: its reservations are its own)
  const social = createSocial({ rand: seeded(seed ^ 0x51ed) });
  let leaderOf = null;
  const people = kinds.map((kind, i) => {
    const role = ROLES[kind] ?? 'citizen';
    // round the old loops, as they always started
    const loop = CROWD_LOOPS[i % CROWD_LOOPS.length];
    const at = onLoop(loop, 0);
    const p0 = onLoop(loop, at.total * ((i * 0.37 + 0.11) % 1));
    const p = {
      id: i,
      kind,
      role,
      x: p0.x,
      z: p0.z,
      yaw: p0.yaw,
      vx: 0,
      vz: 0,
      speed: 0,
      pace: role === 'morty' ? 1.35 : span(rand, PACE),
      needs: role === 'morty' ? null : createNeeds({ needs: NEEDS[role], rand, start }),
      knows: rand() < KNOWS,
      mode: 'walk',
      place: null,
      goal: null,
      last: null,
      timer: 0,
      cueIn: 0,
      pause: span(rand, [0, 2]),
      stuck: 0,
      seat: null,
      talking: false,
      ctx: createContext(16),
      // what it shows, this frame
      look: null,
      base: null,
      loop: null,
      cue: null,
      talk: false,
      wave: false,
      shove: false,
      seated: false,
      leader: null,
    };
    // a Morty: his Rick's, the one before him
    if (role === 'morty') p.leader = leaderOf;
    else leaderOf = i;
    return p;
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const leaders = new Set(people.filter((p) => p.leader != null).map((p) => p.leader));

  const placeOf = (id) => places.find((q) => q.id === id) ?? null;
  const pointOf = (look) => (look == null ? null : typeof look === 'object' ? look : (() => {
    const q = byId.get(look);
    return q ? { x: q.x, z: q.z } : null;
  })());

  // its walk ended: what's next, by its needs and the clock
  function choose(p, hour) {
    if (!p.needs) return;
    const role = SCHEDULES[p.role] ?? SCHEDULES.citizen;
    const want = role.find((s) => (s.from <= s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to))?.want ?? null;
    // company most of all, and nothing the clock says: about, to be talked to
    const lv = p.needs.levels();
    const top = Object.entries(lv).sort((a, b) => b[1] - a[1])[0];
    if (!want && top?.[0] === 'company' && top[1] >= 0.5) return stroll(p);
    const q = pickPlace({ id: p.id, x: p.x, z: p.z, needs: p.needs, last: p.last }, places, { t: hour, schedule: role, rand });
    if (q && reserve(q, p.id)) {
      p.place = q.id;
      const [x, z] = spotOf(q, p.id);
      p.seat = q.seat ? { x, z } : null;
      p.goal = q.seat ? frontOf(q, x, z) : { x, z };
      return;
    }
    stroll(p);
  }
  function stroll(p) {
    let best = null;
    for (let tries = 0; tries < 6 && !best; tries++) {
      const s = STROLL[Math.floor(rand() * STROLL.length)];
      if (apart(s, p) > 6) best = s;
    }
    p.goal = best ? { x: best.x + (rand() - 0.5) * 2, z: best.z + (rand() - 0.5) * 2 } : null;
  }
  // a bench's seat, from `approach` in front of it (toward what it faces)
  const frontOf = (q, x, z) => {
    const dx = q.face[0] - x;
    const dz = q.face[1] - z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: x + (dx / d) * q.approach, z: z + (dz / d) * q.approach };
  };
  const leave = (p) => {
    const q = placeOf(p.place);
    if (q) release(q, p.id);
    p.last = p.place;
    p.place = null;
    p.goal = null;
    p.seat = null;
  };
  const faceYaw = (p, f) => Math.atan2(f.x - p.x, f.z - p.z);

  // a step toward `goal` at `pace`: steered round things and people, eased
  function walkTo(p, goal, pace, dt, world, rick) {
    let wx = 0;
    let wz = 0;
    if (goal) {
      const d = apart(p, goal);
      if (d > ARRIVE * 0.5) {
        const ctx = p.ctx;
        clear(ctx);
        const from = { x: p.x, y: 0, z: p.z };
        seek(ctx, from, { x: goal.x, y: 0, z: goal.z }, 1, 7);
        // (only what's nearer than where it's going, and not the thing it's going to)
        const skip = placeOf(p.place)?.skip;
        if (d > 1.2)
          for (const o of world.steer) {
            if (o.id === skip) continue;
            const od = Math.hypot(o.at.x - p.x, o.at.z - p.z) - o.r;
            if (od < Math.min(d, 3.2)) avoid(ctx, from, { x: p.vx, z: p.vz }, o, 0.35, 2);
          }
        const near = [];
        for (const q of people) if (q !== p && Math.abs(q.x - p.x) < SPACING && Math.abs(q.z - p.z) < SPACING) near.push({ x: q.x, y: 0, z: q.z });
        if (rick) near.push({ x: rick.x, y: 0, z: rick.z });
        separate(ctx, from, near, SPACING);
        const r = resolve(ctx, { blend: 0.3 });
        const want = r.strength > 0 ? Math.min(pace, d * 1.6) : 0;
        wx = r.dir.x * want;
        wz = r.dir.z * want;
      }
    }
    const k = 1 - Math.exp(-ACCEL * dt);
    p.vx += (wx - p.vx) * k;
    p.vz += (wz - p.vz) * k;
    let x = p.x + p.vx * dt;
    let z = p.z + p.vz * dt;
    [x, z] = pushOut(x, z, RADIUS, world.push, WALLS);
    const r = Math.hypot(x, z);
    if (r > RIM) {
      x *= RIM / r;
      z *= RIM / r;
    }
    p.speed = dt > 0 ? Math.hypot(x - p.x, z - p.z) / dt : 0;
    p.x = x;
    p.z = z;
    if (p.speed > 0.15) p.yaw = turn(p.yaw, Math.atan2(p.vx, p.vz), dt, TURN);
    // getting nowhere: somewhere else
    p.stuck = goal && apart(p, goal) > 1 && p.speed < 0.25 ? p.stuck + dt : 0;
  }

  // at its place: sat (getting on and off its bench), its clip now and then
  function atPlace(p, dt) {
    const q = placeOf(p.place);
    if (!q) {
      p.mode = 'walk';
      return;
    }
    p.timer -= dt;
    p.speed = 0;
    p.vx = p.vz = 0;
    if (q.seat && p.seat) {
      const front = frontOf(q, p.seat.x, p.seat.z);
      const off = p.timer <= 0;
      // on: from the front onto the seat as it sits; off: back to the front as it stands
      p.sitT = Math.min(SIT, (p.sitT ?? 0) + dt);
      const k = Math.min(1, p.sitT / SIT);
      const [a, b] = off ? [p.seat, front] : [front, p.seat];
      p.x = a.x + (b.x - a.x) * k;
      p.z = a.z + (b.z - a.z) * k;
      p.seated = true;
      p.base = off ? null : 'sit';
      if (off && k >= 1) {
        p.seated = false;
        p.sitT = 0;
        done(p, q);
        return;
      }
    } else if (p.timer <= 0) {
      done(p, q);
      return;
    }
    p.yaw = easeTurn(p.yaw, faceYaw(p, { x: q.face[0], z: q.face[1] }), dt, TURN, SPIN);
    p.look = q.look ?? { x: q.face[0], z: q.face[1] };
    p.loop = q.loop ?? null;
    if (q.clip) {
      p.cueIn -= dt;
      if (p.cueIn <= 0) {
        p.cue = q.clip;
        p.cueIn = span(rand, q.every ?? [3, 6]);
      }
    }
  }
  function done(p, q) {
    p.needs?.satisfy(q.need, 0.9);
    leave(p);
    p.mode = 'walk';
    p.pause = span(rand, [0, 1.5]);
  }
  function arrive(p) {
    const q = placeOf(p.place);
    if (!q) return;
    p.mode = 'use';
    p.timer = q.duration * (0.8 + 0.4 * rand());
    p.cueIn = 0.4;
    p.sitT = 0;
    if (q.seat && p.seat) p.seat = { ...p.seat };
  }

  function step(t, dt, { rick = null, mood = 'day' } = {}) {
    const world = obstaclesFor(mood === 'election' ? 'election' : 'day');
    const hour = citadelHour(t);
    const you = rick ? { x: rick.x, z: rick.z, yaw: yawOf(rick.face ?? 0), speed: rick.speed ?? 0 } : null;
    const entries = new Map();
    const list = people.map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      company: p.needs?.level('company') ?? 0,
      busy: p.mode === 'use',
      knows: p.knows,
      ...(p.leader != null ? { group: p.leader } : leaders.has(p.id) ? { group: p.id, leader: true } : {}),
    }));
    for (const e of social.step(list, t, dt, { you })) entries.set(e.who, e);

    for (const p of people) {
      p.cue = null;
      p.wave = false;
      p.shove = false;
      p.talk = false;
      p.loop = null;
      p.look = null;
      if (p.mode !== 'use') {
        p.base = null;
        p.seated = false;
      }
      p.needs?.tick(dt);
      const e = entries.get(p.id);
      // a conversation over: company had
      const talking = social.talking(p.id);
      if (p.talking && !talking) p.needs?.satisfy('company', 0.9);
      p.talking = talking;

      if (p.mode === 'use') {
        atPlace(p, dt);
        if (e?.look) p.look = pointOf(e.look);
        if (e?.wave) p.wave = true;
        continue;
      }
      if (p.hold > 0) {
        // (held where it is, by whoever made it)
        p.hold -= dt;
        walkTo(p, e?.mode === 'makeway' ? e.to : { x: p.x, z: p.z }, HURRY, dt, world, rick);
        p.mode = e?.mode === 'makeway' ? 'makeway' : 'wait';
        if (e?.look) p.look = pointOf(e.look);
        if (e?.shove) p.shove = true;
        if (e?.wave) p.wave = true;
        continue;
      }
      let goal = p.goal;
      let pace = p.pace;
      if (e && (e.mode === 'talk' || e.mode === 'listen')) {
        p.mode = e.mode;
        goal = e.to ?? { x: p.x, z: p.z };
        pace = 0.9;
        p.talk = e.mode === 'talk';
        if (p.talk) p.loop = 'talk';
      } else if (e && (e.mode === 'walk' || e.mode === 'makeway')) {
        p.mode = e.mode;
        goal = e.to;
        if (e.mode === 'makeway') pace = HURRY;
      } else if (p.leader != null) {
        // a Morty with nowhere he's told: by his Rick
        p.mode = 'wait';
        goal = null;
      } else {
        p.mode = 'walk';
        if (!p.goal && (p.pause -= dt) <= 0) choose(p, hour);
        goal = p.goal;
      }
      walkTo(p, goal, pace, dt, world, rick);

      // where its head goes: who it's with, else where it's going near its end
      p.look = e?.look != null ? pointOf(e.look) : null;
      if (!p.look && p.leader != null && p.speed < 0.2) p.look = pointOf(p.leader);
      if (e?.wave) p.wave = true;
      if (e?.shove) p.shove = true;
      // talking: face whoever's in it with it
      if ((p.mode === 'talk' || p.mode === 'listen') && p.speed < 0.3 && p.look) p.yaw = easeTurn(p.yaw, faceYaw(p, p.look), dt, TURN, SPIN);
      else if (p.mode === 'wait' && p.leader != null && p.speed < 0.2) p.yaw = easeTurn(p.yaw, byId.get(p.leader)?.yaw ?? p.yaw, dt, 2, SPIN);

      // there
      if (!e && p.goal && apart(p, p.goal) < ARRIVE) {
        if (p.place) arrive(p);
        else {
          p.goal = null;
          p.pause = span(rand, PAUSE);
        }
      }
      if (p.stuck > STUCK) {
        if (p.place) leave(p);
        p.goal = null;
        p.pause = 0.5;
        p.stuck = 0;
      }
    }

    // Rick's room: anyone he's walked into, out of his way, and shoved
    if (rick)
      for (const p of people) {
        if (p.seated) continue;
        const d = apart(p, rick);
        if (d >= ROOM || d < 1e-6) continue;
        const [x, z] = pushOut(rick.x + ((p.x - rick.x) / d) * ROOM, rick.z + ((p.z - rick.z) / d) * ROOM, RADIUS, world.push, WALLS);
        p.x = x;
        p.z = z;
        if ((rick.speed ?? 0) > 0.5) {
          p.shove = true;
          p.look = { x: rick.x, z: rick.z };
        }
      }
    return people;
  }

  return { people, places, step };
}
