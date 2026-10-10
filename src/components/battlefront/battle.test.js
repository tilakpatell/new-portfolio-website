import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../../lib/battlefront/rulebook.js';
import { hothFlatNav } from '../../lib/battlefront/fixtures/hothFlat.js';
import { STEP, addPlayer, createBattle, deploy, step, view, worldMove } from './battle.js';

const rb = loadRulebook();
const nav = hothFlatNav(rb);
const make = (bots = { 1: 0, 2: 0 }) => createBattle({ rulebook: rb, level: 'hoth', mode: 'galacticAssault', nav, bots });

describe('the battle on lane 1’s sim, with the deploy screen lane 2 will own', () => {
  it('starts the player on the deploy screen with the side’s classes on offer and the stage in the game’s words', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    const v = view(b);
    expect(v.deploy.open).toBe(true);
    expect(v.deploy.offers.filter((o) => o.kind === 'class').map((o) => o.id)).toEqual(['d-orig-assault', 'd-orig-heavy', 'd-orig-officer', 'd-orig-specialist']);
    expect(v.mode.stageName).toBe('TAKE OUT ANY THREATS TO THE AT-ATS');
  });

  it('deploys the player into the sim as a soldier of the class picked, on the navgrid', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    expect(deploy(b, 'player', { classId: 'd-orig-heavy' }).ok).toBe(true);
    const v = view(b);
    expect(v.deploy.open).toBe(false);
    expect(v.player.state).toBe('alive');
    expect(v.player.weapon).toBe(rb.classes['d-orig-heavy'].weapon);
    expect(v.entities).toHaveLength(1);
    expect(deploy(b, 'player', { classId: 'l-orig-heavy' }).ok).toBe(false);
  });

  it('walks ahead where the player faces, at the sim’s 20 Hz', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    const a = view(b).player.at.slice();
    for (let i = 0; i < 20; i++) step(b, [{ id: 'player', move: [0, 1], yaw: 0 }]);
    const p = view(b).player.at;
    expect(b.sim.time).toBeCloseTo(20 * STEP, 9);
    expect(p[2] - a[2]).toBeGreaterThan(2);
    expect(Math.abs(p[0] - a[0])).toBeLessThan(0.01);
  });

  it('turns the stick into the world: right is −X at yaw 0', () => {
    expect(worldMove([1, 0], 0).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([-1, 0]);
    expect(worldMove([0, 1], Math.PI / 2).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([1, 0]);
  });

  it('heats the rifle and draws its bolts', () => {
    const b = make();
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    for (let i = 0; i < 10; i++) step(b, [{ id: 'player', move: [0, 0], yaw: 0, fire: true }]);
    const v = view(b);
    expect(v.player.heat).toBeGreaterThan(0);
    expect(v.bolts.length).toBeGreaterThan(0);
  });

  it('says which weapon each soldier holds, and whose each bolt is and where it began', () => {
    const b = make({ 1: 1, 2: 0 });
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-heavy' });
    for (let i = 0; i < 6; i++) step(b, [{ id: 'player', move: [0, 0], yaw: 0, fire: true }]);
    const v = view(b);
    const me = v.entities.find((e) => e.id === b.player.id);
    expect(me.weapon).toBe('dlt19');
    for (const e of v.entities) expect(e.weapon, e.id).toBe(b.sim.entities.get(e.id).gun?.row?.id ?? null);
    const mine = v.bolts.filter((x) => x.owner === b.player.id);
    expect(mine.length).toBeGreaterThan(0);
    for (const x of mine) {
      const sim = b.sim.bolts.list.find((s) => s.id === x.id);
      expect(x.from).toEqual(sim.from);
      expect(x.travelled).toBe(sim.travelled);
      expect(x.speed).toBe(rb.weapons.dlt19.firing.speed);
    }
  });

  it('fields the bots and ends the round when told', () => {
    const b = make({ 1: 2, 2: 2 });
    addPlayer(b, { team: 2 });
    expect(view(b).entities).toHaveLength(4);
    b.force('win', 2);
    expect(view(b).mode.result).toEqual({ winner: 2, why: 'forced' });
  });
});
