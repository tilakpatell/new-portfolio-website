import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { modelFigureOf } from './actors';

// a statue 1.8 m tall (a trooper as the Battlefront import has them: no
// skeleton), its feet at its origin
const statue = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.4).translate(0, 0.9, 0), new THREE.MeshBasicMaterial()));
  return g;
};
// a rig of a few bones not on Meshy's skeleton (a creature's), and a clip
// that turns one of them
const creature = () => {
  const root = new THREE.Bone();
  root.name = 'root';
  const neck = new THREE.Bone();
  neck.name = 'jaw';
  root.add(neck);
  const g = statue();
  g.add(root);
  return g;
};
const turning = (name, dur = 1) => new THREE.AnimationClip(name, dur, [new THREE.QuaternionKeyframeTrack('jaw.quaternion', [0, dur], [0, 0, 0, 1, 0, 0.3826834, 0, 0.9238795])]);

const DT = 1 / 60;
const run = (fig, s, move) => {
  for (let i = 0; i < Math.round(s / DT); i++) fig.update(DT, move);
};
const inner = (fig) => fig.model.children[0];

describe('a galaxy figure that can’t walk its legs', () => {
  it('sways in its step by the ground it covers, not the clock', () => {
    const a = modelFigureOf(statue(), { seed: 3 });
    const b = modelFigureOf(statue(), { seed: 3 });
    expect(a.tall).toBeCloseTo(1.8, 6);
    const heights = [];
    for (let i = 0; i < 120; i++) {
      run(a, DT, 0.5); // (1.2 m/s for 2 s)
      heights.push(inner(a).position.y);
    }
    run(b, 1, 1); // (2.4 m/s for 1 s: as far)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.02);
    expect(inner(b).position.y).toBeCloseTo(inner(a).position.y, 6);
    expect(inner(b).rotation.z).toBeCloseTo(inner(a).rotation.z, 6);
  });

  it('breathes as it stands, never glides at one height, each in its own time', () => {
    const a = modelFigureOf(statue(), { seed: 1 });
    const b = modelFigureOf(statue(), { seed: 2 });
    const breaths = [];
    for (let i = 0; i < 240; i++) {
      a.update(DT, 0);
      b.update(DT, 0);
      expect(inner(a).position.y).toBe(0);
      breaths.push(inner(a).scale.y);
    }
    expect(Math.max(...breaths) - Math.min(...breaths)).toBeGreaterThan(0.005);
    expect(Math.abs(inner(a).scale.y - inner(b).scale.y)).toBeGreaterThan(1e-4);
  });

  it('keeps the caller’s scale and place its own', () => {
    const a = modelFigureOf(statue(), { seed: 4 });
    a.model.scale.setScalar(2);
    a.model.position.set(1, 2, 3);
    run(a, 1, 0.5);
    expect(a.model.scale.x).toBe(2);
    expect(a.model.position.toArray()).toEqual([1, 2, 3]);
  });

  it('plays, looks and reacts to nothing, without throwing', async () => {
    const a = modelFigureOf(statue(), { seed: 5 });
    expect(a.anim).toBe(null);
    expect(a.react('hit', { t: 1 })).toBe(null);
    expect(await a.play('wave')).toBe(false);
    expect(() => a.look({ x: 1, z: 1 })).not.toThrow();
    a.dispose();
  });
});

describe('a galaxy figure with clips of its own', () => {
  it('walks on an animator: its clips weighed to the whole, the one it lacks handed on', () => {
    const scene = creature();
    const fig = modelFigureOf(scene, { animations: [turning('Idle'), turning('Walk')], anim: { idle: 'Idle', walk: 'Walk' }, seed: 1 });
    expect(fig.anim).toBeTruthy();
    for (const move of [0, 0.3, 0.7, 1]) {
      run(fig, 0.2, move);
      const sum = ['idle', 'walk', 'run'].reduce((s, n) => s + (fig.anim.actions[n]?.getEffectiveWeight() ?? 0), 0);
      expect(sum, `move ${move}`).toBeCloseTo(1, 6);
    }
    expect(inner(fig).position.y).toBe(0); // (its walk walks it: no sway over it)
  });

  it('starts each copy somewhere of its own in its clips', () => {
    const at = (seed) => modelFigureOf(creature(), { animations: [turning('Idle', 3)], anim: { idle: 'Idle' }, seed }).anim.actions.idle.time;
    expect(at(1)).not.toBeCloseTo(at(2), 3);
  });

  it('plays its own clips and not the library’s on a skeleton not Meshy’s', async () => {
    const fig = modelFigureOf(creature(), { animations: [turning('Idle'), turning('Roar')], anim: { idle: 'Idle', roar: 'Roar' }, seed: 1 });
    expect(await fig.play('wave')).toBe(false);
    expect(await fig.play('roar')).toBe(true);
    expect(fig.anim.playing('full')).toBe('roar');
    fig.dispose();
  });

  it('an idle and nothing else: it idles, and sways in its step as it goes', () => {
    const fig = modelFigureOf(creature(), { animations: [turning('Idle')], anim: { idle: 'Idle' }, seed: 6 });
    run(fig, 1, 0);
    expect(inner(fig).position.y).toBe(0);
    const heights = [];
    for (let i = 0; i < 60; i++) {
      run(fig, DT, 0.6);
      heights.push(inner(fig).position.y);
    }
    expect(Math.max(...heights)).toBeGreaterThan(0.01);
  });
});
