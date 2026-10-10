import { describe, expect, it } from 'vitest';
import { createImpacts } from '../../../lib/impact';
import { KNOCK, createKnocks } from './knocks';

// heard → knocks: the physics' hit as a thud, a puff and a kick (footScene.js)
const setup = ({ reduced = false, me = [0, 0, 0], metre = 1 } = {}) => {
  let t = 0;
  const thuds = [];
  const bursts = [];
  const kicks = [];
  const knocks = createKnocks({
    rules: createImpacts({ now: () => t, random: () => 0 }),
    thud: (o) => thuds.push(o),
    dust: { burst: (at, n, up) => bursts.push({ at, n, up }), update() {}, dispose() {} },
    up: (p) => [0, 1, 0].map((a, i) => a + 0 * p[i]),
    listener: () => ({ position: me, forward: [0, 0, 1] }),
    me: () => me,
    metre,
    kick: (v) => kicks.push(v),
    reduced,
  });
  return { knocks, thuds, bursts, kicks, later: (s) => (t += s) };
};

describe('a landing’s knocks', () => {
  it('thuds, puffs and kicks a full knock at your feet as the stock gun kicks', () => {
    const { knocks, thuds, bursts, kicks } = setup();
    knocks.heard(500, [0, 0, 0], 'barrel');
    expect(thuds).toHaveLength(1);
    expect(thuds[0].gain).toBe(1);
    expect(bursts).toHaveLength(1);
    expect(bursts[0].up).toEqual([0, 1, 0]);
    expect(kicks).toHaveLength(1);
    expect(kicks[0]).toBeCloseTo(KNOCK.kick, 9);
  });

  it('says nothing under the law’s threshold, and a thing once within its gap', () => {
    const { knocks, thuds, later } = setup();
    knocks.heard(10, [0, 0, 0], 'diya');
    expect(thuds).toEqual([]);
    knocks.heard(200, [0, 0, 0], 'diya');
    knocks.heard(200, [0, 0, 0], 'diya');
    expect(thuds).toHaveLength(1);
    later(0.2);
    knocks.heard(200, [0, 0, 0], 'diya');
    expect(thuds).toHaveLength(2);
  });

  it('kicks less the further off and the quieter it is, and not at all past KNOCK.near', () => {
    const { knocks, kicks } = setup({ metre: 2 });
    knocks.heard(500, [2 * KNOCK.near * 0.5, 0, 0], 'a');
    expect(kicks[0]).toBeCloseTo(KNOCK.kick * 0.5, 9);
    knocks.heard(70, [0, 0, 0], 'b');
    expect(kicks[1]).toBeGreaterThan(0);
    expect(kicks[1]).toBeLessThan(KNOCK.kick * 0.5);
    knocks.heard(500, [2 * (KNOCK.near + 1), 0, 0], 'c');
    expect(kicks).toHaveLength(2);
  });

  it('holds the view still with reduced motion, and the thud and the puff go on', () => {
    const { knocks, thuds, bursts, kicks } = setup({ reduced: true });
    knocks.heard(500, [0, 0, 0], 'barrel');
    expect(kicks).toEqual([]);
    expect(thuds).toHaveLength(1);
    expect(bursts).toHaveLength(1);
  });

  it('hears nothing with nobody there to hear it', () => {
    const { knocks, thuds } = setup({ me: null });
    knocks.heard(500, [0, 0, 0], 'barrel');
    expect(thuds).toEqual([]);
  });
});
