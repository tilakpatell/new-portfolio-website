import { describe, expect, it } from 'vitest';
import { GCW, WAR_SYSTEMS, warTable } from './gcw';
import { WARS, WAR_IDS } from './sides';
import { systemById } from './systems';
import { obstacles } from './battles';
import { OWNERS, effectsFor, garrisonFleet, gripOf, piecesShown } from './warEffects';

const MS = GCW.start + 30 * 60e3;
const sworn = (war, side, turncoat = false) => ({ war, side, sworn: side ? 1 : 0, turncoat });
// a war table with one system's row changed
const tableWith = (war, id, row) => {
  const t = warTable(war, MS);
  return { ...t, systems: t.systems.map((r) => (r.id === id ? { ...r, ...row } : r)) };
};
const KEYS = ['owner', 'yours', 'hostile', 'garrison', 'droids', 'hunt', 'escort', 'capital', 'traffic', 'fleet', 'heat', 'troops', 'deserter', 'grip', 'stance', 'tier'];

describe('effectsFor', () => {
  it('every war system, in every war, sworn either way or not at all, gives the full shape', () => {
    for (const war of WAR_IDS) {
      const t = warTable(war, MS);
      for (const side of [WARS[war].liberator, WARS[war].raider, null])
        for (const id of WAR_SYSTEMS) {
          const e = effectsFor(id, t, sworn(war, side));
          expect(Object.keys(e).sort(), `${war} ${side} ${id}`).toEqual([...KEYS].sort());
          expect(Array.isArray(e.traffic)).toBe(true);
          if (!side) expect(e.hostile).toBe(false);
          expect(e.owner).toBe(t.systems.find((r) => r.id === id).owner);
          expect(['friend', 'enemy', 'wary']).toContain(e.stance);
          expect(['thin', 'held', 'fortress']).toContain(e.tier);
          expect(Math.round(e.grip * 10) / 10, `${war} ${side} ${id}`).toBe(e.grip);
        }
    }
  });
  it('a system out of the war has none', () => {
    expect(effectsFor('dagobah', warTable('gcw', MS), sworn('gcw', 'rebel'))).toBeNull();
    expect(effectsFor('hoth', null, sworn('gcw', 'rebel'))).toBeNull();
  });
  it('your side’s space: yours, no hunt, an escort; theirs: hunted, no escort', () => {
    const t = tableWith('gcw', 'hoth', { owner: 'rebel', front: false, attack: null });
    const ours = effectsFor('hoth', t, sworn('gcw', 'rebel'));
    expect(ours).toMatchObject({ yours: true, hostile: false, hunt: false, escort: true, garrison: 'rebellion', fleet: 'rebel', capital: 'moncal' });
    const theirs = effectsFor('hoth', t, sworn('gcw', 'empire'));
    expect(theirs).toMatchObject({ yours: false, hostile: true, hunt: true, escort: false, garrison: 'rebellion' });
  });
  it('the Empire’s shows’ worlds keep Gideon’s TIEs: a remnant world the Empire holds is the remnant’s garrison', () => {
    const t = tableWith('gcw', 'nevarro', { owner: 'empire' });
    expect(effectsFor('nevarro', t, sworn('gcw', 'rebel')).garrison).toBe('remnant');
    expect(effectsFor('hoth', tableWith('gcw', 'hoth', { owner: 'empire' }), sworn('gcw', 'rebel')).garrison).toBe('empire');
  });
  it('a separatist world keeps its droids whoever holds it', () => {
    const t = tableWith('gcw', 'geonosis', { owner: 'rebel' });
    const e = effectsFor('geonosis', t, sworn('gcw', 'rebel'));
    expect(e).toMatchObject({ garrison: 'rebellion', droids: true, hunt: false });
    expect(effectsFor('geonosis', tableWith('clone', 'geonosis', { owner: 'separatists' }), sworn('clone', 'republic')).droids).toBe(false);
  });
  it('a deserter is hunted in the space they left', () => {
    const t = tableWith('gcw', 'hoth', { owner: 'rebel' });
    const e = effectsFor('hoth', t, sworn('gcw', 'empire', true));
    expect(e).toMatchObject({ deserter: true, hunt: true });
    expect(effectsFor('hoth', tableWith('gcw', 'hoth', { owner: 'empire' }), sworn('gcw', 'empire', true)).deserter).toBe(false);
  });
  it('Hutt space is no one’s friend, hunts nobody, and sells you to the bounty hunters', () => {
    const t = tableWith('gcw', 'tatooine', { owner: 'hutt' });
    const e = effectsFor('tatooine', t, sworn('gcw', 'rebel'));
    expect(e).toMatchObject({ owner: 'hutt', hostile: true, hunt: false, escort: false, garrison: 'hutt', troops: 'mercenary', capital: null });
  });
  it('a front adds heat 1, an attack 2', () => {
    expect(effectsFor('hoth', tableWith('gcw', 'hoth', { front: true, attack: null }), sworn('gcw', 'rebel')).heat).toBe(1);
    expect(effectsFor('hoth', tableWith('gcw', 'hoth', { front: false, attack: { by: 'empire' } }), sworn('gcw', 'rebel')).heat).toBe(2);
    expect(effectsFor('hoth', tableWith('gcw', 'hoth', { front: false, attack: null }), sworn('gcw', 'rebel')).heat).toBe(0);
  });
  it('traffic is the owner’s plus the system’s civil kinds', () => {
    const e = effectsFor('naboo', tableWith('clone', 'naboo', { owner: 'republic' }), sworn('clone', null));
    for (const k of OWNERS.republic.traffic) expect(e.traffic).toContain(k);
    expect(e.traffic).toContain('nubian');
    expect(e.traffic).toContain('freighter');
    expect(e.traffic).not.toContain('venator'); // (Naboo's own warship goes: the owner's warships fly by instead)
  });
  it('the holder’s fleet treats you by your oath', () => {
    for (const war of WAR_IDS) {
      const { liberator, raider } = WARS[war];
      const at = (owner, side, turncoat) => effectsFor('hoth', tableWith(war, 'hoth', { owner }), sworn(war, side, turncoat));
      expect(at(liberator, liberator).stance, war).toBe('friend');
      expect(at(liberator, raider).stance, war).toBe('enemy');
      expect(at(raider, liberator).stance, war).toBe('enemy');
      expect(at(liberator, null).stance, war).toBe('wary');
      // the Hutts warn first, whoever you are
      for (const side of [liberator, raider, null]) expect(at('hutt', side).stance, `${war} ${side}`).toBe('wary');
      expect(at(liberator, raider, true), war).toMatchObject({ deserter: true, stance: 'enemy' });
    }
  });
  // a row held whole, in supply, quiet, neither blockade nor stronghold, with the given changes
  const gripAt = (row) => {
    const e = effectsFor('hoth', tableWith('gcw', 'hoth', { control: 1, cut: false, front: false, attack: null, kind: 'assault', worth: 1, ...row }), sworn('gcw', 'rebel'));
    return { grip: e.grip, tier: e.tier };
  };
  it('grip reads the holder’s hold of the system', () => {
    expect(gripAt({ control: 1, kind: 'blockade', worth: 1 })).toEqual({ grip: 1, tier: 'fortress' });
    expect(gripAt({ control: 0.75, worth: 2 })).toEqual({ grip: 0.9, tier: 'fortress' });
    expect(gripAt({ control: 0.7, kind: 'assault', worth: 1 })).toEqual({ grip: 0.7, tier: 'held' });
    expect(gripAt({ control: 0.6, cut: true, front: true })).toEqual({ grip: 0.2, tier: 'thin' });
    expect(gripAt({ control: 0.6, attack: { by: 'empire' } }).grip).toBe(0.5);
    expect(gripAt({ control: 0.8 }).tier).toBe('held');
    expect(gripAt({ control: 0.5 }).tier).toBe('held');
    expect(gripAt({ control: 0.4 }).tier).toBe('thin');
    expect(gripAt({ control: GCW.lastHold, cut: true, front: true })).toEqual({ grip: 0, tier: 'thin' });
    expect(gripOf({}), 'a row with no control is held whole').toEqual({ grip: 1, tier: 'fortress' });
  });
  it('grip moves in tenths, so the effects don’t change every second', () => {
    expect(gripAt({ control: 0.73 }).grip).toBe(0.7);
    expect(gripAt({ control: 0.74 }).grip).toBe(0.7);
  });
  it('every side has a garrison, troops, traffic and escorts for its fleet', () => {
    for (const [id, o] of Object.entries(OWNERS)) {
      expect(typeof o.garrison, id).toBe('string');
      expect(typeof o.troops, id).toBe('string');
      expect(o.traffic.length, id).toBeGreaterThan(0);
      expect(o.escorts.length, id).toBeGreaterThan(1);
    }
  });
});

describe('the fleet in orbit', () => {
  const pieces = (id) => systemById(id).pieces;
  it('a fleet piece shows only when its side holds the system', () => {
    const i = pieces('kashyyyk').findIndex((p) => p.type === 'fleet' && p.side === 'republic');
    const j = pieces('kashyyyk').findIndex((p) => p.type === 'fleet' && p.side === 'separatist');
    const shown = (owner) => piecesShown(systemById('kashyyyk'), { fleet: owner, heat: 0 });
    expect(shown('republic')[i]).toBe(true);
    expect(shown('republic')[j]).toBe(false);
    expect(shown('separatists')[j]).toBe(true);
    expect(shown('rebel')[i]).toBe(false);
  });
  it('a standing battle shows only while the system’s fought over', () => {
    const i = pieces('endor').findIndex((p) => p.type === 'battle');
    expect(piecesShown(systemById('endor'), { fleet: 'empire', heat: 1 })[i]).toBe(true);
    expect(piecesShown(systemById('endor'), { fleet: 'rebel', heat: 0 })[i]).toBe(false);
  });
  it('everything else shows as it was, and without effects everything does', () => {
    const sys = systemById('hoth');
    const all = piecesShown(sys, null);
    expect(all.every(Boolean)).toBe(true);
    const shown = piecesShown(sys, { fleet: 'rebel', heat: 0 });
    sys.pieces.forEach((p, i) => {
      if (p.type !== 'fleet' && p.type !== 'battle') expect(shown[i], p.type).toBe(true);
    });
  });
  it('a system with no piece of its holder’s gets a garrison fleet of two, clear of the planet', () => {
    for (const id of WAR_SYSTEMS) {
      const sys = systemById(id);
      for (const owner of Object.keys(OWNERS)) {
        const g = garrisonFleet(sys, { fleet: owner });
        const has = sys.pieces.some((p) => p.type === 'fleet' && (p.side === owner || (p.side === 'separatist' && owner === 'separatists')));
        if (has) {
          expect(g, `${id} ${owner}`).toEqual([]);
          continue;
        }
        expect(g.length, `${id} ${owner}`).toBe(2);
        for (const s of g) {
          expect(OWNERS[owner].escorts).toContain(s.kind);
          for (const o of obstacles(sys)) expect(Math.hypot(s.at[0] - o.c.x, s.at[1] - o.c.y, s.at[2] - o.c.z) - s.size, `${id} ${owner} ${s.kind}`).toBeGreaterThan(o.r);
        }
      }
    }
  });
});
