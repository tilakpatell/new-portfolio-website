// Middle-earth's people on the cast: the rigged Meshy figures in the
// world's toy style (public/models/middleearth/cast/<name>.glb, each with
// its own idle, walk and run, and the clip library's every other clip on
// the shared skeleton), put on the toy figures the towns already build.
//
// The towns call makePerson, makeFolk and the rest synchronously and get
// the toy at once, as they always did; `upgrade` then fetches the figure's
// cast model (one loaded template a name, every copy a SkeletonUtils clone
// of it) and, once it's here, puts it in the toy's group, sized to the
// toy's height and facing its way, and hides the toy's parts. From then
// the toy's pose() (mapFigures.js), sit, dance and calm (shire/people.js)
// only say what the figure is doing; once a frame `tickCast` reads where
// each figure really went (its ground speed, its turn: no foot slides, no
// lockstep), and drives its animator (lib/three/animator.js): locomotion,
// a base state (sat, crouched), its gestures (a wave, a greeting, talk
// while a line plays), a loop or one-shot a town asks for, and where its
// head looks. A model that doesn't come (a 404, soft WebGL, Node) leaves
// the toy as it was, and the toy keeps walking.
//
// upgrade(f, name, { look, role, seed, tint, hide, top, face }) → f: f gets
//   `cast` (below) at once, ready when its model's here. role: 'lead' (the
//   one you walk), 'cast' (the story's people), 'folk' (a crowd: left as
//   toys on a low-tier device), 'ghost' (ticked by ghosts.js itself).
//   hide: the parts to hide (else the toy's body and legs); top: how tall
//   it stands to the top of its head (else the toy's); face: which way the
//   figure faces in its group (π/2: +x, as every toy does).
// castFigure(f, id, look, opts) → f: upgraded as whoever castFor says
// f.cast: { name, ready, set({ base, full, upper, look, crouch, range }),
//   play(clip, opts) → Promise, stop(layer), react(event, ctx), greet(),
//   sit(on, how), dance(on), pose(opts), tick(dt, camera), onReady(fn),
//   hold(object, bone), holds, bone(name), showToy(on), dispose() }
//   hold: the toy's item into the cast's hand by lib/three/held.js's
//   holdItem (its kind from the item's userData.held, its grip a child
//   named `grip`; `bone` 'LeftHand' or 'RightHand' when the town says,
//   else the kind's hand), carried every frame after the animator, let go
//   back to the toy's arm on dispose; holds: what's held
//   set: what a town wants of it, kept until changed: a base state
//   ('sit', 'sit.floor', 'sleep', 'lie'), a loop on the whole body or the
//   upper body, where its head looks (a point, an Object3D, a figure: its
//   head), within `range`, crouching (knees bent, on the move too), down
//   (a `flinch`, then the `fall`, held; up through `rise` after), `air` (a
//   hop's height, knees tucked) and `seat` (the hips' height sat, when
//   it's not the toy's)
// tickCast(root, camera, dt): every ready figure under `root`, once a frame
//   before the frame's drawn (animBudget.js sets how often each is stepped)
// releaseCast(root): every figure under `root` let go (a scene's dispose)
// attend(p, h, home, dt, { who, near, rate }) → the distance: one of a
//   town's people as the walker comes by: the head looks and the body turns
//   only past what a neck can do, a greeting the first time they're near
//   (the map's); a toy turns its whole self, as the towns always had it
// castDo(f, wants), castPlay(f, clip, opts), castReact(f, event, ctx):
//   the same on a figure that may not be on the cast (no-ops then)
// setCastSource({ load, on }): tests: a loader (url → { scene, animations })
//   and whether the cast is on at all

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF } from '../../lib/three/gltfCache';
import { createAnimator } from '../../lib/three/animator';
import { holdItem } from '../../lib/three/held';
import { animatorCalls, seedOf } from '../../lib/three/figureCalls';
import { faceAhead, heading } from '../../lib/three/clipLibrary';
import { createAnimBudget } from '../../lib/three/animBudget';
import { turn as easeYaw } from '../../lib/three/gait';
import { device } from '../../lib/device';
import { castFor, createGreeter, manner, motionFrom, moveFor, pick, stepFollower, tintFor } from './castRules';
import { watchPose } from './towns/watchers';

const V = THREE.Vector3;
const DIR = '/models/middleearth/cast';
const LOCO = ['idle', 'walk', 'run'];
const HEAD_R = 0.29; // the toys' heads' radius
const TELEPORT = 40; // toy units a second past which a move is a jump, not a walk
const DANCES = ['dance.joy', 'dance', 'dance.funny'];
const WAVE_FOR = 2.6; // seconds a wave lasts before the talk takes over
const SITS = new Set(['sit', 'sit.idle', 'sit.floor', 'sleep', 'lie', 'sit.doze']);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const cfg = { load: (url) => loadGLTF(url), on: null };
export function setCastSource({ load = null, on = null } = {}) {
  cfg.load = load ?? ((url) => loadGLTF(url));
  cfg.on = on;
  templates.clear();
}

// whether this page puts people on the cast at all, and this one
function allowed(role) {
  if (cfg.on != null) return cfg.on;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (/[?&]cast=0\b/.test(window.location.href)) return false;
  } catch {
    /* no location: as usual */
  }
  const d = device();
  if (d.saveData) return false;
  return !(d.tier === 'low' && role === 'folk');
}

// ── one template a name ──
const templates = new Map(); // name → Promise<template | null>
function template(name) {
  if (templates.has(name)) return templates.get(name);
  const files = [`${DIR}/${name}.glb`, ...LOCO.map((c) => `${DIR}/${name}-${c}.glb`)];
  const p = Promise.all(files.map((u) => Promise.resolve(cfg.load(u)).catch(() => null)))
    .then(([g, ...clips]) => made(name, g, clips))
    .catch(() => null);
  templates.set(name, p);
  // (one that didn't come is tried again by the next scene that wants it)
  p.then((t) => {
    if (!t && templates.get(name) === p) templates.delete(name);
  });
  return p;
}
function made(name, g, files) {
  const scene = g?.scene;
  const hips = scene?.getObjectByName('Hips');
  if (!hips?.parent) return null;
  const own = {};
  LOCO.forEach((c, i) => {
    const a = files[i]?.animations?.[0];
    if (a) own[c] = a;
  });
  if (!own.idle && !own.walk) return null;
  scene.updateMatrixWorld(true);
  // up, in the space the hips turn in (the library's clips are turned about it to face ahead too)
  const up = new V(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (own.walk) faceAhead(own, up);
  const box = new THREE.Box3().setFromObject(scene);
  const ground = box.isEmpty() ? 0 : box.min.y;
  const crown = scene.getObjectByName('head_end') ?? scene.getObjectByName('Head');
  const top = (crown ? crown.getWorldPosition(new V()).y : box.max.y) - ground;
  if (!(top > 0.1)) return null;
  return { name, scene, own, up, hipsY: hips.position.y, ahead: own.walk ? heading(own.walk, up) : null, top, ground };
}
// a copy: bones of its own (SkeletonUtils), materials of its own (matte, as
// Meshy's colours carry their own shading; tinted for one of a crowd)
function copyOf(tpl, tint) {
  const model = cloneSkinned(tpl.scene);
  const mats = new Map();
  const tc = tint != null ? new THREE.Color(tint) : null;
  const swap = (m) => {
    if (!mats.has(m)) {
      const c = m.clone();
      if ('roughness' in c) c.roughness = 0.85;
      if ('metalness' in c) c.metalness = 0;
      if (tc && c.color) c.color.multiply(tc);
      mats.set(m, c);
    }
    return mats.get(m);
  };
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.frustumCulled = false; // (a skinned mesh's bounds don't follow its pose)
    o.castShadow = true;
    o.receiveShadow = false;
  });
  return { model, materials: [...mats.values()] };
}

// ── the toy's measures ──
function toyParts(f) {
  const parts = [f.body, ...(f.legs ?? [])];
  for (const o of f.group.children) if (o.isMesh && o !== f.halo) parts.push(o);
  return parts.filter(Boolean);
}
function toyTop(f) {
  if (!f.head) return f.top ?? 1.5;
  f.group.updateMatrixWorld(true);
  const p = f.head.getWorldPosition(new V());
  f.group.worldToLocal(p);
  return p.y + HEAD_R;
}

// ── the figures on the cast, and the frame's budget ──
const live = new Set();
let budget = null;
let upgrades = 0; // figures put on the cast, for their seeds
const MAX = { high: 48, mid: 20, low: 8 };
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _sphere = new THREE.Sphere();
const _p = new V();
const _t = new V();
const _s = new V();
const _q = new THREE.Quaternion();
const _frame = { forward: new V(), up: new V() };

// visible all the way up
function shown(o) {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}
function under(o, root) {
  for (let x = o; x; x = x.parent) if (x === root) return true;
  return false;
}

export function upgrade(f, name, { look = null, role = 'cast', seed = null, tint, hide = null, top = null, face = Math.PI / 2 } = {}) {
  if (!f?.group || !name || f.cast || !allowed(role)) return f;
  // (its own clocks: two of one figure, even dressed alike, never breathe or step together)
  const s = seed ?? seedOf(name, (look?.seed ?? 0) * 131 + upgrades++);
  const m = manner(name);
  const c = {
    f,
    name,
    role,
    seed: s,
    ready: false,
    disposed: false,
    manual: role === 'ghost',
    want: { base: null, full: null, upper: null, look: null, range: Infinity, crouch: false, air: 0, down: false, fall: null, flinch: 'hit.chest', rise: 'arise', seat: null },
    opts: { wave: 0, talk: 0 },
    sitting: false,
    sitHow: null,
    dancing: false,
    greetOf: m.greet,
    talkClip: pick(m.talk, s >>> 3),
    danceClip: pick(DANCES, s >>> 5),
    greeter: createGreeter(),
    turning: false,
    waits: [],
    holds: [], // what's in its hands (lib/three/held.js), once it's on the cast
  };
  const toy = hide ?? toyParts(f);
  const height = top ?? toyTop(f);
  const tintHex = tint !== undefined ? tint : tintFor(name, look);
  let st = null; // once ready: { holder, model, anim, calls, k, walkV, runV, … }

  // what the towns say
  c.set = (w) => Object.assign(c.want, w);
  c.pose = (o = {}) => {
    c.opts.wave = o.wave ?? 0;
    c.opts.talk = o.talk ?? 0;
  };
  c.sit = (on = true, how = null) => {
    c.sitting = Boolean(on);
    c.sitHow = how;
  };
  c.dance = (on = true) => {
    c.dancing = Boolean(on);
  };
  c.onReady = (fn) => {
    if (c.ready) fn(c);
    else c.waits.push(fn);
  };
  // a one-shot now (the clip library's, or its own), the layer kept for it till it's played
  c.play = (clip, o = {}) => {
    if (!st) return Promise.resolve('cut');
    const layer = o.layer ?? 'full';
    st.busy[layer] = clip;
    st.at[layer] = null;
    const done = st.anim.play(clip, { ...o, layer });
    done.then(() => {
      if (st && st.busy[layer] === clip) st.busy[layer] = null;
    });
    return done;
  };
  c.stop = (layer = 'full', fade = 0.25) => {
    if (!st) return;
    st.busy[layer] = null;
    st.at[layer] = null;
    st.anim.stop(layer, fade);
  };
  c.react = (event, ctx = {}) => (st ? st.calls.react(event, ctx) : null);
  c.bone = (n) => st?.model.getObjectByName(n) ?? null;
  // something the toy held (an umbrella, a carrot), into the cast's hand
  // once it's here, through lib/three/held.js: its kind from its
  // userData.held (else a sword's grip), in the hand its kind says unless
  // the town names one, as long as it was in the toy's
  c.hold = (obj, boneName = null) =>
    c.onReady(() => {
      if (!st || !obj) return;
      const kind = obj.userData.held?.kind ?? 'sword';
      obj.parent?.updateWorldMatrix(true, false);
      const scale = obj.parent ? obj.parent.getWorldScale(_s).x : 1;
      const side = boneName ? (/^Left/.test(boneName) ? 'left' : 'right') : undefined;
      const h = holdItem({ model: st.model, anim: st.anim }, obj, kind, { hand: side, scale, curl: role === 'lead' || role === 'cast' });
      if (!h) return;
      c.holds.push(h);
      obj.visible = true;
    });
  c.greet = () => {
    if (!st || st.busy.upper || st.busy.full) return;
    const still = Math.hypot(st.m.speed, st.m.side) < 0.1 * st.k && !c.sitting && !c.want.base;
    c.play(c.greetOf.clip, { layer: still && !c.greetOf.loop ? 'full' : 'upper' });
  };
  // the toy shown in its place for a while (Gorgoroth's hobbits, hidden
  // under their cloaks as a pair of rocks), and the cast again after
  c.showToy = (on) => {
    if (!st || st.toyShown === Boolean(on)) return;
    st.toyShown = Boolean(on);
    st.holder.visible = !on;
    for (const o of toy) o.visible = Boolean(on);
  };
  c.dispose = () => {
    if (c.disposed) return;
    c.disposed = true;
    live.delete(c);
    if (!st) return;
    for (const h of c.holds.splice(0)) h.release();
    st.anim.dispose();
    st.holder.removeFromParent();
    for (const mm of st.materials) mm.dispose();
    st = null;
  };
  c.tick = (dt, camera = null, rate = 1) => tickOne(dt, camera, rate);
  // (what it's drawn with, once it's here: for the tests and a look in the console)
  Object.defineProperty(c, 'body', { get: () => st });
  f.cast = c;

  template(name).then((tpl) => {
    if (!tpl || c.disposed || f.cast !== c) return;
    const { model, materials } = copyOf(tpl, tintHex);
    const k = height / Math.max(tpl.top, 1e-3);
    model.scale.setScalar(k);
    model.position.y = -tpl.ground * k;
    const holder = new THREE.Group();
    holder.name = `cast:${name}`;
    holder.rotation.y = face;
    holder.add(model);
    f.group.add(holder);
    holder.updateMatrixWorld(true);
    const anim = createAnimator(model, { clips: tpl.own, hipsY: tpl.hipsY, up: tpl.up, key: `me:${name}:${k.toFixed(2)}`, seed: s, unit: k });
    const calls = animatorCalls(anim, { model, seed: s, own: Object.keys(tpl.own) });
    if (m.fidgets.length && role !== 'lead') anim.idles({ fidgets: m.fidgets, every: [8, 18] });
    const strides = anim.loco?.strides ?? {};
    st = {
      holder,
      model,
      anim,
      calls,
      materials,
      k,
      hips: model.getObjectByName('Hips'),
      walkV: strides.walk?.speed ?? 0.9 * k,
      runV: strides.run?.speed ?? 2.6 * k,
      m: { speed: 0, side: 0, turn: 0 },
      prev: null,
      busy: { full: null, upper: null },
      down: false,
      at: { full: null, upper: null }, // the loop each layer's playing at the town's ask
      baseAt: null,
      seat: 0, // how far the figure's lifted to sit where the toy sat
      seatHip: null, // its hips' height in its clip, sat
      drop: 0,
      waveHold: 0,
      waveFor: 0,
      talkHold: 0,
      waved: false,
      lookAt: null,
      lookPoint: new V(),
      lookOn: false,
    };
    // Frodo's Ring, on his waistcoat: to the cast's chest, so the towns' showing it still shows
    if (f.ringMesh) {
      const chest = model.getObjectByName('Spine02') ?? st.hips;
      if (chest) {
        anim.update(0);
        holder.updateMatrixWorld(true);
        chest.getWorldPosition(_p);
        const ahead = new V(0, 0, 1).transformDirection(model.matrixWorld);
        f.ringMesh.position.copy(f.group.worldToLocal(_p.addScaledVector(ahead, 0.14 * k * f.group.getWorldScale(new V()).x)));
        f.ringMesh.parent?.remove(f.ringMesh);
        f.group.add(f.ringMesh);
        chest.attach(f.ringMesh);
      }
    }
    for (const o of toy) o.visible = false;
    // what the toy held (a staff, a sword, a bow, a brand, a lantern): the
    // cast has none of its own, so they go to its hands
    // (each to the hand its kind says: an elf's bow to the left)
    for (const arm of f.arms ?? []) for (const o of [...(arm?.children ?? [])]) if (!o.isMesh && o.children.length) c.hold(o);
    // its first pose now, so it's never seen in its bind pose
    anim.update(0);
    c.ready = true;
    live.add(c);
    for (const fn of c.waits.splice(0)) fn(c);
  });

  // ── a frame ──
  function lookPoint(target, out) {
    if (!target) return null;
    if (target.isVector3) return out.copy(target);
    if (target.isObject3D) return target.getWorldPosition(out);
    if (target.head?.isObject3D) return target.head.getWorldPosition(out);
    if (target.group?.isObject3D) return target.group.getWorldPosition(out).setY(out.y + (target.top ?? 1.4) * 0.85);
    if (Number.isFinite(target.x) && Number.isFinite(target.z)) {
      // level with its own eyes when there's no height
      if (Number.isFinite(target.y)) return out.set(target.x, target.y, target.z);
      f.group.getWorldPosition(out);
      return out.set(target.x, out.y + height * f.group.getWorldScale(_s).y * 0.82, target.z);
    }
    return null;
  }
  function tickOne(dt, camera, lod) {
    if (!st || c.disposed) return;
    if (!shown(f.group)) {
      st.prev = null;
      return;
    }
    const { holder, anim, calls, k } = st;
    holder.updateWorldMatrix(true, false);
    const e = holder.matrixWorld.elements;
    const sc = Math.hypot(e[8], e[9], e[10]) || 1;
    // where it went since last frame, in its own units: its ground speed and turn
    const now = { x: e[12] / sc, z: e[14] / sc, yaw: Math.atan2(-e[10], e[8]) };
    const raw = motionFrom(st.prev, now, dt, { teleport: TELEPORT });
    st.prev = now;
    const ke = 1 - Math.exp(-(dt > 0 ? dt : 0) * 14);
    for (const key of ['speed', 'side', 'turn']) st.m[key] += (raw[key] - st.m[key]) * ke;
    const ground = Math.hypot(st.m.speed, st.m.side);
    const moving = ground > 0.08 * k;

    // the base: sat (where the toy sat), lying, crouched, or on its feet
    const base = c.want.base ?? (c.sitting ? (c.sitHow === 'floor' ? 'sit.floor' : 'sit') : null);
    if (base !== st.baseAt) {
      st.baseAt = base;
      st.seatHip = null;
      calls.base(base).then((r) => {
        if (r !== 'done' || !st || st.baseAt !== base || !SITS.has(base) || !st.hips) return;
        // where its hips are, sat (the clip's), to put them where the toy's were
        st.hips.getWorldPosition(_p);
        holder.worldToLocal(_p);
        st.seatHip = _p.y;
      });
    }
    // the hips to where the toy's were (the town put its seat there), or where it says
    const hip = c.want.seat ?? f.baseY;
    const seatWant = st.seatHip != null && hip != null ? hip - st.seatHip + (base === 'sit.floor' ? 0.09 : 0.05) * k : 0;
    st.seat += (seatWant - st.seat) * Math.min(1, (dt > 0 ? dt : 0) * 5);

    // knocked down: a flinch, then the fall, held there; up again when it's over
    if (c.want.down && !st.down) {
      st.down = true;
      const fall = c.want.fall ?? 'knockdown';
      st.busy.full = fall;
      st.at.full = null;
      anim.queue([...(c.want.flinch ? [{ play: c.want.flinch, layer: 'full', fade: 0.1 }] : []), { play: fall, layer: 'full', hold: true, fade: 0.12 }]);
    } else if (!c.want.down && st.down) {
      st.down = false;
      st.busy.full = null;
      if (c.want.rise) c.play(c.want.rise, { layer: 'full', fade: 0.2 });
      else anim.stop('full', 0.5);
    }
    // the whole body: a town's loop (a dance, a kneel), unless a one-shot has it
    const full = c.want.full ?? (c.dancing ? c.danceClip : null);
    if (!st.busy.full && full !== st.at.full) {
      st.at.full = full;
      if (full) anim.play(full, { layer: 'full', loop: true, fade: 0.35 });
      else anim.stop('full', 0.35);
    }
    // the upper body: a town's loop, else a wave while it's up, else talk while a line plays
    const waving = c.opts.wave > 0.05;
    const talking = c.opts.talk > 0.05;
    st.waveHold = waving ? 0.35 : Math.max(0, st.waveHold - dt);
    st.talkHold = talking ? 0.3 : Math.max(0, st.talkHold - dt);
    // (a wave kept up for a whole line is a wave and then the talk: no one waves through a conversation)
    st.waveFor = st.waveHold > 0 ? st.waveFor + dt : 0;
    let upper = c.want.upper ?? null;
    if (!upper && st.waveHold > 0) {
      if (c.greetOf.loop && st.waveFor < WAVE_FOR) upper = c.greetOf.clip;
      else if (!c.greetOf.loop && !st.waved) c.greet();
    }
    st.waved = st.waveHold > 0;
    // (sat, it talks as the sat talk: its arms and shoulders, its legs left where they are)
    if (!upper && st.talkHold > 0) upper = SITS.has(base) && base !== 'sleep' && base !== 'lie' ? 'sit.talk' : c.talkClip;
    if (!st.busy.upper && upper !== st.at.upper) {
      st.at.upper = upper;
      if (upper) anim.play(upper, { layer: 'upper', loop: true, fade: 0.3 });
      else anim.stop('upper', 0.3);
    }

    // where it looks
    const target = c.want.look ? lookPoint(c.want.look, _t) : null;
    const inRange = target && (c.want.range === Infinity || f.group.getWorldPosition(_s).distanceTo(target) <= c.want.range);
    if (inRange) {
      if (!st.lookOn || st.lookPoint.distanceToSquared(target) > 0.04) {
        st.lookPoint.copy(target);
        calls.look(st.lookPoint);
      }
      st.lookOn = true;
    } else if (st.lookOn) {
      st.lookOn = false;
      calls.look(null);
    }

    // crouched: the knees bent, the figure lowered by what they took
    const crouch = c.want.crouch ? 0.19 : 0;
    const motion = { move: moveFor(ground, st.walkV, st.runV), speed: st.m.speed, side: st.m.side, turn: st.m.turn, down: crouch, air: c.want.air ?? 0 };
    anim.locomote(motion);
    calls.tick(dt, moving);
    let rate = lod;
    if (camera && budget && rate > 0) {
      holder.getWorldPosition(_p);
      _sphere.set(_p, height * sc * 1.2);
      rate = budget.rate(_p, camera, _frustum.intersectsSphere(_sphere));
    }
    anim.update(dt, { lodRate: rate });
    st.drop += ((anim.loco?.drop ?? 0) - st.drop) * Math.min(1, (dt > 0 ? dt : 0) * 10);
    holder.position.y = st.seat - st.drop;
    holder.updateMatrixWorld(true);
    holder.getWorldQuaternion(_q);
    _frame.forward.set(0, 0, 1).applyQuaternion(_q);
    _frame.up.set(0, 1, 0).applyQuaternion(_q);
    anim.after(dt, motion, _frame);
    // what's in its hands carried over that: the arm still under a staff,
    // a tankard level; left to the clip on the whole body, sat or down, or
    // a drink at its lips
    if (c.holds.length) {
      const busy = Boolean(st.busy.full || st.at.full || st.down || SITS.has(base) || /drink/.test(st.busy.upper ?? st.at.upper ?? ''));
      for (const h of c.holds) h.update(dt, { moving, busy });
    }
  }
  return f;
}

export function castFigure(f, id, look = null, opts = {}) {
  return upgrade(f, castFor(id, look, opts), { look, ...opts });
}

export function tickCast(root, camera, dt) {
  const tier = typeof window === 'undefined' ? 'high' : device().tier;
  budget ??= createAnimBudget({ near: 14, far: 50, max: MAX[tier] ?? 24 });
  budget.frame();
  if (camera) {
    camera.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  for (const c of live) {
    if (c.manual || (root && !under(c.f.group, root))) continue;
    c.tick(dt, camera);
  }
}

export function releaseCast(root) {
  for (const c of [...live]) if (!root || under(c.f.group, root)) c.dispose();
}

// one of a town's people, as the walker comes by
export function attend(p, h, home, dt, { who = null, near = 5, rate = 4, greet = true } = {}) {
  const g = p.group;
  const dx = h.x - g.position.x;
  const dz = h.z - g.position.z;
  const d = Math.hypot(dx, dz);
  const c = p.cast;
  if (!c?.ready) {
    // the toy: its whole self round to the walker, as the towns always had it
    const want = d < near ? Math.atan2(-dz, dx) : home;
    g.rotation.y += wrap(want - g.rotation.y) * Math.min(1, dt * rate);
    if (c) c.greeter(d);
    return d;
  }
  if (d < near) {
    // the head to the walker; the body round only past what a neck can turn
    const want = Math.atan2(-dz, dx);
    const off = Math.abs(wrap(want - g.rotation.y));
    if (off > 1.05) c.turning = true;
    else if (off < 0.3) c.turning = false;
    if (c.turning) g.rotation.y = easeYaw(g.rotation.y, want, dt, 3.2);
    c.set({ look: who ?? { x: h.x, z: h.z } });
    c.attending = true;
  } else {
    if (c.attending) c.set({ look: null });
    c.attending = false;
    c.turning = false;
    g.rotation.y = easeYaw(g.rotation.y, home, dt, 1.6);
  }
  if (c.greeter(d) && greet) c.greet();
  return d;
}

// One of a company following on the trail (Rivendell's Nine, Moria's,
// Lórien's): drawn walking to its place in the line at its own pace,
// easing in and out, a little apart from the others, rather than set on
// the trail point every frame (the rules' place for it is unchanged; this
// is only where it's drawn). p.drawn: { x, z, v, face }. at: the rules'
// place ({ x, z, face }); others: who it keeps apart from (figures with
// `drawn`, or { x, z }). Returns p.drawn.
export function followDrawn(p, at, dt, { others = [], spacing = 0.75, snap = 6, pace = null } = {}) {
  const d = p.drawn;
  if (!d || Math.hypot(at.x - d.x, at.z - d.z) > snap) {
    p.drawn = { x: at.x, z: at.z, v: 0, face: Number.isFinite(at.face) ? at.face : p.group.rotation.y, ax: at.x, az: at.z, line: 0 };
    return p.drawn;
  }
  // how fast its place in the line is going
  const lv = dt > 0 ? Math.hypot(at.x - d.ax, at.z - d.az) / dt : 0;
  const line = d.line + (Math.min(lv, 20) - d.line) * Math.min(1, dt * 6);
  const mine = pace ?? 0.94 + ((Math.abs(seedOf(p.group.name || 'f', 0)) % 100) / 100) * 0.12;
  const near = others.map((o) => o.drawn ?? o.group?.position ?? o).filter((o) => o && o !== d);
  const n = stepFollower(d, { x: at.x, z: at.z, speed: line }, near, dt, { spacing, pace: mine });
  // stopped: round to face the way the line does
  if (n.v < 0.25 && Number.isFinite(at.face)) n.face = easeYaw(n.face, at.face, dt, 2.5);
  p.drawn = Object.assign(n, { ax: at.x, az: at.z, line });
  return p.drawn;
}

// A fighter in a scrap (Moria's chamber, the goblins in it): turned to its
// foe over a moment, its eyes on it, and a blow from its own moves every
// so often (each its own beat, from its seed), on the whole body when it
// stands and the upper when it's on the move. Drawn only: no one is hurt.
// A toy does nothing here (the town's old arm-up stands in). `at`: where
// the foe is in the fighter's parent's space, when they're not in one
// space (the foe itself is still where the eyes go). Returns whether it
// struck this frame.
const MOVES = {
  aragorn: ['parry', 'cross', 'block', 'jab'],
  boromir: ['parry', 'cross', 'kick', 'block'],
  legolas: ['shoot', 'kick', 'dodge'],
  gimli: ['cross', 'uppercut', 'kick'],
  gandalf: ['cast', 'parry'],
  gandalfwhite: ['cast', 'parry'],
  goblin: ['jab', 'cross', 'kick', 'jab.guard'],
  orc: ['jab', 'cross', 'kick'],
  uruk: ['cross', 'kick', 'uppercut'],
  easterling: ['jab', 'block', 'kick'],
};
export function fight(p, foe, dt, { moves = null, every = [1.1, 2.3], turnRate = 5, at: where = null } = {}) {
  const c = p?.cast;
  if (!c?.ready || !foe) return false;
  const g = p.group;
  // (where the foe stands in the fighter's own parent's space, when that's not the foe's)
  const at = where ?? foe.group?.position ?? foe.position ?? foe;
  g.rotation.y = easeYaw(g.rotation.y, Math.atan2(-(at.z - g.position.z), at.x - g.position.x), dt, turnRate);
  c.set({ look: foe.group ?? foe });
  const list = moves ?? MOVES[c.name] ?? ['block', 'jab', 'dodge'];
  // (its own beat: from its seed, so a scrap of one kind isn't all in step)
  const r = (n) => (Math.abs(seedOf(c.name, c.seed + (c.blows ?? 0) * 7 + n)) % 1000) / 1000;
  c.fightT ??= every[0] * r(7);
  c.fightT -= dt;
  if (c.fightT > 0 || c.body?.busy.full) return false;
  c.blows = (c.blows ?? 0) + 1;
  c.fightT = every[0] + (every[1] - every[0]) * r(3);
  const moving = Math.hypot(c.body.m.speed, c.body.m.side) > 0.3 * c.body.k;
  c.play(list[Math.floor(r(5) * list.length) % list.length], { layer: moving ? 'upper' : 'full', fade: 0.12 });
  return true;
}

// A watcher (towns/watchers.js: Uruks, Easterlings, orcs, Boromir) drawn on
// the cast: its feet on its patrol and its chase as it really goes, its
// head sweeping at its corners and fixed on you once it has you, searching
// as it walks over to look and looking round where it stands (watchPose),
// a shout on seeing you and a blow on catching you, once each, never a
// swing looped through the chase. Drawn only. `you`: what it stares at (a
// figure); `shout`, `blow`: its own, else its kind's. Returns whether it's
// on the cast (a toy's left to the town's old pose).
const _w = new V();
export function drawWatcher(p, w, dt, { you = null, shout = null, blow = null } = {}) {
  const c = p?.cast;
  if (!c?.ready || !w) return false;
  const was = c.watchMode ?? null;
  c.watchMode = w.mode;
  const wp = watchPose(w, was);
  let look = null;
  if (wp.head === 'you') look = you;
  else if (wp.head === 'about' && Math.abs(w.look ?? 0) > 0.05) {
    // a point a few strides off, the way its look turns it
    p.group.getWorldPosition(_w);
    const a = p.group.rotation.y + (w.look ?? 0);
    look = { x: _w.x + Math.cos(a) * 4, z: _w.z - Math.sin(a) * 4 };
  }
  c.set({ upper: wp.upper, look });
  if (wp.enter === 'alert') c.play(shout ?? (c.name === 'boromir' ? 'alert' : 'shout'), { layer: 'upper', fade: 0.1 });
  if (wp.enter === 'caught') c.play(blow ?? (MOVES[c.name]?.[0] === 'parry' ? 'cross' : (MOVES[c.name]?.[0] ?? 'jab')), { layer: 'full', fade: 0.08 });
  return true;
}

export const castDo = (f, wants) => f?.cast?.set(wants);
export const castPlay = (f, clip, opts) => f?.cast?.play(clip, opts) ?? Promise.resolve('cut');
export const castReact = (f, event, ctx) => f?.cast?.react(event, ctx) ?? null;
export const onCast = (f) => Boolean(f?.cast?.ready);
