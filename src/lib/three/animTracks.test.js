import { describe, expect, it } from 'vitest';
import { createTracks, evalTrack } from './animTracks';

// the asteroid's turn, as the bucket stores it: 0 to 360 over 30 s, linear
const SPIN = [
  [0, 0, 1, 0, 0.08304548, 0.996545732],
  [30.0000019, 360, 0.08304548, 0.996545732, 1, 0],
];

describe('animTracks', () => {
  it('evaluates the Hermite keys: 0 at 0, 360 at 30, half-way between', () => {
    expect(evalTrack(SPIN, 0)).toBeCloseTo(0, 4);
    expect(evalTrack(SPIN, 30.0000019)).toBeCloseTo(360, 3);
    expect(evalTrack(SPIN, 15)).toBeCloseTo(180, 1);
    expect(evalTrack(SPIN, 45, { loop: true })).toBeCloseTo(180, 1);
  });

  it('turns a node about its channel’s axis in degrees, and puts it back', () => {
    const node = { rotation: { x: 0, y: 0.5, z: 0 } };
    const t = createTracks([{ owner: 'rock', channel: 'rotation.y', keys: SPIN, loop: true }], { nodeOf: () => node });
    t.update(7.5);
    expect(node.rotation.y).toBeCloseTo(0.5 + Math.PI / 2, 2);
    t.dispose();
    expect(node.rotation.y).toBe(0.5);
  });
});
