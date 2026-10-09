// Things the player can knock over (docs/superpowers/specs/2026-10-08-game-
// feel-design.md §2, Tier 3; Bruno Simon's props, research note §5): a list
// of { kind, x, y, z, yaw } placed as light bodies (lib/physics/props.js),
// asleep until something touches them, drawn through one instanced pool a
// kind (./pool.js), so a street of cones is one draw. Only the awake ones are
// written a frame. A hit hard enough goes to `impacts` (./impacts.js's
// wireImpacts: a thud, a puff, a nudge), so a cone sent flying sounds like
// one.
//
// Without an engine (a phone, Data Saver, a tier under high: `physical`
// false, or Rapier not loaded) the props are still drawn, standing where
// they were put, and nothing moves them: a world places them the same way
// either way.
//
//   KINDS: crate, barrel, cone, bin ({ mass, lift, colliders, size, colour,
//     shape }: the masses are his, light against a car's tens)
//   createKnockables({ physics = null, kinds = KINDS, impacts = null,
//     parent, count = 64 }) → { add(list), sync(), meshes, physical,
//     dispose() }
//   knockablesWanted({ tier, phone, saveData }) → boolean: whether a world
//     should load the engine for them at all
//
// `physics` is lib/physics/world.js's world (or null); the world steps it
// and calls `sync()` after. A kind's `shape` is how it's drawn: 'box',
// 'cylinder' or 'cone', its `size` [x, y, z] in metres.

import * as THREE from 'three';
import { addProps } from '../physics/props';
import { pool } from './pool';

export const KINDS = {
  crate: { mass: 0.02, lift: 0.4, hitThreshold: 0, colliders: [{ shape: 'cuboid', args: [0.4, 0.4, 0.4] }], shape: 'box', size: [0.8, 0.8, 0.8], colour: 0x9a7448 },
  barrel: { mass: 0.1, lift: 0.5, colliders: [{ shape: 'cylinder', args: [0.5, 0.32] }], shape: 'cylinder', size: [0.64, 1, 0.64], colour: 0x3d6f8f },
  cone: { mass: 0.05, lift: 0.35, hitThreshold: 0, colliders: [{ shape: 'cylinder', args: [0.35, 0.2] }], shape: 'cone', size: [0.4, 0.7, 0.4], colour: 0xf06a1d },
  bin: { mass: 0.3, lift: 0.5, colliders: [{ shape: 'cylinder', args: [0.5, 0.3] }], shape: 'cylinder', size: [0.6, 1, 0.6], colour: 0x4b5a4a },
};

// the engine is worth its bytes on a computer that can draw it, and not on
// a phone or with Data Saver on
export const knockablesWanted = ({ tier, phone = false, saveData = false } = {}) => (tier === 'high' || tier === 'ultra') && !phone && !saveData;

function geometryOf(k) {
  const [x, y, z] = k.size;
  if (k.shape === 'box') return new THREE.BoxGeometry(x, y, z);
  if (k.shape === 'cone') return new THREE.ConeGeometry(x / 2, y, 12);
  return new THREE.CylinderGeometry(x / 2, x / 2, y, 14);
}

export function createKnockables({ physics = null, kinds = KINDS, impacts = null, parent = null, count = 64 } = {}) {
  const live = Boolean(physics) && !physics.disposed;
  // the physics' kinds: each hit hard enough told to the impacts, keyed by
  // its kind, so a row of cones scattered at once isn't a drum roll
  const bodyKinds = {};
  for (const [name, k] of Object.entries(kinds)) {
    bodyKinds[name] = { type: 'dynamic', mass: k.mass, lift: k.lift, colliders: k.colliders, hitThreshold: k.hitThreshold, onHit: impacts ? (force, at) => impacts.onHit(force, at, name) : undefined };
  }
  const pools = {};
  const meshes = [];
  for (const [name, k] of Object.entries(kinds)) {
    const p = pool(geometryOf(k), new THREE.MeshStandardMaterial({ color: k.colour, roughness: 0.75 }), count, `knockable-${name}`);
    pools[name] = p;
    meshes.push(p.mesh);
    parent?.add(p.mesh);
  }
  const groups = []; // { props (lib/physics/props.js), slots: [{ pool, slot }] }
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let gone = false;

  return {
    meshes,
    physical: live,
    // places a list; those over a kind's `count` are dropped (a street with
    // too many is still a street)
    add(list) {
      if (gone) return;
      const placed = [];
      const slots = [];
      for (const p of list) {
        const into = pools[p.kind];
        if (!into) throw new Error(`knockables: no kind '${p.kind}'`);
        const slot = into.take();
        if (slot < 0) continue;
        placed.push(p);
        slots.push({ pool: into, slot });
        // where it stands, until (and unless) the engine moves it
        turn.setFromAxisAngle(up, p.yaw ?? 0);
        into.place(slot, [p.x, p.y + (kinds[p.kind].lift ?? 0), p.z], turn.toArray());
      }
      const props = live && placed.length ? addProps(physics, placed, bodyKinds) : null;
      groups.push({ props, slots });
    },
    // the awake ones, where the engine has them
    sync() {
      if (gone || !live || physics.disposed) return;
      for (const g of groups) {
        g.props?.sync((i, p, q) => {
          const s = g.slots[i];
          s.pool.place(s.slot, p, q);
        });
      }
    },
    dispose() {
      if (gone) return;
      gone = true;
      for (const g of groups) g.props?.remove();
      for (const p of Object.values(pools)) {
        parent?.remove(p.mesh);
        p.dispose();
      }
    },
  };
}
