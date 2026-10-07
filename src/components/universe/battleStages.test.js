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
