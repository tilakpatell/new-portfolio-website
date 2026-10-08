import { describe, expect, it } from 'vitest';
import { PILOT_GOAL, REAIM_MS, parkBehind, pilotId, pilotSpace, reached } from './pilotGoal';
import { SPACE, forward } from './ship';

const pose = { x: 10, y: 3, z: -20, heading: 0.7 };

describe('the park behind a pilot', () => {
  it('reads a pilot goal, and nothing else', () => {
    expect(PILOT_GOAL.test('pilot:ab12')).toBe(true);
    expect(pilotId('pilot:ab12')).toBe('ab12');
    expect(pilotId('marvel')).toBeNull();
    expect(pilotId('pilot:')).toBeNull();
    expect(pilotId(null)).toBeNull();
    expect(pilotId({ id: 'pilot:x' })).toBeNull();
    expect(REAIM_MS).toBe(1000);
  });

  it('the park is six units behind on the heading', () => {
    const p = parkBehind(pose);
    const [fx, fz] = forward(pose.heading);
    expect(p.x).toBeCloseTo(pose.x - fx * 6);
    expect(p.z).toBeCloseTo(pose.z - fz * 6);
    // at their height, facing their way
    expect(p.y).toBe(pose.y);
    expect(p.heading).toBe(pose.heading);
    expect(Math.hypot(p.x - pose.x, p.y - pose.y, p.z - pose.z)).toBeCloseTo(6);
    // (looking along their heading from the park, they're straight ahead)
    expect(((pose.x - p.x) * fx + (pose.z - p.z) * fz) / 6).toBeCloseTo(1);
    expect(Math.hypot(parkBehind(pose, { back: 10 }).x - pose.x, parkBehind(pose, { back: 10 }).z - pose.z)).toBeCloseTo(10);
  });

  it('pilotSpace adds the goal and leaves the rest', () => {
    const space = pilotSpace(SPACE, 'ab12', pose);
    const g = space.goals['pilot:ab12'];
    const p = parkBehind(pose);
    expect(g).toMatchObject(p);
    expect(g.at).toEqual([p.x, p.y, p.z]);
    // every other goal, and everything else about the space, as it was
    for (const id of Object.keys(SPACE.goals)) expect(space.goals[id]).toBe(SPACE.goals[id]);
    expect(Object.keys(space.goals)).toHaveLength(Object.keys(SPACE.goals).length + 1);
    expect(space.solids).toBe(SPACE.solids);
    expect(space.driveAt).toBe(SPACE.driveAt);
    // (and the space it came from is untouched)
    expect(SPACE.goals['pilot:ab12']).toBeUndefined();
  });

  it('reached within eight', () => {
    expect(reached({ x: pose.x + 7.9, y: pose.y, z: pose.z }, pose)).toBe(true);
    expect(reached({ x: pose.x + 5, y: pose.y + 5, z: pose.z + 5 }, pose)).toBe(false);
    expect(reached({ x: pose.x, y: pose.y, z: pose.z + 11 }, pose, 12)).toBe(true);
    expect(reached(null, pose)).toBe(false);
    expect(reached({ x: 0, y: 0, z: 0 }, null)).toBe(false);
  });

  it('a stale pilot ends the trip', () => {
    // their pose gone: no goal for them, even in a space that had one
    const had = pilotSpace(SPACE, 'ab12', pose);
    expect(pilotSpace(SPACE, 'ab12', null).goals['pilot:ab12']).toBeUndefined();
    expect(pilotSpace(had, 'ab12', null).goals['pilot:ab12']).toBeUndefined();
    expect(pilotSpace(had, 'ab12', null).goals.marvel).toBe(SPACE.goals.marvel);
    // a pose that isn't one is no pose
    expect(pilotSpace(SPACE, 'ab12', { x: Number.NaN, y: 0, z: 0, heading: 0 }).goals['pilot:ab12']).toBeUndefined();
    expect(parkBehind(null)).toBeNull();
  });
});
