// The shared battle's length and odds, over hundreds of seeds (slower than
// the unit tests, so apart from `npm test`; run it explicitly:
// npx vitest run --config vitest.ai.config.js src/components/universe/battleDirector.scenario.test.js).
//
// What the owner asked of a galaxy battle: left to the AI, the attacker
// wins 30-60% of them, each decided between 7:30 and 10:00; a pilot alone
// wins one at about 4:30-7:30; four or more pilots never before about five
// minutes (the stage gates); and a defender's intercepts make it harder.
import { describe, expect, it } from 'vitest';
import { createDirector } from './battleDirector';
import { planFor } from './battlePlan';

const N = 300;
// (as galaxy/battles.js's BATTLE_KINDS has them, on ways about as long as layBattle's)
const runners = {
  evacuation: { team: 1, kind: 'transport', size: 2.2, hp: 34, count: 8, need: 6, speed: 8, route: [[0, 0, 0], [150, 0, 0], [250, 0, 80], [330, 20, 120]] },
  blockade: { team: 0, kind: 'corvette', size: 2.8, hp: 60, count: 5, need: 3, speed: 7, route: [[0, 0, 0], [170, 0, 0], [300, -40, 60]] },
};
const KINDS = ['assault', 'siege', 'interdiction', 'ambush', 'evacuation', 'blockade'];
const planOf = (kind, i) => planFor({ id: `c0.gcw.${kind}.${i}`, kind, attacker: 0, runners: runners[kind] ?? null });

// a battle fought by `pilots` attackers, each landing `rate` hp a second on
// whatever objective of the open stage the AI's on (and `credits`
// intercepts by a defender on it, early on): when it ended and who won
function fight(kind, i, { pilots = 0, rate = 0, credits = 0 } = {}) {
  const plan = planOf(kind, i);
  const d = createDirector({ plan, seed: plan.id });
  const tally = new Map([['here:a', pilots]]);
  const value = (k) => tally.get(k) ?? 0;
  let credited = false;
  for (let t = 0; t <= 600; t += 1) {
    const st = d.state(t, value);
    if (st.winner !== null) return { winner: st.winner, at: st.endsAt };
    if (!credited && credits && st.target && t >= 60) {
      tally.set(`g:${st.target}`, credits);
      credited = true;
    }
    if (pilots && st.open && st.target) {
      const o = plan.stages[st.stage].objectives.find((x) => x.id === st.target);
      const key = o.type === 'zone' ? `${o.id}:a` : o.id;
      tally.set(key, (tally.get(key) ?? 0) + (pilots * rate) / d.scale(0, value));
    }
  }
  return { winner: 1, at: 600 };
}
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

describe('a galaxy battle left to the AI', () => {
  for (const kind of KINDS)
    it(`${kind}: the attacker wins 30-60% of them, each decided at 7:30-10:00`, () => {
      const runs = Array.from({ length: N }, (_, i) => fight(kind, i));
      const won = runs.filter((r) => r.winner === 0).length / N;
      expect(won).toBeGreaterThanOrEqual(0.3);
      expect(won).toBeLessThanOrEqual(0.6);
      for (const r of runs) {
        expect(r.at).toBeGreaterThanOrEqual(450);
        expect(r.at).toBeLessThanOrEqual(600);
      }
    });
});

describe('a galaxy battle with pilots in it', () => {
  it('a pilot alone, landing three hits a second, wins it at about 4:30-7:30', () => {
    for (const kind of ['assault', 'interdiction']) {
      const runs = Array.from({ length: 100 }, (_, i) => fight(kind, i, { pilots: 1, rate: 3 }));
      expect(runs.every((r) => r.winner === 0), kind).toBe(true);
      const m = median(runs.map((r) => r.at));
      expect(m, kind).toBeGreaterThanOrEqual(270);
      expect(m, kind).toBeLessThanOrEqual(450);
    }
  });
  it('four or more pilots never win it before the last stage’s gate', () => {
    for (const pilots of [4, 8, 20])
      for (let i = 0; i < 60; i++) {
        const r = fight('assault', i, { pilots, rate: 6 });
        expect(r.winner).toBe(0);
        expect(r.at, `${pilots} pilots, seed ${i}`).toBeGreaterThanOrEqual(300);
      }
  });
  it('the more a defender intercepts, the less often the attacker’s AI wins', () => {
    const rate = (credits) => Array.from({ length: N }, (_, i) => fight('assault', i, { credits })).filter((r) => r.winner === 0).length;
    const odds = [0, 10, 25, 50].map(rate);
    for (let k = 1; k < odds.length; k++) expect(odds[k]).toBeLessThanOrEqual(odds[k - 1]);
    expect(odds.at(-1)).toBeLessThan(odds[0]);
  });
});
