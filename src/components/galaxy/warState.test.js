import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GCW, pointsKey, winKey } from './gcw';
import { addPoints, addWin, onWar, receiveWar, resetWar, warMessage, warNow, warTally } from './warState';

const NOW = GCW.start + 30 * 60e3;
beforeEach(() => resetWar());
afterEach(() => resetWar());

describe('the page’s war', () => {
  it('keeps one tally for the campaign, a new one when the next starts', () => {
    const a = warTally(NOW);
    expect(warTally(NOW + 1000)).toBe(a);
    expect(warTally(NOW + GCW.campaign).epoch).toBe('c1');
  });
  it('counts your points and a win once, and tells whoever’s listening', () => {
    const heard = [];
    const off = onWar((v) => heard.push(v));
    addPoints('endor', 2, 3, NOW);
    addWin('endor', 2, NOW);
    addWin('endor', 2, NOW);
    off();
    expect(warTally(NOW).value(pointsKey('endor', 2))).toBe(3);
    expect(warTally(NOW).value(winKey('endor', 2))).toBe(1);
    expect(heard.length).toBe(2);
    expect(warMessage(NOW).m[pointsKey('endor', 2)]).toBe(3);
  });
  it('learns what other pilots did, and the war table moves with it', () => {
    const before = warNow(NOW);
    const front = before.systems.find((s) => s.front && s.rate >= 0);
    expect(receiveWar('peer', { e: 'c0', m: { [pointsKey(front.id, 2)]: 20 }, t: {} }, NOW)).toBe(true);
    const after = warNow(NOW);
    expect(after.systems.find((s) => s.id === front.id).control).toBeGreaterThan(front.control);
  });
});
