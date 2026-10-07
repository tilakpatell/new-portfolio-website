// Jack at the helm in Node: the animator's fixture figure stood behind a
// wheel of ours, his own idle the only clip he has (the library's are
// fetched, and here never come: those plays are cut).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';
import { HELM } from './jack';
import { createCaptain, makeWheel } from './captain';

const TALL = 1.8;
// the figure facing +z, the wheel ahead of him, its helmsman's side (+x) turned toward him
const stage = ({ clips = true } = {}) => {
  const rig = meshyRig();
  const ship = new THREE.Group();
  const world = new THREE.Group();
  world.add(ship);
  ship.add(rig.model);
  const wheel = makeWheel(TALL);
  wheel.group.position.set(0, 0, 0.34 * (TALL / 1.78));
  wheel.group.rotation.y = Math.PI / 2;
  ship.add(wheel.group);
  world.updateMatrixWorld(true);
  const src = { root: rig.model, clips: clips ? [rig.clips.idle] : [] };
  const cap = createCaptain(rig.model, src, { wheel });
  return { rig, ship, wheel, cap, hand: (side) => rig.model.getObjectByName(`${side}Hand`).getWorldPosition(new THREE.Vector3()) };
};
const run = (cap, seconds, opts = {}) => {
  for (let i = 0; i < seconds * 60; i++) cap.update(1 / 60, opts);
};

describe('the wheel', () => {
  it('has a grip each side of its top, on the helmsman’s left and right', () => {
    const w = makeWheel(TALL);
    w.group.updateMatrixWorld(true);
    const l = w.grip('left', new THREE.Vector3());
    const r = w.grip('right', new THREE.Vector3());
    // (its helmsman stands on its +x, facing −x: his left is +z)
    expect(l.z).toBeGreaterThan(0.1);
    expect(r.z).toBeLessThan(-0.1);
    expect(l.y).toBeGreaterThan(w.axle);
    expect(r.y).toBeCloseTo(l.y, 5);
    expect(Math.hypot(l.y - w.axle, l.z)).toBeCloseTo(w.radius, 5);
  });

  it('turns clockwise, as he sees it, for starboard, and the hands go round a little with it', () => {
    const w = makeWheel(TALL);
    const before = w.grip('left', new THREE.Vector3());
    w.turn(1);
    expect(w.spin.rotation.x).toBeCloseTo(-1);
    const after = w.grip('left', new THREE.Vector3());
    // the top of the wheel goes to his right (−z)
    expect(after.z).toBeLessThan(before.z);
  });
});

describe('Jack at the helm', () => {
  it('stands on his own idle, his hands on the wheel', () => {
    const { cap, wheel, hand } = stage();
    expect(cap.anim).toBeTruthy();
    const free = hand('Left').distanceTo(wheel.grip('left', new THREE.Vector3()));
    run(cap, 2);
    const held = hand('Left').distanceTo(wheel.grip('left', new THREE.Vector3()));
    expect(held).toBeLessThan(0.05);
    expect(held).toBeLessThan(free);
    expect(hand('Right').distanceTo(wheel.grip('right', new THREE.Vector3()))).toBeLessThan(0.05);
  });

  it('puts the wheel over with the helm, by time', () => {
    const { cap, wheel } = stage();
    run(cap, 0.05, { rudder: 1 });
    expect(-wheel.spin.rotation.x).toBeLessThan(HELM.turns * 0.5);
    run(cap, 3, { rudder: 1 });
    expect(-wheel.spin.rotation.x).toBeCloseTo(HELM.turns, 1);
  });

  it('goes down with her, his hands off the wheel, and stays down', () => {
    const { cap, wheel, hand } = stage();
    run(cap, 1);
    cap.hear({ type: 'sunk', kind: 'pearl' }, { x: 0, y: 0, a: 0 });
    expect(cap.down).toBe(true);
    run(cap, 1);
    expect(hand('Left').distanceTo(wheel.grip('left', new THREE.Vector3()))).toBeGreaterThan(0.05);
    // nothing smaller gets him up
    cap.hear({ type: 'pickup', kind: 'rum' }, { x: 0, y: 0, a: 0 });
    expect(cap.down).toBe(true);
  });

  it('hears nothing he has no part in, and is no worse for it', () => {
    const { cap } = stage();
    expect(cap.hear({ type: 'splash', x: 3, y: 4 }, { x: 0, y: 0, a: 0 })).toBeNull();
    expect(cap.hear({ type: 'broadside', owner: 'p', side: 1 }, { x: 0, y: 0, a: 0 })?.clip).toBe('shout');
  });

  it('stands as before on the mixer when he has no clip of his own', () => {
    const { cap } = stage({ clips: false });
    expect(cap.anim).toBeNull();
    expect(() => run(cap, 0.5, { rudder: 0.5 })).not.toThrow();
    cap.dispose();
  });
});
