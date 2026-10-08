// The people aboard, drawn from what the crew’s rules say of each
// ({ id, kind, x, y, z, yaw, room, hp, mode, anim, aim }). Each kind is
// loaded once and copied (lib/three/gltf.js caches a model by its URL and
// figures.js copies it for each person): the crew and the troops on the
// site’s shared rig, walked and fought on its clips; the surfaces’ droids
// as they were modelled, rocking as they roll; and three built here in
// code until the desktop’s gen3d makes them models: Chewbacca (tall and
// shaggy, his bandolier across his chest), the IT-O (a black sphere with
// its red eye and its syringe) and the dianoga (an eyestalk and tentacles
// up out of the compactor’s water). The Death Star trooper wears his
// black helmet, built here too, over the officer’s uniform.
//
// Only the tier’s count nearest the camera animate (24 high, 14 mid, 8
// low), a body still going down before anyone else; the rest stand still,
// posed when first drawn and again whenever the rules have them do
// something new, played on to where it comes to rest (so a body killed
// far off lies on the deck, and one that loses its turn mid-fall lands),
// and anyone past 60 m or in a room that isn’t drawn is hidden. A person
// is drawn between the game’s last two steps, so they move smoothly at
// any frame rate. A body stays where it fell for as long as the crew keeps
// it, until its room is freed: hidden while the room stands undrawn (a
// door shut on it), let go for good once the stream frees the room.
//
//   LIVE → { ultra, high, mid, low }   how many people animate on each tier;  FAR: 60 m, past which nobody is drawn
//   liveCount(tier) → n
//   lodPick(items, at, { count, far }, out?) → Map<id, 'live' | 'still' | 'hidden'>   pure
//     items: [{ id, x, y, z, falling?, settled?, shown? }]: falling, a body still going down (live before
//     anyone nearer); settled, a body done falling; shown false, in a room not drawn
//   clipFor(person) → { clip, loop, raised }   pure: the figure’s clip for what the rules say it is doing
//     (null: walking, running or standing on its gait), and whether its gun is up
//   aimAngles(from, yaw, at) → { yaw, pitch }   pure: the turn (+ right) and tilt (+ up) from facing `yaw` to `at`
//   createTrack() → { push(body, dt), at(alpha), speed() }   pure: a body between its last two steps;
//     dt: the frame’s time since the last push
//   createPeople(scene, kit, { tier, renderer, adopt }) → { sync(crew, alpha, cameraAt, rooms?), muzzle(id, out), dispose() }
//     adopt(object): handed each figure and gun as it goes into the scene (the house look’s adopt)
//     crew: { people: Map | [person] } (or the people themselves); alpha: how far the frame is from the
//     last step to the next; cameraAt: { x, y, z }
//     rooms: { shown(roomId), built(roomId), dt }: the rooms drawn and the rooms standing, built and not
//       yet freed (every room, without them), and the frame’s seconds (the clock’s, without it)
//     muzzle(id, out) → out | null   where the person’s gun’s muzzle is, for a shot’s flare

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGltf } from '../../../../lib/three/gltf';
import { CAST } from '../rules/cast';
import { PEOPLE, loadPerson } from './figures';
import { buildGun, disposeGuns } from './guns';

export const LIVE = Object.freeze({ ultra: 24, high: 24, mid: 14, low: 8 });
export const FAR = 60;
const STEP = 1 / 30; // the game’s step
const JUMP = 3; // metres between two steps that are a ride or a teleport, not a stride
const SETTLE = 1.5 * STEP; // seconds unmoved after which a body has stopped, not paused between steps
const FALL = 2.5; // seconds a fall takes to play: after it a body needs no animating
const CHEST = 0.75; // of a person’s height, where a gun is held for aiming
const HOVER = 1.45; // metres: the IT-O floats at a standing man’s eyes
const DEEP = 1.0; // the compactor’s water over the floor the dianoga lies on (ds1.js)
const FALLS = ['die', 'dieFwd'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hashOf = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

export function liveCount(tier) {
  return LIVE[tier] ?? LIVE.low;
}

export function lodPick(items, at, { count = LIVE.low, far = FAR } = {}, out = new Map()) {
  out.clear();
  const near = [];
  for (const p of items) {
    const d = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
    if (p.shown === false || !(d <= far)) out.set(p.id, 'hidden');
    else if (p.settled) out.set(p.id, 'still');
    else near.push([p.falling ? 0 : 1, d, p.id]);
  }
  // a body going down first, nearest first among each: a fall that loses its turn has to be cut short
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  near.forEach(([, , id], i) => out.set(id, i < count ? 'live' : 'still'));
  return out;
}

export function clipFor(p) {
  const raised = p.mode === 'fight' || p.mode === 'search' || p.anim === 'aim' || p.anim === 'shoot';
  // the same person falls the same way however often they are drawn
  if (p.mode === 'dead') return { clip: FALLS[hashOf(p.id) % FALLS.length], loop: false, raised: false };
  if (p.mode === 'down') return { clip: 'dieBlown', loop: false, raised: false };
  if (p.anim === 'shoot') return { clip: 'shoot', loop: true, raised: true };
  if (p.anim === 'hit') return { clip: 'hit', loop: false, raised };
  if (p.anim === 'kneel') return { clip: 'kneel', loop: true, raised };
  return { clip: null, loop: false, raised };
}

export function aimAngles(from, yaw, at) {
  const dx = at.x - from.x;
  const dz = at.z - from.z;
  return { yaw: wrap(Math.atan2(dx, -dz) - yaw), pitch: Math.atan2(at.y - from.y, Math.hypot(dx, dz)) };
}

export function createTrack() {
  const prev = { x: 0, y: 0, z: 0, yaw: 0 };
  const cur = { x: 0, y: 0, z: 0, yaw: 0 };
  const out = { x: 0, y: 0, z: 0, yaw: 0 };
  let have = false;
  let still = 0; // seconds since it last moved
  let gap = STEP; // seconds between its last two moves
  const copy = (to, b) => Object.assign(to, { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0, yaw: b.yaw ?? 0 });
  return {
    push(b, dt = 0) {
      const moved = !have || b.x !== cur.x || b.y !== cur.y || b.z !== cur.z || (b.yaw ?? 0) !== cur.yaw;
      if (moved) {
        const jumped = !have || Math.hypot(b.x - cur.x, b.y - cur.y, b.z - cur.z) > JUMP;
        copy(prev, jumped ? b : cur);
        copy(cur, b);
        gap = Math.max(STEP, still + dt);
        still = 0;
        have = true;
      } else if ((still += dt) > SETTLE) copy(prev, cur);
    },
    at(alpha) {
      const a = clamp(alpha, 0, 1);
      return Object.assign(out, { x: prev.x + (cur.x - prev.x) * a, y: prev.y + (cur.y - prev.y) * a, z: prev.z + (cur.z - prev.z) * a, yaw: prev.yaw + wrap(cur.yaw - prev.yaw) * a });
    },
    speed: () => Math.hypot(cur.x - prev.x, cur.z - prev.z) / gap,
  };
}

// ── built in code ──

const _c = new THREE.Color();
const _t = new THREE.Color();
const noise = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

// A part coloured between two colours vertex by vertex, by where each
// vertex is (so a seam’s twin vertices match), and, for fur, pushed out
// and down a little at random so it reads as shaggy, not smooth.
function part(geo, from, to = from, shag = 0) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const h = noise(x, y, z);
    if (shag) pos.setXYZ(i, x + nor.getX(i) * shag * h, y + (nor.getY(i) - 0.5) * shag * h, z + nor.getZ(i) * shag * h);
    _c.setHex(from).lerp(_t.setHex(to), h);
    colours.set([_c.r, _c.g, _c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  if (shag) geo.computeVertexNormals();
  return geo;
}
const joined = (geos) => {
  const g = mergeGeometries(geos);
  for (const p of geos) p.dispose();
  return g;
};
const at = (geo, x, y, z) => geo.translate(x, y, z);

// Fur over a part: `n` tufts, each a thin pyramid growing out of a spot on
// its surface (spots spread by area, so a capsule’s ends aren’t crowded)
// and hanging down as long hair does, dark at the root and light at the
// tip, lit as the skin it grows from. `bare(normal)` keeps a face clear;
// no tip hangs below `floor` (a foot’s fur stays off the deck).
function furOf(geo, n, len, root, tip, seed, { bare = () => false, floor = -Infinity } = {}) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const tris = idx.count / 3;
  const area = new Float32Array(tris);
  const [a, b, c, e1, e2, f, d, u, w, p] = Array.from({ length: 10 }, () => new THREE.Vector3());
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, idx.getX(t * 3));
    b.fromBufferAttribute(pos, idx.getX(t * 3 + 1));
    c.fromBufferAttribute(pos, idx.getX(t * 3 + 2));
    total += e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2;
    area[t] = total;
  }
  let r = seed >>> 0;
  const rand = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
  const P = [];
  const N = [];
  const C = [];
  const I = [];
  const rootC = new THREE.Color(root);
  const tipC = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const want = rand() * total;
    let lo = 0;
    let hi = tris - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (area[mid] < want) lo = mid + 1;
      else hi = mid;
    }
    a.fromBufferAttribute(pos, idx.getX(lo * 3));
    b.fromBufferAttribute(pos, idx.getX(lo * 3 + 1));
    c.fromBufferAttribute(pos, idx.getX(lo * 3 + 2));
    f.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    if (bare(f)) continue;
    let s = rand();
    let q = rand();
    if (s + q > 1) [s, q] = [1 - s, 1 - q];
    p.copy(a).addScaledVector(e1, s).addScaledVector(e2, q).addScaledVector(f, -0.004);
    d.copy(f).add(e1.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35)).add(e2.set(0, -1.6, 0)).normalize();
    const L = len * (0.6 + rand() * 0.8);
    u.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize().multiplyScalar(L * 0.2);
    w.crossVectors(d, u);
    const base = P.length / 3;
    P.push(p.x + d.x * L, Math.max(floor, p.y + d.y * L), p.z + d.z * L);
    for (const [k1, k2] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) P.push(p.x + u.x * k1 + w.x * k2, p.y + u.y * k1 + w.y * k2, p.z + u.z * k1 + w.z * k2);
    tipC.setHex(tip).lerp(rootC, rand() * 0.35);
    for (let v = 0; v < 5; v++) {
      N.push(f.x, f.y, f.z);
      const col = v ? rootC : tipC;
      C.push(col.r, col.g, col.b);
    }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 3, base + 4, base, base + 4, base + 1);
  }
  const tufts = new THREE.BufferGeometry();
  tufts.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  tufts.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  tufts.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2));
  tufts.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  tufts.setIndex(I);
  return joined([geo, tufts]);
}

// how far over a fall has turned a body, 0…1 of the way: down fast, with a bump as it lands
const fallen = (k) => (k < 0.8 ? (k / 0.8) ** 2 : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.06);

// What every figure built here does: falls (tipping over backwards about
// its feet, unless it floats or swims) and gets up from a knockdown,
// flinches, keeps its aim and the gun in its hand; `pose` moves its parts.
function builtFigure(kind, tall, { object, body, hand = null, geos, tips = true, pose }) {
  object.name = `person-${kind}`;
  const s = { t: 0, phase: 0, go: 0, fall: 0, falling: false, hit: 0, yaw: 0, pitch: 0, raised: false };
  let gun = null;
  return {
    object,
    kind,
    tall,
    built: true,
    play(name) {
      s.falling = name === 'die' || name === 'dieFwd' || name === 'dieBlown';
      if (name === 'hit' || name === 'shot') s.hit = 1;
    },
    setAim(yaw, pitch, raised = true) {
      Object.assign(s, { yaw: clamp(yaw || 0, -1.2, 1.2), pitch: clamp(pitch || 0, -0.9, 0.9), raised });
    },
    hold(which) {
      if ((gun?.name ?? null) === (which ? `blaster-${which}` : null)) return;
      gun?.removeFromParent();
      gun = hand && which ? buildGun(which) : null;
      // the hand’s −y runs down the arm: the barrel along it
      if (gun) hand.add(gun.rotateX(-Math.PI / 2));
    },
    update(dt, speed = 0) {
      s.t += dt;
      s.go += (clamp(speed / 1.6, 0, 1.6) - s.go) * (1 - Math.exp(-dt * 8));
      s.phase += dt * speed * ((Math.PI * 2) / 1.7);
      s.fall = clamp(s.fall + (s.falling ? dt / 0.7 : -dt / 0.9), 0, 1);
      s.hit = Math.max(0, s.hit - dt * 4);
      if (tips) body.rotation.x = fallen(s.fall) * (Math.PI / 2) * 0.96;
      pose(s, dt);
    },
    dispose() {
      gun?.removeFromParent();
      object.removeFromParent();
      for (const g of geos) g.dispose();
    },
  };
}

// Chewbacca: long-legged, long-armed, shaggy brown, his bandolier of
// silver boxes across his chest. Each limb hangs from a pivot so he walks.
function buildChewie(tall, mats) {
  const k = tall / 2.28;
  const FUR = [0x3a2817, 0x6e5034]; // the skin under it: dark brown
  const ROOT = 0x4a3420;
  const TIP = 0xa88a62; // his coat’s tawny tips
  const leg = furOf(part(joined([at(new THREE.CapsuleGeometry(0.1, 0.9, 4, 12, 6), 0, -0.5, 0), at(new THREE.SphereGeometry(0.1, 12, 8).scale(1, 0.55, 1.5), 0, -1.02, -0.06)]), ...FUR, 0.015), 320, 0.09, ROOT, TIP, 11, { bare: (n) => n.y < -0.4, floor: -1.06 }).scale(k, k, k);
  const arm = furOf(part(joined([at(new THREE.CapsuleGeometry(0.075, 0.66, 4, 12, 6), 0, -0.38, 0), at(new THREE.SphereGeometry(0.085, 10, 8), 0, -0.79, 0)]), ...FUR, 0.012), 260, 0.085, ROOT, TIP, 23).scale(k, k, k);
  // the strap round his chest, tilted from his left shoulder to his right hip, its boxes along the front
  const TILT = 0.75;
  const tilt = new THREE.Matrix4().makeRotationZ(TILT);
  const boxes = Array.from({ length: 9 }, (_, i) => {
    const a = -Math.PI * (0.18 + (0.64 * i) / 8);
    return part(new THREE.BoxGeometry(0.05, 0.03, 0.035).rotateY(-a - Math.PI / 2).translate(Math.cos(a) * 0.29, 0, Math.sin(a) * 0.23).applyMatrix4(tilt), 0x8d949b, 0xb8bec4);
  });
  const strap = part(new THREE.TorusGeometry(0.27, 0.018, 6, 40).scale(1.06, 0.84, 1.6).rotateX(Math.PI / 2).applyMatrix4(tilt), 0x22180f, 0x3a2a1c);
  // the torso hangs from the hips (so it bends at the waist), the head from the neck
  const torso = joined([furOf(part(new THREE.CapsuleGeometry(0.24, 0.5, 6, 16, 6).scale(1.12, 1, 0.85), ...FUR, 0.015), 900, 0.1, ROOT, TIP, 37), strap, ...boxes]).translate(0, 0.42, 0).scale(k, k, k);
  // his mane long down the back of the head, his face clear of it
  const head = joined([
    furOf(part(new THREE.CapsuleGeometry(0.125, 0.1, 6, 14, 2), ...FUR, 0.01), 260, 0.1, ROOT, TIP, 51, { bare: (n) => n.z < -0.55 && n.y < 0.6 }),
    part(at(new THREE.CapsuleGeometry(0.062, 0.06, 4, 10).rotateX(Math.PI / 2), 0, -0.06, -0.12), 0x7a5a3a, 0x9c7c58, 0.012),
    part(at(new THREE.SphereGeometry(0.026, 8, 6), 0, -0.04, -0.205), 0x0a0807),
    // his eyes, blue so dark they read black, deep under his brow
    part(at(new THREE.SphereGeometry(0.013, 8, 6), -0.048, 0.028, -0.108), 0x101a24),
    part(at(new THREE.SphereGeometry(0.013, 8, 6), 0.048, 0.028, -0.108), 0x101a24),
  ]).translate(0, 0.14, 0).scale(k, k, k);
  // (both legs one geometry, both arms another: the fur falls the same on each)
  const geos = [leg, arm, torso, head];
  const object = new THREE.Group();
  const body = new THREE.Group();
  object.add(body);
  const chest = new THREE.Mesh(torso, mats.fur);
  chest.position.y = 1.08 * k;
  const top = new THREE.Mesh(head, mats.fur);
  top.position.y = 0.88 * k;
  chest.add(top);
  body.add(chest);
  const pivot = (geo, parent, x, y) => {
    const p = new THREE.Group();
    p.position.set(x * k, y * k, 0);
    p.add(new THREE.Mesh(geo, mats.fur));
    parent.add(p);
    return p;
  };
  const [legL, legR, armL, armR] = [pivot(leg, body, -0.13, 1.08), pivot(leg, body, 0.13, 1.08), pivot(arm, chest, -0.31, 0.76), pivot(arm, chest, 0.31, 0.76)];
  const hand = new THREE.Object3D();
  hand.position.y = -0.79 * k;
  armR.add(hand);
  return builtFigure('chewie', tall, {
    object,
    body,
    hand,
    geos,
    pose(s) {
      const swing = Math.sin(s.phase) * 0.5 * Math.min(1, s.go);
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.7;
      // the right arm swings too, or holds the gun out along the aim
      if (s.raised) armR.rotation.set(Math.PI / 2 + s.pitch, -s.yaw * 0.6, 0, 'YXZ');
      else armR.rotation.set(swing * 0.7 + 0.1, 0, 0, 'YXZ');
      // a breath, a bob on each stride, and a flinch back when hit
      const bob = Math.abs(Math.cos(s.phase)) * 0.035 * Math.min(1, s.go);
      chest.scale.y = 1 + Math.sin(s.t * 1.6) * 0.008;
      body.position.y = bob * k;
      chest.rotation.x = -s.hit * 0.15;
      top.rotation.set(-s.hit * 0.25 + s.pitch * 0.3, -s.yaw * 0.4, 0, 'YXZ');
    },
  });
}

// The IT-O: a glossy black sphere hanging in the air, its red eye, a ring
// of instruments round it, and its arms: the syringe, and a pincer.
function buildIto(tall, mats, kit) {
  const r = tall / 2;
  const shell = new THREE.SphereGeometry(r, 28, 18);
  const metal = joined([
    new THREE.TorusGeometry(r * 1.01, 0.008, 6, 40).rotateX(Math.PI / 2),
    at(new THREE.TorusGeometry(0.034, 0.008, 6, 20), 0, 0.02, -r * 0.97),
    at(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), 0.03, r + 0.05, 0),
    at(new THREE.CylinderGeometry(0.03, 0.04, 0.04, 12), 0, -r - 0.01, 0),
    // the syringe: an arm out of its right side, the barrel and its needle
    at(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6).rotateZ(-1.0), r * 0.9 + 0.05, -0.04, 0),
    at(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10).rotateX(Math.PI / 2), r + 0.12, -0.08, -0.05),
    at(new THREE.ConeGeometry(0.004, 0.09, 6).rotateX(-Math.PI / 2), r + 0.12, -0.08, -0.145),
    // the pincer on the left
    at(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 6).rotateZ(1.1), -r * 0.9 - 0.05, -0.05, 0),
    at(new THREE.BoxGeometry(0.008, 0.05, 0.012).rotateZ(0.3), -r - 0.12, -0.1, -0.012),
    at(new THREE.BoxGeometry(0.008, 0.05, 0.012).rotateZ(-0.3), -r - 0.1, -0.1, 0.012),
  ]);
  const eye = at(new THREE.SphereGeometry(0.026, 14, 10), 0, 0.02, -r * 0.94);
  const object = new THREE.Group();
  const body = new THREE.Group();
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(shell, mats.gloss), new THREE.Mesh(metal, kit.mat('rail')), new THREE.Mesh(eye, kit.mat('red')));
  body.add(ball);
  object.add(body);
  return builtFigure('ito', tall, {
    object,
    body,
    geos: [shell, metal, eye],
    tips: false, // (a floating droid drops where it is)
    pose(s) {
      // a slow hover; a fallen one lies on the deck where it dropped
      const down = s.fall;
      ball.position.y = (HOVER + Math.sin(s.t * 1.7) * 0.03) * (1 - down) + r * down;
      ball.rotation.set(s.pitch * 0.5 - s.hit * 0.4, -s.yaw * 0.8, Math.sin(s.t * 0.9) * 0.05 + down * 0.6, 'YXZ');
    },
  });
}

// The dianoga: an eyestalk and four tentacles, each a chain of bones in
// one skinned mesh, up out of the water; the rest of it stays under.
function buildDianoga(tall, mats) {
  const SEGS = 6;
  const chains = [{ x: 0, z: 0, len: tall + 0.45, r0: 0.1, r1: 0.055, eye: true }, ...[0.4, 1.9, 3.5, 5.0].map((a, i) => ({ x: Math.cos(a) * 0.35, z: Math.sin(a) * 0.35, len: 1.5 + i * 0.12, r0: 0.1, r1: 0.016, out: a }))];
  const geos = [];
  const bones = [];
  const roots = [];
  chains.forEach((c, n) => {
    const seg = c.len / SEGS;
    let parent = null;
    for (let j = 0; j <= SEGS; j++) {
      const b = new THREE.Bone();
      if (parent) {
        b.position.y = seg;
        parent.add(b);
      } else {
        b.position.set(c.x, DEEP - 0.35, c.z);
        roots.push(b);
      }
      bones.push(b);
      parent = b;
    }
    const g = part(new THREE.CylinderGeometry(c.r1, c.r0, c.len, 12, SEGS * 3).translate(c.x, DEEP - 0.35 + c.len / 2, c.z), 0x23271d, 0x4f4b38, 0.012);
    const pos = g.attributes.position;
    const index = new Uint16Array(pos.count * 4);
    const weight = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const along = clamp((pos.getY(i) - (DEEP - 0.35)) / seg, 0, SEGS - 1e-6);
      const j = Math.floor(along);
      const f = along - j;
      index.set([n * (SEGS + 1) + j, n * (SEGS + 1) + j + 1, 0, 0], i * 4);
      weight.set([1 - f, f, 0, 0], i * 4);
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
    geos.push(g);
  });
  const skinGeo = joined(geos);
  const skin = new THREE.SkinnedMesh(skinGeo, mats.skin);
  skin.add(...roots);
  skin.updateMatrixWorld(true);
  skin.bind(new THREE.Skeleton(bones));
  skin.frustumCulled = false;
  // the eye at the stalk’s tip, looking out along −z: pale, ringed, a dark slit
  const eyeGeo = joined([part(new THREE.SphereGeometry(0.09, 20, 14), 0xb9b48e, 0xd9d3b0), part(at(new THREE.CircleGeometry(0.05, 20).rotateY(Math.PI), 0, 0, -0.0895), 0x6a3a14, 0x8a5a24), part(at(new THREE.PlaneGeometry(0.014, 0.06).rotateY(Math.PI), 0, 0, -0.0905), 0x030303)]);
  const eye = new THREE.Mesh(eyeGeo, mats.eye);
  eye.name = 'dianoga-eye';
  eye.position.y = 0.04;
  bones[SEGS].add(eye);
  const object = new THREE.Group();
  const body = new THREE.Group();
  body.add(skin);
  object.add(body);
  return builtFigure('dianoga', tall, {
    object,
    body,
    geos: [skinGeo, eyeGeo],
    tips: false,
    pose(s) {
      // dead, it sinks out of sight and stays down
      body.position.y = -s.fall * (tall + 0.6);
      chains.forEach((c, n) => {
        for (let j = 0; j <= SEGS; j++) {
          const b = bones[n * (SEGS + 1) + j];
          const wave = Math.sin(s.t * (c.eye ? 0.9 : 1.3) + j * 0.7 + n * 1.7);
          if (c.eye) {
            // the stalk sways, and leans its eye towards what it watches, flinching back when hit
            b.rotation.set((j ? wave * 0.06 : 0) + (j === 1 ? s.pitch * -0.3 + s.hit * 0.5 : 0), j === 1 ? -s.yaw * 0.5 : 0, j ? Math.cos(s.t * 0.7 + j) * 0.05 : 0);
          } else {
            // a tentacle leans out of the water from its root and curls on along its length as it writhes
            const bend = j === 0 ? 0.55 : 0.12 + wave * 0.3;
            b.rotation.set(Math.sin(c.out) * bend, 0, -Math.cos(c.out) * bend);
          }
        }
      });
    },
  });
}

const BUILT = { chewie: buildChewie, ito: buildIto, dianoga: buildDianoga };

// The Death Star trooper’s helmet: a black bowl with its skirt flared at
// the back and sides, the visor and the jaw guard. One shape for every
// trooper (helmetGeometry), each one sized to the head it sits on (from
// the head bone to the top of the head).
function helmetGeometry() {
  const geos = [
    new THREE.LatheGeometry([[0, 0.17], [0.07, 0.165], [0.115, 0.14], [0.14, 0.09], [0.145, 0.03], [0.15, -0.02], [0.175, -0.06], [0.168, -0.066], [0.14, -0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 28),
    at(new THREE.BoxGeometry(0.17, 0.07, 0.04), 0, 0.05, -0.135),
    at(new THREE.BoxGeometry(0.11, 0.06, 0.05), 0, -0.04, -0.12),
  ];
  return joined([part(geos[0], 0x0c0c0e), part(geos[1], 0x020203), part(geos[2], 0x141416)]);
}

function helmetOn(fig, geo, mats) {
  const helmet = new THREE.Mesh(geo, mats.gloss);
  helmet.name = 'helmet';
  const o = fig.object;
  o.updateMatrixWorld(true);
  const head = o.getObjectByName('Head');
  const top = o.getObjectByName('head_end');
  if (!head || !top) {
    helmet.position.y = fig.tall - 0.13;
    o.add(helmet);
    return helmet;
  }
  // placed at the head in the figure’s own space at rest, then hung from the head bone so it turns with it
  const a = head.getWorldPosition(new THREE.Vector3());
  const b = top.getWorldPosition(new THREE.Vector3());
  const span = a.distanceTo(b);
  const world = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), new THREE.Quaternion(), new THREE.Vector3().setScalar(span / 0.2));
  new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(world).decompose(helmet.position, helmet.quaternion, helmet.scale);
  head.add(helmet);
  return helmet;
}

// A droid from the surfaces, as it was modelled: scaled to its height,
// its own idle playing if it has one; it rocks as it rolls and tips over
// when it is destroyed.
function buildProp(kind, tall, gltf) {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = tall / Math.max(size.y, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  const turn = new THREE.Group();
  turn.rotation.y = Math.PI; // (the surfaces’ models face +z)
  turn.add(model);
  const object = new THREE.Group();
  const body = new THREE.Group();
  body.add(turn);
  object.add(body);
  const mixer = gltf.animations?.length ? new THREE.AnimationMixer(model) : null;
  mixer?.clipAction(gltf.animations[0]).play();
  const fig = builtFigure(kind, tall, {
    object,
    body,
    geos: [],
    pose(s, dt) {
      mixer?.update(dt);
      turn.rotation.z = Math.sin(s.t * 9) * 0.05 * Math.min(1, s.go);
      turn.position.y = Math.abs(Math.sin(s.t * 9)) * 0.012 * Math.min(1, s.go) * tall;
    },
  });
  const dispose = fig.dispose;
  fig.dispose = () => {
    mixer?.stopAllAction();
    dispose();
  };
  return fig;
}

// ── the people ──

export function createPeople(scene, kit, { tier = 'high', renderer = null } = {}) {
  const count = liveCount(tier);
  const mats = {
    // (both sides: a tuft seen from behind is still hair)
    fur: new THREE.MeshStandardMaterial({ name: 'ds-fur', vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    skin: new THREE.MeshStandardMaterial({ name: 'ds-dianoga', vertexColors: true, roughness: 0.6, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ name: 'ds-eye', vertexColors: true, roughness: 0.15, metalness: 0 }),
    gloss: new THREE.MeshStandardMaterial({ name: 'ds-gloss', vertexColors: true, roughness: 0.22, metalness: 0.3 }),
  };
  const records = new Map(); // id → { id, kind, fig, track, clip, gun, blaster, deadFor, seen }
  const cleared = new Set(); // bodies let go when their rooms were freed: not drawn again
  const items = [];
  const picks = new Map();
  let frame = 0;
  let last = null;
  let disposed = false;

  // a loaded figure (the built ones are made at once, in follow)
  async function figureFor(kind) {
    const c = CAST[kind];
    // a model with no rig of the shared kind is one of the surfaces’ droids
    const g = c?.model && !PEOPLE[kind] ? await loadGltf(c.model, { renderer }) : null;
    if (g?.scene && !g.scene.getObjectByName('Hips')) {
      const copy = await loadGltf(c.model, { renderer, fresh: true });
      return buildProp(kind, c.tall, copy);
    }
    const fig = await loadPerson(PEOPLE[kind] || !c ? kind : c.model, { tall: c?.tall, tint: c?.tint ?? null, renderer });
    fig.object.name = `person-${kind}`;
    if (c?.helmet === 'dstrooper') helmetOn(fig, mats);
    return fig;
  }

  function place(r, fig) {
    if (disposed || records.get(r.id) !== r) return fig.dispose();
    r.fig = fig;
    scene.add(fig.object);
  }

  function follow(p) {
    const r = { id: p.id, kind: p.kind, fig: null, track: createTrack(), clip: undefined, gun: undefined, blaster: null, deadFor: 0, seen: frame };
    records.set(p.id, r);
    const c = CAST[p.kind];
    if (c?.built) place(r, BUILT[c.built](c.tall, mats, kit));
    else figureFor(p.kind).then((fig) => place(r, fig), (err) => console.error(`Aboard the Death Star: ${p.kind} didn’t load`, err));
    return r;
  }

  function drop(r) {
    records.delete(r.id);
    r.blaster?.removeFromParent();
    r.fig?.dispose();
  }

  // the gun in a person’s hands: the shared rig’s figures hold their own
  // and carry it to their aim, so ours goes inside theirs (theirs hidden)
  function arm(r, gun) {
    r.gun = gun;
    // (ours out first: a figure frees the geometry of what it holds, and ours is shared)
    r.blaster?.removeFromParent();
    r.blaster = null;
    r.fig.hold(gun);
    if (!gun || r.fig.built) return;
    const holder = r.fig.object.getObjectByName(`gun-${gun}`);
    if (!holder) return;
    for (const o of holder.children) o.visible = false;
    r.blaster = buildGun(gun);
    if (r.blaster) holder.add(r.blaster);
  }

  function draw(r, p, pick, alpha, dt) {
    const fig = r.fig;
    const o = fig.object;
    o.visible = pick !== 'hidden';
    if (!o.visible) return;
    const at = r.track.at(alpha);
    o.position.set(at.x, at.y, at.z);
    o.rotation.y = -at.yaw;
    const want = clipFor(p);
    // one fall into another (knocked down, then dead) carries on falling, not standing to fall again
    const falls = (n) => n === 'dieBlown' || FALLS.includes(n);
    if (want.clip !== r.clip && !(falls(want.clip) && falls(r.clip))) fig.play(want.clip, { loop: want.loop });
    r.clip = want.clip;
    const gun = p.gun !== undefined ? p.gun : (CAST[p.kind]?.gun ?? null);
    if (gun !== r.gun) arm(r, gun);
    if (p.aim) {
      const a = aimAngles({ x: at.x, y: at.y + fig.tall * CHEST, z: at.z }, at.yaw, p.aim);
      fig.setAim(a.yaw, a.pitch, want.raised);
    } else fig.setAim(0, 0, want.raised);
    if (pick !== 'live') return;
    if (p.mode === 'dead') r.deadFor += dt;
    fig.update(dt, r.track.speed());
  }

  return {
    sync(crew, alpha = 1, cameraAt = null, shown = null) {
      if (disposed) return;
      const now = performance.now() / 1000;
      const dt = last === null ? 0 : clamp(now - last, 0, 0.1);
      last = now;
      frame++;
      const all = crew?.people ?? crew ?? [];
      items.length = 0;
      for (const p of all instanceof Map ? all.values() : all) {
        if (p?.id == null || cleared.has(p.id)) continue;
        const inView = shown ? shown(p.room) : true;
        let r = records.get(p.id);
        if (p.mode === 'dead' && !inView) {
          // its room freed: the body goes with it
          if (r) drop(r);
          cleared.add(p.id);
          continue;
        }
        if (!r) r = follow(p);
        else if (r.kind !== p.kind) {
          drop(r);
          r = follow(p);
        }
        r.seen = frame;
        r.track.push(p, dt);
        items.push({ id: p.id, x: p.x, y: p.y ?? 0, z: p.z, settled: r.deadFor >= FALL, shown: inView, p });
      }
      for (const r of [...records.values()]) if (r.seen !== frame) drop(r);
      lodPick(items, cameraAt ?? { x: 0, y: 0, z: 0 }, { count }, picks);
      for (const it of items) {
        const r = records.get(it.id);
        if (r?.fig) draw(r, it.p, picks.get(it.id), alpha, dt);
      }
    },

    muzzle(id, out = new THREE.Vector3()) {
      const m = records.get(id)?.fig?.object.getObjectByName('muzzle');
      if (!m) return null;
      m.updateWorldMatrix(true, false);
      return m.getWorldPosition(out);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const r of [...records.values()]) drop(r);
      for (const m of Object.values(mats)) m.dispose();
      disposeGuns();
    },
  };
}
