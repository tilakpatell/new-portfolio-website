import { describe, expect, it } from 'vitest';
import { AHEAD, FACTIONS, KINDS, NAMES } from './hunted';
import { SYSTEMS } from './systems';
import { GALAXY_KINDS } from './fleet';
import { BUILT_KINDS } from '../universe/trafficModels';
import { HUNTER_GLB } from './models';

const BUILT = new Set([...BUILT_KINDS, ...GALAXY_KINDS]); // (what galaxy/fleet.js's buildGalaxyShip can build)

describe('the galaxy’s hunters', () => {
  it('has a faction for every system that has one, and the outlaws besides', () => {
    for (const s of SYSTEMS) if (s.faction) expect(FACTIONS[s.faction], s.id).toBeTruthy();
    for (const id of ['navy', 'fett', 'ig88', 'bossk', 'dengar', 'weequay']) expect(FACTIONS[id], id).toBeTruthy();
  });

  it('gives every kind it flies its stats and its name, and a way to be drawn', () => {
    for (const [id, f] of Object.entries(FACTIONS)) {
      expect(f.family, id).toBe('starwars');
      for (const [kind] of [...f.kinds, ...(f.ace ? [[f.ace]] : [])]) {
        expect(KINDS[kind], `${id} ${kind}`).toBeTruthy();
        expect(NAMES[kind], `${id} ${kind}`).toBeTruthy();
        const model = KINDS[kind].model ?? kind;
        expect(Boolean(HUNTER_GLB[model]) || BUILT.has(model), `${id} ${kind}`).toBe(true);
      }
    }
  });

  it('builds ahead only kinds that can be built', () => {
    for (const [f, kinds] of Object.entries(AHEAD)) {
      expect(FACTIONS[f], f).toBeTruthy();
      for (const k of Object.keys(kinds)) expect(BUILT.has(k), `${f} ${k}`).toBe(true);
    }
  });

  it('has the Rebellion, the Republic and the New Republic to hunt you, and their navies’ launches', () => {
    for (const id of ['rebellion', 'rebelnavy', 'republic', 'republicnavy', 'newrepublic']) expect(FACTIONS[id], id).toBeTruthy();
    expect(FACTIONS.rebellion.kinds.map(([k]) => k)).toEqual(['xwing', 'awing', 'ywing']);
    expect(FACTIONS.rebellion.ace).toBe('redleader');
    expect(NAMES.redleader).toBe('Wedge Antilles');
    expect(KINDS.redleader.hp).toBe(KINDS.tieadvanced.hp);
    expect(FACTIONS.republic.kinds.map(([k]) => k)).toContain('arc170');
  });
});
