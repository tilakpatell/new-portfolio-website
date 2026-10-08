// The car's look, built in code (Albuquerque's vehicles.js builds its cars
// the same way; a modelled one is Phase 4): a body and a cab in the
// palette's colours on the chassis, four wheels that hang on the springs and
// turn as his do (folio-2025's VisualVehicle.js; research note Part 1 §2):
// each wheel's height is min(−suspension, −0.5) eased at 25 a second, its
// spin forwardSpeed / radius, the front pair's steer eased at 16 a second.
// Wheels 0 and 1 are the front (+x), 0 and 2 the right (+z), as the
// controller's.
//
//   createBuggy({ palette: { body, cab, dark } }) → { group, wheels: Mesh[4],
//     update(vehicleState, steer −1…1, dt), dispose() }

import * as THREE from 'three';

const RADIUS = 0.4;
const OFFSET = [0.9, 0.75];
const STEERING = 0.5;

export function createBuggy({ palette = {} } = {}) {
  const body = new THREE.MeshLambertMaterial({ color: palette.body ?? 0xd8572a });
  const cab = new THREE.MeshLambertMaterial({ color: palette.cab ?? 0xf2e6c9 });
  const dark = new THREE.MeshLambertMaterial({ color: palette.dark ?? 0x2a2a2a });
  const group = new THREE.Group();
  group.name = 'buggy';
  const geometries = [];
  const box = (w, h, d, m, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  // the body on the mass box (2.6 × 0.8 × 1.7), the cab on the top box
  box(2.6, 0.6, 1.7, body, 0, -0.05, 0);
  box(1.0, 0.45, 1.3, cab, -0.1, 0.45, 0);
  box(0.3, 0.25, 1.75, dark, 1.25, -0.2, 0);
  const tyre = new THREE.CylinderGeometry(RADIUS, RADIUS, 0.3, 14);
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
    const tyreMesh = new THREE.Mesh(tyre, dark);
    tyreMesh.castShadow = true;
    pivot.add(tyreMesh);
    pivot.userData = { spin: 0, tyre: tyreMesh, front: i < 2 };
    group.add(pivot);
    return pivot;
  });
  let steering = 0;
  return {
    group,
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
      body.dispose();
      cab.dispose();
      dark.dispose();
    },
  };
}
