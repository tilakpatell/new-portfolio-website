// What the city's people do, as numbers (./npcs.js draws it): Debbie on the
// porch, Cecil at the GDA's door, the Burger Mart manager and his line, the
// students on the school steps, the crowd on the Guardians' plaza. Each
// stands where they stand, chatting, on the phone, looking about, and when
// Mark comes by they look at him (the head first; the body turns only once
// he's well round to one side, a step or two), wave when he's up in the
// air, talk when he's talking to them, and cheer when the Flaxans are
// beaten. When something comes down near them (a hard landing's crater, a
// Flaxan knocked out of the sky) they're scared: most run from it, then
// walk back to where they were; Debbie stays on her porch, and Cecil just
// looks. Pure, seeded, no three.js: a mind a frame, its body's step out.
//
//   FOLK: the distances, speeds and times
//   createFolk({ id, role, x, y, z, face, base, r, seed, stays, calm }) → a person
//     base: 'idle' | 'talk' | 'arms' (what they do left alone); stays: never
//     runs (on a porch, at a door); calm: not scared, just looks
//   stepFolk(s, dt, { hero, talking, scares, won, blocked }) → their body's step:
//     { mode, ground, look, react, x, z, yaw }
//     hero: { x, y, z, air } (his feet); talking: he's talking to this one;
//     scares: [{ x, z, r }] this frame's; won: the Flaxans were beaten this
//     frame; blocked(x, z) → true where they can't go (a building)
//     mode: the clip ('idle', 'walk', 'run', 'talk', 'wave', 'phone',
//     'look', 'cheer', 'arms'); ground: metres a second over it; look: the
//     point their head's on, or null; react: 'gunfire' as they're scared
//     (react.js's), else null, with `at`, where from

import { seeded } from '../../../lib/seeded';
import { cooldown, pick } from '../../../lib/ai/utility';
import { wrapAngle } from '../../../lib/ai/vec';

export const FOLK = {
  notice: 30, // metres: they look at him from this near
  turnPast: 1.05, // rad: past this far round, the body turns, not just the head
  turnTo: 0.3, // and stops this far from square on
  turnRate: 2.4, // rad a second, stepping round
  scared: 8, // metres past a scare's own reach they hear it
  flee: { speed: 4.6, time: 3.2 },
  back: 1.3, // walking home, m/s
  cheer: 2.6, // seconds of a cheer
  fidget: [7, 18], // seconds between one idle thing and the next
  eyes: 1.6, // his head, over his feet
};

// what a person does left alone, by turns (their own clips: the phone, a
// look round, standing): each wants a while before it's chosen again
const IDLES = [
  { id: 'idle', weight: 1, considerations: [] },
  { id: 'phone', weight: 0.8, considerations: [(c) => cooldown(c.since.phone, 30)] },
  { id: 'look', weight: 0.7, considerations: [(c) => cooldown(c.since.look, 20)] },
];

export function createFolk({ id, role = 'fan', x, y = 0, z, face = 0, base = 'idle', r = 9, seed = 1, stays = false, calm = false }) {
  const rand = seeded(seed * 7919 + 13);
  return {
    id,
    role,
    home: { x, y, z },
    x,
    z,
    yaw: face,
    face,
    base,
    r,
    stays,
    calm,
    rand,
    task: 'home', // 'home' | 'flee' | 'back'
    left: 0, // of the flight (s)
    fx: 0,
    fz: 0,
    alarm: 0, // seconds still looking at what scared them
    at: null, // where from
    cheer: 0,
    turning: false,
    idle: { mode: 'idle', next: FOLK.fidget[0] + rand() * (FOLK.fidget[1] - FOLK.fidget[0]), since: { phone: 1e9, look: 1e9 } },
  };
}

// a step along (dx, dz) from (x, z), turned off a building's wall when one's in the way
function clear(s, dx, dz, blocked) {
  if (!blocked) return [dx, dz];
  const l = Math.hypot(dx, dz) || 1;
  for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const c = Math.cos(a);
    const n = Math.sin(a);
    const rx = dx * c + dz * n;
    const rz = -dx * n + dz * c;
    if (!blocked(s.x + (rx / l) * 1.2, s.z + (rz / l) * 1.2)) return [rx, rz];
  }
  return [0, 0];
}

// Atom Eve's patrol, as a choice made each frame (utility.js's pick, its
// ranks a priority): over to Mark's side while the Flaxans are on him (the
// fight's near him), a cheer once they're beaten, stopped to talk when he's
// caught her up (./npcs.js's EVE rules say when), else round her loop.
// eveChoice({ fight, cheer, wait }) → 'assist' | 'cheer' | 'meet' | 'patrol'
//   fight: the invasion's on near him; cheer: seconds of a cheer left;
//   wait: she's stopped for him
const EVE_OPTIONS = [
  { id: 'assist', rank: 3, considerations: [(c) => (c.fight ? 1 : 0)] },
  { id: 'cheer', rank: 2, considerations: [(c) => (c.cheer > 0 ? 1 : 0)] },
  { id: 'meet', rank: 1, considerations: [(c) => (c.wait ? 1 : 0)] },
  { id: 'patrol', rank: 0, considerations: [] },
];
export function eveChoice(ctx) {
  return pick(EVE_OPTIONS, ctx, { rank: (o) => o.rank })?.id ?? 'patrol';
}

const yawTo = (s, x, z) => Math.atan2(x - s.x, z - s.z);
// the body round toward `want` at the turning rate
function turnToward(s, want, dt) {
  const d = wrapAngle(want - s.yaw);
  const step = Math.min(Math.abs(d), FOLK.turnRate * dt);
  s.yaw = wrapAngle(s.yaw + Math.sign(d) * step);
  return Math.abs(d) - step;
}

export function stepFolk(s, dt, { hero = null, talking = false, scares = [], won = false, blocked = null } = {}) {
  dt = Math.min(Math.max(dt || 0, 0), 0.1);
  const out = { mode: s.base, ground: 0, look: null, react: null, at: null, x: s.x, z: s.z, yaw: s.yaw };
  // something comes down near them
  for (const q of scares) {
    const d = Math.hypot(s.x - q.x, s.z - q.z);
    if (d > q.r + FOLK.scared) continue;
    s.alarm = 3;
    s.at = { x: q.x, z: q.z };
    if (!s.calm) out.react = 'gunfire';
    out.at = s.at;
    if (!s.stays && !s.calm) {
      s.task = 'flee';
      s.left = FOLK.flee.time;
      s.fx = (s.x - q.x) / (d || 1);
      s.fz = (s.z - q.z) / (d || 1);
      if (d < 1e-3) {
        s.fx = Math.sin(s.face + Math.PI);
        s.fz = Math.cos(s.face + Math.PI);
      }
    }
  }
  if (won) s.cheer = FOLK.cheer + s.rand() * 0.8;
  s.alarm = Math.max(0, s.alarm - dt);
  s.cheer = Math.max(0, s.cheer - dt);
  const eyes = hero ? { x: hero.x, y: hero.y + FOLK.eyes, z: hero.z } : null;
  const dHero = hero ? Math.hypot(hero.x - s.x, hero.z - s.z, hero.y - s.home.y) : Infinity;

  if (s.task === 'flee') {
    s.left -= dt;
    const [dx, dz] = clear(s, s.fx, s.fz, blocked);
    const l = Math.hypot(dx, dz);
    if (l > 0) {
      s.fx = dx / l;
      s.fz = dz / l;
      s.x += s.fx * FOLK.flee.speed * dt;
      s.z += s.fz * FOLK.flee.speed * dt;
      turnToward(s, Math.atan2(s.fx, s.fz), dt * 3);
    }
    if (s.left <= 0) s.task = 'back';
    Object.assign(out, { mode: 'run', ground: l > 0 ? FOLK.flee.speed : 0, look: s.left > FOLK.flee.time - 0.8 && s.at ? { x: s.at.x, y: s.home.y + 1, z: s.at.z } : null });
  } else if (s.task === 'back') {
    const dx = s.home.x - s.x;
    const dz = s.home.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
      s.x = s.home.x;
      s.z = s.home.z;
      s.task = 'home';
    } else {
      const [mx, mz] = clear(s, dx / d, dz / d, blocked);
      const l = Math.hypot(mx, mz);
      const v = Math.min(FOLK.back, d / Math.max(dt, 1e-3));
      if (l > 0) {
        s.x += (mx / l) * v * dt;
        s.z += (mz / l) * v * dt;
        turnToward(s, Math.atan2(mx, mz), dt * 2);
      }
      Object.assign(out, { mode: 'walk', ground: l > 0 ? v : 0, look: dHero < FOLK.notice ? eyes : null });
    }
  }

  if (s.task === 'home') {
    const near = dHero < FOLK.notice;
    // the body: square to him once he's well round to one side, else back to how they stand
    if (near) {
      const toHero = yawTo(s, hero.x, hero.z);
      if (Math.abs(wrapAngle(toHero - s.yaw)) > FOLK.turnPast) s.turning = true;
      if (s.turning && turnToward(s, toHero, dt) <= FOLK.turnTo) s.turning = false;
    } else {
      s.turning = Math.abs(wrapAngle(s.face - s.yaw)) > 0.05;
      if (s.turning) turnToward(s, s.face, dt);
    }
    const stepping = s.turning;
    // what they're doing
    let mode = s.base;
    if (s.cheer > 0 && s.role !== 'cecil') mode = 'cheer';
    else if (near && dHero < s.r && talking) mode = s.base === 'arms' ? 'arms' : 'talk';
    else if (near && hero?.air && (s.role === 'fan' || s.role === 'student' || (s.role === 'debbie' && dHero < s.r))) mode = 'wave';
    else if (s.base === 'idle' && !near && s.alarm <= 0) {
      // now and then, something else to do
      const I = s.idle;
      for (const k of Object.keys(I.since)) I.since[k] += dt;
      I.next -= dt;
      if (I.next <= 0) {
        const got = pick(IDLES, { since: I.since }, { current: I.mode, rand: s.rand, spread: 0.5 });
        I.mode = got?.id ?? 'idle';
        if (I.mode in I.since) I.since[I.mode] = 0;
        I.next = FOLK.fidget[0] + s.rand() * (FOLK.fidget[1] - FOLK.fidget[0]);
      }
      mode = I.mode;
    }
    if (stepping && (mode === 'idle' || mode === 'arms' || mode === 'look' || mode === 'phone')) mode = 'walk';
    Object.assign(out, {
      mode,
      ground: mode === 'walk' ? 0.45 : 0,
      look: s.alarm > 0 && s.at ? { x: s.at.x, y: s.home.y + 1, z: s.at.z } : near ? eyes : null,
    });
  }
  out.x = s.x;
  out.z = s.z;
  out.yaw = s.yaw;
  return out;
}
