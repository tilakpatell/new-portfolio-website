// A lightsaber in a figure's hand, down on a world: lit and put out, swung
// in a stance's strokes that chain into a combo, a charged heavy stroke,
// held up to block, thrown and caught. The hilt is a gun kind
// (universe/gunplay.js's `saber`), so the same grip and arm that hold a
// blaster hold it; this poses the arms over gunplay's, after `gp.set`:
// lit, at guard, the hilt low before the belly in both hands (the other
// hand below the first, as Luke holds it), the blade up and ahead; the
// strokes swing the hilt round the chest and turn the body into them. It
// reads combatRules.js for the stances, where a stroke is and what it
// reaches. A double blade lights out of the pommel too; dual wield puts a
// second hilt in the other hand, held at a mirrored guard. The blade leaves a trail through a
// stroke. Hits go back through `hit(target, damage, at, { heavy })`;
// sounds through `sound(name)`.
//
//   createSaber(gp, { color, hilt, stance, parent, sound }) →
//     { light(on), swing(now, { heavy }), block(on), throw(now, dir),
//       update(dt, now, { forward, up, me, targets, hit }), deflecting(from),
//       lit, busy, swinging, thrown, charge (0…1 while F is held), setCharge(k), dispose() }

import * as THREE from 'three';
import { frameFrom, reach, setWorldQuaternion } from '../../../lib/three/ik';
import { HEAVY, arcHit, nextSwing, stanceOf, swingPose } from './combatRules';
import { SABER, deflects, throwAt } from './saberRules';

const V = THREE.Vector3;
const _a = new V();
const _b = new V();
const _c = new V();
const _d = new V();
const _e = new V();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const LIGHT = 9; // how quick the blade comes out (per second)
const BLOCK = { yaw: 0.3, pitch: 0.85 }; // the raised blade: up and across to the left
const SWING_YAW = 0.55; // how far round the hand follows the blade's turn
// in both hands: the hilt this far out before the chest (arm lengths), up
// or down from the shoulders with the blade's pitch (low + rise × pitch,
// kept between low[1] and high), a little right, and round with the blade
const TWO = { fwd: 0.68, low: [-0.3, -0.8], rise: 0.5, high: 0.4, side: 0.05, swing: 0.55, twist: 0.45 };
const LEFT_DOWN = 0.09; // metres down the hilt from the first hand's middle to the second's
// lit, between strokes: the hilt low before the belly, the blade up and
// ahead, a little across (a dual wielder's first hilt out to the right)
const GUARD = { yaw: 0.12, pitch: 1.0, at: { fwd: 0.48, up: -0.58, side: 0.05 } };
const GUARD_DUAL = { yaw: -0.3, pitch: 0.7, at: { fwd: 0.45, up: -0.7, side: 0.38 } };
const TRAIL = 14; // segments of the trail behind the blade
const radiusOf = (t) => Math.max(0.45, (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1) * 0.35);

export function createSaber(gp, { color = '#4aa8ff', hilt = null, stance = 'single', parent = null, sound = null } = {}) {
  const gun = gp.gun;
  const { RightArm: upper, RightForeArm: fore, RightHand: hand, LeftArm: leftUpper, LeftHand: leftHand } = gp.bones;
  const blade = gun.getObjectByName('blade');
  const sleeve = gun.getObjectByName('sleeve');
  const core = gun.getObjectByName('core');
  const local = { pos: gun.position.clone(), quat: gun.quaternion.clone(), scale: gun.scale.clone() }; // in the hand (attach() to the world rewrites all three)
  const gripInv = gun.quaternion.clone().invert();
  const st_ = stanceOf(stance);
  const two = stance !== 'dual' && Boolean(gp.holdLeft && leftUpper && leftHand); // (both hands on the one hilt)
  dress(gun, color, hilt);
  // the second blade: out of the pommel (a staff), or a second hilt in the other hand
  const blades = [blade].filter(Boolean);
  const extra = [];
  if (blade && stance === 'double') {
    const b2 = blade.clone(true);
    b2.name = 'blade2';
    b2.rotation.z = Math.PI;
    b2.position.y = -0.16;
    gun.add(b2);
    blades.push(b2);
    extra.push(b2);
  }
  let gun2 = null;
  if (blade && stance === 'dual' && leftHand) {
    gun2 = gun.clone(true);
    gun2.name = 'gun:saber:left';
    // (a left hand is the right's mirror: the hilt's turn mirrored with it)
    gun2.position.set(-local.pos.x, local.pos.y, local.pos.z);
    gun2.quaternion.set(local.quat.x, -local.quat.y, -local.quat.z, local.quat.w);
    gun2.scale.copy(local.scale);
    leftHand.add(gun2);
    const b2 = gun2.getObjectByName('blade');
    if (b2) blades.push(b2);
  }
  // the trail: a ribbon from the hilt to the tip over the last few frames
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL * 2 * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trailIdx = [];
  for (let i = 0; i < TRAIL - 1; i++) trailIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  trailGeo.setIndex(trailIdx);
  const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.frustumCulled = false;
  trail.visible = false;
  (parent ?? gun.parent?.parent)?.add(trail);
  const trailPts = []; // [{ a: V, b: V }] newest first

  const st = {
    on: false,
    lit: 0,
    swing: null, // { i, t0, hits, heavy, dur, lead, damage }
    last: null, // { i, endedAt }
    blocking: false,
    thrown: null, // { t0, from, dir, hits }
    me: null,
    charge: 0,
  };
  for (const b of blades) {
    b.visible = false;
    b.scale.y = 0.001;
  }

  // the arm, over gunplay's pose: the blade along `yaw` round and `pitch`
  // up from the facing, the hand carried round with it. Held in both hands
  // (any stance but dual), the hilt goes before the chest, swung round it,
  // and the other hand closes on the hilt below the first; held in one,
  // it's out from the shoulder. `at` puts the hilt somewhere of its own
  // instead: { fwd, up, side } from the middle of the shoulders, in arm
  // lengths (the guard's).
  const pose = (yaw, pitch, { forward, up }, w = 1, at = null) => {
    if (!upper || !fore || !hand) return;
    const right = _a.crossVectors(forward, up).normalize();
    const B = _b.copy(forward).applyAxisAngle(up, yaw);
    B.multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    upper.updateWorldMatrix(true, false);
    const S = upper.getWorldPosition(new V());
    const armLen = gp.armLen;
    const target = _c;
    if (two || at) {
      const C = (leftUpper ?? upper).getWorldPosition(new V()).add(S).multiplyScalar(0.5);
      const o = at ?? { fwd: TWO.fwd, up: Math.max(TWO.low[1], Math.min(TWO.high, TWO.low[0] + TWO.rise * pitch)), side: TWO.side };
      target
        .copy(forward)
        .applyAxisAngle(up, at ? 0 : yaw * TWO.swing)
        .multiplyScalar(o.fwd * armLen)
        .addScaledVector(up, o.up * armLen)
        .addScaledVector(right, o.side * armLen)
        .add(C);
    } else
      target
        .copy(forward)
        .applyAxisAngle(up, yaw * SWING_YAW)
        .multiplyScalar(0.5 * armLen)
        .addScaledVector(up, (0.1 + 0.3 * pitch) * armLen)
        .addScaledVector(right, 0.15 * armLen)
        .add(S);
    // the hilt's "sights" (gun +z, where the fingers run) square to the
    // blade on the side away from up: the palm in toward the body, the
    // knuckles ahead, as a hand closes on a hilt
    const F = new V().copy(up).negate().addScaledVector(B, up.dot(B));
    if (F.lengthSq() < 0.01) F.copy(forward);
    frameFrom(F.normalize(), B, _q).multiply(gripInv);
    // (the target's for the hilt in the fist: the wrist goes back from it
    // by where the hilt sits in the hand, turned as the hand will be)
    if (two || at) target.sub(_d.copy(local.pos).multiplyScalar(hand.getWorldScale(_e).x).applyQuaternion(_q));
    const out = target.distanceTo(S);
    if (out > armLen * 0.95) target.sub(S).multiplyScalar((armLen * 0.95) / out).add(S);
    const pole = new V().addScaledVector(up, -0.6).addScaledVector(right, 0.7).addScaledVector(forward, -0.2).normalize();
    reach(upper, fore, hand, target, pole, w);
    setWorldQuaternion(hand, _q, w);
    gun.updateWorldMatrix(true, true);
    if (two) {
      // the other hand under it, the palms facing across the hilt
      const anchor = _d.set(0, -LEFT_DOWN, 0).applyMatrix4(gun.matrixWorld);
      const fingers = new V(0, 0, 1).transformDirection(gun.matrixWorld);
      const axis = new V(0, 1, 0).transformDirection(gun.matrixWorld);
      const poleL = new V().addScaledVector(up, -1).addScaledVector(right, -0.6).addScaledVector(forward, -0.15).normalize();
      gp.holdLeft(anchor, fingers, axis, poleL, w);
    }
  };

  // dual: the second hilt in the other hand, held as the first is at
  // guard but mirrored (out to the left, the blade up and ahead), whatever
  // the first is doing
  const leftFore = gp.bones.LeftForeArm;
  const gun2Inv = gun2 ? gun2.quaternion.clone().invert() : null;
  const poseLeft = ({ forward, up }, w) => {
    if (!gun2 || !leftUpper || !leftFore || gun2.parent !== leftHand || w <= 0) return;
    const g = GUARD_DUAL;
    const right = _a.crossVectors(forward, up).normalize();
    const B = _b.copy(forward).applyAxisAngle(up, -g.yaw);
    B.multiplyScalar(Math.cos(g.pitch)).addScaledVector(up, Math.sin(g.pitch)).normalize();
    upper.updateWorldMatrix(true, false);
    const SL = leftUpper.getWorldPosition(new V());
    const C = upper.getWorldPosition(new V()).add(SL).multiplyScalar(0.5);
    const armLen = gp.armLen;
    const F = new V().copy(up).negate().addScaledVector(B, up.dot(B));
    if (F.lengthSq() < 0.01) F.copy(forward);
    frameFrom(F.normalize(), B, _q).multiply(gun2Inv);
    const target = _c
      .copy(forward)
      .multiplyScalar(g.at.fwd * armLen)
      .addScaledVector(up, g.at.up * armLen)
      .addScaledVector(right, -g.at.side * armLen)
      .add(C)
      .sub(_d.copy(gun2.position).multiplyScalar(leftHand.getWorldScale(_e).x).applyQuaternion(_q));
    const out = target.distanceTo(SL);
    if (out > armLen * 0.95) target.sub(SL).multiplyScalar((armLen * 0.95) / out).add(SL);
    const pole = new V().addScaledVector(up, -0.6).addScaledVector(right, -0.7).addScaledVector(forward, -0.2).normalize();
    reach(leftUpper, leftFore, leftHand, target, pole, w);
    setWorldQuaternion(leftHand, _q, w);
    gun2.updateWorldMatrix(true, true);
    gp.holdLeft(null, null, null, null, w); // (its fingers closed on it)
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
        hit?.(t, SABER.throw.damage, gun.position, { thrown: true });
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

  // the trail behind the main blade: this frame's hilt-to-tip line at the
  // front, the older ones fading behind it
  const tipA = new V();
  const tipB = new V();
  const stepTrail = (swinging) => {
    if (!blade) return;
    if (swinging && st.lit > 0.5) {
      blade.updateWorldMatrix(true, false);
      tipA.set(0, 0.1, 0).applyMatrix4(blade.matrixWorld);
      tipB.set(0, 1, 0).applyMatrix4(blade.matrixWorld);
      trailPts.unshift({ a: tipA.clone(), b: tipB.clone() });
      if (trailPts.length > TRAIL) trailPts.length = TRAIL;
    } else if (trailPts.length) trailPts.pop(); // (gone in a few frames once the stroke's over)
    trail.visible = trailPts.length > 1;
    if (!trail.visible) return;
    for (let i = 0; i < TRAIL; i++) {
      const p = trailPts[Math.min(i, trailPts.length - 1)];
      trailPos.set([p.a.x, p.a.y, p.a.z, p.b.x, p.b.y, p.b.z], i * 6);
    }
    trailGeo.attributes.position.needsUpdate = true;
  };

  return {
    stance: st_,
    get lit() {
      return st.lit > 0.5;
    },
    get busy() {
      return Boolean(st.swing || st.thrown);
    },
    get swinging() {
      return st.swing;
    },
    get thrown() {
      return Boolean(st.thrown);
    },
    get charge() {
      return st.charge;
    },
    setCharge(k) {
      st.charge = Math.max(0, Math.min(1, k));
    },
    light(on) {
      if (st.on === on) return;
      st.on = on;
      sound?.(on ? 'ignite' : 'off');
    },
    // a stroke: the next of the combo if the last just ended, else the
    // first; or the heavy one, charged
    swing(now, { heavy = false } = {}) {
      if (st.swing || st.thrown) return null;
      this.light(true);
      if (heavy) {
        st.swing = { i: -1, t0: now, hits: new Set(), heavy: true, dur: HEAVY.dur, lead: HEAVY.lead, damage: HEAVY.damage };
        sound?.('heavy');
      } else {
        const i = nextSwing(st_, st.last, now, SABER.combo);
        const sw = st_.swings[i];
        st.swing = { i, t0: now, hits: new Set(), heavy: false, dur: sw.dur, lead: sw.lead, damage: sw.damage };
        sound?.('swing');
      }
      st.charge = 0;
      return st.swing;
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
      return st.blocking && st.lit > 0.5 && st.me ? deflects(st.me, from, SABER.block.cone * (st_.block > 1 ? 1.2 : 1)) : false;
    },
    // after gp.set: the blade's length, the arm's pose, the throw's flight
    update(dt, now, p) {
      st.me = p.me ?? st.me;
      const want = st.on ? 1 : 0;
      st.lit += Math.sign(want - st.lit) * Math.min(Math.abs(want - st.lit), dt * LIGHT);
      const flicker = 0.5 + 0.12 * Math.sin(now * 37) + 0.05 * Math.sin(now * 61);
      for (const b of blades) {
        b.visible = st.lit > 0.01;
        b.scale.y = Math.max(0.001, st.lit);
      }
      if (sleeve) sleeve.material.opacity = flicker + st.charge * 0.35;
      if (core) core.scale.set(1 + st.charge * 0.6, 1, 1 + st.charge * 0.6);
      gp.twist?.(0); // (the chest square again unless a stroke turns it, below)
      if (st.lit > 0.05) poseLeft(p, Math.min(1, st.lit * 2));
      if (st.thrown) {
        fly(dt, now, p, p.targets ?? [], p.hit);
        stepTrail(false);
        return;
      }
      if (st.swing) {
        const sw = st.swing;
        const k = (now - sw.t0) / sw.dur;
        if (k >= 1) {
          if (!sw.heavy) st.last = { i: sw.i, endedAt: now };
          st.swing = null;
        } else {
          const { yaw, pitch } = sw.heavy ? heavyPose(k) : swingPose(st_, sw.i, k);
          pose(yaw, pitch, p, 1);
          gp.twist?.(yaw * TWO.twist); // (the body into it: the chest turns with the blade, from the next frame)
          // the blade through them, round the middle of the stroke
          if (p.me && k > sw.lead - 0.18 && k < sw.lead + 0.22)
            for (const t of p.targets ?? []) {
              if (sw.hits.has(t)) continue;
              const q = t.holder.position;
              if (arcHit(p.me, { x: q.x, z: q.z, r: radiusOf(t) }, st_.reach * (sw.heavy ? 1.1 : 1), st_.half)) {
                sw.hits.add(t);
                p.hit?.(t, sw.damage, _a.set(q.x, q.y + 1.1, q.z), { heavy: sw.heavy });
              }
            }
          stepTrail(true);
          return;
        }
      }
      stepTrail(false);
      if (st.charge > 0.05) pose(0.3, 1.3, p, Math.min(1, st.charge * 3)); // (wound up overhead while F is held)
      else if (st.blocking && st.lit > 0.05) pose(BLOCK.yaw, BLOCK.pitch, p, Math.min(1, st.lit * 2));
      else if (st.lit > 0.05) {
        const g = two ? GUARD : GUARD_DUAL;
        pose(g.yaw, g.pitch, p, Math.min(1, st.lit * 2), g.at);
      }
    },
    dispose() {
      if (st.thrown && hand) {
        hand.add(gun);
        gun.position.copy(local.pos);
        gun.quaternion.copy(local.quat);
        gun.scale.copy(local.scale);
      }
      for (const b of extra) b.removeFromParent();
      gun2?.removeFromParent();
      trail.removeFromParent();
      trailGeo.dispose();
      trailMat.dispose();
    },
  };
}

const easeH = (k) => k * k * (3 - 2 * k);
// the heavy stroke: wound up high and brought straight down, slow at the top
function heavyPose(k) {
  const e = easeH(Math.max(0, Math.min(1, (k - 0.25) / 0.75)));
  return { yaw: HEAVY.yaw[0] * (1 - e) + HEAVY.yaw[1] * e, pitch: HEAVY.pitch[0] * (1 - e) + HEAVY.pitch[1] * e };
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
