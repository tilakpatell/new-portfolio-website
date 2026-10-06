import { describe, expect, it } from 'vitest';
import { NPCS, npcsOf, visitorsOf } from './index';
import { BRAINS } from '../npcRules';
import { SIDES, factionsOf } from '../sides';
import { BUILT_KINDS } from '../trafficModels';
import { GLB } from '../glbFleet';

const drawable = (kind) => BUILT_KINDS.includes(kind) || Boolean(GLB[kind]);

describe('the characters', () => {
  it('are each on a side, with a brain, a ship that can be drawn and stats to fly it', () => {
    for (const [key, c] of Object.entries(NPCS)) {
      expect(c.id, key).toBe(key);
      expect(SIDES[c.side], `${key} side`).toBeTruthy();
      expect(['ally', 'enemy', 'neutral'], `${key} role`).toContain(c.role);
      expect(typeof BRAINS[c.brain], `${key} brain`).toBe('function');
      expect(drawable(c.ship), `${key} ship ${c.ship}`).toBe(true);
      expect(c.stats.speed, key).toBeGreaterThan(0);
      expect(c.stats.fire[0], key).toBeLessThan(c.stats.fire[1]);
    }
  });

  it('fear and hunt only factions that exist, and a bounty hunter flies as its side’s bounty', () => {
    const all = factionsOf(null);
    for (const c of Object.values(NPCS)) {
      for (const f of [...c.relations.fears, ...c.relations.hunts]) expect(all[f], `${c.id} ${f}`).toBeTruthy();
      if (c.brain === 'bounty') expect(SIDES[c.side].factions[c.faction]?.role, c.id).toBe('bounty');
      // (an ally doesn't run from what it hunts)
      for (const f of c.relations.hunts) expect(c.relations.fears, c.id).not.toContain(f);
    }
  });

  it('give every side someone to meet, and someone who comes by on their own', () => {
    for (const id of Object.keys(SIDES)) {
      expect(npcsOf(id).length, id).toBeGreaterThanOrEqual(2);
      expect(visitorsOf(id).length, id).toBeGreaterThanOrEqual(1);
      for (const c of visitorsOf(id)) expect(['bounty', 'wingman'], c.id).not.toContain(c.brain);
    }
    expect(npcsOf('nope')).toEqual([]);
  });

  it('include the six the design names', () => {
    for (const id of ['saul', 'mike', 'fett', 'birdperson', 'squanchy', 'evilmorty']) expect(NPCS[id], id).toBeTruthy();
  });
});
