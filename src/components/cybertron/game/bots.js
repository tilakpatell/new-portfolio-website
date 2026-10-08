// Cybertron's robots and vehicles, loaded from the catalogue and made to
// move. A robot that came with a skeleton lib/three/rig.js can read (High
// Moon's War for Cybertron and Fall of Cybertron rigs, the Prime game's)
// is posed by rig.js on bodies.js's numbers: a stride paced to the ground
// it covers, its planted foot kept on the floor (the hips coming down as
// the legs open, which is where a big robot's weight shows), its legs
// turned to where it's going while its chest and gun stay on what it's
// shooting, a gesture over the top (a wave, a fist, a bow, talking with its
// hands, a flinch), its head turned to what it looks at, the kick of a shot,
// and, beaten, going over like a tower about its feet. One with an idle clip
// of its own stands about on that, faded into and out of the poses rather
// than cut. One without a usable skeleton bobs and sways as it goes. A
// model whose clip is a whole transformation (Megatron's, Barricade's) can
// be held at any moment of it, and let go of with a fade. Until a model
// loads, or if it can't be had, a stand-in made here takes its place, in
// its colours, so the world always plays.
//
//   loadModel(kind) → Promise<{ scene, animations, spec } | null>
//   makeFigure(kind, { shadows, seed }) → Promise<Figure>
//   standIn(kind) → THREE.Group
//
// Figure: { group, kind, spec, height, rigged, play(state, { speed, side,
// aim, fall }), gesture(name | null, { hold, dir }), look(point | null),
// recoil(), brace(on), update(dt), hold(clip, t), release(), muzzle(out),
// tint(hex, k), dispose() }; `group` stands on y = 0 facing +z, as every
// model does. state: 'idle', 'walk', 'run', 'jump', 'fall', 'hurt' or
// 'dead'; speed along its facing and side across it (+ its right), in
// metres a second; aim a direction in its frame (+z ahead, +x its left);
// fall the way it goes over when dead ([x, z] in the world). Every call
// does nothing on a figure that can't (a stand-in has no arms to wave).

import * as THREE from 'three';
import { loadGltf, copy } from '../../../lib/three/gltf';
import { POSES, figure as rigFigure } from '../../../lib/three/rig';
import { rotateWorld } from '../../../lib/three/ik';
import { autorig } from './autorig';
import { MODELS } from './catalog';
import { GESTURES, TALK, createGait, createHips, fallTime, gesture as gestureOf, hashSeed, standPose, stridePose, topple } from './bodies';

const cache = new Map(); // kind → Promise<{ scene, animations, spec } | null>

export function loadModel(kind) {
  if (!cache.has(kind)) {
    const spec = MODELS[kind];
    cache.set(kind, spec ? loadGltf(spec.file).then((g) => (g ? { scene: g.scene, animations: g.animations ?? [], spec } : null)) : Promise.resolve(null));
  }
  return cache.get(kind);
}

// ── stand-ins ──

const COLOURS = {
  'optimus-wfc': ['#b3202a', '#2a4fa8'],
  'optimus-tfp': ['#c41e2a', '#2550b0'],
  'bumblebee-wfc': ['#e3b51c', '#222'],
  'bumblebee-tfp': ['#f2c400', '#1b1b1b'],
  megatron: ['#8d929c', '#5d2b8f'],
  arcee: ['#3b5bd6', '#d74d9a'],
  ratchet: ['#e8e8e8', '#c4202a'],
  bulkhead: ['#47613a', '#2a2a2a'],
  vehicon: ['#3a3d48', '#7b2fb0'],
  trooper: ['#4a4f63', '#7d3fc4'],
};
const colourOf = (kind) => COLOURS[kind] ?? COLOURS[Object.keys(COLOURS).find((k) => kind.startsWith(k.split('-')[0]))] ?? ['#7d8592', '#3d4450'];

// A blocky robot (or a vehicle, or a prop) the right size, in its colours
export function standIn(kind) {
  const spec = MODELS[kind] ?? { metres: 7, role: 'npc' };
  const [main, trim] = colourOf(kind);
  const g = new THREE.Group();
  const m1 = new THREE.MeshStandardMaterial({ color: main, metalness: 0.6, roughness: 0.4 });
  const m2 = new THREE.MeshStandardMaterial({ color: trim, metalness: 0.6, roughness: 0.45 });
  const glow = new THREE.MeshBasicMaterial({ color: '#7fd8ff' });
  const box = (w, h, d, x, y, z, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const H = spec.metres ?? 7;
  if (spec.role === 'vehicle') {
    const L = H;
    box(L * 0.42, L * 0.16, L, 0, L * 0.14, 0, m1);
    box(L * 0.36, L * 0.14, L * 0.4, 0, L * 0.29, -L * 0.05, m2);
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) box(L * 0.06, L * 0.14, L * 0.14, x * L * 0.22, L * 0.07, z * L * 0.33, m2);
  } else if (spec.role === 'landmark' || spec.role === 'prop') {
    box(H * 0.5, H, H * 0.3, 0, H / 2, 0, m1);
  } else {
    const u = H / 10;
    box(u * 2.2, u * 2.6, u * 1.4, 0, u * 6.6, 0, m1); // chest
    box(u * 1.6, u * 1.2, u * 1.2, 0, u * 4.8, 0, m2); // waist
    box(u * 0.9, u * 1.0, u * 0.9, 0, u * 8.5, 0, m2); // head
    box(u * 0.5, u * 0.15, u * 0.1, 0, u * 8.6, u * 0.46, glow); // eyes
    for (const s of [-1, 1]) {
      box(u * 0.8, u * 3.4, u * 0.8, s * u * 1.6, u * 6.0, 0, m1); // arms
      box(u * 0.9, u * 4.2, u * 1.0, s * u * 0.6, u * 2.1, 0, s < 0 ? m2 : m1); // legs
    }
  }
  g.userData.standIn = true;
  return g;
}

// ── figures ──


let made = 0; // (each figure's seed, when it isn't given one)
const smooth01 = (k) => {
  const u = Math.min(1, Math.max(0, k));
  return u * u * (3 - 2 * u);
};
const bump = (k) => (k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0);
// a way in the world ([x, z]) in the frame of a group turned `yaw`
const toLocal = (w, yaw) => [w[0] * Math.cos(yaw) - w[1] * Math.sin(yaw), w[0] * Math.sin(yaw) + w[1] * Math.cos(yaw)];
const TIP = new THREE.Vector3();
// the turn onto the ground about the feet, falling the way `f` points ([x, z], its frame)
const tipOver = (q, f, angle) => (angle > 0 && f ? q.setFromAxisAngle(TIP.set(f[1], 0, -f[0]).normalize(), angle) : q.identity());

// a figure of a model that isn't rigged (or not in a way rig.js can read)
function stillFigure(kind, spec, scene, animations, { seed = 0 } = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const model = copy(scene);
  inner.add(model);
  const mixer = animations.length ? new THREE.AnimationMixer(model) : null;
  const actions = new Map(animations.map((a) => [a.name, mixer.clipAction(a)]));
  let state = 'idle';
  let speed = 0;
  let phase = 0;
  let clock = (seed >>> 0) % 97; // (two of them don't breathe as one)
  let fall = null;
  let deadT = 0;
  let nod = null; // { t, hold }: a bow from the waist, for the gestures it can show
  const idle = spec.clips?.idle && actions.get(spec.clips.idle);
  if (idle) {
    idle.play();
    idle.time = ((seed >>> 0) % 1000) / 1000 * idle.getClip().duration;
  }
  return {
    group,
    kind,
    spec,
    height: spec.metres ?? 7,
    rigged: false,
    mixer,
    actions,
    play(s, { speed: v = 0, fall: f = null } = {}) {
      state = s;
      speed = v;
      if (f) fall = f;
    },
    // (no arms to wave: a nod or a bow it can show, from the waist)
    gesture(name, { t = null, hold = null } = {}) {
      if (name !== 'nod' && name !== 'salute' && name !== 'bow') return;
      if (nod?.name !== name) nod = { name, t: 0, hold: hold ?? (name === 'bow' ? 2.2 : 1.3), deep: name === 'bow' ? 0.3 : 0.12 };
      if (t != null) nod.t = t;
    },
    look() {},
    recoil() {},
    brace() {},
    hold(name, t) {
      const a = actions.get(name);
      if (!a) return 0;
      for (const other of actions.values()) if (other !== a) other.stop();
      a.play();
      a.paused = true;
      a.time = Math.min(t, a.getClip().duration);
      mixer.update(0);
      return a.getClip().duration;
    },
    // back from a held clip to its idle
    release() {
      if (!idle || idle.isRunning()) return;
      for (const a of actions.values()) a.stop();
      idle.reset().play();
    },
    update(dt) {
      clock += dt;
      const moving = state === 'walk' || state === 'run' || state === 'drive';
      // a stride a step's length, whatever the pace (a stomp a step)
      phase += moving ? Math.max(1.5, (Math.abs(speed) * Math.PI) / Math.max(1, this.height * 0.4)) * dt : 0;
      // a stomp in the step, a sway, a lean into it; breathing standing still
      const h = this.height;
      const bob = moving && state !== 'drive' ? Math.abs(Math.sin(phase)) * h * 0.012 : Math.sin(clock * 1.6) * h * 0.003;
      inner.position.y = bob;
      inner.rotation.z = moving && state !== 'drive' ? Math.sin(phase) * 0.035 : 0;
      inner.rotation.x = state === 'run' ? 0.08 : state === 'hurt' ? -0.2 : 0;
      if (nod) {
        nod.t += dt;
        inner.rotation.x += nod.deep * bump(nod.t / nod.hold);
        if (nod.t >= nod.hold) nod = null;
      }
      // beaten: over about its feet, the way it was knocked
      deadT = state === 'dead' ? deadT + dt : 0;
      if (deadT > 0) {
        inner.rotation.set(0, 0, 0);
        tipOver(inner.quaternion, fall ? toLocal(fall, group.rotation.y) : [0, 1], topple(deadT, fallTime(h)));
      }
      if (mixer) mixer.update(dt);
    },
    tint(hex, k) {
      model.traverse((o) => {
        if (!o.isMesh || !o.material?.emissive) return;
        if (!o.userData.ownMaterial) {
          o.material = o.material.clone();
          o.userData.ownMaterial = true;
        }
        o.material.emissive.set(hex);
        o.material.emissiveIntensity = k;
      });
    },
    dispose() {
      mixer?.stopAllAction();
      model.traverse((o) => o.userData.ownMaterial && o.material.dispose());
    },
  };
}

// a figure rig.js can pose: walking, running, jumping, aiming, knocked down
// (exported for its tests: makeFigure is how the game makes one)
export function riggedFigure(kind, spec, scene, animations, { seed = 0 } = {}) {
  const fig = rigFigure({ scene }, { h: spec.metres ?? 7 });
  // High Moon's rigs give a robot's guns and blades skeletons of their own,
  // beside the body's rather than in it: put each in whichever hand it's
  // nearest. How it's held is read off the rest pose, where the model holds
  // it right (its barrel along the forearm, its grip at the hand), and kept
  // to every frame after: the arm's pose, or the idle clip (which still
  // moves the gun as if it hung from the root), would turn it round
  fig.model.updateMatrixWorld(true);
  const guns = [];
  const grips = [];
  fig.model.traverse((o) => o.isBone && /^wep_reference/i.test(o.name) && guns.push(o));
  const at = new THREE.Vector3();
  const near = new THREE.Vector3();
  for (const gun of guns) {
    gun.getWorldPosition(at);
    const body = gun.children.find((c) => c.isBone);
    body?.getWorldPosition(at);
    let hand = null;
    let best = Infinity;
    for (const h of [fig.bones.handL, fig.bones.handR]) {
      if (!h) continue;
      const d = h.getWorldPosition(near).distanceTo(at);
      if (d < best) {
        best = d;
        hand = h;
      }
    }
    if (!hand) continue;
    const elbow = hand.parent;
    const H = hand.getWorldPosition(new THREE.Vector3());
    const fore = H.clone().sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    const inv = gun.getWorldQuaternion(new THREE.Quaternion()).invert();
    grips.push({
      gun,
      hand,
      elbow,
      barrel: fore.applyQuaternion(inv),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(inv),
      grip: gun.worldToLocal(H.clone()),
      scale: gun.getWorldScale(new THREE.Vector3()),
    });
    hand.attach(gun);
  }
  const g1 = new THREE.Vector3();
  const g2 = new THREE.Vector3();
  const g3 = new THREE.Vector3();
  const mL = new THREE.Matrix4();
  const mW = new THREE.Matrix4();
  const qW = new THREE.Quaternion();
  const basis = (m, f, up) => {
    const u = g3.copy(up).addScaledVector(f, -up.dot(f));
    if (u.lengthSq() < 1e-6) u.set(0, 0, 1).addScaledVector(f, -f.z);
    u.normalize();
    return m.makeBasis(f, u, f.clone().cross(u));
  };
  // (the gun along the forearm as it is now, gripped where it was, its top
  // kept to the robot's own up: lying down, it lies with him)
  const upW = new THREE.Vector3();
  const qH = new THREE.Quaternion();
  const holdGuns = () => {
    if (!grips.length) return;
    fig.holder.updateMatrixWorld(true);
    upW.set(0, 1, 0).applyQuaternion(fig.holder.getWorldQuaternion(qH));
    for (const g of grips) {
      const H = g.hand.getWorldPosition(g1);
      const F = g2.copy(H).sub(g.elbow.getWorldPosition(g3)).normalize();
      basis(mW, F, upW).multiply(basis(mL, g.barrel.clone().normalize(), g.up).transpose());
      qW.setFromRotationMatrix(mW);
      const offset = g.grip.clone().multiply(g.scale).applyQuaternion(qW);
      mW.compose(H.clone().sub(offset), qW, g.scale).premultiply(mL.copy(g.hand.matrixWorld).invert());
      mW.decompose(g.gun.position, g.gun.quaternion, g.gun.scale);
    }
  };
  const group = new THREE.Group();
  const tip = new THREE.Group(); // (going over, about its feet)
  group.add(tip);
  tip.add(fig.holder);
  fig.holder.position.y = fig.hipHeight;
  const mixer = animations.length ? new THREE.AnimationMixer(fig.model) : null;
  const actions = new Map(animations.map((a) => [a.name, mixer.clipAction(a)]));
  const idle = spec.clips?.idle && actions.get(spec.clips.idle);
  if (idle) {
    // (somewhere of its own in it, so two of a kind don't breathe as one)
    idle.play();
    idle.time = (((seed >>> 0) % 1000) / 1000) * idle.getClip().duration;
  }
  fig.snap(POSES.stand);
  // its legs, as it stands: hip to ankle, and how low its ankles are
  const B = fig.bones;
  const ankles = [B.footL ?? B.toeL, B.footR ?? B.toeR].filter(Boolean);
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const lowest = () => {
    let low = Infinity;
    for (const a of ankles) low = Math.min(low, fig.holder.worldToLocal(a.getWorldPosition(v1)).y);
    return low;
  };
  fig.holder.updateMatrixWorld(true);
  const restLow = ankles.length ? lowest() : 0;
  const span = (a, b) => (a && b ? a.getWorldPosition(v1).distanceTo(b.getWorldPosition(v2)) : 0);
  const leg = span(B.thighL, B.calfL) + span(B.calfL, B.footL) || fig.hipHeight * 0.9;
  // Every bone, for going from a clip to a pose or back without a jump:
  // where they were, laid over where they're going, less and less
  const bones = [];
  fig.model.traverse((o) => o.isBone && bones.push(o));
  const was = bones.map(() => new THREE.Quaternion());
  let fade = 0;
  let fadeFor = 0.3;
  const remember = (time) => {
    bones.forEach((b, i) => was[i].copy(b.quaternion));
    fade = 1;
    fadeFor = time;
  };
  const fadeIn = (dt) => {
    if (fade <= 0) return false;
    fade = Math.max(0, fade - dt / fadeFor);
    const w = smooth01(fade);
    if (w > 1e-4) for (let i = 0; i < bones.length; i++) bones[i].quaternion.slerp(was[i], w);
    return true;
  };
  const gait = createGait({ leg, height: fig.height, seed });
  const hips = createHips();
  const style = TALK[kind] ?? null;
  let state = 'idle';
  let speed = 0;
  let side = 0;
  let aim = null;
  let fall = null;
  let clock = (seed >>> 0) % 97;
  let held = false;
  let onClip = false;
  let resnap = false;
  let g = null; // the gesture on: { name, t, hold, dir }
  let kick = 0; // a shot's kick, dying away
  let braced = 0;
  let bracing = false;
  let plant = 0;
  let deadT = 0;
  const looking = { on: false, at: new THREE.Vector3(), yaw: 0, pitch: 0 };
  const headRest = new THREE.Quaternion();
  let headTurned = false;
  const qB = new THREE.Quaternion();
  const upAxis = new THREE.Vector3();
  const leftAxis = new THREE.Vector3();
  const clampTo = (v, m) => Math.max(-m, Math.min(m, v));
  // the facing's frame into the legs' (turned `yaw` toward where they go)
  const intoLegs = (v, yaw) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c];
  };
  return {
    group,
    kind,
    spec,
    height: fig.height,
    rigged: true,
    mixer,
    actions,
    fig,
    play(s, { speed: v = 0, side: sd = 0, aim: a = null, fall: f = null } = {}) {
      state = s;
      speed = Number.isFinite(v) ? v : 0;
      side = Number.isFinite(sd) ? sd : 0;
      aim = a;
      if (f) fall = f;
      else if (s !== 'dead') fall = null;
    },
    // a gesture (bodies.js's), as of `t` seconds into it; null: none
    gesture(name, { t = null, hold = null, dir = null } = {}) {
      if (!name) {
        g = null;
        return;
      }
      if (g?.name !== name || (t == null && name === 'stagger')) g = { name, t: 0, hold: hold ?? GESTURES[name] ?? 1.5, dir };
      if (t != null) g.t = t;
      if (hold != null) g.hold = hold;
      if (dir) g.dir = dir;
    },
    // the head toward a point in the world (null: ahead again)
    look(point) {
      looking.on = Boolean(point);
      if (point) looking.at.set(point.x, point.y ?? 0, point.z);
    },
    recoil() {
      kick = 1;
    },
    // the legs set and the weight down, for a heavy shot
    brace(on) {
      bracing = Boolean(on);
    },
    hold(name, t) {
      const a = actions.get(name);
      if (!a) return 0;
      held = true;
      for (const other of actions.values()) if (other !== a) other.stop();
      a.play();
      a.paused = true;
      a.time = Math.min(t, a.getClip().duration);
      mixer.update(0);
      return a.getClip().duration;
    },
    // where the gun's muzzle is (in the world), for the shots and the flash:
    // down the forearm from the hand, a gun's length (or a fist's)
    muzzle(out = new THREE.Vector3()) {
      const gp = grips.find((x) => x.hand === fig.bones.handR) ?? grips[0];
      const hand = gp?.hand ?? fig.bones.handR;
      if (!hand?.parent) return null;
      fig.holder.updateMatrixWorld(true);
      hand.getWorldPosition(out);
      const f = g1.copy(out).sub(hand.parent.getWorldPosition(g2)).normalize();
      return out.addScaledVector(f, fig.height * (gp ? 0.32 : 0.1));
    },
    // back from a held clip to standing, walking and the rest: faded, from
    // where the clip left him
    release() {
      if (!held) return;
      held = false;
      remember(0.35);
      for (const a of actions.values()) a.stop();
      idle?.play();
      onClip = false;
      resnap = true;
    },
    update(dt) {
      dt = dt > 0 ? Math.min(dt, 0.1) : 0;
      clock += dt;
      if (held) return;
      // (the head as the pose or the clip leaves it, not as last frame's look did)
      if (headTurned) B.head.quaternion.copy(headRest);
      headTurned = false;
      if (g) {
        g.t += dt;
        if (g.t >= g.hold) g = null;
      }
      if (state === 'hurt' && !g) g = { name: 'stagger', t: 0, hold: GESTURES.stagger, dir: [0, 0, -1] };
      kick = Math.max(0, kick - dt * 6);
      braced += ((bracing ? 1 : 0) - braced) * (1 - Math.exp(-dt * 6));
      const dead = state === 'dead';
      const air = state === 'jump' || state === 'fall';
      const moving = state === 'walk' || state === 'run';
      deadT = dead ? deadT + dt : 0;
      // the legs toward where it goes, striding over the ground it covers
      const legs = hips.step(dt, moving && !dead ? speed : 0, moving && !dead ? side : 0);
      const st = gait.step(dt, moving && !air && !dead ? legs.dir * legs.ground : 0);
      // standing about on its own clip, when there's nothing else to show
      const wantClip = Boolean(idle) && state === 'idle' && !aim && !g && st.amount < 0.04 && braced < 0.05 && kick < 0.05 && Math.abs(legs.yaw) < 0.05;
      if (wantClip !== onClip) {
        remember(wantClip ? 0.5 : 0.3);
        onClip = wantClip;
        resnap = !wantClip;
      }
      let chest = 0; // (which way the chest is turned from its facing, for the look)
      let head = null;
      if (onClip) {
        fig.body.rotation.y = 0;
        mixer.update(dt);
      } else {
        fig.body.rotation.y = dead ? 0 : legs.yaw;
        let targets;
        if (dead) targets = deadPose(smooth01(deadT / fallTime(fig.height)));
        else if (air) targets = POSES.leap(state === 'jump' ? 1 : -1);
        else if (st.amount > 0.005) targets = stridePose(st.phase, st.amount, st.run);
        else targets = standPose(clock, seed);
        const torso = { pitch: 0, yaw: 0, roll: 0, ...(targets.torso ?? {}) };
        const counter = dead ? 0 : clampTo(-legs.yaw, 0.9);
        if (!dead) {
          // the chest back round to what it faces, as far as a waist turns
          torso.yaw += counter;
          // set for a heavy shot: the knees bent and the weight forward
          if (braced > 0.01 && !moving && !air) {
            const b = braced;
            Object.assign(targets, { thighL: [0.12, -1, 0.34 * b], calfL: [0.06, -1, -0.4 * b], thighR: [-0.12, -1, 0.08 * b], calfR: [-0.06, -1, -0.46 * b] });
            torso.pitch += 0.12 * b;
          }
          // the gun arm out along the aim, the other bracing it, both into the
          // legs' frame; kicked up by a shot
          if (aim) {
            const a = intoLegs(aim, legs.yaw);
            a[1] += kick * 0.45;
            const n = Math.hypot(a[0], a[1], a[2]) || 1;
            const dir = [a[0] / n, a[1] / n, a[2] / n];
            Object.assign(targets, { armR: dir, foreR: dir, armL: intoLegs([0.35, -0.3, 0.85], legs.yaw), foreL: intoLegs([-0.2, 0.15, 1], legs.yaw) });
            torso.yaw = (torso.yaw - counter) * 0.3 + counter; // (the stride's twist mostly out of it)
            torso.pitch -= kick * 0.08;
          }
          // a gesture over the top: its arms in place of these, its lean on this one
          if (g) {
            const gg = gestureOf(g.name, g.t, { style: g.name === 'talk' ? style : null, seed, dir: g.dir, hold: g.hold });
            if (gg?.targets) {
              const { torso: lean, ...arms } = gg.targets;
              Object.assign(targets, arms);
              if (lean) for (const k of ['pitch', 'yaw', 'roll']) torso[k] += lean[k] ?? 0;
            }
            if (gg?.brace && !moving && !air) {
              const b = gg.brace;
              Object.assign(targets, { thighL: [0.12, -1, 0.3 * b], calfL: [0.06, -1, -0.36 * b], thighR: [-0.12, -1, 0.06 * b], calfR: [-0.06, -1, -0.4 * b] });
            }
            head = gg?.head ?? null;
          }
        }
        targets.torso = torso;
        chest = legs.yaw + torso.yaw;
        if (resnap) {
          fig.snap(targets);
          resnap = false;
        } else fig.pose(targets, dt, moving ? 30 : g?.name === 'stagger' ? 16 : 10);
      }
      const fading = fadeIn(dt);
      // the planted foot on the floor: the hips come down as the legs open
      let want = 0;
      if (!onClip && !dead && !air && ankles.length) {
        if (fading) fig.holder.updateMatrixWorld(true);
        want = restLow - lowest();
      }
      plant += (want - plant) * (1 - Math.exp(-dt * 30));
      fig.holder.position.y = fig.hipHeight + plant;
      // beaten: over about its feet, the way it was knocked (else backward)
      const away = fall ? toLocal(fall, group.rotation.y) : [0, -1];
      tipOver(tip.quaternion, dead ? away : null, dead ? topple(deadT, fallTime(fig.height)) : 0);
      // the head toward what it looks at, past what its chest is turned
      if (B.head) {
        let wy = 0;
        let wp = 0;
        if (looking.on && !dead) {
          B.head.getWorldPosition(v2);
          const d = v1.copy(looking.at).sub(v2).applyQuaternion(group.getWorldQuaternion(qB).invert());
          wy = clampTo(Math.atan2(d.x, d.z) - chest, 1.0);
          wp = clampTo(Math.atan2(d.y, Math.hypot(d.x, d.z)), 0.5);
        }
        const k = 1 - Math.exp(-dt * 5);
        looking.yaw += (wy - looking.yaw) * k;
        looking.pitch += (wp - looking.pitch) * k;
        const yaw = looking.yaw + (head?.yaw ?? 0);
        const pitch = looking.pitch + (head?.pitch ?? 0);
        if (Math.abs(yaw) + Math.abs(pitch) > 1e-4) {
          headRest.copy(B.head.quaternion);
          headTurned = true;
          fig.body.getWorldQuaternion(qB);
          upAxis.set(0, 1, 0).applyQuaternion(qB);
          leftAxis.set(1, 0, 0).applyQuaternion(qB).applyAxisAngle(upAxis, yaw);
          rotateWorld(B.head, upAxis, yaw);
          rotateWorld(B.head, leftAxis, -pitch); // (+ pitch: looking up)
        }
      }
      holdGuns();
    },
    tint(hex, k) {
      fig.tint(new THREE.Color(hex), k);
    },
    dispose() {
      mixer?.stopAllAction();
      fig.dispose();
    },
  };
}

// Beaten (k: 0 as it's hit … 1 lying there): thrown back, then the arms out
// and the legs loose as it lands
function deadPose(k) {
  const to = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
  return {
    armL: to([0.8, 0.35, -0.4], [1, 0.05, 0.05]),
    foreL: to([0.6, 0.6, -0.2], [0.9, 0.25, 0.1]),
    armR: to([-0.8, 0.35, -0.4], [-1, 0.05, 0.05]),
    foreR: to([-0.6, 0.6, -0.2], [-0.9, 0.25, 0.1]),
    thighL: to([0.15, -1, 0.35], [0.12, -1, 0.08]),
    calfL: to([0.1, -1, 0.1], [0.08, -1, -0.1]),
    thighR: to([-0.15, -1, 0.35], [-0.16, -1, 0.02]),
    calfR: to([-0.1, -1, 0.1], [-0.1, -1, -0.04]),
    footL: [0, -0.2, 1],
    footR: [0, -0.2, 1],
    torso: { pitch: -0.4 * (1 - k) - 0.06 * k, yaw: 0, roll: 0.08 * k },
  };
}

// whether rig.js found enough of a skeleton to walk it
function walkable(scene) {
  const names = [];
  scene.traverse((o) => o.isBone && names.push(o.name.toLowerCase()));
  const has = (re) => names.some((n) => re.test(n));
  return (has(/l_leg01_thigh|thigh\.l|leftupleg|thigh_l/) && has(/r_leg01_thigh|thigh\.r|rightupleg|thigh_r/)) || false;
}

const ROBOTS = new Set(['player', 'npc', 'enemy', 'boss']);
const rigged = new Map(); // kind → its model with a skeleton made for it

export async function makeFigure(kind, { shadows = false, seed = null } = {}) {
  const spec = MODELS[kind];
  const loaded = spec ? await loadModel(kind) : null;
  // (each its own clocks: where in its stride, its breath, its idle it starts)
  const own = { seed: seed ?? hashSeed(`${kind}:${made++}`) };
  let f;
  if (!loaded) {
    const group = new THREE.Group();
    group.add(standIn(kind));
    f = stillFigure(kind, spec ?? { metres: 7 }, group, [], own);
    f.standIn = true;
  } else if (!spec.rig && !spec.still && ROBOTS.has(spec.role)) {
    // one piece, no skeleton: given one (autorig.js), then posed like the rest
    try {
      if (!rigged.has(kind)) rigged.set(kind, autorig(loaded.scene));
      f = riggedFigure(kind, spec, rigged.get(kind), [], own);
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('autorig failed for', kind, e);
      f = stillFigure(kind, spec, loaded.scene, loaded.animations, own);
    }
  } else if (spec.rig && walkable(loaded.scene)) {
    try {
      f = riggedFigure(kind, spec, loaded.scene, loaded.animations, own);
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('rig failed for', kind, e);
      f = stillFigure(kind, spec, loaded.scene, loaded.animations, own);
    }
  } else f = stillFigure(kind, spec, loaded.scene, loaded.animations, own);
  f.group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = shadows;
    o.receiveShadow = false;
    if (o.isSkinnedMesh) o.frustumCulled = false;
  });
  f.group.userData.kind = kind;
  return f;
}

// A vehicle (or prop) as it stands: a copy of its model, or its stand-in
export async function makeThing(kind, { shadows = false } = {}) {
  const loaded = await loadModel(kind);
  const group = new THREE.Group();
  group.add(loaded ? copy(loaded.scene) : standIn(kind));
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = shadows;
  });
  group.userData.kind = kind;
  return group;
}

