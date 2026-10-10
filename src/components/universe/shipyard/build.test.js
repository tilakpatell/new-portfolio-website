import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../Achievements';
import { BUILD_SLOTS, MODULES, modulesFor, moduleById } from './parts';
import { STOCK_BUILD, TUNE_SLOTS, buildCode, isStockModule, parseBuildCode, readBuild, readBuildWire, readHulls, readTune, readTunes, rollBuild, statsOfBuild, statsOfTune, tuneKey, writeBuild } from './build';

const ALL = Object.keys(ACHIEVEMENTS);
const noSeed = ({ seed, ...b }) => b; // eslint-disable-line no-unused-vars

describe('a build', () => {
  it('reads back what it can, and the first of each slot for the rest', () => {
    const b = readBuild({ hull: 'nope', wings: 'delta', engines: 7, seed: 5 });
    expect(b).toEqual({ ...STOCK_BUILD, wings: 'delta', seed: 5 });
    expect(readBuild(null)).toEqual(STOCK_BUILD);
    expect(readBuild([1, 2])).toEqual(STOCK_BUILD);
    for (const slot of BUILD_SLOTS) expect(STOCK_BUILD[slot]).toBe(modulesFor(slot)[0].id);
  });

  it('rolls the same ship from the same seed, and another from another', () => {
    expect(rollBuild(42, ALL)).toEqual(rollBuild(42, ALL));
    const a = noSeed(rollBuild(42, ALL));
    expect([43, 44, 45].some((s) => JSON.stringify(noSeed(rollBuild(s, ALL))) !== JSON.stringify(a))).toBe(true);
    expect(rollBuild(42, ALL).seed).toBe(42);
  });

  it('can roll every module, given the achievements, and never a locked one without', () => {
    const seen = new Set();
    for (let s = 1; s <= 500; s++) {
      const b = rollBuild(s, ALL);
      for (const slot of BUILD_SLOTS) seen.add(`${slot}:${b[slot]}`);
      const plain = rollBuild(s, []);
      for (const slot of BUILD_SLOTS) expect(MODULES.find((m) => m.slot === slot && m.id === plain[slot]).achievement).toBeNull();
    }
    for (const m of MODULES) expect(seen.has(`${m.slot}:${m.id}`), `${m.slot}:${m.id}`).toBe(true);
  });

  it('a roll picks only owned modules', () => {
    // one bought module a slot, besides what every ship has free
    const owned = ['hauler', 'canopy', 'delta', 'quad', 'twinfin', 'lights'];
    const free = (slot, id) => id === STOCK_BUILD[slot] || id === 'none';
    const seen = new Set();
    for (let s = 1; s <= 300; s++) {
      const b = rollBuild(s, ALL, owned);
      for (const slot of BUILD_SLOTS) {
        expect(owned.includes(b[slot]) || free(slot, b[slot]), `${s} ${slot}:${b[slot]}`).toBe(true);
        seen.add(b[slot]);
      }
    }
    for (const id of owned) expect(seen.has(id), id).toBe(true);
    // a Set does as well as a list
    expect(rollBuild(7, ALL, new Set(owned))).toEqual(rollBuild(7, ALL, owned));
  });

  it('a roll with nothing bought is a whole ship from stock', () => {
    for (let s = 1; s <= 100; s++) {
      const b = rollBuild(s, ALL, []);
      expect(readBuild(b)).toEqual(b);
      for (const slot of BUILD_SLOTS) expect([STOCK_BUILD[slot], 'none']).toContain(b[slot]);
    }
    // (and an owned module still needs its achievement)
    for (let s = 1; s <= 100; s++) expect(rollBuild(s, [], ['saucer']).hull).not.toBe('saucer');
  });

  it('shares as a short code and reads back from it', () => {
    for (let s = 1; s <= 50; s++) {
      const b = rollBuild(s * 7919, ALL);
      const code = buildCode(b);
      expect(code).toMatch(/^GB-[0-9a-z]{6}\.[0-9a-z]+$/);
      expect(parseBuildCode(code)).toEqual(b);
      expect(parseBuildCode(` ${code.toLowerCase()} `)).toEqual(b);
    }
    expect(parseBuildCode('GB-zzzzzz.1')).toBeNull();
    expect(parseBuildCode('hello')).toBeNull();
    expect(parseBuildCode(null)).toBeNull();
  });

  it('goes over the wire as ids, and only ids come back', () => {
    const b = rollBuild(99, ALL);
    expect(readBuildWire(writeBuild(b))).toEqual(noSeed(b));
    expect(readBuildWire([1, {}, 'x'])).toBeNull();
    expect(readBuildWire('x'.repeat(500))).toBeNull();
    expect(readBuildWire([['dart']])).toBeNull();
    expect(readBuildWire(undefined)).toBeNull();
  });

  it('is kept for each crew that flies one: null for the stock ship', () => {
    expect(readHulls({ cruiser: 'stock', rv: { hull: 'needle' }, zzz: { hull: 'dart' } }, ['cruiser', 'rv'])).toEqual({ cruiser: null, rv: { ...STOCK_BUILD, hull: 'needle' } });
    expect(readHulls('x', ['cruiser'])).toEqual({});
  });

  it('adds up what its modules do', () => {
    const s = statsOfBuild({ ...STOCK_BUILD, hull: 'hauler', engines: 'ring', wings: 'swept', tail: 'none', cockpit: 'canopy', extras: 'none' });
    expect(s.plant).toBe(10);
    expect(s.agility).toBeCloseTo(1 - 0.15 + 0.15 + 0.05, 6);
    expect(s.boost).toBeCloseTo(1.3, 6);
    expect(s.power).toBe(2);
    expect(s.mass).toBeCloseTo(0.5 + 1 + 2, 6);
  });
});

describe('a tune', () => {
  it('is every slot after the hull, and a slot’s stock module and None are the ship as it came', () => {
    expect(TUNE_SLOTS).toEqual(['cockpit', 'wings', 'engines', 'tail', 'extras']);
    expect(isStockModule('wings', STOCK_BUILD.wings)).toBe(true);
    expect(isStockModule('tail', 'none')).toBe(true);
    expect(isStockModule('wings', 'delta')).toBe(false);
  });

  it('reads back only modules there are, in the slots after the hull, that aren’t as it came', () => {
    expect(readTune({ hull: 'needle', cockpit: 'canopy', wings: 'nope', engines: 'quad', tail: 'none', extras: 7, junk: 'x' })).toEqual({ cockpit: 'canopy', engines: 'quad' });
    expect(readTune({ wings: STOCK_BUILD.wings })).toEqual({});
    expect(readTune({ engines: 'canopy' })).toEqual({}); // (a module of another slot)
    for (const bad of [null, undefined, 'x', 3, [], ['quad']]) expect(readTune(bad)).toEqual({});
  });

  it('adds up what its modules do, with no plant of its own', () => {
    const s = statsOfTune({ engines: 'quad', cockpit: 'canopy' });
    expect(s.boost).toBeCloseTo(1.05, 6);
    expect(s.accel).toBeCloseTo(1.3, 6);
    expect(s.agility).toBeCloseTo(1.05, 6);
    expect(s.plant).toBe(0);
    expect(s.power).toBe(2);
    expect(s.mass).toBeCloseTo(2.5, 6);
    expect(statsOfTune({})).toMatchObject({ boost: 1, accel: 1, cruise: 1, agility: 1, level: 1, plant: 0, power: 0, mass: 0 });
    expect(statsOfTune(null).mass).toBe(0);
  });

  it('gives the numbers the module’s own shares say, as a build’s modules do', () => {
    const ring = moduleById('engines', 'ring');
    const s = statsOfTune({ engines: 'ring' });
    expect(s.boost).toBeCloseTo(1 + ring.does.boost, 6);
    expect(s.accel).toBeCloseTo(1 + ring.does.accel, 6);
    expect(s.power).toBe(ring.power);
    expect(s.mass).toBe(ring.mass);
    // (on a build the ring replaces the twin cans: by exactly the difference in their shares)
    const swap = statsOfBuild({ ...STOCK_BUILD, engines: 'ring' }).boost - statsOfBuild(STOCK_BUILD).boost;
    expect(swap).toBeCloseTo(ring.does.boost - moduleById('engines', STOCK_BUILD.engines).does.boost, 6);
  });

  it('is kept for each crew that has one, and only that', () => {
    expect(readTunes({ rv: { engines: 'quad' }, cruiser: {}, xwing: { hull: 'dart' }, zzz: { engines: 'quad' } }, ['rv', 'cruiser', 'xwing'])).toEqual({ rv: { engines: 'quad' } });
    expect(readTunes('x', ['rv'])).toEqual({});
    expect(readTunes(null, ['rv'])).toEqual({});
  });

  it('has a key that says when two are the same', () => {
    expect(tuneKey({ engines: 'quad' })).toBe(tuneKey({ engines: 'quad' }));
    expect(tuneKey({ engines: 'quad' })).not.toBe(tuneKey({ engines: 'ring' }));
    expect(tuneKey(null)).toBe(tuneKey({}));
  });
});
