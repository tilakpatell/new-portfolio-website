import { describe, expect, it } from 'vitest';
import { GCW, NEIGHBOURS, WAR_SYSTEMS, battleAt, campaignAt, history, opening, pointsKey, winKey, warTable } from './gcw';

const none = () => 0;
const H = 3600e3;
const at = (n, ms) => GCW.start + n * GCW.campaign + ms;

describe('the war’s map', () => {
  it('is every system with a planet but Dagobah', () => {
    expect(WAR_SYSTEMS).toContain('endor');
    expect(WAR_SYSTEMS).toContain('hoth');
    expect(WAR_SYSTEMS).toContain('scarif');
    expect(WAR_SYSTEMS).not.toContain('dagobah');
    expect(WAR_SYSTEMS).not.toContain('alderaan');
  });
  it('has neighbours both ways, two at least each, and all of it joined up', () => {
    for (const id of WAR_SYSTEMS) {
      expect(NEIGHBOURS[id].length, id).toBeGreaterThanOrEqual(2);
      for (const o of NEIGHBOURS[id]) expect(NEIGHBOURS[o], `${o} → ${id}`).toContain(id);
    }
    const seen = new Set(['yavin']);
    const todo = ['yavin'];
    while (todo.length) for (const o of NEIGHBOURS[todo.pop()]) if (!seen.has(o)) (seen.add(o), todo.push(o));
    expect(seen.size).toBe(WAR_SYSTEMS.length);
  });
  it('opens with the Rebels at their bases and the Empire everywhere else', () => {
    const o = opening();
    for (const id of WAR_SYSTEMS) {
      expect(o.owner[id]).toBe(GCW.opening.includes(id) ? 'rebel' : 'empire');
      expect(o.control[id]).toBe(GCW.opening.includes(id) ? 1 : 0);
    }
  });
});

describe('campaignAt', () => {
  it('gives every pilot the same campaign and step for the same moment', () => {
    const c = campaignAt(at(2, 5 * H + 13 * 60e3));
    expect(c.n).toBe(2);
    expect(c.step).toBe(Math.floor((5 * H + 13 * 60e3) / GCW.step));
    expect(c.stepStart).toBe(at(2, c.step * GCW.step));
    expect(c.end).toBe(at(3, 0));
    expect(c.epoch).toBe('c2');
  });
});

describe('history', () => {
  it('is the same every time for the same moment and tally', () => {
    const a = history(1, at(1, 20 * H), none);
    const b = history(1, at(1, 20 * H), none);
    expect(a).toEqual(b);
  });
  it('has fronts at Imperial systems next to Rebel ones, no more than GCW.fronts', () => {
    const s = history(0, at(0, 30 * 60e3), none);
    expect(s.fronts.length).toBeGreaterThan(0);
    expect(s.fronts.length).toBeLessThanOrEqual(GCW.fronts);
    for (const f of s.fronts) {
      expect(s.owner[f]).toBe('empire');
      expect(NEIGHBOURS[f].some((o) => s.owner[o] === 'rebel'), f).toBe(true);
    }
  });
  it('moves on its own: over a campaign some fronts are taken and some attacks land', () => {
    let taken = 0;
    let lost = 0;
    for (let n = 0; n < 6; n++) {
      const s = history(n, at(n, GCW.campaign - 1), none);
      const o = opening();
      for (const id of WAR_SYSTEMS) {
        if (o.owner[id] === 'empire' && s.owner[id] === 'rebel') taken++;
        if (o.owner[id] === 'rebel' && s.owner[id] === 'empire') lost++;
      }
    }
    expect(taken).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
  });
  it('sends the Empire against a Rebel border system every so often, for GCW.attackFor', () => {
    const s = history(0, at(0, GCW.attackEvery + 60e3), none);
    expect(s.attack).not.toBeNull();
    expect(s.owner[s.attack.sys]).toBe('rebel');
    expect(NEIGHBOURS[s.attack.sys].some((o) => s.owner[o] === 'empire')).toBe(true);
    expect(s.attack.until - s.attack.from).toBe(GCW.attackFor);
  });
  it('lifts a front’s control by what players did there', () => {
    const s0 = history(0, at(0, 30 * 60e3), none);
    const f = s0.fronts.find((id) => s0.rates[id] >= 0);
    const step = campaignAt(at(0, 30 * 60e3)).step;
    const s1 = history(0, at(0, 30 * 60e3), (k) => (k === pointsKey(f, step) ? 20 : 0));
    expect(s1.control[f]).toBeCloseTo(s0.control[f] + 0.2, 5);
  });
  it('counts a battle won once, however many pilots tell of it', () => {
    const s0 = history(0, at(0, 30 * 60e3), none);
    const f = s0.fronts.find((id) => s0.rates[id] >= 0);
    const step = campaignAt(at(0, 30 * 60e3)).step;
    const one = history(0, at(0, 30 * 60e3), (k) => (k === winKey(f, step) ? 1 : 0));
    const three = history(0, at(0, 30 * 60e3), (k) => (k === winKey(f, step) ? 3 : 0));
    expect(one.control[f]).toBeCloseTo(s0.control[f] + GCW.points.win / 100, 5);
    expect(three.control[f]).toBe(one.control[f]);
  });
  it('gives a front to the Rebellion when its control reaches 1', () => {
    const s0 = history(0, at(0, 30 * 60e3), none);
    const f = s0.fronts[0];
    const step = campaignAt(at(0, 30 * 60e3)).step;
    const s1 = history(0, at(0, 30 * 60e3), (k) => (k === pointsKey(f, step) ? 100 : 0));
    expect(s1.owner[f]).toBe('rebel');
    expect(s1.control[f]).toBe(1);
  });
  it('loses an attacked system at 0, and gives back one held to the end whole', () => {
    // find a campaign whose first attack falls without players, and one that holds
    const cases = [];
    for (let n = 0; n < 40 && cases.length < 40; n++) {
      const s = history(n, at(n, GCW.attackEvery + 60e3), none);
      if (!s.attack) continue;
      const after = history(n, s.attack.until + 1, none);
      cases.push({ n, sys: s.attack.sys, fell: after.owner[s.attack.sys] === 'empire', after, attack: s.attack });
    }
    const fell = cases.find((c) => c.fell);
    const held = cases.find((c) => !c.fell);
    expect(fell).toBeTruthy();
    expect(held).toBeTruthy();
    expect(held.after.control[held.sys]).toBe(1);
    // and players can save one that would fall
    const steps = [];
    for (let ms = fell.attack.from; ms < fell.attack.until; ms += GCW.step) steps.push(campaignAt(ms).step);
    const saved = history(fell.n, fell.attack.until + 1, (k) => (steps.some((st) => k === pointsKey(fell.sys, st)) ? 30 : 0));
    expect(saved.owner[fell.sys]).toBe('rebel');
  });
  it('names a major order, a front, the set pieces first', () => {
    const s = history(0, at(0, 60e3), none);
    expect(s.fronts).toContain(s.major);
    expect(GCW.majors).toContain(s.major);
  });
});

describe('battleAt', () => {
  it('has a battle at a front, the Rebels attacking, on the clock everyone shares', () => {
    const ms = at(0, 24 * 60e3 + 4 * 60e3);
    const s = history(0, ms, none);
    const f = s.fronts[0];
    const b = battleAt(s, f, ms);
    const c = campaignAt(ms);
    expect(b.id).toBe(`c0.${f}.${c.step}`);
    expect(b.attacker).toBe('rebel');
    expect(b.start).toBe(c.stepStart);
    expect(b.fightEnd).toBe(c.stepStart + GCW.fight);
    expect(b.fighting).toBe(true);
    expect(b.seed).toBe(battleAt(s, f, ms + 1000).seed);
  });
  it('has the Empire attacking at a system under attack', () => {
    const ms = at(0, GCW.attackEvery + 60e3);
    const s = history(0, ms, none);
    expect(battleAt(s, s.attack.sys, ms).attacker).toBe('empire');
  });
  it('has none where there’s no fighting', () => {
    const ms = at(0, 60e3);
    const s = history(0, ms, none);
    const quiet = Object.keys(s.owner).find((id) => !s.fronts.includes(id) && s.attack?.sys !== id);
    expect(battleAt(s, quiet, ms)).toBeNull();
  });
  it('is in its lull for the end of the step', () => {
    const ms = at(0, 24 * 60e3 + GCW.fight + 30e3);
    const s = history(0, ms, none);
    expect(battleAt(s, s.fronts[0], ms).fighting).toBe(false);
  });
});

describe('warTable', () => {
  it('gives the holotable every system’s owner, control and battle, the major order and the campaign’s end', () => {
    const ms = at(0, 5 * H + 60e3);
    const w = warTable(ms, none);
    expect(w.systems.map((s) => s.id).sort()).toEqual([...WAR_SYSTEMS].sort());
    expect(w.ends).toBe(at(1, 0));
    expect(w.systems.find((s) => s.id === w.major)?.front).toBe(true);
    for (const s of w.systems) {
      expect(['rebel', 'empire']).toContain(s.owner);
      expect(s.control).toBeGreaterThanOrEqual(0);
      expect(s.control).toBeLessThanOrEqual(1);
      if (s.front || s.attack) expect(s.battle).not.toBeNull();
      if (s.front) expect(typeof s.rate).toBe('number');
    }
  });
});
