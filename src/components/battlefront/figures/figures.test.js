import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AITRAJECTORY_TURN } from './facing.js';
import { createFigures } from './figures.js';
import { createHeld, weaponUrl } from './held.js';

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
const clip = (name) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0])]);

// a stand-in body: the game's root, hips and weapon socket, the humanoid's names
function body() {
  const model = new THREE.Group();
  const traj = new THREE.Object3D();
  traj.name = 'AITrajectory';
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const socket = new THREE.Bone();
  socket.name = 'Wep_Root';
  socket.position.set(0.3, 1.3, 0);
  hips.add(socket);
  traj.add(hips);
  model.add(traj);
  const clips = Object.fromEntries(['idle', 'aim.rifle', 'aim.pistol', 'walk', 'run', 'die.fwd'].map((n) => [n, clip(n)]));
  return { model, clips, sockets: { weapon: socket } };
}

function setup() {
  const guns = [];
  const stances = [];
  const waits = [];
  const held = createHeld({
    load: (url) => {
      guns.push(url);
      return Promise.resolve({ scene: new THREE.Group(), animations: [] });
    },
  });
  // (a stance pack lands when the test says)
  const loadStance = (key) => {
    stances.push(key);
    return new Promise((resolve) => waits.push(() => resolve(new Map([[`stance.${key}.idle`, clip(`stance.${key}.idle`)]]))));
  };
  const scene = new THREE.Scene();
  const figs = createFigures({ scene, loadBody: async () => body(), held, loadStance });
  return { figs, guns, stances, land: () => waits.shift()() };
}

const soldier = { id: 3, team: 2, at: [5, 0, 1], yaw: 0, state: 'alive', stance: 'stand', vel: [0, 0], t: 0, weapon: 'e11' };

describe('a soldier’s figure with its weapon', () => {
  it('turns the body to the sim’s facing (the clips’ AITrajectory turn put back)', async () => {
    const { figs } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    expect(figs.figure(3).model.getObjectByName('AITrajectory').quaternion.toArray()).toEqual(AITRAJECTORY_TURN);
    expect(figs.figure(3).model.rotation.y).toBe(0);
  });

  it('arms it with the class weapon and gives its muzzle in the world', async () => {
    const { figs, guns } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    expect(guns).toEqual([weaponUrl('e11')]);
    const out = new THREE.Vector3();
    expect(figs.muzzleOf(3, out)).toBe(out);
    // (the stand-in's socket under the turned AITrajectory: its +x is the
    // world's +z, its +z the world's −x; the hips a frame into the clip's rise)
    const hipsY = figs.figure(3).model.getObjectByName('Hips').position.y;
    expect(out.x).toBeCloseTo(5 - 0.298969, 6);
    expect(out.y).toBeCloseTo(hipsY + 1.3 + 0.049385, 6);
    expect(out.z).toBeCloseTo(1 + 0.3, 6);
    expect(figs.muzzleOf(99, out)).toBe(null);
    // (a new weapon: the gun swapped)
    figs.update([{ ...soldier, weapon: 'dh17', t: 1 }], 0.016);
    await settle();
    expect(guns).toEqual([weaponUrl('e11'), weaponUrl('dh17')]);
  });

  it('stands armed: a held pose until the stance pack lands, then the pack’s idle', async () => {
    const { figs, stances, land } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    expect(stances).toEqual(['t']);
    expect(figs.figure(3).clip).toBe('aim.rifle');
    land();
    await settle();
    figs.update([soldier], 0.016);
    expect(figs.figure(3).clip).toBe('stance.t.idle');
    // (a pistol's pose while its pack comes)
    figs.update([{ ...soldier, weapon: 'rk3', t: 1 }], 0.016);
    expect(stances).toEqual(['t', 'p']);
    expect(figs.figure(3).clip).toBe('aim.pistol');
  });

  it('takes the gun off a figure that leaves the view', async () => {
    const { figs } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    const socket = figs.figure(3).sockets.weapon;
    expect(socket.children.length).toBe(1);
    figs.update([], 0.016);
    expect(socket.children.length).toBe(0);
  });
});
