import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENGINES, HERO_ENGINES, createEngines, enginesFor, glowSize, guessEngines } from './engines';
import { TYPES } from './traffic';

describe('the ships’ engines', () => {
  it('every ship kind has engines, guessed from its stern where none are listed', () => {
    const box = { x: 0.6, y: 0.4, z: 1 };
    for (const kind of Object.keys(TYPES)) {
      const list = enginesFor(kind, box);
      // (a balloon, a Meeseeks and Birdperson have none, by name)
      if (ENGINES[kind]?.length === 0) continue;
      expect(list.length, kind).toBeGreaterThan(0);
      for (const e of list) {
        expect(e.r, kind).toBeGreaterThan(0);
        expect(Math.abs(e.at[0]), kind).toBeLessThanOrEqual(box.x / 2);
        expect(e.at[2], `${kind} at its stern`).toBeLessThan(0);
      }
    }
    expect(guessEngines(box)).toEqual([{ at: [0, 0, -0.5], r: 0.18 * 0.4, colour: expect.any(String) }]);
    expect(enginesFor('gearship', box)).toEqual(guessEngines(box));
    for (const kind of ['falcon', 'xwing', 'rv', 'cruiser']) expect(HERO_ENGINES[kind].length, kind).toBeGreaterThan(0);
  });

  it('the glow grows with the throttle and the boost, never under its floor', () => {
    expect(glowSize(0, 0, 0.004, 0.05)).toBeCloseTo(Math.max(0.004, 0.6 * 0.05));
    expect(glowSize(0, 0, 0.004, 0.001)).toBe(0.004);
    expect(glowSize(1, 1)).toBeCloseTo(2.7);
    expect(glowSize(1, 1, 0.004, 0.05)).toBeCloseTo(2.7 * 0.05);
    expect(glowSize(0.5, 0, 0.004, 1)).toBeGreaterThan(glowSize(0, 0, 0.004, 1));
  });

  it('is one draw for every ship, placed where each one’s engines are', () => {
    const scene = new THREE.Scene();
    const engines = createEngines({ parent: scene });
    const a = new THREE.Group();
    a.position.set(10, 0, 0);
    const b = new THREE.Group();
    b.scale.setScalar(2);
    scene.add(a, b);
    const ha = engines.add('falcon', a, { list: HERO_ENGINES.falcon });
    engines.add('gearship', b, { size: { x: 1, y: 1, z: 1 } });
    engines.update(0, new THREE.PerspectiveCamera());
    expect(scene.children.filter((o) => o.isInstancedMesh)).toHaveLength(1);
    expect(engines.count).toBe(HERO_ENGINES.falcon.length + 1);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    engines.mesh.getMatrixAt(HERO_ENGINES.falcon.length, m);
    p.setFromMatrixPosition(m);
    expect(p.toArray()).toEqual([0, 0, -1]); // (the stern of a box 1 long, scaled 2)
    // the throttle and the boost make the glow bigger; gone, it's not drawn
    engines.mesh.getMatrixAt(0, m);
    const idle = new THREE.Vector3().setFromMatrixScale(m).x;
    engines.set(ha, { throttle: 1, boost: 1 });
    engines.update(0, new THREE.PerspectiveCamera());
    engines.mesh.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeGreaterThan(idle);
    engines.remove(ha);
    a.visible = false;
    engines.update(0, new THREE.PerspectiveCamera());
    expect(engines.count).toBe(1);
    engines.dispose();
    expect(scene.children.some((o) => o.isInstancedMesh)).toBe(false);
  });
});
