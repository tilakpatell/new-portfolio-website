import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../Achievements';
import { BUILD_SLOTS, MODULES, modulesFor } from './parts';
import { STOCK_BUILD, buildCode, parseBuildCode, readBuild, readBuildWire, readHulls, rollBuild, statsOfBuild, writeBuild } from './build';

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
