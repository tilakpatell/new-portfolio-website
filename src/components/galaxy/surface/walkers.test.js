import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WALKERS, footAt, gaitStep, legAngles, packUrl, partOf, splitParts, walkerWay } from './walkers';
import { SURFACE_MODELS } from './catalog';
import { RIGS } from '../../../lib/three/rigSets';

const spec = WALKERS.atrt;
const leg = spec.legs[0];

// where a leg's ankle ends up for angles about its axis (the leg's own chain, in [y, z])
function ankleFor(l, a) {
  const rot = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)];
  const thigh = rot([l.knee[0] - l.hip[0], l.knee[1] - l.hip[1]], a.hip);
  const shin = rot([l.ankle[0] - l.knee[0], l.ankle[1] - l.knee[1]], a.hip + a.knee);
  return [l.hip[0] + thigh[0] + shin[0], l.hip[1] + thigh[1] + shin[1]];
}

describe('walkers', () => {
  it('stands its legs as they were made, at rest', () => {
    const a = legAngles(leg, leg.ankle);
    expect(Math.abs(a.hip)).toBeLessThan(1e-6);
    expect(Math.abs(a.knee)).toBeLessThan(1e-6);
  });

  it('puts the ankle where it’s asked, the knee bent the model’s way, the foot kept flat', () => {
    for (const [dy, dz] of [
      [0.2, 0.3],
      [0, -0.3],
      [0.1, 0.31],
      [0, 0.31],
    ]) {
      const target = [leg.ankle[0] + dy, leg.ankle[1] + dz];
      const a = legAngles(leg, target);
      const got = ankleFor(leg, a);
      expect(got[0]).toBeCloseTo(target[0], 4);
      expect(got[1]).toBeCloseTo(target[1], 4);
      expect(a.hip + a.knee + a.ankle).toBeCloseTo(0, 9);
      // (the AT-RT's knee stays behind its hip, as a chicken walker's does)
      const knee = leg.hip[1] + Math.sin(Math.atan2(leg.knee[1] - leg.hip[1], leg.knee[0] - leg.hip[0]) + a.hip) * Math.hypot(leg.knee[0] - leg.hip[0], leg.knee[1] - leg.hip[1]);
      expect(knee).toBeLessThan(leg.hip[1]);
    }
  });

  it('keeps a foot that’s down where it was put while the body goes over it', () => {
    const speed = 1.6;
    const dt = 1 / 60;
    const g = { phase: 0.05, amount: 1 };
    // (leg 0 is down from phase 0 to the stance's end)
    let walked = 0;
    const start = footAt(g, 0, spec);
    for (let i = 0; i < 10; i++) {
      gaitStep(g, dt, speed, spec);
      walked += speed * dt;
    }
    const now = footAt(g, 0, spec);
    expect(now[0]).toBeCloseTo(0, 6); // (still down)
    // the foot went back under the body exactly as far as the body went on
    expect(start[1] - now[1]).toBeCloseTo(walked, 6);
  });

  it('lifts each foot in turn, half a cycle apart, and brings them home standing', () => {
    const g = { phase: 0, amount: 1 };
    let up = [0, 0];
    for (let i = 0; i < 200; i++) {
      gaitStep(g, 1 / 60, 1.6, spec);
      const l = footAt(g, 0, spec)[0];
      const r = footAt(g, 1, spec)[0];
      expect(l > 1e-6 && r > 1e-6).toBe(false); // (never both off the ground)
      up = [Math.max(up[0], l), Math.max(up[1], r)];
    }
    expect(up[0]).toBeCloseTo(spec.lift, 1);
    expect(up[1]).toBeCloseTo(spec.lift, 1);
    for (let i = 0; i < 300; i++) gaitStep(g, 1 / 60, 0, spec);
    expect(Math.hypot(...footAt(g, 0, spec))).toBeLessThan(0.01);
  });

  it('cuts the model into its body and each leg’s parts by where they are', () => {
    expect(partOf([0, 2.3, -0.4], spec)).toBe('body'); // the cockpit
    expect(partOf([0, 1.5, 0.8], spec)).toBe('body'); // the gun
    expect(partOf([0.33, 0.1, -0.5], spec)).toBe('foot0');
    expect(partOf([-0.33, 0.1, -0.5], spec)).toBe('foot1');
    expect(partOf([0.33, 1.2, -0.95], spec)).toBe('thigh0'); // down the long upper leg
    expect(partOf([-0.33, 0.45, -0.95], spec)).toBe('shin1');
  });

  it('hangs the parts on their joints without moving any of them', () => {
    // a mesh with a triangle in each part, at rest: every vertex where it was
    const pts = [
      [0, 2.3, -0.4],
      [0.33, 1.2, -0.95],
      [0.33, 0.45, -0.9],
      [0.33, 0.1, -0.5],
      [-0.33, 1.2, -0.95],
    ];
    const arr = [];
    for (const p of pts) arr.push(p[0], p[1], p[2], p[0] + 0.01, p[1], p[2], p[0], p[1] + 0.01, p[2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const root = new THREE.Group();
    root.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial()));
    const { body, pieces } = splitParts(root, spec);
    expect(pieces.length).toBe(5);
    body.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const got = pieces.map((m) => v.fromBufferAttribute(m.geometry.attributes.position, 0).applyMatrix4(m.matrixWorld).toArray().map((n) => +n.toFixed(4)));
    for (const p of pts) expect(got).toContainEqual(p);
  });

  it('walks a kind on the game’s rig where its model is the game’s, cut at its joints where it isn’t', () => {
    expect(walkerWay({ own: 'atat' }, { rig: true })).toBe('own');
    expect(walkerWay({ own: 'atat' }, {})).toBeNull();
    expect(walkerWay(WALKERS.atrt, {})).toBe('cut');
    expect(walkerWay(WALKERS.atrt, { rig: true })).toBe('own');
    expect(walkerWay(undefined, { rig: true })).toBeNull();
    expect(walkerWay({ own: 'atm6' }, { rig: true })).toBeNull();
  });

  it('has every walker the game rigged on its rig, with its pack beside the site', () => {
    for (const kind of ['atat', 'atst', 'atte', 'atrt', 'droideka']) {
      expect(walkerWay(WALKERS[kind], SURFACE_MODELS[kind]), kind).toBe('own');
      expect(RIGS[WALKERS[kind].own], kind).toBeTruthy();
      expect(packUrl(WALKERS[kind].own)).toBe(`/models/galaxy/bf2017/clips-${kind}.glb`);
    }
  });
});
