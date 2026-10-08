import { describe, expect, it } from 'vitest';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_FLEET, GALAXY_KINDS, SHIP_INFO } from './fleet';
import { FACTIONS, KINDS } from './hunted';
import { MODELS } from './models';
import { SYSTEMS } from './systems';

// every ship the galaxy can show: built in code (its own and the universe's
// traffic) or loaded (models.js)
const KNOWN = new Set([...BUILT_KINDS, ...GALAXY_KINDS, ...Object.keys(MODELS)]);

// every ship a system's set pieces name (its rocks' kinds are shapes, not ships)
function shipsIn(o, out = []) {
  if (Array.isArray(o)) for (const x of o) shipsIn(x, out);
  else if (o && typeof o === 'object' && o.type !== 'rocks') {
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'kind' || k === 'escort') && typeof v === 'string') out.push(v);
      else shipsIn(v, out);
    }
  }
  return out;
}

describe('the galaxy’s fleet', () => {
  it('has every ship the systems’ set pieces call for', () => {
    const named = SYSTEMS.flatMap((s) => shipsIn(s.pieces).map((kind) => [s.id, kind]));
    expect(named.length).toBeGreaterThan(40);
    for (const want of ['moncal', 'executor', 'lucrehulk', 'deathstar2', 'xwing', 'destroyer']) expect(named.some(([, k]) => k === want), want).toBe(true);
    for (const [id, kind] of named) expect(KNOWN.has(kind), `${id}: ${kind}`).toBe(true);
  });

  it('has every hunter, built in code', () => {
    for (const [side, f] of Object.entries(FACTIONS)) {
      for (const [kind] of f.kinds) {
        expect(KNOWN.has(KINDS[kind]?.model ?? kind), `${side}: ${kind}`).toBe(true);
        expect(KINDS[kind], `${side}: ${kind}`).toBeTruthy();
      }
    }
  });

  it('names each of its own ships for the HUD, with its size and side', () => {
    for (const kind of GALAXY_KINDS) {
      expect(typeof GALAXY_FLEET[kind], kind).toBe('function');
      const info = SHIP_INFO[kind];
      expect(info?.name, kind).toBeTruthy();
      expect(info.meters, kind).toBeGreaterThan(0);
      expect(['rebel', 'empire', 'republic', 'separatist', 'naboo', 'mandalorian', 'neutral'], kind).toContain(info.side);
    }
  });
});
