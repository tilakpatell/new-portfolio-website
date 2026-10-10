import { describe, expect, it } from 'vitest';
import { FAR, LIVE, liveCount, lodPick } from './lodPick';

describe('how many people move near you', () => {
  it('animates 24 on a high tier, 14 on a middling one and 8 on a low one', () => {
    expect(LIVE).toMatchObject({ high: 24, mid: 14, low: 8 });
    expect(liveCount('high')).toBe(24);
    expect(liveCount('ultra')).toBe(24);
    expect(liveCount('mid')).toBe(14);
    expect(liveCount('low')).toBe(8);
    expect(liveCount('unknown')).toBe(8);
  });
});

describe('who moves, who stands still and who is hidden', () => {
  const crowd = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, x: i * 5, y: 0, z: 0 }));

  it('animates the nearest few, poses the rest still and hides anyone past 60 m', () => {
    const pick = lodPick([...crowd, { id: 'far', x: FAR + 1, y: 0, z: 0 }], { x: 0, y: 1.6, z: 0 }, { count: 3 });
    expect(['p0', 'p1', 'p2'].map((id) => pick.get(id))).toEqual(['live', 'live', 'live']);
    expect(['p3', 'p9'].map((id) => pick.get(id))).toEqual(['still', 'still']);
    expect(pick.get('far')).toBe('hidden');
    expect(FAR).toBe(60);
  });

  it('picks by distance from wherever the camera stands', () => {
    const pick = lodPick(crowd, { x: 45, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('p9')).toBe('live');
    expect(pick.get('p8')).toBe('live');
    expect(pick.get('p0')).toBe('still');
  });

  it('gives a body that has finished falling no turn at moving, but keeps it drawn', () => {
    const pick = lodPick([{ id: 'body', x: 1, y: 0, z: 0, settled: true }, ...crowd], { x: 0, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('body')).toBe('still');
    expect(pick.get('p0')).toBe('live');
    expect(pick.get('p1')).toBe('live');
  });

  it('gives a body still going down a turn at moving before anyone living, however far off it lies', () => {
    const pick = lodPick([...crowd, { id: 'falling', x: 40, y: 0, z: 0, falling: true }], { x: 0, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('falling')).toBe('live');
    expect(pick.get('p0')).toBe('live');
    expect(pick.get('p1')).toBe('still');
  });

  it('hides someone in a room that isn’t drawn', () => {
    const pick = lodPick([{ id: 'away', x: 1, y: 0, z: 0, shown: false }], { x: 0, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('away')).toBe('hidden');
  });
});
