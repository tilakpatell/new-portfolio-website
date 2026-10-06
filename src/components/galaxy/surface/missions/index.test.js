import { describe, expect, it } from 'vitest';
import { MISSIONS, endRun, missionOf, newRun, outcomeOf, tickRun } from './index';
import { STEP_TYPES } from '../quests';
import { RIDES } from '../rides';
import { buildFigure } from '../figures';
import { siteOf } from '../sites';

describe('missions played as quests', () => {
  it('reads how a quest went from what the quest engine said', () => {
    expect(outcomeOf([{ type: 'step', step: 1 }, { type: 'done' }])).toBe('won');
    expect(outcomeOf([{ type: 'fail', why: 'time' }])).toBe('lost');
    expect(outcomeOf([{ type: 'count', count: 1, of: 3 }])).toBeNull();
    expect(outcomeOf([])).toBeNull();
  });

  it('gives every mission a ride there is, and a quest mission steps the engine knows', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        expect(RIDES[m.ride], `${m.id} ride`).toBeTruthy();
        if (m.kind !== 'quest') continue;
        expect(m.quest.steps.length).toBeGreaterThan(0);
        for (const s of m.quest.steps) {
          expect(STEP_TYPES, `${m.id} ${s.type}`).toContain(s.type);
          expect(typeof s.text).toBe('string');
          for (const sp of [s.spawn].flat().filter(Boolean)) expect(buildFigure(sp.kind), `${m.id} spawn ${sp.kind}`).toBeTruthy();
        }
        expect(m.stars[0]).toBeLessThan(m.stars[1]);
      }
  });

  it('runs Lothal’s star map from the landing, between the spires, to the tower', () => {
    const m = missionOf('lothal', 'starmap');
    expect(m?.kind).toBe('quest');
    const site = siteOf('lothal');
    const tower = site.places.find((p) => p.id === 'tower');
    expect(tower?.things.some((t) => t.kind === 'lookout')).toBe(true);
    const race = m.quest.steps.find((s) => s.type === 'race');
    expect(race.ride).toBe('speederbike');
    expect(race.gates.length).toBeGreaterThanOrEqual(5);
    expect(race.time).toBeGreaterThan(0);
    const last = race.gates[race.gates.length - 1];
    expect(Math.hypot(last[0] - tower.at[0], last[1] - tower.at[1])).toBeLessThan(45);
    const use = m.quest.steps.find((s) => s.type === 'use');
    expect(Math.hypot(use.at[0] - tower.at[0], use.at[1] - tower.at[1])).toBeLessThan(tower.r);
    // a bike waits at the landing for anyone, not only the mission
    expect(site.rides.some((r) => r.kind === 'speederbike')).toBe(true);
  });

  it('keeps a quest mission’s clock till it ends, then holds it', () => {
    const m = missionOf('lothal', 'starmap');
    let run = tickRun(tickRun(newRun(), 10), 5);
    expect(run).toEqual({ phase: 'run', t: 15, result: null });
    const won = endRun(run, m, 'won');
    expect(won.result).toEqual({ won: true, t: 15, stars: 3 });
    expect(tickRun(won, 5).t).toBe(15);
    expect(endRun(won, m, 'lost', 'down')).toBe(won);
    expect(endRun(run, m, 'lost', 'time').result).toEqual({ won: false, t: 15, why: 'time' });
    run = tickRun(run, m.stars[1]);
    expect(endRun(run, m, 'won').result.stars).toBe(1);
  });

  it('says how each mission ended, every way it can end', () => {
    for (const list of Object.values(MISSIONS))
      for (const m of Object.values(list)) {
        expect(typeof m.ends.won, `${m.id} won`).toBe('string');
        expect(typeof m.ends.lost, `${m.id} lost`).toBe('string');
        for (const why of m.kind === 'quest' ? ['time', 'down'] : ['lost']) expect(typeof m.ends.why[why], `${m.id} ${why}`).toBe('string');
      }
  });
});
