// Albuquerque's people out on the street, and what they make of Walt's car:
// Saul at his door waves you in, Gus outside Los Pollos gives the smallest
// bow, Mike at the laundry folds his arms, Jesse by the RV yells "Yo!",
// Tuco outside Tampico pounds his chest at you, Badger and Skinny Pete at
// the Dog House talk (about Star Trek) and wave. Everyone's head follows the
// car once it's near; a car coming at someone fast sends them out of its
// way. And a few on the sidewalks with somewhere to be (Lydia on her phone
// round Los Pollos' block, Declan round the laundry's, the nurse round
// Casa Tranquila's), walking the block, stopping at a door, and stepping
// back from a car up on the kerb. Pure: no three.js, no Math.random.
//
//   CAST_AT: [[id, x, z, yaw, place]…] where each stands and which of
//     rules.js's PLACES is theirs (pulling up there is coming to see them)
//   castFor({ phone, bloom }) → the ids to load: everyone on a computer that
//     draws the bloom, the three you go to see first otherwise
//   CIVILIANS: [{ id, near, stops: [{ at (0…1 round the ring), dwell, clip }], pace }]
//   createStreet({ seed }) → { step(dt, { car: { x, z, yaw, speed }, near }) → { [id]: act } }
//     act: { look: { x, z } | null (the car, or the one they're talking with),
//     clip: name | null (a one-shot to start now), layer, gesture: name |
//     null (people.js's, to start now), talk: bool (their turn, in a chat) }
//   ringOf(kerb, inset) → { x0, z0, x1, z1 } the line round a block's sidewalk
//   createErrand({ ring, stops, seed, pace }) → { step(dt, car) → { x, z,
//     yaw, speed, doing } }: round and round the ring at `pace`, stopping at
//     each stop for its dwell (doing: its clip), easing in and out of every
//     stop and round every corner; a car on the sidewalk close by, it stops
//     and steps back (doing: 'scared')

import { seeded } from '../../../lib/seeded';
import { turn } from '../../../lib/three/gait';

const P = Math.PI;
export const CAST_AT = [
  ['jesse', -336, 124.6, P, 'rv'],
  ['saul', -84.5, 12.4, P, 'saul'],
  ['gus', 84, -13.2, 0, 'pollos'],
  ['mike', 146, -15.6, 0.3, 'superlab'],
  ['badger', -83.5, -13.6, 0.3, null],
  ['pete', -82.2, -14.4, -0.5, null],
  ['tuco', 11.4, 150, -P / 2, null],
];
const FEW = ['jesse', 'saul', 'gus'];
export const castFor = ({ phone = false, bloom = 1 } = {}) => (phone || !(bloom > 0) ? FEW : CAST_AT.map(([id]) => id));

// what each does when you pull up at their place, and when you drive up near them
const MANNER = {
  saul: { pullUp: { clip: 'wave' }, then: { clip: 'beckon' }, near: { clip: 'wave' } },
  gus: { pullUp: { clip: 'bow' } },
  mike: { pullUp: { gesture: 'fold' } },
  jesse: { pullUp: { clip: 'wave.one' }, near: { clip: 'wave.one' } },
  tuco: { near: { clip: 'taunt.trooper' } },
  badger: { near: { clip: 'wave.one' } },
  pete: { near: { clip: 'wave' } },
};
const REGARD = 18; // metres: the car this near, they look at it
const GREET = 12; // and this near, coming closer, they greet it
const REARM = 30; // once it's been this far away, they'll greet it again
const SLOW = 2; // m/s: pulled up
const FAST = 7; // m/s: a car coming this fast
const DANGER = 10; // metres, at someone: they get out of its way
const LANE = 2; // metres off its line, still in its way
const SCARE_EVERY = 4; // seconds between
const CHAT = [2.2, 4.5]; // seconds a turn, Badger's and Pete's
const EYES = 1.1; // a car's middle, to look at, over the ground

export function createStreet({ seed = 9 } = {}) {
  const rand = seeded(seed);
  const st = new Map(CAST_AT.map(([id, x, z, yaw, place]) => [id, { id, x, z, yaw, place, greeted: false, pulled: false, then: 0, scared: -99, last: null }]));
  const chat = { speaker: 'badger', left: 2 + rand() * 2 };
  let clock = 0;
  return {
    step(dt, { car = null, near = null } = {}) {
      const d0 = dt > 0 ? Math.min(dt, 0.1) : 0;
      clock += d0;
      const out = {};
      const busy = new Set();
      for (const s of st.values()) {
        const act = { look: null, clip: null, layer: 'upper', gesture: null, talk: false };
        out[s.id] = act;
        if (!car) continue;
        const dx = car.x - s.x;
        const dz = car.z - s.z;
        const d = Math.hypot(dx, dz);
        const coming = s.last != null && d < s.last - 1e-4;
        s.last = d;
        if (d < REGARD) act.look = { x: car.x, z: car.z, y: EYES };
        if (d > REARM) s.greeted = false;
        const m = MANNER[s.id] ?? {};
        // a car coming at them, fast: out of its way
        const fx = Math.sin(car.yaw ?? 0);
        const fz = Math.cos(car.yaw ?? 0);
        // (them from the car: how far ahead of it, and how far off its line)
        const along = -dx * fx - dz * fz;
        const off = Math.abs(-dx * fz + dz * fx);
        if ((car.speed ?? 0) > FAST && along > 0 && along < DANGER && off < LANE && clock - s.scared > SCARE_EVERY) {
          s.scared = clock;
          act.clip = 'scared';
          act.layer = 'full';
          busy.add(s.id);
          continue;
        }
        // pulled up at their place: their welcome, once a visit, and what follows it
        const here = s.place != null && near === s.place && Math.abs(car.speed ?? 0) < SLOW;
        if (here && !s.pulled) {
          s.pulled = true;
          s.greeted = true;
          if (m.pullUp?.clip) act.clip = m.pullUp.clip;
          if (m.pullUp?.gesture) act.gesture = m.pullUp.gesture;
          if (m.then) s.then = 2.2;
          busy.add(s.id);
        } else if (near !== s.place) s.pulled = false;
        if (s.then > 0) {
          s.then -= d0;
          if (s.then <= 0 && here && m.then) act.clip = m.then.clip;
        }
        // driving up near them: a greeting, once until the car's been away
        if (!s.greeted && coming && d < GREET && m.near) {
          s.greeted = true;
          if (m.near.clip) act.clip = m.near.clip;
          busy.add(s.id);
        }
      }
      // Badger and Pete, talking, turn and turn about, looking at each
      // other (unless there's a car to look at)
      chat.left -= d0;
      if (chat.left <= 0) {
        chat.speaker = chat.speaker === 'badger' ? 'pete' : 'badger';
        chat.left = CHAT[0] + rand() * (CHAT[1] - CHAT[0]);
      }
      const b = st.get('badger');
      const p = st.get('pete');
      for (const [me, them] of [
        [b, p],
        [p, b],
      ]) {
        const act = out[me.id];
        if (busy.has(me.id)) continue;
        act.talk = chat.speaker === me.id && !act.look;
        if (!act.look) act.look = { x: them.x, z: them.z, y: 1.6 };
      }
      return out;
    },
  };
}

// ── on the sidewalks ──
export const CIVILIANS = [
  // Lydia, on her phone, round Los Pollos' block; a long call outside the restaurant
  { id: 'lydia', near: { x: 90, z: -24 }, stops: [{ at: 0.12, dwell: 9, clip: 'phone' }, { at: 0.6, dwell: 4, clip: 'look.around' }], pace: 1.25, phone: true },
  // Declan round the laundry's block, a look at the cars
  { id: 'declan', near: { x: 155, z: -24 }, stops: [{ at: 0.3, dwell: 6, clip: 'look.around' }], pace: 1.35 },
  // the nurse, off shift, round Casa Tranquila's
  { id: 'nurse', near: { x: 24, z: 100 }, stops: [{ at: 0.45, dwell: 7, clip: 'phone' }], pace: 1.1 },
];

export const ringOf = (kerb, inset = 2.2) => ({ x0: kerb.x0 + inset, z0: kerb.z0 + inset, x1: kerb.x1 - inset, z1: kerb.z1 - inset });

// a point `s` metres round the ring (clockwise from its x0, z0 corner, as seen from above with +z down)
function onRing(r, s) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const L = 2 * (w + d);
  let k = ((s % L) + L) % L;
  if (k < w) return { x: r.x0 + k, z: r.z0 };
  k -= w;
  if (k < d) return { x: r.x1, z: r.z0 + k };
  k -= d;
  if (k < w) return { x: r.x1 - k, z: r.z1 };
  k -= w;
  return { x: r.x0, z: r.z1 - k };
}

const ACCEL = 1.4;
const DECEL = 1.8;
const CARROT = 1.2; // metres ahead the body faces (corners turned into)
const BACK_OFF = { near: 3.5, speed: 3 }; // a car this close (up on the sidewalk), this fast: they stop and step back

export function createErrand({ ring, stops = [], seed = 1, pace = 1.2 } = {}) {
  const rand = seeded(seed);
  const L = 2 * (ring.x1 - ring.x0 + ring.z1 - ring.z0);
  const marks = stops.map((s) => ({ ...s, s: s.at * L })).sort((a, b) => a.s - b.s);
  const st = { s: rand() * L, v: 0, yaw: 0, dwell: 0, doing: null, next: 0, scared: 0 };
  // the next stop ahead of s
  const nextStop = () => {
    for (let lap = 0; lap < 2; lap++) for (const m of marks) if (m.s + lap * L > st.s + 0.05) return { ...m, s: m.s + lap * L };
    return null;
  };
  let target = nextStop();
  const start = onRing(ring, st.s);
  const ahead = onRing(ring, st.s + CARROT);
  st.yaw = Math.atan2(ahead.x - start.x, ahead.z - start.z);
  return {
    step(dt, car = null) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      const here = onRing(ring, st.s);
      // a car up on the sidewalk close by: stop, and step back from it
      if (car && Math.hypot(car.x - here.x, car.z - here.z) < BACK_OFF.near && Math.abs(car.speed ?? 0) > BACK_OFF.speed) st.scared = 1.5;
      if (st.scared > 0) {
        st.scared -= d;
        st.v = Math.max(0, st.v - DECEL * 2 * d);
        st.s += st.v * d;
        const p = onRing(ring, st.s);
        return { x: p.x, z: p.z, yaw: st.yaw, speed: st.v, doing: 'scared' };
      }
      if (st.dwell > 0) {
        st.dwell -= d;
        if (st.dwell <= 0) {
          st.doing = null;
          target = nextStop();
        }
        return { x: here.x, z: here.z, yaw: st.yaw, speed: 0, doing: st.doing };
      }
      const left = target ? target.s - st.s : Infinity;
      const cap = Math.min(pace, Math.sqrt(2 * DECEL * Math.max(0, left)));
      st.v = cap > st.v ? Math.min(cap, st.v + ACCEL * d) : Math.max(cap, st.v - DECEL * 1.5 * d);
      st.s += Math.min(st.v * d, Math.max(0, left));
      const p = onRing(ring, st.s);
      const a = onRing(ring, st.s + CARROT);
      st.yaw = turn(st.yaw, Math.atan2(a.x - p.x, a.z - p.z), d, 5);
      if (target && target.s - st.s < 0.02 && st.v < 0.05) {
        st.v = 0;
        st.dwell = target.dwell;
        st.doing = target.clip ?? null;
        if (st.s >= L) st.s -= L;
      }
      if (st.s >= L * 2) st.s -= L;
      return { x: p.x, z: p.z, yaw: st.yaw, speed: st.v, doing: null };
    },
  };
}
