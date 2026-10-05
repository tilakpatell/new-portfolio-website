// The ice worlds' props, built in code (props/index.js has what a builder
// returns): Hoth's Echo Base cut into its glacier, the shield generator and
// the ion cannon, the trenches, the snowspeeders, the probe droid, the
// wampa's cave; Starkiller Base's thermal oscillator, the First Order's
// garrison and rally ground, the sun being drained into the planet; Crait's
// old Rebel outpost and its door, the battering ram cannon, the AT-M6s,
// the ski speeders and their red trails, the crystal foxes' crystals. A
// kind with a model (catalog/ice.js) is drawn as the model instead.

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod, rockGeometry, place } from '../kit';
import { bake, canvasTexture, loft, trap8, upright } from '../../../universe/trafficKit';
import { noise2 } from '../noise';

const { PI, cos, sin } = Math;

// ── Colours ──
const ICE = '#d6e2ee';
const SNOW = '#f2f6fa';
const REBEL = '#d9d8d2';
const FO = '#4c5056';
const FO_DARK = '#2a2c30';
const SALT = '#efeceb';
const RED = '#a3271c';

// a colour hot enough to glow (and bloom)
const hot = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);

// ── Helpers ──

// a material of the props' own, made once per kit: ice (a little glossy),
// snow (soft and matte), crystal (glassy)
const mat = (k, key, make) => (k[key] ??= k.own(make()));
const iceMat = (k) => mat(k, '_ice', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.06, map: k.mats.stone.map }));
const snowMat = (k) => mat(k, '_snow', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
const crystalMat = (k) => mat(k, '_crystal', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.1, emissive: '#3a0a08', emissiveIntensity: 0.6 }));

// parts baked into one mesh with a material of the props' own
function meshOf(k, parts, material, { shadows = true, density = 0.18 } = {}) {
  const m = new THREE.Mesh(k.own(bake(parts, density)), material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

// a geometry made rough, as ice and rock are: each vertex pushed about by
// noise of where it is (so pieces that meet stay met), pinned at the base
function roughen(g, { amp = 1.5, scale = 9, seed = 1, base = true, fine = 0.35 } = {}) {
  const p = g.attributes.position;
  const n = (a, b, s) => noise2(a / scale, b / scale, s) + noise2(a / (scale * 0.3), b / (scale * 0.3), s + 3) * fine;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = base ? Math.min(1, Math.max(0, y) / 4) : 1;
    p.setXYZ(i, x + n(y + z * 0.6, z - x * 0.4, seed) * amp * (0.5 + 0.5 * k), y + n(x + z * 0.5, x - y * 0.3, seed + 5) * amp * 0.5 * k, z + n(x - y * 0.5, y + x * 0.4, seed + 9) * amp * (0.5 + 0.5 * k));
  }
  g.computeVertexNormals();
  return g;
}
// a rough block, w × h × d, standing at `at` (its base's middle)
function roughBox(w, h, d, at, o = {}) {
  const seg = o.seg ?? 3;
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / seg)), Math.max(1, Math.round(h / seg)), Math.max(1, Math.round(d / seg)));
  g.translate(at[0], at[1] + h / 2, at[2]);
  return roughen(g, o);
}
// a lumpy boulder of ice, snow or rock, sx × sy × sz
const blob = (seed, at, s, o = {}) => part(rockGeometry(seed, { sharp: o.sharp ?? 0.3, detail: o.detail ?? 2, flat: o.flat ?? 0.55 }), { at, scale: s, rot: [0, o.yaw ?? 0, 0], color: o.color ?? SNOW, to: o.to ?? 'stone' });

// a lofted mound along x (a berm, a drift): sections across it, wobbling
function berm(len, wb, wt, h, { z = 0, seed = 1, wob = 0.15, n = 8 } = {}) {
  const secs = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const end = Math.min(1, Math.min(f, 1 - f) * n * 0.6 + 0.35);
    const k = (1 + noise2(f * 4, seed, seed) * wob) * end;
    secs.push({ z: -len / 2 + f * len, pts: trap8(wb * (0.8 + 0.2 * end), wt * (0.6 + 0.4 * end), h * k, Math.min(h * k * 0.35, wt * 0.3), (h * k) / 2) });
  }
  return loft(secs).rotateY(PI / 2).translate(0, 0, z);
}

// a person of the galaxy's own (Vader, Kylo Ren, Luke): built from parts,
// their legs and arms swinging as they walk (update's `move`, 0…1)
function humanoid(k, look) {
  const s = look.tall / 1.8;
  const object = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(s);
  object.add(inner);
  const body = look.body;
  const to = look.to ?? 'cloth';
  const parts = [
    part(box(0.42, 0.56, 0.24), { at: [0, 0.92, 0], color: body, to }),
    part(box(0.48, 0.18, 0.28), { at: [0, 1.36, 0], color: body, to }),
    part(box(0.44, 0.08, 0.27), { at: [0, 0.9, 0], color: look.belt ?? '#1a1a1c', to: 'metal' }),
    part(cyl(0.06, 0.06, 0.08, 10), { at: [0, 1.52, 0], color: look.neck ?? body, to }),
    ...look.head,
    ...(look.extra ?? []),
  ];
  if (look.robe) parts.push(part(new THREE.CylinderGeometry(0.24, look.robe[1] ?? 0.42, 0.9, 14, 1, true), { at: [0, 0.48, 0], color: look.robe[0], to: 'cloth' }));
  if (look.cape) parts.push(part(new THREE.CylinderGeometry(0.28, look.cape[1] ?? 0.55, 1.42, 14, 1, true, PI / 2, PI), { at: [0, 0.8, -0.04], color: look.cape[0], to: 'cloth' }));
  inner.add(k.build(parts, { name: look.name }));
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.92, 0);
    hip.add(k.build([part(box(0.15, 0.86, 0.18).translate(0, -0.86, 0), { color: look.legs ?? body, to }), part(box(0.17, 0.12, 0.27), { at: [0, -0.92, 0.03], color: look.boots ?? '#141416', to: 'metal' })], { name: 'leg' }));
    inner.add(hip);
    legs.push(hip);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.29, 1.42, 0);
    const list = [part(box(0.12, 0.6, 0.14).translate(0, -0.6, 0), { color: look.arms ?? body, to }), part(box(0.1, 0.12, 0.12), { at: [0, -0.72, 0.01], color: look.hands ?? '#141416', to: 'metal' })];
    if (side === 1 && look.saber) list.push(...look.saber);
    sh.add(k.build(list, { name: 'arm' }));
    inner.add(sh);
    arms.push({ sh, side });
  }
  let phase = k.rand() * 10;
  return {
    object,
    solids: [{ circle: [0, 0, 0.4] }],
    update(t, dt, move = 0) {
      phase += (dt ?? 0) * (2 + move * 6);
      const sw = sin(phase) * (0.06 + move * 0.5) * Math.min(1, move * 5 + 0.05);
      legs[0].rotation.x = sw;
      legs[1].rotation.x = -sw;
      for (const a of arms) a.sh.rotation.x = (a.side === 1 && look.saber ? -0.25 : 0) - sw * 0.6 * a.side;
      inner.position.y = Math.abs(sin(phase)) * 0.03 * move;
    },
  };
}
// a lightsaber in a hand: the hilt and the blade (a crossguard, for Kylo)
function saber(color, { cross = false, len = 0.95 } = {}) {
  const parts = [rod([0, -0.66, 0.02], [0, -0.74, 0.22], 0.025, 0.025, { color: '#a8acb2', to: 'metal' })];
  const tip = [0, -0.74 - len * 0.45, 0.22 + len * 0.9];
  parts.push(rod([0, -0.74, 0.22], tip, 0.022, 0.016, { color: hot(color, 3), to: 'glow' }));
  if (cross) for (const x of [-1, 1]) parts.push(rod([0, -0.75, 0.25], [x * 0.16, -0.75, 0.25], 0.012, 0.008, { color: hot(color, 3), to: 'glow' }));
  return parts;
}

export const PROPS = {
  // ── Hoth ──

  // Echo Base: the hangar cut into the glacier, its blast doors open, the
  // light inside; you can walk in (its mouth faces +z: 32 m across, 13 m
  // high, 46 m deep, the ice 60 m back and 30 m up)
  echobase(k) {
    const object = new THREE.Group();
    const ice = [
      roughBox(48, 30, 60, [-40, 0, -30], { seed: 3, amp: 2 }),
      roughBox(48, 30, 60, [40, 0, -30], { seed: 3, amp: 2 }),
      roughBox(32.2, 17, 60, [0, 13, -30], { seed: 3, amp: 2 }),
      roughBox(32.2, 13, 12, [0, 0, -54], { seed: 3, amp: 1.2 }),
      // the glacier running on either side, and back
      roughBox(40, 22, 50, [-78, 0, -38], { seed: 5, amp: 2.4 }),
      roughBox(40, 22, 50, [78, 0, -38], { seed: 5, amp: 2.4 }),
    ].map((g) => part(g, { color: ICE }));
    // the blue of deep ice where it's been cut
    ice.push(part(roughBox(30, 1.2, 0.6, [0, 13.2, 0.6], { seed: 9, amp: 0.4, base: false }), { color: '#a9c4de' }));
    object.add(meshOf(k, ice, iceMat(k)));
    // snow lying on top of it all
    const snow = [blob(11, [0, 28, -30], [150, 18, 70], { flat: 0.4, sharp: 0.25 }), blob(12, [-80, 20, -40], [48, 16, 54], { flat: 0.4 }), blob(13, [80, 20, -40], [48, 16, 54], { flat: 0.4 })];
    for (const [x, z, s] of [
      [-66, 4, 14],
      [64, 3, 12],
      [-100, -10, 18],
      [102, -12, 16],
      [-30, 2, 6],
      [28, 2, 5],
    ])
      snow.push(blob(20 + x, [x, -0.5, z], [s * 1.6, s * 0.8, s], { flat: 0.45 }));
    object.add(meshOf(k, snow.map((p) => ({ ...p, to: undefined })), snowMat(k)));

    const steel = '#8a929a';
    const dark = '#3c4248';
    const parts = [
      // the frame of its mouth, and the great doors slid back into the ice
      part(box(2.2, 14.4, 2.4), { at: [-17.1, 0, 0.2], color: steel, to: 'metal' }),
      part(box(2.2, 14.4, 2.4), { at: [17.1, 0, 0.2], color: steel, to: 'metal' }),
      part(box(36.4, 2.6, 2.6), { at: [0, 12.6, 0.2], color: steel, to: 'metal' }),
      part(box(3.4, 12.6, 1), { at: [-14.6, 0, 0.9], color: '#b4bcc4', to: 'paint' }),
      part(box(3.4, 12.6, 1), { at: [14.6, 0, 0.9], color: '#b4bcc4', to: 'paint' }),
      // the floor, its markings, the hangar's ribs and lights
      part(box(32, 0.12, 47), { at: [0, 0, -23], color: '#7c848c', to: 'metal' }),
      part(box(0.4, 0.13, 40), { at: [-8, 0, -22], color: '#c8a040', to: 'paint' }),
      part(box(0.4, 0.13, 40), { at: [8, 0, -22], color: '#c8a040', to: 'paint' }),
      part(box(10, 0.13, 0.5), { at: [0, 0, -2], color: '#c8a040', to: 'paint' }),
    ];
    // hazard stripes on the door edges
    for (let i = 0; i < 9; i++) for (const x of [-12.85, 12.85]) parts.push(part(box(0.2, 0.7, 1.05), { at: [x, 0.5 + i * 1.4, 0.9], color: i % 2 ? '#d4a02a' : '#2a2a2a', to: 'paint' }));
    for (let z = -6; z > -48; z -= 8) {
      parts.push(part(box(32, 0.8, 0.7), { at: [0, 12.0, z], color: dark, to: 'metal' }));
      for (const x of [-16, 16]) parts.push(part(box(0.7, 12, 0.7), { at: [x * 0.97, 0, z], color: dark, to: 'metal' }));
      for (const x of [-10, 0, 10]) parts.push(part(box(3, 0.16, 0.5), { at: [x, 11.84, z + 0.7], color: hot('#e6f0ff', 2.2), to: 'glow' }));
    }
    for (let z = -10; z > -46; z -= 8) for (const x of [-15.3, 15.3]) parts.push(part(box(0.15, 0.4, 1.6), { at: [x, 3.4, z], color: hot('#ffcf8a', 2.2), to: 'glow' }));
    // the back wall: the control room's windows and a door
    parts.push(part(box(32, 13, 0.8), { at: [0, 0, -47.6], color: '#9aa2aa', to: 'paint' }));
    parts.push(part(box(16, 2.2, 0.2), { at: [0, 5.2, -47.15], color: hot('#9fd4ff', 1.5), to: 'glow' }));
    parts.push(part(box(3.2, 4.2, 0.2), { at: [-9, 0, -47.15], color: '#1c2228', to: 'dark' }));
    parts.push(part(box(3.2, 4.2, 0.2), { at: [9, 0, -47.15], color: '#1c2228', to: 'dark' }));
    // beacons over the doors
    for (const x of [-15, 15]) parts.push(part(new THREE.SphereGeometry(0.4, 10, 8), { at: [x, 15.3, 1.2], color: hot('#ff5a3a', 3), to: 'glow' }));
    parts.push(part(box(10, 1.4, 0.2), { at: [0, 13.1, 1.55], color: '#2a3036', to: 'dark' }));
    // sensor masts on the glacier's back
    for (const [x, z, h] of [
      [12, -24, 16],
      [-26, -38, 11],
    ]) {
      parts.push(rod([x, 28, z], [x, 30 + h, z], 0.25, 0.12, { color: '#5a6066', to: 'metal' }));
      for (let i = 1; i < 4; i++) parts.push(rod([x - 1.6, 30 + (h * i) / 4, z], [x + 1.6, 30 + (h * i) / 4, z], 0.06, 0.06, { color: '#5a6066', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.3, 8, 6), { at: [x, 30.2 + h, z], color: hot('#ff4a3a', 3), to: 'glow' }));
    }
    parts.push(part(dome(2.4, 1.0, 16), { at: [12, 36, -24], rot: [-0.6, 0.3, 0], color: '#9aa2aa', to: 'metal' }));
    object.add(k.build(parts, { name: 'echobase' }));
    return {
      object,
      solids: [{ box: [-40, -30, 24, 30] }, { box: [40, -30, 24, 30] }, { box: [0, -53, 16.2, 6] }, { box: [-78, -38, 20, 25] }, { box: [78, -38, 20, 25] }, { box: [-14.6, 0.9, 1.7, 0.6] }, { box: [14.6, 0.9, 1.7, 0.6] }],
    };
  },

  // the shield generator: a flared tower under a great dish, its spike
  // over the middle, the power units round its foot (25 m)
  shieldgen(k) {
    const grey = '#b4bac2';
    const dark = '#5c626a';
    const parts = [
      part(cyl(10.5, 10, 1.2, 40), { color: '#8a9098', to: 'stone' }),
      part(upright([[7.2, 1.2], [7.2, 2.4], [5.4, 3.6], [3.8, 7], [2.9, 13], [3.1, 16.4], [4.4, 18]], 28), { color: grey, to: 'paint' }),
      part(upright([[1.0, 17.4], [5.2, 18.4], [9.2, 20.4], [11.8, 22.3], [12.1, 22.8], [11.6, 22.95], [9.0, 21.2], [5.0, 19.2], [1.0, 18.2]], 40), { color: '#c8ced6', to: 'paint' }),
      part(cyl(0.9, 0.25, 5.6, 12), { at: [0, 18.2, 0], color: dark, to: 'metal' }),
      part(new THREE.SphereGeometry(0.42, 12, 8), { at: [0, 24, 0], color: hot('#a8dcff', 3), to: 'glow' }),
      part(ring(3.9, 0.35, 28), { at: [0, 7, 0], color: dark, to: 'metal' }),
      part(ring(3.1, 0.3, 28), { at: [0, 13.4, 0], color: dark, to: 'metal' }),
    ];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      parts.push(part(box(0.45, 10.5, 2.2), { at: [cos(a) * 4.1, 2.8, sin(a) * 4.1], rot: [0, -a, 0], color: '#9aa0a8', to: 'metal' }));
      parts.push(rod([cos(a) * 3.0, 15.4, sin(a) * 3.0], [cos(a) * 9.6, 21.0, sin(a) * 9.6], 0.16, 0.12, { color: dark, to: 'metal' }));
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * PI * 2;
      parts.push(part(new THREE.SphereGeometry(0.22, 8, 6), { at: [cos(a) * 11.9, 23.0, sin(a) * 11.9], color: hot(i % 2 ? '#ffd27a' : '#bfe4ff', 2.6), to: 'glow' }));
    }
    // the power units round it
    const solids = [{ circle: [0, 0, 7.6] }];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.3;
      const x = cos(a) * 13;
      const z = sin(a) * 13;
      parts.push(part(box(3.4, 2.8, 4.6), { at: [x, 0, z], rot: [0, -a, 0], color: '#a2a8b0', to: 'paint' }));
      parts.push(part(box(3.0, 0.3, 0.12), { at: [x + cos(a) * 1.75, 1.9, z + sin(a) * 1.75], rot: [0, -a + PI / 2, 0], color: hot('#ffcf8a', 2), to: 'glow' }));
      parts.push(rod([x, 0.4, z], [cos(a) * 7, 0.6, sin(a) * 7], 0.18, 0.18, { color: '#2a2e32', to: 'dark' }));
      solids.push({ circle: [x, z, 2.6] });
    }
    return { object: k.build(parts, { name: 'shieldgen' }), solids };
  },

  // the v-150 Planet Defender: an ion cannon, a great ball on its cone in
  // a round emplacement, its barrel to the sky (30 m)
  ioncannon(k) {
    const grey = '#c9ced4';
    const dark = '#464c54';
    const tilt = 0.75;
    const d = [0, sin(tilt), cos(tilt)];
    const c = [0, 19.5, 0];
    const along = (s) => c.map((v, i) => v + d[i] * s);
    const parts = [
      part(cyl(18, 17, 2.4, 48), { color: '#8a9098', to: 'stone' }),
      part(cyl(13, 8.5, 7.4, 40), { at: [0, 2.4, 0], color: '#a8aeb6', to: 'paint' }),
      part(cyl(8.6, 8.6, 2.4, 40), { at: [0, 9.4, 0], color: dark, to: 'metal' }),
      part(new THREE.SphereGeometry(10.5, 40, 28), { at: c, color: grey, to: 'paint' }),
      part(new THREE.TorusGeometry(10.55, 0.55, 8, 56), { at: c, rot: [PI / 2, 0, 0], color: dark, to: 'metal' }),
      part(new THREE.TorusGeometry(10.55, 0.45, 8, 56), { at: c, rot: [0, PI / 2, 0], color: dark, to: 'metal' }),
      // the barrel, its housing and its muzzle
      rod(along(6), along(12.5), 2.6, 2.3, { color: dark, to: 'metal' }, 20),
      rod(along(12.5), along(22), 1.5, 1.3, { color: '#9aa0a8', to: 'metal' }, 18),
      rod(along(21.4), along(23.4), 1.9, 1.9, { color: dark, to: 'metal' }, 18),
      part(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 16), { at: along(23.46), rot: [PI / 2 - tilt, 0, 0], color: hot('#ff7a5a', 2.4), to: 'glow' }),
    ];
    // the rings of the barrel
    for (let s = 14; s < 21; s += 1.6) parts.push(rod(along(s), along(s + 0.4), 1.65, 1.65, { color: dark, to: 'metal' }, 18));
    // a bank of snow round the emplacement
    parts.push(part(new THREE.TorusGeometry(18.5, 2.2, 6, 40), { rot: [PI / 2, 0, 0], scale: [1, 1, 0.6], color: SNOW, to: 'stone' }));
    return { object: k.build(parts, { name: 'ioncannon' }), solids: [{ circle: [0, 0, 18] }] };
  },

  // a Rebel DF.9 / trench gun: a squat round tower, its armoured top, a
  // long barrel (4 m)
  turret(k, { color = REBEL } = {}) {
    const dark = '#55595e';
    const top = loft([
      { z: -1.3, pts: trap8(2.3, 1.9, 1.4, 0.2, 0.7) },
      { z: 0.6, pts: trap8(2.3, 1.9, 1.4, 0.2, 0.7) },
      { z: 1.3, pts: trap8(2.0, 1.4, 0.9, 0.15, 0.5) },
    ]);
    const parts = [
      part(cyl(1.45, 1.35, 2.1, 20), { color, to: 'paint' }),
      part(cyl(1.5, 1.5, 0.25, 20), { color: dark, to: 'metal' }),
      part(cyl(1.1, 1.1, 0.35, 20), { at: [0, 2.1, 0], color: dark, to: 'metal' }),
      part(top, { at: [0, 2.4, 0], color, to: 'paint' }),
      part(box(1.2, 0.2, 0.1), { at: [0, 3.25, 1.12], rot: [-0.5, 0, 0], color: '#1a1e22', to: 'dark' }),
      rod([0, 2.95, 1.0], [0, 3.05, 3.2], 0.17, 0.14, { color: dark, to: 'metal' }, 12),
      rod([0, 3.04, 2.9], [0, 3.06, 3.35], 0.22, 0.22, { color: dark, to: 'metal' }, 12),
      rod([0.55, 3.6, -0.8], [0.55, 4.3, -0.8], 0.04, 0.03, { color: dark, to: 'metal' }),
    ];
    return { object: k.build(parts, { name: 'turret' }), solids: [{ circle: [0, 0, 1.5] }] };
  },

  // an E-Web heavy repeating blaster on its tripod, its generator beside
  // it on a cable (1.5 m)
  eweb(k) {
    const dark = '#2c2e32';
    const grey = '#5c6066';
    const parts = [part(box(0.24, 0.3, 1.0), { at: [0, 0.92, 0], color: dark, to: 'metal' }), rod([0, 1.07, 0.5], [0, 1.08, 1.45], 0.05, 0.045, { color: dark, to: 'metal' }), part(box(0.12, 0.12, 0.4), { at: [0, 1.24, -0.1], color: grey, to: 'metal' })];
    for (let i = 0; i < 6; i++) parts.push(rod([0, 1.07, 0.55 + i * 0.1], [0, 1.07, 0.6 + i * 0.1], 0.085, 0.085, { color: grey, to: 'metal' }));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + PI / 2;
      parts.push(rod([0, 0.92, 0], [cos(a) * 0.62, 0, sin(a) * 0.62 * -1], 0.03, 0.025, { color: dark, to: 'metal' }));
    }
    for (const x of [-0.14, 0.14]) parts.push(rod([0, 1.0, -0.5], [x, 0.95, -0.7], 0.02, 0.02, { color: grey, to: 'metal' }));
    // the generator and its cable
    parts.push(part(box(0.6, 0.45, 0.42), { at: [-0.95, 0, -0.55], color: '#6a6e74', to: 'paint' }));
    parts.push(part(box(0.3, 0.06, 0.06), { at: [-0.95, 0.36, -0.33], color: hot('#ff6a3a', 2), to: 'glow' }));
    parts.push(rod([-0.7, 0.2, -0.5], [-0.3, 0.05, -0.3], 0.025, 0.025, { color: '#1a1a1a', to: 'dark' }));
    parts.push(rod([-0.3, 0.05, -0.3], [0, 0.8, -0.3], 0.025, 0.025, { color: '#1a1a1a', to: 'dark' }));
    return { object: k.build(parts, { name: 'eweb' }), solids: [{ circle: [0, 0, 0.5] }, { circle: [-0.95, -0.55, 0.35], top: 0.45 }] };
  },

  // an Imperial probe droid: the black head with its lenses and antennae,
  // the arms hanging under it, slowly turning, slowly swaying (2.4 m; it
  // hovers: put it up with `y`)
  probe(k) {
    const black = '#1e2024';
    const object = new THREE.Group();
    const head = new THREE.Group();
    head.position.y = 1.75;
    const hp = [
      part(new THREE.SphereGeometry(0.46, 20, 14), { scale: [1, 0.92, 1], color: black, to: 'metal' }),
      part(cyl(0.36, 0.44, 0.22, 18), { at: [0, -0.48, 0], color: '#2c2f34', to: 'metal' }),
      part(cyl(0.2, 0.34, 0.18, 14), { at: [0, -0.6, 0], color: black, to: 'metal' }),
    ];
    // the lenses round its face, two of them glowing
    for (const [a, e, glow] of [
      [0, 0.1, true],
      [0.45, 0.25, false],
      [-0.45, 0.25, false],
      [0.3, -0.15, false],
      [-0.3, -0.15, true],
      [0, 0.42, false],
    ])
      parts_lens(hp, a, e, glow);
    for (const [x, z, h] of [
      [0.12, -0.1, 0.9],
      [-0.16, 0.05, 0.65],
      [0.02, 0.18, 0.5],
    ])
      hp.push(rod([x, 0.35, z], [x * 1.4, 0.35 + h, z * 1.4], 0.018, 0.01, { color: '#3a3c40', to: 'metal' }));
    head.add(k.build(hp, { name: 'probe-head' }));
    object.add(head);
    // the arms
    const arms = new THREE.Group();
    arms.position.y = 1.15;
    const ap = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.3;
      const r0 = 0.22;
      const mid = [cos(a) * 0.42, -0.45 - (i % 2) * 0.15, sin(a) * 0.42];
      const end = [cos(a) * 0.36, -1.0 - (i % 3) * 0.12, sin(a) * 0.36];
      ap.push(rod([cos(a) * r0, 0, sin(a) * r0], mid, 0.035, 0.03, { color: '#2a2c30', to: 'metal' }));
      ap.push(rod(mid, end, 0.028, 0.022, { color: '#3a3c40', to: 'metal' }));
      ap.push(part(new THREE.SphereGeometry(0.05, 6, 4), { at: mid, color: '#4a4c50', to: 'metal' }));
      ap.push(rod(end, [end[0] * 1.15, end[1] - 0.12, end[2] * 1.15], 0.02, 0.005, { color: '#5a5c60', to: 'metal' }));
    }
    arms.add(k.build(ap, { name: 'probe-arms' }));
    object.add(arms);
    return {
      object,
      solids: [{ circle: [0, 0, 0.5] }],
      update(t) {
        head.rotation.y = sin(t * 0.35) * 1.2;
        arms.rotation.x = sin(t * 0.9) * 0.08;
        arms.rotation.z = sin(t * 0.7 + 1) * 0.08;
      },
    };
  },

  // a T-47 airspeeder (a snowspeeder): the wedge of its hull, the canopy
  // over its two seats, the cannons either side of its nose, the split
  // flaps at the back, Rogue Group's orange (5.3 m)
  snowspeeder(k) {
    const white = '#dad9d3';
    const orange = '#d0612c';
    const dark = '#3c3e42';
    const secs = [
      { z: -2.65, pts: trap8(3.2, 2.7, 0.72, 0.12, 0.95) },
      { z: -1.3, pts: trap8(3.4, 2.9, 0.84, 0.14, 1.0) },
      { z: 0.9, pts: trap8(2.4, 1.9, 0.8, 0.12, 0.98) },
      { z: 1.4, pts: trap8(2.0, 1.6, 0.74, 0.12, 0.96) },
      { z: 1.75, pts: trap8(1.75, 1.35, 0.68, 0.1, 0.94) },
      { z: 2.15, pts: trap8(1.3, 0.95, 0.58, 0.1, 0.9) },
      { z: 2.65, pts: trap8(0.55, 0.35, 0.34, 0.06, 0.84) },
    ];
    const seg = (a, b, color) => part(loft(secs.slice(a, b + 1)), { color, to: 'paint' });
    const parts = [
      seg(0, 2, white),
      seg(2, 3, white),
      seg(3, 4, orange),
      seg(4, 5, white),
      seg(5, 6, orange),
      // the canopy and its frame
      part(loft([{ z: -0.9, pts: trap8(1.3, 0.9, 0.5, 0.14, 1.62) }, { z: 0.4, pts: trap8(1.3, 0.85, 0.52, 0.14, 1.64) }, { z: 1.2, pts: trap8(1.0, 0.4, 0.3, 0.06, 1.48) }]), { color: '#3a5a7a', to: 'glass' }),
      part(box(1.36, 0.08, 2.0), { at: [0, 1.36, 0.1], color: dark, to: 'metal' }),
      part(box(0.06, 0.55, 0.06), { at: [0, 1.36, 0.0], color: dark, to: 'metal' }),
    ];
    // the cannons, the engines' grilles, the flaps, the harpoon
    for (const s of [-1, 1]) {
      parts.push(part(box(0.3, 0.28, 1.0), { at: [s * 0.98, 0.8, 1.2], color: dark, to: 'metal' }));
      parts.push(rod([s * 0.98, 0.94, 1.6], [s * 0.98, 0.94, 3.15], 0.06, 0.05, { color: dark, to: 'metal' }));
      parts.push(part(box(0.7, 0.42, 0.06), { at: [s * 1.1, 0.75, -2.67], color: '#2a2c30', to: 'dark' }));
      parts.push(part(box(0.5, 0.16, 0.04), { at: [s * 1.1, 0.9, -2.7], color: hot('#ff9a5a', 1.6), to: 'glow' }));
      for (const f of [0, 1]) parts.push(part(box(0.06, 0.62, 0.8), { at: [s * (1.58 + f * 0.08), 0.68, -2.35], rot: [0, 0, s * (0.12 + f * 0.35)], color: f ? orange : white, to: 'paint' }));
      parts.push(rod([s * 1.1, 0.62, -1.6], [s * 1.1, 0, -1.6], 0.05, 0.05, { color: dark, to: 'metal' }));
      parts.push(part(box(0.3, 0.06, 0.4), { at: [s * 1.1, 0, -1.6], color: dark, to: 'metal' }));
    }
    parts.push(rod([0, 0.62, 1.8], [0, 0, 1.8], 0.05, 0.05, { color: dark, to: 'metal' }));
    parts.push(rod([0, 1.08, -2.5], [0, 1.1, -3.0], 0.09, 0.07, { color: dark, to: 'metal' }));
    parts.push(part(box(0.5, 0.06, 1.2), { at: [0.9, 1.0, -0.6], color: '#9a9c9e', to: 'paint' }));
    return { object: k.build(parts, { name: 'snowspeeder' }), solids: [{ box: [0, -0.3, 1.5, 2.4] }] };
  },

  // a stretch of trench: a bank of snow (or salt) thrown up toward the
  // enemy, a lower one behind, plates and crates along it, `len` m long
  // across x, the front to +z
  trench(k, { len = 24, salt = false } = {}) {
    const face = salt ? SALT : SNOW;
    const parts = [part(berm(len, 2.8, 1.0, 1.55, { z: 1.9, seed: Math.floor(k.rand() * 99) }), { color: face }), part(berm(len, 2.0, 0.8, 0.7, { z: -1.9, seed: Math.floor(k.rand() * 99) }), { color: face })];
    const object = new THREE.Group();
    object.add(meshOf(k, parts, snowMat(k), { density: 0.3 }));
    const bits = [];
    for (let x = -len / 2 + 2; x < len / 2 - 1; x += 2.6 + k.rand() * 2) bits.push(part(box(1.3, 1.25, 0.1), { at: [x, 0, 0.75], rot: [-0.25, (k.rand() - 0.5) * 0.2, 0], color: salt ? '#6a5e56' : '#8a9096', to: 'metal' }));
    if (salt) bits.push(part(box(len - 1, 0.04, 2.4), { at: [0, 0.02, 0], color: RED, to: 'adobe' }));
    for (let i = 0; i < 3; i++) bits.push(part(box(0.8, 0.6, 0.6), { at: [(k.rand() - 0.5) * len * 0.8, 0, -0.6], rot: [0, k.rand(), 0], color: salt ? '#7a6a5a' : '#6a7078', to: 'paint' }));
    object.add(k.build(bits, { name: 'trench' }));
    return { object, solids: [{ box: [0, 2.1, len / 2, 1.0] }, { box: [0, -1.9, len / 2, 0.75], top: 0.7 }] };
  },

  // the wampa's cave: a hollow in a hummock of ice, icicles over its
  // mouth (to +z), and inside, hung upside down from the roof, someone in
  // a snow parka; his lightsaber in the snow where it fell
  wampacave(k) {
    const object = new THREE.Group();
    const ice = [
      roughBox(9, 7, 18, [-7.5, 0, -8], { seed: 21, amp: 1.0, scale: 5 }),
      roughBox(9, 7, 18, [7.5, 0, -8], { seed: 21, amp: 1.0, scale: 5 }),
      roughBox(24, 5, 18, [0, 5.4, -8], { seed: 21, amp: 1.0, scale: 5 }),
      roughBox(24, 7, 5, [0, 0, -18.5], { seed: 21, amp: 1.0, scale: 5 }),
    ].map((g) => part(g, { color: '#b8cde2' }));
    // the floor of the cave: blue ice
    ice.push(part(box(6, 0.06, 16), { at: [0, 0.02, -8], color: '#9ab6d2' }));
    object.add(meshOf(k, ice, iceMat(k)));
    const snow = [blob(31, [0, 8.5, -9], [30, 9, 24], { flat: 0.45 }), blob(32, [-12, 0, -4], [12, 8, 14]), blob(33, [12, 0, -6], [12, 9, 15]), blob(34, [0, 0, -22], [26, 10, 10])];
    object.add(meshOf(k, snow.map((p) => ({ ...p, to: undefined })), snowMat(k)));
    const icicles = [];
    for (let i = 0; i < 26; i++) {
      const inside = i > 13;
      const x = (k.rand() - 0.5) * (inside ? 5 : 6.2);
      const z = inside ? -2 - k.rand() * 14 : 0.4 + k.rand() * 0.8;
      const h = 0.4 + k.rand() * (inside ? 1.0 : 1.6);
      icicles.push(part(new THREE.ConeGeometry(0.08 + k.rand() * 0.1, h, 6).rotateX(PI), { at: [x, 5.4 - h / 2, z], color: '#dcecff', to: 'glass' }));
    }
    // hung by his ankles in the ice: legs, body, arms down, head
    const parka = '#a8a090';
    const hang = [
      part(box(0.7, 0.5, 0.6), { at: [0, 4.9, -10], color: '#e6f0fa', to: 'stone' }),
      part(box(0.14, 0.8, 0.16), { at: [-0.1, 4.1, -10], color: '#6a6458', to: 'cloth' }),
      part(box(0.14, 0.8, 0.16), { at: [0.1, 4.1, -10], color: '#6a6458', to: 'cloth' }),
      part(box(0.44, 0.62, 0.3), { at: [0, 3.48, -10], color: parka, to: 'cloth' }),
      part(box(0.11, 0.6, 0.13), { at: [-0.3, 2.95, -10], color: parka, to: 'cloth' }),
      part(box(0.11, 0.6, 0.13), { at: [0.3, 2.95, -10], color: parka, to: 'cloth' }),
      part(new THREE.SphereGeometry(0.13, 10, 8), { at: [0, 3.3, -10], color: '#d8b090', to: 'cloth' }),
      part(new THREE.SphereGeometry(0.14, 10, 8, 0, PI * 2, PI * 0.5, PI * 0.5), { at: [0, 3.3, -10], color: '#c8b07a', to: 'cloth' }),
      // the saber in the snow
      rod([1.6, 0.06, -6], [1.6, 0.1, -5.7], 0.025, 0.025, { color: '#a8acb2', to: 'metal' }),
      rod([1.6, 0.1, -5.7], [1.62, 0.25, -4.75], 0.025, 0.02, { color: hot('#6ab4ff', 3), to: 'glow' }),
    ];
    object.add(k.build([...icicles, ...hang], { name: 'wampacave' }));
    return { object, solids: [{ box: [-8, -8, 4.6, 9] }, { box: [8, -8, 4.6, 9] }, { box: [0, -19, 12, 2.6] }, { circle: [-12, -4, 5] }, { circle: [12, -6, 5] }] };
  },

  // the shelter Han threw up the night he found Luke: a snowed-in dome
  // tent, a lamp at its door, a tauntaun lying dead beside it in the snow
  shelter(k) {
    const fur = '#d8d0c4';
    const skin = '#9a9488';
    const parts = [
      part(dome(1.7, 1.35, 16), { color: '#8e9488', to: 'cloth' }),
      part(ring(1.7, 0.08, 20), { at: [0, 0.05, 0], color: '#5a5e58', to: 'metal' }),
      part(box(0.8, 0.95, 0.4), { at: [0, 0, 1.5], color: '#1e2024', to: 'dark' }),
      rod([-0.9, 1.1, 0.4], [0.9, 1.1, 0.4], 0.03, 0.03, { color: '#5a5e58', to: 'metal' }),
      part(box(0.18, 0.26, 0.18), { at: [0.8, 0, 1.9], color: '#4a4c50', to: 'metal' }),
      part(box(0.12, 0.12, 0.12), { at: [0.8, 0.26, 1.9], color: hot('#ffb060', 3), to: 'glow' }),
      // the tauntaun: on its side, its legs out, its horns curled
      part(new THREE.SphereGeometry(0.5, 16, 12), { at: [2.6, 0.55, -0.4], scale: [1.4, 1.1, 2.2], rot: [0, 0.4, 0], color: fur, to: 'cloth' }),
      rod([2.9, 0.6, 0.5], [3.4, 0.35, 1.3], 0.26, 0.2, { color: fur, to: 'cloth' }),
      part(new THREE.SphereGeometry(0.28, 12, 8), { at: [3.55, 0.3, 1.55], scale: [1, 0.85, 1.6], rot: [0, 0.6, 0], color: skin, to: 'cloth' }),
      part(new THREE.TorusGeometry(0.16, 0.05, 6, 12, PI * 1.5), { at: [3.4, 0.55, 1.4], rot: [0, 0.6, 0], color: '#c8b48a', to: 'stone' }),
      rod([2.0, 0.4, -1.4], [1.3, 0.3, -2.2], 0.08, 0.06, { color: fur, to: 'cloth' }),
    ];
    for (const [a, b] of [
      [[3.2, 0.5, -0.6], [4.1, 0.25, -0.9]],
      [[3.1, 0.6, 0.0], [4.0, 0.4, 0.1]],
    ])
      parts.push(rod(a, b, 0.12, 0.08, { color: fur, to: 'cloth' }));
    const object = k.build(parts, { name: 'shelter' });
    object.add(meshOf(k, [blob(41, [-1.4, -0.2, -0.6], [2.6, 1.2, 3.2], { flat: 0.4 }), blob(42, [1.8, -0.3, -1.6], [3, 0.9, 2]), blob(43, [-0.2, -0.3, -2.0], [3.6, 1.0, 1.6])].map((p) => ({ ...p, to: undefined })), snowMat(k)));
    return { object, solids: [{ circle: [0, 0, 1.7] }, { circle: [2.7, -0.3, 1.1], top: 1.1 }] };
  },

  // smoke going up from a wreck: puffs rising and spreading, over and over
  smoke(k, { h = 16, r = 1.6, color = '#3e3e40', n = 9 } = {}) {
    const object = new THREE.Group();
    const material = k.own(new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
    const geo = k.own(new THREE.IcosahedronGeometry(1, 1));
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, material);
      m.userData.k = i / n;
      object.add(m);
      puffs.push(m);
    }
    const tick = (t) => {
      for (const m of puffs) {
        const f = (t * 0.07 + m.userData.k) % 1;
        const s = r * (0.5 + f * 2.2) * (f > 0.85 ? (1 - f) / 0.15 : 1);
        m.position.set(sin(f * 5 + m.userData.k * 9) * f * 2.5 + f * 4, f * h, cos(f * 4 + m.userData.k * 7) * f * 1.5);
        m.scale.setScalar(Math.max(0.01, s));
      }
    };
    tick(0);
    return { object, update: tick };
  },

  // what's left of a probe droid that blew itself up: the burnt shell of its
  // head, arms and plates thrown about, the scorch on the snow
  probewreck(k) {
    const parts = [
      part(new THREE.CircleGeometry(4.5, 24).rotateX(-PI / 2), { at: [0, 0.05, 0], scale: [1, 1, 0.8], color: '#3a3e44', to: 'dark' }),
      part(new THREE.CircleGeometry(2.2, 20).rotateX(-PI / 2), { at: [0.3, 0.07, 0.2], color: '#1a1c1e', to: 'dark' }),
      part(new THREE.SphereGeometry(0.46, 14, 10, 0, PI * 2, 0, PI * 0.55), { at: [0.4, -0.05, 0.2], rot: [0.5, 0, 2.2], color: '#2a2c30', to: 'metal' }),
    ];
    for (let i = 0; i < 9; i++) {
      const a = k.rand() * PI * 2;
      const d = 1.2 + k.rand() * 3.5;
      const at = [cos(a) * d, 0.05, sin(a) * d];
      parts.push(i % 2 ? rod(at, [at[0] + cos(a + 1) * 0.8, 0.12, at[2] + sin(a + 1) * 0.8], 0.03, 0.03, { color: '#3a3c40', to: 'metal' }) : part(box(0.3 + k.rand() * 0.3, 0.05, 0.25), { at, rot: [k.rand(), a, 0], color: '#2a2c30', to: 'metal' }));
    }
    return { object: k.build(parts, { name: 'probewreck' }) };
  },

  // Darth Vader (2.03 m): the helmet, the mask, the chest box, the cape
  vader(k) {
    const black = '#0e0e10';
    const head = [
      part(new THREE.SphereGeometry(0.15, 18, 12, 0, PI * 2, 0, PI / 2), { at: [0, 1.62, 0], scale: [1, 1.1, 1.08], color: black, to: 'metal' }),
      part(cyl(0.21, 0.15, 0.17, 18), { at: [0, 1.46, -0.01], color: black, to: 'metal' }),
      part(box(0.17, 0.17, 0.08), { at: [0, 1.46, 0.11], color: '#26282c', to: 'metal' }),
      part(new THREE.ConeGeometry(0.055, 0.1, 3).rotateX(PI), { at: [0, 1.5, 0.16], color: '#5a5e64', to: 'metal' }),
      part(box(0.05, 0.035, 0.03), { at: [-0.045, 1.6, 0.155], color: '#3a1010', to: 'glass' }),
      part(box(0.05, 0.035, 0.03), { at: [0.045, 1.6, 0.155], color: '#3a1010', to: 'glass' }),
    ];
    const extra = [
      part(box(0.17, 0.13, 0.04), { at: [0, 1.18, 0.13], color: '#5a5e64', to: 'metal' }),
      part(box(0.03, 0.03, 0.02), { at: [-0.04, 1.26, 0.155], color: hot('#ff3a2a', 3), to: 'glow' }),
      part(box(0.03, 0.03, 0.02), { at: [0.0, 1.26, 0.155], color: hot('#3aff6a', 3), to: 'glow' }),
      part(box(0.03, 0.03, 0.02), { at: [0.04, 1.26, 0.155], color: hot('#4a8aff', 3), to: 'glow' }),
      part(box(0.07, 0.05, 0.05), { at: [-0.1, 0.89, 0.13], color: '#a8acb2', to: 'metal' }),
      part(box(0.07, 0.05, 0.05), { at: [0.1, 0.89, 0.13], color: '#a8acb2', to: 'metal' }),
      part(box(0.5, 0.08, 0.3), { at: [0, 1.46, 0], color: black, to: 'cloth' }),
    ];
    return humanoid(k, { name: 'vader', tall: 2.03, body: '#141416', head, extra, robe: ['#101012', 0.4], cape: ['#08080a', 0.7] });
  },

  // Kylo Ren (1.89 m): the black helmet with its silver trim, the cowl, the
  // robes, the unstable crossguard saber, lit
  kylo(k) {
    const black = '#121214';
    const silver = '#b8bcc2';
    const head = [
      part(new THREE.SphereGeometry(0.14, 16, 12), { at: [0, 1.66, -0.01], scale: [1, 1.08, 1.05], color: black, to: 'metal' }),
      part(box(0.18, 0.22, 0.07), { at: [0, 1.53, 0.1], color: black, to: 'metal' }),
      part(box(0.16, 0.02, 0.075), { at: [0, 1.69, 0.105], color: silver, to: 'metal' }),
      part(box(0.02, 0.13, 0.075), { at: [0, 1.56, 0.11], color: silver, to: 'metal' }),
      part(new THREE.CylinderGeometry(0.17, 0.34, 0.22, 16), { at: [0, 1.45, 0], color: '#1a1a1c', to: 'cloth' }),
    ];
    return humanoid(k, { name: 'kylo', tall: 1.89, body: '#1a1a1c', head, robe: ['#141416', 0.46], cape: ['#0e0e10', 0.62], saber: saber('#ff2a1a', { cross: true }) });
  },

  // Luke Skywalker, older (1.72 m): grey beard, dark robes, his saber lit
  luke(k) {
    const head = [
      part(new THREE.SphereGeometry(0.12, 14, 10), { at: [0, 1.63, 0], color: '#d6ae8c', to: 'cloth' }),
      part(new THREE.SphereGeometry(0.128, 14, 10, 0, PI * 2, 0, PI * 0.5), { at: [0, 1.65, -0.01], color: '#9e9a92', to: 'cloth' }),
      part(new THREE.ConeGeometry(0.09, 0.16, 10).rotateX(PI), { at: [0, 1.52, 0.07], color: '#a8a49c', to: 'cloth' }),
      part(new THREE.TorusGeometry(0.2, 0.07, 8, 16), { at: [0, 1.44, -0.02], rot: [PI / 2, 0, 0], color: '#2e2a26', to: 'cloth' }),
    ];
    return humanoid(k, { name: 'luke', tall: 1.72, body: '#6e6458', arms: '#2e2a26', legs: '#3a342e', head, robe: ['#2e2a26', 0.46], cape: ['#28241f', 0.6], saber: saber('#5aa8ff') });
  },

  // Captain Phasma (2 m): chrome armour, a black cape
  phasma(k) {
    const chrome = '#d4d8dc';
    const head = [part(new THREE.SphereGeometry(0.14, 16, 12), { at: [0, 1.65, 0], scale: [1, 1.12, 1.08], color: chrome, to: 'metal' }), part(box(0.17, 0.035, 0.05), { at: [0, 1.67, 0.125], color: '#0a0a0c', to: 'dark' }), part(box(0.08, 0.05, 0.04), { at: [0, 1.56, 0.13], color: '#3a3c40', to: 'metal' })];
    return humanoid(k, { name: 'phasma', tall: 2.0, body: chrome, to: 'metal', belt: '#1a1a1c', boots: '#2a2c30', hands: '#1a1a1c', head, cape: ['#0e0e10', 0.62] });
  },

  // ── Starkiller Base ──

  // the thermal oscillator: an octagonal drum the size of a stadium on its
  // plinth, buttresses out to its four corners, its vents glowing with the
  // sun it's holding (they pulse), the core's dome on top (~120 m across)
  oscillator(k) {
    const grey = '#565b62';
    const dark = '#33363b';
    const oct = [0, PI / 8, 0];
    const parts = [
      part(cyl(38, 36, 4, 8), { rot: oct, color: dark, to: 'paint' }),
      part(upright([[30, 4], [30, 25], [27, 28.5], [24, 31], [24, 33]], 8), { rot: oct, color: grey, to: 'paint' }),
      part(cyl(18, 16, 8, 8), { at: [0, 33, 0], rot: oct, color: dark, to: 'paint' }),
      part(dome(13, 7, 32), { at: [0, 41, 0], color: '#6a7078', to: 'metal' }),
      // the door, its frame, the light over it
      part(box(11, 9.5, 1.2), { at: [0, 4, 27.4], color: '#14161a', to: 'dark' }),
      part(box(14, 1.2, 2), { at: [0, 13.5, 27.4], color: dark, to: 'metal' }),
      part(box(1.4, 10.5, 2), { at: [-6.2, 4, 27.4], color: dark, to: 'metal' }),
      part(box(1.4, 10.5, 2), { at: [6.2, 4, 27.4], color: dark, to: 'metal' }),
      part(box(9, 0.3, 0.3), { at: [0, 12.9, 28.4], color: hot('#f0f4ff', 2.4), to: 'glow' }),
      // the ramp up to it
      part(box(12, 0.6, 17), { at: [0, 1.7, 43], rot: [0.24, 0, 0], color: dark, to: 'metal' }),
    ];
    // the corners' light strips, the crown's spires
    for (let i = 0; i < 8; i++) {
      const a = PI / 8 + (i / 8) * PI * 2;
      parts.push(part(box(0.4, 19, 0.4), { at: [sin(a) * 30.1, 5, cos(a) * 30.1], rot: [0, a, 0], color: hot('#ff5a2a', 1.8), to: 'glow' }));
    }
    for (const [x, z] of [
      [9, 9],
      [-9, 9],
      [9, -9],
      [-9, -9],
    ]) {
      parts.push(rod([x, 41, z], [x * 0.8, 58, z * 0.8], 0.5, 0.15, { color: dark, to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.5, 8, 6), { at: [x * 0.8, 58.3, z * 0.8], color: hot('#ff3a2a', 3), to: 'glow' }));
    }
    // the buttresses
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + (i / 4) * PI * 2;
      const b = loft([
        { z: 24, pts: trap8(10, 7, 22, 0.8, 11) },
        { z: 40, pts: trap8(10, 7, 14, 0.8, 7) },
        { z: 64, pts: trap8(9, 6, 3, 0.6, 1.5) },
      ]);
      parts.push(...place([part(b, { color: grey, to: 'paint' }), part(box(0.5, 0.5, 30), { at: [0, 13.5, 36], rot: [-0.33, 0, 0], color: hot('#ff5a2a', 1.6), to: 'glow' })], [0, 0, 0], [0, a, 0]));
    }
    // pipes over the snow from its foot
    for (const [a, b] of [
      [[-24, 1.6, 30], [-60, 1.6, 66]],
      [[24, 1.6, 30], [62, 1.6, 60]],
    ])
      parts.push(rod(a, b, 1.6, 1.6, { color: '#4a4e54', to: 'metal' }, 14));
    const object = k.build(parts, { name: 'oscillator' });
    // the vents, glowing and pulsing as it charges
    const vents = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      for (const y of [19.5, 22.5]) vents.push(part(box(16, 1.6, 0.4), { at: [sin(a) * 27.85, y, cos(a) * 27.85], rot: [0, a, 0], color: '#ffffff', to: 'glow' }));
    }
    const ventMat = k.own(new THREE.MeshBasicMaterial({ color: hot('#ff6a2a', 2.2), toneMapped: false }));
    const ventMesh = new THREE.Mesh(k.own(bake(vents, 0.2)), ventMat);
    object.add(ventMesh);
    const solids = [{ circle: [0, 0, 36.5] }];
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + (i / 4) * PI * 2;
      solids.push({ box: [sin(a) * 44, cos(a) * 44, 4.6, 20, a] });
    }
    return {
      object,
      solids,
      update(t) {
        const p = 1.6 + 0.9 * (0.5 + 0.5 * sin(t * 1.3)) + 0.3 * sin(t * 7.1);
        ventMat.color.set('#ff6a2a').multiplyScalar(p);
      },
    };
  },

  // a First Order garrison: an angular block of a building, its hangar
  // open and lit, red light along its edges, a control tower beside it
  fobase(k) {
    const hull = loft([
      { z: -16, pts: trap8(46, 36, 15, 2.5, 7.5) },
      { z: 10, pts: trap8(46, 36, 15, 2.5, 7.5) },
      { z: 15, pts: trap8(42, 30, 11, 2, 5.5) },
    ]);
    const parts = [
      part(hull, { color: FO, to: 'paint' }),
      part(box(17, 8, 0.8), { at: [0, 0, 14.9], color: '#121418', to: 'dark' }),
      part(box(18.6, 0.6, 1.2), { at: [0, 8, 14.8], color: FO_DARK, to: 'metal' }),
      part(box(16, 0.25, 0.3), { at: [0, 7.4, 15.4], color: hot('#e8f0ff', 2.4), to: 'glow' }),
      part(box(15, 0.05, 6), { at: [0, 0.05, 12], color: hot('#c8d8ff', 0.6), to: 'glow' }),
      part(box(14, 4, 10), { at: [6, 15, -6], color: '#43474d', to: 'paint' }),
      part(box(13.6, 0.8, 0.2), { at: [6, 17, -0.95], color: hot('#dfe8ff', 1.6), to: 'glow' }),
      rod([-8, 15, -8], [-8, 27, -8], 0.25, 0.1, { color: FO_DARK, to: 'metal' }),
      part(new THREE.SphereGeometry(0.4, 8, 6), { at: [-8, 27.3, -8], color: hot('#ff3a2a', 3), to: 'glow' }),
      // the control tower
      part(cyl(5, 4.2, 28, 8), { at: [-28, 0, -4], color: '#3e4248', to: 'paint' }),
      part(cyl(6.2, 6.2, 3.2, 8), { at: [-28, 28, -4], color: FO, to: 'paint' }),
      part(cyl(6.3, 6.3, 0.9, 8), { at: [-28, 29.2, -4], color: hot('#ffe2c4', 1.4), to: 'glow' }),
      part(cyl(3, 2, 2, 8), { at: [-28, 31.2, -4], color: FO_DARK, to: 'metal' }),
    ];
    for (const x of [-18.2, 18.2]) parts.push(part(box(0.3, 0.3, 26), { at: [x, 14.9, -3], color: hot('#ff2a1a', 2.4), to: 'glow' }));
    for (let i = 0; i < 6; i++) parts.push(part(box(0.25, 6, 0.25), { at: [-20 + i * 8, 1, 15.8 - (i > 1 && i < 4 ? 0 : 0.6)], color: hot('#ff2a1a', 1.8), to: 'glow' }));
    parts.push(...emblem([0, 13.1, 12.6], 3.0, '#b01a14', [-0.9, 0, 0]));
    return { object: k.build(parts, { name: 'fobase' }), solids: [{ box: [0, -0.5, 23, 15.6] }, { circle: [-28, -4, 5] }] };
  },

  // Hux's rally: the black stage (you can climb its steps), the lectern,
  // the great red banners of the First Order behind, floodlights
  rally(k) {
    const black = '#1a1b1e';
    const parts = [part(box(40, 1.6, 14), { color: black, to: 'paint' }), part(box(40, 0.12, 0.12), { at: [0, 1.6, 7], color: hot('#ff2a1a', 2), to: 'glow' })];
    const floors = [{ x: 0, z: 0, hw: 20, hd: 7, y: 1.6 }];
    for (let j = 1; j <= 3; j++) {
      const z = 7 + (3 - j) * 0.8 + 0.4;
      parts.push(part(box(10, 0.4 * j, 0.8), { at: [0, 0, z], color: '#26282c', to: 'paint' }));
      floors.push({ x: 0, z, hw: 5, hd: 0.4, y: 0.4 * j });
    }
    parts.push(part(box(1.6, 1.25, 0.8), { at: [0, 1.6, 4.4], color: '#2a2c30', to: 'paint' }));
    parts.push(...emblem([0, 2.35, 4.82], 0.42, '#b01a14'));
    // the banners
    for (const [x, h, w] of [
      [-17, 22, 5],
      [-8.5, 26, 6],
      [0, 30, 7],
      [8.5, 26, 6],
      [17, 22, 5],
    ]) {
      parts.push(part(box(w, h - 2, 0.12), { at: [x, 1.8, -7.6], color: '#9a1a16', to: 'cloth' }));
      parts.push(part(box(w + 0.6, 0.5, 0.5), { at: [x, h, -7.6], color: black, to: 'metal' }));
      for (const s of [-1, 1]) parts.push(part(box(0.35, h + 0.4, 0.35), { at: [x + s * (w / 2 + 0.2), 0, -7.6], color: black, to: 'metal' }));
      parts.push(...emblem([x, h - w * 0.75, -7.5], w * 0.42, '#141416'));
    }
    // floodlights
    for (const x of [-26, 26]) {
      parts.push(rod([x, 0, 4], [x, 14, 4], 0.25, 0.18, { color: black, to: 'metal' }));
      parts.push(part(box(2.4, 1.4, 0.4), { at: [x, 13.2, 4.2], rot: [0.4, -Math.sign(x) * 0.5, 0], color: hot('#f4f6ff', 2.6), to: 'glow' }));
    }
    const solids = [
      { box: [-12.75, 6.85, 7.25, 0.15], top: 1.6 },
      { box: [12.75, 6.85, 7.25, 0.15], top: 1.6 },
      { box: [0, -6.85, 20, 0.15], top: 1.6 },
      { box: [-19.85, 0, 0.15, 7], top: 1.6 },
      { box: [19.85, 0, 0.15, 7], top: 1.6 },
      { box: [0, 4.4, 0.8, 0.4] },
    ];
    for (const x of [-17, -8.5, 0, 8.5, 17]) solids.push({ box: [x, -7.6, 3.6, 0.3] });
    return { object: k.build(parts, { name: 'rally' }), solids, floors };
  },

  // stormtroopers drawn up in ranks, as still as statues (rows × cols)
  troopranks(k, { rows = 5, cols = 10, gap = 1.45 } = {}) {
    const white = '#f0f0ee';
    const black = '#141414';
    const parts = [];
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const x = (j - (cols - 1) / 2) * gap;
        const z = (i - (rows - 1) / 2) * gap;
        parts.push(
          part(box(0.14, 0.88, 0.2), { at: [x - 0.09, 0, z], color: white, to: 'paint' }),
          part(box(0.14, 0.88, 0.2), { at: [x + 0.09, 0, z], color: white, to: 'paint' }),
          part(box(0.4, 0.12, 0.24), { at: [x, 0.84, z], color: black, to: 'dark' }),
          part(box(0.44, 0.52, 0.26), { at: [x, 0.96, z], color: white, to: 'paint' }),
          part(box(0.1, 0.6, 0.14), { at: [x - 0.28, 0.86, z], color: white, to: 'paint' }),
          part(box(0.1, 0.6, 0.14), { at: [x + 0.28, 0.86, z], color: white, to: 'paint' }),
          part(box(0.1, 0.08, 0.5), { at: [x + 0.28, 0.9, z + 0.1], color: black, to: 'dark' }),
          part(new THREE.SphereGeometry(0.135, 10, 8), { at: [x, 1.66, z], scale: [1, 1.1, 1.05], color: white, to: 'paint' }),
          part(box(0.17, 0.045, 0.05), { at: [x, 1.68, z + 0.12], color: black, to: 'dark' }),
          part(box(0.12, 0.1, 0.12), { at: [x, 1.48, z], color: black, to: 'dark' }),
        );
      }
    return { object: k.build(parts, { name: 'troopranks' }), solids: [{ box: [0, 0, (cols * gap) / 2, (rows * gap) / 2] }] };
  },

  // a First Order turbolaser tower: an octagonal base, the turret, two
  // long barrels (12 m)
  foturbolaser(k) {
    const top = loft([
      { z: -3, pts: trap8(5, 4, 3, 0.4, 1.5) },
      { z: 1.6, pts: trap8(5, 4, 3, 0.4, 1.5) },
      { z: 2.8, pts: trap8(4, 2.6, 1.8, 0.3, 1.0) },
    ]);
    const parts = [part(cyl(4.6, 3.4, 7, 8), { rot: [0, PI / 8, 0], color: FO, to: 'paint' }), part(cyl(3.6, 3.6, 0.6, 8), { at: [0, 7, 0], color: FO_DARK, to: 'metal' }), part(top, { at: [0, 7.6, 0], color: '#5a5f66', to: 'paint' }), part(box(3, 0.2, 0.1), { at: [0, 9.6, 2.2], rot: [-0.6, 0, 0], color: hot('#ff3a2a', 2), to: 'glow' })];
    for (const x of [-0.9, 0.9]) {
      parts.push(rod([x, 9.0, 2.2], [x, 9.4, 10], 0.34, 0.28, { color: FO_DARK, to: 'metal' }, 12));
      parts.push(rod([x, 9.38, 9.6], [x, 9.42, 10.4], 0.42, 0.42, { color: FO_DARK, to: 'metal' }, 12));
    }
    return { object: k.build(parts, { name: 'foturbolaser' }), solids: [{ circle: [0, 0, 4.4] }] };
  },

  // a First Order snowspeeder: a dark slab of a hull floating over the
  // snow, the driver's cab up front, a gun on a post over the troop bay
  fosnowspeeder(k) {
    const hull = loft([
      { z: -3.2, pts: trap8(2.6, 2.3, 1.3, 0.2, 1.25) },
      { z: 1.6, pts: trap8(2.7, 2.4, 1.4, 0.2, 1.3) },
      { z: 3.3, pts: trap8(2.2, 1.5, 0.9, 0.15, 1.05) },
    ]);
    const cab = loft([
      { z: 0.2, pts: trap8(2.0, 1.6, 0.9, 0.15, 2.4) },
      { z: 1.4, pts: trap8(2.0, 1.4, 0.9, 0.15, 2.4) },
      { z: 2.1, pts: trap8(1.8, 1.1, 0.5, 0.1, 2.2) },
    ]);
    const parts = [
      part(hull, { color: FO, to: 'paint' }),
      part(cab, { color: '#43474d', to: 'paint' }),
      part(box(1.6, 0.36, 0.06), { at: [0, 2.38, 1.78], rot: [-0.9, 0, 0], color: '#1a2028', to: 'glass' }),
      part(box(2.0, 0.5, 3.0), { at: [0, 1.95, -1.6], color: FO_DARK, to: 'metal' }),
      rod([0, 2.4, -2.4], [0, 3.3, -2.4], 0.1, 0.1, { color: FO_DARK, to: 'metal' }),
      part(box(0.4, 0.4, 0.9), { at: [0, 3.2, -2.3], color: '#3a3e44', to: 'metal' }),
      rod([0, 3.42, -1.9], [0, 3.48, -0.4], 0.06, 0.05, { color: FO_DARK, to: 'metal' }),
    ];
    for (const x of [-0.85, 0.85]) {
      parts.push(part(box(0.7, 0.6, 0.5), { at: [x, 0.9, -3.4], color: FO_DARK, to: 'metal' }));
      parts.push(part(box(0.5, 0.36, 0.06), { at: [x, 1.02, -3.66], color: hot('#ff6a3a', 2), to: 'glow' }));
      parts.push(part(box(0.3, 0.12, 5), { at: [x * 1.2, 0.5, 0], color: '#1e2024', to: 'metal' }));
    }
    return { object: k.build(parts, { name: 'fosnowspeeder' }), solids: [{ box: [0, 0, 1.4, 3.4] }] };
  },

  // the sun being drained: a river of fire from the sun down into the
  // planet, flowing (placed far out under the sun: az, el its direction)
  sundrain(k, { az = 0, el = 0.15, len = 13000, r = 240 } = {}) {
    const object = new THREE.Group();
    const beam = new THREE.Group();
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sin(az) * cos(el), sin(el), cos(az) * cos(el)));
    object.add(beam);
    const tex = k.own(
      canvasTexture(128, (c, n) => {
        c.fillStyle = '#000';
        c.fillRect(0, 0, n, n);
        for (let i = 0; i < 90; i++) {
          const v = 120 + k.rand() * 135;
          c.fillStyle = `rgba(${v},${v},${v},${0.25 + k.rand() * 0.6})`;
          c.fillRect(k.rand() * n, k.rand() * n, 1 + k.rand() * 5, 10 + k.rand() * 60);
        }
      }),
    );
    tex.repeat.set(2, 3);
    const mats = [];
    for (const [rr, c, kk, op] of [
      [r, '#ff4a12', 1.4, 0.55],
      [r * 0.5, '#ff9a3a', 1.6, 0.7],
      [r * 0.2, '#fff0c8', 2.2, 0.9],
    ]) {
      const m = k.own(new THREE.MeshBasicMaterial({ color: hot(c, kk), map: tex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false }));
      const g = k.own(new THREE.CylinderGeometry(rr * 0.05, rr, len, 28, 1, true).translate(0, len / 2, 0));
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      beam.add(mesh);
      mats.push(m);
    }
    // where it pours in: a glow on the horizon
    const glow = new THREE.Mesh(k.own(new THREE.SphereGeometry(r * 1.6, 20, 12)), k.own(new THREE.MeshBasicMaterial({ color: hot('#ff5a1a', 0.9), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })));
    glow.scale.set(1.6, 0.6, 1.6);
    object.add(glow);
    return {
      object,
      update(t) {
        tex.offset.y = (t * 0.06) % 1;
        tex.offset.x = sin(t * 0.1) * 0.05;
      },
    };
  },

  // a crack in the snow where the planet's breaking up, glowing from below,
  // slabs of snow heaved up along it (`len` m along z)
  fissure(k, { len = 46 } = {}) {
    const parts = [];
    const n = Math.round(len / 2);
    const seed = Math.floor(k.rand() * 50);
    const xAt = (z) => noise2(z / 9, 0.5, seed) * 3.2;
    for (let i = 0; i < n; i++) {
      const z0 = -len / 2 + (i / n) * len;
      const z1 = -len / 2 + ((i + 1) / n) * len;
      const x0 = xAt(z0);
      const x1 = xAt(z1);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      const f = Math.min(i + 1, n - i) / (n / 2);
      const w = (0.9 + 1.4 * Math.min(1, f * 1.4)) * (1 + noise2(i * 0.7, 3, seed) * 0.3);
      const mid = [(x0 + x1) / 2, 0.03, (z0 + z1) / 2];
      const L = Math.hypot(x1 - x0, z1 - z0) + 0.3;
      parts.push(part(box(w, 0.06, L), { at: mid, rot: [0, yaw, 0], color: '#16100e', to: 'dark' }));
      parts.push(part(box(w * 0.32, 0.07, L), { at: [mid[0], 0.045, mid[2]], rot: [0, yaw, 0], color: hot('#ff5a1a', 2.4), to: 'glow' }));
      if (i % 2 === 0)
        for (const s of [-1, 1]) {
          const off = (w / 2 + 0.5) * s;
          parts.push(part(box(1.3, 0.45, 2.2), { at: [mid[0] + cos(yaw) * off, -0.1, mid[2] - sin(yaw) * off], rot: [0, yaw, s * 0.3], color: SNOW, to: 'stone' }));
        }
    }
    return { object: k.build(parts, { name: 'fissure', shadows: false }) };
  },

  // a pine Kylo Ren slashed as he came after Rey: cuts glowing in its
  // trunk, and the one he cut through lying beside it
  duelpine(k) {
    const parts = pine(22);
    for (let i = 0; i < 4; i++) parts.push(part(box(0.7, 0.07, 0.07), { at: [0, 1.2 + i * 0.45, 0.5], rot: [0, 0, (i % 2 ? 1 : -1) * 0.5], color: hot('#ff6a2a', 2.6), to: 'glow' }));
    parts.push(rod([4, 0.4, -2], [4.5, 0.6, 9], 0.45, 0.35, { color: '#3a2a20', to: 'bark' }));
    parts.push(part(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), { at: [4, 0.42, -2.03], rot: [PI / 2 + 0.02, 0, 0], color: hot('#ff7a3a', 2.2), to: 'glow' }));
    parts.push(part(cyl(0.48, 0.44, 0.9, 10), { at: [4, 0, -3.2], color: '#3a2a20', to: 'bark' }));
    parts.push(part(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 10), { at: [4, 0.92, -3.2], color: hot('#ff7a3a', 2.2), to: 'glow' }));
    return { object: k.build(parts, { name: 'duelpine' }), solids: [{ circle: [0, 0, 0.7] }, { circle: [4, -3.2, 0.5] }] };
  },

  // an old Jedi cave from when this world was Ilum: a cave mouth in a
  // snowy crag, kyber crystals glowing in it and round it
  kybercave(k) {
    const object = new THREE.Group();
    const rock = '#5c6068';
    const crag = [
      roughBox(10, 12, 16, [-8, 0, -7], { seed: 61, amp: 1.6, scale: 6 }),
      roughBox(10, 12, 16, [8, 0, -7], { seed: 61, amp: 1.6, scale: 6 }),
      roughBox(26, 8, 16, [0, 6.5, -7], { seed: 61, amp: 1.6, scale: 6 }),
      roughBox(26, 12, 6, [0, 0, -17], { seed: 61, amp: 1.6, scale: 6 }),
    ].map((g) => part(g, { color: rock, to: 'stone' }));
    crag.push(blob(62, [0, 13, -8], [30, 6, 22], { flat: 0.4, color: SNOW }), blob(63, [-14, 0, -4], [10, 9, 12], { color: '#6a6e76', sharp: 0.6 }), blob(64, [14, 0, -6], [10, 10, 14], { color: '#6a6e76', sharp: 0.6 }));
    crag.push(part(box(6, 0.05, 15), { at: [0, 0.03, -7], color: '#2a2e36', to: 'dark' }));
    object.add(k.build(crag, { name: 'kybercave' }));
    const cr = [];
    const cluster = (cx, cz, n, s) => {
      for (let i = 0; i < n; i++) {
        const a = k.rand() * PI * 2;
        const d = k.rand() * s;
        const h = (0.4 + k.rand() * 1.1) * s;
        const rr = 0.08 + k.rand() * 0.1 * s;
        const rot = [(k.rand() - 0.5) * 0.9, a, (k.rand() - 0.5) * 0.9];
        const at = [cx + cos(a) * d, 0, cz + sin(a) * d];
        cr.push(part(new THREE.CylinderGeometry(rr, rr * 1.15, h, 6).translate(0, h / 2, 0), { at, rot, color: hot('#bfe8ff', 1.6), to: 'glow' }));
        cr.push(part(new THREE.ConeGeometry(rr, rr * 2.4, 6).translate(0, h + rr * 1.2, 0), { at, rot, color: hot('#e8f8ff', 2.2), to: 'glow' }));
      }
    };
    cluster(-1.8, -6, 7, 1.2);
    cluster(2, -10, 6, 1.4);
    cluster(-1, -13, 6, 1.6);
    cluster(3.5, 1.5, 4, 0.8);
    cluster(-4, 2, 3, 0.7);
    object.add(k.build(cr, { name: 'kyber' }));
    return { object, solids: [{ box: [-8.5, -7, 5, 8] }, { box: [8.5, -7, 5, 8] }, { box: [0, -17.5, 13, 3] }, { circle: [-14, -4, 5] }, { circle: [14, -6, 5] }] };
  },

  // ── Crait ──

  // the old Rebel outpost: a cliff of red-brown rock under its crust of
  // salt, the great armoured door set into it, the hole the battering ram
  // cannon burned through it still glowing (the door faces +z)
  minedoor(k) {
    const object = new THREE.Group();
    const rock = '#8a726c';
    const cliff = [
      roughBox(70, 46, 40, [-48, 0, -22], { seed: 71, amp: 2.6, scale: 11 }),
      roughBox(70, 46, 40, [48, 0, -22], { seed: 71, amp: 2.6, scale: 11 }),
      roughBox(26.4, 22, 40, [0, 24, -22], { seed: 71, amp: 2.6, scale: 11 }),
      roughBox(26.4, 24, 20, [0, 0, -32], { seed: 71, amp: 1.2, scale: 11 }),
      roughBox(50, 36, 40, [-100, 0, -36], { seed: 72, amp: 3, scale: 12 }),
      roughBox(50, 36, 40, [100, 0, -36], { seed: 72, amp: 3, scale: 12 }),
    ].map((g) => part(g, { color: rock, to: 'stone' }));
    // salt on its top and heaped round its foot
    cliff.push(part(roughBox(150, 3, 44, [0, 45, -22], { seed: 73, amp: 1.4, base: false }), { color: SALT, to: 'stone' }));
    for (const x of [-60, -30, 30, 60, -100, 100]) cliff.push(blob(74 + x, [x, -1, 0], [24, 7, 10], { color: SALT, flat: 0.5 }));
    object.add(k.build(cliff, { name: 'minecliff' }));
    const metal = '#6a625e';
    const parts = [
      part(box(4, 24, 5), { at: [-14, 0, -2.5], color: '#4e4844', to: 'metal' }),
      part(box(4, 24, 5), { at: [14, 0, -2.5], color: '#4e4844', to: 'metal' }),
      part(box(32, 4, 5), { at: [0, 22, -2.5], color: '#4e4844', to: 'metal' }),
      part(box(24, 22, 1), { at: [0, 0, -4.2], color: '#1e1a18', to: 'dark' }),
    ];
    for (let i = 0; i < 8; i++) parts.push(part(box(24, 2.45, 1.6), { at: [0, i * 2.75, -3.6], color: i % 3 === 1 ? '#76706a' : metal, to: 'metal' }));
    // the hole, burned through
    parts.push(part(new THREE.CylinderGeometry(4.2, 4.2, 0.3, 28), { at: [0, 9, -2.7], rot: [PI / 2, 0, 0], color: '#0c0a0a', to: 'dark' }));
    parts.push(part(new THREE.TorusGeometry(4.3, 0.35, 8, 32), { at: [0, 9, -2.6], color: hot('#ff6a2a', 2.6), to: 'glow' }));
    parts.push(part(new THREE.TorusGeometry(5.3, 0.7, 8, 32), { at: [0, 9, -2.75], color: '#2a201c', to: 'dark' }));
    for (const x of [-12, 12]) parts.push(part(box(1.2, 0.5, 0.4), { at: [x, 21.2, 0.3], color: hot('#f6f0e8', 2.4), to: 'glow' }));
    object.add(k.build(parts, { name: 'minedoor' }));
    return {
      object,
      solids: [{ box: [-48, -22, 35, 20] }, { box: [48, -22, 35, 20] }, { box: [0, -22, 13.2, 20] }, { box: [-100, -36, 25, 20] }, { box: [100, -36, 25, 20] }, { box: [-14, -2.5, 2, 2.5] }, { box: [14, -2.5, 2, 2.5] }],
    };
  },

  // the battering ram cannon: a giant gun on a tracked sled, its energy
  // chamber glowing red at the back, its muzzle charging (~56 m long)
  ramcannon(k) {
    const g = '#5e6268';
    const d = '#34373c';
    const hull = loft([
      { z: -14, pts: trap8(11, 8, 6, 1, 5) },
      { z: 8, pts: trap8(11, 8, 6, 1, 5) },
      { z: 12, pts: trap8(9, 5, 4, 0.8, 4) },
    ]);
    const tilt = 0.05;
    const along = (s) => [0, 10.5 + s * sin(tilt), -4 + s * cos(tilt)];
    const parts = [part(hull, { color: g, to: 'paint' }), part(new THREE.SphereGeometry(5.6, 24, 16), { at: [0, 10.5, -9], color: g, to: 'paint' }), rod(along(0), along(46), 2.9, 2.5, { color: '#6a6e74', to: 'metal' }, 20), rod(along(45), along(49), 3.4, 3.4, { color: d, to: 'metal' }, 20)];
    for (let s = 6; s < 44; s += 4.5) parts.push(rod(along(s), along(s + 0.8), 3.15, 3.15, { color: d, to: 'metal' }, 20));
    for (const x of [-6, 6])
      for (const z of [-8, 5]) {
        parts.push(part(box(3.2, 3.6, 10), { at: [x, 0, z], color: d, to: 'metal' }));
        parts.push(part(box(2.4, 2, 7), { at: [x, 3.6, z], color: g, to: 'paint' }));
      }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      parts.push(part(box(0.5, 3.4, 0.3), { at: [cos(a) * 5.55, 8.8, -9 + sin(a) * 5.55], rot: [0, -a + PI / 2, 0], color: hot('#ff2a12', 2.2), to: 'glow' }));
    }
    parts.push(rod([0, 8, 4], along(16), 0.8, 0.8, { color: d, to: 'metal' }));
    const object = k.build(parts, { name: 'ramcannon' });
    const muzzleMat = k.own(new THREE.MeshBasicMaterial({ color: hot('#ff3a1a', 2), toneMapped: false }));
    const muzzle = new THREE.Mesh(k.own(new THREE.CylinderGeometry(2.2, 2.2, 0.2, 24)), muzzleMat);
    muzzle.position.set(...along(49.15));
    muzzle.rotation.x = PI / 2 - tilt;
    object.add(muzzle);
    return {
      object,
      solids: [{ box: [0, -1, 7.8, 13.5] }],
      update(t) {
        muzzleMat.color.set('#ff3a1a').multiplyScalar(1.4 + 1.6 * (0.5 + 0.5 * sin(t * 0.8)) ** 3);
      },
    };
  },

  // a cluster of Crait's crystals: white spires, glassy, a red fire in a
  // few of them (`s`: how big, `n`: how many)
  crystals(k, { n = 16, s = 1 } = {}) {
    const white = [];
    const red = [];
    for (let i = 0; i < n; i++) {
      const a = k.rand() * PI * 2;
      const d = Math.sqrt(k.rand()) * 3.2 * s;
      const h = (1.2 + k.rand() * 4.2) * s * (1 - d / (4.5 * s));
      const rr = (0.18 + k.rand() * 0.32) * s;
      const rot = [(k.rand() - 0.5) * 0.8, k.rand() * PI, (k.rand() - 0.5) * 0.8];
      const at = [cos(a) * d, -0.2, sin(a) * d];
      const list = i % 5 === 2 ? red : white;
      const c = i % 5 === 2 ? hot('#e83a2a', 1.3) : new THREE.Color(i % 3 ? '#f4eeee' : '#e6d6d8');
      list.push(part(new THREE.CylinderGeometry(rr, rr * 1.1, h, 6).translate(0, h / 2, 0), { at, rot, color: c }));
      list.push(part(new THREE.ConeGeometry(rr, rr * 2.2, 6).translate(0, h + rr * 1.1, 0), { at, rot, color: c }));
    }
    const object = new THREE.Group();
    object.add(meshOf(k, white, crystalMat(k), { density: 0.5 }));
    if (red.length) object.add(k.build(red.map((p) => ({ ...p, to: 'glow' })), { name: 'crystal-red' }));
    return { object, solids: [{ circle: [0, 0, 2.2 * s] }] };
  },

  // a red trail across the salt: where a ski speeder's keel scraped through
  // to the red underneath (`len` m along z, wandering)
  redtrail(k, { len = 60, w = 1.4 } = {}) {
    const parts = [];
    const seed = Math.floor(k.rand() * 50);
    const n = Math.round(len / 2.5);
    const xAt = (z) => noise2(z / 30, 1.5, seed) * 6;
    for (let i = 0; i < n; i++) {
      const z0 = -len / 2 + (i / n) * len;
      const z1 = -len / 2 + ((i + 1) / n) * len;
      const x0 = xAt(z0);
      const x1 = xAt(z1);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      const f = Math.min(1, (i + 0.5) / (n * 0.15), (n - i) / (n * 0.3));
      const mid = [(x0 + x1) / 2, 0.02, (z0 + z1) / 2];
      const L = Math.hypot(x1 - x0, z1 - z0) + 0.4;
      parts.push(part(box(w * 2.6 * f, 0.04, L), { at: [mid[0], 0.0, mid[2]], rot: [0, yaw, 0], color: '#d6948c', to: 'adobe' }));
      parts.push(part(box(w * f, 0.06, L), { at: mid, rot: [0, yaw, 0], color: RED, to: 'adobe' }));
    }
    return { object: k.build(parts, { name: 'redtrail', shadows: false }) };
  },

  // the back way out of the mine: a cleft in the rock choked with fallen
  // boulders, and some of them hanging in the air, lifted (they drift)
  liftrocks(k) {
    const object = new THREE.Group();
    const rock = '#7e6a64';
    const walls = [roughBox(14, 26, 30, [-13, 0, -10], { seed: 81, amp: 2, scale: 8 }), roughBox(14, 26, 30, [13, 0, -10], { seed: 82, amp: 2, scale: 8 })].map((g) => part(g, { color: rock, to: 'stone' }));
    walls.push(part(roughBox(40, 2, 30, [0, 26, -10], { seed: 83, amp: 1, base: false }), { color: SALT, to: 'stone' }));
    for (let i = 0; i < 12; i++) walls.push(blob(90 + i, [(k.rand() - 0.5) * 9, -0.4, -6 - k.rand() * 14], [2 + k.rand() * 3, 1.5 + k.rand() * 3, 2 + k.rand() * 3], { color: i % 3 ? rock : '#6a5852', sharp: 0.6, detail: 1 }));
    object.add(k.build(walls, { name: 'liftrocks' }));
    const floating = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const s = 1 + k.rand() * 2.2;
      g.add(k.build([blob(110 + i, [0, -s * 0.3, 0], [s * 1.2, s, s], { color: i % 2 ? rock : '#6a5852', sharp: 0.7, detail: 1 })], { name: 'rock' }));
      g.userData = { x: (k.rand() - 0.5) * 8, y: 4 + k.rand() * 9, z: 2 - k.rand() * 10, p: k.rand() * 6, spin: (k.rand() - 0.5) * 0.3 };
      object.add(g);
      floating.push(g);
    }
    const tick = (t) => {
      for (const g of floating) {
        const u = g.userData;
        g.position.set(u.x, u.y + sin(t * 0.6 + u.p) * 0.4, u.z);
        g.rotation.set(sin(t * 0.2 + u.p) * 0.3, t * u.spin + u.p, 0);
      }
    };
    tick(0);
    return { object, update: tick, solids: [{ box: [-13, -10, 7, 15] }, { box: [13, -10, 7, 15] }, { box: [0, -12, 6, 7] }] };
  },

  // a V-4X-D ski speeder: the long hull with its open cockpit, the two
  // engines out on their pylons, the ski under it that drags through the
  // salt (9 m; y = 0 is where it hovers, the ski reaching down below it)
  skispeeder(k) {
    const white = '#d6cfc4';
    const rust = '#9a5a3c';
    const dark = '#3a3632';
    const red = '#b0302a';
    const hull = loft([
      { z: -4.4, pts: trap8(0.9, 0.7, 0.7, 0.12, 0.95) },
      { z: -2.0, pts: trap8(1.5, 1.2, 1.05, 0.18, 0.95) },
      { z: 1.4, pts: trap8(1.45, 1.15, 1.0, 0.18, 0.92) },
      { z: 3.6, pts: trap8(0.95, 0.65, 0.66, 0.12, 0.8) },
      { z: 4.6, pts: trap8(0.3, 0.2, 0.26, 0.05, 0.72) },
    ]);
    const parts = [
      part(hull, { color: white, to: 'paint' }),
      part(box(1.0, 0.1, 1.9), { at: [0, 1.38, 0.3], color: '#1c1a18', to: 'dark' }),
      part(box(0.9, 0.3, 0.06), { at: [0, 1.5, 1.32], rot: [-0.6, 0, 0], color: '#6a8aa0', to: 'glass' }),
      part(box(1.52, 0.1, 0.5), { at: [0, 1.0, 2.6], color: red, to: 'paint' }),
      part(box(1.2, 0.08, 0.3), { at: [0, 1.2, -3.0], color: rust, to: 'paint' }),
    ];
    for (const s of [-1, 1]) {
      parts.push(part(box(1.5, 0.22, 0.9), { at: [s * 1.1, 0.95, -2.5], color: rust, to: 'paint' }));
      parts.push(rod([s * 1.95, 0.95, -4.2], [s * 1.95, 0.95, -0.9], 0.55, 0.5, { color: white, to: 'paint' }, 14));
      parts.push(rod([s * 1.95, 0.95, -0.9], [s * 1.95, 0.95, -0.4], 0.5, 0.36, { color: dark, to: 'metal' }, 14));
      parts.push(rod([s * 1.95, 0.95, -4.25], [s * 1.95, 0.95, -4.3], 0.42, 0.42, { color: hot('#ff8a4a', 2), to: 'glow' }, 14));
      parts.push(part(box(0.06, 0.4, 2.0), { at: [s * 2.5, 0.75, -2.6], color: red, to: 'paint' }));
      parts.push(rod([s * 0.62, 0.78, 3.2], [s * 0.62, 0.78, 4.6], 0.05, 0.04, { color: dark, to: 'metal' }));
    }
    // the ski
    parts.push(part(box(0.12, 0.95, 0.5), { at: [0, -0.55, -1.0], rot: [0.5, 0, 0], color: dark, to: 'metal' }));
    parts.push(part(box(0.16, 0.08, 1.6), { at: [0, -0.55, -1.6], color: '#5a5450', to: 'metal' }));
    return { object: k.build(parts, { name: 'skispeeder' }), solids: [{ box: [0, -0.4, 2.4, 4.4] }] };
  },

  // an AT-M6: the First Order's heavy walker, its front legs on their
  // knuckles like a gorilla's, the great cannon along its back (~27 m);
  // it walks as it goes (update's `move`, 0…1)
  atm6(k, { color = '#6b6f75' } = {}) {
    const dark = '#3a3d42';
    const B = 20.4;
    const object = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = B;
    object.add(body);
    const hull = loft([
      { z: -10, pts: trap8(7.0, 5.0, 5.4, 1.0, 0.2) },
      { z: -8.4, pts: trap8(8.6, 6.4, 6.6, 1.2, 0.2) },
      { z: 7.5, pts: trap8(8.6, 6.0, 6.2, 1.2, 0) },
      { z: 10, pts: trap8(6.4, 4.0, 4.6, 1.0, -0.4) },
    ]);
    const head = loft([
      { z: 11.6, pts: trap8(4.0, 3.0, 3.2, 0.5, -2.2) },
      { z: 16.6, pts: trap8(4.6, 3.2, 3.6, 0.6, -2.3) },
      { z: 19.2, pts: trap8(3.0, 2.0, 2.2, 0.4, -2.8) },
    ]);
    const parts = [part(hull, { color, to: 'paint' }), part(head, { color, to: 'paint' })];
    for (let i = 0; i < 3; i++) parts.push(part(new THREE.CylinderGeometry(1.4, 1.5, 0.7, 12), { at: [0, -1.4, 10.2 + i * 0.6], rot: [PI / 2, 0, 0], color: i % 2 ? color : dark, to: i % 2 ? 'paint' : 'metal' }));
    // the armour along its spine, the cannon
    parts.push(part(box(3.2, 1.2, 15), { at: [0, 3.2, -1.5], color: dark, to: 'metal' }));
    parts.push(part(box(4.6, 2.4, 6), { at: [0, 3.6, 1], color, to: 'paint' }));
    parts.push(rod([0, 5.0, 3.5], [0, 5.6, 21], 0.85, 0.7, { color: dark, to: 'metal' }, 14));
    parts.push(rod([0, 5.55, 19.8], [0, 5.62, 21.6], 1.1, 1.1, { color: dark, to: 'metal' }, 14));
    for (const x of [-1.9, 1.9]) parts.push(rod([x, -3.4, 18.4], [x, -3.5, 21.2], 0.22, 0.2, { color: dark, to: 'metal' }));
    for (const x of [-0.8, 0.8]) parts.push(part(box(0.7, 0.2, 0.1), { at: [x, -1.6, 19.15], rot: [-0.4, 0, 0], color: hot('#ff5a3a', 1.8), to: 'glow' }));
    body.add(k.build(parts, { name: 'atm6-body' }));
    // legs: the front pair on their knuckles, the back pair straight
    const legs = [];
    const leg = (x, z, front, phase) => {
      const hip = new THREE.Group();
      hip.position.set(x, B - 1.2, z);
      const thigh = new THREE.Group();
      thigh.rotation.x = front ? -0.35 : 0.08;
      hip.add(thigh);
      thigh.add(k.build([part(box(1.8, front ? 9.6 : 9.2, 2.1).translate(0, -(front ? 9.6 : 9.2), 0), { color, to: 'paint' }), part(new THREE.CylinderGeometry(1.3, 1.3, 2.3, 14), { rot: [0, 0, PI / 2], color: dark, to: 'metal' })], { name: 'atm6-thigh' }));
      const knee = new THREE.Group();
      knee.position.y = front ? -9.6 : -9.2;
      knee.rotation.x = front ? 0.65 : -0.16;
      thigh.add(knee);
      const shin = front ? 8.6 : 8.3;
      knee.add(
        k.build(
          [
            part(new THREE.CylinderGeometry(1.1, 1.1, 2.1, 14), { rot: [0, 0, PI / 2], color: dark, to: 'metal' }),
            part(box(1.5, shin, 1.8).translate(0, -shin, 0), { color, to: 'paint' }),
            front ? part(box(2.8, 1.6, 3.0), { at: [0, -shin - 1.3, 0.4], color: dark, to: 'metal' }) : part(new THREE.CylinderGeometry(1.7, 1.9, 0.9, 16), { at: [0, -shin - 0.85, 0], color, to: 'paint' }),
          ],
          { name: 'atm6-shin' },
        ),
      );
      object.add(hip);
      legs.push({ hip, knee, phase, front, k0: knee.rotation.x });
    };
    leg(-4.6, 6.8, true, 0);
    leg(4.6, 6.8, true, 0.5);
    leg(-4.3, -6.8, false, 0.75);
    leg(4.3, -6.8, false, 0.25);
    let cycle = 0;
    return {
      object,
      solids: legs.map((l) => ({ circle: [l.hip.position.x, l.hip.position.z, 1.8] })),
      update(t, dt, move = 0) {
        cycle += (dt ?? 0) * 0.26 * move;
        for (const l of legs) {
          const a = (cycle + l.phase) * PI * 2;
          l.hip.rotation.x = sin(a) * 0.16 * move;
          l.knee.rotation.x = l.k0 + (l.front ? 1 : -1) * Math.max(0, sin(a + 0.9)) * 0.3 * move;
        }
        body.position.y = B + Math.abs(sin(cycle * PI * 4)) * 0.3 * move;
        body.rotation.z = sin(cycle * PI * 2) * 0.012 * move;
      },
    };
  },
};

// (a pine laden with snow, `h` m tall: its trunk, its tiers, the snow on
// each; for scattering and for the one Kylo Ren slashed)
function pine(h = 16) {
  const s = h / 16;
  const parts = [part(cyl(0.42 * s, 0.12 * s, h * 0.92, 8), { color: '#3a2a20', to: 'bark' })];
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers;
    const r = (4.0 - f * 3.0) * s;
    const th = (5.2 - f * 2.4) * s;
    const y = h * (0.16 + f * 0.7);
    parts.push(part(new THREE.ConeGeometry(r, th, 9).translate(0, th / 2, 0), { at: [0, y, 0], rot: [0, i * 0.7, 0], color: '#1d3a2c', to: 'leaf' }));
    parts.push(part(new THREE.ConeGeometry(r * 0.6, th * 0.55, 9).translate(0, (th * 0.55) / 2, 0), { at: [0, y + th * 0.45 + 0.04, 0], rot: [0, i * 0.7 + 0.35, 0], color: SNOW, to: 'leaf' }));
  }
  return parts;
}

// (the First Order's emblem: a hexagon, its rays all round; `s` across,
// facing +z at `at`, turned by `rot`)
function emblem(at, s, color, rot = [0, 0, 0]) {
  const parts = [part(new THREE.CylinderGeometry(s * 0.36, s * 0.36, 0.1, 6).rotateX(PI / 2), { rot: [0, 0, PI / 6], color, to: 'paint' })];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    const len = i % 2 ? s * 0.34 : s * 0.42;
    parts.push(part(new THREE.BoxGeometry(s * 0.1, len, 0.1), { at: [sin(a) * (s * 0.42 + len / 2), cos(a) * (s * 0.42 + len / 2), 0], rot: [0, 0, -a], color, to: 'paint' }));
  }
  return place(parts, at, rot);
}

// (a lens on the probe droid's face, `a` round, `e` up)
function parts_lens(list, a, e, glow) {
  const r = 0.44;
  const at = [sin(a) * cos(e) * r, sin(e) * r, cos(a) * cos(e) * r];
  list.push(part(new THREE.SphereGeometry(glow ? 0.055 : 0.07, 10, 8), { at, color: glow ? hot('#ff2a1a', 3) : '#0a0a0c', to: glow ? 'glow' : 'dark' }));
}

export const SCATTER = {
  // a chunk of blue ice, broken off and lying in the snow
  iceblock(k, { seed = 3, color = '#c4daf0' } = {}) {
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    const p = g.attributes.position;
    const r = (i) => noise2(i * 1.7, seed, seed);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const kk = 1 + r(Math.round((x * 7 + y * 13 + z * 19) * 10)) * 0.35;
      p.setXYZ(i, x * kk * 1.2, (y > 0 ? y * 1.1 : y * 0.3) * kk + 0.12, z * kk);
    }
    g.computeVertexNormals();
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' })]), material: iceMat(k) }], radius: 0.5 };
  },
  // a drift of snow: a long low mound you walk through
  snowdrift(k, { color = SNOW } = {}) {
    const g = rockGeometry(7, { sharp: 0.1, detail: 2, flat: 0.25 }).scale(3.2, 1, 1.4);
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' })]), material: snowMat(k), shadow: false }], radius: null };
  },
  // a dark rock with snow on its top
  snowrock(k, { seed = 4, color = '#5e646e', snow = SNOW } = {}) {
    const g = rockGeometry(seed, { sharp: 0.55, detail: 1 });
    const cap = rockGeometry(seed, { sharp: 0.55, detail: 1 }).scale(1.04, 0.45, 1.04).translate(0, 0.24, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' }), part(cap, { color: snow, to: 'stone' })]), material: k.mats.stone }], radius: 0.42 };
  },
  // a pine laden with snow (16 m at scale 1)
  snowpine(k) {
    const parts = pine(16);
    return {
      parts: [
        { geometry: k.geometry(parts.filter((p) => p.to === 'bark')), material: k.mats.bark },
        { geometry: k.geometry(parts.filter((p) => p.to === 'leaf')), material: k.mats.leaf },
      ],
      radius: 0.5,
    };
  },
  // a slab of salt crust, broken and tipped up, red underneath
  saltblock(k, { seed = 5 } = {}) {
    const top = rockGeometry(seed, { sharp: 0.2, detail: 0, flat: 0.25 }).scale(1.6, 1, 1.2);
    const under = rockGeometry(seed, { sharp: 0.2, detail: 0, flat: 0.25 }).scale(1.5, 0.6, 1.1).translate(0, -0.03, 0);
    return { parts: [{ geometry: k.geometry([part(top, { color: SALT, to: 'stone' }), part(under, { color: '#b8483a', to: 'stone' })]), material: k.mats.stone }], radius: 0.6 };
  },
  // a red scar in the salt, where a blast or a skid broke the crust
  redscar(k, { seed = 6 } = {}) {
    const shape = (rr, wob, sd) => {
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * PI * 2;
        const d = rr * (1 + noise2(cos(a) * 1.5, sin(a) * 1.5, sd) * wob);
        pts.push(new THREE.Vector2(cos(a) * d * 1.8, sin(a) * d));
      }
      return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-PI / 2);
    };
    return {
      parts: [{ geometry: k.geometry([part(shape(1.3, 0.5, seed), { at: [0, 0.03, 0], color: '#d4948a', to: 'adobe' }), part(shape(0.8, 0.6, seed + 1), { at: [0, 0.05, 0], color: RED, to: 'adobe' })]), material: k.mats.adobe, shadow: false }],
      radius: null,
    };
  },
  // a few of Crait's crystals poking up through the salt
  crystal(k, { seed = 8 } = {}) {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + seed;
      const h = 0.5 + ((i * 37) % 10) / 10;
      const rr = 0.09 + (i % 3) * 0.04;
      const at = [cos(a) * 0.25 * (i % 3), -0.05, sin(a) * 0.25 * (i % 3)];
      const rot = [sin(a) * 0.5, a, cos(a) * 0.4];
      parts.push(part(new THREE.CylinderGeometry(rr, rr * 1.1, h, 6).translate(0, h / 2, 0), { at, rot, color: i === 2 ? '#e8b4b0' : '#f2ecec' }));
      parts.push(part(new THREE.ConeGeometry(rr, rr * 2.2, 6).translate(0, h + rr * 1.1, 0), { at, rot, color: '#f6f2f2' }));
    }
    return { parts: [{ geometry: k.own(bake(parts, 1)), material: crystalMat(k) }], radius: 0.35 };
  },
};
