import { describe, expect, it } from 'vitest';
import { AHEAD_OF, SIDES, allKinds, factionsOf, kindsOf, namesOf, pick, sideFor, sideOf, squadKinds, wingOf } from './sides';
import { CREWS } from './crews';
import { TROOPS } from './foot';
import { BUILT_KINDS } from './trafficModels';
import { GLB } from './glbFleet';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const drawable = (kind) => BUILT_KINDS.includes(kind) || Boolean(GLB[kind]);

describe('the sides', () => {
  it('give every crew a side, and nothing else one', () => {
    for (const c of CREWS) expect(sideOf(c.id), c.id).toBeTruthy();
    expect(sideOf('rv')).toBe('breakingbad');
    expect(sideOf('nope')).toBeNull();
    expect(sideFor(null)).toBeNull();
    for (const s of Object.values(SIDES)) for (const c of s.crews) expect(sideOf(c)).toBe(s.id);
  });

  it('each have a universe: enemies of every role, allies, civilians, a leviathan and troops', () => {
    for (const s of Object.values(SIDES)) {
      const roles = Object.values(s.factions).map((f) => f.role);
      expect(roles.filter((r) => r === 'hunt').length, s.id).toBeGreaterThanOrEqual(1);
      expect(roles.includes('bounty'), s.id).toBe(true);
      expect(s.factions[s.distress.pirates], `${s.id} pirates`).toBeTruthy();
      expect(Object.keys(s.allies).length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.civil.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.civil, s.id).toContain(s.distress.civil);
      expect(s.convoy.escort, s.id).toBeTruthy();
      expect(s.leviathan, s.id).toBeTruthy();
      expect(Object.keys(s.troops).length, s.id).toBeGreaterThanOrEqual(2);
      expect(s.skirmish.faction && s.skirmish.escort && s.skirmish.civil, s.id).toBeTruthy();
      expect(s.factions[s.skirmish.faction], s.id).toBeTruthy();
      expect(s.allies[s.skirmish.escort], s.id).toBeTruthy();
    }
  });

  it('name only ships that can be drawn, with stats and a name for every hunter', () => {
    for (const s of Object.values(SIDES)) {
      const kinds = kindsOf(s.id);
      const names = namesOf(s.id);
      for (const [id, f] of Object.entries(s.factions)) {
        for (const [k] of f.kinds) {
          expect(kinds[k], `${s.id}.${id}.${k}`).toBeTruthy();
          expect(names[k], `${s.id}.${id}.${k}`).toBeTruthy();
          expect(drawable(k), `${s.id}.${id}.${k}`).toBe(true);
        }
        if (f.ace) {
          expect(kinds[f.ace], `${s.id}.${id}.ace`).toBeTruthy();
          expect(drawable(f.ace), `${s.id}.${id}.ace`).toBe(true);
        }
        expect(f.laser, `${s.id}.${id}`).toHaveLength(3);
        expect(f.size, `${s.id}.${id}`).toHaveLength(2);
      }
      for (const k of [...Object.keys(s.allies), ...s.civil, ...s.traffic, s.convoy.escort]) expect(drawable(k), `${s.id} ${k}`).toBe(true);
      for (const k of Object.keys(s.ahead)) expect(drawable(k), `${s.id} ahead ${k}`).toBe(true);
      for (const [k, t] of Object.entries(s.troops)) {
        expect(TROOPS[k], `${s.id} troop ${k}`).toBeTruthy();
        expect(t.gun === null || typeof t.gun === 'string', `${s.id} troop ${k}`).toBe(true);
      }
      for (let n = 0; n < 6; n++) for (const k of squadKinds(s, n)) expect(s.troops[k], `${s.id} squad ${n} ${k}`).toBeTruthy();
    }
  });

  it('pick a faction by role, and only that role', () => {
    const rand = seeded();
    for (const s of Object.values(SIDES)) {
      for (const role of ['hunt', 'bounty']) {
        for (let i = 0; i < 200; i++) {
          const id = pick(s, role, rand);
          expect(s.factions[id]?.role, `${s.id} ${role}`).toBe(role);
        }
      }
      for (let i = 0; i < 50; i++) expect(s.allies[wingOf(s, rand)], s.id).toBeTruthy();
    }
    expect(pick(SIDES.breakingbad, 'council', rand)).toBeNull();
    expect(SIDES.breakingbad.has('council')).toBe(false);
    expect(SIDES.rickmorty.has('council')).toBe(true);
    expect(SIDES.starwars.has('destroyer')).toBe(true);
    // a side with a capital ship names one that can be drawn, and what it launches
    for (const side of Object.values(SIDES)) {
      if (!side.pieces.includes('destroyer')) continue;
      expect(drawable(side.capitalShip), `${side.id} capitalShip`).toBe(true);
      expect(side.factions[side.capital]?.role, `${side.id} capital`).toBe('capital');
    }
    expect(SIDES.breakingbad.has('roadblock')).toBe(true);
    for (const s of Object.values(SIDES)) for (const need of ['hunt', 'bounty', 'pirates', 'leviathan']) expect(s.has(need), `${s.id} ${need}`).toBe(true);
  });

  it('agree with each other on every kind, and all together are the wire’s', () => {
    const seen = {};
    for (const s of Object.values(SIDES)) {
      for (const [k, row] of Object.entries(kindsOf(s.id))) {
        if (seen[k]) expect(seen[k], k).toEqual(row);
        seen[k] = row;
      }
    }
    expect(new Set(allKinds).size).toBe(allKinds.length);
    expect(Object.keys(kindsOf(null)).sort()).toEqual([...allKinds].sort());
    for (const s of Object.values(SIDES)) for (const id of Object.keys(s.factions)) expect(factionsOf(null)[id]).toBe(s.factions[id]);
    expect(AHEAD_OF(SIDES.starwars).tie).toBeGreaterThan(0);
    expect(AHEAD_OF(null)).toEqual({});
  });
});
