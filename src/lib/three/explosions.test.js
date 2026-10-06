import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createExplosions, explosionPlan } from './explosions';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('explosions', () => {
  it('a blast swells, cools and is gone by 1.4 s', () => {
    const start = explosionPlan(0.5, null, 0);
    const full = explosionPlan(0.5, null, 0.4);
    const late = explosionPlan(0.5, null, 1.2);
    expect(start.fire.radius).toBe(0);
    expect(full.fire.radius).toBeCloseTo(2.2 * 0.5, 5);
    expect(late.fire.radius).toBeGreaterThanOrEqual(full.fire.radius);
    // white, then orange, then smoke
    expect(start.fire.colour).toEqual([1, 0.97, 0.9]);
    const mid = explosionPlan(0.5, null, 0.45).fire.colour;
    expect(mid[0]).toBeGreaterThan(mid[2] * 3);
    expect(explosionPlan(0.5, null, 1.4).fire.colour.map((v) => +v.toFixed(3))).toEqual([0.2, 0.18, 0.17]);
    expect(lum(late.fire.colour)).toBeLessThan(lum(mid));
    expect(start.fire.alpha).toBe(1);
    expect(explosionPlan(0.5, null, 1.4).fire.alpha).toBe(0);
    expect(explosionPlan(0.5, null, 2).fire.alpha).toBe(0);
  });

  it('a small blast has no ring and a fighter’s has no shards under 0.1 units', () => {
    expect(explosionPlan(0.2, null, 0)).toMatchObject({ ring: false, shards: 24 });
    expect(explosionPlan(0.05, null, 0)).toMatchObject({ ring: false, shards: 0 });
    expect(explosionPlan(0.8, null, 0)).toMatchObject({ ring: true, shards: 24 });
    // (its tint takes a third of its fire's orange)
    expect(explosionPlan(0.5, [0.3, 1, 0.3], 0.45).fire.colour[1]).toBeGreaterThan(explosionPlan(0.5, null, 0.45).fire.colour[1]);
  });

  it('pop mode bursts nothing', () => {
    const parent = new THREE.Group();
    const fx = createExplosions({ parent });
    fx.setMode('pop');
    fx.burst(new THREE.Vector3(1, 2, 3), 0.8);
    fx.update(0.1);
    expect(fx.meshes.every((m) => !m.visible)).toBe(true);
    expect(fx.active).toBe(0);
  });

  it('pools its blasts: one fireball draw each, the shards and the rings one draw each, all gone after', () => {
    const parent = new THREE.Group();
    const fx = createExplosions({ parent, pool: 3 });
    expect(fx.meshes).toHaveLength(5);
    fx.burst(new THREE.Vector3(0, 0, 0), 0.8);
    fx.burst(new THREE.Vector3(5, 0, 0), 0.2);
    fx.update(0.2);
    expect(fx.active).toBe(2);
    expect(fx.meshes.filter((m) => m.visible)).toHaveLength(4); // (two fireballs, the shards, a ring)
    const shards = fx.meshes.find((m) => m.name === 'blast-shards');
    expect(shards.count).toBe(48);
    // a fourth burst takes the oldest's place
    for (let i = 0; i < 4; i++) fx.burst(new THREE.Vector3(i, 0, 0), 0.5);
    fx.update(0.01);
    expect(fx.active).toBe(3);
    fx.update(1.5);
    expect(fx.active).toBe(0);
    expect(fx.meshes.every((m) => !m.visible)).toBe(true);
    fx.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
