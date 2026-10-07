// The harness itself: a world's rules run frame by frame for as long as
// asked, the player's input fed in, every event kept with its time.
import { describe, expect, it } from 'vitest';
import { DT, simulate } from './harness';

// a toy world: a door that opens once you've pushed on it a second
const door = {
  create: () => ({ pushed: 0, open: false }),
  step(state, input, dt) {
    if (state.open) return [];
    state.pushed = input.push ? state.pushed + dt : 0;
    if (state.pushed < 1) return [];
    state.open = true;
    return [{ type: 'opened' }];
  },
};

describe('simulating a world’s rules', () => {
  it('runs every frame, feeds the script in, and keeps each event with its time', () => {
    const { state, events, frames } = simulate(door, { seconds: 3, input: (t) => ({ push: t > 0.5 }) });
    expect(frames).toBe(Math.round(3 / DT));
    expect(state.open).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].t).toBeGreaterThanOrEqual(1.5 - 1e-9);
    expect(events[0].t).toBeLessThan(1.6);
  });
  it('lets a test look at every frame, and start from a state of its own', () => {
    const seen = [];
    simulate(door, { state: { pushed: 0, open: true }, seconds: 0.1, each: (s) => seen.push(s.open) });
    expect(seen.every(Boolean)).toBe(true);
  });
});
