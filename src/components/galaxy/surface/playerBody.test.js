import { describe, expect, it } from 'vitest';
import { WALK, createSolids, walker } from './walker';
import { createSurfacePhysics } from './surfacePhysics';
import { createPlayerBody } from './playerBody';

const STEP = 1 / 60;
function fixture(more = {}) {
  const solids = createSolids();
  solids.circle(5, 0, 1);
  return { heightAt: () => 0, normalAt: () => [0, 1, 0], solids, floors: [], reach: 32, ...more };
}
const still = { x: 0, y: 0, run: false, heading: 0, jump: false };
const ahead = (heading, run = false) => ({ x: 0, y: 1, run, heading, jump: false });
async function setup(world = fixture()) {
  const sp = await createSurfacePhysics(world);
  const st = walker(0, 0, 0, 0);
  const pb = createPlayerBody(sp, st);
  const frames = (input, n, each = null) => {
    let landed = 0;
    for (let i = 0; i < n; i++) {
      pb.step(typeof input === 'function' ? input(i) : input, STEP);
      sp.step(STEP);
      landed = Math.max(landed, pb.sync(st));
      each?.(i);
    }
    return landed;
  };
  return { sp, st, pb, frames };
}

describe('createPlayerBody', () => {
  it('walking forward for a second moves the state about 3.3 m, facing the way', async () => {
    const { sp, st, frames } = await setup();
    frames(ahead(0), 60);
    expect(st.z).toBeGreaterThan(2.9);
    expect(st.z).toBeLessThan(3.4);
    expect(Math.abs(st.x)).toBeLessThan(0.05);
    expect(st.yaw).toBeCloseTo(0, 3);
    expect(st.grounded).toBe(true);
    expect(st.y).toBeCloseTo(0, 1);
    expect(st.speed).toBeGreaterThan(3);
    sp.dispose();
  });

  it('runs faster than it walks', async () => {
    const { sp, st, frames } = await setup();
    frames(ahead(0, true), 60);
    expect(st.z).toBeGreaterThan(6);
    sp.dispose();
  });

  it('the state stops at the trunk', async () => {
    const { sp, st, frames } = await setup();
    frames(ahead(Math.PI / 2), 180);
    expect(st.x).toBeLessThan(3.8);
    expect(st.x).toBeGreaterThan(3.3);
    sp.dispose();
  });

  it('a jump leaves the ground and lands, and says so', async () => {
    const { sp, st, pb, frames } = await setup();
    frames(still, 10);
    const o = pb.step({ ...still, jump: true }, STEP);
    expect(o.jumped).toBe(true);
    sp.step(STEP);
    pb.sync(st);
    let top = 0;
    const landed = frames(still, 90, () => (top = Math.max(top, st.y)));
    expect(top).toBeGreaterThan(0.6);
    expect(st.grounded).toBe(true);
    expect(landed).toBeGreaterThan(3);
    sp.dispose();
  });

  it('sync never runs ahead and moves at most one substep a sync', async () => {
    const { sp, st, pb } = await setup();
    let last = 0;
    for (let i = 0; i < 240; i++) {
      pb.step(ahead(0), 1 / 120);
      sp.step(1 / 120);
      pb.sync(st);
      expect(st.z).toBeGreaterThanOrEqual(last - 1e-9);
      expect(st.z - last).toBeLessThan(WALK.walk * STEP + 1e-6);
      last = st.z;
    }
    expect(st.z).toBeGreaterThan(5.5);
    sp.dispose();
  });

  it('teleport places and clears the knock', async () => {
    const { sp, st, pb, frames } = await setup();
    pb.knock([6, 0, 0]);
    pb.teleport(10, 0, 5, Math.PI);
    expect([st.x, st.y, st.z, st.yaw]).toEqual([10, 0, 5, Math.PI]);
    frames(still, 30);
    expect(st.x).toBeCloseTo(10, 1);
    expect(st.z).toBeCloseTo(5, 1);
    sp.dispose();
  });

  it('a position written to the state by someone else moves the body', async () => {
    const { sp, st, frames } = await setup();
    frames(still, 5);
    st.x = 20;
    st.z = 20;
    frames(still, 5);
    expect(st.x).toBeCloseTo(20, 1);
    expect(st.z).toBeCloseTo(20, 1);
    sp.dispose();
  });

  it('a vertical speed written to the state lifts the body (the jetpack)', async () => {
    const { sp, st, frames } = await setup();
    frames(still, 5);
    frames(still, 20, () => {
      st.vy = 5;
      st.grounded = false;
    });
    expect(st.y).toBeGreaterThan(1);
    expect(st.grounded).toBe(false);
    sp.dispose();
  });

  it('wades no deeper than the knees and stops at deep water where a world says so', async () => {
    const world = fixture({ heightAt: (x) => (x > 8 ? -3 : x > 4 ? -0.5 : 0), water: 0, wadeMax: 1, solids: createSolids() }); // (no trunk in the way)
    const { sp, st, frames } = await setup(world);
    frames(ahead(Math.PI / 2, true), 120);
    expect(st.y).toBeGreaterThan(-0.95);
    expect(st.wading).toBeGreaterThan(0.3);
    frames(ahead(Math.PI / 2, true), 240);
    expect(st.x).toBeLessThan(8.5);
    sp.dispose();
  });

  it('keeps inside the world', async () => {
    const { sp, st, frames } = await setup();
    frames(ahead(-Math.PI / 2, true), 600);
    expect(Math.hypot(st.x, st.z)).toBeLessThanOrEqual(32.01);
    sp.dispose();
  });

  it('a yaw written to the state turns the body without killing a jump or a knock', async () => {
    const { sp, st, pb, frames } = await setup();
    frames(still, 10);
    pb.step({ ...still, jump: true }, STEP);
    sp.step(STEP);
    pb.sync(st);
    let top = 0;
    frames(still, 90, () => {
      st.yaw += 0.01; // (the scene turns you to the shot every frame while you fire)
      top = Math.max(top, st.y);
    });
    expect(top).toBeGreaterThan(0.6);
    expect(st.yaw).toBeGreaterThan(0.8);
    pb.knock([6, 0, 0]);
    const x0 = st.x;
    frames(still, 60, () => (st.yaw += 0.01));
    expect(st.x - x0).toBeGreaterThan(0.6);
    sp.dispose();
  });

  it('park() takes the body out of the world; the next step puts it back where the state is', async () => {
    const { sp, st, pb, frames } = await setup();
    frames(still, 5);
    pb.park();
    const other = createPlayerBody(sp, walker(0, 0, 0.5, 0));
    frames(still, 5); // (your own body no longer stands in the way of the other's)
    const o = other.c.position();
    expect(Math.hypot(o[0], o[2])).toBeLessThan(0.1);
    other.dispose();
    st.x = 12;
    st.z = 4;
    frames(still, 5);
    expect(st.x).toBeCloseTo(12, 1);
    expect(st.z).toBeCloseTo(4, 1);
    expect(pb.parked).toBe(false);
    sp.dispose();
  });
});
