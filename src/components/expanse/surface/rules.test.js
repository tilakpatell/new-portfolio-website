import { describe, expect, it } from 'vitest';
import { RESPAWN_BACK, createDriver, spawnIn, stepDriver } from './rules';
import { CELL, N, makeCell } from '../../../lib/land/cell';
import { landSpec } from '../../../lib/land/spec';

const flatCell = (h = 3) => ({ cx: 2, cz: -1, heights: new Float32Array(N * N).fill(h), water: new Float32Array(N * N).fill(NaN) });
const onGround = { speed: 2, wheels: [0, 1, 2, 3].map(() => ({ contact: true })), upsideDown: false, stuck: false };
const dry = () => null;

describe('spawnIn', () => {
  it('stands on a flat dry cell, its slope nothing', () => {
    const s = spawnIn(flatCell(3));
    expect(s.slope).toBe(0);
    expect(s.y).toBeGreaterThan(3);
    expect(s.x).toBeGreaterThanOrEqual(2 * CELL);
    expect(s.x).toBeLessThanOrEqual(3 * CELL);
  });

  it('takes the highest gentle dry point, never under water', () => {
    const cell = makeCell(landSpec('seven'), 0, 0);
    const s = spawnIn(cell);
    const ix = Math.round(s.x);
    const iz = Math.round(s.z);
    expect(Number.isNaN(cell.water[iz * N + ix])).toBe(true);
    expect(s.slope).toBeLessThan(0.15 + 1e-9);
  });

  it('settles for the highest dry point on a cell all steep', () => {
    const c = flatCell();
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) c.heights[iz * N + ix] = ix * 0.5;
    const s = spawnIn(c);
    expect(s.x).toBe(2 * CELL + 64);
  });
});

describe('stepDriver', () => {
  const run = (d, seconds, vstate, input, at, waterAt = dry) => {
    let out = null;
    for (let t = 0; t < seconds; t += 1 / 60) {
      out = stepDriver(d, vstate, input, 1 / 60, { position: at(t), waterAt }) ?? out;
      if (out?.respawn) return out;
    }
    return out;
  };

  it('respawns after 4 s under water, and drags while under', () => {
    const d = createDriver();
    const under = () => ({ level: 5, kind: 'river' });
    const first = stepDriver(d, onGround, {}, 1 / 60, { position: [0, 4, 0], waterAt: under });
    expect(first.drag).toBe(1);
    expect(first.moment).toBe('river');
    expect(first.respawn).toBe(false);
    const out = run(d, 4.1, onGround, {}, () => [0, 4, 0], under);
    expect(out.respawn).toBe(true);
  });

  it('respawns on R, to where it stood dry at least 3 s before', () => {
    const d = createDriver();
    // driving along +x at 5 m/s for 6 s
    run(d, 6, onGround, {}, (t) => [5 * t, 3, 0]);
    const out = stepDriver(d, onGround, { respawn: true }, 1 / 60, { position: [30, 3, 0], waterAt: dry });
    expect(out.respawn).toBe(true);
    expect(out.to[0]).toBeLessThanOrEqual(30 - 5 * RESPAWN_BACK + 1e-6);
    expect(out.to[0]).toBeGreaterThan(0);
  });

  it('never takes a wet or airborne point to come back to', () => {
    const d = createDriver();
    const air = { ...onGround, wheels: onGround.wheels.map(() => ({ contact: false })) };
    run(d, 2, onGround, {}, (t) => [t, 3, 0]);
    run(d, 5, air, {}, (t) => [100 + t, 10, 0]);
    const out = stepDriver(d, onGround, { respawn: true }, 1 / 60, { position: [105, 10, 0], waterAt: dry });
    expect(out.to[0]).toBeLessThan(3);
  });

  it('respawns a car stuck for 3 s', () => {
    const d = createDriver();
    const out = run(d, 3.2, { ...onGround, stuck: true }, { throttle: 1 }, () => [0, 3, 0]);
    expect(out.respawn).toBe(true);
  });

  it('names the water it is by', () => {
    const d = createDriver();
    expect(stepDriver(d, onGround, {}, 1 / 60, { position: [0, 3, 0], waterAt: () => ({ level: 1, kind: 'sea' }) }).moment).toBe(null);
    expect(stepDriver(d, onGround, {}, 1 / 60, { position: [0, 0.5, 0], waterAt: () => ({ level: 1, kind: 'sea' }) }).moment).toBe('sea');
  });
});
