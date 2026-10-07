import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTally, readTally } from '../universe/tally';
import { GCW, campaignAt, history, pointsKey, winKey } from './gcw';
import { CAP, addPoints, addWin, mine, onWar, receiveWar, resetWar, warMessage, warNow, warTally } from './warState';

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
});

describe('a reload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('comes back as the same pilot in the war, so a pilot who stayed online counts them once', () => {
    vi.useFakeTimers();
    const kept = new Map();
    vi.stubGlobal('window', { localStorage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)) } });
    const wire = (msg) => readTally(JSON.parse(JSON.stringify(msg)));
    addPoints('rebel', 'endor', 2, 3, NOW);
    const before = wire(warMessage(NOW));
    vi.advanceTimersByTime(2000); // (kept)
    resetWar(); // the page reloaded: its tally back from tp-gcw, under a new peer id
    expect(warTally(NOW).mine(pointsKey('rebel', 'endor', 2))).toBe(3);
    const other = createTally('c0', { cap: CAP });
    other.receive('peer-before', before);
    other.receive('peer-after', wire(warMessage(NOW)));
    expect(other.value(pointsKey('rebel', 'endor', 2))).toBe(3);
    addPoints('rebel', 'endor', 2, 1, NOW);
    other.receive('peer-after', wire(warMessage(NOW)));
    expect(other.value(pointsKey('rebel', 'endor', 2))).toBe(4);
    expect(warMessage(NOW).i).toBe(before.i);
    // (and the next campaign, a pilot new to it)
    expect(warMessage(NOW + GCW.campaign).i).not.toBe(before.i);
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
