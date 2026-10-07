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
});
