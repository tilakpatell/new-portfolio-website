// The rig that maps a figure's bones onto its hurtboxes: each region
// (lib/physics/hurtbox.js's REGIONS) spans two bones; each frame, after
// the animator has posed the figure, `update` reads both bones' world
// positions and hands the segment to the hurtboxes' `set`, so a crouch, a
// fall or a swing moves the regions with the body. A figure missing a
// region's bone loses that region; one with fewer than four (an unrigged
// built figure, a creature) is `single`: one capsule, `whole`, from the
// feet up `tall`. `blade()` is the hilt's segment for a strike (the hand
// bone's y axis, `offset` up it, `length` long). `debug(parent)` draws the
// regions as wire cylinders where they are, for `?debug`.
//
//   createHitboxRig(root, hurtboxes | null, { regions = REGIONS, tall = 1.8, blade = null }) → {
//     attach(hurtboxes), update(), regions, single,
//     blade() → { base: [x, y, z], tip } | null   (blade: { bone, length, offset = 0 })
//     debug(parent | null) → Group | null }
//   (made before the hurtboxes, since `single` decides how they are made; then attached)

import * as THREE from 'three';
import { REGIONS } from '../../physics/hurtbox';

const MIN_REGIONS = 4;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _y = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export function createHitboxRig(root, hurtboxes = null, { regions = REGIONS, tall = 1.8, blade = null } = {}) {
  const kept = []; // [region, boneA, boneB, r]
  for (const [region, { bones, r }] of Object.entries(regions)) {
    const a = root.getObjectByName(bones[0]);
    const b = root.getObjectByName(bones[1]);
    if (a && b) kept.push([region, a, b, r]);
  }
  const single = kept.length < MIN_REGIONS;
  if (single) kept.length = 0;
  const hand = blade ? root.getObjectByName(blade.bone) : null;
  let boxes = hurtboxes;
  let wire = null; // { group, parent, meshes: Map }

  const place = (region, a, b) => {
    const m = wire?.meshes.get(region);
    if (!m) return;
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _a.length();
    m.scale.y = Math.max(0.01, len);
    if (len > 1e-6) m.quaternion.setFromUnitVectors(UP, _a.divideScalar(len));
  };

  return {
    regions: kept.map((k) => k[0]),
    single,
    attach(h) {
      boxes = h;
    },
    update() {
      if (single) {
        root.getWorldPosition(_a);
        const a = [_a.x, _a.y, _a.z];
        const b = [_a.x, _a.y + tall, _a.z];
        boxes?.set('whole', a, b);
        place('whole', a, b);
        return;
      }
      for (const [region, ba, bb] of kept) {
        ba.getWorldPosition(_a);
        bb.getWorldPosition(_b);
        const a = [_a.x, _a.y, _a.z];
        const b = [_b.x, _b.y, _b.z];
        boxes?.set(region, a, b);
        place(region, a, b);
      }
    },
    blade() {
      if (!hand) return null;
      hand.getWorldPosition(_a);
      _y.set(0, 1, 0).transformDirection(hand.matrixWorld);
      const off = blade.offset ?? 0;
      return { base: [_a.x + _y.x * off, _a.y + _y.y * off, _a.z + _y.z * off], tip: [_a.x + _y.x * (off + blade.length), _a.y + _y.y * (off + blade.length), _a.z + _y.z * (off + blade.length)] };
    },
    debug(parent) {
      if (wire) {
        wire.group.removeFromParent();
        for (const m of wire.meshes.values()) m.geometry.dispose();
        wire.material.dispose();
        wire = null;
      }
      if (!parent) return null;
      const group = new THREE.Group();
      group.name = 'hurtboxes';
      const material = new THREE.MeshBasicMaterial({ color: 0xff4060, wireframe: true, depthTest: false, transparent: true, opacity: 0.8 });
      const meshes = new Map();
      const rows = single ? [['whole', null, null, Math.max(0.4, tall * 0.25)]] : kept;
      for (const [region, , , r] of rows) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8, 1, true), material);
        m.name = region;
        m.renderOrder = 999;
        meshes.set(region, m);
        group.add(m);
      }
      parent.add(group);
      wire = { group, meshes, material };
      _q.identity();
      return group;
    },
  };
}
