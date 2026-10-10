// The Death Stars in the war (world.js, warpieces/endor.js): where each
// model's superlaser dish is, turning a station so its dish faces what it's
// to fire on, the beam it fires, and the ring of fire a station goes up in.
//
// DISH[kind] → { dir, out }: the dish's direction from the centre in the
//   model's own frame (measured off the GLBs) and how far out it sits, of
//   the radius (it's sunk into the hull).
// faceDish(kind, holder, target, out) → the quaternion (into `out`) that
//   turns `holder` so its dish points at `target`.
// dishAt(kind, holder, r, out) → where the dish is, with `holder` as it's
//   turned and `r` the station's radius.
// buildBeam() → { mesh, lay(from, to, width), hide(), dispose() }: a hot
//   core in a wider, dimmer sheath, the sheath under the bloom's knee so it
//   reads as the beam's glow, not a glare.
// createShockwave(parent) → { at(pos, r, normal?), update(dt), busy, dispose() }:
//   a flat ring running out from where a station went, fading as it goes.

import * as THREE from 'three';

const unit = (v) => {
  const l = Math.hypot(...v);
  return Object.freeze(v.map((x) => x / l));
};
export const DISH = Object.freeze({
  deathstar: Object.freeze({ dir: unit([0.004, 0.351, 0.936]), out: 0.96 }),
  deathstar2: Object.freeze({ dir: unit([-0.006, 0.6, 0.8]), out: 0.95 }),
});

const local = new THREE.Vector3();
const want = new THREE.Vector3();

export function faceDish(kind, holder, target, out = new THREE.Quaternion()) {
  local.fromArray(DISH[kind].dir);
  want.set(target.x - holder.position.x, target.y - holder.position.y, target.z - holder.position.z).normalize();
  return out.setFromUnitVectors(local, want);
}

export function dishAt(kind, holder, r, out = new THREE.Vector3()) {
  const d = DISH[kind];
  return out
    .fromArray(d.dir)
    .applyQuaternion(holder.quaternion)
    .multiplyScalar(r * d.out)
    .add(holder.position);
}

// the beam: unit long along +z, laid by scaling its length and looking down it
const BEAM = { core: [1.6, 4.2, 1.6], sheath: [0.3, 1.1, 0.35], wide: 3.2 };
export function buildBeam() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const mat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const coreMat = mat(BEAM.core);
  const sheathMat = mat(BEAM.sheath);
  const core = new THREE.Mesh(geo, coreMat);
  const sheath = new THREE.Mesh(geo, sheathMat);
  sheath.scale.set(BEAM.wide, BEAM.wide, 1);
  const mesh = new THREE.Group();
  mesh.add(core, sheath);
  mesh.visible = false;
  return {
    mesh,
    // from the dish to what it's on, `width` across its core
    lay(from, to, width = 1.4) {
      mesh.visible = true;
      mesh.position.copy(from);
      mesh.scale.set(width, width, Math.max(1e-3, from.distanceTo(to)));
      mesh.lookAt(to);
    },
    hide() {
      mesh.visible = false;
    },
    dispose() {
      geo.dispose();
      coreMat.dispose();
      sheathMat.dispose();
    },
  };
}

// the ring: out to WAVE.reach of the station's radius over WAVE.life seconds
const WAVE = { life: 6, reach: 7, colour: [2.4, 1.7, 1.0] };
const Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
export function createShockwave(parent) {
  const geo = new THREE.RingGeometry(0.88, 1, 96);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...WAVE.colour), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const ring = new THREE.Mesh(geo, mat);
  ring.visible = false;
  parent.add(ring);
  let age = WAVE.life;
  let r0 = 1;
  return {
    at(pos, r, normal = UP) {
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(Z, normal);
      r0 = r;
      age = 0;
      ring.visible = true;
    },
    update(dt) {
      if (age >= WAVE.life) return;
      age += dt;
      const k = Math.min(1, age / WAVE.life);
      // (quick at first, slowing as it goes out)
      ring.scale.setScalar(r0 * (0.6 + WAVE.reach * (1 - (1 - k) ** 3)));
      mat.opacity = (1 - k) ** 1.5;
      if (age >= WAVE.life) ring.visible = false;
    },
    get busy() {
      return age < WAVE.life;
    },
    dispose() {
      ring.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
