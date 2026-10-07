import { describe, expect, it } from 'vitest';
import { BATTLE, createBattle } from './battle';
import { seededRand } from './battleKit';
import { createDirector } from './battleDirector';
import { planFor } from './battlePlan';
import { WARS } from './wars';

// a battle with the galaxy's shared director: its plan, and the director's
// state at a second `clock.t` of the shared clock, from a tally `values`
const shared = ({ kind = 'assault', runners = null, perSide = 6 } = {}) => {
  const plan = planFor({ id: 'test.battle', kind, attacker: 0, runners });
  const d = createDirector({ plan, seed: plan.id });
  const values = new Map();
  const clock = { t: 60 };
  const told = [];
  const b = createBattle({
    war: WARS.starwars,
    attacker: 0,
    perSide,
    rand: seededRand('stages'),
    tickets: false,
    plan,
    director: { state: () => d.state(clock.t, (k) => values.get(k) ?? 0) },
    onMine: (id, dmg) => {
      told.push([id, dmg]);
      values.set(id, (values.get(id) ?? 0) + dmg);
    },
  });
  return { b, d, plan, values, clock, told };
};
const run = (b, seconds, dt = 1 / 30) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...b.update(dt, null));
  return events;
};
const objOf = (b) => b.capitals.find((c) => c.objective);
const shotAt = (b, p, damage = 1) => b.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);

describe('a battle the galaxy’s director runs', () => {
  it('takes its objectives’ hp, its stage and its shield from the director', () => {
    const { b, values, clock } = shared();
    run(b, 0.1);
    const subs = objOf(b).subs;
    const gen = subs.find((s) => s.id === 'gen-port');
    expect(gen.hpMax).toBe(140);
    expect(gen.hp).toBeLessThan(140); // (the AI's pressure, a minute in)
    expect(b.phase).toBe(1);
    values.set('gen-port', 500);
    values.set('gen-star', 500);
    const events = run(b, 0.1);
    expect(events.some((e) => e.type === 'shield' && e.down)).toBe(true);
    expect(events.some((e) => e.type === 'sub' && e.sub === 'gen-star' && !e.mine)).toBe(true);
    expect(b.phase).toBe(2);
    // (the bridge's stage behind its gate till 2:30: not to be shot yet)
    expect(b.stageOpen).toBe(false);
    expect(b.opensIn).toBeCloseTo(90, 6);
    clock.t = 150;
    run(b, 0.1);
    expect(b.stageOpen).toBe(true);
  });

  it('counts your hit once, a punch of the chain’s hp (not youShare), and tells it', () => {
    const { b, told } = shared();
    b.setYou(0);
    run(b, 0.1);
    const gen = objOf(b).subs.find((s) => s.id === 'gen-port');
    const hp = gen.hp;
    shotAt(b, gen.pos, 2);
    expect(told).toEqual([['gen-port', 2]]);
    expect(hp - gen.hp).toBeCloseTo(2, 6);
  });

  it('lets nobody shoot a stage that isn’t open: behind its gate, its objectives are shielded', () => {
    const { b, values, told } = shared();
    b.setYou(0);
    values.set('gen-port', 500);
    values.set('gen-star', 500);
    run(b, 0.1);
    const bridge = objOf(b).subs.find((s) => s.id === 'bridge');
    shotAt(b, bridge.pos, 3);
    expect(told).toEqual([]);
    expect(b.targets.some((t) => t.sub === 'bridge')).toBe(false);
  });

  it('only lights the objectives up with the AI’s torpedoes: the AI’s part in them is the director’s', () => {
    const { b } = shared({ perSide: 0 });
    run(b, 0.1);
    const gen = objOf(b).subs.find((s) => s.id === 'gen-port');
    const hp = gen.hp;
    b.fire(0, { x: gen.pos.x, y: gen.pos.y + 3, z: gen.pos.z }, { x: 0, y: -1, z: 0 }, 'torpedo');
    const events = run(b, 1);
    expect(gen.hp).toBe(hp);
    expect(events.some((e) => e.type === 'impact')).toBe(true);
  });

  it('never sinks a capital ship to the AI’s fire: it goes when the director says', () => {
    const { b } = shared({ perSide: 0 });
    const esc = b.capitals.find((c) => c.team === 1 && c.role === 'escort');
    const sp = esc.spheres[0].c;
    esc.hull = 2;
    for (let i = 0; i < 40; i++) b.fire(0, { x: sp.x, y: sp.y + 3, z: sp.z }, { x: 0, y: -1, z: 0 }, 'torpedo') && run(b, 0.2);
    expect(esc.hull).toBeGreaterThan(0);
    expect(esc.alive).toBe(true);
    expect(esc.dying).toBe(0);
  });

  it('never ends itself: no clock, ticket, flagship or runner end, only when it’s told (end)', () => {
    const { b, clock } = shared({ perSide: 2, runners: { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 2, need: 1, speed: 40, from: [60, 0, 0], to: [60, 0, -40] } });
    b.teams[0].tickets = 0;
    for (const f of b.fighters) if (f.team === 0) (f.alive = false), (f.respawn = Infinity);
    flag(b).hull = 1;
    clock.t = 700;
    run(b, BATTLE.clock - b.clock + 5, 0.1);
    expect(b.over).toBeNull();
    b.end(1, 'clock');
    expect(b.over).toEqual({ winner: 1, why: 'clock' });
  });

  it('breaks the objective ship up when the director says the chain’s done', () => {
    const { b, values, clock } = shared({ perSide: 0 });
    for (const id of ['gen-port', 'gen-star', 'bridge', 'reactor']) values.set(id, 1e4);
    clock.t = 300;
    run(b, 0.2);
    expect(objOf(b).dying).toBeGreaterThan(0);
    const events = run(b, BATTLE.dying + 1, 0.1);
    expect(events.some((e) => e.type === 'capital' && e.id === objOf(b).id)).toBe(true);
    expect(b.over).toBeNull();
  });
});
const flag = (b) => b.capitals.find((c) => c.team === b.attacker && c.role === 'flagship');

describe('the director’s runners in the battle', () => {
  // a way 160 long: 60 to the corner, then 100 on
  const runners = { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 4, need: 3, speed: 10, route: [[60, 0, 0], [0, 0, 0], [0, 0, -100]], from: [60, 0, 0], to: [0, 0, -100] };
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  const slot = (b, i) => b.runners.find((r) => r.slot === i);

  it('flies each from its launch along its way, where the shared clock has it, whenever you came', () => {
    const { b, plan, clock } = shared({ runners, perSide: 0 });
    const R = plan.runners;
    expect(R.duration).toBeCloseTo(16, 6);
    clock.t = R.startAt - 1;
    run(b, 0.1);
    expect(b.runners).toHaveLength(0);
    clock.t = R.startAt + R.duration / 2;
    run(b, 0.1);
    const r = slot(b, 0);
    expect(r.alive).toBe(true);
    expect(dist(r.pos, { x: 0, y: 0, z: -20 })).toBeLessThan(10);
  });

  it('lets one go when the director says it’s out, and loses one it says is down', () => {
    const { b, plan, clock, values } = shared({ runners, perSide: 0 });
    const R = plan.runners;
    clock.t = R.startAt + 4;
    run(b, 0.1);
    clock.t = R.startAt + R.duration + 1;
    let events = run(b, 0.1);
    expect(events.some((e) => e.type === 'escaped' && e.id === slot(b, 0).id)).toBe(true);
    expect(slot(b, 0).escaped).toBe(true);
    clock.t = R.startAt + R.every + 4;
    run(b, 0.1);
    values.set('r:1', 99);
    events = run(b, 0.1);
    expect(events.some((e) => e.type === 'runner' && e.id === slot(b, 1).id && !e.mine)).toBe(true);
    expect(slot(b, 1).alive).toBe(false);
  });

  it('counts your shots on one of the other side’s for the tally, and takes it down when the director says that’s enough', () => {
    const { b, plan, clock, told } = shared({ runners, perSide: 0 });
    b.setYou(0);
    clock.t = plan.runners.startAt + 4;
    run(b, 0.1);
    const r = slot(b, 0);
    for (let i = 0; i < 20 && r.alive; i++) shotAt(b, r.seen, 5);
    expect(told[0]).toEqual(['r:0', 5]);
    expect(r.alive).toBe(false);
    expect(run(b, 0.05).some((e) => e.type === 'runner' && e.id === r.id && e.mine)).toBe(true);
  });

  it('only lights a runner up with the AI’s fire: its fate is the director’s', () => {
    const { b, plan, clock } = shared({ runners, perSide: 0 });
    clock.t = plan.runners.startAt + 4;
    run(b, 0.1);
    const r = slot(b, 0);
    const hp = r.hp;
    b.fire(0, { x: r.pos.x, y: r.pos.y + 3, z: r.pos.z }, { x: 0, y: -1, z: 0 }, 'laser');
    run(b, 0.2);
    expect(r.hp).toBe(hp);
  });

  it('shows a pilot arriving late the runners one there from the start has: the ones still flying, as far along, as worn', () => {
    const from = shared({ runners, perSide: 0 });
    const T = from.plan.runners.startAt + from.plan.runners.every + 6;
    for (let t = 0; t <= T; t += 1) {
      from.clock.t = t;
      run(from.b, 1 / 30);
    }
    const late = shared({ runners, perSide: 0 });
    late.clock.t = T;
    run(late.b, 1 / 30);
    const flying = (b) => b.runners.filter((r) => r.alive).map((r) => [r.slot, +r.hp.toFixed(6), ...[r.pos.x, r.pos.y, r.pos.z].map((x) => +x.toFixed(6))]);
    expect(flying(late.b)).toEqual(flying(from.b));
    expect(flying(late.b)).toHaveLength(1);
  });
});
