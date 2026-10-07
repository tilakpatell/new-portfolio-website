import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TALLY, readTally } from '../universe/tally';
import { GCW, WAR_SYSTEMS, campaignAt, history, pointsKey, winKey } from './gcw';
import { addPoints, addWin, mine, onWar, receiveWar, resetWar, warMessage, warNow, warTally } from './warState';

const NOW = GCW.start + 30 * 60e3;
beforeEach(() => resetWar());
afterEach(() => resetWar());

describe('the page’s war', () => {
  it('keeps one tally for the campaign, a new one when the next starts', () => {
    const a = warTally(NOW);
    expect(warTally(NOW + 1000)).toBe(a);
    expect(warTally(NOW + GCW.campaign).epoch).toBe('c1');
  });
  it('puts points under the side’s key, counts a win once a side, and tells whoever’s listening', () => {
    const heard = [];
    const off = onWar((v) => heard.push(v));
    addPoints('rebel', 'endor', 2, 3, NOW);
    addWin('rebel', 'endor', 2, NOW);
    addWin('rebel', 'endor', 2, NOW);
    addWin('empire', 'endor', 2, NOW);
    off();
    expect(warTally(NOW).value(pointsKey('rebel', 'endor', 2))).toBe(3);
    expect(warTally(NOW).value(winKey('rebel', 'endor', 2))).toBe(1);
    expect(warTally(NOW).value(winKey('empire', 'endor', 2))).toBe(1);
    expect(heard.length).toBe(3);
    expect(warMessage(NOW).m[pointsKey('rebel', 'endor', 2)]).toBe(3);
  });
  it('scores nothing for nobody’s side, or the Hutts’', () => {
    addPoints(null, 'endor', 2, 3, NOW);
    addPoints('hutt', 'endor', 2, 3, NOW);
    addWin(null, 'endor', 2, NOW);
    expect(warTally(NOW).keys()).toEqual([]);
  });
  it('learns what other pilots did, and the war table moves with it', () => {
    const before = warNow(NOW);
    const front = before.systems.find((s) => s.front && s.control > 0.5);
    expect(receiveWar('peer', { e: 'c0', m: { [pointsKey('rebel', front.id, 2)]: 20 }, t: {} }, NOW)).toBe(true);
    const after = warNow(NOW);
    expect(after.systems.find((s) => s.id === front.id).control).toBeLessThan(front.control);
  });
  it('gives each war’s table, the Civil War’s by default', () => {
    expect(warNow(NOW).war).toBe('gcw');
    expect(warNow(NOW, 'clone').war).toBe('clone');
  });
  it('keeps counting in a busy campaign, past what a message holds, and tells it a message at a time', () => {
    const ms = GCW.start + 24 * 3600e3;
    const k = campaignAt(ms).step;
    // a day of fighting: points somewhere in every step, the three wars over
    const sides = ['rebel', 'empire', 'republic', 'separatists', 'newrepublic', 'remnant'];
    for (let step = 0; step < k; step++) addPoints(sides[step % sides.length], WAR_SYSTEMS[step % WAR_SYSTEMS.length], step, 1, ms);
    expect(warTally(ms).keys().length).toBeGreaterThan(TALLY.keys);
    const before = warNow(ms);
    const front = before.systems.find((s) => s.front && s.control > 0.5);
    addPoints('rebel', front.id, k, 20, ms);
    addWin('rebel', front.id, k, ms);
    expect(warTally(ms).value(pointsKey('rebel', front.id, k))).toBe(20);
    expect(warTally(ms).value(winKey('rebel', front.id, k))).toBe(1);
    expect(warNow(ms).systems.find((s) => s.id === front.id).control).toBeLessThan(front.control);
    const msg = readTally(JSON.parse(JSON.stringify(warMessage(ms))));
    expect(msg.m[pointsKey('rebel', front.id, k)]).toBe(20);
    expect(Object.keys(msg.t).length).toBeLessThanOrEqual(TALLY.keys);
  });
});

describe('mine', () => {
  it('sums only your own shares, in the war asked about', () => {
    addPoints('rebel', 'endor', 2, 3, NOW);
    addPoints('rebel', 'hoth', 3, 1.5, NOW);
    addPoints('republic', 'naboo', 3, 7, NOW);
    receiveWar('peer', { e: 'c0', m: { [pointsKey('rebel', 'endor', 2)]: 40 }, t: {} }, NOW);
    const m = mine('gcw', NOW);
    expect(m.points).toBeCloseTo(4.5, 5);
    expect(m.battles).toBe(2);
    expect(mine('clone', NOW).points).toBe(7);
    expect(mine('remnant', NOW)).toEqual({ points: 0, wins: 0, battles: 0, systems: [], major: false });
  });
  it('counts a battle won by your side, and one lost to the other', () => {
    addPoints('rebel', 'endor', 2, 3, NOW);
    addWin('rebel', 'endor', 2, NOW);
    addPoints('rebel', 'hoth', 3, 1, NOW);
    receiveWar('peer', { e: 'c0', m: { [winKey('empire', 'hoth', 3)]: 1 }, t: {} }, NOW);
    const m = mine('gcw', NOW);
    expect(m.wins).toBe(1);
    expect(m.systems).toEqual([
      { id: 'endor', wins: 1, losses: 0 },
      { id: 'hoth', wins: 0, losses: 1 },
    ]);
  });
  it('knows a win at the major order', () => {
    const ms = GCW.start + 30 * 60e3;
    const k = campaignAt(ms).step;
    const major = history('gcw', 0, ms).major;
    addWin('rebel', major, k, ms);
    expect(mine('gcw', ms).major).toBe(true);
  });
});
