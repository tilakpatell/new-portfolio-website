// The battle (spec decisions 3 and 9): a fixed 50 ms step from a seed, in
// Node or the page alike. Entities (soldiers now; heroes and vehicles in
// later lanes), their guns' bolts, hits, deaths, events. Inputs go in as
// plain objects a step, events come out; every random draw is the sim's own
// `rand`, so one seed gives one battle. The bots' brains (ai/) are stepped
// here on a stagger. Pure: no three.js, no DOM.
//
//   createSim({ rulebook, level, era, nav, seed, teams, bots, mode, spawns }) → sim
//   step(sim, inputs = []) → events     inputs: [{ id, move: [x, z], look, fire, aim: [x, y, z], crouch, sprint, roll, ability, vent, cool }]
//   addPlayer(sim, { team, classId, at, yaw }) → id      removeEntity(sim, id)
//   view(sim) → { time, teams, entities, bolts }  (one object, refreshed in place)
//   drain(sim) → the event log so far, cleared

import { seeded } from '../seeded.js';
import { classOf, mapOf, spawnsFor, teamsFor, weaponOf } from './rulebook.js';
import { press } from './abilities.js';
import { createBolts, fire as fireBolt, step as stepBolts } from './bolts.js';
import { heightAt, nearestWalkable } from './nav.js';
import { capsulesOf, chestOf, eyeOf, hurt, move, newSoldier, roll, tick as tickSoldier } from './soldier.js';
import { coolPress, damageAt, fire as fireGun, vent } from './weapons.js';
import { createBrains, onEvents, stepBrains } from './ai/bots.js';

export const STEP = 0.05;
export const THINK = 0.2;
export const SENSE = 0.1;
export const SQUAD = 0.5;

// The muzzle: forward of the eye, the gun's side (the third-person camera's shoulder).
const MUZZLE = 0.45;

// The team a side plays: 1 the light side (Hoth's defending Rebels), 2 the dark (the attacking Empire).
const SIDES = { 1: 'light', 2: 'dark' };

// A team's spawns for the opening: its spawn points by priority, the ones
// nearest the other team's first (the front), so both sides meet.
function openingSpawns(map, team, other) {
  const mine = spawnsFor(map, { mode: 'galacticAssault', team }).filter((s) => s.at);
  const theirs = spawnsFor(map, { mode: 'galacticAssault', team: other }).filter((s) => s.at && s.enabled);
  if (!mine.length) return [];
  const live = mine.filter((s) => s.enabled);
  const pool = live.length ? live : mine;
  const d = (a, b) => Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]);
  const anchor = pool.reduce((best, s) => {
    const near = Math.min(...theirs.map((t) => d(s, t)));
    return !best || near < best.near ? { s, near } : best;
  }, null).s;
  return [...mine].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || d(a, anchor) - d(b, anchor) || (a.id < b.id ? -1 : 1));
}

export function createSim({ rulebook, level = 'hoth', era = 'Orig', nav, seed = 1, teams = null, bots = { 1: 0, 2: 0 }, mode = null, spawns = null }) {
  const rb = rulebook;
  const sides = teams ?? (() => {
    const t = teamsFor(rb, level, era);
    return { 1: t[SIDES[1]], 2: t[SIDES[2]] };
  })();
  const sim = {
    rb,
    level,
    era,
    mode,
    nav,
    seed,
    rand: seeded(seed),
    time: 0,
    steps: 0,
    teams: sides,
    entities: new Map(),
    bolts: createBolts(),
    pending: [],
    events: [],
    score: { 1: { kills: 0, deaths: 0 }, 2: { kills: 0, deaths: 0 } },
    nextId: 1,
    out: null,
    brains: null,
  };
  let map = null;
  for (const team of [1, 2]) {
    const n = bots[team] ?? 0;
    if (!n) continue;
    map ??= mapOf(rb, level);
    const list = spawns?.[team] ?? openingSpawns(map, team, team === 1 ? 2 : 1);
    const classes = sides[team].classes;
    for (let k = 0; k < n; k++) {
      const sp = list[k % list.length];
      const at = sp ? [...sp.at] : [0, 0, 0];
      // a second lap of the spawns stands a metre or two off the first
      if (k >= list.length) {
        at[0] += (sim.rand() - 0.5) * 4;
        at[2] += (sim.rand() - 0.5) * 4;
      }
      addSoldier(sim, { team, classId: classes[k % classes.length], at, yaw: sp?.yaw ?? 0, bot: true });
    }
  }
  sim.brains = createBrains(sim);
  return sim;
}

function addSoldier(sim, { team, classId, at, yaw = 0, bot }) {
  const cls = classOf(sim.rb, classId);
  const id = `${bot ? 'b' : 'p'}${sim.nextId++}`;
  const spot = sim.nav ? nearestWalkable(sim.nav, at[0], at[2], 12) : null;
  const where = spot ? [spot[0], 0, spot[1]] : [...at];
  if (sim.nav) where[1] = heightOf(sim, where);
  const s = newSoldier(cls, { id, team, at: where, yaw, rand: sim.rand, bot, weapon: weaponOf(sim.rb, cls.weapon) });
  s.capsules = capsulesOf(s);
  sim.entities.set(id, s);
  return s;
}

const heightOf = (sim, at) => heightAt(sim.nav, at[0], at[2]);

export function addPlayer(sim, { team, classId, at, yaw = 0 }) {
  const s = addSoldier(sim, { team, classId, at, yaw, bot: false });
  sim.brains?.add?.(s);
  return s.id;
}

export function removeEntity(sim, id) {
  sim.entities.delete(id);
  sim.brains?.remove?.(id);
}

function emit(sim, e) {
  const ev = { t: Math.round(sim.time * 1000) / 1000, ...e };
  sim.events.push(ev);
  sim.out.push(ev);
}

// a direction turned by small yaw and pitch offsets (radians)
function jitter(dir, [dy, dp]) {
  const yaw = Math.atan2(dir[0], dir[2]) + dy;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) + dp;
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c];
}

export function muzzleOf(s) {
  const eye = eyeOf(s);
  return [eye[0] + Math.sin(s.yaw) * MUZZLE, eye[1] - 0.15, eye[2] + Math.cos(s.yaw) * MUZZLE];
}

// pull the trigger toward a point: the gun says whether and how many bolts, and when
export function shoot(sim, s, aim) {
  if (!s.alive || !s.gun || !aim) return false;
  const shots = fireGun(s.gun, sim.time, { stance: s.stance, moving: s.moving });
  if (!shots) return false;
  for (const shot of shots) sim.pending.push({ owner: s.id, at: shot.at, dir: shot.dir, aim: [...aim] });
  return true;
}

function release(sim) {
  const later = [];
  for (const p of sim.pending) {
    if (p.at > sim.time + 1e-9) {
      later.push(p);
      continue;
    }
    const s = sim.entities.get(p.owner);
    if (!s?.alive) continue;
    const from = muzzleOf(s);
    const d = [p.aim[0] - from[0], p.aim[1] - from[1], p.aim[2] - from[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const dir = jitter([d[0] / L, d[1] / L, d[2] / L], p.dir);
    const row = s.gun.row;
    fireBolt(sim.bolts, { from, dir, speed: row.firing?.speed ?? 700, range: row.range ?? 200, ttl: row.damage?.timeToLive ?? 3, team: s.team, owner: s.id, weapon: row, colour: row.colour, now: sim.time });
    emit(sim, { type: 'shot', by: s.id });
  }
  sim.pending = later;
}

function applyInput(sim, inp) {
  const s = sim.entities.get(inp.id);
  if (!s?.alive) return;
  if (inp.look != null) s.yaw = inp.look;
  if (inp.crouch != null) s.stance = inp.crouch ? 'crouch' : 'stand';
  s.sprint = !!inp.sprint;
  if (inp.roll && press(s.abilities, 0, sim.time).fired) roll(s, inp.move ?? [Math.sin(s.yaw), Math.cos(s.yaw)], sim.time);
  if (inp.ability) press(s.abilities, inp.ability, sim.time);
  if (inp.vent) vent(s.gun, sim.time);
  if (inp.cool) coolPress(s.gun, sim.time);
  if (s.state !== 'roll') move(s, inp.move ?? [0, 0], STEP, sim.nav);
  if (inp.fire) shoot(sim, s, inp.aim ?? chestAhead(s));
}

const chestAhead = (s) => {
  const c = chestOf(s);
  return [c[0] + Math.sin(s.yaw) * 100, c[1], c[2] + Math.cos(s.yaw) * 100];
};

function resolveBolts(sim) {
  const bodies = [];
  for (const s of sim.entities.values()) {
    if (!s.alive) continue;
    capsulesOf(s, s.capsules);
    bodies.push({ id: s.id, team: s.team, alive: true, at: s.at, capsules: s.capsules });
  }
  const evs = stepBolts(sim.bolts, STEP, { bodies, nav: sim.nav, now: sim.time });
  for (const e of evs) {
    if (e.type === 'hit') {
      const target = sim.entities.get(e.target);
      const damage = damageAt(e.bolt.weapon, e.dist);
      const r = hurt(target, { damage, part: e.part, by: e.bolt.owner, now: sim.time });
      emit(sim, { type: 'hit', by: e.bolt.owner, target: e.target, part: e.part, damage: Math.round(damage * 100) / 100 });
      if (r === 'down') {
        sim.score[target.team].deaths++;
        const killer = sim.entities.get(e.bolt.owner);
        if (killer && killer.team !== target.team) sim.score[killer.team].kills++;
        emit(sim, { type: 'kill', by: e.bolt.owner, target: e.target, part: e.part });
      }
    }
  }
  return evs;
}

export function step(sim, inputs = []) {
  sim.out = [];
  sim.time = Math.round((sim.time + STEP) * 1e6) / 1e6;
  sim.steps++;
  for (const inp of inputs) applyInput(sim, inp);
  stepBrains(sim);
  for (const s of sim.entities.values()) {
    if (s.state === 'roll' && s.alive) move(s, s.rollDir, STEP, sim.nav);
    for (const e of tickSoldier(s, STEP, sim.time)) emit(sim, { ...e, by: s.id });
  }
  release(sim);
  const raw = resolveBolts(sim);
  onEvents(sim, raw);
  return sim.out;
}

export function drain(sim) {
  const out = sim.events;
  sim.events = [];
  return out;
}

export function view(sim) {
  const v = (sim.view ??= { time: 0, teams: { 1: { alive: 0, dead: 0, kills: 0 }, 2: { alive: 0, dead: 0, kills: 0 } }, entities: [], bolts: [] });
  v.time = sim.time;
  for (const t of [1, 2]) {
    v.teams[t].alive = 0;
    v.teams[t].dead = 0;
    v.teams[t].kills = sim.score[t].kills;
  }
  let i = 0;
  for (const s of sim.entities.values()) {
    const e = (v.entities[i++] ??= {});
    v.teams[s.team][s.alive ? 'alive' : 'dead']++;
    e.id = s.id;
    e.team = s.team;
    e.kind = s.kind;
    e.at = s.at;
    e.yaw = s.yaw;
    e.hp = s.hp;
    e.hpMax = s.hpMax;
    e.state = s.state;
    e.stance = s.stance;
    e.moving = s.moving;
    e.aim = s.aim ?? null;
    e.firing = s.gun ? sim.time - s.gun.lastShot < 0.2 : false;
    e.heat = s.gun?.heat ?? 0;
    e.mode = s.brain?.intent?.mode ?? null;
  }
  v.entities.length = i;
  let k = 0;
  for (const b of sim.bolts.list) {
    const o = (v.bolts[k++] ??= {});
    o.at = b.at;
    o.dir = b.dir;
    o.colour = b.colour;
  }
  v.bolts.length = k;
  return v;
}
