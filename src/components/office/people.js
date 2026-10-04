// The Scranton branch's people, dressed as the show dresses them: Michael's
// charcoal suit and light blue shirt, Dwight's mustard short sleeves, tie and
// glasses, Jim's shirt and tie, Pam's pink cardigan, Angela's blonde bun,
// Stanley's moustache and reading glasses, Kevin's size...
//
// The figures are Quaternius's Ultimate Modular Men and Women (CC0), built
// into public/models/office/cast-*.glb by scripts/build-cast.py: rigged
// heads, bodies, legs and feet on one skeleton a pack, each vertex tagged with
// which of its colours it is. Each person here is one skinned mesh (their
// parts merged, coloured from their wardrobe) on their own copy of the
// skeleton, posed by turning its bones: sitting at a desk, standing, or in a
// wheelchair. The head looks round, at the camera or at the bin, nods and
// shakes; the hands type, wave, cheer, shrug, fold and reach for things.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js';

// skin tones, and the shoes most of them wear
const SKIN = { light: 0xe0b598, fair: 0xeac4a8, olive: 0xb88566, tan: 0xb98262, brown: 0x7a4b30, dark: 0x5a3826 };
const SHOES = 0x1d1a18;

// Who wears what. Parts are the packs' (see build-cast.py); colours are by
// slot. `height` in metres; `belly` widens the middle; `glasses` and `tie`
// add what the packs don't have.
export const CAST = {
  michael: { pack: 'men', parts: ['head_parted', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.75, colors: { skin: SKIN.light, hair: 0x3b2a1e, top: 0x34383f, shirt: 0xb9cde4, tie: 0x6a2433, legs: 0x34383f } },
  dwight: { pack: 'men', parts: ['head_parted', 'body_tee', 'legs_slacks', 'feet_shoes'], height: 1.88, glasses: 0x2b2b2b, tie: 0x5a4628, colors: { skin: SKIN.fair, hair: 0x5a3d22, top: 0xd8b24a, legs: 0x5b4a35 } },
  jim: { pack: 'men', parts: ['head_messy', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.91, colors: { skin: SKIN.light, hair: 0x6a4a2c, top: 0xdfe5ec, shirt: 0xeef1f4, tie: 0x2f3a52, legs: 0x4a4f58 } },
  pam: { pack: 'women', parts: ['head_long', 'body_blazer', 'legs_skirt', 'feet_shoes'], height: 1.63, colors: { skin: SKIN.fair, hair: 0x8a4526, top: 0xd9889b, shirt: 0xf3efe6, legs: 0x6b6f78, shoes: 0x4a3a30 } },
  andy: { pack: 'men', parts: ['head_parted', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.83, colors: { skin: SKIN.fair, hair: 0x7a5532, top: 0x2b3a5e, shirt: 0xf2c8c8, tie: 0x8a2a2a, legs: 0xb9a07a, shoes: 0x5a3a24 } },
  phyllis: { pack: 'women', parts: ['head_short', 'body_blazer', 'legs_slacks', 'feet_shoes'], height: 1.6, belly: 1.2, colors: { skin: SKIN.light, hair: 0x8e5a3a, top: 0x8c6aa8, shirt: 0xe9e0d0, legs: 0x4b4b55 } },
  stanley: { pack: 'men', parts: ['head_bald_moustache', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.8, belly: 1.2, glasses: 0x6a5a40, colors: { skin: SKIN.dark, brows: 0x3a3634, moustache: 0x6e6a66, top: 0x8a6a46, shirt: 0xe7e1d2, tie: 0x5a2e2a, legs: 0x4a4038 } },
  erin: { pack: 'women', parts: ['head_long', 'body_blazer', 'legs_skirt', 'feet_shoes'], height: 1.65, colors: { skin: SKIN.fair, hair: 0xa8421f, top: 0x8fb7d8, shirt: 0xf4f0e8, legs: 0x4a4f58 } },
  kevin: { pack: 'men', parts: ['head_bald', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.75, belly: 1.45, colors: { skin: SKIN.light, brows: 0x6b5844, top: 0x9db4cf, shirt: 0x9db4cf, tie: 0x6b2c2c, legs: 0x3e434b } },
  angela: { pack: 'women', parts: ['head_updo', 'body_blazer', 'legs_skirt', 'feet_shoes'], height: 1.55, colors: { skin: SKIN.fair, hair: 0xd8b878, top: 0xc7b8d8, shirt: 0xf3efe6, legs: 0x5d5560 } },
  oscar: { pack: 'men', parts: ['head_parted', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.73, colors: { skin: SKIN.tan, hair: 0x1f1a17, top: 0xd6e2ee, shirt: 0xd6e2ee, tie: 0x3a3e45, legs: 0x3a3e45 } },
  creed: { pack: 'men', parts: ['head_swept', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.78, colors: { skin: SKIN.light, hair: 0xc9c6c0, brows: 0x9a968f, top: 0x4f5a4a, shirt: 0x8a8f86, tie: 0x4f5a4a, legs: 0x3e4048 } },
  meredith: { pack: 'women', parts: ['head_short', 'body_tee', 'legs_slacks', 'feet_shoes'], height: 1.65, colors: { skin: SKIN.fair, hair: 0xb3462a, top: 0x6f8fb0, legs: 0x3a3e48 } },
  darryl: { pack: 'men', parts: ['head_short', 'body_tee', 'legs_jeans', 'feet_shoes'], height: 1.85, colors: { skin: SKIN.brown, hair: 0x1c1714, top: 0x2f4f7a, legs: 0x2e3440 } },
  ryan: { pack: 'men', parts: ['head_messy', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.76, colors: { skin: SKIN.light, hair: 0x2a201a, top: 0x2b2e35, shirt: 0xdfe3e8, tie: 0x2b2e35, legs: 0x2b2e35 } },
  toby: { pack: 'men', parts: ['head_parted', 'body_suit', 'legs_slacks', 'feet_shoes'], height: 1.78, colors: { skin: SKIN.light, hair: 0x6a5644, top: 0x7c8088, shirt: 0xd9dde2, tie: 0x55304a, legs: 0x4b4f57 } },
  kelly: { pack: 'women', parts: ['head_long', 'body_dress', 'legs_skirt', 'feet_shoes'], height: 1.6, colors: { skin: SKIN.olive, hair: 0x1b1512, top: 0xe04f8a, belt: 0x2f2f38, legs: 0xe04f8a, shoes: 0x2f2f38 } },
};

// Anyone else (Albuquerque's people) comes as a spec of the same shape:
// { pack, parts, height, colors, belly?, glasses?, tie?, gloves? }, where
// `gloves` colours the hands.
const PACKS = ['men', 'women'];
export const isSpec = (s) => !!s && typeof s === 'object' && PACKS.includes(s.pack) && Array.isArray(s.parts) && s.parts.length > 0;

const SEAT = 0.535; // the top of the chair's seat (kit.chair)
const LEAN = [0.16, 0.1, 0.06]; // how far the belly, chest and head lean in to the desk
const DOWN = LEAN[0] + LEAN[1] + LEAN[2];
// what they can do, and for how long (seconds)
const LASTS = { nod: 0.9, shake: 1, shrug: 1.2, fold: 1.6, cheer: 1.6, wave: 1.6 };
export const GESTURES = Object.keys(LASTS);
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const IDENTITY = new THREE.Quaternion();
const HAND = /^(Wrist|Index|Middle|Ring|Pinky|Thumb)/; // the bones gloves cover

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
// Turn a bone (in the world) to lie along `dir`. The packs' bones run along
// their own +y, as Blender's do.
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
function ik(upper, lower, end, target, pole) {
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

// One person's geometry: their parts merged, coloured by slot. Also returns
// each vertex's slot, for finding their eyes and chest.
function dress(gltf, spec, slots) {
  const parts = [];
  gltf.scene.traverse((o) => o.isSkinnedMesh && spec.parts.includes(o.name) && parts.push(o));
  const colours = { eyes: 0x2a2018, shoes: SHOES, ...spec.colors };
  colours.brows ??= colours.hair ?? 0x3a2a20;
  const c = new THREE.Color();
  const skin = slots.indexOf('skin');
  const geos = parts.map((p) => {
    const g = p.geometry.clone();
    const slot = g.attributes._slot;
    const col = new Float32Array(slot.count * 3);
    // gloves: the skin that moves mostly with the hands
    const hand = spec.gloves ? p.skeleton.bones.map((b) => HAND.test(b.name)) : null;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    for (let i = 0; i < slot.count; i++) {
      let colour = colours[slots[slot.getX(i)]] ?? colours.top ?? 0x888888;
      if (hand && slot.getX(i) === skin) {
        let w = 0;
        for (let j = 0; j < 4; j++) if (hand[si.getComponent(i, j)]) w += sw.getComponent(i, j);
        if (w > 0.5) colour = spec.gloves;
      }
      c.set(colour);
      c.toArray(col, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  // softened: corners shared within one colour get one normal, so the
  // low-poly facets read as cloth and skin under the office's light
  merged.deleteAttribute('normal');
  const geometry = mergeVertices(merged, 1e-6);
  merged.dispose();
  if (spec.belly) widen(geometry, parts[0].skeleton, spec.belly);
  geometry.computeVertexNormals();
  const s = geometry.attributes._slot;
  const slot = new Uint8Array(s.count);
  for (let i = 0; i < s.count; i++) slot[i] = s.getX(i);
  geometry.deleteAttribute('_slot');
  return { geometry, slot, template: parts[0].name };
}

// A fuller middle: the body's vertices pushed out from the spine, as far as
// they belong to the hips and belly (less up the ribs), more to the front.
// In the geometry's own (quantized) space, which differs from the model's by a
// scale and an offset only, so out from the spine is still out from the spine.
const WIDEN = { Body: 0.55, Hips: 1, Abdomen: 1, Torso: 0.6, Chest: 0.15, UpperLegL: 0.3, UpperLegR: 0.3 };
function widen(geometry, skeleton, k) {
  const at = (name) => {
    const i = skeleton.bones.findIndex((b) => b.name === name);
    return new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
  };
  const c = at('Abdomen');
  const factor = skeleton.bones.map((b) => WIDEN[b.name] ?? 0);
  const pos = geometry.attributes.position;
  const si = geometry.attributes.skinIndex;
  const sw = geometry.attributes.skinWeight;
  for (let i = 0; i < pos.count; i++) {
    let w = 0;
    for (let j = 0; j < 4; j++) w += sw.getComponent(i, j) * factor[si.getComponent(i, j)];
    if (!w) continue;
    const dx = pos.getX(i) - c.x;
    const dz = pos.getZ(i) - c.z;
    const g = (k - 1) * w;
    pos.setXYZ(i, c.x + dx * (1 + g), pos.getY(i), c.z + dz * (1 + g * (dz > 0 ? 1.4 : 0.8)));
  }
  pos.needsUpdate = true;
}

// ── The cast ───────────────────────────────────────────────────────────────
// Loads both packs. Resolves to { person(id, opts), dispose }; if the models
// can't be had, `person` gives null and the office goes on without them.
export async function loadPeople() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let packs;
  try {
    const [men, women] = await Promise.all([loader.loadAsync('/models/office/cast-men.glb'), loader.loadAsync('/models/office/cast-women.glb')]);
    packs = { men, women };
  } catch {
    return { person: () => null, dispose() {} };
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  const owned = []; // geometries and materials to dispose
  const looks = new Map(); // spec -> dressed geometry
  const lookFor = (spec) => {
    if (!looks.has(spec)) {
      const gl = packs[spec.pack];
      const d = dress(gl, spec, gl.parser.json.extras.slots);
      d.slots = gl.parser.json.extras.slots;
      owned.push(d.geometry);
      looks.set(spec, d);
    }
    return looks.get(spec);
  };
  // A person, an office id or a spec, facing +z. Returns { group, id,
  // look(target | null), gesture(name), cheer(), wave(), reach(side, point),
  // headAt(), update(t, dt) }, where update says whether they are still
  // moving. `pose`: 'sit' (the chair's seat `seat` under them, leaning in to
  // the desk), 'stand', or 'wheelchair' (sitting up, hands on the armrests).
  // `typing`: the hands go on the keys, which are `keys` ahead of the chair's
  // middle; `idle`: the head looks round now and then.
  const person = (who, { pose = 'sit', seat = SEAT, shadows = true, typing = false, idle = false, keys = 0.45 } = {}) => {
    const spec = isSpec(who) ? who : CAST[who];
    if (!spec) return null;
    const id = typeof who === 'string' ? who : (spec.id ?? null);
    const look = lookFor(spec);
    const rig = cloneRig(packs[spec.pack].scene);
    // keep the rig; swap its part meshes for this person's one mesh
    const parts = [];
    rig.traverse((o) => o.isSkinnedMesh && parts.push(o));
    const tpl = parts.find((p) => p.name === look.template) || parts[0];
    const body = new THREE.SkinnedMesh(look.geometry, mat);
    body.name = id ?? 'person';
    body.bind(tpl.skeleton, tpl.bindMatrix);
    body.castShadow = shadows;
    body.frustumCulled = false; // its bounds move with its bones
    tpl.parent.add(body);
    for (const p of parts) p.parent.remove(p);
    const bone = (n) => rig.getObjectByName(n);
    // (the loader drops the dot from the packs' names: UpperLeg.L is UpperLegL)
    const pair = (n) => [bone(`${n}L`), bone(`${n}R`)];
    const B = { abdomen: bone('Abdomen'), torso: bone('Torso'), chest: bone('Chest'), neck: bone('Neck'), head: bone('Head'), thigh: pair('UpperLeg'), shin: pair('LowerLeg'), foot: pair('Foot'), shoulder: pair('Shoulder'), arm: pair('UpperArm'), fore: pair('LowerArm'), wrist: pair('Wrist') };
    const root = new THREE.Group();
    root.add(rig);
    const settle = () => {
      rig.updateMatrixWorld(true);
      body.skeleton.update();
    };
    // from the pose they were modelled in (the files keep another, turned at
    // the hips): the bones' places from their bind, the root as it was
    const top = body.skeleton.bones.find((b) => !b.parent?.isBone);
    const keep = { p: top.position.clone(), q: top.quaternion.clone(), s: top.scale.clone() };
    body.skeleton.pose();
    top.position.copy(keep.p);
    top.quaternion.copy(keep.q);
    top.scale.copy(keep.s);
    // where some of their vertices are now (world), by slot
    const v = new THREE.Vector3();
    const where = (slotName, keep = () => true) => {
      const k = look.slots.indexOf(slotName);
      const out = [];
      for (let i = 0; i < look.slot.length; i++) {
        if (look.slot[i] !== k) continue;
        body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld);
        if (keep(v)) out.push(v.clone());
      }
      return out;
    };

    // ── their height: the actor's ──
    settle();
    body.computeBoundingBox();
    const box = body.boundingBox.clone().applyMatrix4(body.matrixWorld);
    const scale = spec.height / Math.max(0.5, box.max.y - box.min.y);
    rig.scale.setScalar(scale);
    settle();

    // ── glasses and a tie, where the packs have none: on the head and chest ──
    const extras = [];
    if (spec.glasses) {
      const eyes = where('eyes');
      const mid = eyes.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, eyes.length));
      const centre = (keep) => {
        const e = eyes.filter(keep);
        return e.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, e.length));
      };
      const apart = Math.max(0.05, centre((p) => p.x > mid.x).x - centre((p) => p.x < mid.x).x); // centre to centre
      const front = Math.max(...eyes.map((p) => p.z));
      const m = new THREE.MeshStandardMaterial({ color: spec.glasses, roughness: 0.35, metalness: 0.5 });
      const r = apart * 0.4;
      const wire = r * 0.1;
      const parts2 = [];
      for (const s of [-1, 1]) {
        const rim = new THREE.TorusGeometry(r, wire, 6, 24);
        rim.scale(1, 0.82, 1);
        rim.translate((s * apart) / 2, 0, 0);
        parts2.push(rim);
        const temple = new THREE.BoxGeometry(wire, wire, r * 4.4);
        temple.translate(s * (apart / 2 + r), 0, -r * 2.2);
        parts2.push(temple);
      }
      const bridge = new THREE.BoxGeometry(apart - 2 * r + wire, wire, wire);
      bridge.translate(0, r * 0.3, 0);
      parts2.push(bridge);
      const g = new THREE.Mesh(mergeGeometries(parts2.map((p) => p.toNonIndexed())), m);
      for (const p of parts2) p.dispose();
      g.position.copy(B.head.worldToLocal(new THREE.Vector3(mid.x, mid.y, front + r * 0.3)));
      g.quaternion.copy(B.head.getWorldQuaternion(new THREE.Quaternion()).invert());
      g.scale.setScalar(1 / B.head.getWorldScale(new THREE.Vector3()).x);
      B.head.add(g);
      extras.push(g);
      owned.push(g.geometry, m);
    }
    if (spec.tie) {
      // from the collar down the shirt's front
      const neck = B.neck.getWorldPosition(new THREE.Vector3());
      const chest = where('top', (p) => Math.abs(p.x) < 0.04 && p.y < neck.y - 0.04 && p.y > neck.y - 0.2);
      const front = chest.length ? Math.max(...chest.map((p) => p.z)) : neck.z + 0.1;
      const len = 0.34 * (spec.height / 1.8);
      const shape = new THREE.Shape();
      shape.moveTo(-0.012, 0);
      shape.lineTo(0.012, 0);
      shape.lineTo(0.026, -len * 0.88);
      shape.lineTo(0, -len);
      shape.lineTo(-0.026, -len * 0.88);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
      const m = new THREE.MeshStandardMaterial({ color: spec.tie, roughness: 0.55 });
      const tie = new THREE.Mesh(geo, m);
      tie.position.copy(B.chest.worldToLocal(new THREE.Vector3(0, neck.y - 0.035, front + 0.004)));
      tie.quaternion.copy(B.chest.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(AX, -0.1));
      tie.scale.setScalar(1 / B.chest.getWorldScale(new THREE.Vector3()).y);
      B.chest.add(tie);
      extras.push(tie);
      owned.push(geo, m);
    }
    for (const e of extras) e.castShadow = false;

    // ── the pose ──
    // Posed at the origin facing +z, so the world is the figure's own frame.
    const pos = (o) => o.getWorldPosition(new THREE.Vector3());
    const sides = B.arm.map((b, s) => Math.sign(pos(b).x) || (s ? -1 : 1));
    // shoulder to wrist (the packs' arms are short for their height)
    const reachOf = B.arm.map((b, s) => pos(b).distanceTo(pos(B.fore[s])) + pos(B.fore[s]).distanceTo(pos(B.wrist[s])));
    // palms down, as on the keys or the armrests
    const palmsDown = () => {
      for (let s = 0; s < 2; s++) {
        turn(B.wrist[s], pos(B.wrist[s]).sub(pos(B.fore[s])).normalize(), sides[s] * 1.45, IDENTITY);
        turn(B.wrist[s], AX, 0.15, IDENTITY);
      }
    };
    if (pose === 'stand') {
      // on their feet as they were modelled, the soles on the floor
      body.computeBoundingBox();
      rig.position.y -= body.boundingBox.clone().applyMatrix4(body.matrixWorld).min.y;
      settle();
      // the arms down by the sides, the elbows a little back
      for (let s = 0; s < 2; s++) {
        const shoulder = pos(B.arm[s]);
        ik(B.arm[s], B.fore[s], B.wrist[s], shoulder.add(new THREE.Vector3(sides[s] * 0.07, -reachOf[s] * 0.96, 0.03)), new THREE.Vector3(sides[s] * 0.2, 0, -1));
      }
      settle();
    } else {
      // Sitting. The feet hang from the root (the packs' legs are rigged for
      // IK), so they are put where the shins end.
      const shinLen = B.shin.map((b, s) => pos(b).distanceTo(pos(B.foot[s])));
      const feetRest = B.foot.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
      // thighs level, a little apart
      for (let s = 0; s < 2; s++) aim(B.thigh[s], va.set(Math.sign(pos(B.thigh[s]).x) * 0.08, -0.06, 1));
      settle();
      // the hips onto the seat: the hip joints a thigh's half-depth above it,
      // just back from its middle
      const hip = pos(B.thigh[0]);
      rig.position.y += seat + 0.085 - hip.y;
      rig.position.z += -0.05 - hip.z;
      settle();
      // the shins down to the floor, the feet a little ahead of the knees, flat
      for (let s = 0; s < 2; s++) {
        const knee = pos(B.shin[s]);
        const len = shinLen[s];
        const drop = Math.min(len * 0.97, knee.y - 0.075);
        const dir = new THREE.Vector3(0, -drop, Math.max(len * 0.24, Math.sqrt(Math.max(0, len * len - drop * drop)))).normalize();
        aim(B.shin[s], dir);
        const ankle = knee.add(dir.multiplyScalar(len));
        B.foot[s].position.copy(B.foot[s].parent.worldToLocal(ankle));
        B.foot[s].updateMatrixWorld(true);
        setWorldQuat(B.foot[s], feetRest[s]);
      }
      if (pose === 'wheelchair') {
        // sitting up, the hands on the armrests
        settle();
        for (let s = 0; s < 2; s++) ik(B.arm[s], B.fore[s], B.wrist[s], new THREE.Vector3(sides[s] * 0.24, seat + 0.2, 0.05), new THREE.Vector3(sides[s] * 0.6, -1, -0.6));
        palmsDown();
      } else {
        // leaning in to the desk, the head down at the screen
        turn(B.abdomen, AX, LEAN[0], IDENTITY);
        turn(B.chest, AX, LEAN[1], IDENTITY);
        turn(B.head, AX, LEAN[2], IDENTITY);
        settle();
        // the hands onto the keys: elbows down by the sides, palms down
        for (let s = 0; s < 2; s++) ik(B.arm[s], B.fore[s], B.wrist[s], new THREE.Vector3(sides[s] * 0.14, seat + 0.27, keys), new THREE.Vector3(sides[s] * 0.6, -1, -0.6));
        palmsDown();
      }
      settle();
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
      ik(B.arm[s], B.fore[s], B.wrist[s], from.lerp(to, p), va.set(sides[s] * pole[0], pole[1], pole[2]).applyQuaternion(frame));
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
          ik(B.arm[s], B.fore[s], B.wrist[s], from.lerp(h.at, ease(amt)), va.set(sides[s] * 0.6, -1, -0.5).applyQuaternion(frame));
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

  return {
    person,
    dispose() {
      mat.dispose();
      for (const o of owned) o.dispose();
    },
  };
}
