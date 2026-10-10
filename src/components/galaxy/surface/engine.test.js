import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { groundFor, lightFor, postFor } from './engine';

// a scene lit as scene.js lights a surface today: the sun, a second sun,
// the sky light
function lit() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight('#fff4dc', 3);
  const second = new THREE.DirectionalLight('#ffd2a0', 1);
  const hemi = new THREE.HemisphereLight('#bcd0ee', '#8a7a66', 0.9);
  scene.add(sun, second, hemi);
  return { scene, sun, second, hemi };
}
const lights = (scene) => {
  const out = [];
  scene.traverse((o) => o.isLight && out.push([o.type, o.intensity]));
  return out;
};

describe('the surface on the galaxy’s engine', () => {
  it('a site without gameLight and level keeps today’s light and ground, whatever lanes are in', () => {
    const w = lit();
    const before = lights(w.scene);
    const applyGameLight = () => {
      throw new Error('not asked for');
    };
    expect(lightFor({ id: 'hoth' }, { ...w, applyGameLight })).toEqual({ kind: 'site' });
    expect(lights(w.scene)).toEqual(before);
    expect(groundFor({ id: 'hoth' }, { createLevelCollision: applyGameLight, createPlayerBody: applyGameLight })).toBe(null);
  });

  it('a site with both, before lane R and the physics lanes land, keeps today’s too', () => {
    const w = lit();
    const before = lights(w.scene);
    const site = { gameLight: 'hoth-echo-base', level: 'hoth' };
    expect(lightFor(site, w)).toEqual({ kind: 'site' });
    expect(lights(w.scene)).toEqual(before);
    expect(groundFor(site, {})).toBe(null);
  });

  it('a site with both takes lane R’s light, P0’s collision and P1’s body once they’re handed in', () => {
    const w = lit();
    const site = { gameLight: 'hoth-echo-base', level: 'hoth' };
    const asked = [];
    const applyGameLight = (o) => {
      asked.push(o.entry);
      o.scene.remove(o.lights.hemi);
      o.lights.sun.intensity = 5;
      return { passes: ['render', 'output'] };
    };
    expect(lightFor(site, { ...w, applyGameLight })).toEqual({ kind: 'game', passes: ['render', 'output'] });
    expect(asked).toEqual(['hoth-echo-base']);
    expect(lights(w.scene)).toEqual([['DirectionalLight', 5], ['DirectionalLight', 1]]);
  });

  it('the level’s ground: P0’s collision, and P1’s body only on a physics world', async () => {
    const site = { level: 'hoth' };
    const body = { step() {} };
    const createPlayerBody = ({ physics }) => (physics === 'rapier' ? body : null);
    const onPhysics = await groundFor(site, { physics: 'rapier', createLevelCollision: async ({ physics }) => ({ solids: [], physics }), createPlayerBody });
    expect(onPhysics.body).toBe(body);
    const solidsOnly = await groundFor(site, { createLevelCollision: async () => ({ solids: [{ type: 'circle' }], physics: null }), createPlayerBody });
    expect(solidsOnly).toEqual({ collision: { solids: [{ type: 'circle' }], physics: null }, body: null });
  });

  it('draws through the post its backend can run', () => {
    const glsl = () => 'glsl post';
    const nodes = () => 'node post';
    expect(postFor({ shading: 'glsl', glsl, nodes })).toBe('glsl post');
    expect(postFor({ shading: 'nodes', glsl, nodes })).toBe('node post');
  });
});
