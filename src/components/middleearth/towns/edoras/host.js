// The host of Rohan, riding out at dawn: a thousand Riders as two crowds
// skinned from baked textures (lib/three/vat.js), the farm kit's Horse and
// a Rider of the cast sat in its saddle, and a banner over every seventh.
// scripts/edoras-vat.mjs makes what it fetches but the kit's Horse: the
// Horse's texture (its Run and WalkSlow), the Rider cut down to some nine
// hundred triangles, and his (the clip library's drive, his hands held
// before him at the reins).
//
// Both crowds share one set of instance matrices (the host's ranks, set
// once; the group moves) and one clock, and each Rider plays the same clip,
// phase and speed as his horse: so the Rider's texture is built here, on
// load, frame for frame against the Horse's. For each of the Horse's frames
// f, each of the Rider's bones j:
//
//   R_j(f) = FIT × D(f) × SEAT × M_j(k)      D(f) = T(f) × T(rest)⁻¹
//
// T the Horse's Torso (what carries its back at the saddle), so D is how
// the back has moved from the Horse at rest (WalkSlow's first frame) and
// the Rider rises, falls and pitches with it; SEAT puts the Rider's seat on
// the Horse's back at his own size; M_j(k) the Rider's own drive, its
// frames shared out over the Horse's clip; FIT (the Horse's size, its feet
// on the ground and its face to +x, as every beast in the towns faces) goes
// before the Horse's own matrices too. His spear (in his right hand) and
// shield (on his left forearm) are merged into the Rider, skinned whole to
// those bones as they are at the drive's first frame.
//
// The clock counts strides, not seconds: it moves by the host's stride
// (../../creatures.js createStride, from how fast it rides) and each Rider's
// speed is his clip's length in seconds, so one stride is one cycle of
// either clip and the hooves keep to the ground the host covers. A Rider
// takes the Run once the host's pace passes his own mark (they break into
// the gallop raggedly), and WalkSlow below it: setClip, the clip and no
// more. Standing, the clock creeps (REST strides a second). The coats are
// the town's horses' (instanceColor: the coat's shade on white, the mane's
// near-black stays dark).
//
// The banners' cloth waves (aCloth: how far out from the pole), and with
// `bob` it rises and falls by a beat of its own as the host rides.
//
// createHost({ count, layout: { lane, row, col, wing }, coats, banner: { geometry(at), material },
//   load: { gltf(url), vat(url) }, seed }) → { group, count, ready, ride(speed), tick(dt), dispose() }
//   group: what to place and move; its meshes come when `ready` resolves
//   (true; false when a file didn't come, and the group stays empty)
// hostPlaces(count, layout) → [{ x, z, yaw }]   the ranks: two wings either side of the road
// bannerShader(shader, { bob }) → { vertexShader, fragmentShader, swapped: { cloth, bob } }
// bannerMaterial(uniforms, bob) → MeshLambertMaterial  (uniforms: uTime, uRide, uFlut)
// HOST_FILES: the two models and two textures the host fetches (each texture's .bin beside its .json)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeNoise } from '../../../../lib/paint';
import { loadGLTF } from '../../../../lib/three/gltfCache';
import { createVatCrowd, fromHalf, loadVat, packSkinMatrix, skinVertex, toHalf, vatLayout, vatSample, vatTexel } from '../../../../lib/three/vat';
import { createStride } from '../../creatures';

export const HOST_FILES = {
  horse: '/kit/farm/horse.glb',
  horseVat: '/models/middleearth/host/horse.vat.json',
  rider: '/models/middleearth/host/rider.glb',
  riderVat: '/models/middleearth/host/rider.vat.json',
};

// the host's full gallop, m/s (EdorasWorld's RIDE)
const HOST_RIDE = 18;
// strides a second standing (the horses shift their feet)
const REST = 0.12;
// The Horse's fit: the town's old host horse stood 2.27 m to its ears' tips;
// the kit's is 6.924 tall (its manifest), its hooves 0.118 above nought at rest.
const HORSE_SCALE = 2.27 / 6.924;
const HORSE_LIFT = -0.118 * HORSE_SCALE;
// Where the Rider sits, measured on the bakes: the Horse's back at rest, in
// its own units (y 4.71 over z −0.5…0, the Torso's), and the Rider's seat
// in his (his thighs, half sunk in the saddle); he sits 1.15 m tall, as the
// old host's did over the saddle.
const SADDLE_BONE = 'Torso';
const SADDLE = new THREE.Vector3(0, 4.71, -0.25);
const SEAT = new THREE.Vector3(0, 0.13, -0.12);
const RIDER_SCALE = 1.15 / 1.59;
// his spear and shield, in metres; their colours
const SPEAR = { down: 1.0, up: 2.1, r: 0.022, head: 0.3, lean: 0.12 };
const SHIELD = { r: 0.29, out: 0.08 };
const WOOD = 0x4a3424;
const STEEL = 0xe2e6ec;
const GOLD = 0xc9a24a;
const GREEN = 0x2e4a2a;

const C = (hex) => new THREE.Color(hex);
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export function hostPlaces(count, { lane, row, col, wing }) {
  const rnd = makeNoise(17);
  const cols = wing * 2;
  return Array.from({ length: count }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const side = c < wing ? -1 : 1;
    return { x: -r * row + rnd(i, 1) * 1.2, z: side * (lane + (c % wing) * col) + rnd(i, 2) * 0.9, yaw: rnd(i, 3) * 0.08 };
  });
}

// ── the banners ──

const BANNER_HEAD = /* glsl */ `
uniform float uTime;
uniform float uRide;
uniform float uFlut;
attribute float aCloth;
float hostSeed() {
#ifdef USE_INSTANCING
  return fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453);
#else
  return 0.37;
#endif
}
`;
const BANNER_WAVE = /* glsl */ `
{
  float u = aCloth;
  float seed = hostSeed();
  float w = 0.35 + 0.65 * smoothstep(0.0, 0.6, uRide);
  transformed.z += sin(uFlut - u * 4.0 + seed * 6.0) * 0.16 * u * w;
  transformed.y += sin(uTime * 2.1 - u * 3.0 + seed * 3.0) * 0.05 * u * w;
  transformed.x += (cos(uTime * 3.0 - u * 4.0) * 0.04 - 0.03) * u * w;
}
`;
// (a rise and fall of its own, about a gallop's beat, out of step with the next)
const BANNER_BOB = /* glsl */ `
{
  float seed = hostSeed();
  float ride = smoothstep(0.0, 0.35, uRide);
  transformed.y += ride * (abs(sin((uTime * 1.4 + seed * 7.0) * 3.14159265)) * 0.14 - 0.05);
}
`;

export function bannerShader({ vertexShader, fragmentShader }, { bob = false } = {}) {
  const ok = vertexShader.includes('#include <common>') && vertexShader.includes('#include <begin_vertex>');
  if (!ok) return { vertexShader, fragmentShader, swapped: { cloth: false, bob: false } };
  const vs = vertexShader.replace('#include <common>', `#include <common>\n${BANNER_HEAD}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${BANNER_WAVE}${bob ? BANNER_BOB : ''}`);
  return { vertexShader: vs, fragmentShader, swapped: { cloth: true, bob } };
}

export function bannerMaterial(uniforms, bob) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    const out = bannerShader(sh, { bob });
    sh.vertexShader = out.vertexShader;
  };
  m.customProgramCacheKey = () => (bob ? 'edoras-banner-bob' : 'edoras-banner');
  return m;
}

// ── the textures, fitted ──

const decode = (texture) => Float32Array.from(texture.image.data, fromHalf);
function halfTexture(floats, width, height, name) {
  const t = new THREE.DataTexture(Uint16Array.from(floats, toHalf), width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  t.name = name;
  return t;
}
const M4 = (e) => new THREE.Matrix4().fromArray(e);

// the Horse's every matrix with FIT before it
function fitHorse(vat, fit) {
  const layout = vatLayout(vat.bones, vat.frames);
  const data = decode(vat.texture);
  const out = new Float32Array(data.length);
  const m = new THREE.Matrix4();
  for (let f = 0; f < vat.frames; f++) {
    for (let j = 0; j < vat.bones; j++) packSkinMatrix(m.multiplyMatrices(fit, M4(vatSample(data, layout, j, f))).elements, out, vatTexel(layout, j, f));
  }
  vat.texture.dispose();
  return { ...vat, texture: halfTexture(out, layout.width, layout.height, 'horse.vat') };
}

// the Rider's texture laid against the Horse's frames: R_j(f) = FIT × D(f) × SEAT × M_j(k)
function fitRider(rider, horse, fit) {
  const hl = vatLayout(horse.bones, horse.frames);
  const rl = vatLayout(rider.bones, rider.frames);
  const hd = decode(horse.texture);
  const rd = decode(rider.texture);
  const torso = horse.names.indexOf(SADDLE_BONE);
  const rest = horse.clips.WalkSlow?.[0] ?? 0;
  const [rs, rlen] = rider.clips.ride;
  const restInv = M4(vatSample(hd, hl, torso, rest)).invert();
  const seat = new THREE.Matrix4()
    .makeTranslation(SADDLE.x, SADDLE.y, SADDLE.z)
    .multiply(new THREE.Matrix4().makeScale(RIDER_SCALE / HORSE_SCALE, RIDER_SCALE / HORSE_SCALE, RIDER_SCALE / HORSE_SCALE))
    .multiply(new THREE.Matrix4().makeTranslation(-SEAT.x, -SEAT.y, -SEAT.z));
  const layout = vatLayout(rider.bones, horse.frames);
  const out = new Float32Array(layout.texels * 4);
  const pre = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  for (const [start, length] of Object.values(horse.clips)) {
    for (let q = 0; q < length; q++) {
      const f = start + q;
      const k = rs + (Math.floor((q * rlen) / length) % rlen);
      pre.multiplyMatrices(fit, M4(vatSample(hd, hl, torso, f)).multiply(restInv)).multiply(seat);
      for (let j = 0; j < rider.bones; j++) packSkinMatrix(m.multiplyMatrices(pre, M4(vatSample(rd, rl, j, k))).elements, out, vatTexel(layout, j, f));
    }
  }
  rider.texture.dispose();
  return {
    vat: { ...rider, frames: horse.frames, clips: horse.clips, texture: halfTexture(out, layout.width, layout.height, 'rider.vat') },
    // the drive's first frame, his own (for what's put in his hands), and where the saddle puts him at rest
    first: (j) => M4(vatSample(rd, rl, j, rs)),
    place: new THREE.Matrix4().multiplyMatrices(fit, seat),
  };
}

// ── the geometry ──

const skinnedIn = (gltf) => {
  const out = [];
  gltf?.scene?.traverse((o) => o.isSkinnedMesh && out.push(o));
  return out;
};
// a skinned part's geometry as the crowd wants it: position, colour, skin, all plain floats
function plain(geo, color = null) {
  const n = geo.attributes.position.count;
  const g = new THREE.BufferGeometry();
  const copy = (name, size, fill) => {
    const a = new Float32Array(n * size);
    const src = geo.attributes[name];
    for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) a[i * size + c] = src ? src.getComponent(i, c) : fill(c);
    g.setAttribute(name, new THREE.BufferAttribute(a, size));
  };
  copy('position', 3);
  if (color) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) color.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  } else copy('color', 3, () => 1);
  copy('skinIndex', 4, () => 0);
  copy('skinWeight', 4, (c) => (c ? 0 : 1));
  if (geo.index) g.setIndex(Array.from(geo.index.array));
  else g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}
// the Horse's parts as one: the biggest (its coat) white, for the coat's
// colour to shade; the rest (mane, tail and hooves) as the kit paints them
function horseGeo(gltf) {
  const parts = skinnedIn(gltf).sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count);
  return mergeGeometries(parts.map((p, i) => plain(p.geometry, i === 0 ? C(0xffffff) : p.material.color)));
}
// a piece put in a Rider's hand: built in his frame at the drive's first
// frame (`at`: his bone's matrix there), skinned whole to that bone
function held(geo, bone, at, hex) {
  const g = geo.index ? geo : geo.setIndex(Array.from({ length: geo.attributes.position.count }, (_, i) => i));
  g.applyMatrix4(at.clone().invert());
  const n = g.attributes.position.count;
  const rgb = C(hex).toArray();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.attributes.position.clone());
  out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => rgb[i % 3]), 3));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : bone)), 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
  out.setIndex(Array.from(g.index.array));
  return out;
}
// where a bone's own corners are, at the drive's first frame, on average (his grip, his forearm)
function centre(geo, bone, first, bones) {
  const p = geo.attributes.position;
  const j = geo.attributes.skinIndex;
  const w = geo.attributes.skinWeight;
  const mats = Array.from({ length: bones }, (_, b) => first(b).elements);
  const sum = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < p.count; i++) {
    if (j.getX(i) !== bone) continue;
    sum.add(new THREE.Vector3(...skinVertex([p.getX(i), p.getY(i), p.getZ(i)], [j.getX(i), j.getY(i), j.getZ(i), j.getW(i)], [w.getX(i), w.getY(i), w.getZ(i), w.getW(i)], mats)));
    k++;
  }
  return k ? sum.divideScalar(k) : sum;
}
// the Rider, his spear in his right hand and his shield on his left arm (he faces +z, his left +x)
function riderGeo(gltf, rider, first) {
  const body = plain(skinnedIn(gltf)[0].geometry);
  const hand = rider.names.indexOf('RightHand');
  const arm = rider.names.indexOf('LeftForeArm');
  const u = 1 / RIDER_SCALE;
  const L = [body];
  if (hand >= 0) {
    const grip = centre(body, hand, first, rider.bones);
    const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SPEAR.lean);
    const shaft = new THREE.CylinderGeometry(SPEAR.r * u, SPEAR.r * u, (SPEAR.down + SPEAR.up) * u, 4).translate(0, ((SPEAR.up - SPEAR.down) / 2) * u, 0);
    const head = new THREE.ConeGeometry(0.04 * u, SPEAR.head * u, 4).translate(0, (SPEAR.up + SPEAR.head / 2) * u, 0);
    for (const [g, hex] of [[shaft, WOOD], [head, STEEL]]) L.push(held(g.applyQuaternion(lean).translate(grip.x, grip.y, grip.z), hand, first(hand), hex));
  }
  if (arm >= 0) {
    const c = centre(body, arm, first, rider.bones).add(new THREE.Vector3(SHIELD.out * u, 0, 0));
    const face = (g, dx) => g.rotateY(Math.PI / 2).translate(c.x + dx * u, c.y, c.z);
    L.push(held(face(new THREE.CircleGeometry(SHIELD.r * u, 8), 0), arm, first(arm), GREEN));
    L.push(held(face(new THREE.RingGeometry(SHIELD.r * 0.8 * u, SHIELD.r * u, 8), 0.005), arm, first(arm), GOLD));
    L.push(held(face(new THREE.ConeGeometry(0.06 * u, 0.07 * u, 4).rotateX(Math.PI / 2), 0.03), arm, first(arm), GOLD));
  }
  return mergeGeometries(L);
}

const hostMaterial = (side) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side });

// ── the host ──

export function createHost({ count, layout, coats = [0xffffff], banner, load = {}, seed = 29 }) {
  const gltf = load.gltf ?? ((url) => loadGLTF(url));
  const vatLoad = load.vat ? { load: load.vat } : {};
  const group = new THREE.Group();
  group.name = 'host';
  const places = hostPlaces(count, layout);
  const rnd = makeNoise(41);
  const marks = places.map((_, i) => 0.25 + 0.25 * (rnd(i, 1) * 0.5 + 0.5)); // where each breaks into the Run
  const lean = places.map((_, i) => rnd(i, 2) * 0.5 + 0.5); // where in his stride each is
  const gait = new Int8Array(count).fill(-1); // 0 WalkSlow, 1 Run
  const stride = createStride({ stride: 3.6, hz: 1.9, longest: 2.0, stance: 0.32, cadence: [1.6, 2.6], seed });
  const state = { ride: 0, cycle: null, crowds: null, flags: null };
  const fit = new THREE.Matrix4().makeTranslation(0, HORSE_LIFT, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(HORSE_SCALE, HORSE_SCALE, HORSE_SCALE));

  const ready = Promise.all([gltf(HOST_FILES.horse), gltf(HOST_FILES.rider), loadVat(HOST_FILES.horseVat, vatLoad), loadVat(HOST_FILES.riderVat, vatLoad)])
    .then(([hg, rg, hv, rv]) => {
      if (!skinnedIn(hg).length || !skinnedIn(rg).length || state.disposed) return false;
      const horseVat = fitHorse(hv, fit);
      const r = fitRider(rv, hv, fit);
      const horse = createVatCrowd({ geometry: horseGeo(hg), material: hostMaterial(THREE.FrontSide), vat: horseVat, count });
      const rider = createVatCrowd({ geometry: riderGeo(rg, rv, r.first), material: hostMaterial(THREE.DoubleSide), vat: r.vat, count });
      horse.mesh.name = 'host-horses';
      rider.mesh.name = 'host-riders';
      // a banner over every seventh Rider, its pole in his right hand as he sits at rest
      const grip = centre(plain(skinnedIn(rg)[0].geometry), rv.names.indexOf('RightHand'), r.first, rv.bones).applyMatrix4(r.place);
      const flags = new THREE.InstancedMesh(banner.geometry(grip), banner.material, Math.ceil(count / 7));
      flags.name = 'host-banners';
      const o = new THREE.Object3D();
      places.forEach((p, i) => {
        const clip = { clip: 'WalkSlow', phase: lean[i] * (horseVat.clips.WalkSlow[1] / horseVat.fps), speed: horseVat.clips.WalkSlow[1] / horseVat.fps };
        horse.set(i, { x: p.x, y: 0, z: p.z, yaw: p.yaw }, clip);
        rider.set(i, { x: p.x, y: 0, z: p.z, yaw: p.yaw }, clip);
        horse.mesh.setColorAt(i, C(coats[i % coats.length]));
        if (i % 7 === 3) {
          o.position.set(p.x, 0, p.z);
          o.rotation.set(0, p.yaw, 0);
          o.updateMatrix();
          flags.setMatrixAt((i - 3) / 7, o.matrix);
        }
      });
      gait.fill(0);
      flags.count = count > 3 ? Math.floor((count - 4) / 7) + 1 : 0;
      // (the ranks are set once and the group moves: as the old host, never culled)
      for (const m of [horse.mesh, rider.mesh, flags]) {
        m.frustumCulled = false;
        group.add(m);
      }
      state.crowds = { horse, rider, vat: horseVat };
      state.flags = flags;
      return true;
    })
    .catch(() => false);

  return {
    group,
    count,
    ready,
    ride(speed = 0) {
      state.ride = Math.max(0, Number(speed) || 0);
    },
    tick(dt) {
      const st = stride.step(dt, state.ride * HOST_RIDE);
      const d = state.cycle == null ? 0 : st.cycle - state.cycle;
      state.cycle = st.cycle;
      const crowds = state.crowds;
      if (!crowds) return;
      // strides gone by: the stride's own, and a creep standing
      const strides = d - Math.floor(d + 0.5) + Math.max(0, dt) * REST * (1 - smooth(0, 0.2, state.ride));
      crowds.horse.update(strides);
      crowds.rider.update(strides);
      for (let i = 0; i < count; i++) {
        const want = state.ride > marks[i] ? 1 : 0;
        if (gait[i] === want) continue;
        gait[i] = want;
        const name = want ? 'Run' : 'WalkSlow';
        const secs = crowds.vat.clips[name][1] / crowds.vat.fps;
        const clip = { clip: name, phase: lean[i] * secs, speed: secs };
        crowds.horse.setClip(i, clip);
        crowds.rider.setClip(i, clip);
      }
    },
    dispose() {
      state.disposed = true;
      if (state.crowds) {
        for (const c of [state.crowds.horse, state.crowds.rider]) {
          c.mesh.material.userData.vat.uVat.value.dispose();
          c.mesh.material.dispose();
          c.dispose();
        }
      }
      state.flags?.geometry.dispose();
      state.flags?.dispose();
      group.clear();
    },
  };
}
