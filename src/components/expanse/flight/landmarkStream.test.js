import { describe, expect, it } from 'vitest';
import { LANDMARK_CAP, LANDMARK_FREE, LANDMARK_NEAR, LANDMARK_PREFETCH } from '../../../lib/land/flight/landmarkTables';
import { landmarkPlan } from './landmarkStream';

const poi = (id, x, z = 0) => ({ id, at: [x, z], r: 50, edge: 20 });
const ship = (x, z = 0) => ({ x, y: 300, z });

describe('landmarkPlan', () => {
  it('wants the nearest four within reach, nearest first', () => {
    const pois = [poi('a', 5000), poi('b', 100), poi('c', 2300), poi('d', 900), poi('e', 3000), poi('far', LANDMARK_NEAR + 10)];
    const { want } = landmarkPlan(pois, ship(0));
    expect(want).toHaveLength(LANDMARK_CAP);
    expect(want).toEqual(['b', 'd', 'c', 'e']);
  });

  it('keeps one it has till past reach × 1.3, then drops it', () => {
    const pois = [poi('a', 0)];
    expect(landmarkPlan(pois, ship(LANDMARK_NEAR * 1.2), new Set(['a'])).want).toEqual(['a']);
    expect(landmarkPlan(pois, ship(LANDMARK_NEAR * 1.2), new Set()).want).toEqual([]);
    expect(landmarkPlan(pois, ship(LANDMARK_NEAR * LANDMARK_FREE + 1), new Set(['a'])).want).toEqual([]);
  });

  it('never keeps more than the cap, kept ones or not', () => {
    const pois = Array.from({ length: 8 }, (_, i) => poi(`p${i}`, i * 100));
    const live = new Set(pois.map((p) => p.id));
    expect(landmarkPlan(pois, ship(0), live).want).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('fetches ahead within reach × 2, and not what it already wants', () => {
    const pois = [poi('near', 1000), poi('ahead', LANDMARK_NEAR * 1.5), poi('beyond', LANDMARK_NEAR * LANDMARK_PREFETCH + 10)];
    const { want, prefetch } = landmarkPlan(pois, ship(0));
    expect(want).toEqual(['near']);
    expect(prefetch).toEqual(['ahead']);
  });

  it('measures across the ground, whatever the height', () => {
    expect(landmarkPlan([poi('a', 0)], { x: 0, y: 1e6, z: LANDMARK_NEAR - 1 }).want).toEqual(['a']);
  });

  it('wants nothing with nowhere to be', () => {
    expect(landmarkPlan([], ship(0))).toEqual({ want: [], prefetch: [] });
    expect(landmarkPlan(undefined, ship(0))).toEqual({ want: [], prefetch: [] });
  });
});
