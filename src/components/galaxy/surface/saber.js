// A lightsaber in a figure's hand, down on a world: lit and put out, swung
// in a stance's strokes that chain into a combo, a charged heavy stroke,
// held up to block, thrown and caught. The hilt is a gun kind
// (universe/gunplay.js's `saber`), so the same grip and arm that hold a
// blaster hold it; at guard this poses the arms over gunplay's, after
// `gp.set`: lit, the hilt low before the belly in both hands (the other
// hand below the first, as Luke holds it), the blade up and ahead. A double
// blade lights out of the pommel too; dual wield puts a second hilt in the
// other hand, held at a mirrored guard.
//
// A stroke is a clip: one of UAL2's sword clips (combatRules.js's stance
// table, strokeFor), played full-body on the figure's animator (`fig.play`)
// for the legs and the hips, and its arms and chest laid here over
// gunplay's from the same clip at the same time, so the blade goes where
// the clip swings it. The clip's root travel (its extras, baked by
// scripts/ual-bake.mjs) steps the figure (`me`), scaled to land the stroke
// on the one it's locked on and capped at the stance's lunge; the figure
// turns to the lock over the wind-up (the first 40% of the clip), eased;
// inside the clip's contact window the sword arm is turned toward the
// lock's chest (or a chest a stroke's length ahead, with no lock), by at
// most 0.25 rad, so a clip made on a mannequin connects with a Wookiee. What the stroke hits is the blade: its segment swept
// between frames (lib/combat/blade.js) against each target's capsule,
// inside the contact window, once a stroke a target. The trail is drawn
// from the same frames (lib/three/combat/trail.js). Hits go back through
// `hit(target, damage, at, { heavy })`, `at` on the blade; sounds through
// `sound(name)`. The block lays the block clip's arms the same way, held
// up across, and shows for the parry window however short the press; a
// bolt whose flown segment passes through the held blade is turned
// (`guard`, for lib/combat/bolt.js's step), one beside it isn't.
//
//   createSaber(gp, { color, hilt, stance, parent, sound, fig, clips }) →
//     { light(on), swing(now, { heavy, dir, lock, lunge, clip }), cancel(), block(on), throw(now, dir),
//       stand(dt, now, move), update(dt, now, { forward, up, me, targets, hit }),
//       guard(id, side) (the raised blade for the bolts' step, and what
//       meets a duellist's contact: { id, base, tip, r, side } | null), lit, busy, swinging (the stroke: { name (the
//       clip's), clip, t0, speed, contact, damage, heavy, … } or null), thrown, charge (0…1 while F is
//       held), setCharge(k), blades (lib/combat/blade.js's, the main first),
//       dispose() }
//   fig: the figure that holds it ({ bones, hipsY?, play? }); without
//   `play` the arms still swing (laid here) but the legs keep their clips.
//   clips: { name: clip } to use in place of the library's (tests); a
//   2017 figure (fig.rig 'walrus') brings its own, the game's, in fig.clips;
//   a stroke whose clip hasn't come yet is timed as one and swings nothing.
//   lock: a target (as `targets` hold them: { holder, fig?, spec? }); lunge:
//   the stance's lunge times this (a perk's); clip: a sword clip's name to
//   play in place of the one strokeFor picks (a peer's, as their packet says).

import * as THREE from 'three';
import { createBlade } from '../../../lib/combat/blade';
import { hiltFit } from '../../../lib/combat/hiltFit';
import { SOCKETS } from '../../../lib/three/walrusRig.js';
import { loadClip } from '../../../lib/three/clipLibrary';
import { createTrail } from '../../../lib/three/combat/trail';
import { frameFrom, reach, rotateWorld, setWorldQuaternion } from '../../../lib/three/ik';
import { capsuleOf } from './blaster';
import { BLOCK_CLIP, DIRS, HEAVY, PARRY, STRIKE, rootScale, stanceOf, strokeFor } from './combatRules';
import { SABER, throwAt } from './saberRules';
import { modelUrlFor } from './catalog';
import { loadGlb } from './placer';

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
const TRAIL = 8; // frames of the trail behind the blade (and the blade's memory of them)
const radiusOf = (t) => Math.max(0.45, (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1) * 0.35);
// what a stroke lays from its clip over gunplay's arms: the chest and both
// arms, by Meshy's spine names and the 2017 game's (Spine1, Spine2, Neck:
// lib/three/walrusRig.js), whichever the figure has
export const ARMS = ['Spine02', 'Spine01', 'Spine2', 'Spine1', 'Neck', 'Spine', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
const TURN = 0.4; // of the clip, the figure turning to the lock
const CORRECT = 0.25; // radians the sword arm may be turned toward the lock in the contact window
const IN = 0.08; // seconds a stroke's arms take to come on over the guard
const OUT = 0.15; // and to go at its end
const CANCEL = 0.05; // seconds after the contact window ends that the next stroke may cut in
const BLOCK_AT = 0.32; // of the block clip, where it's held: the blade up across
const DEFLECT_R = 0.3; // how near the held blade a bolt turns off it (m): its streak is a hand across, and a block should read as covering
const NO_CLIP = { duration: 0.6, contact: [0.2, 0.4] }; // (a stroke whose clip hasn't come: timed as one)
const ease = (k) => k * k * (3 - 2 * k);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// a clip's root travel at time t (metres, the figure's own +x and +z), between the baked rows
const rootAt = (root, t) => {
  if (!root?.length) return [0, 0];
  if (t <= root[0][0]) return [root[0][1], root[0][2]];
  for (let i = 1; i < root.length; i++)
    if (root[i][0] >= t) {
      const [ta, xa, za] = root[i - 1];
      const [tb, xb, zb] = root[i];
      const k = (t - ta) / Math.max(1e-6, tb - ta);
      return [xa + (xb - xa) * k, za + (zb - za) * k];
    }
  const l = root[root.length - 1];
  return [l[1], l[2]];
};

export function createSaber(gp, { color = '#4aa8ff', hilt = null, stance = 'single', parent = null, sound = null, fig = null, clips: given = null } = {}) {
  const gun = gp.gun;
  const { RightArm: upper, RightForeArm: fore, RightHand: hand, LeftArm: leftUpper, LeftHand: leftHand } = gp.bones;
  const blade = gun.getObjectByName('blade');
  const sleeve = gun.getObjectByName('sleeve');
  const core = gun.getObjectByName('core');
  const local = { pos: gun.position.clone(), quat: gun.quaternion.clone(), scale: gun.scale.clone() }; // in the hand (attach() to the world rewrites all three)
  const gripInv = gun.quaternion.clone().invert();
  const st_ = stanceOf(stance);
  // A 2017 figure (lib/three/walrus.js) holds it in the game's weapon
  // socket, and the game's clips swing the socket and put both hands on it:
  // nothing here poses its arms. A stroke or the block lays the socket with
  // the arms, so the hilt goes where the clip takes it; the turn toward the
  // lock goes on the chest, which carries both. (One hilt: the game's
  // heroes don't dual-wield.)
  const walrus = fig?.rig === 'walrus' && Boolean(gp.socket);
  const holder = gun.parent; // (the hand, or the socket)
  const two = !walrus && stance !== 'dual' && Boolean(gp.holdLeft && leftUpper && leftHand); // (both hands on the one hilt)
  const torso = gp.bones.Spine2 ?? gp.bones.Spine02 ?? upper;
  dress(gun, color, hilt);
  // the game's hilt (heroes.js's HILTS `model`, a 2017 kind) in place of the
  // built one: modelled up +y about its grip, so it goes in unturned, scaled
  // to the hilt's length (hiltFit), and the blade comes out at its top (a
  // staff's second out of its bottom). Until it comes, or if it doesn't, the
  // built one stands in, dressed.
  let gone = false;
  const worn = [];
  // (a 2017 figure's alone: a Meshy hand is made for the built hilt's grip)
  if (walrus && hilt?.model)
    loadGlb(modelUrlFor(hilt.model, 'high')).then((gltf) => {
      if (!gltf || gone) return;
      const m = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(m);
      const fit = hiltFit({ min: box.min.toArray(), max: box.max.toArray() }, hilt.modelLength ?? hilt.length ?? 0.28);
      m.scale.setScalar(fit.scale);
      m.name = 'hilt-model';
      for (const o of [...gun.children]) if (o.isMesh && (o.name === 'grip' || o.name === 'metal' || o.name === 'trim' || o.name.startsWith('emitter'))) o.visible = false;
      gun.add(m);
      worn.push(m);
      if (blade) blade.position.y = fit.bladeY;
      const b2 = gun.getObjectByName('blade2');
      if (b2) b2.position.y = box.min.y * fit.scale;
    });
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
  if (blade && stance === 'dual' && leftHand && !walrus) {
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
  // each blade's segment, frame by frame (what its strokes hit), and its trail from them
  const segs = blades.map(() => createBlade({ keep: TRAIL }));
  const trails = blades.map(() => createTrail(parent ?? gun.parent?.parent, { color, length: TRAIL }));
  // the clips: the stance's, the heavy ones, the ways and the block, fetched now so the first stroke has its own
  // (a 2017 figure's are the game's, its pack's: never the library's, made for Meshy's rig)
  const own = given ?? (fig?.rig === 'walrus' ? fig.clips : null);
  const clips = { ...(own ?? {}) };
  const names = [...st_.strokes.map((k) => k.clip), ...HEAVY.clips, ...Object.values(DIRS).map((d) => d.clip), BLOCK_CLIP];
  if (!own)
    for (const n of new Set(names))
      loadClip(n).then((c) => {
        if (c && !gone) clips[n] = c;
      });
  // each clip's arms on this figure, to sample by hand (a 2017 figure's
  // weapon socket too, turned and moved: the clip carries the hilt in it)
  const armsOf = new Map();
  const socketBone = walrus ? gp.socket : null;
  const partsOf = (clip) => {
    if (!armsOf.has(clip))
      armsOf.set(
        clip,
        clip.tracks
          .map((tr) => {
            const i = tr.name.lastIndexOf('.');
            const name = tr.name.slice(0, i);
            const path = tr.name.slice(i + 1);
            if (socketBone && name === SOCKETS.weapon && (path === 'quaternion' || path === 'position')) return { bone: socketBone, path, at: tr.createInterpolant() };
            const bone = path === 'quaternion' && ARMS.includes(name) ? (fig?.bones?.[name] ?? gp.bones[name] ?? null) : null;
            return bone && { bone, path, at: tr.createInterpolant() };
          })
          .filter(Boolean),
      );
    return armsOf.get(clip);
  };
  const lay = (clip, t, w) => {
    if (!clip || w <= 1e-3) return;
    for (const p of partsOf(clip)) {
      const v = p.at.evaluate(t);
      if (p.path === 'position') p.bone.position.lerp(_e.set(v[0], v[1], v[2]), Math.min(1, w));
      else p.bone.quaternion.slerp(_q.set(v[0], v[1], v[2], v[3]), Math.min(1, w));
    }
  };
  // the figure's hips over its toes in metres, against the clip's (for the root's travel)
  const hipsM = (() => {
    const h = fig?.bones?.Hips ?? gp.bones.Hips;
    if (!h?.parent) return 0.92;
    h.parent.updateWorldMatrix(true, false);
    return (fig?.hipsY ?? h.position.y) * h.parent.getWorldScale(_e).y;
  })();

  const st = {
    on: false,
    lit: 0,
    swing: null, // the stroke: strokeFor's, with { t0, dur, contact, root, rootHips, clip, hits, lock, yaw0, scale, was }
    last: null, // the stroke before, with its endedAt
    move: 0, // how much the figure's going (stand's): moving, the legs keep walking under a stroke
    blockW: 0, // the block clip's arms, coming on and going
    blockFrom: null, // when the block last went up (a tap still shows it for the parry window)
    now: 0, // the last frame's time
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
      holder.add(gun);
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

  // the block up: held, or tapped within the parry window
  const blockShown = () => st.blocking || (st.blockFrom != null && st.now - st.blockFrom < PARRY.window);
  // each blade's segment this frame, from the hilt to the tip
  const _base = new V();
  const _tip = new V();
  const pushBlades = (now) => {
    blades.forEach((b, i) => {
      b.updateWorldMatrix(true, false);
      _base.set(0, 0.1, 0).applyMatrix4(b.matrixWorld);
      _tip.set(0, 1, 0).applyMatrix4(b.matrixWorld);
      segs[i].push(_base.toArray(), _tip.toArray(), now);
    });
  };
  const drawTrails = (on) => trails.forEach((tr, i) => tr.sync(segs[i].history(), on && st.lit > 0.5));

  // a stroke a frame on: the turn to the lock, the root's step, the clip's
  // arms over gunplay's, the arm's correction, the blade through them
  const _hit = new V();
  const stroke = (dt, now, p) => {
    const sw = st.swing;
    const t = Math.min(sw.dur, (now - sw.t0) * sw.speed);
    const me = p.me;
    // (the lock's feet and chest, if it's still standing)
    const lock = sw.lock && !sw.lock.down && sw.lock.holder ? sw.lock.holder.position : null;
    if (me && lock && t < sw.dur * TURN) {
      const want = Math.atan2(lock.x - me.x, lock.z - me.z);
      sw.yaw0 ??= me.yaw;
      me.yaw = sw.yaw0 + wrap(want - sw.yaw0) * ease(Math.min(1, t / (sw.dur * TURN)));
    }
    if (me && sw.walk) {
      const [x, z] = rootAt(sw.root, t);
      // (the step grown or cut up to the blade's landing; after it, the clip's own)
      const k = (t <= sw.contact[1] ? sw.scale : Math.min(1, sw.scale)) * (hipsM / (sw.rootHips || hipsM));
      const lx = (x - sw.was[0]) * k;
      const lz = (z - sw.was[1]) * k;
      sw.was = [x, z];
      // (the figure's own +x is its left, +z ahead, turned by its yaw)
      me.x += Math.cos(me.yaw) * lx + Math.sin(me.yaw) * lz;
      me.z += -Math.sin(me.yaw) * lx + Math.cos(me.yaw) * lz;
    }
    // the clip's arms, eased on over the guard and off at the end
    const w = Math.min(1, (now - sw.t0) / IN, (sw.dur - t) / (sw.speed * OUT) + 0.0001);
    lay(sw.clip, t, w);
    const [c0, c1] = sw.contact;
    const inside = t >= c0 && t <= c1;
    // in the window, the sword arm a little toward the lock's chest (with
    // no lock, toward where a chest would be a stroke's length ahead)
    // (a 2017 figure's chest, which turns the hilt in its socket with the arms)
    const turner = walrus ? torso : upper;
    if (inside && turner && blade && me) {
      // (eased in and out over the window's first and last 30 ms: the cut is often near its end)
      const env = Math.min(1, (t - c0) / 0.03, (c1 - t) / 0.03);
      turner.updateWorldMatrix(true, false);
      const S = turner.getWorldPosition(_a);
      blade.updateWorldMatrix(true, false);
      const mid = _b.set(0, 0.55, 0).applyMatrix4(blade.matrixWorld).sub(S);
      const tall = lock ? (sw.lock.fig?.tall ?? 1.6) * (sw.lock.spec?.scale ?? 1) : hipsM / 0.53;
      const at = lock ?? _e.set(me.x + Math.sin(me.yaw) * STRIKE, S.y - tall * 0.8, me.z + Math.cos(me.yaw) * STRIKE);
      const chest = _c.set(at.x, at.y + tall * 0.65, at.z).sub(S);
      const ang = mid.angleTo(chest);
      if (ang > 1e-3) rotateWorld(turner, _d.crossVectors(mid, chest).normalize(), Math.min(ang, CORRECT) * env);
    }
    pushBlades(now);
    if (inside && st.lit > 0.5) {
      const caps = (p.targets ?? []).filter((x) => !sw.hits.has(x) && x.holder).map((x) => ({ ...capsuleOf(x), ref: x })); // (a body as the bolts see it: blaster.js's)
      for (const seg of segs)
        for (const h of seg.sweep(caps)) {
          if (sw.hits.has(h.target.ref)) continue;
          sw.hits.add(h.target.ref);
          p.hit?.(h.target.ref, sw.damage, _hit.fromArray(h.at), { heavy: sw.heavy });
        }
    }
    drawTrails(true);
    if (t >= sw.dur) {
      st.last = { ...sw, endedAt: now };
      st.swing = null;
    }
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
    blades: segs,
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
    // a stroke: a way held, the heavy one, else the next of the combo
    // (strokeFor); one under way may be cut once its blade's passed
    swing(now, { heavy = false, dir = null, lock = null, lunge = 1, clip: named = null } = {}) {
      if (st.thrown) return null;
      const cur = st.swing;
      if (cur && (now - cur.t0) * cur.speed < cur.contact[1] + CANCEL) return null;
      if (cur) st.last = { ...cur, endedAt: now };
      this.light(true);
      const k = strokeFor(st_, { last: st.last, now, dir, heavy, combo: SABER.combo });
      // (one named outright, as a peer's packet names theirs: that clip, fetched if it hasn't been)
      if (named && named !== k.clip) {
        k.clip = named;
        if (!clips[named] && !given) loadClip(named).then((c) => c && !gone && (clips[named] = c));
      }
      const clip = clips[k.clip] ?? null;
      const x = clip?.userData ?? {};
      const dur = clip?.duration ?? NO_CLIP.duration;
      const root = x.root ?? null;
      // the step: the clip's own to its contact, grown or cut to land on the lock
      const at = lock?.holder?.position;
      const me = st.me;
      const ahead = rootAt(root, (x.contact ?? NO_CLIP.contact)[1])[1] * (hipsM / (x.rootHips || hipsM));
      const dist = at && me ? Math.hypot(at.x - me.x, at.z - me.z) : null;
      st.swing = {
        ...k,
        name: k.clip, // (the clip library's name: what goes out online)
        t0: now,
        dur,
        contact: x.contact ?? NO_CLIP.contact,
        root,
        rootHips: x.rootHips ?? null,
        clip,
        hits: new Set(),
        lock: lock ?? null,
        yaw0: null,
        scale: rootScale(ahead, dist, k.lunge * lunge),
        was: [0, 0],
        // (moving, the legs keep walking and the walk does the stepping)
        walk: st.move < 0.3,
      };
      if (st.swing.walk) fig?.play?.(k.clip, { layer: 'full', speed: k.speed, fade: 0.08 });
      // (the blade's memory starts with the stroke: its sweep and its trail are this stroke's)
      for (const seg of segs) seg.clear();
      sound?.(k.heavy ? 'heavy' : 'swing');
      st.charge = 0;
      return st.swing;
    },
    // a stroke dropped where it is, its clip let go: a duellist whose mark is
    // gone (duel.js, Review Focus 5), or you, parried
    cancel() {
      const sw = st.swing;
      if (!sw) return;
      st.last = { ...sw, endedAt: st.now };
      st.swing = null;
      if (sw.walk) fig?.stop?.(0.2, 'full');
    },
    block(on) {
      if (on && !st.blocking) {
        this.light(true);
        st.blockFrom = st.now;
      }
      st.blocking = on;
    },
    // the raised blade as the bolts see it (lib/combat/bolt.js's `blades`):
    // the main blade's segment this frame while the block shows, a little
    // wider than the blade, else null
    guard(id = 'you', side = 'you') {
      if (!blockShown() || st.lit <= 0.5 || st.swing || st.thrown) return null;
      const f = segs[0]?.history().at(-1);
      return f ? { id, base: f.base, tip: f.tip, r: DEFLECT_R, side } : null;
    },
    throw(now, dir) {
      if (st.thrown || st.swing || !holder || gun.parent !== holder) return false;
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
    // after the figure's clips, before what poses over them: how much it's
    // going (0…1, as the figure's update has it), for the next stroke
    stand(dt, now, move = 0) {
      st.move = move;
    },
    // after gp.set: the blade's length, the arm's pose, the throw's flight
    update(dt, now, p) {
      st.me = p.me ?? st.me;
      st.now = now;
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
        drawTrails(false);
        return;
      }
      if (st.swing) {
        stroke(dt, now, p);
        return;
      }
      // between strokes: the guard, the block, or the heavy one winding up
      const block = clips[BLOCK_CLIP];
      const up = blockShown() && st.lit > 0.05;
      st.blockW = Math.max(0, Math.min(1, st.blockW + (up ? dt : -dt) * 8));
      const guardW = Math.min(1, st.lit * 2);
      // (the game's clips hold a 2017 figure's guard: none of these)
      if (!walrus && st.charge > 0.05) pose(0.3, 1.3, p, Math.min(1, st.charge * 3)); // (wound up overhead while F is held)
      else if (!walrus && up && !block) pose(BLOCK.yaw, BLOCK.pitch, p, guardW);
      else if (!walrus && st.lit > 0.05) {
        const g = two ? GUARD : GUARD_DUAL;
        pose(g.yaw, g.pitch, p, guardW, g.at);
      }
      if (block) lay(block, block.duration * BLOCK_AT, st.blockW * Math.min(1, st.lit * 2));
      pushBlades(now);
      drawTrails(false);
    },
    dispose() {
      gone = true;
      if (st.thrown && holder) {
        holder.add(gun);
        gun.position.copy(local.pos);
        gun.quaternion.copy(local.quat);
        gun.scale.copy(local.scale);
      }
      for (const b of extra) b.removeFromParent();
      for (const m of worn) m.removeFromParent();
      gun2?.removeFromParent();
      for (const tr of trails) tr.dispose();
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
