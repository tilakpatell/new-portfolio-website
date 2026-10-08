import { describe, expect, it } from 'vitest';
import { METRE } from '../foot';
import { createLandingPhysics } from './physics';

// a moon (universes.js: 0.4 × 21 map units across its middle), and a barrel
// stood on top of it, the way furnish stands a thing: its foot on the
// ground, its own +y out from the middle, at a metre to the map's METRE
const R = 0.4 * 21;
const up = [0, 1, 0];
const onTop = (x = 0, z = 0) => {
  const n = [x * METRE, R, z * METRE];
  const l = Math.hypot(...n);
  return n.map((a) => (a / l) * R);
};
const barrel = { min: [-0.3, 0, -0.3], max: [0.3, 0.9, 0.3] };
const dist = (a, b = [0, 0, 0]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const run = (lp, n, frame = () => {}) => {
  for (let i = 0; i < n; i++) {
    frame(i);
    lp.step(1 / 60);
  }
};

describe('createLandingPhysics', () => {
  it('stands a thing on the planet, asleep, and writes nothing while it rests', async () => {
    const lp = await createLandingPhysics({ R });
    const e = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 }, user: 'b' });
    expect(e.user).toBe('b');
    run(lp, 60);
    const writes = [];
    lp.sync((x) => writes.push(x));
    expect(writes).toHaveLength(0);
    lp.dispose();
  });

  it('says no to a body it can’t make, and to anything once it’s gone', async () => {
    const lp = await createLandingPhysics({ R });
    expect(lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: null })).toBe(null);
    expect(lp.add({ position: [NaN, 0, 0], quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'box', mass: 1 } })).toBe(null);
    lp.dispose();
    expect(lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'box', mass: 1 } })).toBe(null);
    expect(() => lp.step(1 / 60)).not.toThrow();
    expect(() => lp.dispose()).not.toThrow();
  });

  it('lets someone walking into it shove it along the ground, and it stays on the planet', async () => {
    const lp = await createLandingPhysics({ R });
    const e = lp.add({ position: onTop(2, 0), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 } });
    const writes = [];
    // (walking +x from 2 m behind it, at a brisk 2 m/s, for 3 s)
    run(lp, 180, (i) => lp.people([{ key: 'me', at: onTop(-0 + (i / 60) * 2, 0), up }]));
    lp.sync((x, p, q) => writes.push({ x, p: [...p], q: [...q] }));
    expect(writes.length).toBe(1);
    expect(writes[0].x).toBe(e);
    const p = writes[0].p;
    expect(p[0] / METRE).toBeGreaterThan(2.5);
    expect(Math.abs(dist(p) - R) / METRE).toBeLessThan(1.2); // (on the ground, not flown off or sunk)
    lp.dispose();
  });

  it('stops a shot that meets it, and the shot knocks it', async () => {
    const lp = await createLandingPhysics({ R });
    lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 } });
    run(lp, 2);
    const h = R + 0.5 * METRE;
    expect(lp.shot([-3 * METRE, h, 3 * METRE], [-3 * METRE, h, -3 * METRE])).toBe(null); // (wide of it)
    const hit = lp.shot([-3 * METRE, h, 0], [3 * METRE, h, 0]);
    expect(hit).not.toBe(null);
    expect(hit.at[0] / METRE).toBeCloseTo(-0.3, 1);
    run(lp, 30);
    const writes = [];
    lp.sync((x, p) => writes.push([...p]));
    expect(writes).toHaveLength(1);
    expect(writes[0][0] / METRE).toBeGreaterThan(0.1);
    lp.dispose();
  });

  it('keeps one pusher a person, and drops those no longer about', async () => {
    const lp = await createLandingPhysics({ R });
    lp.people([{ key: 'me', at: onTop(), up }, { key: 7, at: onTop(5, 0), up }]);
    expect(lp.pushers).toBe(2);
    lp.people([{ key: 'me', at: onTop(0.1, 0), up }]);
    expect(lp.pushers).toBe(1);
    lp.people([]);
    expect(lp.pushers).toBe(0);
    lp.dispose();
  });

  it('tells of a hard hit, with where and how hard', async () => {
    const hits = [];
    const lp = await createLandingPhysics({ R, onHit: (h) => hits.push(h) });
    // (a barrel dropped a metre and a half onto the ground)
    const top = onTop();
    lp.add({ position: [top[0], top[1] + 1.5 * METRE, top[2]], quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 }, awake: true });
    run(lp, 90);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(6); // (once a landing, not once a frame)
    expect(hits[0].force).toBeGreaterThan(0);
    expect(Math.abs(dist(hits[0].at) - R) / METRE).toBeLessThan(2);
    lp.dispose();
  });

  it('walks at any frame rate without shoving what it stops short of', async () => {
    for (const hz of [60, 144, 240]) {
      const lp = await createLandingPhysics({ R });
      lp.add({ position: onTop(2, 0), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 } });
      // (up to the barrel at 1.8 m/s, stopping 0.35 m short of its side: a
      // capsule 0.35 m round, so it never touches)
      const stop = 2 - 0.3 - 0.35 - 0.35;
      const dt = 1 / hz;
      let worst = 0;
      for (let t = 0; t < 3; t += dt) {
        const at = onTop(Math.min(stop, t * 1.8), 0);
        lp.people([{ key: 'me', at, up }], dt);
        lp.step(dt);
        // (its capsule with them: its middle 0.9 m up from where they stand)
        const c = lp.where('me');
        const want = at.map((a, i) => a + up[i] * 0.9 * METRE);
        worst = Math.max(worst, dist(c, want) / METRE);
      }
      expect(worst, `${hz} Hz`).toBeLessThan(0.1);
      const moved = [];
      lp.sync((x, p) => moved.push(p[0] / METRE - 2));
      expect(Math.abs(moved[0] ?? 0), `${hz} Hz`).toBeLessThan(0.05);
      lp.dispose();
    }
  });

  it('stops what’s knocked at the fixed things it meets', async () => {
    const lp = await createLandingPhysics({ R });
    const e = lp.add({ position: onTop(0, 0), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 } });
    // a wall 1 m round, its middle 2.5 m along +x
    lp.walls([{ n: onTop(2.5, 0).map((a) => a / R), r: 1 * METRE }]);
    expect(lp.walls.count).toBe(1);
    e.handle.wake();
    e.handle.body.setLinvel({ x: 6, y: 0, z: 0 }, true);
    for (let i = 0; i < 120; i++) lp.step(1 / 60);
    // (it came to the wall's face, 1.5 m along, and no further: the body's
    // own place, in metres, since it may be asleep again by now)
    expect(e.handle.position()[0]).toBeLessThan(1.5 - 0.3 + 0.1);
    expect(e.handle.position()[0]).toBeGreaterThan(0.5);
    lp.dispose();
  });
});

