import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnimator } from './animator';
import { animatorCalls } from './figureCalls';
import { HELD, gripFrame, handFrame, handPoints, handSkinCount, holdItem, skinStep } from './held';
import { meshyRig, swingClip, withHands } from './meshyRig.fixture';

const V = THREE.Vector3;
const DT = 1 / 60;
const FRAME = { forward: new V(0, 0, 1), up: new V(0, 1, 0) };
const STILL = { move: 0 };
const WALK = { move: 0.5, speed: 1.2 };
const DEG = Math.PI / 180;

afterEach(() => vi.restoreAllMocks());

// a figure: the rig with hands, its animator
function make({ verts = 60, seed = 1 } = {}) {
  const rig = withHands(meshyRig(), { verts });
  const anim = createAnimator(rig.model, { clips: rig.clips, hipsY: rig.hipsY, seed });
  return { rig, anim, fig: { model: rig.model, anim } };
}
function step(f, secs, motion = STILL, holds = []) {
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    f.anim.locomote(motion);
    f.anim.update(DT);
    f.anim.after(DT, motion, FRAME);
    for (const h of holds) h.update(DT, { moving: motion.move > 0 });
    f.rig.model.updateMatrixWorld(true);
  }
}
// a staff: a pole a metre and a half long, upright, its grip a child
function staff() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), new THREE.MeshBasicMaterial()));
  const grip = new THREE.Object3D();
  grip.name = 'grip';
  grip.position.set(0, 0.3, 0);
  g.add(grip);
  const top = new THREE.Object3D();
  top.name = 'top';
  top.position.set(0, 0.75, 0);
  g.add(top);
  return g;
}
const worldOf = (o) => o.getWorldPosition(new V());
const axisOf = (o) => new V(0, 1, 0).transformDirection(o.matrixWorld);
// where the item's grip should be: the palm's middle, a finger out of it (world)
const palmAt = (hold) => {
  const d = hold.item.userData.held;
  return new V(...d.palm).applyMatrix4(hold.hand.matrixWorld);
};
const handDir = (hold, v) => v.clone().transformDirection(hold.hand.matrixWorld);
const lineAngle = (a, b) => Math.acos(Math.min(1, Math.abs(a.clone().normalize().dot(b.clone().normalize()))));
const UP = new V(0, 1, 0);
// a rig with hands, changed before its hands are bound
const rigged = (change = () => {}, opts = {}) => {
  const rig = meshyRig(opts);
  change(rig);
  rig.model.updateMatrixWorld(true);
  return withHands(rig);
};
// the hands' thumb nubs taken off their skin (on the hips instead): a hand
// whose skin doesn't say where its thumb is
const noNub = (rig, verts = 60) => {
  const si = rig.hands.geometry.attributes.skinIndex;
  const nub = Math.round(verts * 0.1);
  for (let h = 0; h < 2; h++) for (let i = (h + 1) * verts - nub; i < (h + 1) * verts; i++) si.setX(i, 0);
  return rig;
};
// a spear's second grip, ahead of the left elbow, where that arm can reach
const grip2For = (rig, spear) => {
  rig.model.updateMatrixWorld(true);
  const g2 = new THREE.Object3D();
  g2.name = 'grip2';
  g2.position.copy(spear.worldToLocal(worldOf(rig.bones.LeftForeArm).add(new V(-0.05, -0.05, 0.25))));
  spear.add(g2);
  return g2;
};

describe('the grip frame, from the hand’s own skin', () => {
  it('finds the fingers, the thumb and the palm on a right hand and a mirrored left', () => {
    const { rig } = make();
    const R = gripFrame(rig.model, rig.bones.RightHand);
    expect(R.along.angleTo(new V(0, 1, 0))).toBeLessThan(10 * DEG); // out the fingers
    expect(R.thumb.z).toBeGreaterThan(0.95); // toward the nub
    expect(Math.abs(R.normal.x)).toBeGreaterThan(0.95); // out of the plate
    expect(R.normal.distanceTo(new V().crossVectors(R.thumb, R.along).normalize())).toBeLessThan(1e-6);
    expect(R.mean.y).toBeGreaterThan(3);
    expect(R.bind.isMatrix4).toBe(true);
    const L = gripFrame(rig.model, rig.bones.LeftHand, { left: true });
    expect(L.thumb.z).toBeGreaterThan(0.95);
    expect(L.normal.distanceTo(new V().crossVectors(L.along, L.thumb).normalize())).toBeLessThan(1e-6);
    expect(L.normal.dot(R.normal)).toBeLessThan(-0.95); // (the same bone axes, the palm the mirror)
  });

  it('is the same whatever the figure is doing when it’s asked', () => {
    const f = make();
    const at = gripFrame(f.rig.model, f.rig.bones.RightHand);
    const g = make({ seed: 2 });
    step(g, 0.4, WALK);
    const mid = gripFrame(g.rig.model, g.rig.bones.RightHand);
    for (const k of ['along', 'thumb', 'normal', 'mean']) expect(mid[k].distanceTo(at[k])).toBeLessThan(1e-6);
  });

  it('a hand with too little skin gives no frame', () => {
    const { rig } = make({ verts: 20 });
    expect(gripFrame(rig.model, rig.bones.RightHand)).toBe(null);
  });

  it('a hand turned so its thumb lies across the body (palm-up, thumb-up) keeps it toward the nub', () => {
    const r = withHands(meshyRig());
    const plain = { R: gripFrame(r.model, r.bones.RightHand), L: gripFrame(r.model, r.bones.LeftHand, { left: true }) };
    // each hand turned about its fingers until the nub's side points out
    // from the body and up: forward can't say which way the thumb is, and
    // the way in says the wrong way
    const turnOut = (rig, name, out) => {
      const b = rig.bones[name];
      const a = new V().setFromMatrixColumn(b.matrixWorld, 1).normalize();
      const n0 = new V(0, 0, 1).transformDirection(b.matrixWorld);
      const t = new V(out, 1, 0).normalize();
      const c = new V().crossVectors(a, n0);
      const th = Math.atan2(c.dot(t), n0.dot(t) - a.dot(n0) * a.dot(t));
      b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, th));
    };
    const rig = rigged((x) => {
      turnOut(x, 'RightHand', -1);
      turnOut(x, 'LeftHand', 1);
    });
    for (const [name, left, P, out] of [
      ['RightHand', false, plain.R, -1],
      ['LeftHand', true, plain.L, 1],
    ]) {
      const F = gripFrame(rig.model, rig.bones[name], { left });
      const nub = new V(0, 0, 1).transformDirection(F.bind);
      expect(Math.abs(nub.z)).toBeLessThan(0.35); // (across the body)
      expect(nub.x * out - nub.z).toBeGreaterThan(0); // (more out from it than ahead: forward plus inward would flip it)
      expect(F.thumb.z).toBeGreaterThan(0.95);
      expect(F.normal.distanceTo(P.normal)).toBeLessThan(1e-6);
    }
  });

  it('a rig facing −z: forward is the rig’s own (its head’s front, else its left and right), so the thumb still goes to the nub', () => {
    const turn = (r) => (r.armature.rotation.y = Math.PI);
    // with the nub, and without it (the skin saying nothing either way)
    for (const rig of [rigged(turn), noNub(rigged()), noNub(rigged(turn)), noNub(rigged(turn, { without: ['headfront'] }))]) {
      expect(gripFrame(rig.model, rig.bones.RightHand).thumb.z).toBeGreaterThan(0.95);
      expect(gripFrame(rig.model, rig.bones.LeftHand, { left: true }).thumb.z).toBeGreaterThan(0.95);
    }
  });

  it('counts the hand’s skin as it reads it: every vertex up to 16,000, then a sample', () => {
    const { rig } = make();
    expect(handSkinCount(rig.model, rig.bones.RightHand)).toBe(60);
    expect(handSkinCount(rig.model, null)).toBe(0);
    expect([1, 8000, 15999, 16000, 40000].map(skinStep)).toEqual([1, 1, 1, 2, 5]);
  });

  it('handPoints reads the hand’s vertices as the figure stands', () => {
    const { rig } = make();
    expect(handPoints(rig.model, rig.bones.RightHand).length).toBe(60);
    expect(handFrame).toBeTypeOf('function');
  });
});

describe('HELD', () => {
  it('names every kind the worlds hold, each with its axis, its up, its hands and its carry', () => {
    const kinds = ['staff', 'white-staff', 'torch', 'lantern', 'cane', 'umbrella', 'tankard', 'glass', 'bottle', 'sword', 'axe', 'dagger', 'horn', 'gaffi', 'spear', 'bow', 'tray', 'plate', 'bag', 'portalgun', 'plumbus', 'laser', 'carrot', 'pipe', 'ring'];
    expect(Object.keys(HELD).sort()).toEqual([...kinds].sort());
    for (const k of kinds) {
      expect(HELD[k].axis).toBe('y');
      expect(['thumb', 'fingers', 'palm']).toContain(HELD[k].up);
      expect([1, 2]).toContain(HELD[k].hands);
    }
    expect(HELD.staff.carry).toEqual({ still: true, upright: true });
    expect(HELD.tankard.carry).toEqual({ upright: true });
    expect(HELD.sword.carry).toEqual({});
    expect(HELD.bow.hand).toBe('left');
    expect(HELD.spear.hands).toBe(2);
    expect(HELD.gaffi.hands).toBe(2);
    expect(HELD.tray.up).toBe('palm');
  });
});

describe('holdItem', () => {
  it('puts the grip in the palm and the staff along the thumb’s line, whatever the pose', () => {
    const f = make();
    const s = staff();
    const h = holdItem(f.fig, s, 'staff');
    expect(h.hand).toBe(f.rig.bones.RightHand);
    expect(s.parent).toBe(f.rig.bones.RightHand);
    f.rig.model.updateMatrixWorld(true);
    const F = gripFrame(f.rig.model, f.rig.bones.RightHand);
    const want = F.mean.clone().addScaledVector(F.normal, 0.012 / 0.01).applyMatrix4(h.hand.matrixWorld);
    expect(worldOf(s.getObjectByName('grip')).distanceTo(want)).toBeLessThan(0.01);
    expect(palmAt(h).distanceTo(want)).toBeLessThan(1e-6);
    expect(lineAngle(axisOf(s), handDir(h, F.thumb))).toBeLessThan(15 * DEG);
    // walking, it stays in the palm
    step(f, 0.3, WALK);
    expect(worldOf(s.getObjectByName('grip')).distanceTo(palmAt(h))).toBeLessThan(0.01);
  });

  it('attached mid-walk, it lands in the same place in the hand', () => {
    const A = make();
    const B = make();
    step(B, 0.37, WALK);
    const a = holdItem(A.fig, staff(), 'staff');
    const b = holdItem(B.fig, staff(), 'staff');
    for (const k of ['position', 'quaternion', 'scale']) expect(b.item[k].toArray().map((x, i) => Math.abs(x - a.item[k].toArray()[i])).every((d) => d < 1e-6)).toBe(true);
    B.rig.model.updateMatrixWorld(true);
    expect(worldOf(b.item.getObjectByName('grip')).distanceTo(palmAt(b))).toBeLessThan(0.01);
  });

  it('a sword runs out along the fingers, a tray lies along the palm’s normal', () => {
    const f = make();
    const F = gripFrame(f.rig.model, f.rig.bones.RightHand);
    const sword = holdItem(f.fig, staff(), 'sword');
    f.rig.model.updateMatrixWorld(true);
    expect(lineAngle(axisOf(sword.item), handDir(sword, F.along))).toBeLessThan(1 * DEG);
    sword.release();
    const tray = holdItem(f.fig, staff(), 'tray');
    f.rig.model.updateMatrixWorld(true);
    expect(axisOf(tray.item).angleTo(handDir(tray, F.normal))).toBeLessThan(1 * DEG);
  });

  it('scale is the item’s units to the world’s: 0.5 halves its length', () => {
    const f = make();
    const one = holdItem(f.fig, staff(), 'sword');
    const half = holdItem(f.fig, staff(), 'dagger', { scale: 0.5 });
    f.rig.model.updateMatrixWorld(true);
    const len = (h) => worldOf(h.item.getObjectByName('top')).distanceTo(worldOf(h.item));
    expect(len(one)).toBeCloseTo(0.75, 4);
    expect(len(half)).toBeCloseTo(0.375, 4);
  });

  it('release puts the item back where it was', () => {
    const f = make();
    const toy = new THREE.Group();
    toy.position.set(3, 0, 1);
    const s = staff();
    s.position.set(0.1, 0.5, 0);
    s.rotation.set(0.2, 0, 0.4);
    s.userData.held = { kind: 'staff' };
    toy.add(s);
    toy.updateMatrixWorld(true);
    const before = s.matrixWorld.clone();
    const h = holdItem(f.fig, s, 'staff');
    expect(s.userData.held.hand).toBe('right');
    h.release();
    toy.updateMatrixWorld(true);
    expect(s.parent).toBe(toy);
    expect(s.matrixWorld.elements.every((x, i) => Math.abs(x - before.elements[i]) < 1e-4)).toBe(true);
    expect(s.userData.held).toEqual({ kind: 'staff' });
    expect(() => h.release()).not.toThrow();
  });

  it('hide(on) hides it and shows it again', () => {
    const f = make();
    const h = holdItem(f.fig, staff(), 'staff');
    h.hide(true);
    expect(h.item.visible).toBe(false);
    h.hide(false);
    expect(h.item.visible).toBe(true);
  });

  it('a hand with too little skin falls back to the forearm’s frame', () => {
    const f = make({ verts: 20 });
    const h = holdItem(f.fig, staff(), 'staff');
    expect(h).not.toBe(null);
    f.rig.model.updateMatrixWorld(true);
    const R = worldOf(f.rig.bones.RightHand);
    const A = worldOf(f.rig.bones.RightForeArm);
    const want = R.clone().addScaledVector(R.clone().sub(A), 0.25);
    expect(palmAt(h).distanceTo(want)).toBeLessThan(0.02);
  });

  it('a curl leaves the shared geometry as it was: another figure of the model has no morphs', () => {
    const rig = withHands(meshyRig());
    const a = cloneSkinned(rig.model);
    const b = cloneSkinned(rig.model);
    const meshOf = (m) => m.getObjectByName('hands');
    expect(meshOf(a).geometry).toBe(rig.hands.geometry);
    const h = holdItem({ model: a }, staff(), 'staff', { curl: true });
    expect(h).not.toBe(null);
    expect(Object.keys(rig.hands.geometry.morphAttributes)).toEqual([]);
    expect(meshOf(b).geometry).toBe(rig.hands.geometry);
    expect(meshOf(b).morphTargetInfluences).toBeUndefined();
    h.release();
    expect(meshOf(a).geometry).toBe(rig.hands.geometry);
  });

  it('a curl in the right hand and then the left, on one template: each hand gets its own', () => {
    const rig = withHands(meshyRig());
    const a = cloneSkinned(rig.model);
    const b = cloneSkinned(rig.model);
    const meshOf = (m) => m.getObjectByName('hands');
    const r = holdItem({ model: a }, staff(), 'sword', { curl: true });
    const l = holdItem({ model: b }, staff(), 'sword', { curl: true, left: true });
    expect(r && l).toBeTruthy();
    const dr = meshOf(a).morphTargetDictionary;
    const dl = meshOf(b).morphTargetDictionary;
    expect(dr.gripR).toBeDefined();
    expect(dl.gripL).toBeDefined();
    expect(meshOf(b).morphTargetInfluences[dl.gripL]).toBe(1);
  });

  it('caches the frame by the model’s template: a clone gets the same one', () => {
    const rig = withHands(meshyRig());
    const a = cloneSkinned(rig.model);
    const fa = gripFrame(a, a.getObjectByName('RightHand'));
    const fr = gripFrame(rig.model, rig.bones.RightHand);
    expect(fa).toBe(fr);
  });

  it('the still carry lays the idle’s arm over the walk, only while moving', () => {
    const A = make();
    const h = holdItem(A.fig, staff(), 'staff');
    const restR = A.rig.rest.RightArm.turn;
    const restL = A.rig.rest.LeftArm.turn;
    let right = 0;
    let left = 0;
    step(A, 0.5, WALK, [h]);
    for (let i = 0; i < 60; i++) {
      step(A, DT, WALK, [h]);
      right = Math.max(right, A.rig.bones.RightArm.quaternion.angleTo(restR));
      left = Math.max(left, A.rig.bones.LeftArm.quaternion.angleTo(restL));
    }
    expect(right).toBeLessThan(0.25);
    expect(left).toBeGreaterThan(right * 2);
    expect(A.anim.playing('arm.r')).toBe('idle');
    expect(A.anim.weight('arm.r')).toBeCloseTo(0.85, 2);
    // standing, the arm is the clip's again
    step(A, 2, STILL, [h]);
    expect(A.anim.weight('arm.r')).toBe(0);
    expect(A.rig.bones.RightArm.quaternion.angleTo(restR)).toBeLessThan(1e-3);
  });

  it('an anim that isn’t an animator (figureCalls’ facade) gets no still carry, and nothing throws', () => {
    const f = make();
    const facade = animatorCalls(f.anim, { model: f.rig.model });
    const play = vi.spyOn(facade, 'play');
    const stop = vi.spyOn(facade, 'stop');
    const h = holdItem({ model: f.rig.model, anim: facade }, staff(), 'staff');
    expect(() => {
      for (let i = 0; i < 30; i++) h.update(DT, { moving: true });
      h.after();
      h.release();
    }).not.toThrow();
    expect(play).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(f.anim.playing('arm.r')).toBe(null);
  });

  it('in a frame’s order, update leaves the arm to the animator and after turns it upright once', () => {
    const f = make();
    const h = holdItem(f.fig, staff(), 'staff');
    const hand = f.rig.bones.RightHand;
    for (let i = 0; i < 40; i++) {
      f.anim.locomote(WALK);
      f.anim.update(DT);
      const posed = hand.quaternion.clone();
      h.update(DT, { moving: true });
      if (i > 0) expect(hand.quaternion.equals(posed)).toBe(true); // (the wrist's for after)
      f.anim.after(DT, WALK, FRAME);
      f.rig.model.updateMatrixWorld(true);
      const laid = hand.quaternion.clone();
      const tilt = axisOf(h.item).angleTo(UP);
      h.after();
      f.rig.model.updateMatrixWorld(true);
      if (i === 0) expect(hand.quaternion.equals(laid)).toBe(true); // (update did it this once: not twice)
      else expect(axisOf(h.item).angleTo(UP)).toBeLessThanOrEqual(tilt + 1e-9);
    }
    expect(f.anim.weight('arm.r')).toBeGreaterThan(0.5);
  });

  it('on a figure with no animator, release turns the arm’s bones back as they were', () => {
    const rig = withHands(meshyRig());
    const names = ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand'];
    const was = names.map((n) => rig.bones[n].quaternion.clone());
    const moved = () => Math.max(...names.map((n, i) => rig.bones[n].quaternion.angleTo(was[i])));
    const tankard = holdItem({ model: rig.model }, staff(), 'tankard');
    for (let i = 0; i < 3; i++) tankard.update(DT);
    expect(moved()).toBeGreaterThan(0.05);
    tankard.release();
    expect(moved()).toBeLessThan(1e-6);
    const spear = staff();
    const two = holdItem({ model: rig.model }, spear, 'spear');
    grip2For(rig, spear);
    two.update(DT);
    expect(rig.bones.LeftArm.quaternion.angleTo(was[3])).toBeGreaterThan(0.01);
    two.release();
    expect(moved()).toBeLessThan(1e-6);
  });

  it('the upright carry turns the wrist toward the world’s up, within its clamps', () => {
    const f = make();
    const h = holdItem(f.fig, staff(), 'tankard');
    step(f, 0.2, STILL);
    const before = axisOf(h.item).angleTo(new V(0, 1, 0));
    const hq = f.rig.bones.RightHand.quaternion.clone();
    const fq = f.rig.bones.RightForeArm.quaternion.clone();
    h.update(DT, { moving: false });
    f.rig.model.updateMatrixWorld(true);
    const after = axisOf(h.item).angleTo(new V(0, 1, 0));
    expect(after).toBeLessThan(before - 0.1);
    expect(f.rig.bones.RightHand.quaternion.angleTo(hq)).toBeLessThanOrEqual(1.2 + 1e-6);
    expect(f.rig.bones.RightForeArm.quaternion.angleTo(fq)).toBeLessThanOrEqual(1.4 + 1e-6);
  });

  it('busy (a drink to the lips, a fall) the upright carry lets the hand be where the clip put it', () => {
    const f = make();
    const h = holdItem(f.fig, staff(), 'tankard');
    step(f, 0.2, STILL);
    const hq = f.rig.bones.RightHand.quaternion.clone();
    const fq = f.rig.bones.RightForeArm.quaternion.clone();
    h.update(DT, { busy: true });
    expect(f.rig.bones.RightHand.quaternion.equals(hq)).toBe(true);
    expect(f.rig.bones.RightForeArm.quaternion.equals(fq)).toBe(true);
  });

  it('two hands: the other reaches the second grip, and lets go while a full-body clip plays', () => {
    const f = make();
    const spear = staff();
    const h = holdItem(f.fig, spear, 'spear');
    f.rig.model.updateMatrixWorld(true);
    // a second grip the left arm can reach: ahead of its elbow
    const target = worldOf(f.rig.bones.LeftForeArm).add(new V(-0.05, -0.05, 0.25));
    const g2 = new THREE.Object3D();
    g2.name = 'grip2';
    g2.position.copy(spear.worldToLocal(target.clone()));
    spear.add(g2);
    h.update(DT, { moving: false });
    f.rig.model.updateMatrixWorld(true);
    expect(worldOf(f.rig.bones.LeftHand).distanceTo(worldOf(g2))).toBeLessThan(0.02);
    // busy: the left hand is where the clip put it
    step(f, 0.1, STILL);
    const clipPut = worldOf(f.rig.bones.LeftHand);
    h.update(DT, { busy: true });
    f.rig.model.updateMatrixWorld(true);
    expect(worldOf(f.rig.bones.LeftHand).distanceTo(clipPut)).toBeLessThan(1e-6);
     // a full-body one-shot playing lets go too, and the spear stays in the hand
    f.anim.add('flail', swingClip(f.rig, 'flail', 1, (n) => (n.endsWith('Arm') ? 0.6 : 0)));
    f.anim.play('flail', { fade: 0.05 });
    step(f, 0.3, STILL);
    const flailed = worldOf(f.rig.bones.LeftHand);
    h.update(DT, { moving: false });
    f.rig.model.updateMatrixWorld(true);
    expect(worldOf(f.rig.bones.LeftHand).distanceTo(flailed)).toBeLessThan(1e-6);
    expect(spear.parent).toBe(f.rig.bones.RightHand);
    expect(worldOf(spear.getObjectByName('grip')).distanceTo(palmAt(h))).toBeLessThan(0.01);
  });

  it('a bow goes in the left hand', () => {
    const f = make();
    const h = holdItem(f.fig, staff(), 'bow');
    expect(h.hand).toBe(f.rig.bones.LeftHand);
    expect(h.item.userData.held.hand).toBe('left');
  });

  it('a model with no hand gives null, and nothing throws', () => {
    const rig = meshyRig({ without: ['RightHand'] });
    expect(holdItem({ model: rig.model }, staff(), 'staff')).toBe(null);
    expect(holdItem({ model: new THREE.Group() }, staff(), 'staff')).toBe(null);
    expect(holdItem(null, staff(), 'staff')).toBe(null);
  });
});
