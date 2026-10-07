import { describe, expect, it, vi } from 'vitest';
import { createBattle } from '../../universe/battle';
import { createTally } from '../../universe/tally';
import { layBattle } from '../battles';
import { systemById } from '../systems';
import { seeded, teamsOf } from '../gcw';
import { createEndor } from './endor';
import { createHoth } from './hoth';
import { createScarif } from './scarif';
import { createHangars } from './hangar';
import { piecesFor } from './index';

// (a battle of the old shape, the Rebellion and the Empire, unless a
// defender's named: then with its sides by team, as gcw.js's battleAt has it)
const make = (id, attacker = 'rebel', you = 0, defender = null) => {
  const sys = systemById(id);
  const sides = defender ? teamsOf(attacker, defender) : null;
  const on = { id: `c0.${id}.5`, sys: id, step: 5, seed: 99, attacker, ...(sides ? { war: 'gcw', defender, sides, attackerTeam: sides.indexOf(attacker) } : {}), start: 0, fightEnd: 600e3, end: 720e3, fighting: true };
  const laid = layBattle(sys, on, { now: 0, tier: 'low' });
  const battle = createBattle({ ...laid, rand: seeded(on.id), perSide: 4 });
  // (an evacuation's runners are the battle's own: battles.js's BATTLE_KINDS)
  battle.setYou(you);
  const fight = createTally(on.id);
  const world = { solids: [{ id: 'deathstar2', r: 66, reach: 90, at: [0, 0, 0] }], war: { holdShield: vi.fn(), station: vi.fn(), planetShield: vi.fn() } };
  const events = [];
  const ctx = {
    scene: null,
    small: true,
    battle,
    laid,
    sys,
    world,
    on,
    draw: { flash() {}, burn() {}, setVisible: vi.fn() },
    shared: (k) => fight.value(k),
    // your shots, counted as warfront.js counts them: `mine` only while
    // you're the attacker, `mineAs(team)` only when you're on that team
    mine: (k, d) => battle.you.team === battle.attacker && fight.add(k, d),
    mineAs: (team, k, d) => team === battle.you.team && fight.add(k, d),
    event: (e) => events.push(e),
    points: vi.fn(),
    tookPart: () => true,
    setHull: vi.fn(),
    moveHull: vi.fn(),
    solid: vi.fn(),
  };
  return { sys, on, laid, battle, fight, world, events, ctx };
};
const step = (piece, battle, seconds, live = null, dt = 0.1) => {
  const all = [];
  let res = {};
  for (let t = 0; t < seconds; t += dt) {
    const events = battle.update(dt, live);
    all.push(...events);
    res = piece.update(dt, t, live, events) ?? {};
    if (res.ship && live) Object.assign(live, res.ship);
  }
  return { events: all, res };
};
const shoot = (piece, p, damage = 1) => piece.hit({ x: p.x, y: p.y + 3, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);

describe('the set pieces each battle has', () => {
  it('has Endor’s at Endor, Hoth’s at Hoth, Scarif’s at Scarif, and a hangar run everywhere', () => {
    expect(piecesFor('endor')).toEqual([createEndor, createHangars]);
    expect(piecesFor('hoth')).toEqual([createHoth, createHangars]);
    expect(piecesFor('scarif')).toEqual([createScarif, createHangars]);
    expect(piecesFor('tatooine')).toEqual([createHangars]);
  });
});

describe('Endor', () => {
  it('holds the Death Star’s shield up till its generator on the moon’s knocked out, then drops it', () => {
    const k = make('endor');
    const e = createEndor(k.ctx);
    expect(k.world.war.holdShield).toHaveBeenLastCalledWith(true);
    const gen = e.targets.find((t) => t.kind === 'shieldgen');
    expect(Math.hypot(gen.at.x, gen.at.y, gen.at.z)).toBeGreaterThan(k.sys.body.r);
    for (let i = 0; i < 40 && e.targets.some((t) => t.kind === 'shieldgen'); i++) shoot(e, gen.at, 1);
    expect(k.world.war.holdShield).toHaveBeenLastCalledWith(false);
    expect(k.events).toContain('gcw-shieldgen');
    e.dispose();
  });
  it('knocks the generator out when the other pilots have', () => {
    const k = make('endor');
    const e = createEndor(k.ctx);
    k.fight.receive('p', { e: k.fight.epoch, m: { 'moon-gen': 100 }, t: {} });
    step(e, k.battle, 0.2);
    expect(k.world.war.holdShield).toHaveBeenLastCalledWith(false);
    e.dispose();
  });
  it('fires the superlaser on a Rebel cruiser now and then, and it’s gone', () => {
    const k = make('endor');
    const e = createEndor(k.ctx);
    const { events } = step(e, k.battle, 100, null, 0.2);
    expect(k.events).toContain('gcw-superlaser');
    expect(k.battle.capitals.some((c) => c.team === 0 && c.role !== 'flagship' && (c.dying > 0 || !c.alive))).toBe(true);
    expect(events.some((ev) => ev.type === 'capital' && ev.team === 0)).toBe(true);
    e.dispose();
  });
  it('sends the Executor into the Death Star when its bridge goes', () => {
    const k = make('endor');
    const e = createEndor(k.ctx);
    const exec = k.battle.capitals.find((c) => c.kind === 'executor');
    const D = systemById('endor').pieces.find((p) => p.kind === 'deathstar2').at;
    const d0 = Math.hypot(exec.pos.x - D[0], exec.pos.y - D[1], exec.pos.z - D[2]);
    e.update(0.1, 0, null, [{ type: 'sub', kind: 'bridge' }]);
    expect(k.events).toContain('gcw-executor');
    expect(exec.subs.find((s) => s.phase === 3).hidden).toBe(true);
    step(e, k.battle, 60, null, 0.2);
    expect(exec.gone || Math.hypot(exec.pos.x - D[0], exec.pos.y - D[1], exec.pos.z - D[2]) < d0 * 0.6).toBe(true);
    e.dispose();
  });
  it('opens the reactor run with the shield down: in, the reactor shot, out before it goes, and the Rebellion’s won', () => {
    const k = make('endor');
    const e = createEndor(k.ctx);
    k.fight.receive('p', { e: k.fight.epoch, m: { 'moon-gen': 100 }, t: {} });
    step(e, k.battle, 0.2);
    const way = e.markers({ x: 0, y: 0, z: 0 }).find((m) => /main reactor/.test(m.title));
    // (the marker's at the mouth: the run's own, from there in)
    expect(way).toBeTruthy();
    const mouth = way.pos;
    const D = systemById('endor').pieces.find((p) => p.kind === 'deathstar2').at;
    const inward = [D[0] - mouth.x, D[1] - mouth.y, D[2] - mouth.z];
    const il = Math.hypot(...inward);
    const live = { x: mouth.x - (inward[0] / il) * 4, y: mouth.y - (inward[1] / il) * 4, z: mouth.z - (inward[2] / il) * 4 };
    // fly in along its axis
    for (let i = 0; i < 40; i++) {
      live.x += (inward[0] / il) * 0.4;
      live.y += (inward[1] / il) * 0.4;
      live.z += (inward[2] / il) * 0.4;
      const r = e.update(0.05, i * 0.05, live, []);
      if (r.ship) Object.assign(live, r.ship);
    }
    expect(k.ctx.solid).toHaveBeenCalledWith('deathstar2', false);
    const core = e.targets.find((t) => t.kind === 'reactor');
    expect(core).toBeTruthy();
    for (let i = 0; i < 60 && e.targets.some((t) => t.kind === 'reactor'); i++) shoot(e, core.at, 1);
    expect(k.events).toContain('gcw-reactor');
    // out, and it goes
    const out = { x: mouth.x - (inward[0] / il) * 80, y: mouth.y - (inward[1] / il) * 80, z: mouth.z - (inward[2] / il) * 80 };
    step(e, k.battle, 30, out, 0.25);
    expect(k.events).toContain('gcw-ds2');
    expect(k.world.war.station).toHaveBeenCalledWith('deathstar2', false);
    expect(k.battle.over).toEqual({ winner: 0, why: 'deathstar' });
    e.dispose();
  });
});

describe('Endor, whoever attacks', () => {
  // (the moon's generator and the Death Star's reactor are the Rebellion's
  // to take, team 0's, whether it attacks Endor or holds it)
  const gen = (e) => e.targets.find((t) => t.kind === 'shieldgen');
  it('counts the Rebels’ shots on the moon’s generator when they hold Endor', () => {
    const k = make('endor', 'empire', 0);
    const e = createEndor(k.ctx);
    const at = gen(e).at;
    for (let i = 0; i < 40 && gen(e); i++) shoot(e, at, 1);
    expect(k.fight.value('moon-gen')).toBeGreaterThan(0);
    expect(k.world.war.holdShield).toHaveBeenLastCalledWith(false);
    e.dispose();
  });
  it('doesn’t count an Imperial attacker’s shots on it: the shield’s theirs', () => {
    const k = make('endor', 'empire', 1);
    const e = createEndor(k.ctx);
    const at = gen(e).at;
    for (let i = 0; i < 40; i++) shoot(e, at, 1);
    expect(k.fight.value('moon-gen')).toBe(0);
    expect(k.world.war.holdShield).not.toHaveBeenCalledWith(false);
    e.dispose();
  });
  it('keeps the Executor on station when it’s the Rebels’ bridge that goes (the Empire attacking)', () => {
    const k = make('endor', 'empire', 0);
    const e = createEndor(k.ctx);
    const exec = k.battle.capitals.find((c) => c.kind === 'executor');
    const was = { ...exec.pos };
    e.update(0.1, 0, null, [{ type: 'sub', kind: 'bridge' }]);
    step(e, k.battle, 5, null, 0.2);
    expect(k.events).not.toContain('gcw-executor');
    expect(Math.hypot(exec.pos.x - was.x, exec.pos.y - was.y, exec.pos.z - was.z)).toBeLessThan(1e-9);
    e.dispose();
  });
  const blowDs2 = (k, e) => {
    k.fight.receive('p', { e: k.fight.epoch, m: { 'moon-gen': 100, 'ds2-core': 100 }, t: {} });
    step(e, k.battle, 30, null, 0.25);
  };
  it('wins it for the Rebellion when the Death Star goes, holding Endor as much as taking it', () => {
    const k = make('endor', 'empire', 0);
    const e = createEndor(k.ctx);
    blowDs2(k, e);
    expect(k.events).toContain('gcw-ds2');
    expect(k.battle.over).toEqual({ winner: 0, why: 'deathstar' });
    e.dispose();
  });
  it('doesn’t end a battle the Empire isn’t in: the Rebellion against the Hutts', () => {
    const k = make('endor', 'hutt', 0, 'rebel');
    expect(k.on.sides).toEqual(['rebel', 'hutt']);
    const e = createEndor(k.ctx);
    blowDs2(k, e);
    expect(k.events).toContain('gcw-ds2');
    expect(k.battle.over?.why).not.toBe('deathstar');
    e.dispose();
  });
});

describe('Hoth', () => {
  it('disables a Star Destroyer with the ion cannon now and then', () => {
    const k = make('hoth', 'empire');
    const h = createHoth(k.ctx);
    const { events } = step(h, k.battle, 35, null, 0.1);
    expect(events.some((ev) => ev.type === 'disabled')).toBe(true);
    h.dispose();
  });
  it('calls the transports out as the evacuation runs them, and holds Hoth once enough are away', () => {
    const k = make('hoth', 'empire');
    const h = createHoth(k.ctx);
    // (the Empire's fighters kept off them: nothing shoots in this one)
    for (const f of k.battle.fighters) (f.alive = false), (f.respawn = Infinity);
    const r = k.laid.runners;
    step(h, k.battle, r.every * r.need + 60, null, 0.1); // (a tenth a frame, as the browser checks’ skip runs it)
    expect(k.battle.runners.filter((x) => x.kind === 'transport').length).toBeGreaterThanOrEqual(r.need);
    expect(h.out).toBe(r.need);
    expect(k.events.filter((e) => e === 'escaped')).toHaveLength(r.need);
    expect(k.events).toContain('gcw-evacuated');
    expect(k.battle.over).toEqual({ winner: 0, why: 'runners' });
    h.dispose();
  });
  it('launches no transports of its own when it’s the Rebellion attacking', () => {
    const k = make('hoth', 'rebel');
    const h = createHoth(k.ctx);
    step(h, k.battle, 60, null, 0.25);
    expect(k.battle.runners.filter((x) => x.kind === 'transport')).toHaveLength(0);
    h.dispose();
  });
});

describe('Scarif', () => {
  it('rams the Persecutor into the Intimidator and both onto the gate once its shield’s down: the shield goes, the Rebellion’s won', () => {
    const k = make('scarif');
    const s = createScarif(k.ctx);
    k.battle.phase = 2;
    step(s, k.battle, 60, null, 0.1);
    expect(k.events).toContain('gcw-ram');
    expect(k.events).toContain('gcw-gate');
    expect(k.world.war.station).toHaveBeenCalledWith('gate', false);
    expect(k.world.war.planetShield).toHaveBeenCalledWith(false);
    expect(k.battle.over).toEqual({ winner: 0, why: 'gate' });
  });
  it('does nothing till the Persecutor’s shield is down', () => {
    const k = make('scarif');
    const s = createScarif(k.ctx);
    step(s, k.battle, 10, null, 0.1);
    expect(k.events).not.toContain('gcw-ram');
  });
});

describe('a hangar run', () => {
  it('lays a run in a Star Destroyer you come near, marks its hangar, and lets you in', () => {
    const k = make('tatooine');
    const hs = createHangars(k.ctx);
    const isd = k.battle.capitals.find((c) => c.team === 1 && c.kind === 'destroyer' && c.role !== 'flagship');
    const below = { x: isd.pos.x - isd.up.x * isd.size * 0.3, y: isd.pos.y - isd.up.y * isd.size * 0.3, z: isd.pos.z - isd.up.z * isd.size * 0.3 };
    hs.update(0.1, 0, below, []);
    expect(hs.markers(below).some((m) => /Hangar/.test(m.title))).toBe(true);
    // up into it
    const live = { ...below };
    for (let i = 0; i < 75; i++) {
      live.x += isd.up.x * 0.12;
      live.y += isd.up.y * 0.12;
      live.z += isd.up.z * 0.12;
      const r = hs.update(0.05, i * 0.05, live, []);
      if (r.ship) Object.assign(live, r.ship);
    }
    expect(k.ctx.setHull).toHaveBeenCalledWith(isd.id, false);
    expect(hs.inside).toBe(true);
    hs.dispose();
  });
  const into = (k, hs, isd) => {
    const live = { x: isd.pos.x - isd.up.x * isd.size * 0.3, y: isd.pos.y - isd.up.y * isd.size * 0.3, z: isd.pos.z - isd.up.z * isd.size * 0.3 };
    hs.update(0.1, 0, live, []);
    for (let i = 0; i < 75; i++) {
      live.x += isd.up.x * 0.12;
      live.y += isd.up.y * 0.12;
      live.z += isd.up.z * 0.12;
      const r = hs.update(0.05, i * 0.05, live, []);
      if (r.ship) Object.assign(live, r.ship);
    }
    return live;
  };
  it('lays none in your own side’s: an Imperial pilot has no Star Destroyer of theirs to blow up', () => {
    const k = make('tatooine', 'empire', 1);
    const hs = createHangars(k.ctx);
    const isd = k.battle.capitals.find((c) => c.team === 1 && c.kind === 'destroyer' && c.role !== 'flagship');
    const live = into(k, hs, isd);
    expect(hs.markers(live)).toEqual([]);
    expect(hs.inside).toBe(false);
    hs.dispose();
  });
  it('counts a defender’s shots on the reactor: a Rebel holding Tatooine blows an Imperial Star Destroyer', () => {
    const k = make('tatooine', 'empire', 0);
    const hs = createHangars(k.ctx);
    const isd = k.battle.capitals.find((c) => c.team === 1 && c.kind === 'destroyer' && c.role !== 'flagship');
    into(k, hs, isd);
    expect(hs.inside).toBe(true);
    const core = hs.targets.find((t) => t.kind === 'reactor');
    expect(core).toBeTruthy();
    for (let i = 0; i < 60 && hs.targets.some((t) => t.kind === 'reactor'); i++) shoot(hs, core.at, 1);
    expect(k.events).toContain('gcw-reactor');
    expect(k.fight.keys().some((key) => key.startsWith('core-'))).toBe(true);
    hs.dispose();
  });
});
