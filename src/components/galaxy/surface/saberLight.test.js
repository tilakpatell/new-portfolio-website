import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SABER_LIGHT, createSaberLight } from './saberLight';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lights = (scene) => scene.children.filter((o) => o.isPointLight);

describe('a lit blade’s light', () => {
  it('is made on high and ultra, at the build, and never on low or mid', () => {
    for (const tier of ['low', 'mid']) {
      const scene = new THREE.Scene();
      const l = createSaberLight({ scene, color: '#4aa8ff', tier });
      expect(lights(scene)).toHaveLength(0);
      l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1, 3)); // (a no-op)
      l.dispose();
    }
    for (const tier of ['high', 'ultra']) {
      const scene = new THREE.Scene();
      const l = createSaberLight({ scene, color: '#4aa8ff', tier });
      expect(lights(scene)).toHaveLength(1);
      expect(lights(scene)[0].intensity).toBe(0); // (dark till lit: the count of lights never changes, nothing recompiles)
      l.dispose();
    }
  });

  it('sits at the blade’s middle in its colour, as bright as its tier and as lit as the blade', () => {
    const scene = new THREE.Scene();
    const l = createSaberLight({ scene, color: '#ff2020', tier: 'high' });
    const p = lights(scene)[0];
    l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1.5, 4));
    expect(p.position.toArray()).toEqual([0, 1.5, 0]);
    expect(p.color.getHexString()).toBe('ff2020');
    expect(p.intensity).toBeCloseTo(SABER_LIGHT.intensity.high, 6);
    l.update(V(0, 1, 0), V(0, 2, 0), 0.5, V(0, 1.5, 4));
    expect(p.intensity).toBeCloseTo(SABER_LIGHT.intensity.high * 0.5, 6);
    l.update(V(0, 1, 0), V(0, 2, 0), 0, V(0, 1.5, 4));
    expect(p.intensity).toBe(0);
    l.dispose();
  });

  it('goes dark past 12 m from the eye, and comes back', () => {
    const scene = new THREE.Scene();
    const l = createSaberLight({ scene, color: '#4aa8ff', tier: 'ultra' });
    const p = lights(scene)[0];
    l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1.5, SABER_LIGHT.within + 1));
    expect(p.intensity).toBe(0);
    l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1.5, SABER_LIGHT.within - 1));
    expect(p.intensity).toBeCloseTo(SABER_LIGHT.intensity.ultra, 6);
    l.dispose();
  });

  it('takes its light away when it goes', () => {
    const scene = new THREE.Scene();
    const l = createSaberLight({ scene, color: '#4aa8ff', tier: 'high' });
    l.dispose();
    expect(lights(scene)).toHaveLength(0);
  });
});

describe('the blades’ lights together', () => {
  it('are four at most at once (a light costs every lit pixel, near or far), and a fifth comes when one goes', () => {
    const scene = new THREE.Scene();
    const made = Array.from({ length: SABER_LIGHT.most + 1 }, () => createSaberLight({ scene, color: '#4aa8ff', tier: 'high' }));
    expect(lights(scene)).toHaveLength(SABER_LIGHT.most);
    made[0].dispose();
    const next = createSaberLight({ scene, color: '#4aa8ff', tier: 'high' });
    expect(lights(scene)).toHaveLength(SABER_LIGHT.most);
    for (const l of [...made.slice(1), next]) l.dispose();
    expect(lights(scene)).toHaveLength(0);
  });
});
