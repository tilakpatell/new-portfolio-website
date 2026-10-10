// The battle with the player alone: lane 1's `createSim` interface
// (docs/superpowers/plans/2026-10-10-battlefront-lane1-soldier-ai.md, Task 6;
// lane 2's view gains: mode, deploy, points, oob), standing in until
// src/lib/battlefront/sim.js lands on main. No bots, no hits: the player
// deploys from the deploy screen at a spawn of the stage's attack or defend
// set, walks the ground at the soldier row's speeds and fires the class's
// blaster with the weapon row's heat. Replaced whole when lane 1 merges
// (BattlefrontWorld takes `createSim` from one import).
//
//   createSim({ rulebook, soldier, level, mode, seed, heightAt, bots }) → sim
//   addPlayer(sim, { team }) → id ; deploy(sim, id, { classId }) → { ok, why? }
//   step(sim, inputs) → events ; view(sim) → the one view object, mutated

import { classOf, mapOf, pointsOf, stagesOf, stringOf, teamsFor, weaponOf } from '../../lib/battlefront/rulebook.js';
import { speedFor } from '../../lib/physics/soldier.js';

export const STEP = 0.05; // s: the sim's fixed step (the game design's 20 Hz)
const BOLT_LIFE = 1.5; // s a bolt is drawn

const SIDES = { 1: 'light', 2: 'dark' };

// the stage's spawn polygons for a side, their points' middle (the sim's
// spawn.js picks inside them; the stub takes the first's centre)
function spawnFor(map, stage, team, attackers) {
  const side = SIDES[team] === attackers ? 'attack' : 'defend';
  const ids = stage?.spawns?.[side] ?? [];
  for (const id of ids) {
    const p = (map.polygons ?? []).find((q) => q.id === id);
    if (p?.points?.length) {
      const [x, z] = p.points.reduce((a, b) => [a[0] + b[0] / p.points.length, a[1] + b[1] / p.points.length], [0, 0]);
      const s = (map.spawns ?? []).filter((q) => q.team === team).sort((a, b) => Math.hypot(a.at[0] - x, a.at[2] - z) - Math.hypot(b.at[0] - x, b.at[2] - z))[0];
      return s ? { at: s.at.slice(), yaw: s.yaw } : { at: [x, 0, z], yaw: 0 };
    }
  }
  const s = (map.spawns ?? []).filter((q) => q.team === team && q.mode === 'galacticAssault').sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  return s ? { at: s.at.slice(), yaw: s.yaw } : { at: [0, 0, 0], yaw: 0 };
}

const centreOf = (map, id) => {
  const v = (map.volumes ?? []).find((q) => q.id === id);
  if (!v) return null;
  const n = v.points.length;
  const [x, z] = v.points.reduce((a, b) => [a[0] + b[0] / n, a[1] + b[1] / n], [0, 0]);
  return [x, v.y, z];
};

export function createSim({ rulebook, soldier, level = 'hoth', mode = 'galacticAssault', seed = 1, heightAt = () => 0 } = {}) {
  const map = mapOf(rulebook, level);
  const ga = stagesOf(rulebook, level, mode);
  const teams = teamsFor(rulebook, level);
  const points = pointsOf(rulebook);
  const stage = ga?.stages?.[0] ?? null;
  let letter = 0;
  const objectives = (stage?.objectives ?? [])
    .filter((o) => o.volume)
    .map((o) => {
      const at = centreOf(map, o.volume);
      return at ? { id: o.volume, type: o.type, name: String.fromCharCode(65 + letter++), meter: 0, at } : null;
    })
    .filter(Boolean);
  const sim = {
    rulebook,
    soldier,
    map,
    ga,
    stage,
    seed,
    time: 0,
    heightAt,
    entities: new Map(),
    bolts: [],
    events: [],
    points: 0,
    next: 1,
    result: null,
    objectives,
    teams,
    pointsBook: points,
    force(what, team) {
      if (what === 'win' || what === 'lose') sim.result = { winner: what === 'win' ? team : 3 - team, why: 'forced' };
    },
  };
  sim.out = {
    time: 0,
    entities: [],
    bolts: [],
    teams: { 1: { alive: 0, dead: 0, kills: 0 }, 2: { alive: 0, dead: 0, kills: 0 } },
    mode: null,
    deploy: { open: false, offers: [], team: 2, timeLeft: 0 },
    points: 0,
    oob: null,
    player: null,
    killLog: [],
    scoreboard: {},
  };
  return sim;
}

export function addPlayer(sim, { team = 2 } = {}) {
  const id = sim.next++;
  sim.entities.set(id, { id, team, kind: 'soldier', player: true, state: 'deploying', at: [0, 0, 0], yaw: 0, vel: [0, 0], stance: 'stand', hp: 0, hpMax: 0, heat: 0, overheated: false, coolUntil: 0, lastShot: -Infinity, weapon: null, cls: null, t: 0 });
  sim.player = id;
  return id;
}

function offers(sim, team) {
  const side = sim.teams[SIDES[team]];
  const cost = sim.pointsBook.cost;
  return [
    ...side.classes.map((id) => ({ kind: 'class', id, cls: classOf(sim.rulebook, id).cls, cost: 0 })),
    ...(side.reinforcements ?? []).map((id) => ({ kind: 'reinforcement', id, reinforcementKind: sim.rulebook.reinforcements[id]?.kind, cost: cost[sim.rulebook.reinforcements[id]?.kind] ?? 0 })),
    ...(side.heroes ?? []).map((id) => ({ kind: 'hero', id, cost: cost.heroes?.[id] ?? cost.heroes?.default ?? 0 })),
  ];
}

export function deploy(sim, id, { classId } = {}) {
  const e = sim.entities.get(id);
  if (!e || e.state !== 'deploying') return { ok: false, why: 'not deploying' };
  const side = sim.teams[SIDES[e.team]];
  const cls = classId && side.classes.includes(classId) ? classId : side.classes[0];
  if (classId && classId !== cls) return { ok: false, why: 'not on offer here' };
  const row = classOf(sim.rulebook, cls);
  const { at, yaw } = spawnFor(sim.map, sim.stage, e.team, sim.ga?.attackers);
  at[1] = sim.heightAt(at[0], at[2]);
  Object.assign(e, { state: 'alive', at, yaw, cls, hp: row.health, hpMax: row.health, weapon: row.weapon, heat: 0, overheated: false });
  return { ok: true };
}

export function step(sim, inputs = []) {
  const events = [];
  for (const inp of inputs) {
    const e = sim.entities.get(inp.id);
    if (!e || e.state !== 'alive') continue;
    if (inp.yaw != null) e.yaw = inp.yaw;
    const move = inp.move ?? [0, 0];
    e.stance = inp.crouch ? 'crouch' : 'stand';
    const len = Math.hypot(move[0], move[1]);
    const speed = len > 0 ? speedFor(sim.soldier, { pose: e.stance, sprint: Boolean(inp.sprint) && move[1] > 0, dir: { x: move[0], y: move[1] } }) : 0;
    // (the stick's x is to the right: −X at yaw 0, +Y up and +Z ahead)
    const s = Math.sin(e.yaw);
    const c = Math.cos(e.yaw);
    const k = len > 1 ? 1 / len : 1;
    const vx = (move[1] * s - move[0] * c) * k * speed;
    const vz = (move[1] * c + move[0] * s) * k * speed;
    e.vel = [vx, vz];
    e.at[0] += vx * STEP;
    e.at[2] += vz * STEP;
    e.at[1] = sim.heightAt(e.at[0], e.at[2]);
    e.aim = Boolean(inp.aim);
    fire(sim, e, inp, events);
    e.t = sim.time + STEP;
  }
  sim.time += STEP;
  sim.bolts = sim.bolts.filter((b) => sim.time - b.t < BOLT_LIFE);
  for (const b of sim.bolts) b.at = b.at.map((v, i) => v + b.dir[i] * b.speed * STEP);
  sim.events.push(...events);
  return events;
}

// The weapon row's heat: each bolt adds `perBullet`; past `threshold` the
// rifle overheats and cools for `penalty` s; idle it drops `dropPerSecond`
// (a vent, R, empties it over `cooling.vent` s)
function fire(sim, e, inp, events) {
  const w = weaponOf(sim.rulebook, e.weapon);
  const h = w.heat;
  if (!h) return;
  const interval = 60 / (w.firing?.rof ?? 300);
  if (e.overheated && sim.time >= e.coolUntil) {
    e.overheated = false;
    e.heat = 0;
  }
  if (inp.vent && !e.overheated && e.heat > (h.cooling?.minHeat ?? 0)) {
    e.overheated = true;
    e.coolUntil = sim.time + (h.cooling?.vent ?? 1);
  }
  if (inp.fire && !e.overheated && sim.time - e.lastShot >= interval) {
    e.lastShot = sim.time;
    e.heat = Math.min(1, e.heat + h.perBullet);
    const dir = [Math.sin(e.yaw) * Math.cos(inp.pitch ?? 0), Math.sin(inp.pitch ?? 0), Math.cos(e.yaw) * Math.cos(inp.pitch ?? 0)];
    sim.bolts.push({ at: [e.at[0], e.at[1] + 1.4, e.at[2]], dir, speed: w.firing?.speed ?? 300, colour: w.colour ?? 'red', t: sim.time, by: e.id });
    events.push({ type: 'fire', id: e.id });
    if (e.heat >= h.threshold) {
      e.overheated = true;
      e.coolUntil = sim.time + (h.penalty ?? 3);
      events.push({ type: 'overheat', id: e.id });
    }
  } else if (!inp.fire && !e.overheated && sim.time - e.lastShot > 0.2) {
    e.heat = Math.max(0, e.heat - (h.dropPerSecond ?? 0.3) * STEP);
  }
  e.warning = h.warning;
  e.coolWindow = h.cooling?.window ? [...h.cooling.window].sort((a, b) => a - b) : null;
}

export function view(sim) {
  const v = sim.out;
  v.time = sim.time;
  v.entities.length = 0;
  for (const e of sim.entities.values()) v.entities.push(e);
  v.bolts = sim.bolts;
  const p = sim.entities.get(sim.player) ?? null;
  v.player = p && { ...p, warning: p.warning ?? 0.75 };
  v.deploy.open = p?.state === 'deploying';
  v.deploy.team = p?.team ?? 2;
  v.deploy.offers = p ? offers(sim, p.team) : [];
  v.points = sim.points;
  const attacking = p ? SIDES[p.team] === sim.ga?.attackers : true;
  v.mode = sim.stage ? { stage: 0, stageName: stringOf(sim.rulebook, attacking ? sim.stage.name : sim.stage.nameDefend), objectives: sim.objectives, tickets: sim.stage.tickets ?? null, result: sim.result } : null;
  for (const t of [1, 2]) v.teams[t].alive = [...sim.entities.values()].filter((e) => e.team === t && e.state === 'alive').length;
  v.scoreboard = Object.fromEntries(
    [1, 2].map((t) => [t, { name: SIDES[t] === 'dark' ? 'EMPIRE' : 'REBELS', rows: [...sim.entities.values()].filter((e) => e.team === t).map((e) => ({ id: e.id, name: e.player ? 'You' : `Trooper ${e.id}`, kills: 0, deaths: 0, points: 0 })) }]),
  );
  return v;
}
