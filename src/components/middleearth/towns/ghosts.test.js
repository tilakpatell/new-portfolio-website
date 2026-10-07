import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createGhosts } from './ghosts';

// The name cards are drawn on a canvas; Node has none, so a card that measures
// and draws nothing stands in for it.
beforeAll(() => {
  const pen = { measureText: () => ({ width: 60 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {} };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) });
});
afterAll(() => vi.unstubAllGlobals());

const make = () => ({ group: new THREE.Group(), top: 1.6 });

describe('the ghosts', () => {
  it("a ghost's gait clock runs at the frame's pace whichever way it walks", () => {
    const seen = new Map();
    const animate = vi.fn((f, t, p) => seen.set(p.id, t));
    const ghosts = createGhosts({ make, animate });
    const dt = 1 / 60;
    let t = 0;
    let x = 0;
    const step = (vx) => {
      t += dt;
      x += vx * dt;
      ghosts.update(
        [
          { id: 'abc', name: 'Sam', x, z: 0, face: 0, moving: true },
          { id: 'xyz', name: 'Pip', x: -x, z: 2, face: 0, moving: true },
        ],
        t,
        dt,
      );
    };
    step(0);
    for (const vx of [-3, 3]) {
      const from = seen.get('abc');
      const fromB = seen.get('xyz');
      for (let i = 0; i < 60; i++) step(vx);
      expect(Math.abs(seen.get('abc') - from - 1)).toBeLessThan(0.02);
      expect(Math.abs(seen.get('xyz') - fromB - 1)).toBeLessThan(0.02);
    }
    // two travellers don't step in time with each other
    expect(Math.abs(seen.get('abc') - seen.get('xyz'))).toBeGreaterThan(0.01);
    ghosts.dispose();
  });

  it('hands the world an emote, timed from when it was heard, and how they move', () => {
    const got = [];
    const ghosts = createGhosts({ make, animate: (f, t, p) => got.push(p) });
    const dt = 0.1;
    const motion = { speed: 1.2, side: 0, turn: 0 };
    // their message as it came in (travellers.js): the wave a second on already
    const p = { id: 'abc', name: 'Sam', x: 0, z: 0, face: 0, moving: false, emote: { id: 'wave', age: 1 }, motion };
    ghosts.update([p], 0, dt);
    const first = got.at(-1).emote;
    expect(first).toMatchObject({ id: 'wave' });
    expect(first.t).toBeCloseTo(1, 2);
    expect(got.at(-1).motion).toBe(motion);
    // frames on: the same wave, further in
    ghosts.update([p], 0.1, dt);
    ghosts.update([p], 0.2, dt);
    expect(got.at(-1).emote.at).toBe(first.at);
    expect(got.at(-1).emote.t).toBeCloseTo(1.2, 2);
    // the next message, a moment later: still the same wave
    p.emote = { id: 'wave', age: 1.3 };
    ghosts.update([p], 0.3, dt);
    expect(got.at(-1).emote.at).toBe(first.at);
    // they stop: none
    p.emote = null;
    ghosts.update([p], 0.4, dt);
    expect(got.at(-1).emote).toBeNull();
    ghosts.dispose();
  });

  it('an older traveller’s message, without them, goes to the world as it came', () => {
    const got = [];
    const ghosts = createGhosts({ make, animate: (f, t, p) => got.push(p) });
    const p = { id: 'old', name: 'Pip', x: 0, z: 0, face: 0, moving: true };
    ghosts.update([p], 0, 0.1);
    expect(got[0]).toBe(p);
    expect(got[0]).not.toHaveProperty('emote');
    ghosts.dispose();
  });
});
