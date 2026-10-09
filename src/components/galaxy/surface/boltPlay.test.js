import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBlaster } from './blaster';
import { createBoltPlay } from './boltPlay';
import { createSolids } from './walker';
import { troops } from './sites/outerKit';

// a flat world with a wall across x = 10
const setup = () => {
  const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [] };
  world.solids.box(10, 0, 0.5, 5);
  const blaster = createBlaster({ parent: new THREE.Scene(), world });
  return { blaster, play: createBoltPlay({ blaster, rng: () => 0.5 }) };
};
const you = (x) => ({ x, y: 0, z: 0, yaw: -Math.PI / 2 });
// your raised blade, as saber.js's guard() hands it to the step: up across your front (you face -x), a hand wide
const held = (st) => ({ id: 'you', base: [st.x - 0.45, st.y + 0.4, st.z], tip: [st.x - 0.45, st.y + 1.7, st.z], r: 0.3, side: 'you' });
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
    fly(play, { you: st, targets: [second], guard: held(st) }, { hurt: (n) => hurt.push(n), deflect: (e) => turned.push(e), yours: (e) => yours.push(e) });
    expect(turned).toHaveLength(1);
    expect(yours[0].body.ref).toBe(second);
  });

  // Lane D: a turned bolt is the shooter's own, and deals what it was fired with
  it('a stormtrooper’s bolt turned by the raised blade kills the stormtrooper', () => {
    const { play } = setup();
    const spec = troops('t', 1, [2, 0]);
    const trooper = { holder: { position: new THREE.Vector3(2, 0, 0) }, fig: { tall: 1.8 }, spec, hp: spec.hp };
    const st = you(8);
    const home = [];
    const hurt = [];
    play.enemy({ from: [2.6, 1.4, 0], spread: 0, who: trooper, damage: spec.hostile.damage }, st, 7);
    fly(play, { you: st, targets: [trooper], guard: held(st) }, { hurt: (n) => hurt.push(n), home: (e) => home.push(e) });
    expect(hurt).toEqual([]);
    expect(home).toHaveLength(1);
    expect(home[0].body.ref).toBe(trooper);
    // (as the scene lands it: struck with the bolt's own damage)
    trooper.hp -= home[0].damage;
    expect(home[0].damage).toBe(spec.hostile.damage);
    expect(trooper.hp).toBeLessThanOrEqual(0);
  });

  // Rapier's bodies: a figure with hurtboxes by region is hit by the region, and says which
  it('a bolt through a rigged figure’s head reports its region', () => {
    const { blaster, play } = setup();
    const head = { a: [8, 1.6, 0], b: [8, 1.8, 0], r: 0.12 };
    const chest = { a: [8, 0.9, 0], b: [8, 1.45, 0], r: 0.2 };
    const t = { holder: { position: new THREE.Vector3(8, 0, 0) }, fig: { tall: 1.8 }, spec: {}, hp: 3, hb: { rig: { single: false, segments: new Map([['head', head], ['chest', chest]]) } } };
    const yours = [];
    blaster.fire(new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(1, 0, 0), [], '#ffffff', 90, null, { yours: true });
    fly(play, { you: you(0), targets: [t] }, { yours: (e) => yours.push(e) });
    expect(yours).toHaveLength(1);
    expect(yours[0].body.ref).toBe(t);
    expect(yours[0].body.tag).toBe('head');
    // (one at the knees finds nothing: no region there)
    blaster.fire(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(1, 0, 0), [], '#ffffff', 90, null, { yours: true });
    fly(play, { you: you(0), targets: [t] }, { yours: (e) => yours.push(e) });
    expect(yours).toHaveLength(1);
  });
});
