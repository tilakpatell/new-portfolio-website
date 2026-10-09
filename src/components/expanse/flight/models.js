// The shared world's shapes, built in code as one geometry each (so each is
// one pool, one draw): the ship wedge (the other pilots', and tipped over,
// a wreck), a turret's foot and its head with the barrel, a dome, a beacon's
// pole and light, and a bolt. Painted, as the flight is (./look.js): flat
// shading, colour from the look's strip at the pool.
//
//   wedgeGeometry(), turretFoot(), turretHead(), domeGeometry(), beaconGeometry(), boltGeometry()

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TURRET } from './turretRules';

// (merged geometries must all say the same attributes: position and normal)
const bare = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
};
const merged = (parts) => {
  const g = mergeGeometries(parts.map(bare));
  g.computeBoundingSphere();
  return g;
};

// the ship as scene.js draws yours: a hull, swept wings, two engines; about
// 12 m nose to tail, its nose down −z
export function wedgeGeometry() {
  const hull = new THREE.ConeGeometry(1.4, 12, 4);
  hull.rotateY(Math.PI / 4);
  hull.rotateX(-Math.PI / 2);
  hull.scale(1, 0.55, 1);
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.2, -1.5, 7, -0.2, 4.5, 0, -0.2, 5, 0, -0.2, -1.5, 0, -0.2, 5, -7, -0.2, 4.5, 0, -0.2, -1.5, 0, -0.2, 5, 7, -0.2, 4.5, 0, -0.2, -1.5, -7, -0.2, 4.5, 0, -0.2, 5], 3));
  const engines = [-1.3, 1.3].map((x) => new THREE.CylinderGeometry(0.45, 0.55, 2.4, 8).rotateX(Math.PI / 2).translate(x, 0, 4.6));
  return merged([hull, wing, ...engines]);
}

// a turret's foot: a squat drum, its top at the head's pivot less a little
export function turretFoot() {
  return merged([new THREE.CylinderGeometry(2.2, 3, TURRET.height - 1, 8).translate(0, (TURRET.height - 1) / 2, 0)]);
}

// its head: a block on the pivot and the barrel out along −z (yaw and pitch turn it whole)
export function turretHead() {
  const block = new THREE.BoxGeometry(3, 2, 3.2);
  const barrel = new THREE.CylinderGeometry(0.35, 0.45, 4.5, 8).rotateX(Math.PI / 2).translate(0, 0.2, -3.6);
  return merged([block, barrel]);
}

export function domeGeometry() {
  return merged([new THREE.SphereGeometry(8, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.CylinderGeometry(8, 8.4, 1, 14).translate(0, 0.5, 0)]);
}

export function beaconGeometry() {
  return merged([new THREE.CylinderGeometry(0.25, 0.4, 14, 6).translate(0, 7, 0), new THREE.OctahedronGeometry(1.1).translate(0, 14.8, 0)]);
}

// a bolt: a thin rod along −z, about 7 m (it moves 15 m a frame: the rod is its streak)
export function boltGeometry() {
  return merged([new THREE.BoxGeometry(0.35, 0.35, 7)]);
}
