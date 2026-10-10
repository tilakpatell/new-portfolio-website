// The camera, Bruno Simon's (folio-2025's View.js; research note Part 1 §7
// and Part 3 §2): a narrow lens (FOV 25) on an orbit round the car, phi
// 0.31π (0.27π on a phone), theta π/4, 15 m out (24 on a narrow screen),
// pulled out to 1.4 times that with speed on high and ultra; the focus a
// magnet on the car, the camera eased to its orbit point at dt × 10, a
// damped roll spring kicked by impacts.
//
// And his "optimal area": the screen's four corners cast onto the ground
// with the camera at its furthest, a centre and a radius, worked out on
// resize (his orbit's furthest: 30 m, 1.4 times that on high); every layer that follows the view takes it (the grass's patch is
// twice the radius, the water, the leaves, the tracks' focus, the shadow
// camera ±radius) and the fog's near and far.
//
//   createChaseView({ camera, small = false, tier = 'high', radius = 15 (his
//     nearest; his orbit runs to 30) }) → { update(dt,
//     target: { x, y, z }, speed), area: { base: [x, z], centre: [x, z],
//     radius, near, far }, resize(w, h), shake(k), focus: Vector3, roll,
//     shift(sx, sz) }
//   optimalArea({ fov, aspect, phi, theta, radius }) → { base: [x, z],
//     radius, near, far } (pure; base from the focus)
//   chaseRadius(speed, { tier, aspect, base = 15 }) → metres (pure)

import * as THREE from 'three';

const FOV = 25;
const THETA = Math.PI / 4;
const RADIUS = 15;
const RADIUS_MAX = 30; // his orbit's furthest, which the area is worked out at
const NARROW = 9;
const SPEED_OUT = 0.4;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const pulls = (tier) => tier === 'high' || tier === 'ultra';

export function chaseRadius(speed, { tier = 'high', aspect = 16 / 9, base = RADIUS } = {}) {
  const r = base + (aspect < 1 ? NARROW : 0);
  return pulls(tier) ? r * (1 + SPEED_OUT * smoothstep(5, 40, speed)) : r;
}

export function optimalArea({ fov = FOV, aspect = 16 / 9, phi = 0.31 * Math.PI, theta = THETA, radius = RADIUS * 1.4 } = {}) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 10000);
  camera.position.setFromSphericalCoords(radius, phi, theta);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const hits = [];
  const dir = new THREE.Vector3();
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    dir.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    // (a corner above the horizon is held at a far reach along the ground)
    const t = dir.y < -1e-3 ? -camera.position.y / dir.y : radius * 4;
    hits.push(camera.position.clone().addScaledVector(dir, t).setY(0));
  }
  const base = hits.reduce((a, h) => a.add(h), new THREE.Vector3()).multiplyScalar(0.25);
  let r = 0;
  let near = Infinity;
  let far = 0;
  for (const h of hits) {
    r = Math.max(r, h.distanceTo(base));
    const d = h.distanceTo(camera.position);
    near = Math.min(near, d);
    far = Math.max(far, d);
  }
  return { base: [base.x, base.z], radius: r, near, far };
}

export function createChaseView({ camera, small = false, tier = 'high', radius = RADIUS } = {}) {
  camera.fov = FOV;
  camera.updateProjectionMatrix();
  const phi = (small ? 0.27 : 0.31) * Math.PI;
  const focus = new THREE.Vector3();
  const want = new THREE.Vector3();
  let started = false;
  let roll = 0;
  let spin = 0;
  const area = { base: [0, 0], centre: [0, 0], radius: 30, near: 20, far: 60 };
  const resize = () => {
    const aspect = camera.aspect;
    const a = optimalArea({ fov: FOV, aspect, phi, theta: THETA, radius: (RADIUS_MAX + (aspect < 1 ? NARROW : 0)) * (pulls(tier) ? 1 + SPEED_OUT : 1) });
    area.base = a.base;
    area.radius = a.radius;
    area.near = a.near;
    area.far = a.far;
  };
  resize();
  const view = {
    area,
    focus,
    get roll() {
      return roll;
    },
    resize(w, h) {
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
    },
    update(dt, target, speed = 0) {
      if (!started) {
        focus.set(target.x, target.y, target.z);
        started = true;
      }
      // the focus a magnet on the car
      focus.lerp(want.set(target.x, target.y, target.z), Math.min(1, dt * 60 * 0.25));
      const r = chaseRadius(speed, { tier, aspect: camera.aspect, base: radius });
      want.setFromSphericalCoords(r, phi, THETA).add(focus);
      camera.position.lerp(want, Math.min(1, dt * 10));
      camera.lookAt(focus);
      // his roll spring
      const v = -roll * 100 * dt;
      spin += v;
      roll += spin * dt;
      spin *= Math.max(0, 1 - 4 * dt);
      camera.rotateZ(roll);
      area.centre[0] = focus.x + area.base[0];
      area.centre[1] = focus.z + area.base[1];
    },
    shake(k = 1) {
      spin += k;
    },
    shift(sx, sz) {
      focus.x -= sx;
      focus.z -= sz;
      camera.position.x -= sx;
      camera.position.z -= sz;
      area.centre[0] -= sx;
      area.centre[1] -= sz;
    },
  };
  return view;
}
