import { describe, expect, it } from 'vitest';
import { createSolids } from './walker';
import { createSurfacePhysics } from './surfacePhysics';
import { createHostileBody, rateFor } from './hostileBodies';
import { filterOf } from '../../../lib/physics/groups';

const STEP = 1 / 60;
function fixture() {
  const solids = createSolids();
  solids.circle(5, 0, 1);
  return { heightAt: () => 0, normalAt: () => [0, 1, 0], solids, floors: [], reach: 32 };
}
const target = (x = 0, z = 0) => ({ b: { x, z, yaw: 0, to: null, wait: 0 }, spec: { scale: 1 }, hostile: { range: 20, chase: 4, melee: true, reach: 1.6 }, home: [x, z] });
async function setup() {
  const sp = await createSurfacePhysics(fixture());
  const t = target();
  const hb = createHostileBody(sp, t, { tall: 1.8, seed: 3 });
  // a frame as activity.js runs it: the plan driven from where it is, the world stepped, the state read back
  const frames = (n, plan) => {
    for (let i = 0; i < n; i++) {
      const was = { x: t.b.x, z: t.b.z };
      const p = plan ? plan(t.b, STEP) : { x: t.b.x, z: t.b.z, yaw: t.b.yaw };
      hb.step(STEP, {});
      hb.drive(p, was, STEP);
      sp.step(STEP);
      hb.sync(t.b);
    }
  };
  return { sp, t, hb, frames };
}
const east = (b, dt) => ({ x: b.x + 4 * dt, z: b.z, yaw: Math.PI / 2 });

describe('createHostileBody', () => {
  it('drives where it is planned, and the trunk stops it', async () => {
    const { sp, t, hb, frames } = await setup();
    frames(60, east);
    expect(t.b.x).toBeGreaterThan(3.5);
    expect(t.b.x).toBeLessThan(4.1);
    expect(t.b.yaw).toBeCloseTo(Math.PI / 2, 2);
    frames(120, east);
    expect(t.b.x).toBeLessThan(3.8);
    expect(hb.y).toBeCloseTo(0, 1);
    sp.dispose();
  });

  it('struck stuns it: a drive moves it no further, the knock does, then it chases again', async () => {
    const { sp, t, hb, frames } = await setup();
    hb.saw(true);
    frames(1);
    expect(hb.mind.state).toBe('chase');
    hb.struck({ dir: [0, 0, 1], force: 2.5, kind: 'light', stun: 0.3 });
    frames(1);
    expect(hb.mind.state).toBe('stunned');
    const x0 = t.b.x;
    frames(12, east);
    expect(Math.abs(t.b.x - x0)).toBeLessThan(0.05);
    expect(t.b.z).toBeGreaterThan(0.1);
    expect(hb.mind.intent.mode).toBe('stunned');
    frames(20, east);
    expect(hb.mind.state).toBe('chase');
    expect(t.b.x - x0).toBeGreaterThan(0.5);
    sp.dispose();
  });

  it('saw moves patrol to chase and back to search', async () => {
    const { sp, hb, frames } = await setup();
    expect(hb.mind.state).toBe('patrol');
    hb.saw(true);
    frames(1);
    expect(hb.mind.state).toBe('chase');
    hb.saw(true);
    hb.saw(false);
    frames(1);
    expect(hb.mind.state).toBe('search');
    expect(hb.mind.intent.mode).toBe('search');
    sp.dispose();
  });

  it('dead removes its bodies and a drive moves nothing', async () => {
    const { sp, t, hb, frames } = await setup();
    const n = sp.phys.world.bodies.len();
    hb.dead();
    frames(1);
    expect(hb.mind.state).toBe('dead');
    expect(sp.phys.world.bodies.len()).toBe(n - 1);
    expect(() => frames(10, east)).not.toThrow();
    expect(t.b.x).toBeCloseTo(0, 2);
    sp.dispose();
  });

  it('an unrigged figure has one hurtbox, whole, that a ray finds', async () => {
    const { sp, hb, frames } = await setup();
    expect(hb.rig.single).toBe(true);
    expect(hb.hurt.regions).toEqual(['whole']);
    frames(2);
    const h = sp.q.ray([3, 1, 0], [-1, 0, 0], 10, { groups: filterOf('hurtbox') });
    expect(h.tag).toBe('whole');
    expect(h.body).toBe(hb.c.body);
    sp.dispose();
  });

  it('rateFor has the rings, and rate() sets the mind’s pace', async () => {
    expect(rateFor(10)).toBe(10);
    expect(rateFor(40)).toBe(4);
    expect(rateFor(80)).toBe(1);
    const { sp, hb } = await setup();
    hb.rate(80);
    expect(hb.mind.every).toBe(1);
    sp.dispose();
  });

  it('dispose removes the bodies and the hook', async () => {
    const { sp, hb, frames } = await setup();
    const n = sp.phys.world.bodies.len();
    hb.dispose();
    expect(sp.phys.world.bodies.len()).toBe(n - 1);
    expect(() => frames(2, east)).not.toThrow();
    sp.dispose();
  });
});
