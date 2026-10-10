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
});

describe('a figure on the game’s skeleton', () => {
  // the game's bones run along their x: the head stands up at (5, 1.6, 0)
  const bone = (t, up = true) => ({ matrixWorld: { elements: up ? [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, ...t, 1] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...t, 1] } });
  const bones = { Hips: bone([5, 1, 0], false), Spine: bone([5, 1.1, 0]), Spine1: bone([5, 1.25, 0], false), Neck: bone([5, 1.5, 0], false), Head: bone([5, 1.6, 0]) };
  const set = { id: 'defaultsoldierbonecollision', bones: [{ bone: 'Head', length: 0.045, radius: 0.16, offset: [-0.01, 0.01, 0], axis: 0, reaction: 'HRT_Head', hiLod: true, lowLod: false }] };

  it('is hit where the game’s capsules are, and the hit names the bone', () => {
    const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [] };
    const blaster = createBlaster({ parent: new THREE.Scene(), world });
    const play = createBoltPlay({ blaster, rng: () => 0.5, boneSets: { sets: [set] } });
    const t = { holder: { position: new THREE.Vector3(5, 0, 0) }, fig: { tall: 1.8, bones }, side: 'them' };
    const got = [];
    // over the head's capsule (and through where the one big capsule would be): a miss
    blaster.shoot({ from: [0, 1.0, 0], dir: [1, 0, 0], owner: 'you', side: 'you' });
    fly(play, { you: null, targets: [t] }, { yours: (e) => got.push(e) }, 30);
    expect(got).toHaveLength(0);
    blaster.shoot({ from: [0, 1.62, 0], dir: [1, 0, 0], owner: 'you', side: 'you' });
    fly(play, { you: null, targets: [t] }, { yours: (e) => got.push(e) }, 30);
    expect(got).toHaveLength(1);
    expect(got[0].body).toMatchObject({ ref: t, region: 'Head', reaction: 'HRT_Head' });
  });

  it('takes an own rig’s set by its skeleton, the B2’s for a B2, and none from the soldier’s', () => {
    const world = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [] };
    const blaster = createBlaster({ parent: new THREE.Scene(), world });
    const b2 = { id: 'b2bonecollision', skeleton: 'Characters/Hero/B2/B2_01/B2_01_Ske', bones: [{ ...set.bones[0], reaction: 'HRT_Torso' }] };
    const play = createBoltPlay({ blaster, rng: () => 0.5, boneSets: { sets: [set, b2] } });
    const t = { holder: { position: new THREE.Vector3(5, 0, 0) }, fig: { tall: 1.8, bones, rig: 'own', skeleton: 'B2_01_Ske' }, side: 'them' };
    const got = [];
    blaster.shoot({ from: [0, 1.62, 0], dir: [1, 0, 0], owner: 'you', side: 'you' });
    fly(play, { you: null, targets: [t] }, { yours: (e) => got.push(e) }, 30);
    expect(got).toHaveLength(1);
    expect(got[0].body).toMatchObject({ ref: t, region: 'Head', reaction: 'HRT_Torso' });
  });
});
