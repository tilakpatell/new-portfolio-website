// The galaxy's battles as their plans are drawn (battlePlans.js's menus,
// bomber waves, aces and runners and all), over hundreds of them: slower
// than the unit tests, so apart from `npm test`; run it explicitly:
// npx vitest run --config vitest.ai.config.js src/components/galaxy/battlePlans.scenario.test.js
//
// What the owner asked of a galaxy battle: left to the AI, the attacker
// wins 30-60% of them, each decided between 7:30 and 10:00; a pilot alone
// wins one at about 4:30-7:30; four or more never before about five minutes
// (the stage gates); and what a defender does makes it harder.
import { describe, expect, it } from 'vitest';
import { createDirector } from '../universe/battleDirector';
import { planOf } from './battlePlans';
import { BATTLE_KINDS, layBattle } from './battles';
import { WAR_SYSTEMS, teamsOf } from './gcw';
import { WARS } from './sides';
import { systemById } from './systems';

const N = 300;
const WAR_LIST = Object.values(WARS);
// the i-th battle of a kind: each war in turn, each way round, at each system in turn
const planned = (kind, i) => {
  const w = WAR_LIST[i % WAR_LIST.length];
  const [att, def] = i % 2 ? [w.raider, w.liberator] : [w.liberator, w.raider];
  const sys = WAR_SYSTEMS[(i * 7) % WAR_SYSTEMS.length];
  const sides = teamsOf(att, def);
  const b = { id: `c0.${w.id}.${sys}.${i}`, war: w.id, sys, step: i, seed: i, attacker: att, defender: def, sides, attackerTeam: sides.indexOf(att), start: 0, fightEnd: 600e3, end: 720e3, fighting: true, kind };
  return planOf(systemById(sys), b, layBattle(systemById(sys), b));
};

// a battle fought by `pilots` attackers, each landing `rate` hits a second
// on (or holding) whatever objective of the open stage the AI's on, and a
// defender intercepting `stops` of each bomber wave: when it ended, who won
function fight(plan, { pilots = 0, rate = 0, stops = 0 } = {}) {
  const d = createDirector({ plan, seed: plan.id });
  const tally = new Map([['here:a', pilots]]);
  const value = (k) => tally.get(k) ?? 0;
  for (let t = 0; t <= plan.length; t += 1) {
    const st = d.state(t, value);
    if (st.winner !== null) return { winner: st.winner === plan.attacker ? 'attacker' : 'defender', at: st.endsAt };
    for (const w of st.waves) if (stops && w.launched && !w.arrived) tally.set(w.id, Math.min(stops, w.n));
    if (pilots && st.open && st.target) {
      const o = plan.stages[st.stage].objectives.find((x) => x.id === st.target);
      const key = o.type === 'zone' ? `${o.id}:a` : o.id;
      tally.set(key, (tally.get(key) ?? 0) + (o.type === 'zone' ? 1 : pilots * rate) / d.scale(plan.attacker, value));
    }
  }
  return { winner: 'defender', at: plan.length };
}
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

describe('a galaxy battle of each kind, as it’s drawn, left to the AI', () => {
  for (const kind of Object.keys(BATTLE_KINDS))
    it(`${kind}: the attacker wins 30-60% of them, each decided at 7:30-10:00`, () => {
      const runs = Array.from({ length: N }, (_, i) => fight(planned(kind, i)));
      const won = runs.filter((r) => r.winner === 'attacker').length / N;
      expect(won).toBeGreaterThanOrEqual(0.3);
      expect(won).toBeLessThanOrEqual(0.6);
      for (const r of runs) {
        expect(r.at).toBeGreaterThanOrEqual(450);
        expect(r.at).toBeLessThanOrEqual(600);
      }
    });
});

describe('a galaxy battle as it’s drawn, with pilots in it', () => {
  it('a pilot alone, landing three hits a second (or holding what’s to hold), wins it at about 4:30-7:30', () => {
    for (const kind of Object.keys(BATTLE_KINDS)) {
      const runs = Array.from({ length: 60 }, (_, i) => fight(planned(kind, i), { pilots: 1, rate: 3 }));
      const won = runs.filter((r) => r.winner === 'attacker');
      expect(won.length, kind).toBeGreaterThan(runs.length * 0.8);
      const m = median(won.map((r) => r.at));
      expect(m, kind).toBeGreaterThanOrEqual(270);
      expect(m, kind).toBeLessThanOrEqual(450);
    }
  });
  it('four or more pilots never win it before the last stage’s gate, five minutes in', () => {
    for (const kind of Object.keys(BATTLE_KINDS))
      for (const pilots of [4, 12])
        for (let i = 0; i < 30; i++) {
          const r = fight(planned(kind, i), { pilots, rate: 6 });
          if (r.winner === 'attacker') expect(r.at, `${kind} ${pilots} pilots, ${i}`).toBeGreaterThanOrEqual(300);
        }
  });
  it('a defender intercepting the bomber waves makes the attacker’s AI win less often', () => {
    const odds = (stops) => Array.from({ length: N }, (_, i) => fight(planned('assault', i), { stops })).filter((r) => r.winner === 'attacker').length;
    const free = odds(0);
    expect(odds(3)).toBeLessThan(free);
    expect(odds(6)).toBeLessThanOrEqual(odds(3));
  });
});
