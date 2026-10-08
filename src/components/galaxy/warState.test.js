import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TALLY, createTally, readTally } from '../universe/tally';
import * as gcw from './gcw';
import { GCW, WAR_SYSTEMS, campaignAt, campaignResult, history, pointsKey, seeded, warTable, winKey } from './gcw';
import { soft } from './gcwAI';
import { CAP, RECAP, addPoints, addWin, mine, onWar, receiveWar, resetWar, warMessage, warNow, warTally } from './warState';

// (gcw.js as it is, but counting the campaigns worked through from the start)
vi.mock('./gcw', async (original) => {
  const real = await original();
  return { ...real, campaignRun: vi.fn(real.campaignRun) };
});

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

describe('the war table each second', () => {
  it('is worked on from the last whole step, and comes to the same as the war worked through whole', () => {
    // a busy campaign: both sides' pilots somewhere every step, a reload's worth of keys
    const rand = seeded('busy page');
    const end = GCW.start + GCW.campaign;
    for (let i = 0; i < 1500; i++) {
      const step = Math.floor(rand() * (GCW.campaign / GCW.step));
      const side = i % 2 ? 'rebel' : 'empire';
      const sys = WAR_SYSTEMS[Math.floor(rand() * WAR_SYSTEMS.length)];
      if (i % 9 === 0) addWin(side, sys, step, GCW.start);
      else addPoints(side, sys, step, 1 + Math.floor(rand() * 30), GCW.start);
    }
    const t = warTally(GCW.start);
    const moments = Array.from({ length: 20 }, () => GCW.start + Math.floor(rand() * GCW.campaign)).sort((a, b) => a - b);
    moments.splice(10, 0, moments[2]); // (and back)
    for (const ms of moments) expect(warNow(ms, 'gcw'), `${ms - GCW.start}`).toEqual(warTable('gcw', ms, (k) => t.value(k)));
    expect(warNow(end - 1, 'gcw')).toEqual(warTable('gcw', end - 1, (k) => t.value(k)));
  });
  it('works only the steps since, a second at a time, and only from the start when what changed is behind it', () => {
    gcw.campaignRun.mockClear();
    const ms = GCW.start + 30 * 3600e3;
    for (let i = 0; i < 60; i++) warNow(ms + i * 1000, 'gcw');
    expect(gcw.campaignRun).toHaveBeenCalledTimes(1);
    // (your own points now: the step that's on, worked again; the steps before it kept)
    const k = campaignAt(ms).step;
    addPoints('rebel', 'hoth', k, 5, ms);
    warNow(ms + 61e3, 'gcw');
    expect(gcw.campaignRun).toHaveBeenCalledTimes(1);
    // (points told of from hours back: from the start again)
    addPoints('rebel', 'hoth', k - 20, 5, ms);
    const after = warNow(ms + 62e3, 'gcw');
    expect(gcw.campaignRun).toHaveBeenCalledTimes(2);
    expect(after).toEqual(warTable('gcw', ms + 62e3, (key) => warTally(ms).value(key)));
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

describe('the campaign before', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const NEXT = GCW.start + GCW.campaign;
  // (the Rebellion's pilots at the Civil War's every front in its first day: a result of their making)
  const fight = () => {
    for (let k = 0; k < 120; k++) for (const id of history('gcw', 0, GCW.start + k * GCW.step).fronts) addPoints('rebel', id, k, 40, GCW.start + k * GCW.step);
  };
  it('is kept, as this browser knew it, for the first RECAP of the next', () => {
    fight();
    const t = warTally(NOW);
    const result = campaignResult('gcw', 0, (k) => t.value(k));
    expect(result).not.toEqual(campaignResult('gcw', 0));
    expect(warNow(NOW, 'gcw').previous).toBeNull();
    expect(warNow(NEXT + 60e3, 'gcw').previous).toEqual(result);
    expect(warNow(NEXT + RECAP - 1000, 'clone').previous).toEqual(campaignResult('clone', 0));
    expect(warNow(NEXT + RECAP, 'gcw').previous).toBeNull();
  });
  it('comes back after a reload, and from a tally kept from the campaign before', () => {
    vi.useFakeTimers();
    const kept = new Map();
    vi.stubGlobal('window', { localStorage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)) } });
    fight();
    const result = campaignResult('gcw', 0, (k) => warTally(NOW).value(k));
    vi.advanceTimersByTime(2000); // (kept)
    // back the next day: the campaign before's tally is still in tp-gcw
    resetWar();
    expect(warNow(NEXT + 3600e3, 'gcw').previous).toEqual(result);
    // and reloaded again: the result's in tp-gcw-last now, the tally gone
    resetWar();
    expect(JSON.parse(kept.get('tp-gcw')).e).toBe('c1');
    expect(warNow(NEXT + 2 * 3600e3, 'gcw').previous).toEqual(result);
  });
  it('isn’t known to a browser that knew nothing of it', () => {
    expect(warNow(NEXT + 60e3, 'gcw').previous).toBeNull();
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
    // (each row carries how much of the system's hold you moved as well, for the holotable's
    // "your part": Endor's 3 points and the win, Hoth's 1 point; the next test has the rule)
    expect(m.systems).toEqual([
      { id: 'endor', wins: 1, losses: 0, moved: 0.13 },
      { id: 'hoth', wins: 0, losses: 1, moved: 0.01 },
    ]);
  });
  it('knows how much of each system’s hold you moved: your share of what your side did there, as the war counts it', () => {
    addPoints('rebel', 'hoth', 3, 20, NOW);
    addPoints('rebel', 'endor', 4, 40, NOW);
    addWin('rebel', 'endor', 4, NOW);
    const moved = () => Object.fromEntries(mine('gcw', NOW).systems.map((x) => [x.id, x.moved]));
    expect(moved().hoth).toBeCloseTo(soft(0.2), 4);
    // (a side's points and its win at a system in a step count softly: gcwAI.js's soft)
    expect(moved().endor).toBeCloseTo(soft(0.4 + GCW.points.win / 100), 4);
    expect(moved().endor).toBeLessThan(0.5);
    // (another pilot's as many points there: half of what the side did is yours)
    receiveWar('peer', { e: 'c0', m: { [pointsKey('rebel', 'hoth', 3)]: 20 }, t: {} }, NOW);
    expect(moved().hoth).toBeCloseTo(soft(0.4) / 2, 4);
  });
  it('knows a win at the major order', () => {
    const ms = GCW.start + 30 * 60e3;
    const k = campaignAt(ms).step;
    const major = history('gcw', 0, ms).major;
    addWin('rebel', major, k, ms);
    expect(mine('gcw', ms).major).toBe(true);
  });
  it('judges the major order by the war as the players made it, not as it would have gone without them', () => {
    // the Rebellion's pilots take their first order in the first three steps, so it gives another
    const ai = history('gcw', 0, GCW.start + 6 * 3600e3);
    const f = history('gcw', 0, GCW.start + 30 * 60e3).major;
    const pts = (key) => ([0, 1, 2].some((k) => key === pointsKey('rebel', f, k)) ? 100 : 0);
    const real = history('gcw', 0, GCW.start + 6 * 3600e3, pts);
    const k = real.majors.findIndex((m, i) => i > 3 && m !== ai.majors[i]);
    expect(k).toBeGreaterThan(3);
    for (const step of [0, 1, 2]) addPoints('rebel', f, step, 100, GCW.start);
    const ms = GCW.start + k * GCW.step + 60e3;
    addWin('rebel', real.majors[k], k, ms);
    expect(mine('gcw', ms).major).toBe(true);
  });
  it('goes over the tally once for a record of many battles, and not again till it changes', () => {
    const ms = GCW.start + 40 * 3600e3;
    const last = campaignAt(ms).step;
    for (let i = 0; i < 40; i++) {
      const step = Math.floor((i * last) / 40);
      addPoints('rebel', WAR_SYSTEMS[i % WAR_SYSTEMS.length], step, 3, ms);
      addWin('rebel', WAR_SYSTEMS[i % WAR_SYSTEMS.length], step, ms);
    }
    gcw.campaignRun.mockClear();
    const record = mine('gcw', ms);
    expect(record.wins).toBe(40);
    expect(gcw.campaignRun.mock.calls.length).toBeLessThanOrEqual(1);
    expect(mine('gcw', ms + 1000)).toBe(record);
    expect(gcw.campaignRun.mock.calls.length).toBeLessThanOrEqual(1);
    addWin('rebel', 'hoth', last, ms);
    expect(mine('gcw', ms).wins).toBe(41);
  });
});
