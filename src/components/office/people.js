// The Scranton branch's people, as the show dresses them: Michael's charcoal
// suit and light blue shirt, Dwight's mustard short sleeves, tie and glasses,
// Jim's rolled sleeves and loose tie, Pam's pink cardigan, Angela's blonde
// bun, Stanley's moustache and reading glasses, Kevin's size...
//
// The figures were modelled for the site with Meshy (scripts/meshy.mjs: a
// concept image of each, a textured model from it, a skeleton), one skinned
// mesh a person in public/models/office/cast/, standing with the arms out.
// Each is posed by turning its bones: sitting at a desk, standing, or in a
// wheelchair. The head looks round, at the camera or at the bin, nods and
// shakes; the hands type, wave, cheer, shrug, fold and reach for things.
//
// Anyone else (Albuquerque's people) comes as a spec of their own figure on
// the same skeleton: { id, model (its .glb), height }.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Who is in, and how tall (metres, the actor's).
export const CAST = {
  michael: { height: 1.75 },
  dwight: { height: 1.88 },
  jim: { height: 1.91 },
  pam: { height: 1.63 },
  andy: { height: 1.83 },
  phyllis: { height: 1.6 },
  stanley: { height: 1.8 },
  erin: { height: 1.65 },
  kevin: { height: 1.75 },
  angela: { height: 1.55 },
  oscar: { height: 1.73 },
  creed: { height: 1.78 },
  meredith: { height: 1.65 },
  darryl: { height: 1.85 },
  ryan: { height: 1.76 },
  toby: { height: 1.78 },
  kelly: { height: 1.6 },
};

// A spec: someone from elsewhere, with their own figure.
export const isSpec = (s) => !!s && typeof s === 'object' && typeof s.id === 'string' && typeof s.model === 'string' && s.model.endsWith('.glb') && typeof s.height === 'number';

const SEAT = 0.46; // the top of the chair's seat (kit.chair)
const KEYS = 0.805; // how high the hands are, on the keys of a desk
const EDGE = 0.2; // the desk's edge, this side of the keys' middle
const BIG = 1.06; // their size, over the actor's: the heads are drawn large
const SLOPE = 0.26; // how steeply the thighs may fall to the knees
const BENT = 0.9; // how much of the arms' length the hands are from the shoulders
const LEAN = [0.16, 0.1, 0.06]; // how far the belly, chest and head lean in to the desk
const DOWN = LEAN[0] + LEAN[1] + LEAN[2];
// what they can do, and for how long (seconds)
const LASTS = { nod: 0.9, shake: 1, shrug: 1.2, fold: 1.6, cheer: 1.6, wave: 1.6 };
export const GESTURES = Object.keys(LASTS);
const PALM = 1.4; // how far the wrists turn, for the palms to lie on the keys
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const IDENTITY = new THREE.Quaternion();

// Turn a bone about an axis of the figure's own frame (x its left, y up, z
// forward), whatever the bone's own axes are. `frame` is the figure's world
// rotation.
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qc = new THREE.Quaternion();
const va = new THREE.Vector3();
function turn(bone, axis, angle, frame) {
  if (!bone || !angle) return;
  va.copy(axis).applyQuaternion(frame);
  bone.getWorldQuaternion(qa);
  qb.setFromAxisAngle(va, angle).multiply(qa);
  bone.parent.getWorldQuaternion(qc);
  bone.quaternion.copy(qc.invert().multiply(qb));
  bone.updateMatrixWorld(true);
}

// Set a bone's world rotation.
function setWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(qc);
  bone.quaternion.copy(qc.invert().multiply(q));
  bone.updateMatrixWorld(true);
}
// Turn a bone (in the world) to lie along `dir`. The rig's bones run along
// their own +y.
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
function aim(bone, dir) {
  bone.getWorldQuaternion(qa);
  vc.copy(AY).applyQuaternion(qa);
  qb.setFromUnitVectors(vc, vb.copy(dir).normalize());
  setWorldQuat(bone, qb.multiply(qa));
}
// Two bones, upper and lower, reaching for a point (world): the joint
// between them bends toward `pole`.
const vd = new THREE.Vector3();
const ve = new THREE.Vector3();
function reach(upper, lower, end, target, pole) {
  const s = upper.getWorldPosition(new THREE.Vector3());
  const a = s.distanceTo(lower.getWorldPosition(vd));
  const b = vd.distanceTo(end.getWorldPosition(ve));
  const to = target.clone().sub(s);
  const d = THREE.MathUtils.clamp(to.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  to.normalize();
  // the elbow: along the reach by the law of cosines, out toward the pole
  const along = (a * a - b * b + d * d) / (2 * d);
  const up = Math.sqrt(Math.max(0, a * a - along * along));
  const side = pole.clone().sub(to.clone().multiplyScalar(pole.dot(to))).normalize();
  const elbow = s.clone().add(to.clone().multiplyScalar(along)).add(side.multiplyScalar(up));
  aim(upper, elbow.clone().sub(s));
  aim(lower, s.add(to.multiplyScalar(d)).sub(elbow));
}

// ── The cast ───────────────────────────────────────────────────────────────
// Loads the people asked for (everyone in the office, unless told who): office
// ids, or specs. Resolves, once all have come, to { person(who, opts),
// dispose }; `person` gives null for anyone whose model can't be had, and the
// scene goes on without them. `each(id, cast)`, if given, hears of each as
// their model comes (cast.person(who) can be had from then), so a scene
// needn't wait for everyone.
export async function loadPeople(ids = Object.keys(CAST), each) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const models = new Map(); // id -> their model
  const skeletons = []; // each figure's own, to dispose
  // A person (an office id or a spec), facing +z. Returns { group, id,
  // look(target | null), gesture(name), cheer(), wave(), reach(side, point),
  // headAt(), update(t, dt) }, where update says whether they are still
  // moving. `pose`: 'sit' (the chair's seat `seat` under them, leaning in to
  // the desk), 'stand', or 'wheelchair' (sitting up, hands on the armrests).
  // `typing`: the hands go on the keys, which are `keys` ahead of the chair's
  // middle; `idle`: the head looks round now and then.
  const person = (who, { pose = 'sit', seat = SEAT, shadows = true, typing = false, idle = false, keys = 0.45 } = {}) => {
    const spec = isSpec(who) ? who : CAST[who];
    const id = isSpec(who) ? who.id : who;
    const model = models.get(id);
    if (!spec || !model) return null;
    // their own copy of the skeleton, sharing the model's mesh and texture
    const rig = cloneRig(model.scene);
    let body = null;
    rig.traverse((o) => {
      if (o.isSkinnedMesh) body = o;
    });
    if (!body) return null;
    body.castShadow = shadows;
    body.frustumCulled = false; // its bounds move with its bones
    skeletons.push(body.skeleton);
    const bone = (n) => rig.getObjectByName(n);
    const pair = (n) => [bone(`Left${n}`), bone(`Right${n}`)];
    // (Meshy numbers the spine from the top: Spine is the chest, Spine02 the belly)
    const B = { abdomen: bone('Spine02'), torso: bone('Spine01'), chest: bone('Spine'), neck: bone('neck'), head: bone('Head'), thigh: pair('UpLeg'), shin: pair('Leg'), foot: pair('Foot'), shoulder: pair('Shoulder'), arm: pair('Arm'), fore: pair('ForeArm'), wrist: pair('Hand') };
    const root = new THREE.Group();
    root.add(rig);
    const settle = () => {
      rig.updateMatrixWorld(true);
      body.skeleton.update();
    };

    // ── their size: the actor's height, and a little over, for a head drawn
    // large (so the body is the size the chairs and desks are made for);
    // the soles on the floor ──
    settle();
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    const count = body.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) box.expandByPoint(body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld));
    // (the office's heads are drawn large; anyone else is the height they are)
    const scale = (spec.height * (isSpec(who) ? 1 : BIG)) / Math.max(0.5, box.max.y - box.min.y);
    rig.scale.multiplyScalar(scale);
    rig.position.y = -box.min.y * scale;
    settle();
    // how far their middle (hips to chest) comes forward of the hip joints
    const pos = (o) => o.getWorldPosition(new THREE.Vector3());
    const waist = pos(B.thigh[0]);
    const chestY = pos(B.chest).y;
    let belly = 0;
    for (let i = 0; i < count; i += 2) {
      body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld);
      if (v.y > waist.y && v.y < chestY) belly = Math.max(belly, v.z - waist.z);
    }

    // ── the pose ──
    // Posed at the origin facing +z, so the world is the figure's own frame.
    const sides = B.arm.map((b, s) => Math.sign(pos(b).x) || (s ? -1 : 1));
    // shoulder to wrist
    const reachOf = B.arm.map((b, s) => pos(b).distanceTo(pos(B.fore[s])) + pos(B.fore[s]).distanceTo(pos(B.wrist[s])));
    // palms down, on the keys or the armrests (the turn shared between the
    // forearm and the wrist)
    const palmsDown = () => {
      for (let s = 0; s < 2; s++) {
        const along = pos(B.wrist[s]).sub(pos(B.fore[s])).normalize();
        turn(B.fore[s], along, (sides[s] * PALM) / 2, IDENTITY);
        turn(B.wrist[s], along, (sides[s] * PALM) / 2, IDENTITY);
        turn(B.wrist[s], AX, 0.15, IDENTITY);
      }
    };
    if (pose === 'stand') {
      // on their feet as they were modelled; the arms down by the sides, the
      // elbows a little back
      for (let s = 0; s < 2; s++) {
        const shoulder = pos(B.arm[s]);
        reach(B.arm[s], B.fore[s], B.wrist[s], shoulder.add(new THREE.Vector3(sides[s] * 0.07, -reachOf[s] * 0.96, 0.03)), new THREE.Vector3(sides[s] * 0.2, 0, -1));
      }
      settle();
    } else {
      // ── sitting ──
      const thighLen = B.thigh.map((b, s) => pos(b).distanceTo(pos(B.shin[s])));
      const shinLen = B.shin.map((b, s) => pos(b).distanceTo(pos(B.foot[s])));
      const footLen = B.foot.map((b) => pos(b).distanceTo(pos(b.children[0] ?? b)) * 1.4);
      const ankle = B.foot.map((b) => pos(b).y); // how high the ankles are, standing
      const feetRest = B.foot.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
      // thighs a little apart, sloping down to knees no higher than the shins
      // are long (the figures' legs are short for the chair)
      const hipY = seat + 0.085; // the hip joints: a thigh's half-depth above the seat
      for (let s = 0; s < 2; s++) {
        const fall = THREE.MathUtils.clamp((hipY - shinLen[s] * 0.97 - ankle[s]) / thighLen[s], 0.06, SLOPE);
        aim(B.thigh[s], va.set(Math.sign(pos(B.thigh[s]).x) * 0.08, -fall, Math.sqrt(1 - fall * fall)));
      }
      settle();
      // the hips onto the seat, just back from its middle
      const hip = pos(B.thigh[0]);
      rig.position.y += hipY - hip.y;
      rig.position.z += -0.05 - hip.z;
      settle();
      // the shins down to the floor, the feet a little ahead of the knees and
      // flat; on their toes, if the floor is further than the shins reach
      for (let s = 0; s < 2; s++) {
        const knee = pos(B.shin[s]);
        const len = shinLen[s];
        const room = knee.y - ankle[s];
        const drop = Math.min(len * 0.97, room);
        aim(B.shin[s], va.set(0, -drop, Math.max(len * 0.24, Math.sqrt(Math.max(0, len * len - drop * drop)))));
        setWorldQuat(B.foot[s], feetRest[s]);
        const short = pos(B.foot[s]).y - ankle[s];
        if (short > 0.005) turn(B.foot[s], AX, Math.min(0.7, Math.asin(Math.min(1, short / footLen[s]))), IDENTITY);
      }
      if (pose === 'wheelchair') {
        // sitting up, the hands on the armrests
        settle();
        for (let s = 0; s < 2; s++) reach(B.arm[s], B.fore[s], B.wrist[s], new THREE.Vector3(sides[s] * 0.24, seat + 0.2, 0.05), new THREE.Vector3(sides[s] * 0.6, -1, -0.6));
        palmsDown();
        settle();
      } else {
        // leaning in to the desk, the head down at the screen
        turn(B.abdomen, AX, LEAN[0], IDENTITY);
        turn(B.chest, AX, LEAN[1], IDENTITY);
        turn(B.head, AX, LEAN[2], IDENTITY);
        settle();
        // sat forward as far as bends the elbows over the keys, short of putting
        // their middle through the desk's edge
        const hands = sides.map((side) => new THREE.Vector3(side * 0.14, KEYS, keys));
        let forward = 0;
        for (let s = 0; s < 2; s++) {
          const sh = pos(B.arm[s]);
          const arm = sh.distanceTo(pos(B.fore[s])) + pos(B.fore[s]).distanceTo(pos(B.wrist[s]));
          const across = Math.hypot(hands[s].x - sh.x, hands[s].y - sh.y);
          forward = Math.max(forward, hands[s].z - sh.z - Math.sqrt(Math.max(0, (arm * BENT) ** 2 - across * across)));
        }
        rig.position.z += THREE.MathUtils.clamp(Math.min(forward, keys - EDGE - belly + 0.05), 0, 0.16);
        settle();
        // the hands onto the keys: elbows down by the sides, palms down
        for (let s = 0; s < 2; s++) reach(B.arm[s], B.fore[s], B.wrist[s], hands[s], new THREE.Vector3(sides[s] * 0.6, -1, -0.6));
        palmsDown();
        settle();
      }
    }
    // how far the pose already looks down
    const down = pose === 'sit' ? DOWN : 0;
    // the pose, to come back to every frame
    const bones = body.skeleton.bones;
    const rest = bones.map((b) => b.quaternion.clone());
    const reset = () => bones.forEach((b, i) => b.quaternion.copy(rest[i]));

    // a hand raised from where it is to a point (figure's frame, from the
    // shoulder), by `p` of the way, the elbow toward `pole` (x out to its side)
    const right = sides.indexOf(-1) < 0 ? 1 : sides.indexOf(-1);
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const raise = (s, offset, p, frame, pole = [1, -0.7, -0.3]) => {
      B.wrist[s].getWorldPosition(from);
      B.arm[s].getWorldPosition(to).add(offset.applyQuaternion(frame));
      reach(B.arm[s], B.fore[s], B.wrist[s], from.lerp(to, p), va.set(sides[s] * pole[0], pole[1], pole[2]).applyQuaternion(frame));
    };
    const ELBOWS_OUT = [1, -0.25, 0.1];
    const ELBOWS_IN = [0.35, -1, -0.3];
    const ease = (x) => x * x * (3 - 2 * x);
    const offset = new THREE.Vector3();

    const state = {
      look: null,
      lookAt: new THREE.Vector3(),
      amt: 0,
      yaw: 0,
      pitch: 0,
      gesture: null, // { name, t }
      hands: [0, 1].map(() => ({ to: null, at: new THREE.Vector3(), amt: 0 })), // reaching for
      seed: Math.random() * 100,
    };
    const tmp = new THREE.Vector3();
    const frame = new THREE.Quaternion();
    const inv = new THREE.Quaternion();
    const headAt = new THREE.Vector3();
    const gesture = (name) => {
      // one at a time; asked again while it's going, it goes on
      if (LASTS[name] && state.gesture?.name !== name) state.gesture = { name, t: 0 };
    };
    return {
      group: root,
      id,
      // look at a world position, or (null) back to the desk
      look(target) {
        state.look = target ? state.lookAt.copy(target) : null;
      },
      gesture,
      cheer: () => gesture('cheer'),
      wave: () => gesture('wave'),
      // a hand ('left' or 'right') reaching for a world position, or (null)
      // back to the pose
      reach(side, point) {
        const h = state.hands[side === 'right' ? right : 1 - right];
        h.to = point ? h.at.copy(point) : null;
      },
      // where their head is (world)
      headAt(out = new THREE.Vector3()) {
        return B.head.getWorldPosition(out);
      },
      update(t, dt = 1 / 60) {
        reset();
        let moving = false;
        root.getWorldQuaternion(frame);
        // the hands on what they're reaching for, easing there and back
        for (let s = 0; s < 2; s++) {
          const h = state.hands[s];
          const amt = h.to ? Math.min(1, h.amt + dt * 4) : Math.max(0, h.amt - dt * 4);
          if (amt !== h.amt) moving = true;
          h.amt = amt;
          if (!amt) continue;
          B.wrist[s].getWorldPosition(from);
          reach(B.arm[s], B.fore[s], B.wrist[s], from.lerp(h.at, ease(amt)), va.set(sides[s] * 0.6, -1, -0.5).applyQuaternion(frame));
        }
        // the head's part in a gesture, on top of where it looks
        let nod = 0;
        let shake = 0;
        let tilt = 0;
        const g = state.gesture;
        if (g) {
          const T = LASTS[g.name];
          const p = ease(Math.min(1, g.t / 0.3, Math.max(0, T - g.t) / 0.35)); // in, held, out
          const env = Math.sin((Math.PI * Math.min(g.t, T)) / T);
          if (g.name === 'cheer') {
            // both fists up over the head, pumping
            const pump = Math.sin(g.t * 14) * 0.05;
            for (let s = 0; s < 2; s++) raise(s, offset.set(sides[s] * 0.12, 0.5 + pump, 0.06), p, frame);
          } else if (g.name === 'wave') {
            // the right hand up by the head, side to side
            raise(right, offset.set(-0.26 + Math.sin(g.t * 13) * 0.06, 0.2, 0.14), p, frame);
          } else if (g.name === 'fold') {
            // the arms across the chest, one over the other
            for (let s = 0; s < 2; s++) {
              raise(s, offset.set(-sides[s] * 0.52, -0.33 - s * 0.08, 0.3 + s * 0.04).multiplyScalar(reachOf[s]), p, frame, ELBOWS_OUT);
              turn(B.wrist[s], AY, -sides[s] * 1.1 * p, frame); // the hands tucked round the arms
            }
          } else if (g.name === 'shrug') {
            // the shoulders up, the elbows in, the hands out, palms up, the
            // head on one side
            for (let s = 0; s < 2; s++) turn(B.shoulder[s], AZ, sides[s] * 0.2 * p, frame);
            for (let s = 0; s < 2; s++) {
              raise(s, offset.set(sides[s] * 0.3, -0.4, 0.47).multiplyScalar(reachOf[s]), p, frame, ELBOWS_IN);
              turn(B.wrist[s], pos(B.wrist[s]).sub(pos(B.fore[s])).normalize(), -sides[s] * 1.3 * p, frame);
            }
            tilt = 0.12 * p;
          } else if (g.name === 'nod') {
            nod = 0.36 * (1 - Math.cos((4 * Math.PI * g.t) / T)) * 0.5 * env; // down and up, twice
          } else if (g.name === 'shake') {
            shake = 0.5 * Math.sin((5 * Math.PI * g.t) / T) * env;
          }
          g.t += dt;
          if (g.t > T) state.gesture = null;
          moving = true;
        } else if (typing) {
          for (let s = 0; s < 2; s++) turn(B.wrist[s], AX, Math.max(0, Math.sin(t * 10 + s * 2.1 + state.seed)) * 0.2, frame);
          turn(B.chest, AX, Math.sin(t * 1.6 + state.seed) * 0.012, frame); // breathing
        } else if (idle && pose !== 'sit') {
          turn(B.chest, AX, Math.sin(t * 1.6 + state.seed) * 0.012, frame); // breathing
        }
        // the head: down at the screen, a look round, or at what it's asked to
        let yaw = idle ? Math.sin(t * 0.31 + state.seed) * 0.3 + Math.sin(t * 0.13 + state.seed * 2) * 0.18 : 0;
        let pitch = idle ? Math.sin(t * 0.21 + state.seed) * 0.05 : 0;
        if (state.look) {
          B.head.getWorldPosition(headAt);
          tmp.copy(state.look).sub(headAt).applyQuaternion(inv.copy(frame).invert());
          state.amt = Math.min(1, state.amt + dt * 3);
          yaw = THREE.MathUtils.lerp(yaw, THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.25, 1.25), state.amt);
          // less what the pose already looks down
          pitch = THREE.MathUtils.lerp(pitch, THREE.MathUtils.clamp(-Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)) - down, -0.8, 0.4), state.amt);
        } else state.amt = Math.max(0, state.amt - dt * 2);
        const follow = Math.min(1, dt * 6);
        state.yaw += (yaw - state.yaw) * follow;
        state.pitch += (pitch - state.pitch) * follow;
        turn(B.neck, AY, state.yaw * 0.4, frame);
        turn(B.head, AY, state.yaw * 0.6 + shake, frame);
        turn(B.head, AX, state.pitch + nod, frame);
        turn(B.head, AZ, tilt, frame);
        if (Math.abs(yaw - state.yaw) > 0.003 || Math.abs(pitch - state.pitch) > 0.003) moving = true;
        return moving;
      },
    };
  };

  const cast = {
    person,
    dispose() {
      for (const sk of skeletons) sk.dispose();
      for (const m of models.values())
        m.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          o.material.map?.dispose();
          o.material.dispose();
        });
    },
  };
  await Promise.all(
    ids.map((who) => {
      const id = isSpec(who) ? who.id : who;
      return loader.loadAsync(isSpec(who) ? who.model : `/models/office/cast/${id}.glb`).then(
        (m) => {
          // No mipmaps: a figure's texture is an atlas of small islands packed
          // edge to edge, and a mip level mixes each island's rim with its
          // neighbour's colour (light seams down a dark suit).
          m.scene.traverse((o) => {
            if (!o.isMesh || !o.material.map) return;
            o.material.map.minFilter = THREE.LinearFilter;
            o.material.map.generateMipmaps = false;
          });
          models.set(id, m);
          each?.(id, cast);
        },
        () => {},
      );
    }),
  );
  return cast;
}
