// Meshy's animation library on the compound's own people. Thor, Natasha and
// the Hulk came from Sketchfab rigged three other ways (Mixamo's names, an
// Unreal game's, Auto-Rig Pro's), so the library's clips (made on Meshy's
// skeleton: lib/three/clipLibrary.js) can't be copied onto them bone for
// bone, as they are between Meshy figures: a turn means something else on
// each rig's bones. This makes a clip for another rig by where each part
// points, as scripts/sketchfab-avengers.mjs's retarget made Spider-Man's
// moves, but here at run time: each of the figure's bones is first swung
// to point the way the same part of Meshy's skeleton points at rest, then
// turned in the world as the clip turns that part from its rest; the hips
// are carried as far across the ground as the clip carries Meshy's, scaled
// to the figure's height, and held at the height that puts its feet where
// the clip has Meshy's (on the ground standing, off it in a hop), whatever
// its legs' length and how far apart they rest. So a push-up is a push-up
// on Thor's rig, the Hulk's and Natasha's, whatever their rest poses and
// their bones' axes, and a wave doesn't sink the Hulk's feet into the lawn.
//
//   rigOf(root) → { family, bones: { slot: Object3D } } | null   the parts
//     of a figure by what they are (hips, spine, chest, upperChest, neck,
//     head, shoulderL, armL, elbowL, handL, thighL, kneeL, footL, toeL, and
//     the right's), for Meshy's, Mixamo's, Unreal's and Auto-Rig Pro's names
//   borrowClip(src, clip, dst, { name, fps = 30, place = 'start', ground =
//     true }) → AnimationClip | null   `clip`, made on `src` (a figure on
//     Meshy's skeleton, at rest), for `dst` (a figure on any rig above, at
//     rest); neither figure is changed. place: 'start' takes the hips' way
//     across the ground at the first frame out (it starts where the figure
//     stands), 'loop' its drift over the clip as well (its end meets its
//     start), 'none' neither. ground: the hips' height from the feet, as
//     above (false: the clip's own rise and fall, scaled). Null when either
//     rig isn't one it knows.
//   borrowFor(template, name) → Promise<AnimationClip | null>   the library's
//     clip `name` (clipLibrary's CLIPS) for a template (people.js's
//     loadPerson: { scene, clips }), made once per template and name, one
//     at a time between frames
//   centred(clip, root, { within = 0.1 }) → AnimationClip   one of a
//     figure's own in-place clips with its feet, on average, where they
//     rest (Thor's and Natasha's idles stand a metre to one side of their
//     walks: crossing from one to the other slid them across the lawn, and
//     a turn swung them round in an arc); the same clip when it's already
//     within `within` metres, or has no hips' track to move
//   centredClips(template) → its clips so, made once a template
//
// Only the bones it knows on both rigs are moved; any others (fingers, the
// Hulk's twist and volume bones, Natasha's face) ride on them as they rest.

import * as THREE from 'three';
import { CLIPS } from '../../../lib/three/clipLibrary';
import { loadGLTF } from '../../../lib/three/gltfCache';

export const SLOTS = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'shoulderL', 'armL', 'elbowL', 'handL', 'shoulderR', 'armR', 'elbowR', 'handR', 'thighL', 'kneeL', 'footL', 'toeL', 'thighR', 'kneeR', 'footR', 'toeR'];

// The limbs as each rig names them; the right side is the left's with its
// side swapped. `has`: names only that rig uses, to tell it.
const LIMBS_LR = (side) => ({
  meshy: { shoulder: `${side}Shoulder`, arm: `${side}Arm`, elbow: `${side}ForeArm`, hand: `${side}Hand`, thigh: `${side}UpLeg`, knee: `${side}Leg`, foot: `${side}Foot`, toe: `${side}ToeBase` },
  unreal: { shoulder: `clavicle_${side[0].toLowerCase()}`, arm: `upperarm_${side[0].toLowerCase()}`, elbow: `lowerarm_${side[0].toLowerCase()}`, hand: `hand_${side[0].toLowerCase()}`, thigh: `thigh_${side[0].toLowerCase()}`, knee: `calf_${side[0].toLowerCase()}`, foot: `foot_${side[0].toLowerCase()}`, toe: `ball_${side[0].toLowerCase()}` },
  arp: { shoulder: `shoulder_${side[0].toLowerCase()}`, arm: `arm_stretch_${side[0].toLowerCase()}`, elbow: `forearm_stretch_${side[0].toLowerCase()}`, hand: `hand_${side[0].toLowerCase()}`, thigh: `thigh_stretch_${side[0].toLowerCase()}`, knee: `leg_stretch_${side[0].toLowerCase()}`, foot: `foot_${side[0].toLowerCase()}`, toe: `toes_01_${side[0].toLowerCase()}` },
});
const limbs = (family) => {
  const out = {};
  for (const [side, S] of [
    ['Left', 'L'],
    ['Right', 'R'],
  ]) {
    const named = LIMBS_LR(side)[family === 'mixamo' ? 'meshy' : family];
    for (const [k, v] of Object.entries(named)) out[`${k}${S}`] = [v];
  }
  return out;
};
const FAMILIES = [
  // Meshy's: its spine numbered from the top down (Spine02 is the lowest)
  { family: 'meshy', has: ['spine02', 'neck'], slots: { hips: ['Hips'], spine: ['Spine02'], chest: ['Spine01'], upperChest: ['Spine'], neck: ['neck'], head: ['Head'], ...limbs('meshy') } },
  // Mixamo's (Thor), its prefix taken off
  { family: 'mixamo', has: ['spine1', 'hips'], slots: { hips: ['Hips'], spine: ['Spine'], chest: ['Spine1'], upperChest: ['Spine2'], neck: ['Neck'], head: ['Head'], ...limbs('mixamo') } },
  // Unreal's mannequin (the Hulk, from Marvel Rivals)
  { family: 'unreal', has: ['pelvis', 'upperarm_l'], slots: { hips: ['pelvis'], spine: ['spine_01'], chest: ['spine_03', 'spine_02'], upperChest: ['spine_05', 'spine_04'], neck: ['neck_01'], head: ['head'], ...limbs('unreal') } },
  // Auto-Rig Pro's deforming bones (Natasha)
  { family: 'arp', has: ['root_x', 'spine_01_x'], slots: { hips: ['root_x'], spine: ['spine_01_x'], chest: ['spine_02_x'], upperChest: ['spine_03_x'], neck: ['neck_x'], head: ['head_x'], ...limbs('arp') } },
];
// the part each one points at (its direction), and the one before it
const NEXT = { hips: 'spine', spine: 'chest', chest: 'upperChest', upperChest: 'neck', neck: 'head', shoulderL: 'armL', armL: 'elbowL', elbowL: 'handL', shoulderR: 'armR', armR: 'elbowR', elbowR: 'handR', thighL: 'kneeL', kneeL: 'footL', footL: 'toeL', thighR: 'kneeR', kneeR: 'footR', footR: 'toeR' };
const PREV = { spine: 'hips', chest: 'spine', upperChest: 'chest', neck: 'upperChest', head: 'neck', shoulderL: 'upperChest', armL: 'shoulderL', elbowL: 'armL', handL: 'elbowL', shoulderR: 'upperChest', armR: 'shoulderR', elbowR: 'armR', handR: 'elbowR', thighL: 'hips', kneeL: 'thighL', footL: 'kneeL', toeL: 'footL', thighR: 'hips', kneeR: 'thighR', footR: 'kneeR', toeR: 'footR' };

// a name without Mixamo's prefix or the number a download appended
const plain = (n) =>
  n
    .replace(/^mixamorig\d*[:_]?/i, '')
    .replace(/_\d+$/, '')
    .toLowerCase();

export function rigOf(root) {
  if (!root) return null;
  const exact = new Map();
  const loose = new Map();
  root.traverse((o) => {
    if (o === root || !o.name) return;
    // (a bone ahead of anything else of the same name)
    if (!exact.has(o.name) || (o.isBone && !exact.get(o.name).isBone)) exact.set(o.name, o);
    const k = plain(o.name);
    if (!loose.has(k) || (o.isBone && !loose.get(k).isBone)) loose.set(k, o);
  });
  const find = (n) => exact.get(n) ?? loose.get(plain(n)) ?? null;
  const fam = FAMILIES.find((f) => f.has.every((n) => loose.has(n)));
  if (!fam) return null;
  const bones = {};
  const used = new Set();
  for (const slot of SLOTS) {
    const b = (fam.slots[slot] ?? []).map(find).find((x) => x && !used.has(x));
    if (!b) continue;
    bones[slot] = b;
    used.add(b);
  }
  return bones.hips ? { family: fam.family, bones } : null;
}

const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// each slot's turn and place at rest, in its figure's own space
function restOf(root, bones, slots) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const q = {};
  const p = {};
  for (const s of slots) {
    _m.multiplyMatrices(inv, bones[s].matrixWorld);
    _m.decompose((p[s] = new THREE.Vector3()), (q[s] = new THREE.Quaternion()), _s);
  }
  return { inv, q, p };
}
// a node's turn in its figure's space, as it stands now
const turnIn = (inv, node, out = new THREE.Quaternion()) => {
  _m.multiplyMatrices(inv, node.matrixWorld);
  _m.decompose(_p, out, _s);
  return out;
};
// which way a figure faces (about the vertical, from +z): across its hips
// (or shoulders) from right to left, turned a quarter
function facing(P) {
  const a = P.thighL && P.thighR ? P.thighL.clone().sub(P.thighR) : P.armL && P.armR ? P.armL.clone().sub(P.armR) : null;
  if (!a || Math.hypot(a.x, a.z) < 1e-6) return 0;
  return Math.atan2(-a.z, a.x);
}
// the hips' height over the feet (or over the figure's floor)
const hipHeight = (P) => P.hips.y - (P.footL && P.footR ? (P.footL.y + P.footR.y) / 2 : 0);
const depth = (o, root) => {
  let d = 0;
  for (let p = o.parent; p && p !== root; p = p.parent) d++;
  return d;
};

export function borrowClip(src, clip, dst, { name = clip?.name ?? 'borrowed', fps = 30, place = 'start', ground = true } = {}) {
  if (!clip || !src || !dst) return null;
  const S = rigOf(src);
  const D = rigOf(dst);
  if (!S || !D) return null;
  const slots = SLOTS.filter((s) => S.bones[s] && D.bones[s]);
  if (!slots.includes('hips')) return null;
  const sr = restOf(src, S.bones, slots);
  const dr = restOf(dst, D.bones, slots);

  // the clip's turn about the vertical, to face the way the figure does
  const F = new THREE.Quaternion().setFromAxisAngle(Y, facing(dr.p) - facing(sr.p));
  const Fi = F.clone().invert();
  // each bone swung from its rest to point the way Meshy's does at rest
  const swing = {};
  const dir = (P, s) => (NEXT[s] && slots.includes(NEXT[s]) ? P[NEXT[s]].clone().sub(P[s]) : null);
  for (const s of slots) {
    const ds = dir(sr.p, s)?.applyQuaternion(F);
    const dd = dir(dr.p, s);
    if (ds && dd && ds.lengthSq() > 1e-12 && dd.lengthSq() > 1e-12) swing[s] = new THREE.Quaternion().setFromUnitVectors(dd.normalize(), ds.normalize());
    else {
      let up = PREV[s];
      while (up && !swing[up]) up = PREV[up];
      swing[s] = up ? swing[up].clone() : new THREE.Quaternion();
    }
  }
  // want = F · now · rest⁻¹ · F⁻¹ · swing · dstRest: all but `now` the same every frame
  const K = {};
  for (const s of slots) K[s] = sr.q[s].clone().invert().multiply(Fi).multiply(swing[s]).multiply(dr.q[s]);
  // The target's slots parent first, each with the slot it hangs from (its
  // parent's turn is that one's times a fixed offset: anything between
  // them stays as it rests) or, for the hips, its parent's turn at rest.
  const slotOf = new Map(slots.map((s) => [D.bones[s], s]));
  const order = slots.slice().sort((a, b) => depth(D.bones[a], dst) - depth(D.bones[b], dst));
  const hang = {};
  for (const s of order) {
    const parent = D.bones[s].parent;
    let a = parent;
    while (a && a !== dst && !slotOf.has(a)) a = a.parent;
    const parentQ = parent && parent !== dst ? turnIn(dr.inv, parent) : new THREE.Quaternion();
    if (a && slotOf.has(a)) {
      const anc = slotOf.get(a);
      hang[s] = { anc, off: dr.q[anc].clone().invert().multiply(parentQ) };
    } else hang[s] = { anc: null, off: parentQ };
  }
  // the hips' place, into their parent's space
  const hipsBone = D.bones.hips;
  const hipsParent = hipsBone.parent && hipsBone.parent !== dst ? new THREE.Matrix4().multiplyMatrices(dr.inv, hipsBone.parent.matrixWorld).invert() : new THREE.Matrix4();
  const k = hipHeight(dr.p) / Math.max(1e-6, hipHeight(sr.p));
  // The feet (and toes) both have, for the hips' height: each one's place
  // from the slot it hangs from, in that one's frame (fixed: what's between
  // them rests), so where they are under the hips is worked out frame by
  // frame from the turns alone; and the lowest of them at rest on each.
  const FEET = ground ? ['footL', 'toeL', 'footR', 'toeR'].filter((s) => slots.includes(s)) : [];
  const legOff = {};
  for (const s of slots) {
    const a = hang[s].anc;
    if (a) legOff[s] = dr.p[s].clone().sub(dr.p[a]).applyQuaternion(dr.q[a].clone().invert());
  }
  const reaches = (s) => {
    for (let x = s; x; x = hang[x].anc) if (x === 'hips') return true;
    return false;
  };
  const feet = FEET.filter(reaches);
  const lowRest = (P) => Math.min(...feet.map((s) => P[s].y));
  const srcLow = feet.length ? lowRest(sr.p) : 0;
  const dstLow = feet.length ? lowRest(dr.p) : 0;
  const rel = {};
  const relOf = (s) => {
    if (s === 'hips') return (rel.hips ??= new THREE.Vector3()).set(0, 0, 0);
    const a = hang[s].anc;
    const v = (rel[s] ??= new THREE.Vector3());
    return v.copy(legOff[s]).applyQuaternion(W[a]).add(relOf(a));
  };
  const heights = []; // the hips' height (figure space) a frame, when the feet set it

  // the clip's tracks on the source's nodes, each with its own interpolant
  const nodes = new Map();
  src.traverse((o) => o.name && !nodes.has(o.name) && nodes.set(o.name, o));
  const tracks = [];
  for (const tr of clip.tracks) {
    const i = tr.name.lastIndexOf('.');
    const node = nodes.get(tr.name.slice(0, i));
    const path = tr.name.slice(i + 1);
    if (!node || (path !== 'quaternion' && path !== 'position')) continue;
    tracks.push({ node, path, at: tr.createInterpolant(), was: node[path].clone() });
  }

  const dur = clip.duration;
  const n = Math.max(2, Math.round(dur * fps) + 1);
  const times = new Float32Array(n);
  const qv = Object.fromEntries(slots.map((s) => [s, new Float32Array(n * 4)]));
  const travel = [];
  const W = {};
  const now = new THREE.Quaternion();
  const hp = new THREE.Vector3();
  const local = new THREE.Quaternion();
  const prev = Object.fromEntries(slots.map((s) => [s, null]));
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? (dur * i) / (n - 1) : 0;
    times[i] = t;
    for (const tr of tracks) {
      const v = tr.at.evaluate(t);
      if (tr.path === 'quaternion') tr.node.quaternion.set(v[0], v[1], v[2], v[3]).normalize();
      else tr.node.position.set(v[0], v[1], v[2]);
    }
    src.updateMatrixWorld(true);
    for (const s of order) {
      turnIn(sr.inv, S.bones[s], now);
      const want = (W[s] ??= new THREE.Quaternion()).copy(F).multiply(now).multiply(K[s]);
      const h = hang[s];
      const parentQ = h.anc ? local.copy(W[h.anc]).multiply(h.off) : local.copy(h.off);
      const q = parentQ.invert().multiply(want).normalize();
      // the short way round from the frame before, so it never spins
      if (prev[s] && prev[s].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      (prev[s] ??= new THREE.Quaternion()).copy(q);
      qv[s].set([q.x, q.y, q.z, q.w], i * 4);
    }
    _m.multiplyMatrices(sr.inv, S.bones.hips.matrixWorld);
    hp.setFromMatrixPosition(_m);
    travel.push(hp.clone().sub(sr.p.hips).multiplyScalar(k).applyQuaternion(F));
    if (feet.length) {
      // its lowest foot as far off the ground as Meshy's lowest is (scaled)
      let low = Infinity;
      let mine = Infinity;
      for (const s of feet) {
        _m.multiplyMatrices(sr.inv, S.bones[s].matrixWorld);
        low = Math.min(low, _p.setFromMatrixPosition(_m).y);
        mine = Math.min(mine, relOf(s).y);
      }
      heights.push(dstLow + (low - srcLow) * k - mine);
    }
  }
  if (heights.length === n) travel.forEach((d, i) => (d.y = heights[i] - dr.p.hips.y));
  for (const tr of tracks) tr.node[tr.path].copy(tr.was);
  src.updateMatrixWorld(true);

  // where the hips go: the figure's rest plus the clip's travel
  if (place === 'start' || place === 'loop') {
    const first = travel[0].clone();
    const drift = place === 'loop' ? travel[n - 1].clone().sub(first) : new THREE.Vector3();
    travel.forEach((d, i) => {
      const f = n > 1 ? i / (n - 1) : 0;
      d.x -= first.x + drift.x * f;
      d.z -= first.z + drift.z * f;
    });
  }
  const pv = new Float32Array(n * 3);
  travel.forEach((d, i) => {
    const p = d.add(dr.p.hips).applyMatrix4(hipsParent);
    pv.set([p.x, p.y, p.z], i * 3);
  });
  const out = slots.map((s) => new THREE.QuaternionKeyframeTrack(`${D.bones[s].name}.quaternion`, times, qv[s]));
  out.push(new THREE.VectorKeyframeTrack(`${hipsBone.name}.position`, times, pv));
  return new THREE.AnimationClip(name, dur, out);
}

// ── a figure's own clips, stood where it rests ──

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
export function centred(clip, root, { within = 0.1, samples = 12 } = {}) {
  const R = rigOf(root);
  const hips = R?.bones.hips;
  const track = hips && clip?.tracks.find((t) => t.name === `${hips.name}.position`);
  const feet = [R?.bones.footL, R?.bones.footR];
  if (!track || !feet.every(Boolean)) return clip;
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  // the feet's midpoint, in the figure's space
  const mid = (out) => {
    out.set(0, 0, 0);
    for (const f of feet) out.add(_a.setFromMatrixPosition(_m.multiplyMatrices(inv, f.matrixWorld)));
    return out.multiplyScalar(0.5);
  };
  const rest = mid(new THREE.Vector3());
  // where the clip has them, on average: its tracks laid on the figure's
  // own nodes a few times over its length, then put back as they were
  const nodes = new Map();
  root.traverse((o) => o.name && !nodes.has(o.name) && nodes.set(o.name, o));
  const tracks = [];
  for (const tr of clip.tracks) {
    const i = tr.name.lastIndexOf('.');
    const node = nodes.get(tr.name.slice(0, i));
    const path = tr.name.slice(i + 1);
    if (node && (path === 'quaternion' || path === 'position')) tracks.push({ node, path, at: tr.createInterpolant(), was: node[path].clone() });
  }
  const mean = new THREE.Vector3();
  for (let i = 0; i < samples; i++) {
    const t = (clip.duration * i) / samples;
    for (const tr of tracks) {
      const v = tr.at.evaluate(t);
      if (tr.path === 'quaternion') tr.node.quaternion.set(v[0], v[1], v[2], v[3]).normalize();
      else tr.node.position.set(v[0], v[1], v[2]);
    }
    root.updateMatrixWorld(true);
    mean.add(mid(_b));
  }
  for (const tr of tracks) tr.node[tr.path].copy(tr.was);
  root.updateMatrixWorld(true);
  mean.divideScalar(samples);
  const off = rest.sub(mean).setY(0);
  if (Math.hypot(off.x, off.z) < within) return clip;
  // the shift, in the space the hips' track is in (its parent's)
  const toParent = new THREE.Matrix4().multiplyMatrices(inv, hips.parent.matrixWorld).invert();
  const o = _a.set(0, 0, 0).applyMatrix4(toParent);
  const d = _b.copy(off).applyMatrix4(toParent).sub(o);
  const copy = clip.clone();
  const moved = copy.tracks.find((t) => t.name === track.name);
  for (let i = 0; i < moved.values.length; i += 3) {
    moved.values[i] += d.x;
    moved.values[i + 1] += d.y;
    moved.values[i + 2] += d.z;
  }
  return copy;
}

const stood = new WeakMap(); // template → its clips, centred
export function centredClips(template) {
  if (!template?.clips) return [];
  if (!stood.has(template)) stood.set(template, template.clips.map((c) => centred(c, template.scene)));
  return stood.get(template);
}

// ── the library's clips, made for a template once each ──

// One made at a time, a frame apart: a long clip on a big rig takes a few
// milliseconds, and three people asking for six each at once would stall
// the frame they arrive in.
const waiting = [];
let draining = false;
function inTurn(fn) {
  return new Promise((resolve) => {
    waiting.push(() => {
      try {
        resolve(fn());
      } catch {
        resolve(null);
      }
    });
    if (draining) return;
    draining = true;
    const next = () => {
      const job = waiting.shift();
      if (!job) {
        draining = false;
        return;
      }
      job();
      setTimeout(next, 16);
    };
    setTimeout(next, 0);
  });
}

const made = new WeakMap(); // template → Map(name → Promise<clip | null>)
// clips made to start where the figure stands; loops made to meet themselves
export function borrowFor(template, name, { loader = null } = {}) {
  const entry = CLIPS[name];
  if (!template?.scene || !entry) return Promise.resolve(null);
  let mine = made.get(template);
  if (!mine) made.set(template, (mine = new Map()));
  if (!mine.has(name)) {
    const p = loadGLTF(entry.url, loader ? { loader } : undefined)
      .then((g) => {
        if (!g) return null;
        const clip = (entry.take ? g.animations.find((a) => a.name === entry.take) : g.animations[0]) ?? null;
        if (!clip) return null;
        // (the template is only read: its bones' places at rest)
        return inTurn(() => borrowClip(g.scene.clone(true), clip, template.scene, { name, place: entry.loop ? 'loop' : 'start' }));
      })
      .catch(() => null);
    mine.set(name, p);
    // (one that couldn't be had is asked for again next time)
    p.then((c) => !c && mine.get(name) === p && mine.delete(name));
  }
  return mine.get(name);
}
