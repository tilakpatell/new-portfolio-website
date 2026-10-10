import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applyBlast, falloff, segmentRay } from './blast';
import { createPhysics } from './world';

// the stun shot's blast (projectiles.json): inner 1, radius 2, impulse 500, shockwave 5 / 500
const STUN = { blast: { inner: 1, radius: 2, impulse: 500, shockRadius: 5, shockImpulse: 500, occlusion: true } };
const MASS = 50;

let physics;
beforeAll(async () => {
  physics = await createPhysics({ gravity: 0 });
});

const crate = (p, at) => p.add({ position: at, canSleep: false, linearDamping: 0, mass: MASS, colliders: [{ shape: 'cuboid', args: [0.25, 0.25, 0.25] }] });

describe('falloff', () => {
  it('is whole inside the inner radius, none at the edge, a line between', () => {
    expect(falloff(0.5, 1, 2)).toBe(1);
    expect(falloff(1.5, 1, 2)).toBeCloseTo(0.5, 9);
    expect(falloff(2, 1, 2)).toBe(0);
    expect(falloff(1, 1, 0)).toBe(0);
  });
});

describe('applyBlast', () => {
  it('shoves a crate at the inner radius by the whole impulse, none at the edge or behind a wall', async () => {
    const p = await createPhysics({ gravity: 0 });
    const near = crate(p, [1, 0, 0]);
    const edge = crate(p, [-2, 0, 0]);
    const hid = crate(p, [0, 0, 1]);
    p.add({ type: 'fixed', position: [0, 0, 0.5], colliders: [{ shape: 'cuboid', args: [0.6, 0.6, 0.05] }] });
    p.step(1 / 60); // (rays see what a step has placed)
    const out = applyBlast(p, [0, 0, 0], STUN);
    expect(out.hit.map((h) => h.body)).toEqual([near]);
    expect(out.hit[0].impulse).toBe(500);
    p.step(1 / 60);
    const v = near.body.linvel();
    expect(Math.abs(v.x - 500 / MASS) / (500 / MASS)).toBeLessThan(0.05);
    expect(Math.hypot(edge.body.linvel().x, edge.body.linvel().z)).toBe(0);
    expect(Math.hypot(hid.body.linvel().x, hid.body.linvel().z)).toBe(0);
    p.dispose();
  });

  it('shoves the one behind the wall when the row turns occlusion off', async () => {
    const p = await createPhysics({ gravity: 0 });
    const hid = crate(p, [0, 0, 1]);
    p.add({ type: 'fixed', position: [0, 0, 0.5], colliders: [{ shape: 'cuboid', args: [0.6, 0.6, 0.05] }] });
    p.step(1 / 60);
    const out = applyBlast(p, [0, 0, 0], { blast: { ...STUN.blast, occlusion: false } });
    expect(out.hit.map((h) => h.body)).toEqual([hid]);
    p.dispose();
  });

  it('kicks a fallen body in the shockwave by its impulse, and not one behind a wall', async () => {
    const p = await createPhysics({ gravity: 0 });
    p.add({ type: 'fixed', position: [0, 0, -2], colliders: [{ shape: 'cuboid', args: [2, 2, 0.1] }] });
    p.step(1 / 60);
    const open = { centre: [0.5, 0, 0.5], kick: vi.fn() };
    const far = { centre: () => [6, 0, 0], kick: vi.fn() };
    const behind = { centre: [0, 0, -3], kick: vi.fn() };
    const out = applyBlast(p, [0, 0, 0], STUN, { ragdolls: [open, far, behind] });
    expect(open.kick).toHaveBeenCalledTimes(1);
    const j = open.kick.mock.calls[0][0];
    expect(Math.hypot(...j)).toBeCloseTo(500, 6);
    expect(j[0]).toBeGreaterThan(0);
    expect(far.kick).not.toHaveBeenCalled();
    expect(behind.kick).not.toHaveBeenCalled();
    expect(out.kicked).toHaveLength(1);
    p.dispose();
  });

  it('does nothing for a row without a blast', () => {
    expect(applyBlast(physics, [0, 0, 0], { blast: null })).toEqual({ hit: [], kicked: [] });
  });
});

describe('segmentRay', () => {
  it('finds the first collider along a segment, in bolt.js’s solids form', async () => {
    const p = await createPhysics({ gravity: 0 });
    const wall = p.add({ type: 'fixed', position: [0, 0, 5], colliders: [{ shape: 'cuboid', args: [2, 2, 0.5] }] });
    p.step(1 / 60);
    const ray = segmentRay(p);
    const h = ray([0, 0, 0], [0, 0, 10]);
    expect(h.at[2]).toBeCloseTo(4.5, 4);
    expect(h.normal).toEqual([0, 0, -1]);
    expect(h.body).toBe(wall);
    expect(ray([0, 0, 0], [0, 0, 3])).toBe(null);
    expect(ray([0, 0, 0], [0, 0, 10], wall)).toBe(null);
    p.dispose();
  });
});
