// Things in hand: one grip for every rigged figure. The hand's own skin
// says where the palm is and which way it faces (its vertices as they were
// skinned, in the hand bone's space, so the pose the figure's in when it's
// asked doesn't matter); a table says what a kind of thing is in a hand
// (which of its axes runs through the fist, which way its top goes, one
// hand or two, how the arm carries it while the body moves); and holdItem
// puts the thing there and keeps it carried.
// (docs/superpowers/specs/2026-10-09-things-in-hand-design.md)
//
// handFrame(points, axes, body, left = false) → { along, thumb, normal, mean }
//   which way a hand is, from its vertices in its bone's space: `along` out
//   the fingers, `thumb` across the knuckles toward the thumb, `normal` out
//   of the palm, `mean` the palm's middle. `body`: { forward, inward,
//   skin } the figure's forward and the way in toward its middle; `axes`:
//   the bone's axes in the world ({ x, y, z }). The thumb goes toward
//   forward plus inward; with `skin` (gripFrame's), only when its line runs
//   within 70° of forward or back (as every such hand in the site's bind
//   poses does: on the real casts the skin reads worse there, the thumb
//   reaching in among the fingers), while a line across the body or up it
//   (a hand turned palm-up or thumb-up, where inward alone would settle
//   it) takes the skin's side first, where vertices stand out past the
//   edge of the fingers (as grip.js's handShape finds the thumb), and the
//   sum only when no side does. (gunplay leaves `skin` off: its guns are
//   as they were.)
// handPoints(root, hand) → [[x, y, z]…]: the vertices skinned to `hand`, in
//   its space as the figure stands now (gunplay measures in the bind pose)
// skinStep(n) → k: of a mesh's n vertices, every kth is read for a hand's
//   skin (every one under 16,000; the cast audit counts the same way)
// handSkinCount(model, hand) → the vertices gripFrame reads for `hand`, the
//   number it weighs against MIN_SKIN
// gripFrame(model, hand, { left, forward, inward }) → { along, thumb,
//   normal, mean, bind } | null: handFrame from the hand's skin in the bind
//   pose (the skeleton's boneInverses), `bind` the bone's bind matrix; null
//   under 40 vertices (a low-poly glove). `forward`, unless given, is the
//   rig's own in its bind pose (the head to Meshy's `headfront`, else the
//   body's left to its right crossed with up, else +z); `inward`, the hand
//   to the hips across it. Made once per model template and hand (a figure
//   cloned from the template shares it); not to be changed.
// HELD: { [kind]: { axis, up, hands, hand, carry } }
//   axis: the item's own axis through the grip ('y': built upright at its
//   origin); up: where its top goes, 'thumb' (a staff: the top past the
//   thumb), 'fingers' (a sword: out past the fingers' line), 'palm' (a
//   tray: flat on the palm); hands: 1, or 2 (a second grip, `grip2`, the
//   other hand reaches for); hand: 'right' or 'left' by default; carry:
//   { still } the arm keeps the idle over the walk (weight 0.85 moving, 0
//   standing), { upright } the wrist and forearm turned so its top points
//   up in the world (±1.2 rad bend, ±1.4 twist)
// holdItem(fig, item, kind, { hand, left, scale = 1, curl = false,
//   offset = 0.012 }) → { item, hand, kind, update(dt, { moving, busy }),
//   after(), release(), hide(on) } | null
//   fig: { model, bones?, anim? } (anim: the figure's animator, for the
//   still carry: animator.js's, or anything else with all four of
//   play(name, { layer, loop }), playing(layer), weight(layer, w) and
//   stop(layer, fade); one without them all, figureCalls' facade among
//   them, gets no still carry and nothing is called on it); item: an
//   Object3D in its own units (metres at scale 1), its grip at its origin
//   or a child named `grip`. Its grip goes to the
//   palm's middle `offset` metres out of the palm, its axis along the
//   frame's line for its `up`, set as its local transform under the hand
//   bone (so the pose at attach time doesn't matter). Without frame, the
//   forearm's: a quarter of its length past the wrist. scale: the item's
//   units to the world's. curl: the fingers closed on it (grip.js's
//   morphs, on a geometry of the figure's own; one curl a kind and a
//   hand, made once per template). The item's userData.held
//   says where it was put ({ kind, hand, bone, palm, line, grip }, in the
//   hand's and the item's spaces), for the checks. A frame, in order:
//     anim.update(dt); hold.update(dt, { moving, busy });
//     anim.after(dt, motion, frame); hold.after()
//   update sets the still carry's arm weight, which the animator's after
//   lays (so it's this frame's), and keeps `busy`; after turns the wrist
//   upright and puts the second hand on, once the animator has laid its
//   layers over them. A caller that never calls after gets both from
//   update, and calls it after the animator's after. busy (or a full-body
//   clip playing) lets the second hand go and leaves the wrist to the clip
//   (a drink to the lips, a fall). release: the item back under
//   its old parent as it was, and on a figure with no animator (nothing to
//   pose them again) the arm's bones the carry turned put back as they
//   were; hide(on): hidden while on. null: no hand bone, or no frame and
//   no forearm; nothing attached.

import * as THREE from 'three';
import { gripMorphs } from './grip';
import { palmFrame, reach, rotateWorld } from './ik';
import { findBones } from './rig';

const V = THREE.Vector3;
const Q = THREE.Quaternion;

export const MIN_SKIN = 40; // vertices on a hand to give a frame
const STILL = 0.85; // the idle's share of a still carry's arm, moving
const EASE = 6; // how fast that share comes and goes (per second)
const BEND = 1.2; // the most the wrist bends for an upright carry (rad)
const TWIST = 1.4; // the most the forearm twists for it (rad)
const RADIUS = 0.016; // a grip's radius, for the curl (m)
const FORE = 0.25; // the forearm fallback: the palm this share of the forearm past the wrist
const ACROSS = 0.35; // a thumb line nearer square to forward than this (cos) is the skin's to settle

const ANIMATOR = ['play', 'playing', 'weight', 'stop']; // what a still carry needs of fig.anim
const kind = (up, o = {}) => ({ axis: 'y', up, hands: 1, hand: 'right', carry: {}, ...o });
const UPRIGHT = { upright: true };
const PLANTED = { still: true, upright: true };
export const HELD = {
  staff: kind('thumb', { carry: PLANTED }),
  'white-staff': kind('thumb', { carry: PLANTED }),
  torch: kind('thumb', { carry: PLANTED }),
  lantern: kind('thumb', { carry: UPRIGHT }),
  cane: kind('thumb', { carry: UPRIGHT }),
  umbrella: kind('thumb', { carry: UPRIGHT }),
  tankard: kind('thumb', { carry: UPRIGHT }),
  glass: kind('thumb', { carry: UPRIGHT }),
  bottle: kind('thumb', { carry: UPRIGHT }),
  sword: kind('fingers'),
  axe: kind('fingers'),
  dagger: kind('fingers'),
  horn: kind('fingers'),
  gaffi: kind('fingers', { hands: 2 }),
  spear: kind('fingers', { hands: 2 }),
  bow: kind('thumb', { hand: 'left' }),
  tray: kind('palm', { carry: UPRIGHT }),
  plate: kind('palm', { carry: UPRIGHT }),
  bag: kind('palm', { carry: UPRIGHT }),
  portalgun: kind('fingers'),
  plumbus: kind('fingers'),
  laser: kind('fingers'),
  carrot: kind('fingers'),
  pipe: kind('fingers'),
  ring: kind('fingers'),
};

// ── the hand's frame ──

const pct = (values, f) => {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))];
};

// which way along `across` the thumb is, by the skin: +1 or −1, the side
// where vertices stand out past the edge of the fingers (the hand's outer
// half), or 0 when neither side clearly does
function thumbSide(points, along, across) {
  const dot = (p, v) => p[0] * v.x + p[1] * v.y + p[2] * v.z;
  const A = points.map((p) => dot(p, along));
  const C = points.map((p) => dot(p, across));
  const lo = pct(A, 0.01);
  const L = pct(A, 0.99) - lo;
  if (!(L > 0)) return 0;
  const fingers = C.filter((_, i) => A[i] > lo + 0.5 * L);
  const band = 0.04 * L;
  const top = pct(fingers, 0.97) + band;
  const bottom = pct(fingers, 0.03) - band;
  let plus = 0;
  let minus = 0;
  for (const c of C) {
    if (c > top) plus++;
    else if (c < bottom) minus++;
  }
  const need = Math.max(3, 0.01 * points.length);
  if (plus >= need && plus > 2 * minus) return 1;
  if (minus >= need && minus > 2 * plus) return -1;
  return 0;
}

export function handFrame(points, axes, body, left = false) {
  const f = palmFrame(points);
  const world = (v) => new V().addScaledVector(axes.x, v.x).addScaledVector(axes.y, v.y).addScaledVector(axes.z, v.z);
  let across = f.across;
  // the two shorter axes close: the palm faces in or out, not forward or back
  const [thin, mid] = [0, 1, 2].sort((i, j) => f.spread[i] - f.spread[j]);
  if (f.spread[mid] < f.spread[thin] * 1.35) {
    const lateral = (i) => Math.abs(world(new V().setComponent(i, 1)).dot(body.inward));
    if (lateral(mid) > lateral(thin)) across = new V().setComponent(thin, 1);
  }
  const along = f.along.clone();
  if (along.dot(new V(...f.mean)) < 0) along.negate(); // out past the wrist
  const thumb = across.clone();
  // (a thumb line that runs well forward or back: forward says which, as
  // it has for every figure in the site's bind poses; one that lies across
  // the body or up it, the skin says, where it can)
  const ahead = world(thumb).dot(body.forward.clone().normalize());
  const side = body.skin && Math.abs(ahead) < ACROSS ? thumbSide(points, along, thumb) : 0;
  if (side < 0 || (!side && world(thumb).dot(body.forward.clone().add(body.inward)) < 0)) thumb.negate();
  const normal = left ? new V().crossVectors(along, thumb).normalize() : new V().crossVectors(thumb, along).normalize(); // (the palm: a left hand's is the mirror of a right's)
  return { along, thumb, normal, mean: new V(...f.mean) };
}

export const skinStep = (n) => Math.max(1, Math.floor(n / 8000));

export function handPoints(root, hand) {
  const pts = [];
  const v = new V();
  root.updateMatrixWorld(true);
  const inv = hand.matrixWorld.clone().invert();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const idx = o.skeleton.bones.indexOf(hand);
    const si = o.geometry.attributes.skinIndex;
    const sw = o.geometry.attributes.skinWeight;
    if (idx < 0 || !si || !sw) return;
    o.skeleton.update();
    const n = si.count;
    const step = skinStep(n);
    for (let i = 0; i < n; i += step) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === idx) w += sw.getComponent(i, k);
      if (w < 0.6) continue;
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      pts.push([v.x, v.y, v.z]);
    }
  });
  return pts;
}

// the skinned meshes `bone` moves, and its bind matrix (the bone in the
// bind pose, in the first mesh's bind space)
function skinOf(model, bone) {
  const meshes = [];
  model.traverse((o) => o.isSkinnedMesh && o.skeleton?.bones.includes(bone) && meshes.push(o));
  const m = meshes[0];
  if (!m) return { meshes, bind: null };
  return { meshes, bind: m.skeleton.boneInverses[m.skeleton.bones.indexOf(bone)].clone().invert() };
}
// a bone's matrix in the bind pose (its skeleton's), else as it stands
// (relative to the model)
function bindOf(model, bone) {
  const { bind } = skinOf(model, bone);
  if (bind) return bind;
  model.updateMatrixWorld(true);
  return model.matrixWorld.clone().invert().multiply(bone.matrixWorld);
}

// the hand's vertices in its bone's space, as they were skinned
function bindPoints(meshes, bone) {
  const pts = [];
  const v = new V();
  const m = new THREE.Matrix4();
  for (const o of meshes) {
    const bi = o.skeleton.bones.indexOf(bone);
    const pos = o.geometry.attributes.position;
    const si = o.geometry.attributes.skinIndex;
    const sw = o.geometry.attributes.skinWeight;
    if (bi < 0 || !pos || !si || !sw) continue;
    m.copy(o.skeleton.boneInverses[bi]).multiply(o.bindMatrix);
    const n = pos.count;
    const step = skinStep(n);
    for (let i = 0; i < n; i += step) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k);
      if (w < 0.6) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      pts.push([v.x, v.y, v.z]);
    }
  }
  return pts;
}

export function handSkinCount(model, hand) {
  if (!model || !hand) return 0;
  return bindPoints(skinOf(model, hand).meshes, hand).length;
}

// the way the rig faces in its bind pose, flat (in its bind matrices'
// space): the head to Meshy's `headfront`, else the body's left to its
// right crossed with up, else +z
function facingOf(model, up) {
  const at = (b) => new V().setFromMatrixPosition(bindOf(model, b));
  const flat = (v) => v.addScaledVector(up, -v.dot(up));
  const { bones } = findBones(model);
  const front = model.getObjectByName('headfront');
  const head = bones.head ?? front?.parent;
  if (front?.isBone && head?.isBone && front !== head) {
    const d = flat(at(front).sub(at(head)));
    if (d.lengthSq() > 1e-12) return d.normalize();
  }
  for (const [l, r] of [
    ['armL', 'armR'],
    ['thighL', 'thighR'],
    ['handL', 'handR'],
  ]) {
    if (!bones[l] || !bones[r]) continue;
    const d = new V().crossVectors(flat(at(bones[l]).sub(at(bones[r]))), up);
    if (d.lengthSq() > 1e-12) return d.normalize();
  }
  return new V(0, 0, 1);
}

const frames = new WeakMap(); // a template's vertex data → `${hand}|${left}` → frame | null

export function gripFrame(model, hand, { left = false, forward = null, inward = null } = {}) {
  if (!model || !hand) return null;
  const { meshes, bind } = skinOf(model, hand);
  if (!bind) return null;
  const data = meshes[0].geometry.attributes.position;
  const key = `${hand.name}|${left}`;
  const own = forward || inward;
  if (!own && frames.get(data)?.has(key)) return frames.get(data).get(key);
  const pts = bindPoints(meshes, hand);
  let out = null;
  if (pts.length >= MIN_SKIN) {
    const axes = { x: new V().setFromMatrixColumn(bind, 0).normalize(), y: new V().setFromMatrixColumn(bind, 1).normalize(), z: new V().setFromMatrixColumn(bind, 2).normalize() };
    const up = new V(0, 1, 0);
    const fwd = forward?.clone().normalize() ?? facingOf(model, up);
    let inn = inward?.clone();
    if (!inn) {
      const hips = model.getObjectByName('Hips') ?? findBones(model).bones.hips;
      const H = hips ? new V().setFromMatrixPosition(bindOf(model, hips)) : new V();
      inn = H.sub(new V().setFromMatrixPosition(bind));
      inn.addScaledVector(fwd, -inn.dot(fwd)).addScaledVector(up, -inn.dot(up));
    }
    inn.normalize();
    out = { ...handFrame(pts, axes, { forward: fwd, inward: inn, skin: true }, left), bind };
  }
  if (!own) {
    if (!frames.has(data)) frames.set(data, new Map());
    frames.get(data).set(key, out);
  }
  return out;
}

// the forearm's frame, where the hand has too little skin (the wardrobe's
// way): the palm a quarter of the forearm past the wrist, the fingers on
// down its line, the thumb forward; in the hand's space
function forearmFrame(model, hand, fore, left) {
  const B = bindOf(model, hand);
  const R = new V().setFromMatrixPosition(B);
  const A = new V().setFromMatrixPosition(bindOf(model, fore));
  const along = R.clone().sub(A);
  const len = along.length();
  if (len < 1e-9) return null;
  along.normalize();
  const thumb = new V(0, 0, 1).addScaledVector(along, -along.z);
  if (thumb.lengthSq() < 1e-8) thumb.set(1, 0, 0).addScaledVector(along, -along.x);
  thumb.normalize();
  const inv = B.clone().invert();
  const toHand = (d) => d.clone().transformDirection(inv);
  const out = { along: toHand(along), thumb: toHand(thumb), mean: R.clone().addScaledVector(along, FORE * len).applyMatrix4(inv) };
  out.normal = left ? new V().crossVectors(out.along, out.thumb).normalize() : new V().crossVectors(out.thumb, out.along).normalize();
  return out;
}

// ── holding ──

const NAMES = {
  right: { hand: 'RightHand', fore: 'RightForeArm', arm: 'RightArm', role: 'R', layer: 'arm.r' },
  left: { hand: 'LeftHand', fore: 'LeftForeArm', arm: 'LeftArm', role: 'L', layer: 'arm.l' },
};
function sideBones(fig, side) {
  const n = NAMES[side];
  const named = (k) => fig.bones?.[n[k]] ?? fig.model.getObjectByName(n[k]) ?? null;
  let roles = null;
  const role = (r) => (roles ??= findBones(fig.model).bones)[`${r}${n.role}`] ?? null;
  return { hand: named('hand') ?? role('hand'), fore: named('fore') ?? role('fore'), arm: named('arm') ?? role('arm') };
}

const _a = new V();
const _b = new V();
const _c = new V();
const _q = new Q();
const _m = new THREE.Matrix4();
const UP = new V(0, 1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// the signed angle from a to b about `axis` (all unit, a and b across it)
const about = (a, b, axis) => Math.atan2(_c.crossVectors(a, b).dot(axis), a.dot(b));

export function holdItem(fig, item, kindName, opts = {}) {
  if (!fig?.model || !item) return null;
  const spec = HELD[kindName] ?? HELD.sword;
  const side = opts.left ? 'left' : (opts.hand ?? spec.hand);
  const left = side === 'left';
  const me = sideBones(fig, side);
  if (!me.hand) return null;
  const { scale = 1, curl = false, offset = 0.012 } = opts;
  const F = gripFrame(fig.model, me.hand, { left }) ?? (me.fore ? forearmFrame(fig.model, me.hand, me.fore, left) : null);
  if (!F) return null;
  const hand = me.hand;

  // where it was, to put it back
  const was = { parent: item.parent, position: item.position.clone(), quaternion: item.quaternion.clone(), scale: item.scale.clone(), held: item.userData.held, had: 'held' in item.userData };

  // its grip, in its own space
  item.updateMatrixWorld(true);
  const grip = item.getObjectByName('grip');
  const g = grip ? grip.getWorldPosition(new V()).applyMatrix4(_m.copy(item.matrixWorld).invert()) : new V();

  // its axes in the hand: +y along the line its `up` says, +z the next
  const lineOf = { thumb: [F.thumb, F.along], fingers: [F.along, F.thumb], palm: [F.normal, F.along] }[spec.up];
  const U = lineOf[0].clone().normalize();
  const Z = lineOf[1].clone().addScaledVector(U, -lineOf[1].dot(U)).normalize();
  const X = new V().crossVectors(U, Z);
  const R = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, U, Z));
  fig.model.updateMatrixWorld(true);
  const handScale = hand.getWorldScale(new V()).x || 1;
  const s = was.scale.clone().multiplyScalar(scale / handScale);
  const palm = F.mean.clone().addScaledVector(F.normal, offset / handScale);
  hand.add(item);
  item.quaternion.copy(R);
  item.scale.copy(s);
  item.position.copy(palm).sub(g.clone().multiply(s).applyQuaternion(R));
  item.updateMatrixWorld(true);
  item.userData.held = { kind: kindName, hand: side, bone: hand.name, palm: palm.toArray(), line: U.toArray(), grip: g.toArray(), up: spec.up, carry: spec.carry };

  // the fingers closed on it, for the lead and the named cast
  const curled = curl ? gripMorphs(fig.model, [{ bone: hand, frame: F, side: NAMES[side].role, radius: RADIUS / handScale }], `held:${kindName}|${side}`) : null;
  curled?.set({ [NAMES[side].role]: 1 });

  const other = spec.hands === 2 ? sideBones(fig, left ? 'right' : 'left') : null;
  const anim = ANIMATOR.every((k) => typeof fig.anim?.[k] === 'function') ? fig.anim : null;
  const layer = NAMES[side].layer;
  const idle = fig.idleName ?? 'idle';
  // w: the still carry's weight; full: the arms the body's (kept for
  // after); split: the caller calls after; carried: this frame's carry is
  // done; saved: the bones the carry turns, as they were before it first did
  const st = { w: 0, gone: false, full: false, split: false, carried: false, saved: new Map() };
  const keep = (b) => b && !st.saved.has(b) && st.saved.set(b, b.quaternion.clone());

  // the still carry: the idle's arm over the walk, eased in while moving
  function still(dt, moving, busy) {
    if (!anim) return;
    const want = moving && !busy ? STILL : 0;
    st.w += (want - st.w) * (1 - Math.exp(-EASE * dt));
    if (Math.abs(st.w - want) < 0.01) st.w = want;
    if (st.w > 0 && !busy && anim.playing(layer) !== idle) anim.play(idle, { layer, loop: true });
    anim.weight(layer, st.w);
  }
  // the upright carry: the forearm twisted, then the wrist bent, so the
  // item's top comes up toward the world's
  function upright() {
    keep(me.fore);
    keep(hand);
    fig.model.updateMatrixWorld(true);
    const up = _a.set(0, 1, 0).transformDirection(item.matrixWorld);
    if (me.fore) {
      const f = hand.getWorldPosition(_b).sub(me.fore.getWorldPosition(_c)).normalize().clone();
      const pu = up.clone().addScaledVector(f, -up.dot(f));
      const pw = UP.clone().addScaledVector(f, -f.y);
      if (pu.lengthSq() > 1e-8 && pw.lengthSq() > 1e-8) rotateWorld(me.fore, f, clamp(about(pu.normalize(), pw.normalize(), f), -TWIST, TWIST));
      item.updateMatrixWorld(true);
      up.set(0, 1, 0).transformDirection(item.matrixWorld);
    }
    const axis = new V().crossVectors(up, UP);
    if (axis.lengthSq() < 1e-10) return;
    const angle = Math.atan2(axis.length(), up.dot(UP));
    rotateWorld(hand, axis.normalize(), clamp(angle, -BEND, BEND));
  }
  // the other hand on the second grip, unless a full-body clip has the arms
  function second(busy) {
    const grip2 = other?.hand && other.fore && other.arm ? item.getObjectByName('grip2') : null;
    if (!grip2 || busy) return;
    keep(other.arm);
    keep(other.fore);
    fig.model.updateMatrixWorld(true);
    const T = grip2.getWorldPosition(new V());
    const pole = _q.setFromRotationMatrix(fig.model.matrixWorld);
    reach(other.arm, other.fore, other.hand, T, new V(left ? 1 : -1, -1, -0.5).applyQuaternion(pole).normalize(), 1);
  }
  function carry() {
    if (spec.carry.upright && !st.full) upright();
    second(st.full);
    st.carried = true;
  }

  return {
    item,
    hand,
    kind: kindName,
    update(dt = 0, { moving = false, busy = false } = {}) {
      if (st.gone) return;
      st.full = busy || Boolean(typeof fig.anim?.playing === 'function' && fig.anim.playing('full'));
      if (spec.carry.still) still(dt, moving, st.full);
      st.carried = false;
      if (!st.split) carry();
    },
    after() {
      if (st.gone) return;
      const first = !st.split;
      st.split = true;
      if (first && st.carried) return; // (this frame's update has done it already)
      carry();
    },
    release() {
      if (st.gone) return;
      st.gone = true;
      curled?.dispose();
      if (anim && spec.carry.still) {
        if (anim.playing(layer) === idle) anim.stop(layer);
        anim.weight(layer, 1);
      }
      if (!fig.anim) for (const [b, q] of st.saved) b.quaternion.copy(q);
      st.saved.clear();
      if (was.parent) was.parent.add(item);
      else item.removeFromParent();
      item.position.copy(was.position);
      item.quaternion.copy(was.quaternion);
      item.scale.copy(was.scale);
      if (was.had) item.userData.held = was.held;
      else delete item.userData.held;
    },
    hide(on = true) {
      item.visible = !on;
    },
  };
}
