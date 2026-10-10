import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENGINES, ENGINE_CAP, HERO_ENGINES, MAX_STRETCH, burn, capPlume, createEngines, enginePeak, enginesFor, glowSize, guessEngines, plumeLength } from './engines';
import { LENGTH } from './scale';
import { createTrail } from './trail';
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
    // and burns brighter: dim at idle (a parked ship's isn't a beacon), more boosting
    expect(burn(0, 0)).toBeCloseTo(0.35);
    expect(burn(1, 0)).toBeCloseTo(1);
    expect(burn(1, 1)).toBeCloseTo(1.5);
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

describe('the engines under the ship', () => {
  it('a plume is never longer than 0.6 of the ship, and the boost adds length', () => {
    expect(ENGINE_CAP).toEqual({ length: 0.6, luminance: 0.8 });
    expect(plumeLength(1, 1, LENGTH)).toBeLessThanOrEqual(0.6 * LENGTH + 1e-9);
    expect(plumeLength(1, 0, LENGTH)).toBeLessThan(plumeLength(1, 1, LENGTH));
    expect(plumeLength(0, 0, LENGTH)).toBe(0);
  });

  it('a hero plume’s look is capped, and a plume longer than the cap at full boost is cut to it', () => {
    const look = capPlume({ color: '#5cbcff', core: '#eef8ff', width: 0.034, life: 0.45, length: 0.36 });
    expect(look.length * MAX_STRETCH).toBeCloseTo(0.6 * LENGTH, 9);
    expect(look.cap).toEqual({ length: 0.6 * LENGTH, peak: 0.8 });
    // (a short one stays as it was)
    expect(capPlume({ length: 0.01 }).length).toBe(0.01);
  });

  it('the trail holds the cap: no longer than it at any stretch, and no brighter boosting', () => {
    const look = capPlume({ width: 0.034, life: 0.45, length: 0.36 });
    const trail = createTrail(look);
    trail.setColors('#5cbcff', '#eef8ff');
    const nozzle = new THREE.Vector3();
    const camera = new THREE.Vector3(0, 0.6, 2.4);
    const peakOf = () => {
      const u = trail.mesh.children[0].material.uniforms;
      const c = u.uColor.value.clone().add(u.uCore.value);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    let t = 0;
    const run = (stretch) => {
      for (let i = 0; i < 60; i++) {
        t += 1 / 60;
        nozzle.z -= 2 / 60;
        camera.z -= 2 / 60;
        trail.update(1 / 60, t, nozzle, 1, camera, stretch);
      }
    };
    run(1);
    const cruise = peakOf();
    run(3);
    const pos = trail.mesh.children[0].geometry.attributes.position.array;
    let far = 0;
    for (let i = 0; i < pos.length / 6; i++) far = Math.max(far, Math.abs((pos[i * 6 + 2] + pos[i * 6 + 5]) / 2 - nozzle.z));
    expect(far).toBeLessThanOrEqual(0.6 * LENGTH + 1e-6);
    expect(peakOf()).toBeLessThanOrEqual(0.8 + 1e-6);
    expect(peakOf()).toBeLessThanOrEqual(cruise + 1e-6);
    trail.dispose();
  });

  it('an engine’s glow at its hottest is no brighter than 0.8, whatever its colour or boost', () => {
    const scene = new THREE.Scene();
    const engines = createEngines({ parent: scene });
    const ship = new THREE.Group();
    scene.add(ship);
    const h = engines.add('falcon', ship, { list: [{ at: [0, 0, 0], r: 0.035, colour: '#ffffff' }] });
    engines.set(h, { throttle: 1, boost: 1 });
    engines.update(0, new THREE.PerspectiveCamera());
    const c = new THREE.Color();
    engines.mesh.getColorAt(0, c);
    expect(enginePeak([c.r, c.g, c.b])).toBeLessThanOrEqual(0.8 + 1e-6);
    // (idle, dimmer than that: the throttle still shows)
    engines.set(h, { throttle: 0, boost: 0 });
    engines.update(0, new THREE.PerspectiveCamera());
    const idle = new THREE.Color();
    engines.mesh.getColorAt(0, idle);
    expect(enginePeak([idle.r, idle.g, idle.b])).toBeLessThan(enginePeak([c.r, c.g, c.b]));
    engines.dispose();
  });
});
