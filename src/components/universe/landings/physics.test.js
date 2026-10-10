import { describe, expect, it } from 'vitest';
import { METRE } from '../foot';
import { createImpacts } from '../../../lib/impact';
import { capHeights, createLandingPhysics } from './physics';

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
// a box stood on its foot, w across (along x), t tall and d deep, metres
const boxOf = (w, t, d) => ({ min: [-w / 2, 0, -d / 2], max: [w / 2, t, d / 2] });
const crate = boxOf(0.81, 0.8, 0.8);
// the turn taking +y to the unit vector n (the way furnish stands a thing)
const standing = ([x, y, z]) => {
  const q = [z, 0, -x, 1 + y];
  const l = Math.hypot(...q);
  return q.map((a) => a / l);
};
// how far (degrees) a body's own +y leans from the planet's up where it is
const lean = (h) => {
  const p = h.position();
  const [x, y, z, w] = h.quaternion();
  const own = [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)];
  const l = Math.hypot(...p);
  const c = (own[0] * p[0] + own[1] * p[1] + own[2] * p[2]) / l;
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
};
// a shot along +x through the thing stood on top, `high` metres up it,
// from 4 m before it to 4 m past
const level = (lp, high) => lp.shot([-4 * METRE, R + high * METRE, 0], [4 * METRE, R + high * METRE, 0]);

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
    const e = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 } });
    run(lp, 2);
    const h = R + 0.5 * METRE;
    expect(lp.shot([-3 * METRE, h, 3 * METRE], [-3 * METRE, h, -3 * METRE])).toBe(null); // (wide of it)
    const hit = lp.shot([-3 * METRE, h, 0], [3 * METRE, h, 0]);
    expect(hit).not.toBe(null);
    expect(hit.at[0] / METRE).toBeCloseTo(-0.3, 1);
    const was = e.handle.position();
    const Rm = R / METRE;
    let high = 0;
    const writes = [];
    run(lp, 120, (i) => {
      high = Math.max(high, dist(e.handle.position()) - Rm);
      if (i === 30) lp.sync((x, p) => writes.push([...p]));
    });
    // (written while it moved, sent on its way, and hopped up off the ground)
    expect(writes).toHaveLength(1);
    expect(writes[0][0] / METRE).toBeGreaterThan(0.1);
    expect(dist(e.handle.position(), was)).toBeGreaterThan(0.6);
    expect(high).toBeGreaterThan(0.03);
    lp.dispose();
  });

  it('knocks a heavy thing clearly, a light one not out of sight', async () => {
    const things = [
      { name: 'an 8 kg crate', box: crate, body: { shape: 'box', mass: 8 }, least: 0.4 },
      { name: 'a 25 kg AC unit', box: boxOf(0.89, 0.6, 0.35), body: { shape: 'box', mass: 25 }, least: 0.3 },
      { name: 'a 0.2 kg plumbus', box: boxOf(0.55, 0.78, 0.32), body: { shape: 'cylinder', mass: 0.2 }, least: 0.4, most: 8 },
    ];
    // (on the ball, and on the cap the landing has: the cap only lets it sleep)
    for (const spot of [null, up]) {
      for (const t of things) {
        const lp = await createLandingPhysics({ R, spot });
        const e = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: t.box, body: t.body });
        run(lp, 2);
        const was = e.handle.position();
        expect(level(lp, t.box.max[1] / 2), t.name).not.toBe(null);
        run(lp, 360);
        const moved = dist(e.handle.position(), was);
        const on = `${t.name}, ${spot ? 'cap' : 'ball'}`;
        expect(moved, on).toBeGreaterThanOrEqual(t.least);
        if (t.most) expect(moved, on).toBeLessThanOrEqual(t.most);
        expect(e.handle.resets, on).toBe(0); // (never flown off or sunk)
        lp.dispose();
      }
    }
  });

  it('pushes a crate along the ground for a shot from eye height 4 m away', async () => {
    const lp = await createLandingPhysics({ R, spot: up });
    const e = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: crate, body: { shape: 'box', mass: 8 } });
    run(lp, 2);
    const was = e.handle.position();
    // (from 1.6 m up, down at the middle of its top)
    expect(lp.shot([-4 * METRE, R + 1.6 * METRE, 0], [4 * METRE, R, 0])).not.toBe(null);
    run(lp, 360);
    expect(dist(e.handle.position(), was)).toBeGreaterThanOrEqual(0.4);
    lp.dispose();
  });

  it('tips a chair hit high, and slides a crate hit low upright', async () => {
    const lp = await createLandingPhysics({ R, spot: up });
    const chair = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: boxOf(0.415, 0.95, 0.42), body: { shape: 'box', mass: 4 } });
    run(lp, 2);
    expect(level(lp, 0.85 * 0.95)).not.toBe(null);
    run(lp, 180);
    expect(lean(chair.handle)).toBeGreaterThan(45);
    lp.dispose();
    const lp2 = await createLandingPhysics({ R, spot: up });
    const box = lp2.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: crate, body: { shape: 'box', mass: 8 } });
    run(lp2, 2);
    const was = box.handle.position();
    expect(level(lp2, 0.25 * 0.8)).not.toBe(null);
    run(lp2, 180);
    expect(lean(box.handle)).toBeLessThan(10);
    expect(dist(box.handle.position(), was)).toBeGreaterThan(0.3);
    lp2.dispose();
  });

  it('stops a shot at a fixed thing, which doesn’t move; not at the ground or a wall’s post', async () => {
    const lp = await createLandingPhysics({ R, spot: up });
    const e = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: boxOf(0.3, 0.9, 0.3), body: { shape: 'cylinder', mass: 60, fixed: true } });
    lp.walls([{ n: onTop(0, 6).map((a) => a / R), r: 0.5 * METRE }]);
    run(lp, 2);
    const was = e.handle.position();
    const hit = level(lp, 0.5);
    expect(hit).not.toBe(null);
    expect(hit.entry).toBe(e);
    expect(hit.at[0] / METRE).toBeCloseTo(-0.15, 1);
    run(lp, 60);
    expect(dist(e.handle.position(), was)).toBe(0);
    // (a wall's post 6 m off, and a shot down into the ground: both flown through)
    const h = R + 0.5 * METRE;
    expect(lp.shot([-4 * METRE, h, 6 * METRE], [4 * METRE, h, 6 * METRE])).toBe(null);
    expect(lp.shot([3 * METRE, R + 1.6 * METRE, 0], [3 * METRE, R - 1 * METRE, 0])).toBe(null);
    lp.dispose();
  });

  it('stops a shot at a sign’s pole, and lets one a hand’s width off it by', async () => {
    const lp = await createLandingPhysics({ R, spot: up });
    // (a stop sign: its plate 0.62 m across up top, its pole 6.4 cm thick)
    const sign = { min: [-0.31, 0, -0.05], max: [0.31, 2.4, 0.05] };
    const e = lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: sign, body: { shape: 'cylinder', mass: 15, fixed: true, r: 0.032, at: [0, -0.02] } });
    run(lp, 2);
    const hit = level(lp, 1.1);
    expect(hit?.entry).toBe(e);
    // (at its face, round a pole 2 cm behind the line the shot flies)
    expect(hit.at[0] / METRE).toBeCloseTo(-Math.sqrt(0.032 ** 2 - 0.02 ** 2), 3);
    // (at a chest's height, 15 cm to the side of it: no stop in the air)
    const h = R + 1.1 * METRE;
    expect(lp.shot([-4 * METRE, h, 0.15 * METRE], [4 * METRE, h, 0.15 * METRE])).toBe(null);
    lp.dispose();
  });

  it('has a knocked thing asleep again within 3 s, on the cap round the landing', async () => {
    // (on top, and somewhere down the side: the cap turned to stand there)
    for (const spot of [up, [0.6, 0.64, -0.48]]) {
      const n = spot.map((a) => a / Math.hypot(...spot));
      const lp = await createLandingPhysics({ R, spot });
      const e = lp.add({ position: n.map((a) => a * R), quaternion: standing(n), scale: 1, box: crate, body: { shape: 'box', mass: 8 } });
      run(lp, 2);
      // (level, through its middle, across the ground)
      const across = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0];
      const a = Math.hypot(...across);
      const mid = n.map((x) => x * (R + 0.4 * METRE));
      const hit = lp.shot(
        mid.map((x, i) => x - (across[i] / a) * 4 * METRE),
        mid.map((x, i) => x + (across[i] / a) * 4 * METRE),
      );
      expect(hit, String(spot)).not.toBe(null);
      expect(e.handle.sleeping).toBe(false);
      let slept = -1;
      for (let i = 0; i < 180 && slept < 0; i++) {
        lp.step(1 / 60);
        if (e.handle.sleeping) slept = i;
      }
      expect(slept, String(spot)).toBeGreaterThanOrEqual(0);
      // (and still: no slow turn on the spot, and on the ground)
      const q = e.handle.quaternion();
      run(lp, 300);
      const q2 = e.handle.quaternion();
      const turned = 2 * Math.acos(Math.min(1, Math.abs(q[0] * q2[0] + q[1] * q2[1] + q[2] * q2[2] + q[3] * q2[3])));
      expect((turned * 180) / Math.PI, String(spot)).toBeLessThan(1);
      expect(Math.abs(dist(e.handle.position()) - R / METRE), String(spot)).toBeLessThan(0.01);
      lp.dispose();
    }
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
    const lp = await createLandingPhysics({ R, onHit: (force, at, entry) => hits.push({ force, at, entry }) });
    // (a barrel dropped a metre and a half onto the ground)
    const top = onTop();
    lp.add({ position: [top[0], top[1] + 1.5 * METRE, top[2]], quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass: 2 }, awake: true });
    // the hit law's one throttle (lib/impact.js: once a thing within its gap), on the steps' clock
    let t = 0;
    const law = createImpacts({ now: () => t });
    const told = [];
    let seen = 0;
    run(lp, 90, () => {
      t += 1 / 60;
      for (; seen < hits.length; seen++) {
        const r = law.hit(hits[seen].force, hits[seen].at, hits[seen].entry);
        if (r) told.push(r);
      }
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(told.length).toBeGreaterThan(0);
    expect(told.length).toBeLessThan(6); // (once a landing, not once a frame)
    // (a contact is told over the law's own threshold, a kilogram)
    expect(hits[0].force).toBeGreaterThan(15);
    expect(hits[0].entry.handle).toBeTruthy();
    expect(Math.abs(dist(hits[0].at) - R) / METRE).toBeLessThan(2);
    lp.dispose();
  });

  it('tells nothing of a heavy thing lying there, however heavy', async () => {
    // (lying there it pushes on the ground with its weight, g a kilogram: not a knock)
    for (const mass of [0.1, 2, 5, 40]) {
      const hits = [];
      const lp = await createLandingPhysics({ R, onHit: (force) => hits.push(force) });
      lp.add({ position: onTop(), quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass }, awake: true });
      run(lp, 120);
      expect(hits, `${mass} kg`).toEqual([]);
      lp.dispose();
    }
  });

  it('tells a light thing’s knock as a heavy one’s, a kilogram, over the law’s threshold', async () => {
    const top = onTop();
    const first = async (mass, threshold) => {
      const hits = [];
      const lp = await createLandingPhysics({ R, threshold, onHit: (force) => hits.push(force) });
      lp.add({ position: [top[0], top[1] + 1.5 * METRE, top[2]], quaternion: [0, 0, 0, 1], scale: 1, box: barrel, body: { shape: 'cylinder', mass }, awake: true });
      run(lp, 90);
      lp.dispose();
      return hits;
    };
    // (a diya, 0.1 kg, and a chest, 5 kg, each dropped a metre and a half: the same knock to the law)
    const diya = await first(0.1, 15);
    const chest = await first(5, 15);
    expect(diya.length).toBeGreaterThan(0);
    expect(chest.length).toBeGreaterThan(0);
    expect(Math.max(...diya) / Math.max(...chest)).toBeCloseTo(1, 1);
    // a lower threshold on the panel hears quieter knocks
    expect((await first(2, 1)).length).toBeGreaterThan((await first(2, 60)).length);
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

describe('capHeights', () => {
  it('is the planet’s own round ground, level at its middle, the same all ways round', () => {
    const n = 5;
    const h = capHeights(311, { n, size: 100 });
    expect(h).toHaveLength(n * n);
    expect(h[2 * n + 2]).toBe(0);
    const corner = Math.sqrt(311 * 311 - 2 * 50 * 50) - 311;
    for (const [ix, iz] of [
      [0, 0],
      [0, n - 1],
      [n - 1, 0],
      [n - 1, n - 1],
    ])
      expect(h[ix * n + iz]).toBeCloseTo(corner, 4);
    for (let ix = 0; ix < n; ix++)
      for (let iz = 0; iz < n; iz++) {
        expect(h[iz * n + ix]).toBe(h[ix * n + iz]);
        expect(h[(n - 1 - ix) * n + iz]).toBe(h[ix * n + iz]);
        expect(h[ix * n + iz]).toBeLessThanOrEqual(0);
      }
  });
});

