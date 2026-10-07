import { describe, expect, it } from 'vitest';
import { createDirector } from '../universe/battleDirector';
import { TYPES } from '../universe/battleObjectives';
import { PLAN } from '../universe/battlePlan';
import { MENUS, planOf } from './battlePlans';
import { BATTLE_KINDS, layBattle } from './battles';
import { WAR_SYSTEMS, teamsOf } from './gcw';
import { WARS } from './sides';
import { systemById } from './systems';

const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
// a battle as gcw.js's battleAt has it, its id numbered
const battleOf = (sys, attacker, defender, war, n = 3, kind = null) => {
  const sides = teamsOf(attacker, defender);
  return { id: `c0.${war}.${sys}.${n}`, war, sys, step: n, seed: n, attacker, defender, sides, attackerTeam: sides.indexOf(attacker), start: 0, fightEnd: 600e3, end: 720e3, fighting: true, ...(kind ? { kind } : {}) };
};
const planAt = (sys, attacker, defender, war = 'gcw', n = 3, kind = null) => {
  const b = battleOf(sys, attacker, defender, war, n, kind);
  const laid = layBattle(systemById(sys), b);
  return { plan: planOf(systemById(sys), b, laid), laid, b };
};
// a battle of each kind somewhere, in each war, both ways round
const everyBattle = function* (seeds = 1) {
  for (const war of Object.values(WARS))
    for (const kind of Object.keys(BATTLE_KINDS))
      for (const [att, def] of [
        [war.liberator, war.raider],
        [war.raider, war.liberator],
      ])
        for (let n = 0; n < seeds; n++) yield { war: war.id, kind, att, def, n, ...planAt(WAR_SYSTEMS[n % WAR_SYSTEMS.length], att, def, war.id, n, kind) };
};

describe('the plans’ menus', () => {
  it('have a menu for every kind of battle', () => {
    for (const kind of Object.keys(BATTLE_KINDS)) expect(MENUS[kind]?.stages?.length, kind).toBe(PLAN.gates.length);
  });
});

describe('planOf', () => {
  it('is pure: the same battle, the same plan', () => {
    expect(planAt('yavin', 'rebel', 'empire').plan).toEqual(planAt('yavin', 'rebel', 'empire').plan);
  });

  it('draws a different first stage for different battles of a kind: at least two kinds of objective across fifty', () => {
    for (const kind of Object.keys(BATTLE_KINDS)) {
      const types = new Set();
      const ids = new Set();
      for (let n = 0; n < 50; n++) {
        const id = WAR_SYSTEMS[n % WAR_SYSTEMS.length];
        const war = ['gcw', 'clone', 'remnant'][n % 3];
        const w = WARS[war];
        const { plan } = planAt(id, n % 2 ? w.raider : w.liberator, n % 2 ? w.liberator : w.raider, war, n, kind);
        types.add(plan.stages[0].type);
        ids.add(plan.stages[0].id);
      }
      expect(types.size, kind).toBeGreaterThanOrEqual(2);
      expect(ids.size, kind).toBeGreaterThanOrEqual(2);
    }
  });

  it('every kind of objective there is turns up in some plan', () => {
    const seen = new Set();
    for (const { plan } of everyBattle(6)) {
      for (const s of plan.stages) {
        seen.add(s.type);
        for (const o of s.objectives) seen.add(o.type);
      }
      for (const o of plan.side) seen.add(o.type);
      if (plan.runners) seen.add(plan.runners.type);
    }
    seen.add(planAt('endor', 'rebel', 'empire').plan.stages.at(-1).type);
    for (const type of Object.keys(TYPES)) expect(seen.has(type), type).toBe(true);
  });

  it('opens each stage on its gate, every objective with hp, every key one the tally takes, eighty at most a battle', () => {
    for (const { plan, war, kind, att } of everyBattle(3)) {
      const what = `${war} ${kind} ${att}`;
      expect(plan.stages.map((s) => s.opensAt), what).toEqual(PLAN.gates);
      for (const s of plan.stages) {
        expect(s.objectives.length, what).toBeGreaterThan(0);
        expect(s.need ?? s.objectives.length, what).toBeLessThanOrEqual(s.objectives.length);
        for (const o of s.objectives) {
          expect(o.hp, `${what} ${o.id}`).toBeGreaterThan(0);
          expect(o.name, `${what} ${o.id}`).toMatch(/\S/);
          expect(o.on, `${what} ${o.id}`).toBeTruthy();
        }
      }
      const keys = createDirector({ plan, seed: plan.id }).keys();
      // (and the hangar runs' reactors, one a Star Destroyer: warpieces/hangar.js)
      const all = [...keys, ...Array.from({ length: 8 }, (_, i) => `core-${i}`)];
      for (const k of all) expect(k, what).toMatch(KEY);
      expect(new Set(keys).size, what).toBe(keys.length);
      expect(all.length, what).toBeLessThanOrEqual(80);
      for (const t of plan.side) expect(t.at, what).toBeLessThan(plan.length);
    }
  });

  it('keeps each stage worth its share of the battle, whatever’s in it', () => {
    for (const { plan, war, kind } of everyBattle(2))
      plan.stages.forEach((s, i) => {
        const need = s.need ?? s.objectives.length;
        const ai = [...s.objectives].slice(0, need).reduce((a, o) => a + o.hp, 0);
        expect(ai, `${war} ${kind} ${s.id}`).toBeGreaterThan(PLAN.stageHp[i] * 0.85);
        expect(ai, `${war} ${kind} ${s.id}`).toBeLessThan(PLAN.stageHp[i] * 1.15);
      });
  });

  it('pins Endor: the moon’s shield generator, then the Executor’s bridge, then the run on the Death Star’s reactor', () => {
    const { plan } = planAt('endor', 'rebel', 'empire');
    expect(plan.stages.map((s) => s.objectives.map((o) => o.id))).toEqual([['moon-gen'], ['bridge'], ['ds2-core']]);
    expect(plan.stages[0].objectives[0].on).toEqual({ piece: 'endor' });
    expect(plan.stages[2]).toMatchObject({ type: 'run', why: 'deathstar' });
    expect(plan.stages[1].objectives[0].name).toMatch(/Executor/);
    // (the other way round, the Empire attacking, it's a siege like any other)
    expect(planAt('endor', 'empire', 'rebel').plan.stages[0].objectives[0].id).not.toBe('moon-gen');
  });

  it('pins Scarif’s gate and Hoth’s ion cannon and transports', () => {
    const scarif = planAt('scarif', 'rebel', 'empire').plan;
    expect(scarif.stages.at(-1).objectives[0]).toMatchObject({ id: 'gate', on: { piece: 'scarif' } });
    expect(scarif.stages.at(-1).why).toBe('gate');
    const hoth = planAt('hoth', 'empire', 'rebel').plan;
    expect(hoth.stages[0].objectives[0]).toMatchObject({ id: 'ion-cannon', on: { piece: 'hoth' } });
    expect(hoth.runners).toMatchObject({ kind: 'transport', type: 'intercept' });
  });

  it('flies each war’s own: the Separatists’ droid control relay, the Remnant’s TIE Defender, the Tantive IV boarded at Tatooine and Scarif', () => {
    const relays = new Set();
    for (let n = 0; n < 40; n++) {
      const { plan } = planAt('kashyyyk', 'republic', 'separatists', 'clone', n, 'assault');
      for (const s of plan.stages) for (const o of s.objectives) if (o.kind === 'droidrelay') relays.add(o.effect?.freeze);
    }
    expect([...relays]).toEqual([30]);
    const remnant = planAt('nevarro', 'newrepublic', 'remnant', 'remnant').plan;
    expect(remnant.side.find((o) => o.type === 'ace' && o.team === 1)).toMatchObject({ kind: 'tiedefender' });
    for (const sys of ['tatooine', 'scarif']) {
      let boarded = null;
      for (let n = 0; n < 40 && !boarded; n++) {
        const { plan } = planAt(sys, 'empire', 'rebel', 'gcw', n);
        boarded = plan.stages.find((s) => s.type === 'board' && /Tantive IV/.test(s.objectives[1].name)) ?? null;
      }
      expect(boarded, sys).toBeTruthy();
      expect(boarded.objectives.map((o) => o.type)).toEqual(['destroy', 'zone']);
    }
  });

  it('keeps the gravity wells of an interdiction’s Interdictor among its objectives, and says the battle’s interdicted while they stand', () => {
    let wells = null;
    for (let n = 0; n < 30 && !wells; n++) {
      const { plan } = planAt('mandalore', 'rebel', 'empire', 'gcw', n);
      wells = plan.stages.find((s) => s.id === 'wells') ?? null;
    }
    expect(wells).toBeTruthy();
    expect(wells).toMatchObject({ interdicts: true, need: 4, shields: true });
    expect(wells.objectives).toHaveLength(4);
  });

  it('loses a few of each side’s escorts along the way, never the ships the objectives are on', () => {
    let lost = 0;
    for (const { plan, laid } of everyBattle(2)) {
      for (const l of plan.losses) {
        const cap = laid.war.sides[l.team].capitals[l.index];
        expect(cap.role).toBe('escort');
        expect(l.at).toBeGreaterThan(0);
        expect(l.at).toBeLessThan(plan.length);
        const on = plan.stages.flatMap((s) => s.objectives.map((o) => o.on));
        expect(on.some((o) => o.ship === l.index && l.team === plan.defender)).toBe(false);
        const objective = laid.objectivesOn === 'interdictor' ? laid.war.sides[plan.defender].capitals.findIndex((c) => c.kind === 'interdictor') : 0;
        expect(l.team === plan.defender && l.index === objective).toBe(false);
        expect(cap.name ?? null).toBeNull();
        lost += 1;
      }
    }
    expect(lost).toBeGreaterThan(10);
  });
});
