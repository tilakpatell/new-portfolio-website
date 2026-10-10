// How the garrison fights: what a soldier chooses to do from moment to
// moment, where he goes to do it, and how a squad shares the shooting and
// the search. The choice is a weighing on src/lib/ai/utility among six
// tactics: hold and fire, take cover (spatial.cover over places in his room
// and the rooms next door), flank (by another door into the target’s room,
// when the paths have one), advance, fall back, and search (src/lib/ai/search
// over the section’s spots, once the target has been out of sight a while).
// At most three hold a shot token against one target at a time
// (squad.createTokens), so a fourth takes cover or flanks instead of
// joining a firing line nobody could survive. Pure.
//
//   TACTICS                                   the six, by name
//   FIGHT                                     the numbers the choice is made with
//   createFights({ rand, layout, nav }) → fights   { rand, layout, nav, tokens, searches }
//   chooseTactic(ctx, { current, rand }) → tactic
//     ctx: { sees, lostFor: s, dist: m, range: m, hp: 0…1, token, cover, inCover, flank, allies, told, free }
//       cover: a place out of sight is known; flank: another way in is known; allies: friends in the fight;
//       told: a friend sees the target now; free: a shot token against it is to be had
//   coverFrom(layout, me, threat, { seesThrough, allies, current, canPass }) → { x, y, z, room } | null
//     me: { x, y, z, room }; threat: a point at chest height; null when nowhere near is out of its sight
//   fallbackFrom(layout, me, threat, { seesThrough, canPass }) → { x, y, z, room } | null
//   flankRoute(nav, me, threat, { canPass, solidsOf, state }) → route | null   into the threat’s room by
//     another door than the straight way’s, and not too long a way round; null in the same room.
//     Both ways are routines.js’s remembered ones: a soldier looks again every second or two, mostly
//     from where he stood at a target that hasn’t moved, and a way across a bay costs tens of milliseconds;
//     state: the one they are remembered under (brains.js’s: the floors drawn back)
//   standOff(layout, from, threat, metres) → { x, y, z, room } | null   on the line from the threat
//     towards `from`, `metres` off, kept inside the room; null when the threat is in another room
//   sectionSpots(layout, section) → [{ x, y, z, room }]   the station’s spots in the section, then
//     the middle of each of its rooms (lift cars and the open field left out)
//   searchOf(fights, section) → search        src/lib/ai/search’s, one a section, made on first use
//   fightStep(fights, me, threat, bb, state, { unseen, lostFor, told }) → tactic   one step of a soldier’s fight
//     threat: his surest belief; bb: the body brains.js answers with (go, face, lock, pose, aimAt,
//     fire, gunBusy, seesThrough, canPass, solidsOf, allies, clock, ways); state: his own, kept between steps;
//     unseen: seconds since he saw it; lostFor: since anyone in the fight did; told: a friend sees it now
//   searchStep(fights, me, bb, state) → void   one step of a searcher’s sweep: claim, walk, look about

import { consider, pick } from '../../../../lib/ai/utility';
import { apart, awayFrom, cover, nearTo, pickPlace } from '../../../../lib/ai/spatial';
import { createSearch } from '../../../../lib/ai/search';
import { createTokens } from '../../../../lib/ai/squad';
import { WEAPONS } from './combat';
import { wayBetween } from './routines';

export const TACTICS = Object.freeze(['hold', 'cover', 'flank', 'advance', 'fallback', 'search']);

export const FIGHT = Object.freeze({
  ideal: 10, // metres a rifleman likes between himself and his target
  lose: 2.5, // seconds out of sight before a target is lost (the senses’ intuition holds it that long)
  shots: 3, // shot tokens against one target
  chest: 1.2, // where a body is aimed at and hidden by, above its feet
});

const MARGIN = 0.8; // how far from a wall a place to stand is kept
const PLACES = 40; // about how many places a room offers, however big
const STEP = 0.4; // the walker’s step: a place on a floor further off the room’s own is a stair or a ledge
const NO_PLACE = new Set(['lift', 'field']);
const AROUND = 2.5; // a way round may be this many times the straight way…
const AROUND_PLUS = 15; // …and this many metres more

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const up = (p) => ({ x: p.x, y: p.y + FIGHT.chest, z: p.z });

export function createFights({ rand, layout, nav }) {
  return { rand, layout, nav, tokens: createTokens({ pools: { shot: FIGHT.shots } }), searches: new Map() };
}

// ── the choice ──

const ideal = (c) => Math.min(FIGHT.ideal, c.range * 0.5);
const fit = (lo, hi) => (c) => consider(c.hp, [lo, hi]);

const OPTIONS = [
  { id: 'search', considerations: [(c) => (c.lostFor >= FIGHT.lose ? 1 : 0)] },
  { id: 'hold', considerations: [(c) => (c.sees ? 1 : 0), (c) => consider(c.dist, [c.range * 0.7, ideal(c) * 1.2]), (c) => (c.token ? 1 : 0.35), fit(0.25, 0.55)] },
  // the hurt and those with no shot to take want cover most
  { id: 'cover', weight: 0.9, considerations: [(c) => (c.cover ? 1 : 0), (c) => (c.inCover ? 0.25 : 1), (c) => (c.token ? 0.5 : 1), (c) => 0.6 + 0.4 * (1 - c.hp)] },
  // a flank wants friends to keep the target busy meanwhile
  { id: 'flank', weight: 0.8, considerations: [(c) => (c.flank ? 1 : 0), (c) => (c.token ? 0.3 : 1), (c) => (c.allies > 0 ? 1 : 0.4), fit(0.3, 0.6)] },
  // closer when too far to hit well, or to see again someone just gone round a corner; but one
  // waiting in cover for a shot while friends keep the target busy stays put until a shot is free
  { id: 'advance', weight: 0.85, considerations: [(c) => (c.sees ? consider(c.dist, [ideal(c), ideal(c) * 2.5]) : c.lostFor < FIGHT.lose && (!c.told || c.free) ? 1 : 0), fit(0.3, 0.6)] },
  { id: 'fallback', considerations: [fit(0.45, 0.2)] },
];

// a lost target is searched for, whatever else scores
const rank = (o) => (o.id === 'search' ? 1 : 0);

export function chooseTactic(ctx, { current = null, rand = null } = {}) {
  return pick(OPTIONS, ctx, { current, momentum: 0.15, rank, rand, spread: rand ? 0.08 : 0 })?.id ?? 'hold';
}

// ── places ──

const placeCache = new WeakMap();

// The places to stand in a room, on a grid kept off its walls: on its own
// floor (not up a stair or out on a ledge) and not inside a room nested in it.
function placesIn(layout, id) {
  let byRoom = placeCache.get(layout);
  if (!byRoom) placeCache.set(layout, (byRoom = new Map()));
  if (byRoom.has(id)) return byRoom.get(id);
  const r = layout.rooms.get(id);
  const out = [];
  const w = r ? r.box.x1 - r.box.x0 - 2 * MARGIN : 0;
  const d = r ? r.box.z1 - r.box.z0 - 2 * MARGIN : 0;
  if (r && !NO_PLACE.has(r.kind) && w > 0 && d > 0) {
    const step = Math.max(1.5, Math.sqrt((w * d) / PLACES));
    const [nx, nz] = [Math.floor(w / step) + 1, Math.floor(d / step) + 1];
    const [ox, oz] = [r.box.x0 + MARGIN + (w - (nx - 1) * step) / 2, r.box.z0 + MARGIN + (d - (nz - 1) * step) / 2];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const [x, z] = [ox + i * step, oz + j * step];
        if (r.round && Math.hypot(x - r.x, z - r.z) > r.w / 2 - MARGIN) continue;
        const y = layout.floorAt(id, x, z);
        if (y === null || Math.abs(y - r.y) > STEP || layout.roomAt(x, y + 0.1, z) !== id) continue;
        out.push({ x, y, z, room: id });
      }
    }
  }
  byRoom.set(id, out);
  return out;
}

// The places in a room and in the rooms its doors lead to (those it may pass).
function placesAround(layout, id, canPass) {
  const rooms = [id];
  for (const doorId of layout.rooms.get(id)?.doors ?? []) {
    const door = layout.doors.get(doorId);
    const other = door?.a === id ? door.b : door?.a;
    if (other && !rooms.includes(other) && canPass(doorId, door)) rooms.push(other);
  }
  return rooms.flatMap((r) => placesIn(layout, r));
}

export function coverFrom(layout, me, threat, { seesThrough, allies = [], current = null, canPass = () => true } = {}) {
  const points = placesAround(layout, me.room, canPass);
  const sight = (t, p) => seesThrough(t, up(p));
  const tests = [cover([threat], sight, 3), nearTo(me, 16, 1), awayFrom(threat, 8, 0.5), apart(allies, 1.5, 1)];
  const best = pickPlace(points, tests, { current });
  return best && !sight(threat, best.at) ? best.at : null;
}

export function fallbackFrom(layout, me, threat, { seesThrough, canPass = () => true } = {}) {
  const points = placesAround(layout, me.room, canPass);
  const tests = [awayFrom(threat, 20, 2), cover([threat], (t, p) => seesThrough(t, up(p)), 1), nearTo(me, 20, 0.5)];
  return pickPlace(points, tests)?.at ?? null;
}

const lengthOf = (path) => path.reduce((n, p, i) => (i ? n + flat(path[i - 1], p) : 0), 0);

export function flankRoute(nav, me, threat, { canPass = () => true, solidsOf, state } = {}) {
  if (!threat.room || me.room === threat.room) return null;
  const direct = wayBetween(nav, me, threat, { canPass, solidsOf, state });
  // the door the straight way comes in by: the last one on it
  const entry = direct?.findLast((p) => p.door)?.door;
  if (!entry) return null;
  const other = wayBetween(nav, me, threat, { canPass: (id, door) => id !== entry && canPass(id, door), solidsOf, state });
  if (!other || lengthOf(other) > lengthOf(direct) * AROUND + AROUND_PLUS) return null;
  return other;
}

export function standOff(layout, from, threat, metres) {
  const room = layout.rooms.get(from.room);
  if (!room || layout.roomAt(threat.x, threat.y, threat.z) !== room.id) return null;
  let [dx, dz] = [from.x - threat.x, from.z - threat.z];
  const l = Math.hypot(dx, dz);
  [dx, dz] = l > 1e-6 ? [dx / l, dz / l] : [1, 0];
  let [x, z] = [threat.x + dx * metres, threat.z + dz * metres];
  if (room.round) {
    const r = room.w / 2 - MARGIN;
    const k = Math.hypot(x - room.x, z - room.z);
    if (k > r) [x, z] = [room.x + ((x - room.x) * r) / k, room.z + ((z - room.z) * r) / k];
  } else {
    x = Math.min(room.box.x1 - MARGIN, Math.max(room.box.x0 + MARGIN, x));
    z = Math.min(room.box.z1 - MARGIN, Math.max(room.box.z0 + MARGIN, z));
  }
  return { x, y: layout.floorAt(room.id, x, z) ?? room.y, z, room: room.id };
}

// ── the search ──

const spotCache = new WeakMap();

export function sectionSpots(layout, section) {
  let bySection = spotCache.get(layout);
  if (!bySection) spotCache.set(layout, (bySection = new Map()));
  if (bySection.has(section)) return bySection.get(section);
  const out = [];
  const take = (r, x, z) => {
    if (!r || r.section !== section || NO_PLACE.has(r.kind)) return;
    const y = layout.floorAt(r.id, x, z);
    if (y !== null) out.push({ x, y, z, room: r.id });
  };
  for (const s of Object.values(layout.station.spots ?? {})) take(layout.rooms.get(s.room), s.x, s.z);
  for (const r of layout.rooms.values()) take(r, r.x, r.z);
  bySection.set(section, out);
  return out;
}

// A search left to itself gives up after this long; one the alarm runs
// lasts as long as the hunt does.
const SEARCH_TIME = 45;

export function searchOf(fights, section) {
  let s = fights.searches.get(section);
  if (!s) {
    s = createSearch({ rand: fights.rand, spots: () => sectionSpots(fights.layout, section), time: SEARCH_TIME, stagger: 1.5 });
    fights.searches.set(section, s);
  }
  return s;
}

// ── a soldier’s step ──

// Where a tactic takes him, worked out when it is chosen (and again as the
// target moves), never every step: each new place is a new way to walk.
function placeFor(fights, me, at, tactic, f, bb) {
  const { layout } = fights;
  if (tactic === 'cover') return f.cover;
  if (tactic === 'flank') return f.flank ? { path: f.flank } : null;
  if (tactic === 'fallback') return fallbackFrom(layout, me, at, { seesThrough: bb.seesThrough, canPass: bb.canPass });
  if (tactic !== 'advance') return null;
  const near = standOff(layout, me, at, Math.min(FIGHT.ideal, (WEAPONS[me.gun]?.range ?? 0) * 0.5) * 0.8);
  if (near && f.sees) return near;
  const room = layout.roomAt(at.x, at.y, at.z);
  return room ? { x: at.x, z: at.z, room } : null;
}

// What he knows of the ground: cover from the target and a way round to it,
// looked at again every second or two, or when the target moves off.
function survey(fights, me, at, f, bb) {
  if (bb.clock < f.knownUntil && f.knownAt && flat(f.knownAt, at) <= 3) return;
  const room = fights.layout.roomAt(at.x, at.y, at.z);
  f.knownAt = { ...at };
  f.knownUntil = bb.clock + 1.5 + 0.5 * fights.rand();
  f.cover = coverFrom(fights.layout, me, at, { seesThrough: bb.seesThrough, allies: bb.allies(), current: f.tactic === 'cover' ? f.place : null, canPass: bb.canPass });
  f.flank = room && room !== me.room ? flankRoute(fights.nav, me, { x: at.x, z: at.z, room }, { canPass: bb.canPass, solidsOf: bb.solidsOf, state: bb.ways }) : null;
}

export function fightStep(fights, me, threat, bb, f, { unseen, lostFor, told = false }) {
  const { tokens, rand } = fights;
  const clock = bb.clock;
  const at = threat.at;
  const sees = threat.visible;
  const dist = flat(me, at);
  // a token is claimed while the target is in sight and given back once it has been out of it a second
  let token = false;
  if (me.gun && sees) token = tokens.claim('shot', me.id, { priority: 1 / (1 + dist), target: threat.id });
  else if (unseen > 1) tokens.release('shot', me.id, threat.id);
  else token = tokens.held('shot', me.id, threat.id);
  f.sees = sees;
  if (clock >= f.think) {
    survey(fights, me, at, f, bb);
    const inCover = f.tactic === 'cover' && Boolean(f.covered) && flat(me, f.covered) < 0.6;
    const free = tokens.count('shot', threat.id) < FIGHT.shots;
    const ctx = {
      sees,
      lostFor,
      dist,
      range: WEAPONS[me.gun]?.range ?? 0,
      hp: me.hp / (me.max || 100),
      token,
      cover: Boolean(f.cover),
      inCover,
      flank: Boolean(f.flank),
      allies: bb.allies().length,
      told,
      free,
    };
    const tactic = chooseTactic(ctx, { current: f.tactic, rand });
    // an advance follows the target once it has moved off (each new place is a new way to work out);
    // the rest keep the place they were given until they get there
    const drifted = tactic === 'advance' && (!f.place || !f.placedFor || flat(f.placedFor, at) > 2);
    if (tactic !== f.tactic || drifted) {
      f.place = placeFor(fights, me, at, tactic, f, bb);
      f.placedFor = { ...at };
      f.covered = null;
    }
    f.tactic = tactic;
    f.think = clock + 0.4 + 0.4 * rand();
  }
  if (f.tactic === 'search') return 'search';
  if (f.place) {
    const status = bb.go(f.place, { run: true });
    if (status !== 'running') {
      // where he took cover, so he knows he is in it
      if (status === 'done' && f.tactic === 'cover') f.covered = f.place;
      f.place = null;
      // nowhere to go after all: think again soon
      if (status === 'failed') f.think = Math.min(f.think, clock + 0.3);
    }
  }
  // he faces the target while he holds or closes in; running for cover or round a flank he faces his way
  if (sees && (f.tactic === 'hold' || f.tactic === 'advance' || !f.place)) bb.lock(at);
  else if (sees) bb.face(at);
  bb.aimAt(sees || unseen < 1 ? at : null);
  bb.pose(me.gun ? 'aim' : 'idle');
  if (token && sees) trigger(fights, me, threat, bb, f, dist);
  return f.tactic;
}

// Bursts of two to four, a pause between, and never with the gun hot or the target off his line.
function trigger(fights, me, threat, bb, f, dist) {
  const w = WEAPONS[me.gun];
  if (!w || dist > w.range * 0.85 || bb.clock < f.next || bb.gunBusy()) return;
  const off = Math.atan2(threat.at.x - me.x, -(threat.at.z - me.z)) - me.yaw;
  if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > 0.25) return;
  bb.fire(threat);
  f.burst -= 1;
  if (f.burst > 0) f.next = bb.clock + w.gap * 1.5;
  else {
    f.burst = 2 + Math.floor(fights.rand() * 3);
    f.next = bb.clock + 0.6 + 0.9 * fights.rand();
  }
}

// ── a searcher’s step ──

function lookAbout(fights, st, me, clock) {
  Object.assign(st, { lookUntil: clock + 1 + 1.5 * fights.rand(), lookFrom: clock, lookYaw: me.yaw });
}

export function searchStep(fights, me, bb, st) {
  const s = searchOf(fights, st.section);
  const clock = bb.clock;
  if (!s.active) s.start({ at: { x: me.x, y: me.y, z: me.z } }, { aggressive: true });
  s.sweep(me.id, bb.eyes(), bb.seesThrough);
  bb.pose(me.gun ? 'aim' : 'idle');
  bb.aimAt(null);
  if (clock < st.lookUntil) {
    bb.face(st.lookYaw + 0.9 * Math.sin((clock - st.lookFrom) * 1.6));
    return;
  }
  st.claim ??= s.claim(me.id, { x: me.x, y: me.y, z: me.z });
  if (!st.claim) {
    // every spot looked at and the hunt still on: round again, from where they were last placed
    const left = s.state.spots.some((spot) => !spot.searched);
    if (s.state.phase === 2 && !left && clock >= st.restartAt) {
      s.start({ at: s.state.estimate }, { aggressive: true });
      st.restartAt = clock + 6;
    }
    lookAbout(fights, st, me, clock);
    return;
  }
  const at = st.claim.at;
  const room = fights.layout.roomAt(at.x, at.y + 0.1, at.z);
  // a spot nobody can walk to (behind a locked door) counts as looked at
  const status = room ? bb.go({ x: at.x, z: at.z, room }) : 'failed';
  if (status === 'running') return;
  s.arrive(me.id);
  st.claim = null;
  lookAbout(fights, st, me, clock);
}
