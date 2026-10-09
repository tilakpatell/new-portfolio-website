// The fleet parked at a planet, as one mind: the capital ships in a
// system's orbit (world.js's posts: the war's fleet pieces and the escorts
// warEffects.js puts there) see you coming, hail you, scramble their
// fighters at you and fire their turbolasers; or, flying for their side,
// cover you. Pure (no three.js) and seeded, so it's tested in Node;
// galaxy/garrison.js is the scene's glue (it launches the waves through the
// hunters, draws the bolts and voices the lines). The design:
// docs/superpowers/specs/2026-10-08-garrison-defence-design.md, sections 2
// to 4.
//
// Every post perceives (lib/ai/perception, all round, out past its warn
// ring), and the planet blocks its sight (the scene's `seesThrough`); losing
// you, it holds your course for its intuition, then fades. A shot of yours
// that lands on one of theirs (`provoke`) is heard where you fired it from,
// even behind the planet, so a pilot fighting it unseen is still fought. Its
// rings grow with its size and the holder's grip (`ringsOf`): fire,
// scramble, warn, leash. The mind is calm until a post is sure of you inside
// its warn ring. An enemy is challenged, and scrambled at as soon as you're
// inside the scramble ring (with no challenge at all, while it remembers
// trouble); an unsworn pilot is warned, and fought only for lingering past
// the countdown, or for shooting. Nothing hails, scrambles or fires for a
// grace after you jump in, go down or come back, or while you're gone (the
// tunnel, a crash, a landing: `you` null). Fighting, it launches waves from
// a reserve that refills slowly, fires a volley from each post that can see
// you inside its fire ring (never through its own fighters), and stands down
// once you've been out past every leash ring for a while. The bolts are its
// own: it flies them, and a hit is decided here, swept over the frame, never
// drawn and hoped. The aim brackets: it leads you and misses by less the
// longer you hold a line, and turning hard puts it back. Your own side's
// fleet shoots what chases you instead, and sends a flight out to meet you.
//
// postOf({ id, kind, side, size, at, yaw }, out?) → { id, kind, side, size, at, yaw,
//   carrier, hangar, batteries: [{ x, y, z }], spheres: [{ c, r }] }, refreshing `out` in place
// ringsOf(size, tier, out?) → { fire, scramble, warn, leash }
// createGarrison({ rand, small }) → {
//   step(dt, world) → events, provoke('hit' | 'down' | 'hull'), call(),
//   reset('enter' | 'jump' | 'down' | 'respawn'), state, busy, info, bolts }
// world: { posts, you: { x, y, z, vx, vy, vz } | null, stance: 'friend' | 'enemy' | 'wary' | null,
//   tier, battle, planet: { c, r } | null, seesThrough(a, b), fighters: [{ id, at, size }],
//   chasers: [{ id, at, vel?, size }] }
// Events: { type: 'say', sub, post, secs? } (sub: challenge, warn, clear,
// scramble, open, standdown, cover, escort, reinforce), { type: 'scramble',
// post, from, size, ace, wave }, { type: 'volley', post, from, to, friendly }
// (to: the end of its reach, for drawing), { type: 'hit', damage },
// { type: 'cover', id, damage }, { type: 'escort', post }, { type: 'recall' }.
// `post` is the world's own post object (null with none). Points are
// { x, y, z }, in the system's space.

import { belief, createSenses, sense } from '../../lib/ai/perception';
import { FLIGHTS } from '../universe/battleFlights';
import { sweptHit } from '../universe/targeting';
import { HULLS, TURRETS } from '../universe/wars';

export const GARRISON = {
  // by the holder's grip (warEffects.js's tier): how far the rings reach, the
  // fighters a wave and in reserve, seconds between a post's volleys, a bolt's
  // damage, and the share of waves led by an ace
  tiers: {
    thin: { scale: 0.8, wave: 2, reserve: 4, volley: [2.4, 3.4], damage: 10, ace: 0 },
    held: { scale: 1, wave: 3, reserve: 8, volley: [1.6, 2.4], damage: 12, ace: 0 },
    fortress: { scale: 1.25, wave: 4, reserve: 14, volley: [1.0, 1.6], damage: 14, ace: 1 / 3 },
  },
  ring: { base: 24, perSize: 1.2, scramble: 40, warn: 60, leash: 40 }, // fire = (base + perSize·size)·scale; the rest added on, ·scale
  challenge: 1.5, // seconds from an enemy's challenge to the scramble
  countdown: 8, // seconds an unsworn pilot has to turn back
  countdownFortress: 5,
  grace: 8, // seconds after you jump in, go down or come back that nothing hails, scrambles or fires
  waveGap: 6, // seconds at least between waves
  maxWaves: 2, // waves' worth of its fighters out at once, at most
  refill: 40, // seconds for the reserve to get one fighter back
  leashFor: 6, // seconds out past every leash ring (or lost) before it stands down
  alarmFall: 120, // seconds for a full alarm to fall to nothing
  grudge: 90, // seconds a shot (or lingering) turns a wary mind hostile
  alarmBy: { scramble: 0.2, hit: 0.25, down: 0.4, hull: 0.2 }, // what each wave and each thing you did adds to the alarm
  alarmSkip: 0.3, // an alarm this high skips the challenge
  bolt: { speed: 40, r: 0.8 }, // life = the fire ring ÷ speed × 1.3
  // the miss, as a share of the range: far untracked, near after `settle`
  // seconds of a steady line; turning faster than `jink` a second drops the
  // tracking to `keep`
  aim: { far: 0.09, near: 0.012, settle: 3, jink: (25 * Math.PI) / 180, keep: 1 / 3 },
  bolts: 12, // a mind's bolts in the air, at most
  smallBolts: 6, // (on a phone)
  cover: { damage: 2, aim: 0.03 }, // a friend's bolt at what chases you: two of a laser's hits, and a steadier aim
  escort: { chasers: 2, every: 60 }, // this many on your tail in a scramble ring sends a flight out, once a minute
  senses: { sight: { range: 400, cone: -1, far: 1.5 }, hearing: { range: 300 }, memory: 12, intuition: 3 },
  sure: 0.5, // a belief this confident, or visible, is sure of you
};

// the hunters' faction each side's garrison launches (galaxy/hunted.js)
export const SIDE_FACTION = { empire: 'navy', remnant: 'remnant', rebel: 'rebelnavy', newrepublic: 'newrepublic', republic: 'republicnavy', separatists: 'separatists', hutt: 'weequay' };

const SENSES = createSenses(GARRISON.senses);
const CARRIERS = new Set(FLIGHTS.carriers);
// a ship HULLS doesn't know: three spheres down its length, as world.js gives it
const LONG = [
  [-0.3, 0.08],
  [0, 0.08],
  [0.3, 0.08],
];
const STILL = { x: 0, y: 0, z: 0 };

const tierOf = (tier) => GARRISON.tiers[tier] ?? GARRISON.tiers.held;
const between = (rand, range) => range[0] + rand() * (range[1] - range[0]);
const apart = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z)); // (not Math.hypot: it makes garbage)

export function ringsOf(size, tier, out = {}) {
  const { scale } = tierOf(tier);
  const r = GARRISON.ring;
  out.fire = (r.base + r.perSize * size) * scale;
  out.scramble = out.fire + r.scramble * scale;
  out.warn = out.scramble + r.warn * scale;
  out.leash = out.warn + r.leash * scale;
  return out;
}

// a point in a ship's own frame (shares of its length: x right, y up, z to
// the nose) carried into the system's, the ship at `at` turned by a yaw
// whose cosine and sine are `cs` and `sn` (world.js's holders: the nose +z)
function put(o, at, size, cs, sn, x, y, z) {
  o.x = at.x + (x * cs + z * sn) * size;
  o.y = at.y + y * size;
  o.z = at.z + (z * cs - x * sn) * size;
  return o;
}

// A parked capital ship as a post: its batteries (universe/wars.js's
// TURRETS), its hull's spheres (HULLS, as world.js's solids have them) and
// its hangar, under the middle of the hull and clear of it, as the war
// battle's carriers have it (battleFlights.js's hangarOf). `out` is
// refreshed in place, so the world keeps its posts rather than making them
// each frame.
export function postOf({ id, kind, side, size, at, yaw }, out = {}) {
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  out.id = id;
  out.kind = kind;
  out.side = side;
  out.size = size;
  out.yaw = yaw;
  out.at ??= {};
  out.at.x = at.x;
  out.at.y = at.y;
  out.at.z = at.z;
  out.carrier = CARRIERS.has(kind);
  const turrets = TURRETS[kind] ?? [];
  out.batteries ??= [];
  out.batteries.length = turrets.length;
  for (let i = 0; i < turrets.length; i++) {
    const t = turrets[i];
    put((out.batteries[i] ??= {}), at, size, cs, sn, t[0], t[1], t[2]);
  }
  const hull = HULLS[kind] ?? (size > 3 ? LONG : []);
  out.spheres ??= [];
  out.spheres.length = hull.length;
  let middle = 0;
  let nearest = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const [z, r] = hull[i];
    const s = (out.spheres[i] ??= { c: {}, r: 0 });
    put(s.c, at, size, cs, sn, 0, 0, z);
    s.r = r * size;
    if (Math.abs(z) < nearest) (nearest = Math.abs(z)), (middle = s.r);
  }
  out.hangar ??= {};
  out.hangar.x = at.x;
  out.hangar.y = at.y - (middle + 4);
  out.hangar.z = at.z;
  return out;
}

export function createGarrison({ rand = Math.random, small = false } = {}) {
  const cap = small ? GARRISON.smallBolts : GARRISON.bolts;
  const events = [];
  const pending = []; // what provoke() set off between steps, said at the next
  const bolts = []; // { x, y, z, vx, vy, vz, life, damage, friendly, id }
  // each post's: { me (its perception), rings, cool (seconds to its next
  // volley), bel, d (how far it believes you are), sure, frame }, by its id
  const minds = new Map();
  let state = 'calm';
  let stance = null; // the last step's
  let alarm = 0;
  let grudge = 0;
  let grace = 0;
  let reserve = null; // fighters left to launch (null: the tier's, at the next step)
  let refillAt = 0; // seconds toward the reserve's next fighter
  let hailed = 0; // seconds since the challenge
  let countdown = 0;
  let out = 0; // seconds out past the leash
  let track = 0; // how well the gunners have your line, 0…1
  let wave = 0; // waves this fight
  let lastSize = 0; // the last wave's fighters (0: no wave yet)
  let sinceWave = Infinity;
  let sinceEscort = Infinity;
  let opened = false; // the first volley of the fight said so
  let covered = false; // the first covering volley of the visit said so
  let called = false;
  let heard = false; // a shot of yours landed since the last step
  let here = false; // you were about at the last step
  let lead = null; // the post nearest you, by what it believes
  let frame = 0;

  // what perception is handed: you, or nobody; and your shot, heard where
  // you fired it from (a stim, as the surface's hostiles hear you), out to
  // the posts' hearing
  const youT = { id: 'you', at: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, hostile: true };
  const shot = { type: 'shot', at: { x: 0, y: 0, z: 0 }, radius: GARRISON.senses.hearing.range, from: 'you', loudness: 1 };
  const shots = [shot];
  const hush = [];
  const seeing = { targets: [youT], stims: hush };
  const blind = { targets: [] };
  const how = { seesThrough: null };
  // where you were at the last step (and so this step's start), and your velocity then
  const last = { x: 0, y: 0, z: 0 };
  const was = { x: 0, y: 0, z: 0 };
  const lastV = { x: 0, y: 0, z: 0 };
  let known = false;
  const end = { x: 0, y: 0, z: 0 }; // a bolt's end this step
  const aim = { x: 0, y: 0, z: 0 }; // where a volley's sent
  const tail = { x: 0, y: 0, z: 0 }; // a chaser's place at the step's start
  const info = { state, alarm, grudge, reserve, countdown, out, track, bolts: 0 };

  const say = (sub, post, into = events, secs = null) => into.push(secs == null ? { type: 'say', sub, post } : { type: 'say', sub, post, secs });
  const anyIn = (ring) => {
    for (const k of minds.values()) if (k.d <= k.rings[ring]) return true;
    return false;
  };
  const fight = (sub, post, into = events) => {
    state = 'fight';
    out = 0;
    wave = 0;
    lastSize = 0;
    opened = false;
    say(sub, post, into);
  };
  const calm = () => {
    state = 'calm';
    out = 0;
    hailed = 0;
    countdown = 0;
  };
  const standDown = () => {
    events.push({ type: 'recall' });
    say('standdown', lead);
    calm();
  };

  // you: where you were, and how steadily you fly (the gunners settle on a
  // line held, and lose it to a hard turn)
  function watch(you, dt) {
    if (!you) {
      known = false;
      return;
    }
    const vx = you.vx ?? 0;
    const vy = you.vy ?? 0;
    const vz = you.vz ?? 0;
    if (!known) {
      last.x = you.x;
      last.y = you.y;
      last.z = you.z;
      lastV.x = vx;
      lastV.y = vy;
      lastV.z = vz;
    }
    was.x = last.x;
    was.y = last.y;
    was.z = last.z;
    last.x = you.x;
    last.y = you.y;
    last.z = you.z;
    const l0 = Math.sqrt(lastV.x * lastV.x + lastV.y * lastV.y + lastV.z * lastV.z);
    const l1 = Math.sqrt(vx * vx + vy * vy + vz * vz);
    let turn = 0;
    if (l0 > 1e-3 && l1 > 1e-3 && dt > 0) turn = Math.acos(Math.min(1, Math.max(-1, (lastV.x * vx + lastV.y * vy + lastV.z * vz) / (l0 * l1)))) / dt;
    track = turn < GARRISON.aim.jink ? Math.min(1, track + dt / GARRISON.aim.settle) : Math.min(track, GARRISON.aim.keep);
    lastV.x = vx;
    lastV.y = vy;
    lastV.z = vz;
    known = true;
  }

  // every post looks for you (and listens, when a shot of yours has
  // landed); a post gone takes its mind with it
  function perceive(posts, you, w, tier, dt, loud) {
    how.seesThrough = w.seesThrough ?? null;
    if (you) {
      youT.at.x = you.x;
      youT.at.y = you.y;
      youT.at.z = you.z;
      youT.vel.x = you.vx ?? 0;
      youT.vel.y = you.vy ?? 0;
      youT.vel.z = you.vz ?? 0;
      shot.at.x = you.x;
      shot.at.y = you.y;
      shot.at.z = you.z;
      seeing.stims = loud ? shots : hush;
    }
    lead = posts[0] ?? null;
    let near = Infinity;
    for (const p of posts) {
      let k = minds.get(p.id);
      if (!k) {
        k = { me: { pos: { x: 0, y: 0, z: 0 }, dir: null, beliefs: {}, now: 0 }, rings: {}, cool: between(rand, tier.volley), bel: null, d: Infinity, sure: false, frame: 0 };
        minds.set(p.id, k);
      }
      k.frame = frame;
      k.me.pos.x = p.at.x;
      k.me.pos.y = p.at.y;
      k.me.pos.z = p.at.z;
      ringsOf(p.size, w.tier, k.rings);
      sense(SENSES, k.me, you ? seeing : blind, dt, how);
      const b = belief(k.me, 'you');
      k.bel = b;
      k.d = b ? apart(b.at, p.at) : Infinity;
      k.sure = Boolean(b) && (b.visible || b.confidence >= GARRISON.sure);
      if (k.d < near) (near = k.d), (lead = p);
    }
    for (const [id, k] of minds) if (k.frame !== frame) minds.delete(id);
  }

  // the bolts fly on: one that meets you (or, a friend's, the chaser it was
  // fired at) over the frame lands; the planet stops one; the rest run out
  function fly(dt, w, you) {
    const planet = w.planet ?? null;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      const s = Math.min(dt, b.life);
      b.life -= dt;
      end.x = b.x + b.vx * s;
      end.y = b.y + b.vy * s;
      end.z = b.z + b.vz * s;
      let k = null;
      if (b.friendly) {
        let c = null;
        for (const o of w.chasers ?? []) if (o.id === b.id) c = o;
        if (c) {
          const v = c.vel ?? STILL;
          tail.x = c.at.x - v.x * dt;
          tail.y = c.at.y - v.y * dt;
          tail.z = c.at.z - v.z * dt;
          k = sweptHit(b, end, tail, c.at, (c.size ?? 0) + 0.3);
        }
      } else if (you) k = sweptHit(b, end, was, you, GARRISON.bolt.r);
      const stop = planet ? sweptHit(b, end, planet.c, planet.c, planet.r) : null;
      if (k !== null && (stop === null || k <= stop)) events.push(b.friendly ? { type: 'cover', id: b.id, damage: b.damage } : { type: 'hit', damage: b.damage });
      if (k !== null || stop !== null || b.life <= 0) {
        bolts[i] = bolts[bolts.length - 1];
        bolts.pop();
        continue;
      }
      b.x = end.x;
      b.y = end.y;
      b.z = end.z;
    }
  }

  // A volley from post `p` at `at` (moving at `vel`), from its battery
  // nearest it with a clear line (the planet's, for a gun on you), led by the
  // bolt's time of flight and missing by up to `spread` of the range. True
  // when it's done with (fired, or skipped for a full pool); false when it
  // holds (no clear line, or one of its own fighters in the way).
  function volley(p, k, at, vel, spread, w, tier, friendly, id = null) {
    if (bolts.length >= cap) return true;
    const see = friendly ? null : (w.seesThrough ?? null);
    let from = null;
    let best = Infinity;
    for (const b of p.batteries) {
      const d = apart(b, at);
      if (d < best && (!see || see(b, at))) (best = d), (from = b);
    }
    if (!from) return false;
    const speed = GARRISON.bolt.speed;
    let t = best / speed;
    for (let n = 0; n < 2; n++) {
      aim.x = at.x + vel.x * t;
      aim.y = at.y + vel.y * t;
      aim.z = at.z + vel.z * t;
      t = apart(from, aim) / speed;
    }
    // the miss: any way, up to its share of the range
    const miss = best * spread * rand();
    const up = rand() * 2 - 1;
    const round = rand() * 2 * Math.PI;
    const flat = Math.sqrt(1 - up * up);
    aim.x += miss * flat * Math.cos(round);
    aim.y += miss * up;
    aim.z += miss * flat * Math.sin(round);
    if (!friendly) for (const f of w.fighters ?? []) if (sweptHit(from, aim, f.at, f.at, (f.size ?? 0) + 0.5) !== null) return false;
    const l = apart(from, aim) || 1;
    const life = (k.rings.fire / speed) * 1.3;
    const ux = (aim.x - from.x) / l;
    const uy = (aim.y - from.y) / l;
    const uz = (aim.z - from.z) / l;
    bolts.push({ x: from.x, y: from.y, z: from.z, vx: ux * speed, vy: uy * speed, vz: uz * speed, life, damage: friendly ? GARRISON.cover.damage : tier.damage, friendly, id });
    const reach = speed * life;
    events.push({ type: 'volley', post: p, from: { x: from.x, y: from.y, z: from.z }, to: { x: from.x + ux * reach, y: from.y + uy * reach, z: from.z + uz * reach }, friendly });
    if (friendly && !covered) (covered = true), say('cover', p);
    if (!friendly && !opened) (opened = true), say('open', p);
    return true;
  }

  // a wave: from the carrier nearest you, else the nearest post
  function launch(posts, tier) {
    let from = null;
    for (const p of posts) if (!from || (p.carrier && !from.carrier) || (p.carrier === from.carrier && minds.get(p.id).d < minds.get(from.id).d)) from = p;
    const size = Math.min(tier.wave, reserve);
    reserve -= size;
    lastSize = size;
    sinceWave = 0;
    wave += 1;
    alarm = Math.min(1, alarm + GARRISON.alarmBy.scramble);
    events.push({ type: 'scramble', post: from, from: { x: from.hangar.x, y: from.hangar.y, z: from.hangar.z }, size, ace: rand() < tier.ace, wave });
  }

  // fighting: the leash, the waves, the guns
  function engage(dt, w, tier, posts, you) {
    if (!you || !anyIn('leash')) out += dt;
    else out = 0;
    if (out >= GARRISON.leashFor) {
      standDown();
      return;
    }
    if (grace > 0 || !you) return;
    const fighters = w.fighters ?? [];
    if (anyIn('scramble') && reserve >= 1 && fighters.length < GARRISON.maxWaves * tier.wave && (lastSize === 0 || fighters.length <= Math.floor(lastSize / 2)) && sinceWave >= GARRISON.waveGap) launch(posts, tier);
    const spread = GARRISON.aim.far + (GARRISON.aim.near - GARRISON.aim.far) * track;
    for (const p of posts) {
      const k = minds.get(p.id);
      if (!k.bel?.visible || k.d > k.rings.fire) continue;
      k.cool -= dt;
      if (k.cool <= 0 && volley(p, k, k.bel.at, k.bel.vel, spread, w, tier, false)) k.cool = between(rand, tier.volley);
    }
  }

  // flying for its side: the guns on what chases you, and a flight to meet you
  function befriend(dt, w, tier, posts) {
    const chasers = w.chasers ?? [];
    const see = w.seesThrough ?? null;
    for (const p of posts) {
      const k = minds.get(p.id);
      let c = null;
      let best = k.rings.fire;
      for (const o of chasers) {
        const d = apart(o.at, p.at);
        if (d <= best && (!see || see(p.at, o.at))) (best = d), (c = o);
      }
      if (!c) continue;
      k.cool -= dt;
      if (k.cool <= 0 && volley(p, k, c.at, c.vel ?? STILL, GARRISON.cover.aim, w, tier, true, c.id)) k.cool = between(rand, tier.volley);
    }
    if (sinceEscort < GARRISON.escort.every) return;
    for (const p of posts) {
      const ring = minds.get(p.id).rings.scramble;
      let n = 0;
      for (const o of chasers) if (apart(o.at, p.at) <= ring) n += 1;
      if (n < GARRISON.escort.chasers) continue;
      events.push({ type: 'escort', post: p });
      say('escort', p);
      sinceEscort = 0;
      return;
    }
  }

  // hailing: an enemy is scrambled at, after the challenge, once you're
  // inside the scramble ring; an unsworn pilot has the countdown, and is
  // thanked for leaving. You gone (the tunnel, a crash, a landing), it lets
  // the hail go without a word: what it still believes of you is no reason
  function hail(dt, hostile, you) {
    if (!you) {
      calm();
      return;
    }
    if (!anyIn('warn')) {
      calm();
      if (!hostile) say('clear', lead);
      return;
    }
    if (hostile) {
      hailed += dt;
      if (hailed >= GARRISON.challenge && anyIn('scramble')) fight('scramble', lead);
      return;
    }
    countdown = Math.max(0, countdown - dt);
    if (countdown <= 0 && anyIn('scramble')) {
      grudge = GARRISON.grudge;
      fight('scramble', lead);
    }
  }

  function step(dt, w) {
    events.length = 0;
    for (const e of pending) events.push(e);
    pending.length = 0;
    const help = called; // (a call is acted on at this step or not at all)
    called = false;
    const loud = heard; // (and a shot heard at this step, or not at all)
    heard = false;
    frame += 1;
    const tier = tierOf(w.tier);
    const posts = w.posts ?? [];
    const you = w.you ?? null;
    here = Boolean(you);
    stance = w.stance ?? null;

    // the clocks
    alarm = Math.max(0, alarm - dt / GARRISON.alarmFall);
    grudge = Math.max(0, grudge - dt);
    grace = Math.max(0, grace - dt);
    sinceWave += dt;
    sinceEscort += dt;
    reserve ??= tier.reserve;
    if (reserve < tier.reserve) {
      refillAt += dt;
      if (refillAt >= GARRISON.refill) (reserve += 1), (refillAt -= GARRISON.refill);
    } else refillAt = 0;
    watch(you, dt);

    // the war's battle is on here: its own capitals fight, and this mind stands down without a word
    if (w.battle) {
      if (state !== 'calm') events.push({ type: 'recall' });
      calm();
      bolts.length = 0;
      return events;
    }
    perceive(posts, you, w, tier, dt, loud);
    fly(dt, w, you);
    if (!posts.length || !stance) {
      if (state !== 'calm') standDown();
      return events;
    }
    if (stance === 'friend') {
      if (state !== 'calm') standDown();
      if (grace <= 0) befriend(dt, w, tier, posts);
      return events;
    }

    // a pack of theirs called for help: out they come, if you're anywhere near
    if (help) {
      if (you && posts.some((p) => apart(you, p.at) <= minds.get(p.id).rings.warn)) {
        grudge = GARRISON.grudge;
        if (state !== 'fight') fight('reinforce', lead);
      }
    }
    const hostile = stance === 'enemy' || grudge > 0;
    if (state === 'calm' && grace <= 0 && you) {
      let seen = null;
      for (const p of posts) {
        const k = minds.get(p.id);
        if (k.sure && k.d <= k.rings.warn && (!seen || k.d < minds.get(seen.id).d)) seen = p;
      }
      if (seen && hostile && alarm >= GARRISON.alarmSkip) fight('scramble', seen);
      else if (seen) {
        state = 'hail';
        hailed = 0;
        countdown = w.tier === 'fortress' ? GARRISON.countdownFortress : GARRISON.countdown;
        if (hostile) say('challenge', seen);
        else say('warn', seen, events, countdown);
      }
    }
    if (state === 'hail') hail(dt, hostile, you);
    if (state === 'fight') engage(dt, w, tier, posts, you);
    return events;
  }

  return {
    step,
    // a shot of yours landed on one of theirs (a fighter hit or downed, or a
    // hull): remembered, and heard at the next step; but it says nothing of
    // it while you're gone
    provoke(how) {
      alarm = Math.min(1, alarm + (GARRISON.alarmBy[how] ?? 0));
      grudge = GARRISON.grudge;
      if (!here) return;
      heard = true;
      if (state !== 'fight' && (stance === 'enemy' || stance === 'wary')) fight('scramble', lead, pending);
    },
    // one of their packs out here asks for help (acted on at the next step)
    call() {
      called = true;
    },
    // you jumped in or out, went down, or came back: calm, and a grace;
    // a new visit forgets you
    reset(why) {
      calm();
      bolts.length = 0;
      pending.length = 0;
      called = false;
      heard = false;
      known = false;
      track = 0;
      grace = GARRISON.grace;
      if (why === 'enter' || why === 'jump') {
        alarm = 0;
        grudge = 0;
        reserve = null;
        refillAt = 0;
        covered = false;
        sinceEscort = Infinity;
        minds.clear();
      }
    },
    get state() {
      return state;
    },
    get busy() {
      return state !== 'calm';
    },
    get info() {
      info.state = state;
      info.alarm = alarm;
      info.grudge = grudge;
      info.reserve = reserve;
      info.countdown = countdown;
      info.out = out;
      info.track = track;
      info.bolts = bolts.length;
      return info;
    },
    get bolts() {
      return bolts;
    },
  };
}
