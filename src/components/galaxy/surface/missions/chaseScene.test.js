import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildFigure } from '../figures';
import { RIDES } from '../rides';
import { createSolids } from '../walker';
import { SIT, createChaseMission, createRider, riderOf, throwStep } from './chaseScene';

const V = THREE.Vector3;
const SEAT = RIDES.speederbike.seat;
// a scout on a bike that stands at the origin facing +z
const mount = () => {
  const holder = new THREE.Group();
  const fig = buildFigure('scouttrooper');
  const rider = createRider(fig, SEAT);
  holder.add(rider.pivot);
  return { holder, fig, rider };
};
const worldDir = (o, local) => local.clone().applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));

describe('a scout’s joints (riderOf)', () => {
  it('finds a built person’s hips, knees, shoulders, elbows and head, left from right', () => {
    const r = riderOf(buildFigure('scouttrooper'));
    expect(r).toBeTruthy();
    expect(r.hips).toHaveLength(2);
    expect(r.knees).toHaveLength(2);
    expect(r.shoulders).toHaveLength(2);
    expect(r.elbows).toHaveLength(2);
    expect(r.head).toBeTruthy();
    // (its left, +x, first)
    expect(r.hips[0].position.x).toBeGreaterThan(0);
    expect(r.shoulders[1].position.x).toBeLessThan(0);
    expect(r.hipY).toBeGreaterThan(0.8);
  });

  it('is null for anything else, and a rider made of it does nothing but stand where it did', () => {
    expect(riderOf(null)).toBeNull();
    expect(riderOf({ model: new THREE.Group() })).toBeNull();
    const fig = buildFigure('bantha');
    expect(riderOf(fig)).toBeNull();
    const rider = createRider(fig, SEAT);
    expect(() => rider.pose(0.016, { bank: 0.3, swerve: 2, at: new V(0, 0, -10), dt: 0.016 })).not.toThrow();
    expect(() => rider.hit()).not.toThrow();
  });
});

describe('a scout sat on its bike (createRider)', () => {
  it('sits: its hips on the seat, its thighs along the bike, its shins down to the pegs, its hands forward on the bars', () => {
    const { holder, rider, fig } = mount();
    rider.pose(0.016, {});
    holder.updateMatrixWorld(true);
    const r = riderOf(fig);
    const hip = r.hips[0].getWorldPosition(new V());
    expect(hip.y).toBeGreaterThan(SEAT[1]);
    expect(hip.y).toBeLessThan(SEAT[1] + 0.35);
    // thighs forward, near level; shins down
    const thigh = worldDir(r.hips[0], new V(0, -1, 0));
    expect(thigh.z).toBeGreaterThan(0.8);
    const shin = worldDir(r.knees[0], new V(0, -1, 0));
    expect(shin.y).toBeLessThan(-0.8);
    // forearms reaching forward
    const fore = worldDir(r.elbows[1], new V(0, -1, 0));
    expect(fore.z).toBeGreaterThan(0.7);
    expect(SIT.lean).toBeGreaterThan(0);
  });

  it('leans into a bank further than its bike does, its head into the swerve', () => {
    const { rider, fig } = mount();
    rider.pose(0.5, { bank: 0.4, swerve: -5 });
    expect(rider.pivot.rotation.z).toBeGreaterThan(0.1);
    const head = riderOf(fig).head;
    const left = head.rotation.y;
    rider.pose(0.5, { bank: -0.4, swerve: 5 });
    expect(rider.pivot.rotation.z).toBeLessThan(-0.1);
    expect(head.rotation.y).toBeLessThan(left);
  });

  it('turns to fire over its shoulder: its body round, its head and its arm on you behind it, then back to the bars', () => {
    const { holder, rider, fig } = mount();
    const you = new V(6, 1.5, -20); // behind it and to its left (+x)
    for (let i = 0; i < 30; i++) rider.pose(1 / 30, { at: you });
    holder.updateMatrixWorld(true);
    const r = riderOf(fig);
    expect(rider.pivot.rotation.y).toBeGreaterThan(0.3);
    // the left arm, pointing at you
    const sh = r.shoulders[0].getWorldPosition(new V());
    const arm = worldDir(r.shoulders[0], new V(0, -1, 0));
    expect(arm.dot(you.clone().sub(sh).normalize())).toBeGreaterThan(0.9);
    // and its head well round
    expect(r.head.rotation.y).toBeGreaterThan(0.6);
    // the shot over, back to riding
    for (let i = 0; i < 60; i++) rider.pose(1 / 30, {});
    expect(Math.abs(rider.pivot.rotation.y)).toBeLessThan(0.05);
    holder.updateMatrixWorld(true);
    expect(worldDir(r.elbows[0], new V(0, -1, 0)).z).toBeGreaterThan(0.7);
  });

  it('is thrown off when its bike goes down: up and over, onto the ground, sliding to a stop, lying there; and back on for the next run', () => {
    const { holder, rider } = mount();
    const scene = new THREE.Group();
    scene.add(holder);
    holder.position.set(10, 1, 20);
    rider.thrown(scene, { speed: 20, yaw: 0, how: 'shot' });
    expect(rider.pivot.parent).toBe(scene);
    let top = rider.pivot.position.y;
    for (let i = 0; i < 30 * 4; i++) {
      rider.fly(1 / 30, 0);
      top = Math.max(top, rider.pivot.position.y);
    }
    expect(top).toBeGreaterThan(1.8);
    expect(rider.pivot.position.y).toBeLessThan(0.4);
    expect(rider.pivot.position.z).toBeGreaterThan(25);
    const at = rider.pivot.position.clone();
    rider.fly(1, 0);
    expect(rider.pivot.position.distanceTo(at)).toBeLessThan(0.01);
    rider.reset(holder);
    expect(rider.pivot.parent).toBe(holder);
    expect(rider.pivot.position.y).toBeCloseTo(SEAT[1] + SIT.up);
  });
});

describe('a body thrown (throwStep)', () => {
  it('rises, comes down, slides to a stop and lies flat', () => {
    const th = { x: 0, y: 1, z: 0, vx: 0, vy: 4, vz: 12, pitch: 0, spin: 6, t: 0, landed: false };
    let up = 0;
    for (let i = 0; i < 30 * 5; i++) {
      throwStep(th, 1 / 30, 0);
      up = Math.max(up, th.y);
    }
    expect(up).toBeGreaterThan(1.5);
    expect(th.landed).toBe(true);
    expect(Math.hypot(th.vx, th.vz)).toBe(0);
    const off = Math.abs(((th.pitch - Math.PI / 2) % Math.PI + Math.PI) % Math.PI);
    expect(Math.min(off, Math.PI - off)).toBeLessThan(0.05);
  });
});

describe('a chase, drawn (createChaseMission)', () => {
  const was = globalThis.document;
  beforeAll(() => {
    const ctx = new Proxy({}, { get: () => () => {} });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  });
  afterAll(() => {
    globalThis.document = was;
  });
  const M = { id: 'chase', kind: 'chase', ride: 'speederbike', waypoints: [[0, 0], [0, 900]], scouts: 2, gaps: [30, 40], lanes: [-1, 1], speeds: [20, 20], hp: 2, stars: [20, 35], lines: {} };

  it('its scouts sit their bikes, come round to fire as they shoot, are thrown off when they’re shot down, and are back on for another run', () => {
    const parent = new THREE.Group();
    const bolts = [];
    const m = createChaseMission({
      parent,
      world: { heightAt: () => 0, solids: createSolids() },
      placer: { put: () => Promise.resolve(null) },
      blaster: { enemy: (from) => bolts.push(from), fire: (from, d, live) => ({ target: live[0] ?? null }) },
      mission: M,
      emit() {},
      say() {},
      sounds: {},
    });
    m.begin();
    const riders = parent.getObjectsByProperty('name', 'rider');
    expect(riders).toHaveLength(2);
    const holders = riders.map((r) => r.parent);
    let turned = 0;
    for (let i = 0; i < 30 * 9; i++) {
      const b = m.behind(15) ?? { x: 0, z: 0 };
      m.update(1 / 30, { x: b.x, y: 1, z: b.z, vx: 0, vz: 20 });
      for (const r of riders) if (Math.abs(r.rotation.y) > 0.3) turned++;
    }
    expect(bolts.length).toBeGreaterThan(0);
    for (const f of bolts) expect(f.every(Number.isFinite)).toBe(true);
    expect(turned).toBeGreaterThan(0);
    // shot down: thrown out of its seat into the chase, lying a while, then gone
    const chaseGroup = parent.children[0];
    for (let k = 0; k < M.hp; k++) m.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, 1), '#f00');
    const off = riders.filter((r) => r.parent === chaseGroup);
    expect(off).toHaveLength(1);
    for (let i = 0; i < 30 * 6; i++) m.update(1 / 30, null);
    expect(off[0].visible).toBe(false);
    // and on again
    m.restart();
    riders.forEach((r, i) => {
      expect(r.parent).toBe(holders[i]);
      expect(r.visible).toBe(true);
    });
  });
});
