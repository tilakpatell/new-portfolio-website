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

  it('puts the player in a squad, listed as “You” first and the bots by name', () => {
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    const v = view(b);
    expect(v.squad.letter).toBe('A');
    expect(v.squad.members.map((m) => m.name)).toEqual(['You', 'Trooper 1', 'Trooper 2', 'Trooper 3']);
    expect(v.squad.members[0].local).toBe(true);
    expect(v.squad.members[1]).toMatchObject({ alive: true, cls: 'assault' });
  });

  it('offers the HQ and each squadmate on the deploy screen, with why a mate cannot be spawned on', () => {
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    const [, hit] = view(b).squad.members;
    b.sim.entities.get(hit.id).combatAt = b.sim.time;
    const spawns = view(b).deploy.spawns;
    expect(spawns[0]).toMatchObject({ kind: 'hq', name: 'IMPERIAL HQ' });
    expect(spawns.slice(1).map((s) => s.kind)).toEqual(['mate', 'mate', 'mate']);
    expect(spawns[1]).toMatchObject({ id: hit.id, name: 'Trooper 1', cls: 'assault', blocked: 'combat', reason: 'IN COMBAT' });
    expect(spawns[2]).toMatchObject({ blocked: null, reason: null });
  });

  it('deploys the player on a squadmate, behind them, keeping the player’s id; and not on one just hit', () => {
    const b = make({ 1: 0, 2: 3 });
    addPlayer(b, { team: 2 });
    const [, hit, mate] = view(b).squad.members;
    b.sim.entities.get(hit.id).combatAt = b.sim.time;
    expect(deploy(b, 'player', { classId: 'd-orig-heavy', spawn: 'squad', mate: hit.id })).toEqual({ ok: false, why: 'combat' });
    expect(deploy(b, 'player', { classId: 'd-orig-heavy', spawn: 'squad', mate: mate.id })).toEqual({ ok: true });
    const v = view(b);
    const m = b.sim.entities.get(mate.id);
    expect(Math.hypot(v.player.at[0] - m.at[0], v.player.at[2] - m.at[2])).toBeLessThan(8);
    const id = v.player.id;
    expect(v.squad.members[0]).toMatchObject({ id, name: 'You', alive: true, cls: 'heavy' });
    expect(v.scoreboard[2].rows.find((r) => r.id === mate.id).points).toBe(rb.points.earn.squadSpawn);
    b.sim.entities.get(id).alive = false;
    b.player.state = 'deploying';
    expect(deploy(b, 'player', { classId: 'd-orig-assault' }).ok).toBe(true);
    expect(view(b).player.id).toBe(id);
  });

  it('fields the bots and ends the round when told', () => {
    const b = make({ 1: 2, 2: 2 });
    addPlayer(b, { team: 2 });
    expect(view(b).entities).toHaveLength(4);
    b.force('win', 2);
    expect(view(b).mode.result).toEqual({ winner: 2, why: 'forced' });
  });
});
