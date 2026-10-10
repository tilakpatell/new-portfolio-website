import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { skeleton } from '../../../lib/three/fixtures/gameSkeleton.js';
import { createFigures } from './figures.js';

// a body on the game's skeleton with no clips, loaded at once
const loadBody = async () => {
  const model = new THREE.Group();
  model.add(skeleton().Hips.parent);
  return { model, clips: {} };
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const soldier = (over = {}) => ({ id: 'a', team: 2, kind: 'soldier', at: [1, 0, 2], yaw: 0, state: 'alive', t: 0, vel: [0, 0], fall: null, ...over });

// a stand-in for ragdolls.js: it takes every fall and has the body at once
function fakeRagdolls() {
  const handed = new Set();
  return {
    fall: vi.fn((id) => {
      handed.add(id);
      return true;
    }),
    handed: (id) => handed.has(id),
    drop: vi.fn((id) => handed.delete(id)),
  };
}

describe('the figures and the ragdolls', () => {
  it('hands a fallen soldier to the ragdolls with how it fell, then stops placing it', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody, ragdolls });
    figs.update([soldier()], 0.05);
    await settle();
    figs.update([soldier()], 0.05);
    expect(ragdolls.fall).not.toHaveBeenCalled();
    const fall = { part: 'head', dir: [0, 0, 1], at: [1, 1.6, 2], weapon: 'e11' };
    const eye = [0, 2, 0];
    figs.update([soldier({ state: 'dying', fall, t: 0.05 })], 0.05, 1, eye);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
    expect(ragdolls.fall.mock.calls[0][0]).toBe('a');
    expect(ragdolls.fall.mock.calls[0][2]).toMatchObject({ fall, eye });
    const model = figs.figure('a').model;
    figs.update([soldier({ state: 'down', fall, at: [9, 0, 9], t: 0.1 })], 0.05, 1, eye);
    expect(model.position.x).toBeCloseTo(1, 9);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
  });

  it('drops the ragdoll when the sim takes the soldier away, or it stands again', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody, ragdolls });
    figs.update([soldier(), soldier({ id: 'b' })], 0.05);
    await settle();
    figs.update([soldier({ state: 'dying' }), soldier({ id: 'b', state: 'dying' })], 0.05);
    figs.update([soldier({ state: 'alive', t: 1 })], 0.05);
    expect(ragdolls.drop).toHaveBeenCalledWith('b');
    expect(ragdolls.drop).toHaveBeenCalledWith('a');
    expect(figs.figure('a').model.visible).toBe(true);
    figs.update([soldier({ state: 'alive', at: [5, 0, 5], t: 2 })], 0.05);
    expect(figs.figure('a').model.position.x).toBeCloseTo(5, 9);
  });

  it('draws as before with no ragdolls', async () => {
    const figs = createFigures({ scene: new THREE.Scene(), loadBody });
    figs.update([soldier()], 0.05);
    await settle();
    figs.update([soldier({ state: 'down', at: [3, 0, 3], t: 1 })], 0.05);
    expect(figs.figure('a').model.position.x).toBeCloseTo(3, 9);
  });
});
