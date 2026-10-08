// The lanes' streaks and ribbons, in Node: three's plain classes, a group
// for the scene, and no WebGL (nothing's drawn; what's laid out is checked).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLaneStreaks, tailOf } from './laneStreaks';
import { DASH, SEGMENTS, createLaneRibbons, shiftOf } from './laneRibbons';
import { LANES, TIERS } from './hyperlanes';
import { flowAt, kill, shipsOf } from './laneFlow';

const WAYS = ['out', 'in'];
const all = LANES.reduce((n, lane) => n + WAYS.reduce((k, way) => k + shipsOf(lane, way), 0), 0);
const T = 1.8e9 + 17.5;
const camera = () => {
  const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 30000);
  c.position.set(0, 4000, 12000);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
};
// a renderer's two calls the streaks ask for
const renderer = { getDrawingBufferSize: (v) => v.set(1920, 1080), getPixelRatio: () => 2 };

describe('the lanes’ streaks (laneStreaks.js)', () => {
  it('draws every flow ship in one mesh on high, half on low, a quarter on small', () => {
    for (const [level, part] of [
      ['high', 1],
      ['low', 2],
      ['small', 4],
    ]) {
      const parent = new THREE.Group();
      const streaks = createLaneStreaks(parent, { level });
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]).toBe(streaks.mesh);
      expect(streaks.count).toBe(Math.ceil(all / part));
      expect(streaks.mesh.geometry.instanceCount).toBe(streaks.count);
      expect(streaks.mesh.geometry.attributes.aAlive.count).toBe(streaks.count);
      streaks.dispose();
      expect(parent.children).toHaveLength(0);
    }
  });

  it('starts each streak where the flow has its ship, and trails it by its speed', () => {
    const lane = LANES.find((l) => l.tier === 'trunk');
    const streaks = createLaneStreaks(new THREE.Group(), { lanes: [lane] });
    streaks.update(T, camera(), null, renderer);
    const flow = streaks.mesh.geometry.attributes.aFlow;
    const ships = [...flowAt(lane, 'out', T), ...flowAt(lane, 'in', T)];
    expect(ships).toHaveLength(streaks.count);
    ships.forEach((f, k) => {
      expect(flow.getW(k)).toBeCloseTo(f.s, 5);
      expect(flow.getZ(k)).toBeCloseTo(f.speed / lane.length, 6);
    });
    expect(streaks.mesh.material.uniforms.uT.value).toBe(0);
    streaks.update(T + 10, camera());
    expect(streaks.mesh.material.uniforms.uT.value).toBe(10);
    // (and five minutes on, from a new epoch)
    streaks.update(T + 301, camera());
    expect(streaks.mesh.material.uniforms.uT.value).toBe(0);
    expect(tailOf(600)).toBe(2);
    expect(tailOf(100)).toBe(1);
    expect(tailOf(TIERS.express.speed)).toBe(8);
  });

  it('hides a ship shot down and shows it again once it’s back round', () => {
    const lane = LANES.find((l) => l.tier === 'local');
    const streaks = createLaneStreaks(new THREE.Group(), { lanes: [lane] });
    const alive = streaks.mesh.geometry.attributes.aAlive;
    const dead = new Map();
    streaks.update(T, camera(), dead);
    kill(dead, lane, 'out', 0, 0, T);
    streaks.update(T + 0.1, camera(), dead);
    expect(alive.getX(0)).toBe(0);
    expect([...alive.array].filter((a) => a === 0)).toHaveLength(1);
    // a lap and a half on, it's back
    const lap = lane.length / (0.9 * TIERS.local.speed);
    streaks.update(T + lap * 2.1, camera(), dead);
    expect(alive.getX(0)).toBe(1);
    expect(dead.size).toBe(0);
  });

  it('runs a frame with nothing dead without throwing, and takes a side', () => {
    const streaks = createLaneStreaks(new THREE.Group(), { level: 'low', side: 'starwars' });
    expect(() => streaks.update(T, camera(), new Map(), renderer)).not.toThrow();
    expect(() => streaks.setSide('rickmorty')).not.toThrow();
    expect(streaks.mesh.material.uniforms.uHalf.value.x).toBe(960);
  });
});

describe('the lanes’ ribbons (laneRibbons.js)', () => {
  it('draws every carriageway in one mesh, 48 segments each', () => {
    const parent = new THREE.Group();
    const ribbons = createLaneRibbons(parent, { level: 'small' });
    expect(parent.children).toEqual([ribbons.mesh]);
    expect(ribbons.segments).toBe(LANES.length * 2 * SEGMENTS);
    expect(ribbons.mesh.geometry.index.count).toBe(ribbons.segments * 6);
    expect(() => ribbons.update(T, camera(), renderer)).not.toThrow();
    ribbons.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('measures each segment’s two ends along its carriageway, so the dashes run on through a clipped one', () => {
    const lane = LANES.find((l) => l.tier === 'express');
    const ribbons = createLaneRibbons(new THREE.Group(), { lanes: [lane] });
    const { aInfo, aS } = ribbons.mesh.geometry.attributes;
    const quad = (q) => [0, 1, 2, 3].map((j) => q * 4 + j);
    for (let q = 0; q < ribbons.segments; q++) {
      const [a, , , d] = quad(q);
      expect(aInfo.getY(a)).toBeGreaterThan(aInfo.getX(a));
      expect(aInfo.getX(d)).toBe(aInfo.getX(a));
      if (q % SEGMENTS) expect(aInfo.getX(a)).toBeCloseTo(aInfo.getY(a - 4), 3);
    }
    expect(aS.getX(0)).toBe(0);
    expect(aS.getX(SEGMENTS * 4 - 1)).toBe(1);
    // (the floor’s about as long as the lane)
    expect(aInfo.getY(SEGMENTS * 4 - 1) / lane.length).toBeCloseTo(1, 1);
    ribbons.dispose();
  });

  it('moves the dashes at half the lane’s speed, worked out in doubles', () => {
    const v = TIERS.trunk.speed;
    expect((shiftOf(T + 0.1, v) - shiftOf(T, v) + DASH) % DASH).toBeCloseTo(v * 0.5 * 0.1, 3);
    expect(shiftOf(T, v)).toBeGreaterThanOrEqual(0);
    expect(shiftOf(T, v)).toBeLessThan(DASH);
  });
});
