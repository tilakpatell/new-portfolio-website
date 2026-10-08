import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GCW, history, pointsKey, winKey } from './gcw';
import { readAllegiance, swear } from './allegiance';
import { systemById } from './systems';
import { createWarFront } from './warfront';
import { resetWar, warTally } from './warState';

// a moment in the first campaign with a battle on at its first front, a minute in
const MS = GCW.start + 24 * 60e3 + 60e3;
const STATE = history('gcw', 0, MS, () => 0);
const FRONT_ID = STATE.fronts[0];
const QUIET_ID = Object.keys(STATE.owner).find((id) => !STATE.fronts.includes(id) && !STATE.attacks.some((a) => a.sys === id));
const sworn = (side) => {
  const a = side ? swear(readAllegiance(null, { now: MS }), side, MS) : readAllegiance(null, { now: MS });
  return { war: a.war, side: a.oaths[a.war]?.side ?? null };
};

const kit = (side = 'rebel') => {
  let allegiance = sworn(side);
  const drawn = { show: vi.fn(), hide: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  const said = [];
  const sent = { fight: [], war: [] };
  const world = { quiet: vi.fn() };
  let ms = MS;
  const solids = [];
  const front = createWarFront(null, {
    models: null,
    makeScene: () => drawn,
    emit: (e) => said.push(e),
    now: () => ms,
    onSolids: (s) => solids.push(s.length),
    allegiance: () => allegiance,
  });
  front.setNet({ fight: (m) => sent.fight.push(m), war: (m) => sent.war.push(m) });
  return { front, drawn, said, sent, world, solids, at: (v) => (ms = v), swear: (x) => (allegiance = sworn(x)), get ms() { return ms; } };
};
const camera = { position: { x: 0, y: 0, z: 0 } };
const shoot = (front, p, damage = 1) => front.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, damage);
const flagOf = (b) => b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');

beforeEach(() => resetWar());
afterEach(() => resetWar());

describe('the war’s battle in the system you’re in', () => {
  it('is there as you drop in, you’re in it on the Rebels’ side, and the system’s own fleets stand aside', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle).toBeTruthy();
    expect(k.front.battle.you.team).toBe(0);
    expect(k.front.battle.attacker).toBe(0);
    expect(k.drawn.show).toHaveBeenCalledTimes(1);
    expect(k.world.quiet).toHaveBeenLastCalledWith(true);
    expect(k.said.some((e) => e.id === 'battle' && e.sub === 'front')).toBe(true);
    expect(k.front.solids.length).toBeGreaterThan(0);
    // its clock is the shared one: a minute in already
    expect(k.front.battle.clock).toBeGreaterThanOrEqual(59);
  });
  it('has nothing where there’s no fighting', () => {
    const k = kit();
    k.front.enter(systemById(QUIET_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle).toBeNull();
  });
  it('says you’re in it once you’re in among it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    expect(k.said.filter((e) => e.sub === 'join')).toHaveLength(1);
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    expect(k.said.filter((e) => e.sub === 'join')).toHaveLength(1);
  });
  it('shares your damage on an objective with the pilots here, and counts it in the war when it goes', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const g = flagOf(k.front.battle).subs.find((s) => s.id === 'gen-port');
    for (let i = 0; i < 200 && g.alive; i++) shoot(k.front, g.pos, 3);
    k.front.update(1, 0, camera, null);
    expect(g.alive).toBe(false);
    expect(k.sent.fight.at(-1).m['gen-port']).toBeGreaterThan(0);
    expect(k.sent.fight.at(-1).e).toBe(k.front.on.id);
    expect(warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step))).toBe(GCW.points.objective);
  });
  it('takes an objective down when the other pilots here have', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const id = k.front.on.id;
    k.front.onNet({ type: 'fight', from: 'p', msg: { e: id, m: { 'gen-port': 500, 'gen-star': 500 }, t: {} } });
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle.phase).toBe(2);
    // (and another battle's word is ignored)
    k.front.onNet({ type: 'fight', from: 'p', msg: { e: 'c0.elsewhere.1', m: { bridge: 500 }, t: {} } });
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.battle.phase).toBe(2);
  });
  it('counts the battle won in the war, once, if you were in it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    k.front.win(0);
    k.front.update(1 / 30, 0, camera, null);
    k.front.update(1 / 30, 0, camera, null);
    expect(warTally(k.ms).value(winKey('rebel', FRONT_ID, k.front.on.step))).toBe(1);
    expect(k.said.filter((e) => e.sub === 'won')).toHaveLength(1);
  });
  it('hears the war from other pilots, and tells them of it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.onNet({ type: 'war', from: 'p', msg: { e: 'c0', m: { [pointsKey('rebel', FRONT_ID, 2)]: 5 }, t: {} } });
    expect(warTally(k.ms).value(pointsKey('rebel', FRONT_ID, 2))).toBe(5);
    for (let i = 0; i < 40; i++) k.front.update(1, 0, camera, null);
    expect(k.sent.war.length).toBeGreaterThan(0);
  });
  it('moves on to the next battle when the step’s up, and lets the system’s fleets back when there’s none', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const first = k.front.on.id;
    k.at(MS + GCW.step);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.on?.id ?? null).not.toBe(first);
    k.front.enter(systemById(QUIET_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.world.quiet).toHaveBeenLastCalledWith(false);
    expect(k.drawn.hide).toHaveBeenCalled();
  });
});

describe('the side you swore to', () => {
  const into = (k) => {
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const at = k.front.info.laid.at;
    return { x: at[0], y: at[1], z: at[2] };
  };
  const downOne = (k, team, role) => {
    const f = k.front.battle.fighters.find((x) => x.alive && x.team === team && (!role || x.role === role));
    for (let i = 0; i < 40 && f.alive; i++) shoot(k.front, f.pos, 5);
    k.front.update(1 / 30, 0, camera, null);
    return f;
  };
  it('unsworn, the battle asks once and scores nothing', () => {
    const k = kit(null);
    const here = into(k);
    expect(k.front.battle.you.team).toBeNull();
    k.front.update(1 / 30, 0, camera, here);
    k.front.update(1 / 30, 0, camera, here);
    expect(k.said.filter((e) => e.id === 'battle' && e.sub === 'ask')).toHaveLength(1);
    expect(k.said.some((e) => e.sub === 'join')).toBe(false);
    downOne(k, 1);
    expect(warTally(k.ms).keys()).toEqual([]);
    expect(k.front.info.team).toBeNull();
    expect(k.front.info.asked).toBe(true);
  });
  const paid = (k, what) => k.said.filter((e) => e.type === 'earn' && e.what === what);
  it('pays the wallet for the war’s points you score, a whole point at a time', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.update(1 / 30, 0, camera, null);
    const g = flagOf(k.front.battle).subs.find((s) => s.id === 'gen-port');
    for (let i = 0; i < 200 && g.alive; i++) shoot(k.front, g.pos, 3);
    k.front.update(1, 0, camera, null);
    expect(paid(k, 'warPoints').reduce((n, e) => n + e.n, 0)).toBe(GCW.points.objective);
    expect(paid(k, 'warPoints').every((e) => e.side === 'galaxy' && Number.isInteger(e.n) && e.n > 0)).toBe(true);
    // fighters are a tenth of a point each: paid once they add up to a whole one
    const here = { x: k.front.info.laid.at[0], y: k.front.info.laid.at[1], z: k.front.info.laid.at[2] };
    k.front.update(1 / 30, 0, camera, here);
    for (let i = 0; i < 12 && k.front.battle.fighters.some((x) => x.alive && x.team === 1); i++) downOne(k, 1);
    const mine = warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step));
    expect(mine).toBeGreaterThan(GCW.points.objective);
    expect(paid(k, 'warPoints').reduce((n, e) => n + e.n, 0)).toBe(Math.floor(mine + 1e-6));
  });
  it('pays the wallet for a battle won, once, and nothing unsworn', () => {
    const k = kit();
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    k.front.win(0);
    k.front.update(1 / 30, 0, camera, null);
    k.front.update(1 / 30, 0, camera, null);
    expect(paid(k, 'warWin')).toEqual([{ type: 'earn', what: 'warWin', n: 1, side: 'galaxy' }]);
    const u = kit(null);
    const there = into(u);
    u.front.update(1 / 30, 0, camera, there);
    downOne(u, 1);
    u.front.win(0);
    u.front.update(1 / 30, 0, camera, null);
    expect(u.said.some((e) => e.type === 'earn')).toBe(false);
  });
  it('swearing in the middle of it puts you in it', () => {
    const k = kit(null);
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    k.swear('rebel');
    k.front.update(1 / 30, 0, camera, here);
    expect(k.front.battle.you.team).toBe(0);
    expect(k.said.filter((e) => e.sub === 'join')).toHaveLength(1);
  });
  it('an Imperial pilot at a liberation is on the defence, sends no fight keys, and scores for the Empire', () => {
    const k = kit('empire');
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    expect(k.front.battle.you.team).toBe(1);
    expect(k.front.info.team).toBe(1);
    // its own flagship's generator, shot at: not the Empire's to take down
    const g = flagOf(k.front.battle).subs.find((s) => s.id === 'gen-port');
    for (let i = 0; i < 30; i++) shoot(k.front, g.pos, 3);
    downOne(k, 0, 'fighter');
    for (let i = 0; i < 10; i++) k.front.update(1, 0, camera, null);
    for (const m of k.sent.fight) expect(Object.keys(m.m)).toEqual([]);
    expect(warTally(k.ms).mine(pointsKey('empire', FRONT_ID, k.front.on.step))).toBeGreaterThan(0);
    expect(warTally(k.ms).mine(pointsKey('rebel', FRONT_ID, k.front.on.step))).toBe(0);
    expect(Object.keys(k.sent.war.at(-1).m).some((key) => key.startsWith('imp:'))).toBe(true);
  });
  it('a bomber of the attacker’s brought down by a defender is an intercept', () => {
    const k = kit('empire');
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    downOne(k, 0, 'bomber');
    expect(warTally(k.ms).mine(pointsKey('empire', FRONT_ID, k.front.on.step))).toBeCloseTo(GCW.points.intercept, 5);
    expect(k.said.filter((e) => e.sub === 'intercept')).toHaveLength(1);
  });
  it('the battle won is the side’s that won it', () => {
    const k = kit('empire');
    const here = into(k);
    k.front.update(1 / 30, 0, camera, here);
    k.front.win(1);
    k.front.update(1 / 30, 0, camera, null);
    expect(warTally(k.ms).value(winKey('empire', FRONT_ID, k.front.on.step))).toBe(1);
    expect(warTally(k.ms).value(winKey('rebel', FRONT_ID, k.front.on.step))).toBe(0);
    expect(k.said.filter((e) => e.sub === 'won')).toHaveLength(1);
  });
  it('says the battle’s side, war and system with each line', () => {
    const k = kit('rebel');
    into(k);
    const e = k.said.find((x) => x.sub === 'front');
    expect(e).toMatchObject({ side: 'rebel', war: 'gcw', sys: FRONT_ID, against: STATE.owner[FRONT_ID] });
  });
  it('fights the war you fight in: another war’s battle at another system', () => {
    const clone = history('clone', 0, MS, () => 0);
    const k = kit('republic');
    k.front.enter(systemById(clone.fronts[0]), k.world);
    k.front.update(1 / 30, 0, camera, null);
    expect(k.front.on.war).toBe('clone');
    expect(k.front.battle.you.team).toBe(0);
  });
  it('the set pieces are the Civil War’s', () => {
    const k = kit('republic');
    k.front.enter(systemById('endor'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('separatists');
    expect(k.front.on.war).toBe('clone');
    expect(k.front.pieces).toEqual([]);
    const g = kit('rebel');
    g.front.enter(systemById('endor'), g.world);
    g.front.update(1 / 30, 0, camera, null);
    g.front.force('empire');
    expect(g.front.pieces.length).toBeGreaterThan(0);
  });
});

describe('every kind of battle', () => {
  it('a battle of each kind, in each war, starts and runs ten seconds without throwing', async () => {
    const { BATTLE_KINDS } = await import('./battles');
    const { WARS } = await import('./sides');
    const { WAR_SYSTEMS, warInfo } = await import('./gcw');
    for (const kind of Object.keys(BATTLE_KINDS)) {
      const id = WAR_SYSTEMS.find((x) => warInfo(x).kind === kind) ?? 'tatooine';
      for (const war of Object.values(WARS))
        for (const attacker of [war.liberator, war.raider, 'hutt']) {
          const k = kit(war.liberator);
          k.front.enter(systemById(id), k.world);
          k.front.update(1 / 30, 0, camera, null);
          k.front.force(attacker === 'hutt' ? 'hutt' : attacker);
          expect(k.front.info.laid, `${kind} ${war.id} ${attacker}`).toBeTruthy();
          for (let i = 0; i < 100; i++) k.front.update(0.1, i * 0.1, camera, null);
        }
    }
  });
  it('the dev hook forces a battle of the kind asked for, wherever it is', () => {
    const k = kit('rebel');
    k.front.enter(systemById('scarif'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('empire', 'evacuation');
    expect(k.front.info.laid.kind).toBe('evacuation');
    expect(k.front.battle.runners.length + 1).toBeGreaterThan(0);
    k.front.force('rebel', 'nonsense');
    expect(k.front.info.laid.kind).toBe('siege');
  });
  it('a runner of the other side’s, shot down, is an intercept', () => {
    const k = kit('empire');
    k.front.enter(systemById('naboo'), k.world);
    k.front.update(1 / 30, 0, camera, null);
    k.front.force('rebel');
    expect(k.front.info.laid.kind).toBe('blockade');
    const at = k.front.info.laid.at;
    k.front.update(1 / 30, 0, camera, { x: at[0], y: at[1], z: at[2] });
    const r = k.front.battle.runners[0];
    for (let i = 0; i < 40 && r.alive; i++) shoot(k.front, r.pos, 5);
    k.front.update(1 / 30, 0, camera, null);
    expect(r.alive).toBe(false);
    expect(warTally(k.ms).mine(pointsKey('empire', 'naboo', k.front.on.step))).toBeCloseTo(GCW.points.intercept, 5);
    expect(k.said.filter((e) => e.sub === 'intercept')).toHaveLength(1);
  });
});
