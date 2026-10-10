// The skirmish arena (spec section 9), under `npm run test:ai`: twenty bots
// a side on Hoth's arena navgrid for three minutes, no player, no mode.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { runSkirmish } from './skirmish.js';

const rb = loadRulebook();
const nav = hothFlatNav(rb);
const log = (r) => JSON.stringify(r.events);

describe('the skirmish arena', () => {
  const t0 = performance.now();
  const one = runSkirmish({ rulebook: rb, nav, seed: 1, bots: 20, seconds: 180 });
  const ms = performance.now() - t0;

  it('is a fight both sides win kills in', () => {
    expect(one.kills[1]).toBeGreaterThan(5);
    expect(one.kills[2]).toBeGreaterThan(5);
  });

  it('leaves no bot standing still for 20 s out of cover, and none off the navgrid', () => {
    expect(one.stuck).toBe(0);
    expect(one.offNav).toBe(0);
  });

  it('gives one battle from one seed and another from another', () => {
    const again = runSkirmish({ rulebook: rb, nav, seed: 1, bots: 20, seconds: 180 });
    expect(log(again)).toBe(log(one));
    const other = runSkirmish({ rulebook: rb, nav, seed: 2, bots: 20, seconds: 60 });
    expect(log(other)).not.toBe(JSON.stringify(one.events.filter((e) => e.t <= 60)));
  });

  it('runs inside a minute of Node', () => {
    expect(ms).toBeLessThan(60000);
  });
}, 120000);
