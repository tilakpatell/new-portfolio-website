import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GCW, history, pointsKey, winKey } from './gcw';
import { systemById } from './systems';
import { createWarFront } from './warfront';
import { resetWar, warTally } from './warState';

// a moment in the first campaign with a battle on at its first front, a minute in
const MS = GCW.start + 24 * 60e3 + 60e3;
const FRONT_ID = history(0, MS, () => 0).fronts[0];
const QUIET_ID = Object.entries(history(0, MS, () => 0).owner).find(([id]) => !history(0, MS, () => 0).fronts.includes(id) && history(0, MS, () => 0).attack?.sys !== id)[0];

const kit = () => {
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
  });
  front.setNet({ fight: (m) => sent.fight.push(m), war: (m) => sent.war.push(m) });
  return { front, drawn, said, sent, world, solids, at: (v) => (ms = v), get ms() { return ms; } };
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
    expect(warTally(k.ms).mine(pointsKey(FRONT_ID, k.front.on.step))).toBe(GCW.points.objective);
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
    expect(warTally(k.ms).value(winKey(FRONT_ID, k.front.on.step))).toBe(1);
    expect(k.said.filter((e) => e.sub === 'won')).toHaveLength(1);
  });
  it('hears the war from other pilots, and tells them of it', () => {
    const k = kit();
    k.front.enter(systemById(FRONT_ID), k.world);
    k.front.onNet({ type: 'war', from: 'p', msg: { e: 'c0', m: { [pointsKey(FRONT_ID, 2)]: 5 }, t: {} } });
    expect(warTally(k.ms).value(pointsKey(FRONT_ID, 2))).toBe(5);
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
