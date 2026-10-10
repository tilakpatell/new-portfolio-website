import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bendFinger, handShape, gripMorphs, ungrip } from './grip';

const V = THREE.Vector3;
// a hand's frame in its bone's space: fingers +y, thumb +z, palm −x (as Meshy's right hands come)
const frame = { along: new V(0, 1, 0), thumb: new V(0, 0, 1), normal: new V(-1, 0, 0) };

describe('a finger bent round a grip', () => {
  const K = { ...frame, s0: 10, yc: 0, rho: 3, max: Math.PI * 0.9 };
  it('leaves the palm alone and is continuous at the knuckle', () => {
    const p = new V(0, 6, 1);
    expect(bendFinger(p.clone(), null, K).distanceTo(p)).toBeLessThan(1e-9);
    const at = new V(0, 10, 1);
    expect(bendFinger(at.clone(), null, K).distanceTo(at)).toBeLessThan(1e-9);
  });
  it('wraps the finger round a circle on the palm side, keeping its length', () => {
    // a point a quarter turn round: rho·π/2 past the knuckle, on the centreline
    const p = new V(0, 10 + (3 * Math.PI) / 2, 2);
    const q = bendFinger(p.clone(), null, K);
    const centre = new V(-3, 10, 2); // K + normal·rho
    expect(q.distanceTo(centre)).toBeCloseTo(3, 6); // on the circle
    expect(q.y).toBeCloseTo(13, 6); // a quarter turn: level with the centre, out past it
    expect(q.x).toBeCloseTo(-3, 6);
    expect(q.z).toBeCloseTo(2, 9); // across the hand: unchanged
  });
  it('stops curling at the most it goes, then runs on straight', () => {
    const far = new V(0, 10 + 3 * 5, 0);
    const q = bendFinger(far.clone(), null, K);
    const centre = new V(-3, 10, 0);
    expect(q.distanceTo(centre)).toBeGreaterThan(3); // off the circle, along its tangent
  });
  it('presses a pad that would sink into the grip flat onto it instead', () => {
    // a point well out on the palm side: its own radius (3 − 2.5) would put it near the middle
    const p = new V(-2.5, 10 + (3 * Math.PI) / 2, 0);
    const q = bendFinger(p.clone(), null, { ...K, rMin: 2 });
    expect(q.distanceTo(new V(-3, 10, 0))).toBeCloseTo(2, 6);
    // and at the knuckle, untouched (no step where the bend starts)
    const at = new V(-2.5, 10, 0);
    expect(bendFinger(at.clone(), null, { ...K, rMin: 2 }).distanceTo(at)).toBeLessThan(1e-9);
  });
  it('turns a normal with the finger', () => {
    const p = new V(0, 10 + (3 * Math.PI) / 2, 0);
    const n = new V(1, 0, 0); // the back of the finger, away from the palm
    bendFinger(p, n, K);
    expect(n.y).toBeCloseTo(1, 6); // a quarter turn: the back now faces out along the fingers
  });
});

describe('a hand’s shape', () => {
  // a mitten: a palm 0…10 along, fingers 10…19, 6 wide across, 2 thick; a thumb off to +z
  const hand = () => {
    const pts = [];
    for (let s = 0; s <= 19; s += 0.5) for (let t = -3; t <= 3; t += 0.5) for (const y of [-1, 1]) pts.push(new V(y, s, t));
    for (let s = 3; s <= 9; s += 0.5) for (const y of [-0.7, 0.7]) pts.push(new V(y, s, 5 + (s - 3) * 0.4)); // the thumb
    return pts;
  };
  it('finds the knuckle line, the finger plate’s middle and thickness, and the thumb', () => {
    const pts = hand();
    const h = handShape(pts, frame);
    expect(h.s0).toBeGreaterThan(8);
    expect(h.s0).toBeLessThan(12);
    expect(Math.abs(h.yc)).toBeLessThan(0.2);
    expect(h.half).toBeGreaterThan(0.6);
    expect(h.half).toBeLessThan(1.4);
    const thumbs = pts.filter((p, i) => h.thumb.has(i));
    expect(thumbs.length).toBeGreaterThan(10);
    expect(thumbs.every((p) => p.z > 3.5)).toBe(true); // only the thumb
    expect(pts.filter((p, i) => !h.thumb.has(i) && p.z > 4).length).toBe(0);
  });
  it('puts the knuckles where the hand thins from palm to fingers', () => {
    // a thick palm (0…10, 4 through) and thin fingers (10…19, 1.6 through)
    const pts = [];
    for (let s = 0; s <= 19; s += 0.25) for (let t = -3; t <= 3; t += 1) for (const y of s < 10 ? [-2, 2] : [-0.8, 0.8]) pts.push(new V(y, s, t));
    const h = handShape(pts, frame);
    expect(h.s0).toBeGreaterThan(9);
    expect(h.s0).toBeLessThan(11.5);
    expect(h.half).toBeGreaterThan(0.75); // (the fingers' 1.6, or a tenth of the hand at the least)
    expect(h.half).toBeLessThan(1);
  });
  it('follows fingers sculpted bent in toward the palm', () => {
    // past the knuckles at 10 the fingers run 30° down toward the palm (−x here)
    const pts = [];
    const tilt = Math.PI / 6;
    for (let s = 0; s <= 10; s += 0.25) for (let t = -3; t <= 3; t += 1) for (const y of [-1, 1]) pts.push(new V(y, s, t));
    for (let d = 0.25; d <= 9; d += 0.25) for (let t = -3; t <= 3; t += 1) for (const y of [-0.8, 0.8]) pts.push(new V(y - d * Math.sin(tilt), 10 + d * Math.cos(tilt), t));
    const h = handShape(pts, frame, { knuckle: 10 / 17.8 });
    expect(h.tilt).toBeGreaterThan(tilt - 0.08);
    expect(h.tilt).toBeLessThan(tilt + 0.08);
    expect(h.fingers.dot(new V(-Math.sin(tilt), Math.cos(tilt), 0))).toBeGreaterThan(0.99);
  });
  it('finds no thumb on a hand without one sticking out', () => {
    const pts = hand().filter((p) => p.z <= 3);
    expect(handShape(pts, frame).thumb.size).toBe(0);
  });
});

describe('grip morphs on a skinned mesh', () => {
  // two bones (an arm and a hand), a slab of vertices all on the hand, bound as built
  const figure = () => {
    const arm = new THREE.Bone();
    const hand = new THREE.Bone();
    hand.name = 'RightHand';
    hand.position.set(0, 10, 0);
    arm.add(hand);
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const idx = [];
    const wts = [];
    for (let s = 0; s <= 19; s += 1) for (let t = -3; t <= 3; t += 1) for (const y of [-1, 1]) {
      pos.push(y, 10 + s, t);
      idx.push(1, 0, 0, 0);
      wts.push(1, 0, 0, 0);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 0 ? 1 : 0)), 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
    const root = new THREE.Group();
    root.add(arm, mesh);
    root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([arm, hand]));
    return { root, mesh, hand, geo };
  };
  it('puts the curl on a geometry of its own, leaving the shared one as it was', () => {
    const f = figure();
    const g = gripMorphs(f.root, [{ bone: f.hand, frame, side: 'R', radius: 3 }], 'test');
    expect(g).toBeTruthy();
    expect(f.mesh.geometry).not.toBe(f.geo);
    expect(f.geo.morphAttributes.position).toBeUndefined(); // (the clones' still have none)
    expect(f.mesh.geometry.attributes.position).toBe(f.geo.attributes.position); // (the same data, not a copy)
    expect(f.mesh.morphTargetDictionary.gripR).toBe(0);
    g.set({ R: 1 });
    expect(f.mesh.morphTargetInfluences[0]).toBe(1);
    // a fingertip, curled: in towards the palm's side (−x here) and back from where it reached
    const tip = new V();
    const i = 19 * 7 * 2 + 3 * 2 + 1; // s = 19, t = 0, y = +1
    f.mesh.getVertexPosition(i, tip);
    expect(tip.y).toBeLessThan(29 - 1);
    expect(tip.x).toBeLessThan(-1);
    g.set({ R: 0 });
    f.mesh.getVertexPosition(i, tip);
    expect(tip.y).toBeCloseTo(29, 5);
    // and the same model armed again shares the curl it made the first time
    const f2 = figure();
    f2.mesh.geometry = f.geo;
    const g2 = gripMorphs(f2.root, [{ bone: f2.hand, frame, side: 'R', radius: 3 }], 'test');
    expect(f2.mesh.geometry).toBe(f.mesh.geometry);
    g.dispose();
    expect(f.mesh.geometry).toBe(f.geo);
    g2.dispose();
  });
  it('leaves a hand it can make nothing of open', () => {
    const f = figure();
    const geo = f.geo;
    const w = geo.attributes.skinWeight;
    for (let i = 20; i < w.count; i++) w.setXYZW(i, 0, 0, 0, 0); // (all but a handful off the hand)
    expect(gripMorphs(f.root, [{ bone: f.hand, frame, side: 'R', radius: 3 }], 'few')).toBeNull();
    expect(f.mesh.geometry).toBe(geo);
  });
  it('keeps up with what the model\'s geometry gains, and lets go with it', () => {
    const f = figure();
    const g = gripMorphs(f.root, [{ bone: f.hand, frame, side: 'R', radius: 3 }], 'later');
    const wrap = f.mesh.geometry;
    const zone = new THREE.Float32BufferAttribute(new Float32Array(f.geo.attributes.position.count), 1);
    f.geo.setAttribute('zone', zone); // (as a dress's colours add)
    g.set({ R: 1 });
    expect(wrap.attributes.zone).toBe(zone);
    // the model's geometry freed (a world unloading): the curl's lets go of its share too
    let freed = false;
    wrap.addEventListener('dispose', () => (freed = true));
    f.geo.dispose();
    expect(freed).toBe(true);
    // and taken off again wholesale (before measuring the hands afresh)
    ungrip(f.root);
    expect(f.mesh.geometry).toBe(f.geo);
    expect(f.mesh.morphTargetInfluences).toBeUndefined();
  });
});
