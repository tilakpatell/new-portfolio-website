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
import { STEP, clock, muzzleOf, profile, shoot } from './core.js';
import { capsulesOf, chestOf, hurt, move, newSoldier, roll, tick as tickSoldier } from './soldier.js';
import { coolPress, damageAt, vent } from './weapons.js';
import { createBrains, onEvents, stepBrains } from './ai/bots.js';

export { STEP, THINK, SENSE, SQUAD, muzzleOf, shoot } from './core.js';

// The team a side plays: 1 the light side (Hoth's defending Rebels), 2 the dark (the attacking Empire).
const SIDES = { 1: 'light', 2: 'dark' };

// How far back from the front's middle each side opens: Hoth's front spawns
// overlap (the stages enable them by turns), so the opening keeps the sides
// apart, by hand, until lane 2's stages choose the spawns.
export const OPENING_GAP = 40;

// Each team's spawns for the opening: by priority, then nearest the middle of
// the front (between the two teams' enabled spawns nearest each other), only
// those on the team's own side and at least OPENING_GAP from the middle.
function openingSpawns(map) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const xz = (s) => [s.at[0], s.at[2]];
  const points = (team) => spawnsFor(map, { mode: 'galacticAssault', team }).filter((s) => s.at);
  const all = { 1: points(1), 2: points(2) };
  const live = (t) => (all[t].some((s) => s.enabled) ? all[t].filter((s) => s.enabled) : all[t]);
  let best = null;
  for (const a of live(1)) for (const b of live(2)) if (!best || d(xz(a), xz(b)) < best.d) best = { a, b, d: d(xz(a), xz(b)) };
  if (!best) return { 1: all[1], 2: all[2] };
  const mid = [(best.a.at[0] + best.b.at[0]) / 2, (best.a.at[2] + best.b.at[2]) / 2];
  const out = {};
  for (const [t, anchor] of [
    [1, best.a],
    [2, best.b],
  ]) {
    const side = [anchor.at[0] - mid[0], anchor.at[2] - mid[1]];
    const mine = all[t].filter((s) => (s.at[0] - mid[0]) * side[0] + (s.at[2] - mid[1]) * side[1] > 0 && d(xz(s), mid) >= OPENING_GAP);
    out[t] = (mine.length ? mine : all[t]).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || d(xz(a), mid) - d(xz(b), mid) || (a.id < b.id ? -1 : 1));
  }
  return out;
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
  const opening = spawns ?? (bots[1] || bots[2] ? openingSpawns(mapOf(rb, level)) : {});
  for (const team of [1, 2]) {
    const n = bots[team] ?? 0;
    if (!n) continue;
    const list = opening[team] ?? [];
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
  const t0 = clock();
  const evs = stepBolts(sim.bolts, STEP, { bodies, nav: sim.nav, now: sim.time });
  if (profile.on) profile.bolts += clock() - t0;
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
