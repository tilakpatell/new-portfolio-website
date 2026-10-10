import { describe, expect, it, vi } from 'vitest';
import { FAIR, LIFE_RADIUS, createLife } from './life';
import { LIFE_CELL, cellKeyOf } from '../../../lib/land/flight/routes';
import { seeded } from '../../../lib/seeded';

// a flat planet of one biome, thick with herds and a lane of traffic
const spec = { id: 'test', seed: 5, biomes: [{ id: 'plains' }], pois: [] };
const field = { heightAt: () => 0, biomeAt: () => 0 };
const life = {
  kinds: { default: 'wild' },
  air: [{ name: 'tie', model: 'tie', perKm2: 1, alt: [100, 200], speed: 150, route: 'patrol' }],
  ground: [{ name: 'tauntaun', model: 'tauntaun', role: 'herd', perKm2: 3, group: [4, 6], spread: 30 }],
};
const ship = (x = 1000, z = 1000) => ({ x, y: 300, z, yaw: 0, pitch: 0, roll: 0 });
const run = (l, s, n, dt = 1 / 30) => {
  const all = { make: [], drop: [], moved: [], shots: [] };
  for (let i = 0; i < n; i++) {
    const r = l.update(s, dt);
    for (const k of Object.keys(all)) all[k].push(...r[k]);
  }
  return all;
};
const make = (over = {}) => createLife({ spec, life, tier: 'mid', field, rand: seeded(3), now: () => 0, warn: () => {}, ...over });

describe('life', () => {
  it('loads the cells round the ship, one a frame, and lets go of them behind with a band to spare', () => {
    const l = make();
    run(l, ship(), 1);
    expect(l.stats().cells).toBe(1);
    run(l, ship(), 40);
    expect(l.stats().cells).toBe((2 * LIFE_RADIUS + 1) ** 2);
    expect(l.actors.size).toBeGreaterThan(0);
    // one cell east: nothing let go of yet (the band)
    const r1 = run(l, ship(1000 + LIFE_CELL, 1000), 40);
    expect(r1.drop).toEqual([]);
    // two more: the western columns go, and everyone in them
    const before = new Set(l.actors.keys());
    const r2 = run(l, ship(1000 + 3 * LIFE_CELL, 1000), 60);
    expect(r2.drop.length).toBeGreaterThan(0);
    for (const id of r2.drop) {
      expect(before.has(id)).toBe(true);
      expect(l.actors.has(id)).toBe(false);
    }
    for (const a of l.actors.values()) expect(Math.abs(Number(a.cell.split(',')[0]) - 3)).toBeLessThanOrEqual(LIFE_RADIUS + 1);
  });

  it('is the same roster every visit', () => {
    const a = make();
    const b = make();
    run(a, ship(), 30);
    run(b, ship(), 30);
    expect([...a.actors.keys()].sort()).toEqual([...b.actors.keys()].sort());
  });

  it('keeps an animal that walked into the next cell in that cell, never doubled, never lost', () => {
    const l = make();
    run(l, ship(), 30);
    const a = [...l.actors.values()].find((x) => !x.air && x.cell === '0,0');
    const id = a.id;
    // it walks two cells east, past the loaded band's edge? no: into a loaded neighbour
    a.b.x += LIFE_CELL;
    const r = run(l, ship(), 1);
    expect(r.moved).toContain(id);
    expect(l.actors.get(id).cell).toBe('1,0');
    // now far beyond what's loaded: let go of, kept for that cell
    l.actors.get(id).b.x += 6 * LIFE_CELL;
    const r2 = run(l, ship(), 1);
    expect(r2.drop).toContain(id);
    expect(l.actors.has(id)).toBe(false);
    const where = cellKeyOf(a.b.x, a.b.z);
    // fly back over its first cell, away and back: never made there again
    run(l, ship(1000 - 8 * LIFE_CELL, 1000), 60);
    run(l, ship(), 60);
    expect(l.actors.has(id)).toBe(false);
    // fly to where it went: there it is, where it was let go of
    const [cx] = where.split(',').map(Number);
    const made = run(l, ship(cx * LIFE_CELL + 1000, 1000), 60).make.filter((m) => m.id === id);
    expect(made).toHaveLength(1);
    expect(made[0].cell).toBe(where);
    expect(cellKeyOf(made[0].b.x, made[0].b.z)).toBe(where);
  });

  it('keeps the dead dead for the visit', () => {
    const l = make();
    run(l, ship(), 30);
    const id = [...l.actors.keys()][0];
    l.died(id);
    expect(l.isDead(id)).toBe(true);
    expect(run(l, ship(), 1).drop).toContain(id);
    run(l, ship(1000 + 8 * LIFE_CELL, 1000), 60);
    run(l, ship(), 60);
    expect(l.actors.has(id)).toBe(false);
  });

  it('removes a brain that throws, with one warning a kind, and goes on', () => {
    const warn = vi.fn();
    const bad = new Set();
    const l = make({
      warn,
      brainFor: (a) => {
        if (!a.air && bad.size < 2) {
          bad.add(a.id);
          return {
            step() {
              throw new Error('no');
            },
          };
        }
        return { step: () => null };
      },
    });
    const r = run(l, ship(), 30);
    expect(bad.size).toBe(2);
    for (const id of bad) {
      expect(r.drop).toContain(id);
      expect(l.actors.has(id)).toBe(false);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(l.stats().broken).toBe(2);
    // and never made again this visit
    run(l, ship(1000 + 8 * LIFE_CELL, 1000), 60);
    run(l, ship(), 60);
    for (const id of bad) expect(l.actors.has(id)).toBe(false);
  });

  it('thinks round-robin within the budget, nobody waiting more than five frames', () => {
    let clock = 0;
    const steps = new Map();
    let frame = 0;
    const l = make({
      now: () => (clock += 0.05),
      budget: 0.1,
      brainFor: (a) => ({ step: () => (steps.set(a.id, frame), null) }),
    });
    for (; frame < 40; frame++) l.update(ship(), 1 / 30);
    const awake = l.stats().awake;
    expect(awake).toBeGreaterThan(200);
    for (; frame < 80; frame++) {
      l.update(ship(), 1 / 30);
      expect(l.stats().stepped).toBeLessThan(awake);
      for (const [id] of l.actors) if (steps.has(id)) expect(frame - steps.get(id), id).toBeLessThanOrEqual(FAIR);
    }
  });

  it('makes nothing on a dead world', () => {
    const l = make({ life: { kinds: { default: 'dead' }, air: [], ground: [] } });
    const r = run(l, ship(), 40);
    expect(r.make).toEqual([]);
    expect(l.stats().cells).toBe(0);
  });

  it('flies the ships round their routes, the same place for the same clock', () => {
    const l = make();
    run(l, ship(), 30);
    const s = [...l.actors.values()].find((a) => a.air);
    expect(s).toBeTruthy();
    const p0 = { ...s.b };
    run(l, ship(), 30);
    expect(Math.hypot(s.b.x - p0.x, s.b.z - p0.z)).toBeGreaterThan(50);
    expect(s.b.y).toBeGreaterThanOrEqual(100 - 1e-6);
  });
});
