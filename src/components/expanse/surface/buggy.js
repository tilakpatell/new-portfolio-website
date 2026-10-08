// The car's look, built in code (Albuquerque's vehicles.js builds its cars
// the same way; a modelled one is Phase 4): a body and a cab painted from
// the Expanse's strip (./look.js, lib/three/palette) on the chassis, merged
// into one mesh on the one material the crates share, and four wheels that
// hang on the springs and turn as his do (folio-2025's VisualVehicle.js;
// research note Part 1 §2): each wheel's height is min(−suspension, −0.5)
// eased at 25 a second, its spin forwardSpeed / radius, the front pair's
// steer eased at 16 a second. Wheels 0 and 1 are the front (+x), 0 and 2
// the right (+z), as the controller's.
//
//   createBuggy({ palette (a createPalette result; the Expanse's own if
//     none), paint: { body, cab, dark } (its cells), material (the strip's
//     material to share; its own if none) }) → { group, body,
//     wheels: Mesh[4], update(vehicleState, steer −1…1, dt), dispose() }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPalette } from '../../../lib/three/palette.js';
import { LOOK, PAINT } from './look.js';

const RADIUS = 0.4;
const OFFSET = [0.9, 0.75];
const STEERING = 0.5;

export function createBuggy({ palette = null, paint = PAINT, material: shared = null } = {}) {
  // (a strip or a material of its own only when it's handed none: then it's the buggy's to free)
  const own = palette ? null : createPalette(LOOK.palette);
  const strip = palette ?? own;
  const material = shared ?? strip.material();
  const group = new THREE.Group();
  group.name = 'buggy';
  const geometries = [];
  const box = (w, h, d, cell, x, y, z) => strip.paint(new THREE.BoxGeometry(w, h, d), cell).translate(x, y, z);
  // the body on the mass box (2.6 × 0.8 × 1.7), the cab on the top box, the
  // bumper: one geometry, one draw
  const shell = mergeGeometries([box(2.6, 0.6, 1.7, paint.body, 0, -0.05, 0), box(1.0, 0.45, 1.3, paint.cab, -0.1, 0.45, 0), box(0.3, 0.25, 1.75, paint.dark, 1.25, -0.2, 0)]);
  geometries.push(shell);
  const body = new THREE.Mesh(shell, material);
  body.name = 'buggy body';
  body.castShadow = true;
  group.add(body);
  const tyre = strip.paint(new THREE.CylinderGeometry(RADIUS, RADIUS, 0.3, 14), paint.dark);
  tyre.rotateX(Math.PI / 2);
  geometries.push(tyre);
  const wheels = [
    [OFFSET[0], OFFSET[1]],
    [OFFSET[0], -OFFSET[1]],
    [-OFFSET[0], OFFSET[1]],
    [-OFFSET[0], -OFFSET[1]],
  ].map(([x, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.5, z);
    const tyreMesh = new THREE.Mesh(tyre, material);
    tyreMesh.castShadow = true;
    pivot.add(tyreMesh);
    pivot.userData = { spin: 0, tyre: tyreMesh, front: i < 2 };
    group.add(pivot);
    return pivot;
  });
  let steering = 0;
  return {
    group,
    body,
    wheels,
    update(v, steer = 0, dt = 1 / 60) {
      steering += (-steer * STEERING - steering) * Math.min(1, dt * 16);
      for (let i = 0; i < 4; i++) {
        const w = wheels[i];
        const want = Math.min(-(v.wheels[i]?.suspension ?? 0.5), -0.5);
        w.position.y += (want - w.position.y) * Math.min(1, 25 * dt);
        w.userData.spin = -((v.forwardSpeed ?? 0) / RADIUS) * dt;
        w.userData.tyre.rotation.z += w.userData.spin;
        if (w.userData.front) w.rotation.y = steering;
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      if (!shared) material.dispose();
      own?.dispose();
    },
  };
}
