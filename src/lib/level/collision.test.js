import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSolids, pushOut } from '../../components/galaxy/surface/walker';
import { createPhysics } from '../physics/world';
import { createLevelCollision, fillSolids, wantsEngine } from './collision';

const PACK = new URL('../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
// a snow pile at (100, 0, 50), turned 90°
const yaw = Math.PI / 2;
const pile = { mesh: 0, position: [100, 0, 50], quaternion: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], scale: [1, 1, 1] };

describe('createLevelCollision', () => {
  it('without an engine, makes the far list’s pieces the walker’s boxes: a point in the pile’s footprint is pushed out', async () => {
    const { solids, physics } = await createLevelCollision({ pack, physics: null, loadBin, instances: [pile, { mesh: 4, position: [0, 0, 0] }] });
    expect(physics).toBeNull();
    expect(solids).toHaveLength(1);
    const target = fillSolids(createSolids(), solids);
    // (the pile runs 5 m along its own x, which the turn lays along −z)
    const [s] = target.near(100, 48, 1);
    expect(s).toBeTruthy();
    expect(pushOut(s, 100, 48, 0.38)).not.toBeNull();
    expect(pushOut(s, 103, 48, 0.38)).toBeNull();
    expect(s.top).toBeCloseTo(0.903, 2);
  });

  it('with one, is the stream, and the walker gets nothing', async () => {
    const engine = await createPhysics();
    const { solids, physics } = await createLevelCollision({ pack, physics: engine, loadBin, tier: 'mid', instances: [pile] });
    expect(solids).toEqual([]);
    expect(physics.stats().cells).toBe(0);
    await physics.addCell('0,0', [pile]);
    physics.update(Infinity);
    expect(physics.stats().bodies).toBe(1);
    physics.dispose();
    engine.dispose();
  });

  it('a pack without shapes gets the walker even with an engine', async () => {
    const engine = await createPhysics();
    const { physics } = await createLevelCollision({ pack: { ...pack, physics: undefined }, physics: engine, loadBin });
    expect(physics).toBeNull();
    engine.dispose();
  });
});

describe('wantsEngine', () => {
  it('is never a phone, nor the low tier, nor a pack without shapes', () => {
    expect(wantsEngine({ pack, tier: 'high' })).toBe(true);
    expect(wantsEngine({ pack, tier: 'high', small: true })).toBe(false);
    expect(wantsEngine({ pack, tier: 'low' })).toBe(false);
    expect(wantsEngine({ pack: {}, tier: 'ultra' })).toBe(false);
  });
});
