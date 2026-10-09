// What the body costs: a surface's worth of figures on the character
// controller with their hurtboxes, the queries a frame of brains asks, and
// the world stepped, timed in Node against the real engine (this machine's
// CPU: a number to compare against the design's table, not a browser's
// frame). Run on its own: npx vitest run --config vitest.ai.config.js src/lib/physics/cost.scenario.test.js
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { createCharacter } from './character';
import { createHurtboxes } from './hurtbox';
import { createQueries } from './queries';
import { createBudget } from './budget';
import { addHeightfield } from './heightfield';
import { filterOf } from './groups';

const FIGURES = 20;
const PROPS = 40;
const FRAMES = 600;
const STEP = 1 / 60;
const SIGHT = filterOf('floor', 'object');

async function world() {
  const p = await createPhysics({ gravity: -15.5 });
  // 2 × 2 tiles of rolling ground, 40 fixed crates and walls, 40 loose props
  for (let tz = 0; tz < 2; tz++)
    for (let tx = 0; tx < 2; tx++) {
      const n = 33;
      const heights = new Float32Array(n * n);
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) heights[iz * n + ix] = Math.sin((tx * 64 + ix * 2) * 0.05) * Math.cos((tz * 64 + iz * 2) * 0.05) * 1.5;
      addHeightfield(p, { heights, n, size: 64, x: -64 + tx * 64, z: -64 + tz * 64 });
    }
  for (let i = 0; i < PROPS; i++) p.add({ type: 'fixed', position: [(i % 8) * 12 - 40, 1, Math.floor(i / 8) * 14 - 30], group: 'object', colliders: [{ shape: 'cuboid', args: [1, 1, 0.3] }] });
  for (let i = 0; i < PROPS; i++) p.add({ position: [(i % 8) * 12 - 34, 2.5, Math.floor(i / 8) * 14 - 24], mass: 10, colliders: [{ shape: 'cuboid', args: [0.4, 0.4, 0.4] }] });
  return p;
}

describe('the cost of the body', () => {
  it(`${FIGURES} figures with hurtboxes, the brains' queries at budget, ${FRAMES} frames`, async () => {
    const p = await world();
    const q = createQueries(p, { budget: createBudget({ rays: 24, sweeps: 8, overlaps: 4 }) });
    const figures = [];
    for (let i = 0; i < FIGURES; i++) {
      const c = createCharacter(p, { position: [(i % 5) * 6 - 12, 3, Math.floor(i / 5) * 6 - 9] });
      const h = createHurtboxes(p, c);
      figures.push({ c, h, intent: { vel: { x: Math.sin(i), z: Math.cos(i) }, face: i } });
    }
    p.step(STEP);
    let moves = 0;
    const off = p.onSubstep((dt) => {
      const t0 = performance.now();
      for (const f of figures) f.c.move(f.intent, dt);
      moves += performance.now() - t0;
    });
    const pose = [0, 0, 0];
    let stepMs = 0;
    let queryMs = 0;
    let hurtMs = 0;
    for (let frame = 0; frame < FRAMES; frame++) {
      // the hurtboxes set from "bones" (a standing pose moved with the body)
      let t0 = performance.now();
      for (const f of figures) {
        f.c.position(pose);
        for (const r of f.h.regions) f.h.set(r, [pose[0], pose[1] - 0.3, pose[2]], [pose[0], pose[1] + 0.3, pose[2]]);
      }
      hurtMs += performance.now() - t0;
      // the brains: a sight ray each, three whiskers for the few due, a ledge probe
      t0 = performance.now();
      q.frame();
      for (let i = 0; i < figures.length; i++) {
        figures[i].c.position(pose);
        q.ray([pose[0], pose[1] + 0.6, pose[2]], [Math.sin(i), 0, Math.cos(i)], 30, { groups: SIGHT, exclude: figures[i].c.body });
        if (i % 5 === frame % 5) {
          for (const a of [-0.6, 0, 0.6]) q.sweep({ shape: 'capsule', args: [0.5, 0.38] }, pose, [pose[0] + Math.sin(i + a) * 2, pose[1], pose[2] + Math.cos(i + a) * 2], { groups: SIGHT, exclude: figures[i].c.body });
          q.floorAt(pose[0] + Math.sin(i), pose[2] + Math.cos(i));
        }
      }
      queryMs += performance.now() - t0;
      t0 = performance.now();
      p.step(STEP);
      stepMs += performance.now() - t0;
    }
    off();
    const per = (ms) => +(ms / FRAMES).toFixed(3);
    const stats = q.stats();
    const report = { figures: FIGURES, frames: FRAMES, msPerFrame: { step: per(stepMs), ofWhichMoves: per(moves), queries: per(queryMs), hurtboxes: per(hurtMs), all: per(stepMs + queryMs + hurtMs) }, queriesLastFrame: { rays: stats.rays, sweeps: stats.sweeps, overlaps: stats.overlaps }, bodies: p.world.bodies.len(), colliders: p.world.colliders.len(), regionsAFigure: figures[0].h.regions.length };
    process.stderr.write(`COST ${JSON.stringify(report)}\n`);
    expect(report.msPerFrame.all).toBeLessThan(8); // (the design's table: 2.9 ms on the mid tier; eight is a broken build)
    p.dispose();
  });
});
