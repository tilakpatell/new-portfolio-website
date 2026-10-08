import { describe, expect, it } from 'vitest';
import { PLAN, planFor, runnerSchedule } from './battlePlan';
import { createDirector } from './battleDirector';

const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
const evacuation = { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 6, need: 4, speed: 8, from: [0, 0, 0], to: [400, 0, 0] };

describe('a battle’s plan', () => {
  it('is the flagship’s chain by default: its shield generators, its bridge, its reactor, each behind its gate', () => {
    const p = planFor({ id: 'c0.gcw.yavin.3', kind: 'assault', attacker: 0 });
    expect(p.stages.map((s) => s.id)).toEqual(['shield', 'bridge', 'reactor']);
    expect(p.stages.map((s) => s.opensAt)).toEqual(PLAN.gates);
    expect(p.stages[0]).toMatchObject({ need: 2, shields: true });
    expect(p.stages[0].objectives.map((o) => o.on.sub)).toEqual(['gen-port', 'gen-star']);
    expect(p.stages.map((s) => s.objectives.slice(0, s.need ?? s.objectives.length).reduce((a, o) => a + o.hp, 0))).toEqual(PLAN.stageHp);
    expect(p.stages.at(-1).why).toBe('flagship');
    expect(p).toMatchObject({ attacker: 0, defender: 1, length: 600, runners: null });
  });

  it('is an Interdictor’s when the objectives are on one, and its fall is why it’s won', () => {
    expect(planFor({ id: 'x', kind: 'interdiction', attacker: 0, objectivesOn: 'interdictor' }).stages.at(-1).why).toBe('interdictor');
  });

  it('is pure: the same battle, the same plan', () => {
    const a = planFor({ id: 'c0.gcw.hoth.4', kind: 'evacuation', attacker: 1, runners: evacuation });
    const b = planFor({ id: 'c0.gcw.hoth.4', kind: 'evacuation', attacker: 1, runners: evacuation });
    expect(a).toEqual(b);
  });

  it('launches the runners on the battle’s clock, the last of them out by its end and none deciding it before 7:30', () => {
    const p = planFor({ id: 'c0.gcw.hoth.4', kind: 'evacuation', attacker: 1, runners: evacuation });
    const r = p.runners;
    expect(r).toMatchObject({ team: 1, count: 6, need: 4, hp: 34 });
    expect(r.duration).toBeCloseTo(400 / 8, 6);
    const L = (i) => r.startAt + i * r.every;
    expect(L(r.count - 1) + r.duration).toBeLessThanOrEqual(600);
    expect(L(r.need - 1) + r.duration).toBeGreaterThanOrEqual(450);
    expect(r.safe).toBe(r.need - 1);
    expect(runnerSchedule({ count: 5, need: 3, duration: 60, length: 600 }).every).toBeGreaterThan(0);
  });

  it('reads only tally keys the tally takes, well under a battle’s eighty', () => {
    for (const [kind, runners] of [
      ['assault', null],
      ['evacuation', evacuation],
      ['blockade', { ...evacuation, team: 0, count: 5, need: 3, hp: 60 }],
    ]) {
      const keys = createDirector({ plan: planFor({ id: `k-${kind}`, kind, attacker: 0, runners }), seed: kind }).keys();
      for (const k of keys) expect(k, kind).toMatch(KEY);
      expect(keys.length, kind).toBeLessThanOrEqual(80);
    }
  });
});
