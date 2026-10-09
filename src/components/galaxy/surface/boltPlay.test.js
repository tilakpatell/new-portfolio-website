import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBlaster } from './blaster';
import { createBoltPlay } from './boltPlay';
import { createSolids } from './walker';

// a flat world with a wall across x = 10
const setup = () => {
  const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [] };
  world.solids.box(10, 0, 0.5, 5);
  const blaster = createBlaster({ parent: new THREE.Scene(), world });
  return { blaster, play: createBoltPlay({ blaster, rng: () => 0.5 }) };
};
const you = (x) => ({ x, y: 0, z: 0, yaw: -Math.PI / 2 });
const fly = (play, ctx, on, frames = 120) => {
  for (let i = 0; i < frames; i++) play.step(1 / 60, ctx, on);
};

describe('the surface’s bolts', () => {
  it('no shot of theirs through a wall, however sure they are where you went', () => {
    const { play } = setup();
    expect(play.enemy({ from: [14, 1.4, 0], spread: 0, who: {} }, you(5))).toBeNull();
    expect(play.enemy({ from: [8, 1.4, 0], spread: 0, who: {} }, you(5))).not.toBeNull();
  });

  it('their first shot at you goes wide on purpose; a battle’s shot does not', () => {
    const { blaster, play } = setup();
    const who = {};
    const first = play.enemy({ from: [0, 1.4, 0], spread: 0.04, who }, you(8), 0);
    const next = play.enemy({ from: [0, 1.4, 0], spread: 0.04, who }, you(8), 0.5);
    const battle = play.enemy({ from: [0, 1.4, 0], spread: 0.04 }, you(8), 0.5);
    // (how far off the straight line to your chest)
    const l = Math.hypot(8, 1.1 - 1.4);
    const off = (b) => Math.acos(b.dir[0] * (8 / l) + b.dir[1] * ((1.1 - 1.4) / l));
    expect(off(first)).toBeGreaterThan(off(next) * 2);
    expect(off(battle)).toBeCloseTo(off(next));
    expect(blaster.bolts.live()).toHaveLength(3);
  });

  it('theirs that reaches you hurts you; through your raised blade it is turned home', () => {
    const { play } = setup();
    const hurt = [];
    const turned = [];
    const yours = [];
    const shooter = { holder: { position: new THREE.Vector3(2, 0, 0) }, fig: { tall: 1.8 } };
    play.enemy({ from: [2.6, 1.4, 0], spread: 0, who: shooter }, you(8), 7); // (not its first: no telegraph)
    play.enemy({ from: [2.6, 1.4, 0], spread: 0, who: shooter }, you(8), 7.1);
    fly(play, { you: you(8), targets: [shooter] }, { hurt: (n) => hurt.push(n), deflect: (e) => turned.push(e), yours: (e) => yours.push(e) });
    expect(hurt.length).toBeGreaterThan(0);
    // (another, so the streak's wide shot doesn't come into it)
    const second = { holder: { position: new THREE.Vector3(2, 0, 0) }, fig: { tall: 1.8 } };
    play.enemy({ from: [2.6, 1.4, 0], spread: 0, who: second }, you(8), 7.2);
    const st = you(8);
    fly(play, { you: st, targets: [second], guard: play.guardOf(st, true) }, { hurt: (n) => hurt.push(n), deflect: (e) => turned.push(e), yours: (e) => yours.push(e) });
    expect(turned).toHaveLength(1);
    expect(yours[0].body.ref).toBe(second);
  });
});
