import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../../lib/battlefront/rulebook.js';
import soldier from '../../data/bf2017/physics/soldier.json';
import { STEP, addPlayer, createSim, deploy, step, view } from './simStub.js';

const rb = loadRulebook();
const make = () => createSim({ rulebook: rb, soldier: soldier.rows.DefaultSoldierPhysics, level: 'hoth', mode: 'galacticAssault', heightAt: () => 300, bots: { 1: 0, 2: 0 } });

describe('the player alone, until lane 1’s sim lands', () => {
  it('starts the player on the deploy screen with the side’s classes on offer', () => {
    const sim = make();
    const id = addPlayer(sim, { team: 2 });
    const v = view(sim);
    expect(v.player.id).toBe(id);
    expect(v.deploy.open).toBe(true);
    expect(v.deploy.offers.filter((o) => o.kind === 'class').map((o) => o.id)).toEqual(['d-orig-assault', 'd-orig-heavy', 'd-orig-officer', 'd-orig-specialist']);
    expect(v.mode.stageName).toBe('TAKE OUT ANY THREATS TO THE AT-ATS');
  });

  it('deploys at a team 2 spawn of the stage, on the ground', () => {
    const sim = make();
    const id = addPlayer(sim, { team: 2 });
    expect(deploy(sim, id, { classId: 'd-orig-assault' }).ok).toBe(true);
    const p = view(sim).player;
    expect(p.state).toBe('alive');
    expect(p.at[1]).toBe(300);
    expect(view(sim).deploy.open).toBe(false);
  });

  it('walks at the soldier row’s speed, a step of 50 ms', () => {
    const sim = make();
    const id = addPlayer(sim, { team: 2 });
    deploy(sim, id, { classId: 'd-orig-assault' });
    const a = view(sim).player.at.slice();
    for (let i = 0; i < 20; i++) step(sim, [{ id, move: [0, 1], yaw: 0 }]);
    const b = view(sim).player.at;
    expect(sim.time).toBeCloseTo(20 * STEP, 9);
    expect(b[2] - a[2]).toBeGreaterThan(2);
    expect(b[2] - a[2]).toBeLessThan(4.2);
  });

  it('heats the rifle by the weapon row and overheats at its threshold', () => {
    const sim = make();
    const id = addPlayer(sim, { team: 2 });
    deploy(sim, id, { classId: 'd-orig-assault' });
    for (let i = 0; i < 100; i++) step(sim, [{ id, move: [0, 0], fire: true }]);
    const p = view(sim).player;
    expect(p.overheated).toBe(true);
    expect(p.warning).toBe(rb.weapons.e11.heat.warning);
    expect(view(sim).bolts.length).toBeGreaterThan(0);
  });

  it('ends the round when told, for the check', () => {
    const sim = make();
    sim.force('win', 2);
    expect(view(sim).mode.result).toEqual({ winner: 2, why: 'forced' });
  });
});
