// Loose crates and barrels by the stacks a site puts down where you land
// (the game-feel design's Tier 3 for the galaxy surfaces): a few beside
// each, for you to shove on foot and a speeder to scatter. They're
// lib/three/knockables's (one instanced draw a kind, light bodies asleep
// until touched, a hit hard enough told to the impacts: a thud, a puff, a
// nudge), and Rapier only loads where the computer can afford it
// (knockablesWanted: a high tier, not a phone, not Data Saver); elsewhere
// they stand, drawn, where they were put.
//
// The surface's walk and rides are its own rules, not the engine's, so you
// and your ride are kinematic capsules that follow where the rules put you:
// they shove, and nothing shoves them back. Under each stack the engine has
// a floor at the ground's height there, and the stack itself as a fixed
// drum, so a crate knocked into it stops rather than going through.
//
//   STACKED: the kinds that are a stack (site.things' crates and barrels)
//   stacksOf(things) → [{ x, z, r }]: those within GATHER metres as one
//   loosePlaces(things, ground) → [{ kind, x, y, z, yaw }]: two crates and a
//     barrel round each stack, clear of it, seeded by where it is
//   createKnocks({ parent, dev, impacts, places, ground }) → Promise<{
//     step(dt, you, ride), physical, dispose() }>: `you` { x, y, z } your
//     feet; `ride` null on foot, else what you ride (a wider capsule)

import { KINDS, createKnockables, knockablesWanted } from '../../../lib/three/knockables';

export const STACKED = new Set(['barrel', 'crates', 'bevelcrate', 'cratecube', 'empirecrate', 'hothcrate']);
const GATHER = 4; // metres: things this close are one stack
const LOOSE = ['crate', 'crate', 'barrel'];
const CLEAR = [1.2, 2.2]; // metres past the stack's edge the loose ones stand
const FLOOR = 15; // half the floor's side under a stack, in metres
const AWAY = -400; // where a pusher not in use waits, under everything

export function stacksOf(things = []) {
  const stacks = [];
  for (const t of things) {
    if (!STACKED.has(t.kind) || !Array.isArray(t.at)) continue;
    const s = stacks.find((o) => o.pts.some(([x, z]) => Math.hypot(x - t.at[0], z - t.at[1]) < GATHER));
    if (s) s.pts.push(t.at);
    else stacks.push({ pts: [t.at] });
  }
  return stacks.map(({ pts }) => {
    const x = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const z = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    // (its reach: the furthest of its things, and a crate's half more)
    return { x, z, r: Math.max(...pts.map((p) => Math.hypot(p[0] - x, p[1] - z))) + 0.7 };
  });
}

export function loosePlaces(things, ground) {
  return stacksOf(things).flatMap((s) => {
    // seeded by where the stack is: the same crates every visit
    let a = (Math.round(s.x * 73 + s.z * 151) ^ 0x9e3779b9) >>> 0;
    const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
    const turn = r() * Math.PI * 2;
    return LOOSE.map((kind, i) => {
      const t = turn + (i * Math.PI * 2) / LOOSE.length + (r() - 0.5) * 0.8;
      const d = s.r + CLEAR[0] + r() * (CLEAR[1] - CLEAR[0]);
      const x = s.x + Math.cos(t) * d;
      const z = s.z + Math.sin(t) * d;
      return { kind, x, y: ground(x, z), z, yaw: r() * Math.PI * 2 };
    });
  });
}

export async function createKnocks({ parent, dev, impacts, places, ground, things = null }) {
  let physics = null;
  if (places.length && knockablesWanted(dev)) {
    try {
      const { createPhysics } = await import('../../../lib/physics/world');
      physics = await createPhysics();
    } catch {
      physics = null; // (offline, or the engine wouldn't start: they stand)
    }
  }
  // (only the crate and the barrel: a pool a kind is a draw a kind)
  const loose = createKnockables({ physics, kinds: { crate: KINDS.crate, barrel: KINDS.barrel }, impacts, parent, count: Math.max(8, places.length) });
  let foot = null;
  let rider = null;
  if (physics) {
    // a floor under each stack's loose ones, at the ground's height there,
    // and the stack as a fixed drum
    const stacks = things ? stacksOf(things) : [];
    const seen = stacks.length ? stacks : places.map((p) => ({ x: p.x, z: p.z, r: 0 }));
    for (const s of seen) {
      const y = ground(s.x, s.z);
      physics.add({ type: 'fixed', position: [s.x, y - 0.5, s.z], group: 'floor', colliders: [{ shape: 'cuboid', args: [FLOOR, 0.5, FLOOR] }] });
      if (s.r > 0) physics.add({ type: 'fixed', position: [s.x, y + 0.6, s.z], colliders: [{ shape: 'cylinder', args: [0.6, s.r] }] });
    }
    const { addPusher } = await import('../../../lib/physics/pusher');
    foot = addPusher(physics, { radius: 0.38, half: 0.55, position: [0, AWAY, 0], teleport: 6 });
    rider = addPusher(physics, { radius: 0.9, half: 0.4, position: [0, AWAY - 10, 0], teleport: 6 });
  }
  loose.add(places);
  // (one step first: the world sees what's been added before it's asked anything)
  physics?.step(1 / 60);
  return {
    physical: loose.physical,
    step(dt, you, ride) {
      if (!physics || !you) return;
      // the one in use where you are (its middle: the capsule's centre over your feet), the other out of the way
      const on = ride ? rider : foot;
      const off = ride ? foot : rider;
      on.follow([you.x, you.y + (ride ? 0.9 : 0.93), you.z], dt);
      off.follow([0, ride ? AWAY : AWAY - 10, 0], dt);
      physics.step(dt);
      loose.sync();
    },
    dispose() {
      loose.dispose();
      physics?.dispose();
    },
  };
}
