// The minds of everyone aboard: what each person believes, what they do
// about it, and how they walk there. Each person is a walker body (so the
// same walls, doors and floors hold them as hold you) with a mind on
// src/lib/ai: senses that see in a cone and through nothing solid (the
// walker’s lineClear) and hear shots, running steps and roars; a routine
// (routines.js) while nothing is wrong; and, for a soldier who is sure of
// an enemy, a fight (fight.js) that ends in a search of the section when
// the enemy gets away, and in the routine again once the alarm stands
// down. They walk nav.route’s waypoints and keep apart with steer.separate.
// A Rebel in armour is watched rather than shot, and the watching is handed
// to the game as a disguise check. Mouse droids run squealing from a roar.
// Vader, the Emperor and the Royal Guard stand where the story puts them
// and move only as it directs. Nothing here touches the game: what happens
// comes back as events for the game to act on (a shot to fire, a call to
// raise the alarm with). Pure apart from the crew and people it is given.
//
//   createCrew({ rand, layout, nav, solidsOf? }) → crew      { people, byId, fights, clock }
//     solidsOf(roomId) → the walker’s solids standing in a room (nav reads their footprints)
//   addPerson(crew, { id, kind, room, x, z, yaw, role, squad?, hostile?, script?, tag?, talk? }) → person
//     role: { type: 'patrol', spots: [name] } | { type: 'post', spot } | { type: 'work', spot } | { type: 'chat', with }
//       | { type: 'march', spots } | { type: 'droid' } | { type: 'follow', who } | { type: 'scripted' }
//       a post or work with no spot keeps the place the person was put; no role is the cast’s own
//       (scripted for Vader, the Emperor and the Royal Guard, droid for droids, else a post)
//     hostile: the story’s word on whether they fight you, whatever your disguise
//   stepCrew(crew, dt, { you, alarm, doors, combat, flags, now, open, stims? }) → events
//     you: your walker body & { id?, side, armour, helmet, doubt?, hp }; doors: doors.js’s state;
//     open(doorId) → bool, as the walker takes it; combat: its fresh bolts are heard as shots
//     stims: [{ type: 'steps', at, from } | { type: 'roar', at } | force.js’s { type: 'noise', at, heard }
//       and { type: 'trick', id, s, line }]
//   events:
//     { type: 'saw', id, target, at, room }        sure of an enemy, and fighting
//     { type: 'lost', id, target, at }             out of sight too long: searching
//     { type: 'challenge', id, watchers, officerAt }   someone watches a disguised you this step:
//       the game steps the doubt with these (no event: nobody is watching)
//     { type: 'shoot', from, dir, weapon, owner, side, npc: true, target }   for combat.fire
//     { type: 'call', id, section, how: 'seen' | 'shots' | 'body', at }      the radio: for alarm.raise
//     { type: 'say', id, kind, key, text }         a bark (BARKS), a script’s line, the trick’s line
//     { type: 'died', id, kind, tag, room, x, y, z }   the game took the last of their hp
//     { type: 'fled', id, kind, from: 'roar' | 'fight', sound? }   (a mouse droid squeals)
//     { type: 'arrive', id, spot, room }           walked to a named spot
//   direct(crew, id, script) → person              the story takes someone over (routines.js’s script)
//   assign(crew, id, role) → person                a new routine
//   removePerson(crew, id) → bool                  off the station, handing back what they held
//   BARKS                                          the garrison’s lines, by when they’re said
//
// person: a walker body & { id, kind, side, hp, max, mode, anim, aim, role, squad, hostile, tag, talk, gun, mind }
//   mode: 'routine' | 'wary' | 'fight' | 'search' | 'flee' | 'down' | 'dead' | 'scripted'
//   anim: 'idle' | 'walk' | 'run' | 'aim' | 'shoot' | 'hit' | 'die' | 'kneel' | 'talk' | 'work' | 'attention'
//   aim: the point it aims at, or null. The game hurts a person with combat.hurt (setting `hurtBy`,
//   the shooter’s id, when it knows it): a big hit knocks them down, a small one staggers them,
//   and none at all left kills them.

import { createSenses, forget, sense, target as surest } from '../../../../lib/ai/perception';
import { clear as clearSteer, createContext, interest, resolve, seek, separate } from '../../../../lib/ai/steer';
import { levelOf } from './alarm';
import { CAST, perceptionOf } from './cast';
import { COMBAT, gunOf, WEAPONS } from './combat';
import { CHALLENGE, disguised } from './disguise';
import { createFights, FIGHT, fallbackFrom, fightStep, searchOf, searchStep, standOff } from './fight';
import { route } from './nav';
import { resetRoutine, routineFor, runRoutine } from './routines';
import { BODY, createBody, lineClear, stepBody } from './walker';

export const BARKS = Object.freeze({
  seen: Object.freeze(['Contact. Over there.', 'Intruder on the deck.', 'There he is. Cut him off.']),
  lost: Object.freeze(['Lost sight of him. Spread out.', 'Where did he go?']),
  clear: Object.freeze(['Nothing here. Back to your posts.', 'Section’s clear. Stand easy.']),
  flee: Object.freeze(['Get security down here.', 'Call it in. Call it in.']),
});

const TURN = 8; // radians a second anyone turns
const ARRIVE = 0.3; // metres from a waypoint that count as there
const PASS = 0.45; // metres from a door’s middle that count as through it: a shut leaf holds a body 0.35 off
const SPACING = 1.1; // how far people keep from each other
const RIDE = 3; // seconds a lift ride takes (game.js’s)
const STUCK = 2; // seconds without headway before a way is worked out again
const GIVE_UP = 3; // times stuck before the way counts as gone
const RETRY = 3; // seconds before a way that failed, or a routine that did, is tried again
const MEMORY = 8; // seconds a belief lasts unseen
const SPOOKED = 0.25; // a belief this sure, unseen, makes someone wary
const SURE = 0.6; // how sure a searcher must be to open fire: it is looking for you
const WARY_FOR = 12; // seconds a wary person stays so with nothing more to go on
const LOOK = 3; // seconds spent looking about where a noise was
const CALL_GAP = 2; // seconds between one person’s radio calls
const DOWN = 1.6; // seconds a knockdown lasts
const STAGGER = 0.35; // seconds a lesser hit staggers
const SHOT_POSE = 0.15; // seconds the shooting pose shows after a shot
const ROAR = 8; // metres a roar scatters mouse droids within
const SCATTER = 8; // and how much further off they run
const FLEE_FOR = { roar: 3, fight: 6 };
const BODY_LOOK = 0.5; // seconds between one person’s looks round for a fallen comrade
const UP = new Set(['alert', 'lockdown', 'hunt']);

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// yaw 0 faces −z, turning towards +x is positive
const dirOf = (yaw) => ({ x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) });
const yawTo = (p, q) => Math.atan2(q.x - p.x, -(q.z - p.z));
const eyes = (p) => ({ x: p.x, y: p.y + p.h * 0.9, z: p.z });
const chest = (b) => ({ x: b.x, y: b.y + Math.min(FIGHT.chest, (b.h ?? BODY.h) * 0.7), z: b.z });
const youId = (you) => you?.id ?? 'you';
const idle = () => ({ key: null, path: null, i: 0, touched: -1, failedAt: -Infinity, stuck: 0 });

export function createCrew({ rand, layout, nav, solidsOf = () => [] }) {
  return { rand, layout, nav, solidsOf, people: [], byId: new Map(), fights: createFights({ rand, layout, nav }), clock: 0, heard: 0, out: [], world: null, cleared: new Map() };
}

// ── who is aboard ──

function defaultRole(kind) {
  const c = CAST[kind];
  if (c.scripted || kind === 'royalguard') return { type: 'scripted' };
  return c.role === 'droid' ? { type: 'droid' } : { type: 'post' };
}

// a post or a console with no spot named is the place the person was put
const settle = (role, home) => ((role.type === 'post' || role.type === 'work') && role.spot == null ? { ...role, spot: home } : role);

function checkSpots(layout, role, script) {
  const named = [...(role.spots ?? []), role.spot, ...(script ?? []).map((s) => s.to)].filter((n) => typeof n === 'string');
  for (const n of named) if (!layout.station.spots?.[n]) throw new Error(`brains: the station has no spot called “${n}”`);
}

export function addPerson(crew, { id, kind, room, x, z, yaw = 0, role, squad = null, hostile = null, script = null, tag = null, talk = null }) {
  const cast = CAST[kind];
  if (!cast) throw new Error(`brains: nobody aboard is a “${kind}”`);
  if (crew.byId.has(id)) throw new Error(`brains: ${id} is aboard already`);
  const r = crew.layout.rooms.get(room);
  if (!r) throw new Error(`brains: the station has no room ${room}`);
  const home = { x, z, room, yaw };
  const given = settle(role ?? defaultRole(kind), home);
  checkSpots(crew.layout, given, script);
  // a droid is narrower than a man; nobody is wider
  const body = createBody({ x, y: crew.layout.floorAt(room, x, z) ?? r.y, z, yaw, r: Math.min(BODY.r, Math.max(0.15, cast.tall * 0.3)), h: cast.tall, room });
  const p = Object.assign(body, { id, kind, side: cast.side, hp: cast.hp, max: cast.hp, mode: given.type === 'scripted' ? 'scripted' : 'routine', anim: 'idle', aim: null, role: given, squad, hostile, script, tag, talk, gun: cast.gun ?? null });
  p.mind = mindOf(crew, p, home);
  crew.people.push(p);
  crew.byId.set(id, p);
  return p;
}

function mindOf(crew, p, home) {
  const senses = perceptionOf(p.kind);
  const m = {
    home,
    tree: routineFor(p.role, p.script),
    senses: createSenses({ sight: { range: senses.sight, cone: senses.cone, far: senses.far }, hearing: { range: senses.shots }, memory: MEMORY, intuition: FIGHT.lose }),
    hearing: senses,
    eye: { pos: null, dir: null, beliefs: {}, now: 0 },
    nav: idle(),
    ride: null,
    wander: null,
    ctx: null,
    want: { yaw: p.yaw, lock: false },
    pose: null,
    own: [],
    lastHp: p.hp,
    hitUntil: -Infinity,
    downUntil: -Infinity,
    shotUntil: -Infinity,
    retryAt: -Infinity,
    callAt: -Infinity,
    bodyAt: -Infinity,
    trickedUntil: -Infinity,
    fight: null,
    search: null,
    flee: null,
    wary: null,
    found: false,
  };
  m.bb = blackboard(crew, p, m);
  return m;
}

// What the routines and the fight ask of a body, answered here.
function blackboard(crew, p, m) {
  return {
    me: p,
    clock: 0,
    rand: crew.rand,
    timers: {},
    rest: p.kind === 'royalguard' ? 'attention' : 'idle',
    go: (where, opts) => goTo(crew, p, where, opts),
    face: (target) => faceTo(crew, p, target),
    lock: (point) => {
      m.want.yaw = yawTo(p, point);
      m.want.lock = true;
    },
    pose: (anim) => {
      m.pose = anim;
    },
    say: (key, text) => say(crew, p, key, text),
    near: (who, metres) => {
      const q = placeOf(crew, p, who);
      return Boolean(q) && flat(p, q) <= metres;
    },
    aimAt: (point) => {
      p.aim = point ? { x: point.x, y: point.y, z: point.z } : null;
    },
    fire: (threat) => fire(crew, p, threat),
    gunBusy: () => gunBusy(crew, p),
    seesThrough: (a, b) => lineClear(crew.layout, crew.world.open, a, b, crew.solidsOf(p.room)),
    canPass: (id, door) => canPass(crew, p, id, door),
    solidsOf: crew.solidsOf,
    allies: () => allies(crew, p),
    eyes: () => eyes(p),
  };
}

export function direct(crew, id, script) {
  const p = crew.byId.get(id);
  if (!p) return null;
  checkSpots(crew.layout, {}, script);
  release(crew, p);
  Object.assign(p, { role: { type: 'scripted' }, script, mode: 'scripted', aim: null });
  p.mind.tree = routineFor(p.role, script);
  resetRoutine(p.mind.tree, p.mind.bb);
  return p;
}

export function assign(crew, id, role) {
  const p = crew.byId.get(id);
  if (!p) return null;
  const given = settle(role, p.mind.home);
  checkSpots(crew.layout, given, p.script);
  release(crew, p);
  Object.assign(p, { role: given, mode: given.type === 'scripted' ? 'scripted' : 'routine', aim: null });
  p.mind.tree = routineFor(given, p.script);
  resetRoutine(p.mind.tree, p.mind.bb);
  return p;
}

export function removePerson(crew, id) {
  const p = crew.byId.get(id);
  if (!p) return false;
  release(crew, p);
  crew.people.splice(crew.people.indexOf(p), 1);
  crew.byId.delete(id);
  return true;
}

// ── a step ──

export function stepCrew(crew, dt, { you = null, alarm = null, doors = null, combat = null, flags = new Set(), now, open = () => true, stims = [] } = {}) {
  crew.clock = now ?? crew.clock + dt;
  crew.out = [];
  crew.world = { you, alarm, doors, combat, flags, open, dt };
  const heard = gather(crew, stims);
  const watchers = [];
  for (const p of [...crew.people]) vitals(crew, p);
  for (const p of crew.people) think(crew, p, heard, watchers);
  for (const p of crew.people) move(crew, p, dt);
  for (const s of crew.fights.searches.values()) s.update(dt);
  crew.fights.tokens.audit(dt, (id) => crew.byId.get(id)?.mode === 'fight');
  if (watchers.length) crew.out.push(challenge(watchers));
  return crew.out;
}

// What was heard this step: what the game says, and every bolt fired since the last.
function gather(crew, stims) {
  const out = [...stims];
  let top = crew.heard;
  for (const b of crew.world.combat?.bolts ?? []) {
    if (b.id <= crew.heard) continue;
    out.push({ type: 'shot', at: { x: b.x, y: b.y, z: b.z }, from: b.owner });
    top = Math.max(top, b.id);
  }
  crew.heard = top;
  return out;
}

function challenge(watchers) {
  let nearest = watchers[0];
  for (const w of watchers) if (w.dist < nearest.dist) nearest = w;
  const officers = watchers.filter((w) => w.officer).map((w) => w.dist);
  return { type: 'challenge', id: nearest.p.id, watchers: watchers.length, officerAt: officers.length ? Math.min(...officers) : null };
}

// ── hurt, down and dead ──

function vitals(crew, p) {
  if (p.mode === 'dead') return;
  const m = p.mind;
  if (!(p.hp > 0)) return die(crew, p);
  if (p.hp < m.lastHp && p.mode !== 'scripted') {
    if (m.lastHp - p.hp >= COMBAT.knock) {
      release(crew, p);
      p.mode = 'down';
      m.downUntil = crew.clock + DOWN;
    } else m.hitUntil = crew.clock + STAGGER;
    // a hit says where it came from: whoever the game says shot, else you
    const by = p.hurtBy ?? youId(crew.world.you);
    const q = by === youId(crew.world.you) ? crew.world.you : crew.byId.get(by);
    if (q && (q === crew.world.you ? hostileToYou(crew, p, q) : q.side !== p.side)) m.own.push({ at: chest(q), from: by, radius: Infinity, loudness: 1 });
  }
  m.lastHp = p.hp;
  if (p.mode === 'down' && crew.clock >= m.downUntil) setMode(crew, p, 'wary');
}

function die(crew, p) {
  release(crew, p);
  Object.assign(p, { mode: 'dead', anim: 'die', aim: null });
  p.mind.nav = idle();
  p.mind.ride = null;
  crew.out.push({ type: 'died', id: p.id, kind: p.kind, tag: p.tag, room: p.room, x: p.x, y: p.y, z: p.z });
}

// Lets go of a shot token and a search claim, leaving the search when the last searcher goes.
function release(crew, p) {
  const m = p.mind;
  if (m.fight?.target) crew.fights.tokens.release('shot', p.id, m.fight.target);
  if (m.search) {
    const { section } = m.search;
    const s = searchOf(crew.fights, section);
    s.release(p.id);
    m.search = null;
    if (!crew.people.some((q) => q !== p && q.mind.search?.section === section)) s.stop();
  }
  m.fight = null;
  m.flee = null;
  m.wary = null;
}

function setMode(crew, p, mode) {
  if (p.mode === mode) return;
  release(crew, p);
  if (mode === 'routine') {
    resetRoutine(p.mind.tree, p.mind.bb);
    p.mind.retryAt = -Infinity;
  }
  p.mode = mode;
  p.aim = null;
}

// ── what they believe ──

function hostileToYou(crew, p, you) {
  if (p.side === 'neutral' || crew.clock < p.mind.trickedUntil) return false;
  if (p.hostile != null) return p.hostile;
  // a Rebel in armour and helmet passes for one of the garrison until the doubt blows it
  const passes = you.side === 'imperial' || (disguised(you) && Boolean(you.helmet) && !(you.doubt >= 1));
  return (passes ? 'imperial' : you.side) !== p.side;
}

function perceive(crew, p, heard, watchers) {
  const m = p.mind;
  const you = crew.world.you;
  const yid = youId(you);
  const targets = [];
  if (p.side !== 'neutral') {
    if (you && !(you.hp <= 0)) targets.push({ id: yid, at: chest(you), kind: you.hero ?? 'you', hostile: hostileToYou(crew, p, you) });
    for (const q of crew.people) if (q !== p && q.mode !== 'dead' && q.side !== 'neutral' && q.side !== p.side) targets.push({ id: q.id, at: chest(q), kind: q.kind, hostile: true });
  }
  // only an enemy’s shots and steps are worth turning round for
  const stims = m.own.splice(0);
  for (const s of heard) {
    if (s.type !== 'shot' && s.type !== 'steps') continue;
    if (!targets.find((t) => t.id === s.from)?.hostile) continue;
    stims.push({ at: s.at, from: s.from, radius: s.type === 'shot' ? m.hearing.shots : m.hearing.steps, loudness: s.type === 'shot' ? 1 : 0.5 });
    if (s.type === 'shot' && flat(p, s.at) <= m.hearing.shots) m.heardShot = s.at;
  }
  m.eye.pos = eyes(p);
  m.eye.dir = dirOf(p.yaw);
  const solids = crew.solidsOf(p.room);
  sense(m.senses, m.eye, { targets, stims }, crew.world.dt, { seesThrough: (a, b) => lineClear(crew.layout, crew.world.open, a, b, solids) });
  const b = m.eye.beliefs[yid];
  if (b?.visible && !b.hostile && p.side === 'imperial' && you) watchers.push({ p, dist: flat(p, you), officer: CAST[p.kind].role === 'officer' });
  return surest(m.eye, { hostile: true });
}

// A fallen comrade in sight, not found before; looked for twice a second.
function foundBody(crew, p) {
  const m = p.mind;
  if (p.side !== 'imperial' || crew.clock < m.bodyAt) return null;
  m.bodyAt = crew.clock + BODY_LOOK;
  const from = eyes(p);
  const dir = dirOf(p.yaw);
  for (const q of crew.people) {
    if (q.mode !== 'dead' || q.side !== p.side || q.mind.found) continue;
    const d = flat(from, q);
    if (d > m.senses.sight.range || (d > 1e-6 && ((q.x - from.x) * dir.x + (q.z - from.z) * dir.z) / d < m.senses.sight.cone)) continue;
    if (!lineClear(crew.layout, crew.world.open, from, { x: q.x, y: q.y + 0.3, z: q.z }, crew.solidsOf(p.room))) continue;
    q.mind.found = true;
    return q;
  }
  return null;
}

// ── what they do ──

function think(crew, p, heard, watchers) {
  if (p.mode === 'dead' || p.mode === 'down') return;
  const m = p.mind;
  m.bb.clock = crew.clock;
  m.want.lock = false;
  if (p.mode === 'scripted') return routine(crew, p);
  const threat = perceive(crew, p, heard, watchers);
  if (scattered(crew, p, heard) || forced(crew, p, heard)) return;
  if (p.mode === 'fight') return fight(crew, p, threat);
  if (p.mode === 'search') return hunt(crew, p, threat);
  if (p.mode === 'flee') return flee(crew, p, threat);
  return calm(crew, p, threat);
}

const armed = (p) => Boolean(p.gun) && CAST[p.kind].role !== 'droid';
const sectionOf = (crew, p) => crew.layout.rooms.get(p.room)?.section;
const placeAt = (crew, at) => {
  const room = crew.layout.roomAt(at.x, at.y ?? 0, at.z);
  return room ? { x: at.x, z: at.z, room } : null;
};

// Routine or wary: nothing is certain yet.
function calm(crew, p, threat) {
  const m = p.mind;
  const you = crew.world.you;
  if (threat?.visible && threat.confidence >= 1) return armed(p) ? engage(crew, p, threat) : frighten(crew, p, threat.at, 'fight');
  // a watcher who doubts you enough stops what he is doing to look you over
  const watched = m.eye.beliefs[youId(you)];
  if (watched?.visible && !watched.hostile && (you.doubt ?? 0) >= CHALLENGE && p.side === 'imperial') {
    m.want.yaw = yawTo(p, you);
    m.pose = 'attention';
    return;
  }
  const level = crew.world.alarm ? levelOf(crew.world.alarm, sectionOf(crew, p)) : null;
  if (armed(p) && p.side === 'imperial' && level === 'hunt') return startSearch(crew, p, crew.world.alarm.sections[sectionOf(crew, p)].at ?? p);
  if (m.heardShot && p.side === 'imperial') call(crew, p, 'shots', m.heardShot);
  m.heardShot = null;
  if (threat && threat.confidence >= SPOOKED) return wary(crew, p, threat, level);
  const body = foundBody(crew, p);
  if (body) {
    call(crew, p, 'body', body);
    beWary(crew, p, placeAt(crew, body), false);
  } else if (armed(p) && p.side === 'imperial' && p.mode === 'routine' && (level === 'alert' || level === 'lockdown')) {
    // squads are called to where the trouble is
    const at = crew.world.alarm.sections[sectionOf(crew, p)].at;
    beWary(crew, p, at ? placeAt(crew, at) : null, true);
  }
  if (p.mode === 'wary') return wary(crew, p, threat, level);
  return routine(crew, p);
}

function routine(crew, p) {
  const m = p.mind;
  if (crew.clock < m.retryAt) {
    m.pose = 'idle';
    return;
  }
  if (runRoutine(m.tree, m.bb, crew.world.dt) === 'failed') {
    resetRoutine(m.tree, m.bb);
    m.retryAt = crew.clock + RETRY;
  }
}

function beWary(crew, p, at, run) {
  if (p.mode !== 'wary') setMode(crew, p, 'wary');
  p.mind.wary ??= { since: crew.clock, at: null, run: false, lookUntil: -Infinity, lookYaw: p.yaw };
  Object.assign(p.mind.wary, { since: crew.clock, at, run });
}

function wary(crew, p, threat, level) {
  const m = p.mind;
  if (p.mode !== 'wary') beWary(crew, p, null, false);
  const w = m.wary;
  if (threat && threat.confidence >= SPOOKED) {
    w.since = crew.clock;
    // seen but not yet sure: stand and look hard; heard: go and see
    if (threat.visible) {
      m.want.yaw = yawTo(p, threat.at);
      w.at = null;
    } else if (!w.at || flat(w.at, threat.at) > 2) w.at = placeAt(crew, threat.at);
  }
  if (w.at && goTo(crew, p, w.at, { run: w.run }) !== 'running') {
    w.at = null;
    Object.assign(w, { lookUntil: crew.clock + LOOK, lookYaw: p.yaw });
  }
  if (crew.clock < w.lookUntil) m.want.yaw = w.lookYaw + 0.9 * Math.sin((w.lookUntil - crew.clock) * 1.6);
  m.pose = armed(p) ? 'aim' : 'idle';
  if (crew.clock - w.since > WARY_FOR && !(armed(p) && UP.has(level))) setMode(crew, p, 'routine');
}

function engage(crew, p, threat) {
  setMode(crew, p, 'fight');
  // a beat to bring the rifle up before the first shot
  p.mind.fight = { target: threat.id, tactic: null, since: crew.clock, think: crew.clock, place: null, burst: 0, next: crew.clock + 0.25 + 0.35 * crew.rand(), knownUntil: -Infinity };
  crew.out.push({ type: 'saw', id: p.id, target: threat.id, at: { ...threat.at }, room: p.room });
  call(crew, p, 'seen', threat.at);
  bark(crew, p, 'seen');
  fight(crew, p, threat);
}

function fight(crew, p, threat) {
  const m = p.mind;
  if (!threat) return startSearch(crew, p, m.fight?.at ?? p);
  if (m.fight.target !== threat.id) {
    crew.fights.tokens.release('shot', p.id, m.fight.target);
    m.fight.target = threat.id;
  }
  m.fight.at = { ...threat.at };
  if (threat.visible) call(crew, p, 'seen', threat.at);
  const tactic = fightStep(crew.fights, p, threat, m.bb, m.fight, m.eye.now - threat.seenAt);
  if (tactic !== 'search') return;
  crew.out.push({ type: 'lost', id: p.id, target: threat.id, at: { ...threat.at } });
  if (crew.rand() < 0.5) bark(crew, p, 'lost');
  startSearch(crew, p, threat.at);
}

function startSearch(crew, p, at) {
  const section = sectionOf(crew, p);
  const s = searchOf(crew.fights, section);
  // a fresh loss far from where the search is looking starts it again there
  if (!s.active || flat(s.state.estimate, at) > 8) s.start({ at: { x: at.x, y: at.y ?? 0, z: at.z } }, { aggressive: true });
  setMode(crew, p, 'search');
  p.mind.search = { section, claim: null, lookUntil: crew.clock + 0.5, lookFrom: crew.clock, lookYaw: p.yaw, raised: false, leaveAt: null, restartAt: -Infinity };
}

// Searching: until you turn up, or the alarm stands down (one at a time, never all at once).
function hunt(crew, p, threat) {
  const st = p.mind.search;
  if (threat?.visible && threat.confidence >= SURE) return engage(crew, p, threat);
  const level = crew.world.alarm ? levelOf(crew.world.alarm, st.section) : null;
  if (UP.has(level)) st.raised = true;
  const over = st.raised ? level !== 'lockdown' && level !== 'alert' : searchOf(crew.fights, st.section).done(p.id);
  if (over) {
    st.leaveAt ??= crew.clock + 0.4 + 2.2 * crew.rand();
    if (crew.clock >= st.leaveAt) return standDown(crew, p, st.section);
  }
  searchStep(crew.fights, p, p.mind.bb, st);
}

function standDown(crew, p, section) {
  setMode(crew, p, 'routine');
  if (crew.clock - (crew.cleared.get(section) ?? -Infinity) > 20) {
    crew.cleared.set(section, crew.clock);
    bark(crew, p, 'clear');
  }
  routine(crew, p);
}

// Away from a roar, or from a fight the unarmed can’t join.
function frighten(crew, p, from, why) {
  setMode(crew, p, 'flee');
  const away = why === 'roar' ? standOff(crew.layout, p, from, flat(p, from) + SCATTER) : null;
  const to = away ?? fallbackFrom(crew.layout, p, { x: from.x, y: from.y ?? p.y + FIGHT.chest, z: from.z }, { seesThrough: p.mind.bb.seesThrough, canPass: p.mind.bb.canPass });
  p.mind.flee = { from: why, to, until: crew.clock + FLEE_FOR[why] };
  crew.out.push({ type: 'fled', id: p.id, kind: p.kind, from: why, ...(p.kind === 'mouse' ? { sound: 'squeal' } : {}) });
  if (why === 'fight') {
    call(crew, p, 'seen', from);
    bark(crew, p, 'flee');
  }
  flee(crew, p, null);
}

function flee(crew, p, threat) {
  const f = p.mind.flee;
  if (f.to && goTo(crew, p, f.to, { run: true }) !== 'running') f.to = null;
  if (!f.to) p.mind.pose = f.from === 'roar' ? 'idle' : 'kneel';
  if (crew.clock >= f.until && !threat?.visible) setMode(crew, p, 'routine');
}

function scattered(crew, p, heard) {
  if (p.kind !== 'mouse' || p.mode === 'flee') return false;
  const roar = heard.find((s) => s.type === 'roar' && flat(p, s.at) <= ROAR && Math.abs((s.at.y ?? p.y) - p.y) < 3);
  if (roar) frighten(crew, p, roar.at, 'roar');
  return Boolean(roar);
}

// The Force on a mind: the trick stands a guard down for a while; a noise draws him off to look.
function forced(crew, p, heard) {
  const m = p.mind;
  for (const s of heard) {
    if (s.type === 'trick' && s.id === p.id) {
      m.trickedUntil = crew.clock + (s.s ?? 8);
      forget(m.eye, youId(crew.world.you));
      setMode(crew, p, 'routine');
      say(crew, p, 'trick', s.line ?? null);
      return true;
    }
    if (s.type === 'noise' && s.heard?.includes(p.id) && (p.mode === 'routine' || p.mode === 'wary')) {
      beWary(crew, p, placeAt(crew, s.at), false);
      return false;
    }
  }
  return false;
}

// ── what they say and send ──

function say(crew, p, key, text) {
  crew.out.push({ type: 'say', id: p.id, kind: p.kind, key, text: text ?? null });
}

function bark(crew, p, when) {
  const lines = BARKS[when];
  say(crew, p, when, lines[Math.floor(crew.rand() * lines.length)]);
}

// The radio is the garrison’s: an Imperial calls in what he finds, now and then, not every step.
function call(crew, p, how, at) {
  const m = p.mind;
  if (p.side !== 'imperial' || crew.clock - m.callAt < CALL_GAP) return;
  m.callAt = crew.clock;
  const room = crew.layout.roomAt(at.x, at.y ?? p.y, at.z) ?? p.room;
  crew.out.push({ type: 'call', id: p.id, section: crew.layout.rooms.get(room)?.section, how, at: { x: at.x, y: at.y ?? p.y, z: at.z } });
}

// From just in front of the chest, never past the body’s own radius (so never through a wall),
// at where it believes the target will be when the bolt gets there.
function fire(crew, p, threat) {
  const w = WEAPONS[p.gun];
  const fwd = dirOf(p.yaw);
  const from = { x: p.x + fwd.x * 0.3, y: p.y + p.h * 0.75, z: p.z + fwd.z * 0.3 };
  const flight = Math.hypot(threat.at.x - from.x, threat.at.y - from.y, threat.at.z - from.z) / w.speed;
  const aim = { x: threat.at.x + (threat.vel?.x ?? 0) * flight, y: threat.at.y, z: threat.at.z + (threat.vel?.z ?? 0) * flight };
  const d = { x: aim.x - from.x, y: aim.y - from.y, z: aim.z - from.z };
  const l = Math.hypot(d.x, d.y, d.z) || 1;
  crew.out.push({ type: 'shoot', from, dir: { x: d.x / l, y: d.y / l, z: d.z / l }, weapon: p.gun, owner: p.id, side: p.side, npc: true, target: threat.id });
  p.mind.shotUntil = crew.clock + SHOT_POSE;
}

// Waiting out a gap, venting, or hot enough that a trained man lets it cool.
function gunBusy(crew, p) {
  const combat = crew.world.combat;
  if (!combat || !p.gun) return false;
  const g = gunOf(combat, p.id, p.gun);
  return g.wait > 0 || g.vent > 0 || g.heat > 0.75;
}

function allies(crew, p) {
  const out = [];
  for (const q of crew.people) if (q !== p && q.mode === 'fight' && q.side === p.side && flat(q, p) < 25) out.push(q.mind.fight?.place?.room ? q.mind.fight.place : { x: q.x, y: q.y, z: q.z });
  return out;
}

// ── where they go ──

// A door opens for this person: not sealed, and not locked against them.
function canPass(crew, p, id, door) {
  const s = crew.world.doors?.[id];
  if (!s) return true;
  if (s.sealed) return false;
  if (!s.locked) return true;
  return door.kind !== 'hatch' && door.lock === 'side:imperial' && p.side === 'imperial';
}

function placeOf(crew, p, where) {
  if (where == null) return null;
  if (typeof where === 'string') {
    const s = crew.layout.station.spots?.[where];
    return s ? { x: s.x, z: s.z, room: s.room, yaw: s.yaw } : null;
  }
  if (where.who !== undefined) {
    const you = crew.world.you;
    const q = where.who === youId(you) ? you : crew.byId.get(where.who);
    return q && q.mode !== 'dead' ? { x: q.x, y: q.y, z: q.z, room: q.room } : null;
  }
  if (where.wander) return (p.mind.wander ??= wanderFrom(crew, p));
  if (where.path) return where.path.at(-1);
  if (where.spot !== undefined) return placeOf(crew, p, where.spot);
  return where.room ? where : null;
}

const keyOf = (where, to) => {
  if (typeof where === 'string') return `spot:${where}`;
  if (where.who !== undefined) return `who:${where.who}`;
  return `at:${to.x.toFixed(2)},${to.z.toFixed(2)},${to.room}`;
};

// Somewhere to scurry: a point in this room or, as often as not, the room through one of its doors.
function wanderFrom(crew, p) {
  const { layout, rand } = crew;
  let id = p.room;
  const doors = (layout.rooms.get(id)?.doors ?? []).filter((d) => canPass(crew, p, d, layout.doors.get(d)));
  if (doors.length && rand() < 0.5) {
    const d = layout.doors.get(doors[Math.floor(rand() * doors.length)]);
    id = d.a === id ? d.b : d.a;
  }
  const r = layout.rooms.get(id);
  for (let k = 0; k < 6; k++) {
    const x = r.box.x0 + 0.8 + rand() * Math.max(0, r.box.x1 - r.box.x0 - 1.6);
    const z = r.box.z0 + 0.8 + rand() * Math.max(0, r.box.z1 - r.box.z0 - 1.6);
    const y = layout.floorAt(id, x, z);
    if (y !== null && Math.abs(y - r.y) <= BODY.step && layout.roomAt(x, y + 0.1, z) === id) return { x, z, room: id };
  }
  return { x: p.x, z: p.z, room: p.room };
}

function goTo(crew, p, where, { run = false, near = ARRIVE, keepUp = false } = {}) {
  const m = p.mind;
  const clock = crew.clock;
  const to = placeOf(crew, p, where);
  if (!to?.room) return 'failed';
  const key = keyOf(where, to);
  const nav = m.nav;
  if (flat(p, to) <= near && (p.room === to.room || near > ARRIVE)) {
    if (nav.key === key && nav.path && typeof where === 'string') crew.out.push({ type: 'arrive', id: p.id, spot: where, room: p.room });
    if (where.wander) m.wander = null;
    m.nav = idle();
    return 'done';
  }
  if (nav.key === key && !nav.path && clock - nav.failedAt < RETRY) return 'failed';
  // someone walked towards moves on: the way is worked out again now and then
  const moved = where.who !== undefined && nav.path && flat(nav.path.at(-1), to) > 1.5 && clock - nav.routedAt > 0.5;
  if (nav.key !== key || !nav.path || moved) {
    const path = where.path ?? route(crew.nav, p, to, { canPass: (id, door) => canPass(crew, p, id, door), solidsOf: crew.solidsOf });
    const stuck = nav.key === key ? nav.stuck : 0;
    if (!path) {
      m.nav = { ...idle(), key, failedAt: clock, stuck };
      if (where.wander) m.wander = null;
      return 'failed';
    }
    m.nav = { key, path, i: 1, routedAt: clock, touched: clock, run: false, failedAt: -Infinity, stuck, checkAt: clock + STUCK, best: Infinity, mark: 1 };
  }
  m.nav.touched = clock;
  m.nav.run = run || (keepUp && flat(p, to) > 6);
  return 'running';
}

function faceTo(crew, p, target) {
  const m = p.mind;
  if (typeof target === 'number') {
    m.want.yaw = target;
    return;
  }
  if (target?.turn !== undefined) {
    const s = placeOf(crew, p, target.spot);
    if (s?.yaw !== undefined) m.want.yaw = s.yaw + target.turn;
    return;
  }
  const q = placeOf(crew, p, target) ?? (target?.x !== undefined ? target : null);
  if (!q) return;
  // a spot is faced the way it faces; a person or a point is faced towards
  if ((typeof target === 'string' || target.who === undefined) && q.yaw !== undefined) m.want.yaw = q.yaw;
  else if (flat(p, q) > 1e-6) m.want.yaw = yawTo(p, q);
}

// ── how they walk ──

function move(crew, p, dt) {
  if (p.mode === 'dead') return;
  const m = p.mind;
  const clock = crew.clock;
  // a way nobody asked for this step is dropped, so a stop is a stop
  if (m.nav.touched !== clock && m.nav.path) m.nav = idle();
  let dir = null;
  if (m.ride) {
    if (clock >= m.ride.until) ride(crew, p);
  } else if (p.mode !== 'down' && clock >= m.hitUntil && m.nav.path) dir = follow(crew, p);
  const run = Boolean(dir && m.nav.run);
  const g = gait((run ? BODY.run : BODY.walk) * (CAST[p.kind].speed ?? 1));
  const was = { x: p.x, z: p.z };
  stepBody(p, { dir: dir ? { x: dir.x * g.len, z: dir.z * g.len } : { x: 0, z: 0 }, run: g.run }, dt, { layout: crew.layout, open: crew.world.open, solids: crew.solidsOf(p.room) });
  const moved = flat(was, p);
  if (dir && moved > 1e-3 && !m.want.lock) m.want.yaw = Math.atan2(dir.x, -dir.z);
  const most = TURN * dt;
  p.yaw = wrap(p.yaw + Math.max(-most, Math.min(most, wrap(m.want.yaw - p.yaw))));
  p.anim = animOf(crew, p, moved / dt, run);
  if (m.nav.path && !m.ride) unstick(crew, p);
}

// The walker walks at its walk or its run; a scale on either is a shorter push or the run cut down.
const gait = (speed) => (speed <= BODY.walk + 1e-9 ? { len: speed / BODY.walk, run: false } : { len: Math.min(1, speed / BODY.run), run: true });

// The way on from here: the next waypoint not yet reached, bent round anyone close.
function follow(crew, p) {
  const m = p.mind;
  const nav = m.nav;
  const path = nav.path;
  while (nav.i < path.length) {
    const q = path[nav.i];
    if (flat(p, q) > (q.door ? PASS : ARRIVE)) break;
    if (q.lift && path[nav.i + 1]) {
      // the car’s doors aren’t held for a ride nobody else is on: it just takes its time
      m.ride = { until: crew.clock + RIDE, from: q.room, to: path[nav.i + 1].room };
      nav.i += 2;
      return null;
    }
    nav.i += 1;
  }
  if (nav.i >= path.length) return null;
  const q = path[nav.i];
  const l = flat(p, q) || 1;
  return steerAround(crew, p, { x: (q.x - p.x) / l, z: (q.z - p.z) / l }, q);
}

function ride(crew, p) {
  const { from, to } = p.mind.ride;
  const [a, b] = [crew.layout.rooms.get(from), crew.layout.rooms.get(to)];
  Object.assign(p, { x: p.x + b.x - a.x, y: p.y + b.y - a.y, z: p.z + b.z - a.z, room: to, vy: 0 });
  Object.assign(p.safe, { x: p.x, y: p.y, z: p.z, room: to });
  p.mind.ride = null;
}

// Straight on when nobody is close; else a context map: the way on, a pull to
// the right so two meeting in a corridor pass each other, and danger towards
// anyone within SPACING. A squeeze with no way left is walked straight
// through, as people brush past each other.
function steerAround(crew, p, d, q) {
  const m = p.mind;
  const others = [];
  const you = crew.world.you;
  for (const o of you ? [...crew.people, you] : crew.people) {
    if (o === p || o.mode === 'dead' || Math.abs(o.y - p.y) > 1 || Math.abs(o.x - p.x) > SPACING || Math.abs(o.z - p.z) > SPACING) continue;
    others.push(o);
  }
  if (!others.length) {
    if (m.ctx) m.ctx.blended = false;
    return d;
  }
  const ctx = (m.ctx ??= createContext(16));
  clearSteer(ctx);
  seek(ctx, p, q, 1, 3);
  interest(ctx, { x: d.x * 0.64 - d.z * 0.77, y: 0, z: d.z * 0.64 + d.x * 0.77 }, 0.6, 2);
  separate(ctx, p, others, SPACING);
  const r = resolve(ctx);
  return r.strength > 0.05 ? { x: r.dir.x, z: r.dir.z } : d;
}

// No headway for a while: the way is worked out afresh; stuck often enough, it is gone.
function unstick(crew, p) {
  const nav = p.mind.nav;
  if (crew.clock < nav.checkAt) return;
  const d = flat(p, nav.path[Math.min(nav.i, nav.path.length - 1)]);
  const headway = nav.i > nav.mark || d < nav.best - 0.3 || nav.i >= nav.path.length;
  Object.assign(nav, { mark: nav.i, best: d, checkAt: crew.clock + STUCK });
  if (headway) {
    nav.stuck = 0;
    return;
  }
  nav.stuck += 1;
  nav.path = null;
  if (nav.stuck >= GIVE_UP) nav.failedAt = crew.clock;
}

function animOf(crew, p, speed, run) {
  const m = p.mind;
  const clock = crew.clock;
  if (p.mode === 'dead') return 'die';
  if (p.mode === 'down') return clock < m.downUntil - DOWN + 0.4 ? 'hit' : 'kneel';
  if (clock < m.hitUntil) return 'hit';
  if (clock < m.shotUntil) return 'shoot';
  if (speed > 0.3) return run ? 'run' : 'walk';
  return m.ride ? 'idle' : (m.pose ?? 'idle');
}
