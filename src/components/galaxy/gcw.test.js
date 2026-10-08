import { describe, expect, it } from 'vitest';
import { TALLY, createTally, readTally } from '../universe/tally';
import { GCW, NEIGHBOURS, WAR_SYSTEMS, areaBonusOf, pressureOn, areaOf, battleAt, campaignAt, history, opening, pointsKey, readKey, seeded, supplyOf, warTable, warTables, winKey, worthOf } from './gcw';
import { AREAS, WARS, WAR_IDS } from './sides';
import { LANES, systemById } from './systems';
import { CAP, KEYS } from './warState';

const none = () => 0;
const H = 3600e3;
const at = (n, ms) => GCW.start + n * GCW.campaign + ms;
const stepAt = (ms) => campaignAt(ms).step;

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
  it('every route’s systems are a chain in NEIGHBOURS', () => {
    let chained = 0;
    for (const lane of LANES) {
      const seq = [];
      for (const p of lane.pts) {
        let best = null;
        let bd = Infinity;
        for (const id of WAR_SYSTEMS) {
          const s = systemById(id);
          const d = Math.hypot(s.pos[0] - p[0], s.pos[1] - p[1]);
          if (d < bd) (bd = d), (best = id);
        }
        if (bd <= GCW.routeReach && seq[seq.length - 1] !== best) seq.push(best);
      }
      for (let i = 1; i < seq.length; i++) {
        expect(NEIGHBOURS[seq[i - 1]], `${lane.id}: ${seq[i - 1]} → ${seq[i]}`).toContain(seq[i]);
        chained++;
      }
    }
    expect(chained).toBeGreaterThan(5);
  });
  it('puts every war system in an area, and has worth for it', () => {
    for (const id of WAR_SYSTEMS) {
      expect(AREAS.map((a) => a.id), id).toContain(areaOf(id));
      expect([1, 2, 3], id).toContain(worthOf(id));
    }
    expect(worthOf('coruscant')).toBe(3);
  });
  it('opens each war on its own map, every system whole', () => {
    for (const war of WAR_IDS) {
      const o = opening(war);
      const w = WARS[war];
      for (const id of WAR_SYSTEMS) {
        const named = Object.entries(w.opening).find(([, ids]) => ids.includes(id))?.[0];
        expect(o.owner[id], `${war}: ${id}`).toBe(named ?? w.raider);
        expect(o.control[id]).toBe(1);
      }
    }
    expect(opening('gcw').owner.yavin).toBe('rebel');
    expect(opening('clone').owner.geonosis).toBe('separatists');
    expect(opening('remnant').owner.tatooine).toBe('hutt');
  });
});

describe('the tally’s keys', () => {
  it('carry the side', () => {
    expect(pointsKey('rebel', 'hoth', 3)).toBe('reb:hoth:3');
    expect(winKey('separatists', 'naboo', 12)).toBe('win:sep:naboo:12');
    expect(readKey('imp:endor:7')).toEqual({ side: 'empire', war: 'gcw', win: false, sys: 'endor', step: 7 });
    expect(readKey('win:nr:lothal:2')).toEqual({ side: 'newrepublic', war: 'remnant', win: true, sys: 'lothal', step: 2 });
  });
  it('a key of the old shape is the Rebellion’s', () => {
    expect(readKey('hoth:12')).toEqual({ side: 'rebel', war: 'gcw', win: false, sys: 'hoth', step: 12 });
    expect(readKey('win:hoth:12')).toEqual({ side: 'rebel', war: 'gcw', win: true, sys: 'hoth', step: 12 });
  });
  it('anything else is nobody’s', () => {
    for (const k of ['', 'zzz:hoth:1', 'reb:nowhere:1', 'reb:hoth:x', 'win:hoth', 'reb:hoth:1:2']) expect(readKey(k), k).toBeNull();
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
    for (const war of WAR_IDS) expect(history(war, 1, at(1, 20 * H), none)).toEqual(history(war, 1, at(1, 20 * H), none));
  });
  it('has fronts where the liberator borders anyone else’s, no more than GCW.fronts, the worthiest first', () => {
    for (const war of WAR_IDS) {
      const s = history(war, 0, at(0, 30 * 60e3), none);
      const lib = WARS[war].liberator;
      expect(s.fronts.length, war).toBeGreaterThan(0);
      expect(s.fronts.length).toBeLessThanOrEqual(GCW.fronts);
      for (const f of s.fronts) {
        expect(s.owner[f]).not.toBe(lib);
        expect(NEIGHBOURS[f].some((o) => s.owner[o] === lib), f).toBe(true);
      }
      const worths = s.fronts.map(worthOf);
      expect(worths).toEqual([...worths].sort((a, b) => b - a));
      expect(s.major).toBe(s.fronts[0]);
    }
  });
  it('a Hutt world bordering the liberator is a front, sooner or later', () => {
    let found = false;
    for (let n = 0; n < 12 && !found; n++)
      for (const war of WAR_IDS)
        for (let h = 0; h < 72 && !found; h += 6) {
          const s = history(war, n, at(n, h * H), none);
          if (s.fronts.some((f) => s.owner[f] === 'hutt')) found = true;
        }
    expect(found).toBe(true);
  });
  it('moves both ways on its own: over campaigns the liberator takes systems and loses some', () => {
    for (const war of WAR_IDS) {
      const lib = WARS[war].liberator;
      let taken = 0;
      let lost = 0;
      for (let n = 0; n < 6; n++) {
        const s = history(war, n, at(n, GCW.campaign - 1), none);
        const o = opening(war);
        for (const id of WAR_SYSTEMS) {
          if (o.owner[id] !== lib && s.owner[id] === lib) taken++;
          if (o.owner[id] === lib && s.owner[id] !== lib) lost++;
        }
      }
      expect(taken, war).toBeGreaterThan(0);
      expect(lost, war).toBeGreaterThan(0);
    }
  });
  it('sends the raider against a border system every so often, for GCW.attackFor', () => {
    for (const war of WAR_IDS) {
      const { raider } = WARS[war];
      const s = history(war, 0, at(0, GCW.attackEvery + 60e3), none);
      const a = s.attacks.find((x) => x.by === raider);
      expect(a, war).toBeTruthy();
      expect(s.owner[a.sys]).not.toBe(raider);
      expect(NEIGHBOURS[a.sys].some((o) => s.owner[o] === raider)).toBe(true);
      expect(a.until - a.from).toBe(GCW.attackFor);
    }
  });
  it('the Hutts raid a main side’s system on Hutt space’s border', () => {
    let raids = 0;
    for (let n = 0; n < 6; n++)
      for (const war of WAR_IDS) {
        const s = history(war, n, at(n, GCW.raidEvery + 60e3), none);
        const a = s.attacks.find((x) => x.by === 'hutt');
        if (!a) continue;
        raids++;
        expect(s.owner[a.sys]).not.toBe('hutt');
        expect(NEIGHBOURS[a.sys].some((o) => s.owner[o] === 'hutt')).toBe(true);
        expect(a.until - a.from).toBe(GCW.raidFor);
      }
    expect(raids).toBeGreaterThan(0);
  });
  it('the Hutts can take a system, and the raider can take a Hutt world', () => {
    let hutts = 0;
    let fromHutts = 0;
    for (let n = 0; n < 20; n++)
      for (const war of WAR_IDS) {
        const o = opening(war);
        const s = history(war, n, at(n, GCW.campaign - 1), none);
        for (const id of WAR_SYSTEMS) {
          if (o.owner[id] !== 'hutt' && s.owner[id] === 'hutt') hutts++;
          if (o.owner[id] === 'hutt' && s.owner[id] === WARS[war].raider) fromHutts++;
        }
      }
    expect(hutts).toBeGreaterThan(0);
    expect(fromHutts).toBeGreaterThan(0);
  });
  it('takes a front’s hold down by what the liberator’s pilots did there', () => {
    const ms = at(0, 30 * 60e3);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const s1 = history('gcw', 0, ms, (k) => (k === pointsKey('rebel', f, stepAt(ms)) ? 20 : 0));
    expect(s1.control[f]).toBeCloseTo(s0.control[f] - 0.2, 5);
  });
  it('the holder’s pilots push back: Imperial points at a front keep it the Empire’s', () => {
    const ms = at(0, 30 * 60e3);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const k = stepAt(ms);
    const rebelsOnly = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 30 : 0));
    const both = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 30 : key === pointsKey('empire', f, k) ? 10 : 0));
    expect(both.control[f]).toBeCloseTo(rebelsOnly.control[f] + 0.1, 5);
  });
  it('a key of the old shape counts as the Rebellion’s in the Civil War, and nowhere else', () => {
    const ms = at(0, 30 * 60e3);
    const k = stepAt(ms);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const old = history('gcw', 0, ms, (key) => (key === `${f}:${k}` ? 20 : 0));
    const now = history('gcw', 0, ms, (key) => (key === pointsKey('rebel', f, k) ? 20 : 0));
    expect(old.control[f]).toBe(now.control[f]);
    expect(history('clone', 0, ms, (key) => (key === `${f}:${k}` ? 20 : 0))).toEqual(history('clone', 0, ms, none));
  });
  it('counts a battle won once, for the side that won it', () => {
    const ms = at(0, 30 * 60e3);
    const k = stepAt(ms);
    const s0 = history('gcw', 0, ms, none);
    const f = s0.fronts.find((id) => s0.control[id] > 0.5);
    const one = history('gcw', 0, ms, (key) => (key === winKey('rebel', f, k) ? 1 : 0));
    const three = history('gcw', 0, ms, (key) => (key === winKey('rebel', f, k) ? 3 : 0));
    expect(one.control[f]).toBeCloseTo(s0.control[f] - GCW.points.win / 100, 5);
    expect(three.control[f]).toBe(one.control[f]);
    const held = history('gcw', 0, ms, (key) => (key === winKey('rebel', f, k) ? 1 : key === winKey('empire', f, k) ? 1 : 0));
    expect(held.control[f]).toBeCloseTo(s0.control[f], 5);
  });
  it('gives a front to the liberator, whole, when its hold is gone', () => {
    const ms = at(0, 30 * 60e3);
    const s0 = history('clone', 0, ms, none);
    const f = s0.fronts[0];
    const s1 = history('clone', 0, ms, (key) => (key === pointsKey('republic', f, stepAt(ms)) ? 100 : 0));
    expect(s1.owner[f]).toBe('republic');
    expect(s1.control[f]).toBe(1);
  });
  it('loses an attacked system at 0, gives back one held to the end whole, and players can save one', () => {
    const cases = [];
    for (let n = 0; n < 40 && cases.length < 40; n++) {
      const s = history('gcw', n, at(n, GCW.attackEvery + 60e3), none);
      const a = s.attacks.find((x) => x.by === 'empire');
      if (!a) continue;
      const after = history('gcw', n, a.until + 1, none);
      cases.push({ n, sys: a.sys, holder: s.owner[a.sys], fell: after.owner[a.sys] === 'empire', after, attack: a });
    }
    // (one of the Rebellion's that fell: the Hutts have no pilots to save theirs)
    const fell = cases.find((c) => c.fell && c.holder === 'rebel');
    const held = cases.find((c) => !c.fell);
    expect(fell).toBeTruthy();
    expect(held).toBeTruthy();
    expect(held.after.control[held.sys]).toBe(1);
    const steps = [];
    for (let ms = fell.attack.from; ms < fell.attack.until; ms += GCW.step) steps.push(stepAt(ms));
    const saved = history('gcw', fell.n, fell.attack.until + 1, (k) => (steps.some((st) => k === pointsKey(fell.holder, fell.sys, st)) ? 30 : 0));
    expect(saved.owner[fell.sys]).toBe(fell.holder);
  });
  it('is the same for two pilots who’ve told each other a busy campaign, a message at a time, and counts its newest points', () => {
    const ms = at(0, 36 * H);
    const last = stepAt(ms);
    const a = createTally('c0', { keys: KEYS, cap: CAP });
    const b = createTally('c0', { keys: KEYS, cap: CAP });
    // each fights somewhere every step: the Rebels' pilot and the Empire's
    const rand = seeded('two pilots');
    const somewhere = () => WAR_SYSTEMS[Math.floor(rand() * WAR_SYSTEMS.length)];
    for (let k = 0; k < last; k++) {
      a.add(pointsKey('rebel', somewhere(), k), 1 + Math.floor(rand() * 20));
      b.add(pointsKey('empire', somewhere(), k), 1 + Math.floor(rand() * 20));
      if (k % 5 === 0) a.add(winKey('rebel', somewhere(), k), 1);
    }
    expect(a.keys().length + b.keys().length).toBeGreaterThan(3 * TALLY.keys);
    // and the newest: the Rebels' pilot hits the major order hard
    const s0 = history('gcw', 0, ms, (k) => a.value(k) + b.value(k));
    const f = s0.major;
    a.add(pointsKey('rebel', f, last), CAP);
    const talk = (rounds) => {
      for (let r = 0; r < rounds; r++) {
        const fromA = readTally(JSON.parse(JSON.stringify(a.message())));
        const fromB = readTally(JSON.parse(JSON.stringify(b.message())));
        b.receive('a', fromA);
        a.receive('b', fromB);
      }
    };
    talk(12);
    const forA = history('gcw', 0, ms, (k) => a.value(k));
    expect(history('gcw', 0, ms, (k) => b.value(k))).toEqual(forA);
    expect(b.value(pointsKey('rebel', f, last))).toBe(CAP);
    expect(forA.owner[f] !== s0.owner[f] || forA.control[f] < s0.control[f]).toBe(true);
  });
  it('ends a war early when one side holds every system', () => {
    const all = (k) => (k.startsWith('rep:') ? 100 : 0);
    const s = history('clone', 0, at(0, 30 * H), all);
    expect(s.over).toBe('republic');
    for (const id of WAR_SYSTEMS) expect(s.owner[id]).toBe('republic');
    expect(history('clone', 0, at(0, 30 * H), none).over).toBeNull();
  });
  it('counts each area’s systems by side, and names one held whole', () => {
    const s = history('gcw', 0, at(0, 60e3), none);
    for (const a of AREAS) {
      const r = s.areas[a.id];
      const ids = WAR_SYSTEMS.filter((id) => areaOf(id) === a.id);
      expect(r.total).toBe(ids.length);
      const sides = new Set(ids.map((id) => s.owner[id]));
      expect(r.holder).toBe(sides.size === 1 ? [...sides][0] : null);
      expect(Object.entries(r).filter(([k]) => k !== 'total' && k !== 'holder').reduce((t, [, v]) => t + v, 0)).toBe(ids.length);
    }
  });
});

describe('supply and areas', () => {
  it('Hutt space gives way at GCW.hutts of the rate anywhere else does', () => {
    expect(pressureOn('empire', 10)).toBe(10);
    expect(pressureOn('hutt', 10)).toBe(10 * GCW.hutts);
    expect(GCW.hutts).toBeLessThan(1);
  });
  const pick = WAR_SYSTEMS.find((id) => NEIGHBOURS[id].length >= 3);
  it('a front with more of the attacker’s neighbours moves faster than one with fewer', () => {
    const theirs = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'empire']));
    const ours = { ...Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'rebel'])), [pick]: 'empire' };
    expect(supplyOf(pick, ours, 'rebel')).toBeGreaterThan(supplyOf(pick, { ...theirs, [NEIGHBOURS[pick][0]]: 'rebel' }, 'rebel'));
    expect(supplyOf(pick, ours, 'rebel')).toBe(GCW.supply * (NEIGHBOURS[pick].length - 1));
  });
  it('an area held whole gives its holder’s fronts next to it the bonus', () => {
    // a system with a neighbour in another area
    const id = WAR_SYSTEMS.find((x) => NEIGHBOURS[x].some((o) => areaOf(o) !== areaOf(x)));
    const area = areaOf(NEIGHBOURS[id].find((o) => areaOf(o) !== areaOf(id)));
    const owner = Object.fromEntries(WAR_SYSTEMS.map((x) => [x, areaOf(x) === area ? 'rebel' : 'empire']));
    expect(areaBonusOf(id, owner, 'rebel')).toBe(GCW.areaBonus);
    const broken = { ...owner, [WAR_SYSTEMS.find((x) => areaOf(x) === area)]: 'hutt' };
    expect(areaBonusOf(id, broken, 'rebel')).toBe(0);
  });
});

describe('battleAt', () => {
  it('has a battle at a front, the liberator attacking, on the clock everyone shares', () => {
    const ms = at(0, 24 * 60e3 + 4 * 60e3);
    const s = history('gcw', 0, ms, none);
    const f = s.fronts[0];
    const b = battleAt(s, f, ms);
    const c = campaignAt(ms);
    expect(b.id).toBe(`c0.gcw.${f}.${c.step}`);
    expect(b.war).toBe('gcw');
    expect(b.attacker).toBe('rebel');
    expect(b.defender).toBe(s.owner[f]);
    expect(b.sides).toEqual(['rebel', s.owner[f]]);
    expect(b.attackerTeam).toBe(0);
    expect(b.start).toBe(c.stepStart);
    expect(b.fightEnd).toBe(c.stepStart + GCW.fight);
    expect(b.fighting).toBe(true);
    expect(b.seed).toBe(battleAt(s, f, ms + 1000).seed);
  });
  it('has the attacker attacking at a system under attack', () => {
    const ms = at(0, GCW.attackEvery + 60e3);
    const s = history('gcw', 0, ms, none);
    const a = s.attacks[0];
    const b = battleAt(s, a.sys, ms);
    expect(b.attacker).toBe(a.by);
    expect(b.defender).toBe(s.owner[a.sys]);
    expect(b.sides[b.attackerTeam]).toBe(a.by);
  });
  it('lists a battle’s sides by team: the light side 0, the dark 1, the Hutts in the other’s place', () => {
    const ms = at(0, 24 * 60e3);
    const s = { war: 'gcw', owner: { hoth: 'rebel', tatooine: 'hutt', endor: 'empire' }, fronts: ['tatooine'], attacks: [{ sys: 'hoth', by: 'empire' }, { sys: 'endor', by: 'hutt' }] };
    expect(battleAt(s, 'hoth', ms)).toMatchObject({ sides: ['rebel', 'empire'], attackerTeam: 1 });
    expect(battleAt(s, 'tatooine', ms)).toMatchObject({ sides: ['rebel', 'hutt'], attackerTeam: 0 });
    expect(battleAt(s, 'endor', ms)).toMatchObject({ sides: ['hutt', 'empire'], attackerTeam: 0 });
  });
  it('the same system and step in two wars are two battles', () => {
    const ms = at(0, 24 * 60e3 + 4 * 60e3);
    const a = history('gcw', 0, ms, none);
    const b = history('clone', 0, ms, none);
    const both = a.fronts.find((id) => b.fronts.includes(id));
    if (both) expect(battleAt(a, both, ms).id).not.toBe(battleAt(b, both, ms).id);
  });
  it('has none where there’s no fighting', () => {
    const ms = at(0, 60e3);
    const s = history('gcw', 0, ms, none);
    const quiet = WAR_SYSTEMS.find((id) => !s.fronts.includes(id) && !s.attacks.some((a) => a.sys === id));
    expect(battleAt(s, quiet, ms)).toBeNull();
  });
  it('is in its lull for the end of the step', () => {
    const ms = at(0, 24 * 60e3 + GCW.fight + 30e3);
    const s = history('gcw', 0, ms, none);
    expect(battleAt(s, s.fronts[0], ms).fighting).toBe(false);
  });
});

describe('warTable', () => {
  it('gives the holotable every system’s owner, hold, worth, kind, area and battle, the areas and the campaign’s end', () => {
    const ms = at(0, 5 * H + 60e3);
    for (const war of WAR_IDS) {
      const w = warTable(war, ms, none);
      const { liberator, raider } = WARS[war];
      expect(w.war).toBe(war);
      expect(w.systems.map((s) => s.id).sort()).toEqual([...WAR_SYSTEMS].sort());
      expect(w.ends).toBe(at(1, 0));
      expect(w.over).toBeNull();
      expect(Object.keys(w.areas).sort()).toEqual(AREAS.map((a) => a.id).sort());
      expect(w.systems.find((s) => s.id === w.major)?.front).toBe(true);
      for (const s of w.systems) {
        expect([liberator, raider, 'hutt']).toContain(s.owner);
        expect(s.control).toBeGreaterThanOrEqual(0);
        expect(s.control).toBeLessThanOrEqual(1);
        expect(typeof s.kind).toBe('string');
        expect(s.worth).toBe(worthOf(s.id));
        expect(s.area).toBe(areaOf(s.id));
        if (s.front || s.attack) expect(s.battle).not.toBeNull();
        if (s.front) expect(typeof s.rate).toBe('number');
      }
    }
  });
  it('warTables gives all three wars', () => {
    const t = warTables(at(0, H), none);
    expect(Object.keys(t)).toEqual(WAR_IDS);
    expect(t.clone.war).toBe('clone');
  });
});
