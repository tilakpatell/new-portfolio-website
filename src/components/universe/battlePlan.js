// A galaxy battle's plan: the objectives the attacker has to take, in
// order, stage by stage, each stage open no sooner than its gate; the
// runners an evacuation or a blockade is decided by, launched on the
// battle's clock; and how fast the AI goes at it all (battleDirector.js
// runs a plan, battle.js lays its objectives out on the ships and fights
// over them). Pure: the same battle gets the same plan, for every pilot.
//
// The chain is the defender's flagship's (or an interdiction's
// Interdictor's): its two shield generators (the shield holds everything
// else off till they're down), its bridge, its reactor. Each stage is worth
// the same share of the battle whatever's in it (PLAN.stageHp: a thousand
// hp in all, the AI's work for its seeded tAi), and opens no sooner than
// PLAN.gates, so the shortest battle, however many pilots are in it, is
// about five minutes.
//
// What's in each stage is drawn from a menu (galaxy/battlePlans.js: for each
// kind of battle a few options a stage, and the films' own pinned where they
// were), seeded by 'plan-' and the battle's id, so every pilot gets the
// same plan and two battles of a kind needn't be alike; without a menu
// it's the classic chain. A drawn plan has side objectives too (bomber
// waves, aces) and a few of each side's escorts lost along the way, at
// seeded times (never the ships the objectives are on, nor the films' named
// ones: their set pieces have parts for them), and those a set piece loses
// at times of its own (the menus' `losses`: each with `by`, the piece's
// name, so the piece knows its own and plays them out when they fall).
//
// The runners launch at fixed seconds of the battle (not when you arrive):
// the last of them out by the clock, and the one that would decide it, if
// none were lost, out no sooner than 7:30, so neither side's runners have
// won it in the first minutes. The ones before that are out before the
// attacker's net has closed: the AI alone never finishes them (`safe`),
// though a pilot can.
//
// planFor({ id, kind, attacker, objectivesOn, runners, length, … }, menus)
//   → { id, kind, length, attacker, defender, ai: { tAi }, stages: [{ id,
//   type, need?, opensAt, shields?, why?, breaks?, crew?, interdicts?,
//   objectives: [{ id, type, kind, name, hp, on, … }] }], runners, side,
//   losses: [{ team, index, at, by? }], pinned, escalations: [{ type, at, id?,
//   team?, n?, name? }] }
// (`shields`: the objective ship's shield stands while the stage does;
// `why`: the battle's end, said, when the last stage goes; `breaks`: the
// objective ship breaks up when it does; `on`: where the objective is, a
// subsystem of the objective ship's ({ sub }), one of a ship's batteries
// ({ turret, ship }), a point by a ship ({ ship, at }: 'objective' or its
// place in the defender's line, `at` in shares of its length), a point in
// the battle ({ field: [toward the defender's line in its lines' lengths,
// across, toward the planet] }), on the planet below ({ planet }) or a set
// piece's own ({ piece }))
// `runners`: layBattle's ({ team, kind, size, hp, count, need, speed,
// route (its way, as points), from, to }), or null. runnerSchedule({ count, need, duration, length }) →
// { startAt, every }.

import { seededRand } from './battleKit';

export const PLAN = {
  length: 600,
  gates: [0, 150, 300], // the seconds each stage opens, at the soonest
  stageHp: [280, 300, 420], // what each stage is worth, in the AI's hp
  tAi: [540, 800], // the AI's pace (battleDirector.js), alone
  tAiRunners: [620, 900], // and slower where runners decide it too
  decideFrom: 450, // the soonest the runners decide it
  push: 480, // the final push (battleDirector.js's DIRECTOR.push): the AI's pressure steeper, its capital ships forward
  reserve: 6, // and the defender's reserve squadron put up
  // the share of a runner's hp the AI's fire would take, by seed (more than
  // all of it, often: it's down), by whose runners they are
  luck: { defender: [0.5, 2.4], attacker: [0.5, 3] },
};

// when the runners launch: the last out by the clock, the `need`th no sooner than PLAN.decideFrom
export function runnerSchedule({ count, need, duration, length = PLAN.length }) {
  const last = length - duration - 5;
  const first = Math.min(last, PLAN.decideFrom - duration + 5);
  const every = count > need ? Math.max(1, (last - first) / (count - need)) : 60;
  return { startAt: Math.max(0, last - (count - 1) * every), every };
}

const stage = (id, type, opensAt, objectives, more = {}) => ({ id, type, opensAt, objectives, ...more });
const sub = (id, kind, name, hp, type = 'destroy') => ({ id, type, kind, name, hp, on: { sub: id } });

// the flagship's chain (or the Interdictor's)
function chainOf(objectivesOn) {
  const [gens, bridge, reactor] = PLAN.stageHp;
  return [
    stage('shield', 'group', PLAN.gates[0], [sub('gen-port', 'shieldgen', 'Shield generator', gens / 2, 'group'), sub('gen-star', 'shieldgen', 'Shield generator', gens / 2, 'group')], { need: 2, shields: true }),
    stage('bridge', 'destroy', PLAN.gates[1], [sub('bridge', 'bridge', 'Bridge', bridge)]),
    stage('reactor', 'destroy', PLAN.gates[2], [sub('reactor', 'reactor', 'Reactor', reactor)], { why: objectivesOn === 'interdictor' ? 'interdictor' : 'flagship', breaks: true }),
  ];
}

// a few of each side's escorts lost along the way, at seeded times: not the
// ships the objectives are on, nor the ones with names (the films' ships:
// their set pieces have parts for them), nor the ones a set piece already
// loses (`taken`)
function lossesOf(c, stages, rand, length, taken = []) {
  const used = new Set();
  for (const s of stages) for (const o of s.objectives) if (typeof o.on?.ship === 'number') used.add(o.on.ship);
  const objective = c.objectivesOn === 'interdictor' ? c.capitals[c.defender].findIndex((x) => x.kind === 'interdictor') : 0;
  const gone = new Set(taken.map((l) => `${l.team}:${l.index}`));
  const out = [];
  for (const team of [0, 1]) {
    const free = (c.capitals[team] ?? []).map((cap, i) => ({ cap, i })).filter(({ cap, i }) => cap.role === 'escort' && !cap.name && !gone.has(`${team}:${i}`) && !(team === c.defender && (used.has(i) || i === objective)));
    const n = Math.min(Math.max(0, free.length - 1), Math.floor(rand() * 3));
    for (let k = 0; k < n; k++) {
      const [{ i }] = free.splice(Math.floor(rand() * free.length), 1);
      out.push({ team, index: i, at: Math.round(150 + rand() * (length - 160)) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// how long a way of points is
const lengthOf = (route) => route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - route[i][0], p[1] - route[i][1], p[2] - route[i][2]), 0);

function runnersOf(r, attacker, length) {
  if (!r) return null;
  const route = r.route ?? [r.from, r.to];
  const duration = lengthOf(route) / r.speed;
  const { startAt, every } = runnerSchedule({ count: r.count, need: r.need, duration, length });
  // (as the attacker sees them: their own to escort, or the defender's to stop)
  const type = r.team === attacker ? 'escort' : 'intercept';
  return { type, team: r.team, kind: r.kind, size: r.size, hp: r.hp, count: r.count, need: r.need, speed: r.speed, route, duration, startAt, every, luck: PLAN.luck[r.team === attacker ? 'attacker' : 'defender'], safe: r.need - 1 };
}

export function planFor(input, menus = null) {
  const { id, kind = 'assault', attacker = 0, objectivesOn = 'flagship', runners = null, length = PLAN.length } = input;
  const run = runnersOf(runners, attacker, length);
  const plan = { id, kind, length, attacker, defender: 1 - attacker, ai: { tAi: run ? PLAN.tAiRunners : PLAN.tAi }, stages: chainOf(objectivesOn), runners: run, side: [], losses: [], pinned: null, escalations: [] };
  if (!menus) {
    plan.escalations = escalationsOf(plan);
    return plan;
  }
  // drawn from the menu: a stage at a time, each from the options that fit
  const rand = seededRand(`plan-${id}`);
  const c = { ...input, attacker, defender: 1 - attacker, objectivesOn, length, rand };
  const menu = menus.pinned?.(c) ?? menus[kind] ?? menus.assault;
  plan.stages = menu.stages.map((options, index) => {
    const at = { ...c, index, budget: PLAN.stageHp[index], opensAt: PLAN.gates[index] };
    const fits = options.map((make) => make(at)).filter(Boolean);
    return { ...fits[Math.floor(rand() * fits.length)], opensAt: PLAN.gates[index] };
  });
  plan.side = menus.side?.(c) ?? [];
  // the ships a set piece loses at its own times (the superlaser's, at
  // Endor), then a few more along the way, unless the menu's pinned its own
  const pieces = c.capitals ? (menus.losses?.(c, plan.stages) ?? []) : [];
  plan.losses = menu.losses === false || !c.capitals ? pieces : [...pieces, ...lossesOf(c, plan.stages, rand, length, pieces)].sort((a, b) => a.at - b.at);
  plan.pinned = menu.id ?? null;
  plan.escalations = escalationsOf(plan);
  return plan;
}

// what the battle has in store, on its clock: the plan's bomber waves and
// aces, then the final push and the defender's reserve squadron with it
function escalationsOf(plan) {
  const side = plan.side.map((o) => ({ type: o.type, at: o.at, id: o.id, team: o.team, ...(o.name ? { name: o.name } : {}) }));
  const push = [
    { type: 'push', at: PLAN.push, name: 'the final push' },
    { type: 'reserve', at: PLAN.push, team: plan.defender, n: PLAN.reserve, name: 'their reserve squadron' },
  ];
  return [...side, ...push].filter((e) => e.at <= plan.length).sort((p, q) => p.at - q.at);
}
