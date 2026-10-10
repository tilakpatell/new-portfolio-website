// Machines that walk on legs of their own. Where the model is the game's
// (Star Wars Battlefront II (2017)'s walkers and droideka: catalog/
// bf2017-vehicles.js, its entry `rig`), it walks, turns, fires and falls by
// the game's own clips on the game's own skeleton (lib/three/ownRig.js, the
// pack lib/three/rigSets.js names), its feet planted by the clip; that is
// every row below with `own`. Where the model came as one rigid lump with no
// skeleton (the AT-RT's old Sketchfab mesh, or a page's own book of models
// without the game's), it is cut at its joints instead. The
// lump is cut into its parts at their joints (each triangle to the part it
// lies in: the body, and each leg's thigh, shin and foot), the parts hung
// on pivots at the joints, and the legs stepped by the ground the walker
// covers: a foot down stays where it was put while the body goes over it,
// then lifts and swings ahead for the next step (two-bone IK in the leg's
// plane, the knee bending the way the model's does, the foot kept flat).
// Standing, the feet come back under it. A walker with a rider has one in
// the saddle (a crew figure, riders.js's pose: the hands on the bars, the
// feet on the footrests), who does its looking.
//
// WALKERS[kind] → { own?: rig, legs?: [{ x, hip, knee, ankle }], body(c) → bool, foot,
//   step, lift, stance, bob, rider?: { kind, seat, bone? } } (in the model's own
//   frame: +z its nose, +x its left, y up from its feet, metres; hip, knee,
//   ankle: [y, z] of the left leg's joints, the right mirrored at -x; body:
//   whether a triangle's centre is the body's; foot: under this height, a
//   foot's)
// legAngles(leg, target) → { hip, knee, ankle } (radians about the leg's
//   axis: pure, tested in Node)
// gaitStep(g, dt, speed, spec) → g ({ phase, amount }): the stride's clock,
//   by the ground covered (pure)
// footAt(g, i, spec) → [dy, dz] off the leg's rest ankle (pure)
// splitParts(root, spec) → { body, legs: [{ hip, knee, ankle }] }: the
//   model's meshes cut into its parts and hung on its joints
// walkerWay(row, entry) → 'own' (the game's rig and clips), 'cut' (cut at
//   its joints) or null: how a kind with this row and catalogue entry walks
// packUrl(rig) → its clip pack's file
// walkerFigure(kind, i) → a figure (actors.js's shape), or null

import * as THREE from 'three';
import { detailLevel } from '../../../lib/detail';
import { SURFACE_MODELS, modelUrlFor } from './catalog';
import { cloneModel, loadGlb } from './placer';
import { crewFigure } from './crew';
import { poseRider } from './riders';
import { NO_CALLS } from '../../../lib/three/figureCalls';
import { loadOwnRigFigure } from '../../../lib/three/ownRig';
import { RIGS } from '../../../lib/three/rigSets';

export const WALKERS = {
  atat: { own: 'atat' },
  atst: { own: 'atst' },
  atte: { own: 'atte' },
  droideka: { own: 'droideka' },
  // the AT-RT: its hips at the discs under the cockpit, a thigh back and
  // down to the knee (bent backward, as a chicken walker's), the shin down
  // and forward to the ankle, the clawed foot ahead of it
  atrt: {
    own: 'atrt',
    legs: [{ x: 0.33, hip: [1.52, -0.2], knee: [0.76, -1.08], ankle: [0.12, -0.78] }],
    body: ([x, y, z]) => y > 1.68 || (Math.abs(x) < 0.2 && y > 1.2) || (z > 0.05 && y > 1.0),
    foot: 0.25,
    // (the bend's middle: the thigh runs back along the hip's bar before it drops)
    thighVia: [1.45, -0.78],
    step: 0.62,
    lift: 0.22,
    stance: 0.6,
    bob: 0.05,
    rider: { kind: 'clone', seat: { hips: [0, 2.15, -0.45], lean: 0.35, hands: [[0.25, 2.4, -0.2]], feet: [[0.33, 1.62, -0.25]], elbow: [0.7, -0.5, -0.4], knee: [0.6, 0.2, 1], toes: [0.2, -0.3, 1] } },
    // the game's AT-RT, its saddle measured off its rest bones (ATRT_Ske, in
    // the grounded model's frame: the hands on LeftStearing, the feet on
    // LeftFootPedal, the hips over Spine1), and carried by its Hips as the
    // clips sway it
    ownRider: { kind: 'clone', bone: 'Hips', seat: { hips: [0, 2.2, -0.42], lean: 0.3, hands: [[0.12, 2.6, 0.04]], feet: [[0.2, 1.86, 0.08]], elbow: [0.7, -0.5, -0.4], knee: [0.6, 0.2, 1], toes: [0.2, -0.3, 1] } },
  },
};

export function walkerWay(row, entry) {
  if (!row) return null;
  if (row.own && entry?.rig && RIGS[row.own]) return 'own';
  if (row.legs) return 'cut';
  return null;
}

export const packUrl = (rig) => `/models/galaxy/bf2017/clips-${rig}.glb`;

const ang = (y, z) => Math.atan2(z, y); // (about the leg's axis, from straight down… up: y toward z)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// a leg's rest, worked out once: its bones' lengths and angles, and which
// way its knee bends
function restOf(leg) {
  if (leg.rest) return leg.rest;
  const [hy, hz] = leg.hip;
  const [ky, kz] = leg.knee;
  const [ay, az] = leg.ankle;
  const thigh = Math.hypot(ky - hy, kz - hz);
  const shin = Math.hypot(ay - ky, az - kz);
  const tA = ang(ky - hy, kz - hz);
  const sA = ang(ay - ky, az - kz);
  // (the knee to one side of the hip–ankle line or the other)
  const bend = Math.sign(wrap(tA - ang(ay - hy, az - hz))) || 1;
  leg.rest = { thigh, shin, tA, sA, bend };
  return leg.rest;
}

export function legAngles(leg, target) {
  const r = restOf(leg);
  const dy = target[0] - leg.hip[0];
  const dz = target[1] - leg.hip[1];
  const d = Math.min(r.thigh + r.shin - 1e-4, Math.max(Math.abs(r.thigh - r.shin) + 1e-4, Math.hypot(dy, dz)));
  const a = Math.acos(Math.min(1, Math.max(-1, (r.thigh * r.thigh + d * d - r.shin * r.shin) / (2 * r.thigh * d))));
  const thighA = ang(dy, dz) + r.bend * a;
  const ky = leg.hip[0] + Math.cos(thighA) * r.thigh;
  const kz = leg.hip[1] + Math.sin(thighA) * r.thigh;
  const shinA = ang(target[0] - ky, target[1] - kz);
  const hip = wrap(thighA - r.tA);
  const knee = wrap(shinA - r.sA - hip);
  return { hip, knee, ankle: -(hip + knee) };
}

// the stride's clock: a whole cycle (both feet's steps) is `step / stance`
// of ground, so a foot down sweeps back exactly as far as the body goes
// over it; `amount` eases up moving and down standing
export function gaitStep(g, dt, speed, spec) {
  const cycle = spec.step / spec.stance;
  g.phase = (((g.phase + (speed * dt) / cycle) % 1) + 1) % 1;
  const want = Math.abs(speed) > 0.05 ? 1 : 0;
  g.amount += (want - g.amount) * Math.min(1, dt * (want ? 4 : 2.5));
  return g;
}

// where a leg's foot is in its step, off its rest: down, from half a step
// ahead to half a step behind; up, lifted and swung forward again
export function footAt(g, i, spec) {
  const p = (g.phase + i * 0.5) % 1;
  const s = spec.stance;
  let dz;
  let dy = 0;
  if (p < s) dz = spec.step * (0.5 - p / s);
  else {
    const u = (p - s) / (1 - s);
    const e = u * u * (3 - 2 * u);
    dz = spec.step * (-0.5 + e);
    dy = spec.lift * Math.sin(Math.PI * u);
  }
  return [dy * g.amount, dz * g.amount];
}

// which part a triangle's centre is in: the body, a foot, or the thigh or
// shin of the leg on its side, by which bone it's nearer
const segDist = (p, a, b) => {
  const vy = b[0] - a[0];
  const vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vy + (p[1] - a[1]) * vz) / (vy * vy + vz * vz || 1)));
  return Math.hypot(p[0] - a[0] - vy * t, p[1] - a[1] - vz * t);
};
export function partOf(c, spec) {
  if (spec.body(c)) return 'body';
  const side = c[0] >= 0 ? 0 : 1;
  if (c[1] < spec.foot) return `foot${side}`;
  const leg = spec.legs[0];
  const p = [c[1], c[2]];
  const via = spec.thighVia ?? leg.knee;
  const thigh = Math.min(segDist(p, leg.hip, via), segDist(p, via, leg.knee));
  return thigh < segDist(p, leg.knee, leg.ankle) ? `thigh${side}` : `shin${side}`;
}

export function splitParts(root, spec) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const sides = [0, 1].map((i) => {
    const leg = spec.legs[0];
    const x = i === 0 ? leg.x : -leg.x;
    const hip = new THREE.Group();
    hip.position.set(x, leg.hip[0], leg.hip[1]);
    const knee = new THREE.Group();
    knee.position.set(0, leg.knee[0] - leg.hip[0], leg.knee[1] - leg.hip[1]);
    const ankle = new THREE.Group();
    ankle.position.set(0, leg.ankle[0] - leg.knee[0], leg.ankle[1] - leg.knee[1]);
    hip.add(knee);
    knee.add(ankle);
    hip.name = `walker-hip${i}`;
    return { hip, knee, ankle, x };
  });
  const body = new THREE.Group();
  body.name = 'walker-body';
  for (const s of sides) body.add(s.hip);
  // each part's pivot, in the model's frame (the parts' geometry is moved to it)
  const pivotOf = (name) => {
    if (name === 'body') return [body, new THREE.Vector3()];
    const s = sides[Number(name.slice(-1))];
    const leg = spec.legs[0];
    if (name.startsWith('thigh')) return [s.hip, new THREE.Vector3(s.x, leg.hip[0], leg.hip[1])];
    if (name.startsWith('shin')) return [s.knee, new THREE.Vector3(s.x, leg.knee[0], leg.knee[1])];
    return [s.ankle, new THREE.Vector3(s.x, leg.ankle[0], leg.ankle[1])];
  };
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const m = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const mesh of meshes) {
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    // (a compressed model's positions are small whole numbers its node
    // scales up: as floats first, or moving them would clamp them)
    const raw = g.attributes.position;
    if (!(raw.array instanceof Float32Array) || raw.normalized) {
      const f = new Float32Array(raw.count * 3);
      for (let k = 0; k < raw.count; k++) f.set([raw.getX(k), raw.getY(k), raw.getZ(k)], k * 3);
      g.setAttribute('position', new THREE.BufferAttribute(f, 3));
    }
    m.multiplyMatrices(toRoot, mesh.matrixWorld);
    g.applyMatrix4(m);
    const pos = g.attributes.position;
    const groups = new Map(); // part → triangle starts
    for (let t = 0; t < pos.count; t += 3) {
      a.fromBufferAttribute(pos, t);
      b.fromBufferAttribute(pos, t + 1);
      c.fromBufferAttribute(pos, t + 2);
      const cen = [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3];
      const part = partOf(cen, spec);
      if (!groups.has(part)) groups.set(part, []);
      groups.get(part).push(t);
    }
    for (const [part, starts] of groups) {
      const sub = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) {
        const n = attr.itemSize;
        const arr = new attr.array.constructor(starts.length * 3 * n);
        starts.forEach((t, k) => arr.set(attr.array.subarray(t * n, (t + 3) * n), k * 3 * n));
        sub.setAttribute(name, new THREE.BufferAttribute(arr, n, attr.normalized));
      }
      const [pivot, at] = pivotOf(part);
      sub.translate(-at.x, -at.y, -at.z);
      sub.computeBoundingSphere();
      const piece = new THREE.Mesh(sub, mesh.material);
      piece.name = `${mesh.name || 'walker'}-${part}`;
      piece.castShadow = mesh.castShadow;
      piece.receiveShadow = mesh.receiveShadow;
      pivot.add(piece);
    }
    g.dispose();
  }
  return { body, legs: sides, pieces: [...body.children].flatMap(function all(o) { return [o, ...o.children.flatMap(all)]; }).filter((o) => o.isMesh) };
}

// the walker as a figure: { model, tall, anim: null, update(dt, move,
// motion), look, react, …, dispose }; its rider (if it has one) comes when
// its figure does, sat in the saddle
export async function walkerFigure(kind, i = 0, models = SURFACE_MODELS) {
  const spec = WALKERS[kind];
  const way = walkerWay(spec, models[kind]);
  if (way === 'own') return ownWalker(kind, spec, i, models);
  if (way !== 'cut') return null;
  // (the level's own cut: at ultra the .ultra file, the same rig and nodes
  // as the plain, which the placer loads for the same kind; asking 'high'
  // fetched the plain as well, and drew the walker below its best)
  const gltf = await loadGlb(modelUrlFor(kind, detailLevel(), models));
  if (!gltf) return null;
  const scene = cloneModel(gltf);
  const { body, legs, pieces } = splitParts(scene, spec);
  let dead = false;
  const model = new THREE.Group();
  model.add(body);
  const box = new THREE.Box3().setFromObject(model);
  const g = { phase: (i * 0.37) % 1, amount: 0 };
  const restY = body.position.y;
  let rider = null;
  const seat = new THREE.Group();
  seat.name = 'walker-rider';
  body.add(seat);
  if (spec.rider)
    crewFigure(spec.rider.kind, i)
      .then((f) => {
        if (!f || dead) return void f?.dispose?.();
        rider = f;
        seat.add(f.model);
        f.base?.('sit')?.catch?.(() => {});
      })
      .catch(() => {});
  const STILL = { speed: 0, side: 0, turn: 0, air: 0 };
  return {
    model,
    tall: box.max.y - box.min.y,
    anim: null,
    update(dt, move, motion = null) {
      const speed = motion ? (motion.speed ?? 0) : move * 1.6;
      gaitStep(g, dt, speed, spec);
      legs.forEach((leg, k) => {
        const [dy, dz] = footAt(g, k, spec);
        const l = spec.legs[0];
        const r = legAngles(l, [l.ankle[0] + dy, l.ankle[1] + dz]);
        leg.hip.rotation.x = r.hip;
        leg.knee.rotation.x = r.knee;
        leg.ankle.rotation.x = r.ankle;
      });
      // (the body down a touch as the feet pass under it, twice a cycle)
      body.position.y = restY - spec.bob * g.amount * (0.5 + 0.5 * Math.cos(g.phase * Math.PI * 4));
      if (rider) {
        rider.update(dt, 0, STILL);
        model.updateMatrixWorld(true);
        poseRider(rider, rider.model, body.matrixWorld, spec.rider.seat);
      }
    },
    ...NO_CALLS,
    // (its rider looks, and reacts; the walker itself has nothing to show)
    look: (...a) => rider?.look?.(...a),
    react: (...a) => rider?.react?.(...a) ?? null,
    dispose() {
      dead = true;
      rider?.dispose?.();
      for (const p of pieces) p.geometry.dispose();
    },
  };
}

// a walker on the game's own rig: the figure ownRig.js makes, its rider (the
// AT-RT's) sat on the saddle and carried by the bone the clips sway
async function ownWalker(kind, spec, i, models) {
  const load = async (url) => {
    const gltf = await loadGlb(url);
    return gltf ? { scene: cloneModel(gltf), animations: gltf.animations } : null;
  };
  // (the level's own cut, as below: the AT-AT's ultra is the same skin on the same rig)
  const fig = await loadOwnRigFigure(modelUrlFor(kind, detailLevel(), models), { rig: spec.own, packs: [packUrl(spec.own)], load, loadPack: loadGlb }).catch(() => null);
  if (!fig) return null;
  const r = spec.ownRider;
  if (!r) return fig;
  const bone = fig.bones[r.bone] ?? null;
  let rider = null;
  let dead = false;
  const seat = new THREE.Group();
  seat.name = 'walker-rider';
  fig.model.add(seat);
  // (where the bone sits in the walker at rest: the saddle follows its moves from there)
  fig.model.updateMatrixWorld(true);
  const rest = bone ? new THREE.Matrix4().copy(fig.model.matrixWorld).invert().multiply(bone.matrixWorld).invert() : null;
  const carried = new THREE.Matrix4();
  crewFigure(r.kind, i)
    .then((f) => {
      if (!f || dead) return void f?.dispose?.();
      rider = f;
      seat.add(f.model);
      f.base?.('sit')?.catch?.(() => {});
    })
    .catch(() => {});
  const STILL = { speed: 0, side: 0, turn: 0, air: 0 };
  return {
    ...fig,
    update(dt, move, motion = null) {
      fig.update(dt, move, motion);
      if (!rider) return;
      rider.update(dt, 0, STILL);
      fig.model.updateMatrixWorld(true);
      carried.copy(bone ? bone.matrixWorld : fig.model.matrixWorld);
      if (rest) carried.multiply(rest);
      poseRider(rider, rider.model, carried, r.seat);
    },
    // (its rider looks and reacts too, the walker falling under it)
    look: (...a) => rider?.look?.(...a),
    react: (kind, opts) => {
      rider?.react?.(kind, opts);
      return fig.react(kind, opts);
    },
    dispose() {
      dead = true;
      rider?.dispose?.();
      fig.dispose();
    },
  };
}
