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
// The runners launch at fixed seconds of the battle (not when you arrive):
// the last of them out by the clock, and the one that would decide it, if
// none were lost, out no sooner than 7:30, so neither side's runners have
// won it in the first minutes. The ones before that are out before the
// attacker's net has closed: the AI alone never finishes them (`safe`),
// though a pilot can.
//
// planFor({ id, kind, attacker, objectivesOn, runners, length }) → { id,
//   kind, length, attacker, defender, ai: { tAi }, stages: [{ id, type,
//   need?, opensAt, shields?, why?, breaks?, objectives: [{ id, type, kind,
//   hp, on }] }], runners, side: [], losses: [] }
// (`shields`: the objective ship's shield stands while the stage does;
// `why`: the battle's end, said, when the last stage goes; `breaks`: the
// objective ship breaks up when it does; `on`: where the objective is, a
// subsystem of the objective ship's ({ sub }))
// `runners`: layBattle's ({ team, kind, size, hp, count, need, speed,
// route (its way, as points), from, to }), or null. runnerSchedule({ count, need, duration, length }) →
// { startAt, every }.

export const PLAN = {
  length: 600,
  gates: [0, 150, 300], // the seconds each stage opens, at the soonest
  stageHp: [280, 300, 420], // what each stage is worth, in the AI's hp
  tAi: [540, 800], // the AI's pace (battleDirector.js), alone
  tAiRunners: [620, 900], // and slower where runners decide it too
  decideFrom: 450, // the soonest the runners decide it
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
const sub = (id, kind, hp) => ({ id, type: 'destroy', kind, hp, on: { sub: id } });

// the flagship's chain (or the Interdictor's)
function chainOf(objectivesOn) {
  const [gens, bridge, reactor] = PLAN.stageHp;
  return [
    stage('shield', 'group', PLAN.gates[0], [sub('gen-port', 'shieldgen', gens / 2), sub('gen-star', 'shieldgen', gens / 2)], { need: 2, shields: true }),
    stage('bridge', 'destroy', PLAN.gates[1], [sub('bridge', 'bridge', bridge)]),
    stage('reactor', 'destroy', PLAN.gates[2], [sub('reactor', 'reactor', reactor)], { why: objectivesOn === 'interdictor' ? 'interdictor' : 'flagship', breaks: true }),
  ];
}

// how long a way of points is
const lengthOf = (route) => route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - route[i][0], p[1] - route[i][1], p[2] - route[i][2]), 0);

function runnersOf(r, attacker, length) {
  if (!r) return null;
  const route = r.route ?? [r.from, r.to];
  const duration = lengthOf(route) / r.speed;
  const { startAt, every } = runnerSchedule({ count: r.count, need: r.need, duration, length });
  return { team: r.team, kind: r.kind, size: r.size, hp: r.hp, count: r.count, need: r.need, speed: r.speed, route, duration, startAt, every, luck: PLAN.luck[r.team === attacker ? 'attacker' : 'defender'], safe: r.need - 1 };
}

export function planFor({ id, kind = 'assault', attacker = 0, objectivesOn = 'flagship', runners = null, length = PLAN.length }) {
  const run = runnersOf(runners, attacker, length);
  return {
    id,
    kind,
    length,
    attacker,
    defender: 1 - attacker,
    ai: { tAi: run ? PLAN.tAiRunners : PLAN.tAi },
    stages: chainOf(objectivesOn),
    runners: run,
    side: [],
    losses: [],
  };
}
