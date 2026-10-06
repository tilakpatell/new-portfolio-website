import { describe, expect, it } from 'vitest';
import { GALAXY_SIDES, ROAM_EVENTS, galaxySide } from './roamRules';
import { SYSTEMS, systemById } from './systems';
import { KINDS, NAMES } from './hunted';
import { canHave, EVENTS } from '../universe/director';
import { pick } from '../universe/sides';
import { GALAXY_KINDS } from './fleet';
import { BUILT_KINDS } from '../universe/trafficModels';
import { HUNTER_GLB } from './models';

const BUILT = new Set([...BUILT_KINDS, ...GALAXY_KINDS]); // (what galaxy/fleet.js's buildGalaxyShip can build)

const seeded = (seed = 3) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('galaxySide', () => {
  it('gives every system a side by who holds it, and none without a system', () => {
    expect(galaxySide(null)).toBeNull();
    for (const s of SYSTEMS) {
      const side = galaxySide(s);
      expect(side, s.id).toBeTruthy();
      expect(side.id).toBe(`galaxy-${s.faction ?? 'none'}`);
    }
    expect(galaxySide(systemById('hoth'))).toBe(galaxySide(systemById('tatooine'))); // (the same object for the same faction)
  });

  it('has the Empire hunting with a Star Destroyer and four bounty hunters, the remnant with Fett, the Separatists with droids alone', () => {
    const empire = galaxySide(systemById('hoth'));
    expect(pick(empire, 'hunt', seeded())).toBe('empire');
    expect(pick(empire, 'capital')).toBe('navy');
    expect(empire.capitalShip).toBe('destroyer');
    expect(Object.entries(empire.factions).filter(([, f]) => f.role === 'bounty').map(([id]) => id).sort()).toEqual(['bossk', 'dengar', 'fett', 'ig88']);
    const remnant = galaxySide(systemById('nevarro'));
    expect(pick(remnant, 'hunt', seeded())).toBe('remnant');
    expect(pick(remnant, 'bounty', seeded())).toBe('fett');
    const seps = galaxySide(systemById('geonosis'));
    expect(pick(seps, 'hunt', seeded())).toBe('separatists');
    expect(pick(seps, 'capital')).toBeNull();
    expect(pick(seps, 'bounty', seeded())).toBeNull();
    expect(seps.has('destroyer')).toBe(false);
    const none = galaxySide(systemById('dagobah'));
    expect(pick(none, 'hunt', seeded())).toBeNull();
    expect(none.has('hunt')).toBe(false);
    expect(none.has('bounty')).toBe(true);
    for (const side of Object.values(GALAXY_SIDES)) expect(pick(side, 'pirates')).toBe('weequay');
  });

  it('lets the director bring only what each side can have, of the events the galaxy plays', () => {
    expect(Object.keys(ROAM_EVENTS)).toEqual(['hunt', 'destroyer', 'bounty']);
    const can = (side) => Object.entries(EVENTS).filter(([, e]) => canHave(side, e)).map(([id]) => id);
    expect(can(GALAXY_SIDES.empire)).toEqual(expect.arrayContaining(['hunt', 'destroyer', 'bounty', 'distress', 'convoy', 'leviathan', 'meteors']));
    expect(can(GALAXY_SIDES.empire)).not.toContain('council');
    expect(can(GALAXY_SIDES.separatists)).not.toContain('destroyer');
    expect(can(GALAXY_SIDES.separatists)).not.toContain('bounty');
    expect(can(GALAXY_SIDES.none)).not.toContain('hunt');
    expect(can(GALAXY_SIDES.none)).toContain('bounty');
  });

  it('names only hunters the galaxy can fly: stats, a name and a model or a built one for every kind', () => {
    for (const side of Object.values(GALAXY_SIDES)) {
      for (const [id, f] of Object.entries(side.factions)) {
        expect(f.family, id).toBe('starwars');
        expect(f.laser, id).toHaveLength(3);
        for (const [kind] of f.kinds) {
          expect(KINDS[kind], `${id} ${kind}`).toBeTruthy();
          expect(NAMES[kind], `${id} ${kind}`).toBeTruthy();
          // (drawn: a model the fleet loads, or built in code till then; Slave I waits for its model)
          const model = KINDS[kind].model ?? kind;
          expect(Boolean(HUNTER_GLB[model]) || BUILT.has(model), `${id} ${kind}`).toBe(true);
        }
        if (f.ace) expect(KINDS[f.ace], `${id} ace`).toBeTruthy();
      }
    }
  });
});
