// A lightsaber in a figure's hand, down on a world: lit and put out, swung
// (three strokes that chain into a combo), held up to block, thrown and
// caught. The hilt is a gun kind (universe/gunplay.js's `saber`), so the
// same grip and arm that hold a blaster hold it, and the lit stance (held
// out in front, point up) is gunplay's aimed one; this poses the arm over
// that, after `gp.set`, for a stroke, the block and the throw, and reads
// saberRules.js for where a stroke is and what it reaches. Hits go back
// through `hit(target, damage)`; sounds through `sound(name)`.
//
//   createSaber(gp, { color, hilt, parent, sound }) →
//     { light(on), swing(now), block(on), throw(now, dir), update(dt, now,
//       { forward, up, me, targets, hit }), deflecting(from), lit, busy, dispose() }
//
// `me`: { x, z, yaw } (the figure's feet and facing); `targets`: activity.js's
// (each with a holder and a figure); `forward`, `up`: world directions.

import * as THREE from 'three';
import { frameFrom, reach, setWorldQuaternion } from '../../../lib/three/ik';
import { SABER, SWINGS, arcHit, deflects, nextSwing, swingPose, throwAt } from './saberRules';

const V = THREE.Vector3;
const _a = new V();
const _b = new V();
const _c = new V();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const LIGHT = 9; // how quick the blade comes out (per second)
const BLOCK = { yaw: 0.3, pitch: 0.85 }; // the raised blade: up and across to the left
const SWING_YAW = 0.55; // how far round the hand follows the blade's turn
const radiusOf = (t) => Math.max(0.45, (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1) * 0.35);

export function createSaber(gp, { color = '#4aa8ff', hilt = null, parent = null, sound = null } = {}) {
  const gun = gp.gun;
  const { RightArm: upper, RightForeArm: fore, RightHand: hand } = gp.bones;
  const blade = gun.getObjectByName('blade');
  const sleeve = gun.getObjectByName('sleeve');
  const local = { pos: gun.position.clone(), quat: gun.quaternion.clone(), scale: gun.scale.clone() }; // in the hand (attach() to the world rewrites all three)
  const gripInv = gun.quaternion.clone().invert();
  dress(gun, color, hilt);

  const st = {
    on: false,
    lit: 0,
    swing: null, // { i, t0, hits }
    last: null, // { i, endedAt }
    blocking: false,
    thrown: null, // { t0, from, dir, hits }
    me: null,
  };
  if (blade) {
    blade.visible = false;
    blade.scale.y = 0.001;
  }

  // the arm, over gunplay's pose: the blade along `yaw` round and `pitch`
  // up from the facing, the hand carried round with it
  const pose = (yaw, pitch, { forward, up }, w = 1) => {
    if (!upper || !fore || !hand) return;
    const right = _a.crossVectors(forward, up).normalize();
    const B = _b.copy(forward).applyAxisAngle(up, yaw);
    B.multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    upper.updateWorldMatrix(true, false);
    const S = upper.getWorldPosition(new V());
    const armLen = gp.armLen;
    const target = _c
      .copy(forward)
      .applyAxisAngle(up, yaw * SWING_YAW)
      .multiplyScalar(0.5 * armLen)
      .addScaledVector(up, (0.1 + 0.3 * pitch) * armLen)
      .addScaledVector(right, 0.15 * armLen)
      .add(S);
    const out = target.distanceTo(S);
    if (out > armLen * 0.95) target.sub(S).multiplyScalar((armLen * 0.95) / out).add(S);
    const pole = new V().addScaledVector(up, -0.6).addScaledVector(right, 0.7).addScaledVector(forward, -0.2).normalize();
    reach(upper, fore, hand, target, pole, w);
    // the hilt's "sights" (gun +z) wherever they land square to the blade
    const F = new V().copy(up).addScaledVector(B, -up.dot(B));
    if (F.lengthSq() < 0.01) F.copy(forward);
    frameFrom(F.normalize(), B, _q).multiply(gripInv);
    setWorldQuaternion(hand, _q, w);
    gun.updateWorldMatrix(true, true);
  };

  const fly = (dt, now, pose_, targets, hit) => {
    const th = st.thrown;
    const k = (now - th.t0) / SABER.throw.dur;
    if (k >= 1) {
      // caught
      hand.add(gun);
      gun.position.copy(local.pos);
      gun.quaternion.copy(local.quat);
      gun.scale.copy(local.scale);
      st.thrown = null;
      sound?.('catch');
      return;
    }
    const at = throwAt(k);
    gun.position.copy(th.from).addScaledVector(th.dir, at.d);
    gun.position.y += Math.sin(k * Math.PI) * 0.4; // (a little lift at the far end)
    // spinning flat, the blade a disc
    const spun = _a.copy(th.dir).applyAxisAngle(pose_.up, at.spin);
    frameFrom(pose_.up, spun, _q);
    gun.quaternion.copy(_q);
    gun.updateWorldMatrix(true, true);
    for (const t of targets) {
      if (th.hits.has(t)) continue;
      const p = t.holder.position;
      if (Math.hypot(p.x - gun.position.x, p.z - gun.position.z) < SABER.throw.radius + radiusOf(t) && Math.abs(p.y + 1 - gun.position.y) < 2.5) {
        th.hits.add(t);
        hit?.(t, SABER.throw.damage, gun.position);
      }
    }
    // the arm out after it, the hand open to take it back
    if (upper && fore && hand) {
      upper.updateWorldMatrix(true, false);
      const S = upper.getWorldPosition(new V());
      const target = _c.copy(th.dir).multiplyScalar(gp.armLen * 0.9).add(S);
      const right = _b.crossVectors(pose_.forward, pose_.up).normalize();
      const pole = new V().addScaledVector(pose_.up, -0.7).addScaledVector(right, 0.5).normalize();
      reach(upper, fore, hand, target, pole, 1);
      frameFrom(th.dir, pose_.up, _q2).multiply(gripInv);
      setWorldQuaternion(hand, _q2, 1);
    }
  };

  return {
    get lit() {
      return st.lit > 0.5;
    },
    get busy() {
      return Boolean(st.swing || st.thrown);
    },
    get thrown() {
      return Boolean(st.thrown);
    },
    light(on) {
      if (st.on === on) return;
      st.on = on;
      sound?.(on ? 'ignite' : 'off');
    },
    // a stroke: the next of the combo if the last just ended, else the first
    swing(now) {
      if (st.swing || st.thrown) return false;
      this.light(true);
      const i = nextSwing(st.last, now);
      st.swing = { i, t0: now, hits: new Set() };
      sound?.('swing');
      return true;
    },
    block(on) {
      if (on && !st.blocking) this.light(true);
      st.blocking = on;
    },
    throw(now, dir) {
      if (st.thrown || st.swing || !hand || gun.parent !== hand) return false;
      this.light(true);
      gun.updateWorldMatrix(true, false);
      const from = gun.getWorldPosition(new V());
      const flat = new V(dir.x, 0, dir.z);
      if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
      (parent ?? gun.parent.parent).attach(gun);
      st.thrown = { t0: now, from, dir: flat.normalize(), hits: new Set() };
      st.swing = null;
      sound?.('throw');
      return true;
    },
    // whether a bolt from `from` ([x, y, z]) would meet the raised blade
    deflecting(from) {
      return st.blocking && st.lit > 0.5 && st.me ? deflects(st.me, from, SABER.block.cone) : false;
    },
    // after gp.set: the blade's length, the arm's pose, the throw's flight
    update(dt, now, p) {
      st.me = p.me ?? st.me;
      const want = st.on ? 1 : 0;
      st.lit += Math.sign(want - st.lit) * Math.min(Math.abs(want - st.lit), dt * LIGHT);
      if (blade) {
        blade.visible = st.lit > 0.01;
        blade.scale.y = Math.max(0.001, st.lit);
        if (sleeve) sleeve.material.opacity = 0.5 + 0.12 * Math.sin(now * 37) + 0.05 * Math.sin(now * 61);
      }
      if (st.thrown) {
        fly(dt, now, p, p.targets ?? [], p.hit);
        return;
      }
      if (st.swing) {
        const s = SWINGS[st.swing.i];
        const k = (now - st.swing.t0) / s.dur;
        if (k >= 1) {
          st.last = { i: st.swing.i, endedAt: now };
          st.swing = null;
        } else {
          const { yaw, pitch } = swingPose(st.swing.i, k);
          pose(yaw, pitch, p, 1);
          // the blade through them, round the middle of the stroke
          if (p.me && k > s.lead - 0.18 && k < s.lead + 0.22)
            for (const t of p.targets ?? []) {
              if (st.swing.hits.has(t)) continue;
              const q = t.holder.position;
              if (arcHit(p.me, { x: q.x, z: q.z, r: radiusOf(t) }, SABER.reach, SABER.half)) {
                st.swing.hits.add(t);
                p.hit?.(t, SABER.damage, _a.set(q.x, q.y + 1.1, q.z));
              }
            }
          return;
        }
      }
      if (st.blocking && st.lit > 0.05) pose(BLOCK.yaw, BLOCK.pitch, p, Math.min(1, st.lit * 2));
    },
    dispose() {
      if (st.thrown && hand) {
        hand.add(gun);
        gun.position.copy(local.pos);
        gun.quaternion.copy(local.quat);
        gun.scale.copy(local.scale);
      }
    },
  };
}

// the blade's colour and the hilt's look, on the built hilt
export function dress(gun, color, hilt) {
  const sleeve = gun.getObjectByName('sleeve');
  if (sleeve) sleeve.material.color.set(color);
  if (!hilt) return;
  gun.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'grip' || o.name === 'metal' || o.name.startsWith('emitter')) o.material.color.set(hilt.metal);
    if (o.name === 'trim') o.material.color.set(hilt.trim);
    if (o.name.startsWith('emitter-')) o.visible = o.name === `emitter-${hilt.emitter}`;
  });
  // a curved hilt: the pommel's end bent back for the wrist
  const bend = hilt.grip === 'curved' ? 0.3 : 0;
  const stretch = (hilt.length ?? 0.28) - 0.28;
  gun.children.forEach((o) => {
    if (o.name === 'trim' && o.position.y < -0.08) {
      o.rotation.z = bend;
      o.position.x = bend * 0.03;
      o.position.y = Math.min(o.position.y, o.position.y - stretch);
    }
  });
}
