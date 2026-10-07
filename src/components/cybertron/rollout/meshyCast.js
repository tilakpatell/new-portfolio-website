// Roll out's cast as modelled for the site with Meshy (scripts/meshy.mjs,
// the rollout set): Optimus, Bumblebee and the Vehicons each twice, as the
// vehicle and as the robot, the jets, Shockwave and Megatron. What's there is
// listed in /games/meshy/rollout/index.json; anything missing or failing
// stays as the shapes in ./models.js. The files come through ../meshy.js,
// which the transformation showcase shares, so each is fetched once.
//
// Characters come out of Meshy facing +Z (its rigging needs them to); a
// vehicle or a jet is turned so its long side runs along the road, nose
// first unless index.json says otherwise: an entry can be { "name": …,
// "yaw": 180 } (degrees) for one that came out backwards.
//
// A cast here has the same face as one from ./models.js ({ group, rig, eye,
// mats, … }), so RollOut3D draws either the same way. The rig's animate(k,
// phase, roll, amount, motion) changes form by dissolving one model into the
// other along an energon-lit edge. A rigged robot stands on an animator
// (lib/three/animator.js): its own idle, walk and run paced to the ground it
// covers (motion: { dt, move, speed, side, air, turn }, metres a second; its
// strides measured off the clips, so the feet don't slide, and walking
// backward or sideways with the hips turned to it), tucked in the air rather
// than running on nothing, and the clip library's one-shots over it through
// rig.play(name, opts) (a shot, a hit, a fall, a taunt, a cheer); its head
// through rig.look(point); a boss's cannon arm up at you through
// rig.aim(weight, point). Without motion (or an animator), the clip is held
// where the phase says, as it always was.

import * as THREE from 'three';
import { createAnimator } from '../../../lib/three/animator';
import { aimBone } from '../../../lib/three/ik';
import { hashSeed } from '../game/bodies';
import { castCopy, castModel, ownClips, rigOf } from '../meshy';

const BASE = '/games/meshy/rollout';
const TAU = Math.PI * 2;
const RIGGED = new Set(['optimus', 'bumblebee', 'vehicon', 'shockwave', 'megatron']);

// The two forms, and how big each stands in the game (metres): `len` along
// the road for vehicles and jets, `h` tall for robots. Sizes match the shapes.
const BOTS = {
  optimus: { vehicle: 'optimus-truck', len: 3.7, robot: 'optimus', h: 3.05 },
  bumblebee: { vehicle: 'bumblebee-car', len: 4.3, robot: 'bumblebee', h: 2.55 },
};
// (Optimus is the Decepticons' last boss: the player's model, at a boss's size)
const BOSSES = { shockwave: { h: 8.4, hand: 'LeftHand' }, megatron: { h: 8.6, hand: 'RightHand' }, optimus: { h: 8.2, hand: 'RightHand' } };
const JETS = { seeker: 3.9, starscream: 3.9 * 3.2 };
// how each boss shows itself as it comes out: Megatron and Shockwave taunt
// you; Optimus, for the Decepticons' last fight, raises a fist
const TAUNTS = { megatron: 'taunt', shockwave: 'taunt', optimus: 'cheer.one' };

// Changing form (k 0 vehicle … 1 robot): the vehicle comes apart over the
// first three quarters while the robot builds over the last three, so midway
// some of each is there, edges lit. The cut runs over the noise's useful range.
const CUT = [0.2, 0.82];
const cutOf = (p) => (p <= 0.01 ? 0 : CUT[0] + (CUT[1] - CUT[0]) * Math.min(1, p));
function changeForm(v, r, k) {
  const vc = cutOf(Math.max(0, k / 0.75));
  const rc = cutOf(Math.max(0, (1 - k) / 0.75));
  v.cut(vc);
  r.cut(rc);
  v.holder.visible = k < 0.75;
  r.holder.visible = k > 0.25;
  // the shadow goes with the most of it
  v.shadow(vc < 0.5);
  r.shadow(rc < 0.5);
}

// A material that can come apart in plates: cells of the model's own frame
// (`frame`: world to the model, in metres; `scale` cells a metre) whose noise
// is under `cut` are gone, and the ones about to go glow. The model's frame,
// not the mesh's, as a skinned mesh's own units don't survive skinning.
function dissolving(src, edge, scale, frame) {
  const m = src.clone();
  const cut = { value: 0 };
  m.userData.cut = cut;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = cut;
    sh.uniforms.uEdge = { value: edge };
    sh.uniforms.uScale = { value: scale };
    sh.uniforms.uFrame = frame;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutP;\nuniform mat4 uFrame;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvCutP = (uFrame * modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCutP;
        uniform float uCut, uScale;
        uniform vec3 uEdge;
        float cutHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float cutNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(cutHash(i), cutHash(i + vec3(1, 0, 0)), f.x), mix(cutHash(i + vec3(0, 1, 0)), cutHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(cutHash(i + vec3(0, 0, 1)), cutHash(i + vec3(1, 0, 1)), f.x), mix(cutHash(i + vec3(0, 1, 1)), cutHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec3 cutQ = vCutP * uScale;
        float cutN = cutHash(floor(cutQ * 3.0)) * 0.55 + cutNoise(cutQ) * 0.45;
        if (cutN < uCut) discard;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uEdge * (1.0 - smoothstep(0.0, 0.07, cutN - uCut)) * step(0.001, uCut);`,
      );
  };
  m.customProgramCacheKey = () => 'ro-dissolve';
  return m;
}

export function createRollOutCast() {
  const assets = new Map(); // name → { gltf, size, offset, clips, rigged, yaw, hipsY, up }
  const owned = [];
  let made = 0; // (each rigged copy's seed: where in its stride and its breath it starts)

  const loadOne = async (name, yaw = 0) => {
    try {
      const gltf = await castModel(name);
      if (!gltf) return;
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const offset = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const rigged = RIGGED.has(name);
      const clips = rigged ? await ownClips(name) : {};
      assets.set(name, { gltf, size, offset, clips, rigged, yaw: (Number(yaw) || 0) * (Math.PI / 180), ...(rigged ? rigOf(gltf) : {}) });
    } catch {
      /* this one stays as shapes */
    }
  };

  // what the site has (index.json, written by scripts/meshy.mjs); onEach(k)
  // as each model lands
  const load = async (onEach) => {
    let names = [];
    try {
      const r = await fetch(`${BASE}/index.json`);
      if (r.ok) names = await r.json();
    } catch {
      /* nothing modelled yet */
    }
    if (!Array.isArray(names) || !names.length) return;
    let done = 0;
    await Promise.all(
      names.map((n) =>
        loadOne(String(n?.name ?? n), n?.yaw).then(() => {
          done += 1;
          onEach?.(done / names.length);
        }),
      ),
    );
  };

  // A copy of a model, `k` metres to the unit, resting on y = 0 and centred,
  // turned to face `face` (0: +Z, as glTF does; π: down the road, -Z), its
  // materials its own (to flash and dissolve) and its geometry shared. A
  // rigged one gets an animator (or, if one can't be made, a mixer of its
  // own clips, held where it's told).
  const place = (name, fit, { face = 0, edge = null, lengthwise = false } = {}) => {
    const src = assets.get(name);
    if (!src) return null;
    const model = castCopy(src.gltf);
    const k = fit(src.size);
    const holder = new THREE.Group();
    model.scale.setScalar(k);
    model.position.copy(src.offset).multiplyScalar(k);
    holder.add(model);
    const across = lengthwise && src.size.x > src.size.z * 1.1 ? Math.PI / 2 : 0;
    holder.rotation.y = face + across + src.yaw;
    const mats = [];
    const cuts = [];
    // world to the holder, as it's drawn
    const frame = { value: new THREE.Matrix4() };
    const scale = 3 / Math.max(src.size.x, src.size.y, src.size.z, 1e-6) / k; // cells a metre: 3 to the longest side
    let framed = false;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.shared = true;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      if (edge && !framed) {
        framed = true;
        o.onBeforeRender = () => frame.value.copy(holder.matrixWorld).invert();
      }
      // (the copy's materials are its own already; a dissolving one is made from each)
      const list = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => {
        const c = edge ? dissolving(m, edge, scale, frame) : m;
        owned.push(c);
        mats.push(c);
        if (c.userData.cut) cuts.push(c.userData.cut);
        return c;
      });
      o.material = Array.isArray(o.material) ? list : list[0];
    });
    let anim = null;
    let mixer = null;
    const act = {};
    if (src.rigged) {
      try {
        anim = createAnimator(model, { clips: src.clips, hipsY: src.hipsY, up: src.up, key: `rollout:${name}:${k.toFixed(4)}`, seed: hashSeed(`${name}:${made++}`) });
      } catch {
        anim = null;
      }
      if (!anim) {
        mixer = new THREE.AnimationMixer(model);
        for (const [n, clip] of Object.entries(src.clips)) {
          if (!clip) continue;
          const a = mixer.clipAction(clip);
          a.play();
          a.setEffectiveWeight(0);
          act[n] = a;
        }
      }
    }
    // stand in for the shapes' lamps: the textures have their own eyes
    const cut = (v) => cuts.forEach((u) => (u.value = v));
    const meshes = [];
    model.traverse((o) => o.isMesh && meshes.push(o));
    let casting = true;
    const shadow = (on) => {
      if (on === casting) return;
      casting = on;
      for (const m of meshes) m.castShadow = on;
    };
    return { holder, model, mats, anim, mixer, act, cut, shadow, src, k };
  };

  // play `name` at `t` seconds into it, alone (a figure without an animator)
  const pose = (p, name, t) => {
    const a = p.act[name] ?? p.act.walk ?? p.act.idle ?? p.act.run;
    if (!p.mixer || !a) return;
    for (const b of Object.values(p.act)) b.setEffectiveWeight(b === a ? 1 : 0);
    const d = a.getClip().duration || 1;
    a.time = ((t % d) + d) % d;
    p.mixer.update(0);
  };

  // its feet on the ground it covers, and what's laid over that, for a
  // frame; the bones on top of the clips (the hips turned to a strafe, the
  // lean, the legs tucked in the air) in its own frame as it's placed now
  const qFrame = new THREE.Quaternion();
  const ahead = new THREE.Vector3();
  const upright = new THREE.Vector3();
  const step = (p, o) => {
    p.anim.locomote({ move: o.move ?? 0, speed: o.speed ?? 0, side: o.side ?? 0, turn: o.turn ?? 0, air: o.air ?? 0 });
    p.anim.update(o.dt);
    p.model.getWorldQuaternion(qFrame);
    p.anim.after(o.dt, null, { forward: ahead.set(0, 0, 1).applyQuaternion(qFrame), up: upright.set(0, 1, 0).applyQuaternion(qFrame) });
  };

  // The calls a rigged robot's rig answers besides animate: the library's
  // clips over its own (lib/three/animator's play: { layer, loop, hold }),
  // its head toward a point, a cannon arm raised straight at one (w: 0…1)
  const calls = (p, hand = null) => {
    const arm = hand ? [p.model.getObjectByName(hand.replace('Hand', 'Arm')), p.model.getObjectByName(hand.replace('Hand', 'ForeArm')), p.model.getObjectByName(hand)] : [];
    const at = new THREE.Vector3();
    const from = new THREE.Vector3();
    const aiming = { w: 0, to: new THREE.Vector3() };
    return {
      clips: Boolean(p.anim), // (whether the clips below show: no animator, nothing does)
      play: (name, opts) => p.anim?.play(name, opts) ?? Promise.resolve('cut'),
      stop: (layer, fade) => p.anim?.stop(layer, fade),
      playing: (layer) => p.anim?.playing(layer) ?? null,
      look: (target) => p.anim?.look(target ?? null),
      aim(w, target) {
        aiming.w = w;
        if (target) aiming.to.copy(target);
      },
      // (after the animator: the arm straight along the line to its target)
      raise() {
        const [upper, fore, end] = arm;
        if (!(aiming.w > 0.01) || !upper || !fore || !end) return;
        upper.getWorldPosition(from);
        at.copy(aiming.to).sub(from);
        if (at.lengthSq() < 1e-6) return;
        aimBone(upper, fore, at, aiming.w);
        aimBone(fore, end, at, aiming.w);
      },
      dispose: () => p.anim?.dispose(),
    };
  };

  const glowAt = (parent, color, r) => {
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
    parent.add(m);
    owned.push(m.geometry, mat);
    return { mesh: m, mat };
  };

  // An Autobot: the vehicle facing down the road, the robot behind it with
  // its back to the camera; k 0…1 dissolves one into the other.
  const player = (bot) => {
    const spec = BOTS[bot];
    if (!spec) return null;
    const edge = new THREE.Color(0.9, 2.2, 3.0);
    const v = place(spec.vehicle, (s) => spec.len / Math.max(s.z, s.x), { face: Math.PI, edge, lengthwise: true });
    const r = place(spec.robot, (s) => spec.h / s.y, { face: Math.PI, edge });
    if (!v || !r) return null;
    const group = new THREE.Group();
    group.add(v.holder, r.holder);
    const eye = new THREE.MeshBasicMaterial();
    owned.push(eye);
    const rig = {
      ...calls(r),
      animate(k, phase, roll, amount, motion = null) {
        changeForm(v, r, k);
        if (!r.holder.visible) return;
        if (r.anim && motion?.dt != null) step(r, motion);
        // a stride per 2π of phase, as the shapes' legs swing
        else pose(r, 'run', (phase / TAU) * ((r.act.run ?? r.act.walk)?.getClip().duration ?? 1));
      },
    };
    return { group, rig, eye, height: spec.h, mats: [...v.mats, ...r.mats], meshy: true };
  };

  // A Vehicon: a sedan that stands up as a trooper (k 0…1), idling on its
  // feet, stepping sideways as it edges into your lane.
  const vehicon = () => {
    const edge = new THREE.Color(3.4, 0.6, 1.0);
    const v = place('vehicon-car', (s) => 3.6 / Math.max(s.z, s.x), { face: Math.PI, edge, lengthwise: true });
    const r = place('vehicon', (s) => 2.6 / s.y, { face: Math.PI, edge });
    if (!v || !r) return null;
    const group = new THREE.Group();
    group.add(v.holder, r.holder);
    const eye = new THREE.MeshBasicMaterial();
    owned.push(eye);
    const offset = (made % 7) * 1.37;
    const rig = {
      ...calls(r),
      animate(k, phase, roll, amount, motion = null) {
        changeForm(v, r, k);
        if (!r.holder.visible) return;
        if (r.anim && motion?.dt != null) step(r, motion);
        else pose(r, 'idle', phase / 6 + offset);
      },
    };
    return { group, rig, eye, height: 2.6, mats: [...v.mats, ...r.mats], meshy: true };
  };

  // A jet, nose down the road like the shapes' (the game turns it about).
  const jet = (name) => {
    const len = JETS[name];
    const p = len && place(name, (s) => len / Math.max(s.z, s.x), { face: Math.PI, lengthwise: true });
    if (!p) return null;
    const group = new THREE.Group();
    group.add(p.holder);
    // the engines' glow at the tail
    const tail = new THREE.Group();
    tail.position.set(0, p.src.size.y * p.k * 0.45, len * 0.5);
    group.add(tail);
    const flame = glowAt(tail, new THREE.Color(0.5, 0.8, 1).multiplyScalar(3), len * 0.05).mat;
    return { group, flame, mats: p.mats, meshy: true };
  };

  // Shockwave, Megatron or Optimus, facing you (+Z), going backwards ahead
  // of you at the road's pace (its own run, run backward and paced to it:
  // ./bossBody.js says how fast, and what it plays over that), the cannon's
  // glow at the hand that holds it, that arm raised at you as it charges.
  const boss = (kind) => {
    const spec = BOSSES[kind];
    const p = spec && place(kind, (s) => spec.h / s.y);
    if (!p) return null;
    const group = new THREE.Group();
    group.add(p.holder);
    group.updateMatrixWorld(true);
    const hand = p.model.getObjectByName(spec.hand) ?? p.model.getObjectByName(`mixamorig:${spec.hand}`);
    const cannonTip = new THREE.Object3D();
    if (hand) {
      // a hand's length ahead of the hand, in the hand's own frame and scale
      const world = hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, spec.h * 0.06));
      hand.add(cannonTip);
      cannonTip.position.copy(hand.worldToLocal(world));
      const s = hand.getWorldScale(new THREE.Vector3());
      cannonTip.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    } else {
      cannonTip.position.set(spec.hand === 'RightHand' ? -1.2 : 1.2, spec.h * 0.42, spec.h * 0.12);
      group.add(cannonTip);
    }
    const glow = glowAt(cannonTip, new THREE.Color(1, 0.4, 0.2).multiplyScalar(3), spec.h * 0.025).mat;
    const eye = new THREE.MeshBasicMaterial();
    owned.push(eye);
    const c = calls(p, hand ? hand.name : null);
    const rig = {
      ...c,
      animate(k, phase, roll, amount, motion = null) {
        if (p.anim && motion?.dt != null) {
          step(p, motion);
          c.raise();
        }
        // (without an animator: the walk held where the phase says, a
        // stride a turn; the phase goes back as it goes backward)
        else pose(p, 'walk', (phase / TAU) * (p.act.walk?.getClip().duration ?? 1));
      },
    };
    return { group, rig, eye, cannonTip, glow, mats: p.mats, meshy: true, taunt: TAUNTS[kind] ?? 'taunt' };
  };

  const has = (name) => assets.has(name);

  // (what's ours: the copies' materials and the glows; the models and their
  // textures stay in the page's cache, which the showcase shares)
  const dispose = () => {
    for (const o of owned) o.dispose?.();
    owned.length = 0;
    assets.clear();
  };

  return { load, player, vehicon, jet, boss, has, dispose };
}
