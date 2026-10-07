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

describe('a plan’s objectives in the battle', () => {
  // a plan of every kind of place an objective can be: four satellites round
  // the objective ship (three to take), two of its batteries, a relay to
  // hold over it, a platform out in the field, a cannon on the planet below,
  // the droid control relay, and its reactor
  const PLANET = { at: [0, -400, 0], r: 300 };
  const sat = (n, at) => ({ id: `sat-${n}`, type: 'group', kind: 'satellite', name: 'Shield projector', hp: 90, r: 1, on: { ship: 'objective', at } });
  const plan = (o = {}) => ({
    id: 'every.place',
    kind: 'assault',
    length: 600,
    attacker: 0,
    defender: 1,
    ai: { tAi: [5000, 5001] },
    stages: [
      { id: 'satellites', type: 'group', need: 3, shields: true, opensAt: 0, objectives: [sat(0, [-0.3, 0.3, 0.25]), sat(1, [0.3, 0.3, -0.25]), sat(2, [-0.3, -0.26, -0.25]), sat(3, [0.3, -0.26, 0.25])] },
      { id: 'batteries', type: 'group', need: 2, opensAt: 0, interdicts: true, objectives: [0, 3].map((t, j) => ({ id: `battery-${j}`, type: 'group', kind: 'battery', name: 'Turbolaser battery', hp: 40, on: { turret: t, ship: 'objective' } })) },
      { id: 'relay', type: 'zone', opensAt: 0, objectives: [{ id: 'relay', type: 'zone', kind: 'relay', name: 'the comms relay', hp: 100, hold: 20, zone: 12, on: { ship: 'objective', at: [0, 0.42, -0.1] } }] },
      { id: 'field', type: 'group', need: 2, opensAt: 0, objectives: [{ id: 'plat-0', type: 'group', kind: 'platform', name: 'Orbital defence platform', hp: 50, r: 3, on: { field: [0.5, 20, 24] } }, { id: 'cannon', type: 'group', kind: 'cannon', name: 'the planetary ion cannon', hp: 50, r: 2.4, on: { planet: 1.5 } }] },
      { id: 'droids', type: 'destroy', opensAt: 0, objectives: [{ id: 'droid-relay', type: 'destroy', kind: 'droidrelay', name: 'the droid control relay', hp: 60, on: { ship: 'objective', at: [0, 0.26, 0.08] }, effect: { freeze: 30 } }] },
      { id: 'reactor', type: 'destroy', opensAt: 0, breaks: true, objectives: [{ id: 'reactor', type: 'destroy', kind: 'reactor', name: 'Reactor', hp: 100, on: { sub: 'reactor' } }] },
    ],
    runners: null,
    side: [],
    losses: [],
    ...o,
  });
  const droidWar = { ...WARS.starwars, sides: [WARS.starwars.sides[0], { ...WARS.starwars.sides[1], fighters: [{ kind: 'vulture', role: 'fighter', weight: 3 }, { kind: 'tie', role: 'fighter', weight: 1 }] }] };
  const laid = (p, { war = WARS.starwars, perSide = 4, clock = { t: 10 } } = {}) => {
    const d = createDirector({ plan: p, seed: p.id });
    const values = new Map();
    const told = [];
    const b = createBattle({
      war,
      attacker: 0,
      perSide,
      rand: seededRand('places'),
      tickets: false,
      planet: PLANET,
      plan: p,
      director: { state: () => d.state(clock.t, (k) => values.get(k) ?? 0) },
      ace: p.side.some((o) => o.type === 'ace') ? { 1: { kind: 'tieadvanced', name: 'Darth Vader', hp: 64 } } : {},
      onMine: (id, dmg) => {
        told.push([id, dmg]);
        values.set(id, (values.get(id) ?? 0) + dmg);
      },
    });
    return { b, d, values, told, clock };
  };
  const byKey = (b, key) => b.objectives.find((o) => o.key === key);
  const inHull = (b, p) => b.capitals.some((c) => c.spheres.some((sp) => Math.hypot(p.x - sp.c.x, p.y - sp.c.y, p.z - sp.c.z) < sp.r));

  it('lays each where the plan has it: by the objective ship, on its batteries, out in the field, on the planet below', () => {
    const { b } = laid(plan());
    const ship = objOf(b);
    for (let n = 0; n < 4; n++) {
      const o = byKey(b, `sat-${n}`);
      expect(o.free).toBe(true);
      expect(inHull(b, o.pos), o.key).toBe(false);
      expect(Math.hypot(o.pos.x - ship.pos.x, o.pos.y - ship.pos.y, o.pos.z - ship.pos.z)).toBeLessThan(ship.size * 0.6);
    }
    expect(byKey(b, 'battery-1')).toBe(ship.turrets[3]);
    expect(byKey(b, 'relay').zone).toBe(12);
    const plat = byKey(b, 'plat-0');
    // (half the way from the middle to the defender's line, 20 across, 24 toward the planet)
    expect(plat.pos.x).toBeCloseTo(0.5 * b.lines, 6);
    expect(plat.pos.y).toBeLessThan(-20);
    const cannon = byKey(b, 'cannon');
    expect(Math.hypot(cannon.pos.x - PLANET.at[0], cannon.pos.y - PLANET.at[1], cannon.pos.z - PLANET.at[2])).toBeCloseTo(PLANET.r + 1.5, 6);
    // (the subsystems the plan doesn't use aren't there to shoot)
    expect(ship.subs.find((s) => s.id === 'gen-port').hidden).toBe(true);
  });

  it('moves what’s laid by a ship with it', () => {
    const { b } = laid(plan());
    const o = byKey(b, 'sat-0');
    const was = { ...o.pos };
    b.moveCapital(objOf(b), { x: 3, y: 0, z: -2 });
    expect(o.pos.x - was.x).toBeCloseTo(3, 9);
    expect(o.pos.z - was.z).toBeCloseTo(-2, 9);
  });

  it('counts your shots on a satellite or a planned battery for the tally, and puts the next stage’s off till it’s open', () => {
    const { b, told } = laid(plan());
    b.setYou(0);
    run(b, 0.1);
    const s0 = byKey(b, 'sat-0');
    const h = shotAt(b, s0.pos, 2);
    expect(h).toMatchObject({ sub: 'sat-0' });
    expect(told).toEqual([['sat-0', 2]]);
    // (the batteries are the next stage's: a shot on one only lands)
    const tu = byKey(b, 'battery-0');
    const before = tu.hp;
    const h2 = b.hit({ x: tu.at.x, y: tu.at.y + 2, z: tu.at.z }, { x: tu.at.x, y: tu.at.y - 0.01, z: tu.at.z }, 3);
    expect(h2?.shield).toBe(true);
    expect(tu.hp).toBe(before);
    expect(tu.alive).toBe(true);
    // the satellites down, the batteries are: shot out through the tally, not their own few hits
    for (let n = 0; n < 3; n++) for (let i = 0; i < 60 && byKey(b, `sat-${n}`).alive; i++) shotAt(b, byKey(b, `sat-${n}`).pos, 3);
    run(b, 0.1);
    expect(b.phase).toBe(2);
    for (let i = 0; i < 40 && tu.alive; i++) b.hit({ x: tu.at.x, y: tu.at.y + 2, z: tu.at.z }, { x: tu.at.x, y: tu.at.y - 0.01, z: tu.at.z }, 3);
    expect(tu.alive).toBe(false);
    expect(told.filter(([k]) => k === 'battery-0').length).toBeGreaterThan(6);
  });

  it('locks on to the open stage’s objectives, never a zone', () => {
    const { b, values } = laid(plan());
    b.setYou(0);
    run(b, 0.1);
    expect(b.targets.filter((t) => t.sub?.startsWith('sat-'))).toHaveLength(4);
    for (const k of ['sat-0', 'sat-1', 'sat-2', 'battery-0', 'battery-1']) values.set(k, 999);
    run(b, 0.1);
    expect(b.phase).toBe(3);
    expect(b.targets.some((t) => t.sub === 'relay')).toBe(false);
  });

  it('says the battle’s interdicted while a stage that interdicts stands', () => {
    const { b, values } = laid(plan());
    run(b, 0.1);
    expect(b.interdicted).toBe(true);
    for (const k of ['sat-0', 'sat-1', 'sat-2', 'battery-0', 'battery-1']) values.set(k, 999);
    run(b, 0.1);
    expect(b.interdicted).toBe(false);
  });

  it('stops the defender’s droid fighters dead for half a minute when the droid control relay falls', () => {
    const { b, values } = laid(plan(), { war: droidWar, perSide: 8 });
    run(b, 0.2);
    const droids = b.fighters.filter((f) => f.team === 1 && f.kind === 'vulture' && f.alive);
    expect(droids.length).toBeGreaterThan(0);
    for (const k of ['sat-0', 'sat-1', 'sat-2', 'battery-0', 'battery-1', 'plat-0', 'cannon', 'droid-relay']) values.set(k, 999);
    values.set('relay:a', 999);
    run(b, 0.1);
    for (const f of droids) expect(f.frozen, f.id).toBeGreaterThan(29);
    expect(b.fighters.filter((f) => f.team === 1 && f.kind === 'tie').every((f) => !f.frozen)).toBe(true);
    // (dead in space: drifting on as they were, after nothing, firing at nothing)
    const heading = droids.map((f) => ({ ...f.fwd }));
    run(b, 1);
    droids.forEach((f, i) => {
      expect(f.target).toBeNull();
      expect(Math.hypot(f.fwd.x - heading[i].x, f.fwd.y - heading[i].y, f.fwd.z - heading[i].z)).toBeLessThan(1e-9);
    });
  });

  it('flies an ace from the director’s time, its hull the director’s: the AI can’t bring it down, the pilots can', () => {
    const p = plan({ side: [{ id: 'ace-1', type: 'ace', team: 1, at: 240, hp: 64, kind: 'tieadvanced', name: 'Darth Vader' }] });
    const clock = { t: 100 };
    const { b, told } = laid(p, { clock });
    run(b, 0.1);
    const ace = b.fighters.find((f) => f.ace);
    expect(ace.alive).toBe(false);
    clock.t = 241;
    const events = run(b, 0.1);
    expect(ace.alive).toBe(true);
    expect(events.some((e) => e.type === 'arrive' && e.team === 1)).toBe(true);
    expect(ace.hp).toBe(64);
    b.fire(0, { x: ace.pos.x, y: ace.pos.y + 1, z: ace.pos.z }, { x: 0, y: -1, z: 0 }, 'laser');
    run(b, 0.05);
    expect(ace.hp).toBe(64);
    b.setYou(0);
    for (let i = 0; i < 80 && ace.alive; i++) shotAt(b, ace.seen, 1);
    expect(told.filter(([k]) => k === 'ace:1').length).toBe(64);
    expect(ace.alive).toBe(false);
    expect(run(b, 0.05).some((e) => e.type === 'down' && e.ace && e.mine)).toBe(true);
  });

  it('launches a bomber wave when the director says, its bombers told apart, and sends what’s left of them home once it’s struck', () => {
    const p = plan({ side: [{ id: 'w0', type: 'wave', team: 0, at: 180, n: 6, travel: 30 }] });
    const clock = { t: 170 };
    const { b } = laid(p, { clock });
    run(b, 0.1);
    const before = b.fighters.length;
    clock.t = 181;
    run(b, 0.1);
    const wave = b.fighters.filter((f) => f.wave === 'w0');
    expect(wave.length).toBeGreaterThan(0);
    expect(wave.length).toBeLessThanOrEqual(6);
    expect(b.fighters.length).toBe(before + wave.length);
    for (const f of wave) expect(f.role).toBe('bomber');
    b.setYou(1);
    const f = wave.find((x) => x.alive);
    for (let i = 0; i < 40 && f.alive; i++) shotAt(b, f.seen, 5);
    expect(run(b, 0.05).some((e) => e.type === 'down' && e.wave === 'w0' && e.mine)).toBe(true);
    expect(f.respawn).toBe(Infinity);
    clock.t = 180 + 30 + 21;
    run(b, 0.1);
    expect(wave.every((x) => !x.alive)).toBe(true);
  });
});
