// A Lambda shuttle on a bay’s deck, wings folded up as she stands after
// landing: the model (plan.js’ LAMBDA) fitted to the prop furnish puts
// down for her, with her own copies of its materials to take the bay’s
// reflection; her ramp down from under her cockpit to the station’s ramp
// spot; and the landing pad painted round her with lights let into it.
//
//   standLambda(prop, renderer) → Promise<{ holder, dispose() } | null>   null when the model can’t load
//   rampParts(kit, ramp) → parts   from plan.js’ rampFor
//   padParts(kit, prop, paint) → parts   the pad’s outline and lights, flush with the deck

import * as THREE from 'three';
import { loadGltf } from '../../../../../../lib/three/gltf';
import { LAMBDA, fitModel } from './plan';

export async function standLambda(prop, renderer) {
  const got = await loadGltf(LAMBDA.url, { renderer, fresh: true });
  if (!got) return null;
  const model = got.scene;
  const box = new THREE.Box3().setFromObject(model);
  const fit = fitModel(prop, box);
  const mats = new Map();
  model.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (!mats.has(o.material)) {
      const m = o.material.clone();
      m.userData.reflect = true;
      mats.set(o.material, m);
    }
    o.material = mats.get(o.material);
  });
  model.position.set(fit.offset.x, fit.offset.y, fit.offset.z);
  const holder = new THREE.Group();
  holder.name = 'lambda';
  holder.add(model);
  holder.position.set(fit.at.x, fit.at.y, fit.at.z);
  holder.rotation.y = fit.turn;
  holder.scale.setScalar(fit.scale);
  holder.updateMatrixWorld(true);
  return {
    holder,
    dispose() {
      holder.removeFromParent();
      for (const m of mats.values()) m.dispose();
    },
  };
}

// The ramp: one sloped plate from the hatch to the deck, ribbed across,
// skirts down its sides with lights along their foot, and two rams up
// into her belly.
export function rampParts(kit, ramp, { width = 2.6 } = {}) {
  const len = Math.hypot(ramp.foot.x - ramp.top.x, ramp.foot.z - ramp.top.z);
  // in the ramp’s own frame: z from the hatch (0) to the foot (len), x across, y up from the deck
  const slope = Math.atan2(ramp.rise, len);
  const local = [];
  const plate = new THREE.BoxGeometry(width, 0.1, Math.hypot(len, ramp.rise)).rotateX(slope).translate(0, ramp.rise / 2 - 0.02, len / 2);
  local.push({ geo: plate, mat: 'trim' });
  for (let t = 0.35; t < len - 0.2; t += 0.45) {
    const y = ramp.rise * (1 - t / len);
    local.push(kit.box(width - 0.2, 0.03, 0.05, 0, y + 0.04, t, 'black'));
  }
  for (const s of [-1, 1]) {
    const skirt = new THREE.BoxGeometry(0.08, 0.4, Math.hypot(len, ramp.rise)).rotateX(slope).translate(s * (width / 2 + 0.04), ramp.rise / 2 - 0.12, len / 2);
    local.push({ geo: skirt, mat: 'trim' });
    for (let t = 0.6; t < len; t += 0.9) local.push(kit.box(0.05, 0.05, 0.12, s * (width / 2 + 0.09), ramp.rise * (1 - t / len) - 0.22, t, 'strip'));
    local.push(kit.beam({ x: s * width * 0.32, y: ramp.rise * 0.45, z: len * 0.45 }, { x: s * width * 0.32, y: ramp.rise + 0.9, z: -0.3 }, 0.14, 0.14, 'rail'));
  }
  // facing down the ramp: from the top towards the foot
  const turn = Math.atan2(ramp.foot.x - ramp.top.x, ramp.foot.z - ramp.top.z);
  return kit.place(local, kit.at(ramp.top.x, 0, ramp.top.z, turn));
}

// The pad: a pale outline a metre out from her footprint (her wings
// folded), lights let in every two metres along it, and a stripe from her
// nose out along her heading for the pilots to line up on.
export function padParts(kit, prop, paint, { pad = 1.2, line = 0.16 } = {}) {
  const [w, d] = [LAMBDA.wide * prop.d + 2 * pad, prop.d + 2 * pad];
  const local = [];
  for (const [pw, pd, x, z] of [[w, line, 0, -d / 2], [w, line, 0, d / 2], [line, d, -w / 2, 0], [line, d, w / 2, 0]]) local.push(kit.plate(pw, pd, x, 0.004, z, paint, 'up'));
  for (const s of [-1, 1]) {
    for (let z = -d / 2 + 1; z < d / 2; z += 2) local.push(kit.plate(0.22, 0.22, s * (w / 2 + 0.35), 0.006, z, 'strip', 'up'));
  }
  for (let z = -d / 2 - 1.5; z > -d / 2 - 9; z -= 2.5) local.push(kit.plate(line * 1.5, 1.5, 0, 0.004, z, paint, 'up'));
  // (built facing −z, her yaw 0)
  return kit.place(local, kit.at(prop.x, prop.y, prop.z, -prop.yaw));
}
