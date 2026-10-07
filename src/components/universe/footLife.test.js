import { describe, expect, it } from 'vitest';
import { FOLLOW, GREET, MATE, followMove, greetStep, mateDown, mateHit, mateStand, readWalkerExtras, saidFor, walkerExtras } from './footLife';
import { readEmoteWire } from '../../lib/emote';

describe('a landing figure greets you', () => {
  it('waves and talks the first time you come within its radius, looks while you are near, and not again at once', () => {
    let st = {};
    let r = greetStep(st, { d: 20, r: 3, t: 0, line: 'Better call Saul!' });
    expect(r.wave).toBe(false);
    expect(r.look).toBe(false);
    r = greetStep(r.st, { d: 6, r: 3, t: 1, line: 'Better call Saul!' });
    expect(r.look).toBe(true);
    expect(r.wave).toBe(false);
    r = greetStep(r.st, { d: 2.5, r: 3, t: 2, line: 'Better call Saul!' });
    expect(r.wave).toBe(true);
    expect(r.talk).toBeCloseTo(saidFor('Better call Saul!'));
    // still there: no second wave; away and back inside the cooldown: none either
    r = greetStep(r.st, { d: 2.5, r: 3, t: 3, line: 'Better call Saul!' });
    expect(r.wave).toBe(false);
    r = greetStep(r.st, { d: 9, r: 3, t: 4 });
    r = greetStep(r.st, { d: 2, r: 3, t: 5, line: 'Better call Saul!' });
    expect(r.wave).toBe(false);
    r = greetStep(r.st, { d: 9, r: 3, t: 6 });
    r = greetStep(r.st, { d: 2, r: 3, t: 2 + GREET.cooldown + 1, line: 'Better call Saul!' });
    expect(r.wave).toBe(true);
  });
  it('talks for as long as its line takes, within bounds, and not at all without one', () => {
    expect(saidFor('Hi.')).toBeCloseTo(1.8);
    expect(saidFor('one two three four five six seven eight nine ten')).toBeCloseTo(1.2 + 10 * 0.32);
    expect(saidFor('a '.repeat(80))).toBe(9);
    expect(saidFor(null)).toBe(0);
    expect(greetStep({}, { d: 1, r: 3, t: 0 }).talk).toBe(0);
  });
});

describe('the mate keeps up', () => {
  it('sets off past the start gap, slows in to arrive, and stops under the stop gap, with nothing in between', () => {
    let r = followMove(1.0, {});
    expect(r.move).toBe(0);
    r = followMove(FOLLOW.start + 0.1, r.st);
    expect(r.move).toBeGreaterThan(0.3);
    expect(r.run).toBe(false);
    r = followMove(1.0, r.st); // still going: between the two
    expect(r.move).toBeGreaterThan(0);
    r = followMove(FOLLOW.stop - 0.1, r.st);
    expect(r.move).toBe(0);
    r = followMove(1.0, r.st); // stopped: between the two
    expect(r.move).toBe(0);
  });
  it('runs when far behind and walks in the last metres', () => {
    const far = followMove(FOLLOW.far + 1, {});
    expect(far.run).toBe(true);
    expect(far.move).toBe(1);
    const near = followMove(FOLLOW.stop + 0.4, { going: true });
    expect(near.run).toBe(false);
    expect(near.move).toBeLessThan(1);
    expect(near.move).toBeGreaterThanOrEqual(0.3);
  });
});

describe('a hit on the mate', () => {
  it('takes health, flinches from now, goes down when it is gone, and gets up whole after a while', () => {
    let st = mateHit({}, 30, 1);
    expect(st.health).toBe(MATE.health - 30);
    expect(st.hitAt).toBe(1);
    expect(st.downAt).toBeNull();
    st = mateHit(st, 200, 2);
    expect(st.health).toBe(0);
    expect(st.downAt).toBe(2);
    expect(mateDown(st, 2)).toBe(0);
    expect(mateDown(st, 3)).toBe(1);
    // more hits while down change nothing
    expect(mateHit(st, 10, 3)).toBe(st);
    expect(mateStand(st, 4, 1 / 60)).toBe(st);
    const up = mateStand(st, 2 + MATE.down, 1 / 60);
    expect(up.downAt).toBeNull();
    expect(up.health).toBe(MATE.health);
    expect(mateDown(up, 7)).toBe(0);
  });
  it('heals once out of trouble a while', () => {
    const st = mateHit({}, 40, 0);
    expect(mateStand(st, 2, 1).health).toBe(60);
    expect(mateStand(st, 5, 1).health).toBe(72);
    expect(mateStand({ health: 99, hitAt: 0 }, 10, 1).health).toBe(MATE.health);
  });
});

describe('the wire', () => {
  it('carries an emote, a flinch and a fall beside where you are, and leaves them out when there is nothing', () => {
    expect(walkerExtras({ t: 10 })).toEqual({});
    const x = walkerExtras({ emote: { id: 'wave', at: 9 }, t: 10, hitAt: 9.9, down: 0.5 });
    expect(readEmoteWire(x.e)).toEqual({ id: 'wave', age: 1 });
    expect(x.hurt).toBeCloseTo(0.75);
    expect(x.down).toBe(0.5);
    expect(readWalkerExtras(x)).toEqual({ emote: x.e, hurt: 0.75, down: 0.5 });
  });
  it('reads an older client’s packet as none of those', () => {
    expect(readWalkerExtras({ who: 'rick', speed: 1 })).toEqual({ emote: null, hurt: 0, down: 0 });
    expect(readWalkerExtras({ e: 'wave', hurt: 'x', down: 9 })).toEqual({ emote: null, hurt: 0, down: 1 });
    expect(readWalkerExtras(null)).toEqual({ emote: null, hurt: 0, down: 0 });
  });
});
