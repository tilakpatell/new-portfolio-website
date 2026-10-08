// The galaxy's wars over whole campaigns: the bands the strategy (gcwAI.js)
// was tuned to, over 20 campaigns of each war, with nobody playing and with
// a pilot grinding the major order every step (100 points and a win, more
// than one pilot can score: the soft cap takes the rest). Slow (half a
// minute), so it's kept out of `npm test` (vite.config.js); run it with
//   npx vitest run src/components/galaxy/gcw.scenario.test.js
// A campaign is worked a step at a time from one run (campaignRun), which
// comes to history's (the last tests here, and gcw.test.js's).

import { describe, expect, it } from 'vitest';
import { createTally } from '../universe/tally';
import { GCW, WAR_SYSTEMS, campaignRun, history, pointsKey, runAt, seeded, winKey, worthOf } from './gcw';
import { SIDES, WARS, WAR_IDS } from './sides';
import { CAP, KEYS } from './warState';

const CAMPAIGNS = 20;
const STEPS = GCW.campaign / GCW.step;
const CLIMAX = GCW.phases.at(-1).from;
const atStep = (n, k) => GCW.start + n * GCW.campaign + k * GCW.step;
const TOTAL_WORTH = WAR_SYSTEMS.reduce((t, id) => t + worthOf(id), 0);

// one campaign, a step at a time: what each step began with, and what came of it
function campaign(war, n, grind) {
  const { liberator, raider } = WARS[war];
  const code = SIDES[liberator].code;
  const majorAt = [];
  // (the grinding pilot's at the major order of each step, as soon as it's known)
  const value = grind
    ? (key) => {
        const [first, ...rest] = key.split(':');
        const [c, sys, step] = first === 'win' ? rest : [first, ...rest];
        if (c !== code || majorAt[+step] !== sys) return 0;
        return first === 'win' ? 1 : 100;
      }
    : () => 0;
  const run = campaignRun(war, n, value);
  const out = { changes: 0, fewest: Infinity, overAt: null, majorStuck: 0, ordersStuck: 0, orders: 0, steps: 0, attacks: 0, taken: 0, cut: 0, huttsHeld: 0 };
  let prev = null;
  for (let k = 0; k < STEPS; k++) {
    const s = runAt(run, atStep(n, k));
    majorAt[k] = s.fronts[0];
    if (s.over) {
      out.overAt = s.step;
      break;
    }
    out.steps += 1;
    out.cut += s.cut.length;
    if (k < CLIMAX) for (const side of [liberator, raider, 'hutt']) out.fewest = Math.min(out.fewest, WAR_SYSTEMS.filter((id) => s.owner[id] === side).length);
    if (prev) {
      for (const id of WAR_SYSTEMS) if (s.owner[id] !== prev.owner[id]) out.changes += 1;
      // (an attack that's over: taken, or held)
      for (const a of prev.attacks)
        if (a.by !== 'hutt' && !s.attacks.some((x) => x.sys === a.sys && x.from === a.from)) {
          out.attacks += 1;
          if (s.owner[a.sys] === a.by) out.taken += 1;
          else if (prev.owner[a.sys] === 'hutt') out.huttsHeld += 1;
        }
    }
    // stuck: no push to speak of (GCW.stuck) where the major or an order is
    const pushed = (id) => s.eff[id] > GCW.stuck;
    if (!s.fronts[0] || !pushed(s.fronts[0])) out.majorStuck += 1;
    for (const side of [liberator, raider]) {
      const o = s.orders[side];
      if (!o && side === raider) continue;
      out.orders += 1;
      if (!o || !pushed(o.sys)) out.ordersStuck += 1;
    }
    prev = s;
  }
  return out;
}

describe.each([
  ['nobody playing', false],
  ['a pilot grinding the major order every step', true],
])('the wars over %s', (_, grind) => {
  for (const war of WAR_IDS)
    it(`${war}: nobody's wiped out before the Climax, it keeps changing hands, and nothing's stuck`, () => {
      const runs = Array.from({ length: CAMPAIGNS }, (__, n) => campaign(war, n, grind));
      for (const [n, c] of runs.entries()) {
        const at = `${war} c${n}`;
        expect(c.fewest, `${at}: the fewest systems a side had before the Climax`).toBeGreaterThan(0);
        expect(c.overAt ?? STEPS, `${at}: over at`).toBeGreaterThanOrEqual(CLIMAX);
        expect(c.changes, `${at}: systems that changed hands`).toBeGreaterThanOrEqual(12);
        expect(c.majorStuck / c.steps, `${at}: the major order stuck`).toBeLessThanOrEqual(0.1);
        expect(c.ordersStuck / c.orders, `${at}: orders stuck`).toBeLessThanOrEqual(0.1);
      }
      if (!grind) {
        // left alone, a war stays a war: its attacks take about half they're sent at,
        // and the liberator ends near where it began
        const attacks = runs.reduce((t, c) => t + c.attacks, 0);
        const taken = runs.reduce((t, c) => t + c.taken, 0);
        expect(taken / attacks, `${war}: attacks that took their system`).toBeGreaterThanOrEqual(0.3);
        expect(taken / attacks).toBeLessThanOrEqual(0.6);
        // and few are thrown away at Hutt worlds they can't take (14 to 18% were)
        const wasted = runs.reduce((t, c) => t + c.huttsHeld, 0);
        expect(wasted / attacks, `${war}: attacks the Hutts held out against`).toBeLessThan(0.1);
        const { liberator } = WARS[war];
        const began = Object.values(WARS[war].opening[liberator]).length;
        const ended = runs.reduce((t, __, n) => t + WAR_SYSTEMS.filter((id) => history(war, n, atStep(n, STEPS) - 1).owner[id] === liberator).length, 0) / CAMPAIGNS;
        expect(Math.abs(ended - began), `${war}: the liberator's systems, began ${began}, ended ${ended}`).toBeLessThanOrEqual(2);
        // and its share of the galaxy's worth is within a quarter of where it began
        // (the brief's band: the Remnant War's New Republic went from 70% to 35%)
        const worth = (owner) => WAR_SYSTEMS.reduce((t, id) => t + (owner[id] === liberator ? worthOf(id) : 0), 0) / TOTAL_WORTH;
        const opened = worth(Object.fromEntries(WARS[war].opening[liberator].map((id) => [id, liberator])));
        const share = runs.reduce((t, __, n) => t + worth(history(war, n, atStep(n, STEPS) - 1).owner), 0) / CAMPAIGNS;
        expect(share / opened, `${war}: the liberator's share of the worth, began ${opened.toFixed(2)}, ended ${share.toFixed(2)}`).toBeGreaterThanOrEqual(0.75);
        expect(share / opened).toBeLessThanOrEqual(1.25);
        // and being cut off from supply is an encirclement, not the way of things (it was
        // 41 to 56% of every system-step, when supply ran from a side's capital alone)
        const cut = runs.reduce((t, c) => t + c.cut, 0) / runs.reduce((t, c) => t + c.steps * WAR_SYSTEMS.length, 0);
        expect(cut, `${war}: the share of system-steps cut off`).toBeLessThanOrEqual(0.25);
      }
    });
});

describe('the cost of a campaign', () => {
  // a busy campaign's tally: both sides' pilots somewhere every step, now and then winning
  const busy = (war) => {
    const t = createTally('c0', { keys: KEYS, cap: CAP });
    const rand = seeded(`busy-${war}`);
    const sides = [WARS[war].liberator, WARS[war].raider];
    for (let i = 0; i < 1500; i++) {
      const k = Math.floor(rand() * STEPS);
      const sys = WAR_SYSTEMS[Math.floor(rand() * WAR_SYSTEMS.length)];
      if (i % 7 === 0) t.add(winKey(sides[i % 2], sys, k), 1);
      else t.add(pointsKey(sides[i % 2], sys, k), 1 + Math.floor(rand() * 40));
    }
    return t;
  };
  it('a whole campaign’s history, with a 1,500-key tally, in under 25 ms (a loose guard: it was 8 ms here)', () => {
    for (const war of WAR_IDS) {
      const t = busy(war);
      expect(t.keys().length).toBeGreaterThan(1400);
      const v = (k) => t.value(k);
      const end = atStep(0, STEPS) - 1;
      for (let i = 0; i < 3; i++) history(war, 0, end, v);
      const times = [];
      for (let i = 0; i < 9; i++) {
        const t0 = performance.now();
        history(war, 0, end, v);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      expect(times[4], `${war}: the median of 9, ms`).toBeLessThan(25);
    }
  });
  it('worked on from a checkpoint comes to history’s at 20 moments, in every war', () => {
    for (const war of WAR_IDS) {
      const t = busy(war);
      const v = (k) => t.value(k);
      const run = campaignRun(war, 0, v);
      const rand = seeded(`moments-${war}`);
      const moments = Array.from({ length: 20 }, () => Math.floor(rand() * GCW.campaign)).sort((a, b) => a - b);
      for (const m of moments) expect(runAt(run, atStep(0, 0) + m), `${war} ${m}`).toEqual(history(war, 0, atStep(0, 0) + m, v));
    }
  });
});
