import { describe, expect, it } from 'vitest';
import { createBolts } from '../../../lib/combat/bolt';
import { boltSolids } from './solids';
import { createSolids } from './walker';

// a flat world at y = 0 with a tall wall across x = 10, a waist-high wall
// across x = 20 and a pillar at (0, 30)
function fixture() {
  const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [] };
  world.solids.box(10, 0, 0.5, 5);
  world.solids.box(20, 0, 0.5, 5, 0, { top: 1 });
  world.solids.circle(0, 30, 1);
  return world;
}

describe('what a bolt stops at on a galaxy surface', () => {
  it('a bolt at a wall stops at its face, its normal back at the shooter', () => {
    const cast = boltSolids(fixture());
    const k = cast([0, 1.2, 0], [15, 1.2, 0]);
    expect(k.at[0]).toBeCloseTo(9.5);
    expect(k.at[1]).toBeCloseTo(1.2);
    expect(k.normal[0]).toBeCloseTo(-1);
  });

  it('one over a low wall passes; one at its height stops; one dropping onto it lands on top', () => {
    const cast = boltSolids(fixture());
    expect(cast([15, 1.5, 0], [25, 1.5, 0])).toBeNull();
    expect(cast([15, 0.8, 0], [25, 0.8, 0]).at[0]).toBeCloseTo(19.5);
    const top = cast([20, 3, 0], [20.2, 0.5, 0]);
    expect(top.at[1]).toBeCloseTo(1);
    expect(top.normal).toEqual([0, 1, 0]);
  });

  it('a pillar, the ground, and a turned box', () => {
    const world = fixture();
    world.solids.box(0, -20, 2, 0.25, Math.PI / 4);
    const cast = boltSolids(world);
    expect(cast([0, 1, 20], [0, 1, 40]).at[2]).toBeCloseTo(29);
    const g = cast([0, 2, -5], [0, -1, -2]);
    expect(g.at[1]).toBeCloseTo(0, 1);
    expect(g.normal).toEqual([0, 1, 0]);
    const turned = cast([0, 1, -10], [0, 1, -30]);
    expect(turned.at[2]).toBeLessThan(-19.5);
    expect(turned.at[2]).toBeGreaterThan(-20);
  });

  it('a muzzle inside a wall stops at the muzzle; a gate that’s up stops nothing', () => {
    const world = fixture();
    const cast = boltSolids(world);
    expect(cast([10.2, 1, 0], [14, 1, 0]).at).toEqual([10.2, 1, 0]);
    for (const s of world.solids.all) s.off = true;
    expect(cast([0, 1.2, 0], [25, 1.2, 0])).toBeNull();
  });

  it('flies the one bolt step: stopped by the wall, never the target behind it', () => {
    const cast = boltSolids(fixture());
    const bolts = createBolts();
    bolts.fire({ from: [0, 1.2, 0], dir: [1, 0, 0], side: 'them', owner: 'trooper' });
    const you = { id: 'you', a: [12, 0.3, 0], b: [12, 1.5, 0], r: 0.4, side: 'you' };
    const events = [];
    for (let i = 0; i < 60 && bolts.live().length; i++) events.push(...bolts.step(1 / 60, { solids: cast, bodies: [you], blades: [] }));
    expect(events.map((e) => e.type)).toEqual(['solid']);
    // and over the waist-high wall, it gets you
    bolts.fire({ from: [15, 1.4, 0], dir: [1, 0, 0], side: 'them', owner: 'trooper' });
    const over = [];
    for (let i = 0; i < 60 && bolts.live().length; i++) over.push(...bolts.step(1 / 60, { solids: cast, bodies: [{ ...you, a: [24, 0.3, 0], b: [24, 1.5, 0] }], blades: [] }));
    expect(over.map((e) => e.type)).toEqual(['hit']);
  });
  it('says what it struck: the ground, or a solid with its material tag', () => {
    const world = fixture();
    world.solids.box(40, 0, 0.5, 5, 0, { tag: 14 });
    const cast = boltSolids(world);
    expect(cast([0, 1.2, 0], [15, 1.2, 0]).surface).toMatchObject({ solid: { type: 'box' }, tag: null });
    expect(cast([35, 1.2, 0], [45, 1.2, 0]).surface).toMatchObject({ solid: { type: 'box' }, tag: 14 });
    expect(cast([0, 1.2, 25], [0, 1.2, 35]).surface.solid.type).toBe('circle');
    expect(cast([2, 2, 2], [3, -1, 2]).surface).toEqual({ ground: true });
    const bolts = createBolts({ pool: 2 });
    bolts.fire({ from: [35, 1.2, 0], dir: [1, 0, 0], range: 20, owner: 'you', side: 'you' });
    const events = [];
    for (let i = 0; i < 30 && bolts.live().length; i++) events.push(...bolts.step(1 / 60, { solids: cast, bodies: [], blades: [] }));
    expect(events.find((e) => e.type === 'solid').surface.tag).toBe(14);
  });
});
