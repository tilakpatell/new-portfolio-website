import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { FLEE, PACE, brainFor } from './brains';

const actor = (role, x = 0, z = 0, row = {}) => ({ id: `${role}${x},${z}`, role, row: { spread: 30, ...row }, b: { x, y: 0, z, yaw: 0 }, home: [0, 0] });
const ctxOf = (over = {}) => ({ ship: null, shipAlt: 500, mates: [], prey: () => null, rand: seeded(7), t: 0, ...over });
// the life streamer's part: move by the intent
const move = (a, i, dt) => {
  a.b.x += i.dir.x * i.speed * dt;
  a.b.z += i.dir.z * i.speed * dt;
};

describe('brains', () => {
  it('has one for every role on the ground, none for a ship', () => {
    for (const role of ['herd', 'predator', 'patrol', 'settler', 'hostile', 'wander', 'flock']) expect(brainFor(actor(role))).toBeTruthy();
    expect(brainFor(actor('air'))).toBe(null);
  });

  it('keeps a herd together, and runs it from a ship that comes in low', () => {
    const herd = [actor('herd', 0, 0), actor('herd', 3, 0), actor('herd', 0, 3)];
    const brains = herd.map((a) => brainFor(a));
    const calm = brains[0].step(ctxOf({ mates: herd }), 0.1);
    expect(calm.speed).toBeLessThanOrEqual(PACE.graze);
    const ship = { x: 50, y: 20, z: 0 };
    const run = brains[0].step(ctxOf({ mates: herd, ship, shipAlt: FLEE.alt - 10 }), 0.1);
    expect(run.mode).toBe('flee');
    expect(run.speed).toBe(PACE.run);
    expect(run.dir.x).toBeLessThan(0); // (away from the ship)
    // high overhead, it grazes on
    expect(brains[0].step(ctxOf({ mates: herd, ship, shipAlt: 400 }), 0.1).mode).not.toBe('flee');
  });

  it('stalks, lunges, then rests', () => {
    const wolf = actor('predator', 0, 0);
    const prey = actor('herd', 0, 60);
    const brain = brainFor(wolf);
    const ctx = ctxOf({ prey: () => prey });
    let i = brain.step(ctx, 0.1);
    expect(i.mode).toBe('stalk');
    expect(i.dir.z).toBeGreaterThan(0.9);
    const modes = new Set();
    for (let k = 0; k < 1000 && !modes.has('rest'); k++) {
      i = brain.step(ctx, 0.05);
      modes.add(i.mode);
      move(wolf, i, 0.05);
    }
    expect(modes.has('lunge')).toBe(true);
    expect(modes.has('rest')).toBe(true);
    expect(brain.step(ctx, 0.1).speed).toBe(0);
  });

  it('walks a patrol round its beat, stopping to look', () => {
    const guard = actor('patrol', 0, 0, { spread: 20 });
    const brain = brainFor(guard, 0.25);
    const modes = [];
    for (let k = 0; k < 600; k++) {
      const i = brain.step(ctxOf(), 0.1);
      modes.push(i.mode);
      move(guard, i, 0.1);
      expect(Math.hypot(guard.b.x, guard.b.z)).toBeLessThan(25);
    }
    expect(modes).toContain('beat');
    expect(modes).toContain('look');
  });

  it('goes about a settler’s day, near home', () => {
    const s = actor('settler', 0, 0);
    const other = actor('settler', 10, 0);
    const brain = brainFor(s, 0.2);
    const modes = new Set();
    for (let k = 0; k < 800; k++) {
      const i = brain.step(ctxOf({ mates: [s, other] }), 0.1);
      modes.add(i.mode);
      move(s, i, 0.1);
    }
    expect(modes.size).toBeGreaterThan(1);
    expect(Math.hypot(s.b.x, s.b.z)).toBeLessThan(60);
  });

  it('sees a ship in range, and fires bursts at it by the galaxy’s rules', () => {
    const t = actor('hostile', 0, 0, { hostile: { range: 300, burst: { n: 3, gap: 0.14 }, strafe: { speed: 3, every: 2.4, keep: 180 }, damage: 4 } });
    const brain = brainFor(t);
    const ship = { x: 0, y: 120, z: 150 };
    let shots = 0;
    for (let k = 0; k < 200; k++) {
      const i = brain.step(ctxOf({ ship, t: k * 0.1 }), 0.1);
      if (i.fire) {
        shots += i.fire.n;
        expect(i.fire.damage).toBe(4);
        expect(Math.hypot(i.fire.at[0] - ship.x, i.fire.at[2] - ship.z)).toBeLessThan(1);
      }
      move(t, i, 0.1);
    }
    expect(shots).toBeGreaterThan(3);
    // nothing seen, nothing fired
    const calm = brainFor(actor('hostile', 0, 0, { hostile: { range: 300 } }));
    for (let k = 0; k < 50; k++) expect(calm.step(ctxOf({ ship: { x: 5000, y: 300, z: 5000 } }), 0.1).fire).toBeFalsy();
  });

  it('keeps a flock together', () => {
    const birds = [0, 1, 2, 3].map((k) => actor('flock', k * 4, 0));
    const brains = birds.map((a) => brainFor(a));
    for (let k = 0; k < 300; k++)
      birds.forEach((a, j) => {
        const i = brains[j].step(ctxOf({ mates: birds }), 0.05);
        move(a, i, 0.05);
      });
    const xs = birds.map((a) => a.b.x);
    const zs = birds.map((a) => a.b.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(80);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(80);
  });
});
