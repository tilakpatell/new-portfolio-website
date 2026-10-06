// Albuquerque's traffic for the universe map (see trafficModels.js for how
// a model is put together and what it returns). Walt and Jesse's RV grew
// wings to get up here, and so did everyone after it: every car is the
// car, low and long, with a pair of swept wings at the sills and a jet
// under the boot, nose along +z.
//
// suv: a DEA Suburban, black, a light bar on the roof flashing red and
// blue, an aerial, the badge on the doors.
// suvace: Hank's own, the same with a spotlight on the pillar, lit.
// lowrider: the cartel's, candy red on gold wire wheels, low enough to
// scrape, a gold stripe down each flank, its back end lifted on the
// hydraulics.
// pollostruck: a Los Pollos Hermanos box truck, white, the red-and-yellow
// band round the box and a rocket pod under each side.
// madrigal: a Madrigal Electromotive freighter: a cab and two long blue
// containers on a flatbed, slow and big.
// pestvan: the Vamonos Pest van, yellow, the sign lit on the roof.
// saulcaddy: Saul's white Cadillac, tail fins, the plate glowing.
// mikesedan: Mike's brown sedan, plain as a brick.
// cousins: the Cousins' two silver Mercedes side by side, as one.
// pickup: one of Jack's crew's pickups, rust red, headlights on.

import * as THREE from 'three';
import { part, place, mirror, rod, ball, meshes, blinker, loft, box8, trap8, plateXZ, plateZY, turned, panelTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';

const { PI, sin } = Math;

const RUBBER = '#1d1f22';
const CHROME = '#c9ced4';
const DARKGLASS = '#2a3a4a';
const JET = [1.0, 2.2, 6.0]; // the jets' blue-white

// ── Shared bits ──

// A car's body: a loft down its length of eight-point sections (the sills
// and the bonnet), with the cabin as a narrower loft on top between
// `roofFrom` and `roofTo`, the glass a thin band round it. Everything is in
// a car about `len` long; the wheels sit at the corners.
function body(L, { len = 1, w = 0.4, h = 0.13, roofH = 0.1, roofFrom = -0.2, roofTo = 0.18, roofW = 0.33, color, glass = DARKGLASS, chamfer = 0.02, sill = 0 }) {
  const z = (f) => f * len;
  const y = sill + h / 2;
  L.push(
    part(
      loft([
        { z: z(-0.5), pts: box8(w * 0.9, h * 0.85, chamfer, y) },
        { z: z(-0.46), pts: box8(w, h, chamfer, y) },
        { z: z(0.2), pts: box8(w, h, chamfer, y) },
        { z: z(0.44), pts: box8(w * 0.96, h * 0.8, chamfer, y - h * 0.08) },
        { z: z(0.5), pts: box8(w * 0.8, h * 0.6, chamfer, y - h * 0.18) },
      ]),
      { color },
    ),
  );
  // the cabin: pillars and roof as paint, the glass a band below the roof
  const top = sill + h;
  const gh = roofH * 0.62;
  L.push(
    part(
      loft([
        { z: z(roofFrom), pts: trap8(roofW, roofW * 0.9, gh, 0.004, top + gh / 2) },
        { z: z(roofTo), pts: trap8(roofW, roofW * 0.9, gh, 0.004, top + gh / 2) },
      ]),
      { to: 'glass', color: glass },
    ),
  );
  L.push(
    part(
      loft([
        { z: z(roofFrom - 0.02), pts: box8(roofW * 0.86, 0.004, 0, top + gh) },
        { z: z(roofFrom + 0.01), pts: box8(roofW * 0.9, roofH - gh, 0.006, top + gh + (roofH - gh) / 2) },
        { z: z(roofTo - 0.01), pts: box8(roofW * 0.9, roofH - gh, 0.006, top + gh + (roofH - gh) / 2) },
        { z: z(roofTo + 0.05), pts: box8(roofW * 0.86, 0.004, 0, top + gh) },
      ]),
      { color },
    ),
  );
  // the windscreen and the back glass, leaning
  L.push(part(new THREE.BoxGeometry(roofW * 0.88, Math.hypot(roofH, len * 0.06), 0.006), { at: [0, top + roofH / 2, z(roofTo) + len * 0.03], rot: [-Math.atan2(len * 0.06, roofH), 0, 0], to: 'glass', color: glass }));
  L.push(part(new THREE.BoxGeometry(roofW * 0.88, Math.hypot(roofH, len * 0.04), 0.006), { at: [0, top + roofH / 2, z(roofFrom) - len * 0.02], rot: [Math.atan2(len * 0.04, roofH), 0, 0], to: 'glass', color: glass }));
  // the bumpers
  for (const [zz, s] of [[z(0.5) + 0.004, 0.8], [z(-0.5) - 0.004, 0.9]]) L.push(part(new THREE.BoxGeometry(w * s, h * 0.22, 0.012), { at: [0, sill + h * 0.22, zz], to: 'metal', color: CHROME }));
  return { top, y, z };
}

// four wheels, their rims chrome, at the corners of a car `len` long and `w` wide
function wheels(L, { len = 1, w = 0.4, r = 0.06, sill = 0, rim = CHROME, back = -0.3, front = 0.3 }) {
  for (const sx of [-1, 1]) {
    for (const f of [back, front]) {
      const at = [sx * (w / 2 - 0.01), sill + r * 0.9, f * len];
      L.push(part(new THREE.CylinderGeometry(r, r, 0.05, 14), { at, rot: [0, 0, PI / 2], color: RUBBER }));
      L.push(part(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.052, 10), { at, rot: [0, 0, PI / 2], to: 'metal', color: rim }));
    }
  }
}

// a pair of wings swept back off the sills, mirrored, with a running light at each tip
function wings(L, { len = 1, w = 0.4, span = 0.42, sweep = 0.2, y = 0.05, color, light = [5, 0.6, 0.5] }) {
  const root = w / 2 - 0.01;
  const wing = [];
  wing.push(part(plateXZ([[root, -0.14 * len], [root + span, -0.14 * len - sweep], [root + span, -0.2 * len - sweep], [root, 0.1 * len]], 0.014, 0.004), { at: [0, y, 0], color }));
  wing.push(part(plateZY([[-0.2 * len - sweep, 0], [-0.1 * len - sweep, 0], [-0.17 * len - sweep, 0.09], [-0.2 * len - sweep, 0.09]], 0.008, 0.002), { at: [root + span - 0.004, y, 0], color }));
  wing.push(ball(0.008, [root + span, y + 0.004, -0.17 * len - sweep], 1, { to: 'glow', color: light, mark: 'tips' }, 6));
  L.push(...wing, ...mirror(wing));
}

// a jet under the boot: a can with a glowing mouth and a cone of exhaust
function jet(L, { len = 1, at = [0, 0.05, -0.5], r = 0.035, color = CHROME, n = 1, gap = 0.1 }) {
  for (let i = 0; i < n; i++) {
    const x = at[0] + (i - (n - 1) / 2) * gap;
    const z = at[2] * len;
    L.push(part(turned([[r * 0.6, -0.18], [r, -0.19], [r * 1.05, -0.12], [r, 0.02], [r * 0.7, 0.04]], 12), { at: [x, at[1], z + 0.02], to: 'metal', color }));
    L.push(part(new THREE.CircleGeometry(r * 0.85, 12), { at: [x, at[1], z - 0.165], rot: [0, PI, 0], to: 'glow', color: JET }));
    L.push(part(new THREE.ConeGeometry(r * 0.8, r * 2.4, 10, 1, true), { at: [x, at[1], z - 0.2 - r * 1.2], rot: [-PI / 2, 0, 0], to: 'glow', color: [0.7, 1.7, 5.0] }));
  }
}

// head and tail lights
function lamps(L, { len = 1, w = 0.4, y = 0.07, head = [3.2, 3.0, 2.6], tail = [3.6, 0.4, 0.3] }) {
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.05, 0.02, 0.01), { at: [sx * (w / 2 - 0.05), y, len * 0.5 + 0.002], to: 'glow', color: head, mark: 'head' }));
    L.push(part(new THREE.BoxGeometry(0.05, 0.016, 0.01), { at: [sx * (w / 2 - 0.05), y, -len * 0.5 - 0.002], to: 'glow', color: tail, mark: 'tail' }));
  }
}

// the usual materials: the paint in a panel texture of its own, chrome, glass, lights
function materials(k, { base = 60, spread = 10, seam = 0.5, metalness = 0.35, roughness = 0.42, glass = DARKGLASS } = {}) {
  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base, spread, seam, detail: 0.12, min: 12 })), metalness, roughness }),
    metal: standard(k, { metalness: 0.85, roughness: 0.3 }),
    glass: standard(k, { color: glass, metalness: 0.8, roughness: 0.12 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  return mats;
}

const finish = (k, L, mats, update) => {
  const M = meshes(k, L, mats);
  const blink = M.glow ? blinker(M.glow.geometry) : () => {};
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 3));
      update?.(t, blink);
    },
  };
};

// ── The DEA ──

function suvBody(k, { ace = false }) {
  const BLACK = '#15171a';
  const L = [];
  const b = body(L, { len: 1, w: 0.42, h: 0.15, roofH: 0.13, roofFrom: -0.42, roofTo: 0.2, roofW: 0.38, color: BLACK, chamfer: 0.015 });
  wheels(L, { len: 1, w: 0.42, r: 0.065 });
  wings(L, { len: 1, w: 0.42, span: 0.4, y: b.y, color: BLACK, light: [0.9, 1.6, 6] });
  jet(L, { at: [0, b.y, -0.5], r: 0.04, n: 2, gap: 0.14 });
  lamps(L, { w: 0.42, y: b.y + 0.02 });
  // the light bar on the roof: a base, and the lamps in red and blue, marked to flash in turn
  const roof = b.top + 0.13;
  L.push(part(new THREE.BoxGeometry(0.3, 0.014, 0.05), { at: [0, roof + 0.012, -0.08], color: '#2a2d31' }));
  L.push(part(new THREE.BoxGeometry(0.13, 0.022, 0.04), { at: [-0.075, roof + 0.03, -0.08], to: 'glow', color: [3.6, 0.3, 0.3], mark: 'red' }));
  L.push(part(new THREE.BoxGeometry(0.13, 0.022, 0.04), { at: [0.075, roof + 0.03, -0.08], to: 'glow', color: [0.4, 0.9, 4.2], mark: 'blue' }));
  // the aerial, and the badge on each door (a gold star)
  L.push(rod([0.12, roof, -0.3], [0.14, roof + 0.16, -0.36], 0.003, 0.002, { to: 'metal', color: CHROME }, 4));
  for (const sx of [-1, 1]) L.push(part(new THREE.CircleGeometry(0.022, 5), { at: [sx * 0.212, b.y + 0.01, -0.05], rot: [0, sx * PI / 2, 0], to: 'glow', color: [2.4, 1.9, 0.6] }));
  if (ace) {
    // the spotlight on the driver's pillar, lit, with its beam
    L.push(rod([-0.2, b.top + 0.04, 0.2], [-0.24, b.top + 0.09, 0.2], 0.006, 0.006, { to: 'metal', color: CHROME }, 6));
    L.push(part(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 12), { at: [-0.245, b.top + 0.095, 0.22], rot: [PI / 2, 0, 0], to: 'metal', color: CHROME }));
    L.push(part(new THREE.CircleGeometry(0.02, 12), { at: [-0.245, b.top + 0.095, 0.237], to: 'glow', color: [6, 6, 5.4], mark: 'spot' }));
  }
  const mats = materials(k, { base: 34, spread: 6, seam: 0.6, metalness: 0.5, roughness: 0.3 });
  return finish(k, L, mats, (t, blink) => {
    const p = pulse(t, 0.6, 0, 0.5);
    blink('red', p ? 1.6 : 0.25);
    blink('blue', p ? 0.25 : 1.6);
    blink('tips', pulse(t, 1.4, 0, 0.1) ? 1.4 : 0.3);
    if (ace) blink('spot', 1 + 0.2 * sin(t * 9));
  });
}
const suv = (k) => suvBody(k, { ace: false });
const suvace = (k) => suvBody(k, { ace: true });

// ── The cartel ──

function lowrider(k) {
  const CANDY = '#b8102a';
  const GOLD = '#d9a93c';
  const L = [];
  // low, long, the back end up on the hydraulics (the body leans forward a touch)
  const b = body(L, { len: 1.1, w: 0.4, h: 0.1, roofH: 0.085, roofFrom: -0.16, roofTo: 0.14, roofW: 0.33, color: CANDY, chamfer: 0.012, sill: 0.012 });
  wheels(L, { len: 1.1, w: 0.4, r: 0.05, sill: 0.012, rim: GOLD, back: -0.32, front: 0.32 });
  wings(L, { len: 1.1, w: 0.4, span: 0.36, sweep: 0.26, y: b.y, color: CANDY, light: [5.5, 3.6, 0.6] });
  jet(L, { len: 1.1, at: [0, b.y + 0.01, -0.5], r: 0.03, n: 3, gap: 0.09 });
  lamps(L, { len: 1.1, w: 0.4, y: b.y + 0.01 });
  // the gold stripe down each flank, and the pinstripe on the bonnet
  for (const sx of [-1, 1]) L.push(rod([sx * 0.203, b.y + 0.012, -0.5], [sx * 0.203, b.y + 0.012, 0.48], 0.004, 0.004, { to: 'metal', color: GOLD }, 4));
  L.push(rod([0, b.top + 0.002, 0.2], [0, b.top - 0.008, 0.52], 0.003, 0.003, { to: 'metal', color: GOLD }, 4));
  // the chain-link steering wheel, seen through the glass
  L.push(part(new THREE.TorusGeometry(0.02, 0.004, 4, 10), { at: [-0.08, b.top + 0.04, 0.1], rot: [-0.9, 0, 0], to: 'metal', color: GOLD }));
  const mats = materials(k, { base: 120, spread: 14, seam: 0.4, metalness: 0.6, roughness: 0.22 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 0.9, 0, 0.12) ? 1.5 : 0.3));
}

// ── Los Pollos Hermanos, and Madrigal ──

// a cab-over truck's cab, at the front of a chassis `len` long
function cab(L, { len, w, color, glass = DARKGLASS }) {
  const z0 = len * 0.5;
  L.push(
    part(
      loft([
        { z: z0 - 0.3, pts: box8(w, 0.26, 0.015, 0.2) },
        { z: z0 - 0.04, pts: box8(w, 0.26, 0.015, 0.2) },
        { z: z0, pts: box8(w * 0.96, 0.22, 0.02, 0.19) },
      ]),
      { color },
    ),
  );
  L.push(part(new THREE.BoxGeometry(w * 0.9, 0.1, 0.008), { at: [0, 0.27, z0 + 0.002], to: 'glass', color: glass }));
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.008, 0.08, 0.14), { at: [sx * (w / 2 + 0.002), 0.26, z0 - 0.16], to: 'glass', color: glass }));
  L.push(part(new THREE.BoxGeometry(w * 0.84, 0.04, 0.014), { at: [0, 0.1, z0 + 0.004], to: 'metal', color: CHROME }));
}

function pollostruck(k) {
  const WHITE = '#eceff1';
  const RED = '#c8322b';
  const YELLOW = '#f0c43c';
  const L = [];
  const len = 1.3;
  const w = 0.42;
  // the chassis, the cab and the box
  L.push(part(new THREE.BoxGeometry(w * 0.6, 0.05, len * 0.98), { at: [0, 0.08, 0], color: '#3a3d42' }));
  cab(L, { len, w, color: WHITE });
  L.push(part(loft([{ z: -len * 0.5, pts: box8(w * 1.05, 0.34, 0.012, 0.26) }, { z: len * 0.5 - 0.32, pts: box8(w * 1.05, 0.34, 0.012, 0.26) }]), { color: WHITE }));
  // the band round the box: red over yellow, and the sign on each side
  for (const [c, y, h] of [[RED, 0.3, 0.05], [YELLOW, 0.245, 0.04]]) {
    for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.006, h, len * 0.5 + 0.3), { at: [sx * (w * 0.525 + 0.002), y, -0.16 + 0.0], color: c }));
    L.push(part(new THREE.BoxGeometry(w * 1.05 + 0.004, h, 0.006), { at: [0, y, -len * 0.5 - 0.002], color: c }));
  }
  for (const sx of [-1, 1]) L.push(part(new THREE.CircleGeometry(0.07, 16), { at: [sx * (w * 0.525 + 0.006), 0.38, -0.16], rot: [0, sx * PI / 2, 0], to: 'glow', color: [3.2, 2.4, 0.5] }));
  wheels(L, { len, w, r: 0.07, back: -0.3, front: 0.36 });
  wheels(L, { len, w, r: 0.07, back: -0.42, front: -0.42 });
  wings(L, { len, w: w * 1.05, span: 0.4, sweep: 0.22, y: 0.12, color: WHITE, light: [5.5, 1.2, 0.6] });
  // the rocket pods under each side
  for (const sx of [-1, 1]) {
    L.push(part(turned([[0.03, -0.3], [0.045, -0.28], [0.045, 0.1], [0.02, 0.16]], 12), { at: [sx * 0.28, 0.1, -0.1], to: 'metal', color: '#60666e' }));
    L.push(part(new THREE.CircleGeometry(0.03, 12), { at: [sx * 0.28, 0.1, -0.402], rot: [0, PI, 0], to: 'glow', color: [5, 1.4, 0.6] }));
  }
  jet(L, { len, at: [0, 0.14, -0.5], r: 0.05, n: 2, gap: 0.16 });
  lamps(L, { len, w, y: 0.16, tail: [3.6, 0.4, 0.3] });
  const mats = materials(k, { base: 228, spread: 6, seam: 0.6, metalness: 0.2, roughness: 0.45 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 1.6, 0, 0.1) ? 1.4 : 0.3));
}

function madrigal(k) {
  const BLUE = '#1f4e8c';
  const STEEL = '#8d949c';
  const L = [];
  const len = 1.6;
  const w = 0.44;
  L.push(part(new THREE.BoxGeometry(w * 0.7, 0.05, len * 0.98), { at: [0, 0.08, 0], color: '#3a3d42' }));
  cab(L, { len, w, color: STEEL });
  // two containers, a gap between, the company's mark a pale band
  for (const z of [-0.08, -0.5]) {
    L.push(part(loft([{ z: z - 0.2 * len, pts: box8(w * 1.05, 0.32, 0.01, 0.26) }, { z: z + 0.18 * len, pts: box8(w * 1.05, 0.32, 0.01, 0.26) }]), { color: BLUE }));
    for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.006, 0.06, 0.2), { at: [sx * (w * 0.525 + 0.002), 0.3, z], color: '#cfd8e3' }));
  }
  wheels(L, { len, w, r: 0.07, back: -0.44, front: 0.36 });
  wheels(L, { len, w, r: 0.07, back: -0.1, front: -0.26 });
  wings(L, { len, w: w * 1.05, span: 0.44, sweep: 0.24, y: 0.12, color: STEEL, light: [0.8, 2.4, 5.5] });
  jet(L, { len, at: [0, 0.15, -0.5], r: 0.055, n: 3, gap: 0.15 });
  lamps(L, { len, w, y: 0.16 });
  const mats = materials(k, { base: 90, spread: 10, seam: 0.5, metalness: 0.3, roughness: 0.5 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 2, 0, 0.08) ? 1.4 : 0.3));
}

function pestvan(k) {
  const YELLOW = '#e9c22c';
  const GREEN = '#2f8f4e';
  const L = [];
  const b = body(L, { len: 1, w: 0.4, h: 0.16, roofH: 0.16, roofFrom: -0.47, roofTo: 0.26, roofW: 0.38, color: YELLOW, chamfer: 0.015 });
  wheels(L, { len: 1, w: 0.4, r: 0.06 });
  wings(L, { len: 1, w: 0.4, span: 0.36, y: b.y, color: YELLOW, light: [2.4, 5.5, 1.2] });
  jet(L, { at: [0, b.y, -0.5], r: 0.04, n: 1 });
  lamps(L, { w: 0.4, y: b.y + 0.02 });
  // the sign on the roof, lit, with a green bug on it; the stripe along each side
  const roof = b.top + 0.16;
  L.push(part(new THREE.BoxGeometry(0.26, 0.09, 0.03), { at: [0, roof + 0.05, -0.1], to: 'glow', color: [3.2, 2.6, 0.5], mark: 'sign' }));
  L.push(ball(0.028, [0, roof + 0.05, -0.08], [1, 0.7, 0.4], { color: GREEN }, 8));
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.006, 0.03, 0.8), { at: [sx * 0.203, b.y + 0.02, -0.05], color: GREEN }));
  const mats = materials(k, { base: 200, spread: 10, seam: 0.5, metalness: 0.2, roughness: 0.5 });
  return finish(k, L, mats, (t, blink) => {
    blink('sign', 1 + 0.15 * sin(t * 2));
    blink('tips', pulse(t, 1.4, 0, 0.1) ? 1.4 : 0.3);
  });
}

// ── The friends ──

function saulcaddy(k) {
  const WHITE = '#f3f1ea';
  const L = [];
  const b = body(L, { len: 1.15, w: 0.42, h: 0.1, roofH: 0.09, roofFrom: -0.14, roofTo: 0.16, roofW: 0.34, color: WHITE, chamfer: 0.012 });
  wheels(L, { len: 1.15, w: 0.42, r: 0.052, back: -0.33, front: 0.33 });
  wings(L, { len: 1.15, w: 0.42, span: 0.4, sweep: 0.22, y: b.y, color: WHITE, light: [5.5, 5.0, 1.2] });
  jet(L, { len: 1.15, at: [0, b.y, -0.5], r: 0.032, n: 2, gap: 0.14 });
  lamps(L, { len: 1.15, w: 0.42, y: b.y + 0.01 });
  // the tail fins, and the plate, lit
  for (const sx of [-1, 1]) L.push(part(plateZY([[-0.58, 0], [-0.36, 0], [-0.5, 0.06], [-0.58, 0.07]], 0.01, 0.002), { at: [sx * 0.19, b.top, 0], color: WHITE }));
  L.push(part(new THREE.BoxGeometry(0.12, 0.03, 0.006), { at: [0, b.y, -0.58], to: 'glow', color: [3, 2.6, 1.2], mark: 'plate' }));
  // the chrome down each side
  for (const sx of [-1, 1]) L.push(rod([sx * 0.213, b.y, -0.55], [sx * 0.213, b.y, 0.55], 0.004, 0.004, { to: 'metal', color: CHROME }, 4));
  const mats = materials(k, { base: 236, spread: 5, seam: 0.5, metalness: 0.3, roughness: 0.35 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 1.2, 0, 0.1) ? 1.4 : 0.3));
}

function mikesedan(k) {
  const BROWN = '#6b5340';
  const L = [];
  const b = body(L, { len: 1, w: 0.4, h: 0.11, roofH: 0.09, roofFrom: -0.16, roofTo: 0.14, roofW: 0.33, color: BROWN, chamfer: 0.012 });
  wheels(L, { len: 1, w: 0.4, r: 0.055, rim: '#8a8d90' });
  wings(L, { len: 1, w: 0.4, span: 0.36, y: b.y, color: BROWN, light: [4.5, 3.6, 2.2] });
  jet(L, { at: [0, b.y, -0.5], r: 0.034, n: 1 });
  lamps(L, { w: 0.4, y: b.y + 0.01 });
  const mats = materials(k, { base: 110, spread: 8, seam: 0.5, metalness: 0.25, roughness: 0.6 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 2, 0, 0.08) ? 1.3 : 0.3));
}

// ── The Cousins, and Jack's crew ──

function cousins(k) {
  const SILVER = '#c6c9cc';
  const one = [];
  const b = body(one, { len: 1.05, w: 0.38, h: 0.1, roofH: 0.085, roofFrom: -0.14, roofTo: 0.15, roofW: 0.31, color: SILVER, chamfer: 0.012 });
  wheels(one, { len: 1.05, w: 0.38, r: 0.052, back: -0.32, front: 0.32 });
  jet(one, { len: 1.05, at: [0, b.y, -0.5], r: 0.03, n: 2, gap: 0.12 });
  lamps(one, { len: 1.05, w: 0.38, y: b.y + 0.01, head: [4, 4, 4] });
  // the star on the bonnet
  one.push(part(new THREE.TorusGeometry(0.012, 0.003, 4, 10), { at: [0, b.top + 0.004, 0.44], rot: [PI / 2, 0, 0], to: 'metal', color: CHROME }));
  // two of them, side by side, a wing between them and one out at each side
  const L = [...place(one, [-0.25, 0, 0]), ...place(one, [0.25, 0, 0.05])];
  L.push(part(plateXZ([[-0.07, -0.12], [0.07, -0.12], [0.07, 0.05], [-0.07, 0.05]], 0.012, 0.003), { at: [0, b.y, 0], color: SILVER }));
  wings(L, { len: 1.05, w: 0.88, span: 0.3, sweep: 0.2, y: b.y, color: SILVER, light: [5, 5, 5] });
  const mats = materials(k, { base: 196, spread: 6, seam: 0.5, metalness: 0.6, roughness: 0.25 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 1.4, 0, 0.1) ? 1.4 : 0.3));
}

function pickup(k) {
  const RUST = '#8c3d2a';
  const L = [];
  const b = body(L, { len: 1.1, w: 0.4, h: 0.13, roofH: 0.11, roofFrom: -0.04, roofTo: 0.2, roofW: 0.36, color: RUST, chamfer: 0.015 });
  // the open bed behind the cab: sides and a tailgate, a roll bar
  L.push(part(new THREE.BoxGeometry(0.36, 0.05, 0.4), { at: [0, b.top - 0.035, -0.3], color: '#4a2a20' }));
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.02, 0.07, 0.44), { at: [sx * 0.19, b.top + 0.025, -0.3], color: RUST }));
  L.push(part(new THREE.BoxGeometry(0.4, 0.07, 0.02), { at: [0, b.top + 0.025, -0.53], color: RUST }));
  L.push(rod([-0.16, b.top, -0.1], [-0.16, b.top + 0.12, -0.12], 0.006, 0.006, { to: 'metal', color: '#3a3d42' }, 6));
  L.push(rod([0.16, b.top, -0.1], [0.16, b.top + 0.12, -0.12], 0.006, 0.006, { to: 'metal', color: '#3a3d42' }, 6));
  L.push(rod([-0.16, b.top + 0.12, -0.12], [0.16, b.top + 0.12, -0.12], 0.006, 0.006, { to: 'metal', color: '#3a3d42' }, 6));
  // a row of lamps on the roll bar, lit
  for (const x of [-0.08, 0, 0.08]) L.push(part(new THREE.CircleGeometry(0.014, 10), { at: [x, b.top + 0.12, -0.112], to: 'glow', color: [4, 3.6, 2.4], mark: 'head' }));
  wheels(L, { len: 1.1, w: 0.4, r: 0.065, rim: '#4a4d50' });
  wings(L, { len: 1.1, w: 0.4, span: 0.36, sweep: 0.18, y: b.y, color: RUST, light: [5.5, 2.5, 0.6] });
  jet(L, { len: 1.1, at: [0, b.y, -0.5], r: 0.036, n: 1 });
  lamps(L, { len: 1.1, w: 0.4, y: b.y + 0.02 });
  const mats = materials(k, { base: 96, spread: 16, seam: 0.4, metalness: 0.2, roughness: 0.7 });
  return finish(k, L, mats, (t, blink) => blink('tips', pulse(t, 1.1, 0, 0.1) ? 1.4 : 0.3));
}

export const FLEET = { suv, suvace, lowrider, pollostruck, madrigal, pestvan, saulcaddy, mikesedan, cousins, pickup };
