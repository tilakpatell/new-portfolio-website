import { describe, expect, it } from 'vitest';
import { BY_SPAN, fitScale } from './shipFit';

describe('how a model is fitted to its size', () => {
  it('fits a ship by its length, nose to tail, its wings standing out past that as far as they do', () => {
    expect(fitScale('arc170', { x: 1.6, y: 0.3, z: 1 })).toBeCloseTo(1); // (half as wide again as it is long)
    expect(fitScale('tie', { x: 3, y: 4, z: 2 })).toBeCloseTo(0.5); // (taller than it is long: still its length)
    expect(fitScale('destroyer', { x: 0.55, y: 0.28, z: 2 })).toBeCloseTo(0.5);
  });

  it('fits the stations by their biggest side (round, or a ring: the world’s solids are shares of it)', () => {
    for (const kind of ['deathstar', 'deathstar2', 'cloudcity', 'gate', 'coreship']) {
      expect(BY_SPAN.has(kind), kind).toBe(true);
      expect(fitScale(kind, { x: 4, y: 4, z: 0.5 }), kind).toBeCloseTo(0.25);
    }
  });

  it('fits Slave I and the B-wing by their biggest side: each flies upright, its length standing up', () => {
    expect(fitScale('slave1', { x: 1.9, y: 1.89, z: 0.97 })).toBeCloseTo(1 / 1.9);
    expect(fitScale('bwing', { x: 2, y: 14, z: 5.3 })).toBeCloseTo(1 / 14);
  });

  it('fits the universe’s travellers who are not ships by their biggest side (a Meeseeks is as tall as his size)', () => {
    for (const kind of ['meeseeks', 'birdperson', 'phoenixperson', 'gromflomite', 'balloon']) expect(fitScale(kind, { x: 0.4, y: 1, z: 0.4 }), kind).toBeCloseTo(1);
  });

  it('never divides by nothing', () => {
    expect(Number.isFinite(fitScale('xwing', { x: 1, y: 1, z: 0 }))).toBe(true);
    expect(Number.isFinite(fitScale('gate', { x: 0, y: 0, z: 0 }))).toBe(true);
  });
});
