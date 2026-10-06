// Albuquerque's traffic for the universe map (see trafficModels.js for how
// a model is put together and what it returns). Walt and Jesse's RV grew
// wings to get up here, and so did everyone after it: every car is the
// car, low and long, with a pair of swept wings at the sills and a jet
// under the boot, nose along +z. (What flew already, a balloon and a
// helicopter, came up as it was.)
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
// gusvolvo: Gus Fring's silver Volvo, a boxy 240 of a saloon and spotless:
// square headlamps, the grille with its diagonal bar, black bumpers,
// rubbing strips and mudflaps; neat wings, one neat jet, its lights steady.
// Nothing about it draws the eye, which is the point.
// beater: Badger and Skinny Pete's car, winged like the rest but a wreck:
// a door off another car, primer on the bonnet, the roof and a back wing,
// the front corner stoved in with its headlamp gone and the bumper hanging
// off it, the windscreen cracked, a black steel spare, a coat-hanger
// aerial, one wing a scrapyard spare sagging on its root, and the jet
// strapped on crooked, shaking and sputtering.
// balloon: a hot-air balloon up from the Balloon Fiesta, drifting high over
// the map and turning slowly: a tall teardrop of an envelope in bold gores
// of red, yellow, blue and orange, a wicker basket hung under it on cables
// and the burner between, its pilot flickering and now and then roaring
// into a flare that lights the envelope's mouth. No wings: it's a balloon.
// deachopper: a DEA helicopter over the roadblock, dark blue-black with a
// white band sweeping back along its boom and the letters on its flanks,
// the main and tail rotors turning, on skids, its searchlight under the
// nose throwing a long faint beam ahead and down and sweeping it from side
// to side. No wings either: it has a rotor.

import * as THREE from 'three';
import { part, place, mirror, rod, between, ball, meshes, blinker, loft, box8, trap8, plateXZ, plateZY, turned, upright, canvasTexture, grey, panelTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';

const { PI, sin, cos, abs, sign, atan2 } = Math;

const RUBBER = '#1d1f22';
const CHROME = '#c9ced4';
const DARKGLASS = '#2a3a4a';
const JET = [1.0, 2.2, 6.0]; // the jets' blue-white

// ── Shared bits ──

// A car's body: a loft down its length of eight-point sections (the sills
// and the bonnet), with the cabin as a narrower loft on top between
// `roofFrom` and `roofTo`: the glass a band round it, raked down at both
// ends into the windscreen and the back window, the roof over it. Everything
// is in a car about `len` long; the wheels sit at the corners.
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
  // the cabin: the glass all the way round, its raked ends the windscreen
  // and the back window, the roof on top carrying their rake on up; the
  // pillars framing the windscreen and the back window, and between the
  // side windows one for each row of seats past the first
  const top = sill + h;
  const gh = roofH * 0.62;
  const ahead = len * 0.06; // the windscreen's foot, ahead of the roof
  const behind = len * 0.04; // the back window's, behind it
  const rake = (roofH - gh) / gh;
  const foot = (zz) => ({ z: zz, pts: trap8(roofW * 0.98, roofW * 0.97, 0.002, 0, top + 0.001) });
  const pane = (zz) => ({ z: zz, pts: trap8(roofW, roofW * 0.9, gh, 0.004, top + gh / 2) });
  L.push(part(loft([foot(z(roofFrom) - behind), pane(z(roofFrom)), pane(z(roofTo)), foot(z(roofTo) + ahead)]), { to: 'glass', color: glass }));
  const lid = (zz, hh) => ({ z: zz, pts: box8(roofW * 0.9, hh, hh > 0.01 ? 0.006 : 0, top + gh + hh / 2) });
  L.push(part(loft([lid(z(roofFrom), 0.003), lid(z(roofFrom) + behind * rake, roofH - gh), lid(z(roofTo) - ahead * rake, roofH - gh), lid(z(roofTo), 0.003)]), { color }));
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [
      [z(roofTo), z(roofTo) + ahead],
      [z(roofFrom), z(roofFrom) - behind],
    ]) {
      L.push(rod([sx * roofW * 0.45, top + gh, z0], [sx * roofW * 0.488, top + 0.002, z1], 0.0045, 0.0045, { color }, 4));
    }
    const rows = Math.floor((roofTo - roofFrom) / 0.25);
    for (let i = 1; i <= rows; i++) {
      const at = [sx * (roofW * 0.475 + 0.0015), top + gh / 2, z(roofTo + ((roofFrom - roofTo) * i) / (rows + 1))];
      L.push(part(new THREE.BoxGeometry(0.004, gh * 0.98, 0.022), { at, rot: [0, 0, sx * Math.atan2(roofW * 0.05, gh)], color }));
    }
  }
  // the bumpers
  for (const [zz, s] of [[z(0.5) + 0.004, 0.8], [z(-0.5) - 0.004, 0.9]]) L.push(part(new THREE.BoxGeometry(w * s, h * 0.22, 0.012), { at: [0, sill + h * 0.22, zz], to: 'metal', color: CHROME }));
  // (and where the windscreen is, for what's laid on it: its middle, how far it leans back, how tall it is)
  return { top, y, z, screen: { at: [0, top + gh / 2, z(roofTo) + ahead / 2], lean: Math.atan2(ahead, gh), tall: Math.hypot(ahead, gh) } };
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

// a pair of wings swept back off the sills, mirrored: each a trapezoid,
// the root chord along the sill and a short tip chord well aft, a fin
// standing on the tip chord, raked back, with a running light on top
function wings(L, { len = 1, w = 0.4, span = 0.42, sweep = 0.2, y = 0.05, color, light = [5, 0.6, 0.5] }) {
  const root = w / 2 - 0.01;
  const aft = (f) => f * len - sweep;
  const wing = [];
  wing.push(part(plateXZ([[root, -0.14 * len], [root + span, aft(-0.2)], [root + span, aft(-0.12)], [root, 0.1 * len]], 0.014, 0.004), { at: [0, y, 0], color }));
  wing.push(part(plateZY([[aft(-0.2), 0], [aft(-0.12), 0], [aft(-0.175), 0.09], [aft(-0.215), 0.09]], 0.008, 0.002), { at: [root + span - 0.004, y, 0], color }));
  wing.push(ball(0.008, [root + span - 0.004, y + 0.094, aft(-0.195)], 1, { to: 'glow', color: light, mark: 'tips' }, 6));
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
    L.push(rod([-0.178, b.top + 0.04, 0.23], [-0.225, b.top + 0.09, 0.23], 0.006, 0.006, { to: 'metal', color: CHROME }, 6));
    L.push(part(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 12), { at: [-0.23, b.top + 0.095, 0.25], rot: [PI / 2, 0, 0], to: 'metal', color: CHROME }));
    L.push(part(new THREE.CircleGeometry(0.02, 12), { at: [-0.23, b.top + 0.095, 0.267], to: 'glow', color: [6, 6, 5.4], mark: 'spot' }));
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

// ── Gus ──

function gusvolvo(k) {
  const SILVER = '#bcc1c6';
  const TRIM = '#222427';
  const len = 1.05;
  const w = 0.4;
  const h = 0.12;
  const L = [];
  const b = body(L, { len, w, h, roofH: 0.11, roofFrom: -0.22, roofTo: 0.12, roofW: 0.35, color: SILVER, chamfer: 0.006, glass: '#8ea4ba' });
  // square at both ends, as a 240 is: its own loft in place of body()'s
  // rounded one (the first part body() makes), and black bumpers standing
  // proud of both ends in place of its chrome ones (the last two)
  L[0].g.dispose();
  L[0] = part(
    loft([
      { z: -0.5 * len, pts: box8(w * 0.97, h * 0.9, 0.008, b.y) },
      { z: -0.485 * len, pts: box8(w, h, 0.008, b.y) },
      { z: 0.475 * len, pts: box8(w, h, 0.008, b.y) },
      { z: 0.5 * len, pts: box8(w * 0.97, h * 0.88, 0.008, b.y - h * 0.03) },
    ]),
    { color: SILVER },
  );
  for (const p of L.splice(-2)) p.g.dispose();
  for (const s of [1, -1]) {
    L.push(part(new THREE.BoxGeometry(w + 0.012, 0.032, 0.026), { at: [0, 0.022, s * (0.5 * len + 0.012)], to: 'trim', color: TRIM }));
    for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.014, 0.032, 0.06), { at: [sx * (w / 2 + 0.001), 0.022, s * (0.5 * len - 0.02)], to: 'trim', color: TRIM }));
  }
  // the square headlamps in chrome surrounds, the indicators round the
  // corners, and the grille between with its diagonal bar and badge
  const zf = 0.5 * len;
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.086, 0.044, 0.006), { at: [sx * 0.132, 0.074, zf], to: 'metal', color: CHROME }));
    L.push(part(new THREE.BoxGeometry(0.074, 0.032, 0.008), { at: [sx * 0.132, 0.074, zf], to: 'glow', color: [3.3, 3.4, 3.8], mark: 'head' }));
    L.push(part(new THREE.BoxGeometry(0.018, 0.032, 0.03), { at: [sx * 0.193, 0.074, zf - 0.012], to: 'glow', color: [3, 1.4, 0.3] }));
  }
  L.push(part(new THREE.BoxGeometry(0.15, 0.038, 0.006), { at: [0, 0.074, zf], to: 'metal', color: CHROME }));
  L.push(part(new THREE.BoxGeometry(0.14, 0.028, 0.008), { at: [0, 0.074, zf], to: 'trim', color: '#151618' }));
  L.push(part(new THREE.BoxGeometry(Math.hypot(0.14, 0.028), 0.005, 0.01), { at: [0, 0.074, zf], rot: [0, 0, -atan2(0.028, 0.14)], to: 'metal', color: CHROME }));
  L.push(part(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12), { at: [0, 0.074, zf], rot: [PI / 2, 0, 0], to: 'metal', color: CHROME }));
  // tall tail lamps at the back corners, red under amber
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.052, 0.042, 0.008), { at: [sx * 0.163, 0.068, -zf], to: 'glow', color: [3.6, 0.35, 0.3], mark: 'tail' }));
    L.push(part(new THREE.BoxGeometry(0.052, 0.016, 0.008), { at: [sx * 0.163, 0.099, -zf], to: 'glow', color: [3, 1.4, 0.3] }));
  }
  // a rubbing strip down each flank, above the wing, and the mudflaps
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.005, 0.012, 0.42), { at: [sx * (w / 2 + 0.0015), 0.09, 0], to: 'trim', color: TRIM }));
    for (const f of [-0.3, 0.3]) L.push(part(new THREE.BoxGeometry(0.036, 0.04, 0.004), { at: [sx * (w / 2 - 0.012), 0.024, f * len - 0.066], to: 'trim', color: TRIM }));
  }
  wheels(L, { len, w, r: 0.055, rim: '#d5d9dd' });
  wings(L, { len, w, span: 0.38, sweep: 0.2, y: b.y, color: SILVER, light: [4.6, 4.6, 5] });
  jet(L, { len, at: [0, 0.074, -0.5], r: 0.034, n: 1 });
  const mats = { ...materials(k, { base: 214, spread: 4, seam: 0.62, metalness: 0.55, roughness: 0.28, glass: '#3d566f' }), trim: standard(k, { metalness: 0.1, roughness: 0.7 }) };
  // (its lights burn steady: nothing blinks)
  return finish(k, L, mats);
}

// ── Badger and Skinny Pete ──

// A knock in a panel: every vertex of g within r of `at` moved by `by`,
// the most at the middle (a loft's flat faces crumple as their corners go).
function dent(g, at, r, by) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = Math.max(0, 1 - Math.hypot(p.getX(i) - at[0], p.getY(i) - at[1], p.getZ(i) - at[2]) / r);
    if (f > 0) p.setXYZ(i, p.getX(i) + by[0] * f, p.getY(i) + by[1] * f, p.getZ(i) + by[2] * f);
  }
  g.computeVertexNormals();
}

function beater(k) {
  const TEAL = '#5b8379';
  const DOOR = '#c8b88a';
  const PRIMER = '#8a8e90';
  const RUST = '#6b3a22';
  const len = 1;
  const w = 0.4;
  const h = 0.12;
  const roofH = 0.095;
  const roofTo = 0.14;
  const L = [];
  const b = body(L, { len, w, h, roofH, roofFrom: -0.17, roofTo, roofW: 0.33, color: TEAL, chamfer: 0.012, glass: '#34433e' });
  // the front corner on the right stoved in (body()'s first part is its
  // loft), and the front bumper (its last but one) hanging off by its left end
  dent(L[0].g, [-0.18, b.top, 0.5 * len], 0.13, [0.03, -0.018, -0.028]);
  const tilt = [0, 0.16, 0.17];
  const end = new THREE.Vector3(w * 0.4, 0, 0).applyEuler(new THREE.Euler(...tilt));
  Object.assign(L.at(-2), { at: [w * 0.4 - end.x, h * 0.22 - end.y, 0.5 * len + 0.004 - end.z], rot: tilt });
  // a door off another car, primer where the rust was ground back (on the
  // bonnet, following its slope, the roof and a back wing), and rust
  // coming through low down
  L.push(part(new THREE.BoxGeometry(0.004, h * 0.72, 0.17), { at: [w / 2 + 0.0022, b.y, 0.06], color: DOOR }));
  const slope = atan2(0.18 * h, 0.24 * len);
  L.push(part(new THREE.BoxGeometry(0.15, 0.003, 0.15 * len), { at: [0.035, b.top - 0.09 * h + 0.0012, 0.32 * len], rot: [slope, 0, 0], to: 'matte', color: PRIMER }));
  L.push(part(new THREE.BoxGeometry(0.12, 0.003, 0.11), { at: [-0.04, b.top + roofH + 0.0012, -0.06], to: 'matte', color: PRIMER }));
  L.push(part(new THREE.BoxGeometry(0.003, h * 0.5, 0.085), { at: [-(w / 2 + 0.0015), b.y - 0.012, -0.4125 * len], to: 'matte', color: PRIMER }));
  for (const [sx, z, d] of [
    [1, -0.19, 0.07],
    [1, 0.2, 0.045],
    [-1, -0.2, 0.06],
    [-1, 0.16, 0.09],
  ]) {
    L.push(part(new THREE.BoxGeometry(0.003, 0.016, d), { at: [sx * (w / 2 + 0.0015), 0.02, z * len], to: 'matte', color: RUST }));
    L.push(part(new THREE.BoxGeometry(0.0034, 0.01, d * 0.45), { at: [sx * (w / 2 + 0.0023), 0.031, z * len + d * 0.12], to: 'matte', color: '#5a3322' }));
  }
  // the windscreen cracked from a stone on the passenger's side, the cracks
  // laid on its face (u across it, v up it as it leans back)
  const { at: mid0, lean } = b.screen;
  const up = new THREE.Vector3(0, cos(lean), -sin(lean));
  const out = new THREE.Vector3(0, sin(lean), cos(lean));
  const on = (u, v) => new THREE.Vector3(u, mid0[1], mid0[2]).addScaledVector(up, v).addScaledVector(out, 0.002).toArray();
  const hit = [-0.06, -0.005];
  for (const [a, l, kink] of [
    [0.25, 0.08, 0.2],
    [1.2, 0.034, -0.3],
    [2.4, 0.05, 0.25],
    [3.3, 0.07, -0.15],
    [4.5, 0.03, 0],
    [5.5, 0.05, 0.3],
  ]) {
    const mid = [hit[0] + cos(a) * l * 0.5, hit[1] + sin(a) * l * 0.5];
    const tip = [mid[0] + cos(a + kink) * l * 0.5, mid[1] + sin(a + kink) * l * 0.5];
    L.push(rod(on(...hit), on(...mid), 0.0011, 0.0011, { to: 'matte', color: '#d4dadc' }, 3), rod(on(...mid), on(...tip), 0.0011, 0.0011, { to: 'matte', color: '#d4dadc' }, 3));
  }
  // a coat hanger for an aerial
  L.push(rod([0.16, b.top - 0.008, 0.26], [0.165, b.top + 0.09, 0.25], 0.0018, 0.0018, { to: 'metal', color: '#9a9ea2' }, 4));
  L.push(rod([0.165, b.top + 0.09, 0.25], [0.19, b.top + 0.11, 0.2], 0.0018, 0.0018, { to: 'metal', color: '#9a9ea2' }, 4));
  // a black steel spare on the front right (wheels() goes right side
  // first, back then front, tyre then rim)
  const wh = L.length;
  wheels(L, { len, w, r: 0.055, rim: '#8a8d90' });
  L[wh + 3].color = '#2e3033';
  // the lamps, less the right headlamp (lamps()'s first), which went with the corner
  const li = L.length;
  lamps(L, { len, w, y: b.y + 0.01 });
  L.splice(li, 1)[0].g.dispose();
  // the wings: the right one (wings()'s last three parts) a scrapyard
  // spare in primer, sagging on its root, its light gone
  const wi = L.length;
  wings(L, { len, w, span: 0.36, sweep: 0.2, y: b.y, color: TEAL, light: [5, 2.4, 0.6] });
  const right = L.splice(wi + 3, 3);
  for (const p of right.slice(0, 2)) Object.assign(p, { to: 'matte', color: PRIMER });
  right[2].color = [0.3, 0.08, 0.06];
  delete right[2].mark;
  const hinge = w / 2 - 0.01;
  L.push(...place(place(right, [hinge, -b.y, 0]), [-hinge, b.y, 0], [0, 0, 0.09]));
  // the jet, strapped on crooked with tape: a group of its own so it can
  // shake on its mounting, with a glow of its own so it can cough while
  // the rest stays lit
  const can = [];
  jet(can, { at: [0, 0, 0], r: 0.034 });
  can.push(part(turned([[0.0372, -0.07], [0.0372, -0.045]], 12), { to: 'matte', color: '#9b9d96' }));
  const mats = { ...materials(k, { base: 200, spread: 12, seam: 0.55, metalness: 0.12, roughness: 0.78, glass: '#34433e' }), matte: standard(k, { metalness: 0, roughness: 0.95 }) };
  const sputter = glowMaterial(k);
  const shake = new THREE.Group();
  shake.position.set(0.035, b.y - 0.004, -0.5 * len + 0.03);
  shake.add(...Object.values(meshes(k, can, { metal: mats.metal, matte: mats.matte, glow: sputter })));
  const made = finish(k, L, mats, (t, blink) => {
    const cough = sin(t * 1.9) + sin(t * 4.7 + 1) > 1.7;
    sputter.color.setScalar(cough ? 0.12 : Math.round(flicker(t * 3, 7) ** 4 * 10) / 10);
    shake.rotation.set(0.07 + 0.03 * sin(t * 23), 0.1 + 0.025 * sin(t * 17 + 1), 0);
    blink('tips', pulse(t, 1.3, 0, 0.1) || pulse(t, 1.3, 0.17, 0.05) ? 1.3 : 0.3);
  });
  made.root.push(shake);
  return made;
}

// ── The Balloon Fiesta ──

// One gore of a balloon's envelope, from angle a0 to a0 + da about y: the
// profile [[r, y], …] (mouth to crown) swept across it, bellying out
// between its seams (most at the equator), its uv running across the gore
// (u) and up it (v).
function gore(prof, a0, da, belly) {
  const pos = [];
  const uv = [];
  const index = [];
  const last = prof.length - 1;
  prof.forEach(([r, y], i) => {
    for (let j = 0; j <= 2; j++) {
      const a = a0 + (da * j) / 2;
      const rr = r * (1 + belly * sin((PI * i) / last) * sin((PI * j) / 2));
      pos.push(rr * sin(a), y, rr * cos(a));
      uv.push(j / 2, i / last);
    }
  });
  for (let i = 0; i < last; i++) {
    for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Envelope fabric: grey (the gores' colours show through), a seam across
// every panel and a load tape down one edge of each gore.
function fabricTexture() {
  return canvasTexture(128, (g, S) => {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = grey(i % 2 ? 238 : 231);
      g.fillRect(0, (i * S) / 16, S, S / 16);
      g.fillStyle = grey(206);
      g.fillRect(0, (i * S) / 16, S, 1);
    }
    g.fillStyle = grey(140);
    g.fillRect(0, 0, 3, S);
  });
}

// Wicker: cane woven over and under upright stakes, grey (the cane's
// colour shows through).
function wickerTexture() {
  return canvasTexture(64, (g, S) => {
    g.fillStyle = grey(96);
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) {
      for (let x = 0; x < S; x += 8) {
        const over = ((x + y) / 8) % 2 === 0;
        g.fillStyle = grey(over ? 232 : 170);
        if (over) g.fillRect(x, y + 1, 8, 6);
        else g.fillRect(x + 2, y, 4, 8);
      }
    }
  });
}

function balloon(k) {
  const GORES = ['#d8262c', '#f4c12a', '#2358b8', '#f0731d'];
  const SCOOP = '#2b2a2e';
  const CANE = '#c39a5c';
  const LEATHER = '#5a3a22';
  const N = 16;
  const R = 0.5;
  const EQ = 0.66;
  const MOUTH = 0.1;
  // the envelope's profile, mouth to crown: flaring out to the equator,
  // rounded over above it
  const dome = (i) => [R * cos((i / 8) * (PI / 2)), EQ + R * 0.98 * sin((i / 8) * (PI / 2))];
  const prof = [0, 0.06, 0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88, 1].map((s) => [MOUTH + (R - MOUTH) * (1 - (1 - s) ** 1.8), EQ * s]);
  for (let i = 1; i <= 7; i++) prof.push(dome(i));
  const L = [];
  // the gores, the dark scoop round the mouth and the crown over the top
  const da = (PI * 2) / N;
  for (let i = 0; i < N; i++) {
    L.push(part(gore(prof.slice(1), i * da, da, 0.035), { to: 'fabric', color: GORES[i % 4], uv: 'keep' }));
    L.push(part(gore(prof.slice(0, 2), i * da, da, 0), { to: 'fabric', color: SCOOP, uv: 'keep' }));
  }
  L.push(part(upright([dome(7), dome(7.5), dome(8)], N * 2), { to: 'fabric', color: GORES[1], uv: () => [0.5, 0.53] }));
  // the inside of the envelope, lit by the burner, seen up through its mouth
  L.push(part(new THREE.CircleGeometry(0.14, 20), { at: [0, 0.045, 0], rot: [PI / 2, 0, 0], to: 'fire', color: [1.3, 0.42, 0.08], uv: () => [0.5, 0.05] }));

  // the basket: wicker walls and floor, a padded leather rim, the fuel
  // tanks standing inside
  const B = 0.062;
  const top = -0.31;
  const floor = -0.4;
  L.push(part(new THREE.BoxGeometry(2 * B - 0.004, 0.006, 2 * B - 0.004), { at: [0, floor + 0.004, 0], to: 'wicker', color: CANE }));
  for (const s of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(2 * B, top - floor, 0.008), { at: [0, (top + floor) / 2, s * (B - 0.004)], to: 'wicker', color: CANE }));
    L.push(part(new THREE.BoxGeometry(0.008, top - floor, 2 * B - 0.016), { at: [s * (B - 0.004), (top + floor) / 2, 0], to: 'wicker', color: CANE }));
    L.push(part(new THREE.BoxGeometry(2 * B + 0.008, 0.012, 0.014), { at: [0, top, s * (B - 0.003)], color: LEATHER }));
    L.push(part(new THREE.BoxGeometry(0.014, 0.012, 2 * B - 0.028), { at: [s * (B - 0.003), top, 0], color: LEATHER }));
  }
  for (const [x, z] of [
    [0.03, 0.03],
    [-0.03, 0.03],
    [0.03, -0.03],
  ]) {
    L.push(part(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 10), { at: [x, floor + 0.042, z], to: 'metal', color: '#b4b9bf' }));
  }
  // the burner frame on its four sleeved poles over the basket, the twin
  // burners on a bar across it, and the flying wires up to the mouth, two
  // from each corner, each to a seam
  const frame = -0.2;
  const c = 0.05;
  const corners = [
    [c, c],
    [-c, c],
    [-c, -c],
    [c, -c],
  ];
  corners.forEach(([x, z], i) => {
    const [x2, z2] = corners[(i + 1) % 4];
    L.push(rod([x * 1.08, top, z * 1.08], [x, frame, z], 0.0045, 0.0045, { color: '#7a5634' }, 6));
    L.push(rod([x, frame, z], [x2, frame, z2], 0.0035, 0.0035, { to: 'metal', color: '#6d737a' }, 6));
    const a = atan2(x, z);
    for (const s of [-1, 1]) L.push(rod([x, frame, z], [MOUTH * sin(a + s * da), 0.002, MOUTH * cos(a + s * da)], 0.0012, 0.0012, { to: 'metal', color: '#3a3c40' }, 4));
  });
  L.push(rod([-c, frame, 0], [c, frame, 0], 0.003, 0.003, { to: 'metal', color: '#6d737a' }, 6));
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.CylinderGeometry(0.017, 0.013, 0.03, 10), { at: [sx * 0.019, frame + 0.012, 0], to: 'metal', color: '#a5abb2' }));
    L.push(part(new THREE.TorusGeometry(0.018, 0.004, 4, 10), { at: [sx * 0.019, frame + 0.014, 0], rot: [PI / 2, 0, 0], to: 'metal', color: '#8a9097' }));
  }

  // the flame: open cones, a hotter one inside, bright at the burners and
  // fading to their tips, added on; a group of its own so it can grow
  const flame = [
    part(new THREE.ConeGeometry(0.026, 1, 12, 1, true), { at: [0, 0.5, 0], to: 'fire', color: [4.4, 1.9, 0.4], uv: 'keep' }),
    part(new THREE.ConeGeometry(0.012, 0.7, 8, 1, true), { at: [0, 0.35, 0], to: 'fire', color: [4, 3.4, 1.4], uv: 'keep' }),
  ];
  const fade = canvasTexture(64, (g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.6, '#5a5a5a');
    grad.addColorStop(1, '#ffffff');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  });
  fade.wrapT = THREE.ClampToEdgeWrapping;

  const fabric = k.own(fabricTexture());
  const mats = {
    fabric: standard(k, { map: fabric, roughness: 0.62, metalness: 0, side: THREE.DoubleSide }),
    wicker: standard(k, { map: k.own(wickerTexture()), roughness: 0.85, metalness: 0 }),
    paint: standard(k, { roughness: 0.6, metalness: 0.05 }),
    metal: standard(k, { metalness: 0.8, roughness: 0.32 }),
    fire: k.own(new THREE.MeshBasicMaterial({ vertexColors: true, map: k.own(fade), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
  };
  mats.wicker.userData.density = 10;
  const pose = new THREE.Group();
  const burner = new THREE.Group();
  burner.position.set(0, frame + 0.027, 0);
  burner.scale.set(1, 0.17, 1);
  burner.add(...Object.values(meshes(k, flame, { fire: mats.fire })));
  pose.add(...Object.values(meshes(k, L, mats)), burner);
  return {
    root: [pose],
    update(t) {
      pose.rotation.y = t * 0.05;
      // the pilot flickering, and every few seconds a burn: a long roar and a short one
      const burn = pulse(t, 5.5, 0, 0.2) || pulse(t, 5.5, 0.27, 0.07);
      const f = flicker(t * 1.3, 2);
      burner.scale.set(burn ? 1 : 0.5, (burn ? 0.17 : 0.025) * f, burn ? 1 : 0.5);
      mats.fire.color.setScalar((burn ? 1.4 : 0.5) * f);
    },
  };
}

// ── The DEA, in the air ──

// A rounded section for loft(): a superellipse w × h at height y (squarer
// as e grows), as `n` points anticlockwise from its right side; and the
// point at angle a round the edge of that polygon (so what's laid on a
// hull lofted from them sits on its flat faces, not the curve they cut).
const ovalPt = (w, h, y, a, e = 2.6) => [(w / 2) * sign(cos(a)) * abs(cos(a)) ** (2 / e), y + (h / 2) * sign(sin(a)) * abs(sin(a)) ** (2 / e)];
const oval = (w, h, y, n) => Array.from({ length: n }, (_, i) => ovalPt(w, h, y, (i / n) * PI * 2));
function onOval(w, h, y, n, a) {
  const f = ((((a / (PI * 2)) * n) % n) + n) % n;
  const i = Math.floor(f);
  const p = ovalPt(w, h, y, (i / n) * PI * 2);
  const q = ovalPt(w, h, y, ((i + 1) / n) * PI * 2);
  return [p[0] + (q[0] - p[0]) * (f - i), p[1] + (q[1] - p[1]) * (f - i)];
}

// The letters D, E and A as outlines (with their holes), a unit tall, and how wide
const LETTERS = {
  D: { w: 0.62, o: [[0, 0], [0.42, 0], [0.62, 0.2], [0.62, 0.8], [0.42, 1], [0, 1]], holes: [[[0.2, 0.2], [0.34, 0.2], [0.42, 0.3], [0.42, 0.7], [0.34, 0.8], [0.2, 0.8]]] },
  E: { w: 0.6, o: [[0, 0], [0.6, 0], [0.6, 0.2], [0.21, 0.2], [0.21, 0.41], [0.5, 0.41], [0.5, 0.6], [0.21, 0.6], [0.21, 0.8], [0.6, 0.8], [0.6, 1], [0, 1]], holes: [] },
  A: { w: 0.72, o: [[0, 0], [0.2, 0], [0.25, 0.22], [0.47, 0.22], [0.52, 0], [0.72, 0], [0.47, 1], [0.25, 1]], holes: [[[0.3, 0.4], [0.42, 0.4], [0.38, 0.8], [0.34, 0.8]]] },
};

function deachopper(k) {
  const NAVY = '#1e2a45';
  const WHITE = '#e8ecef';
  const BLADE = '#2a2d32';
  const SKID = '#4c525a';
  const N = 20;
  // the pod, from the boom to the nose: [z, w, h, y] for each section
  const POD = [
    [-0.17, 0.075, 0.07, 0.065],
    [-0.12, 0.165, 0.16, 0.047],
    [-0.04, 0.215, 0.205, 0.032],
    [0.12, 0.225, 0.215, 0.026],
    [0.28, 0.215, 0.205, 0.02],
    [0.37, 0.185, 0.175, 0.012],
    [0.43, 0.125, 0.115, 0.004],
    [0.465, 0.05, 0.045, -0.002],
  ];
  const podAt = (z) => {
    let i = 0;
    while (i < POD.length - 2 && z > POD[i + 1][0]) i++;
    const f = (z - POD[i][0]) / (POD[i + 1][0] - POD[i][0]);
    return POD[i].map((v, j) => v + (POD[i + 1][j] - v) * f);
  };
  // a strip of skin over the pod from z0 to z1, between angles a0 and a1
  // round it (each a number or a function of z), grown out from it a touch
  const skin = (z0, z1, a0, a1, grow, m = 6) => {
    const at = (a, z) => (typeof a === 'function' ? a(z) : a);
    const zs = [z0, ...POD.map((s) => s[0]).filter((z) => z > z0 && z < z1), z1];
    return loft(
      zs.map((z) => {
        const [, w, h, y] = podAt(z);
        const pts = [];
        for (let i = 0; i <= m; i++) {
          const [x, yy] = onOval(w, h, y, N, at(a0, z) + (at(a1, z) - at(a0, z)) * (i / m));
          pts.push([x * grow, y + (yy - y) * grow]);
        }
        return { z, pts };
      }),
    );
  };
  const L = [];
  L.push(part(loft(POD.map(([z, w, h, y]) => ({ z, pts: oval(w, h, y, N) }))), { color: NAVY }));
  // the glass: round the cabin above its waist, coming down round the nose
  // to the chin; the roof over it, a pillar either side of the doors
  const sill = (z) => (z < 0.28 ? 0.21 : 0.21 - ((z - 0.28) / 0.185) * 0.75);
  L.push(part(skin(-0.03, 0.467, sill, (z) => PI - sill(z), 1.012, 12), { to: 'glass' }));
  L.push(part(skin(-0.035, 0.263, 1.08, PI - 1.08, 1.022, 4), { color: NAVY }));
  for (const z of [0.1, 0.27]) {
    L.push(part(skin(z - 0.007, z + 0.007, 0.16, 1.08, 1.022, 6), { color: NAVY }));
    L.push(part(skin(z - 0.007, z + 0.007, PI - 1.08, PI - 0.16, 1.022, 6), { color: NAVY }));
  }
  // the white band low down each side, sweeping up as the pod narrows into
  // the boom, and on along the boom
  const mid = (z) => (z > -0.04 ? -0.28 : -0.28 + ((-0.04 - z) / 0.11) * 0.28);
  L.push(part(skin(-0.15, 0.34, (z) => mid(z) - 0.14, (z) => mid(z) + 0.14, 1.014, 3), { color: WHITE }));
  L.push(part(skin(-0.15, 0.34, (z) => PI - mid(z) - 0.14, (z) => PI - mid(z) + 0.14, 1.014, 3), { color: WHITE }));
  const boomR = (z) => 0.018 + ((z + 0.46) / 0.3) * 0.018;
  const stripe = (z) => ({ z, pts: box8(0.0024, 0.4 * boomR(z) + 0.004, 0, 0.064).map(([x, y]) => [x + boomR(z) + 0.0012, y]) });
  const boomStripe = [part(loft([stripe(-0.44), stripe(-0.16)]), { color: WHITE })];
  L.push(...boomStripe, ...mirror(boomStripe));
  // the letters on each flank, between the band and the glass: laid out
  // reading forward on the right side, and turned about to read aft on the left
  const word = [];
  let u = -0.02;
  for (const ch of 'DEA') {
    const { w, o, holes } = LETTERS[ch];
    const s = 0.034;
    const x = podAt(u + (w * s) / 2)[1] / 2 + 0.0015;
    const fit = (pts) => pts.map(([a, b]) => [u + a * s, 0.012 + b * s]);
    word.push(part(plateZY(fit(o), 0.003, 0, holes.map(fit)), { at: [-x, 0, 0], color: WHITE }));
    u += (w + 0.16) * s;
  }
  L.push(...word, ...place(word, [0, 0, u - 0.16 * 0.034 - 0.02], [0, PI, 0]));

  // the boom, the fin over and under its end, the stabiliser with its end
  // plates, and the tail rotor's gearbox
  L.push(part(turned([[0.0001, -0.478], [0.014, -0.476], [0.018, -0.46], [0.036, -0.16]], 12), { at: [0, 0.064, 0], color: NAVY }));
  L.push(part(plateZY([[-0.395, 0], [-0.455, 0], [-0.495, 0.115], [-0.46, 0.115]], 0.008, 0.002), { at: [0, 0.064, 0], color: NAVY }));
  L.push(part(plateZY([[-0.42, 0], [-0.46, 0], [-0.48, -0.06], [-0.46, -0.06]], 0.008, 0.002), { at: [0, 0.064, 0], color: NAVY }));
  L.push(part(plateXZ([[-0.09, -0.33], [0.09, -0.33], [0.09, -0.29], [-0.09, -0.29]], 0.006, 0.0015), { at: [0, 0.064, 0], color: NAVY }));
  for (const sx of [-1, 1]) L.push(part(plateZY([[-0.335, -0.018], [-0.3, -0.018], [-0.305, 0.03], [-0.335, 0.03]], 0.005, 0.001), { at: [sx * 0.09, 0.064, 0], color: NAVY }));
  L.push(part(new THREE.CylinderGeometry(0.011, 0.011, 0.026, 8), { at: [0.013, 0.095, -0.44], rot: [0, 0, PI / 2], to: 'metal', color: '#3a3f47' }));
  // the engine's doghouse on the cabin roof, its intakes and exhausts, the
  // mast up out of it
  L.push(
    part(
      loft([
        { z: -0.16, pts: box8(0.07, 0.05, 0.012, 0.145) },
        { z: -0.12, pts: box8(0.11, 0.07, 0.016, 0.14) },
        { z: 0.06, pts: box8(0.11, 0.07, 0.016, 0.14) },
        { z: 0.12, pts: box8(0.09, 0.03, 0.01, 0.13) },
      ]),
      { color: NAVY },
    ),
  );
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.004, 0.024, 0.05), { at: [sx * 0.0555, 0.142, 0.0], to: 'metal', color: '#1c1f24' }));
    L.push(rod([sx * 0.022, 0.158, -0.13], [sx * 0.028, 0.176, -0.19], 0.009, 0.01, { to: 'metal', color: '#2e3238' }, 8));
  }
  L.push(rod([0, 0.17, 0.04], [0, 0.205, 0.04], 0.011, 0.011, { to: 'metal', color: '#565c64' }, 10));
  // the skids on their cross tubes
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.105, -0.125, -0.13], [sx * 0.105, -0.125, 0.25], 0.006, 0.006, { to: 'metal', color: SKID }, 8));
    L.push(rod([sx * 0.105, -0.125, 0.25], [sx * 0.105, -0.108, 0.29], 0.006, 0.006, { to: 'metal', color: SKID }, 8));
    for (const z of [-0.06, 0.18]) L.push(rod([sx * 0.03, -0.05, z], [sx * 0.105, -0.125, z], 0.0055, 0.0055, { to: 'metal', color: SKID }, 8));
  }
  // the searchlight's turret under the nose; the lights: red to port, green
  // to starboard, a red beacon over the fin and under the belly, a white
  // strobe at the tail
  const lampAt = [-0.075, -0.095, 0.22];
  L.push(rod([lampAt[0], -0.05, lampAt[2]], [lampAt[0], lampAt[1], lampAt[2]], 0.006, 0.006, { to: 'metal', color: '#3a3f47' }, 6));
  L.push(ball(0.017, lampAt, 1, { to: 'metal', color: '#4a4f57' }, 12));
  L.push(ball(0.006, [0.09, 0.098, -0.318], 1, { to: 'glow', color: [5, 0.5, 0.4] }, 6));
  L.push(ball(0.006, [-0.09, 0.098, -0.318], 1, { to: 'glow', color: [0.5, 4.5, 1.2] }, 6));
  L.push(ball(0.007, [-0.002, 0.182, -0.478], 1, { to: 'glow', color: [5.5, 0.6, 0.4], mark: 'beacon' }, 6));
  L.push(ball(0.007, [0, -0.083, 0.06], 1, { to: 'glow', color: [5.5, 0.6, 0.4], mark: 'beacon' }, 6));
  L.push(ball(0.005, [0, 0.064, -0.481], 1, { to: 'glow', color: [5, 5, 5], mark: 'strobe' }, 6));

  // the main rotor: four blades, white tipped, on the hub (a group of its
  // own, to turn); the tail rotor's two
  const R = 0.44;
  const rotor = [part(new THREE.CylinderGeometry(0.024, 0.026, 0.014, 12), { to: 'metal', color: '#5b6169' }), ball(0.012, [0, 0.007, 0], [1, 0.6, 1], { to: 'metal', color: '#5b6169' }, 8)];
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i * PI) / 2;
    rotor.push(part(new THREE.BoxGeometry(0.03, 0.004, R - 0.05), { at: [sin(a) * (R / 2), 0, cos(a) * (R / 2)], rot: [0, a, 0.08], color: BLADE }));
    rotor.push(part(new THREE.BoxGeometry(0.031, 0.0046, 0.03), { at: [sin(a) * (R - 0.015), 0, cos(a) * (R - 0.015)], rot: [0, a, 0.08], color: '#e6e2d4' }));
  }
  const tail = [part(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 8), { rot: [0, 0, PI / 2], to: 'metal', color: '#5b6169' }), part(new THREE.BoxGeometry(0.003, 0.12, 0.012), { at: [0.003, 0, 0], color: BLADE })];
  for (const s of [-1, 1]) tail.push(part(new THREE.BoxGeometry(0.0032, 0.016, 0.0125), { at: [0.003, s * 0.052, 0], color: '#e6e2d4' }));

  // the searchlight's beam (and the lamp in its turret, a group of its own
  // to sweep): an open cone ahead and down, faint and fading as it goes,
  // added on, with a brighter core
  const dip = 0.87;
  const dir = new THREE.Vector3(0, -sin(dip), cos(dip));
  const from = dir.clone().multiplyScalar(0.018);
  const reach = (d) => from.clone().addScaledVector(dir, d).toArray();
  const lamp = [
    part(new THREE.CircleGeometry(0.012, 12), { at: from.toArray(), rot: [dip, 0, 0], to: 'glow', color: [8, 8, 7] }),
    between(new THREE.ConeGeometry(0.075, 1, 16, 1, true), reach(0.38), from.toArray(), { to: 'beam', color: [0.12, 0.12, 0.11], uv: 'keep' }),
    between(new THREE.ConeGeometry(0.03, 1, 12, 1, true), reach(0.3), from.toArray(), { to: 'beam', color: [0.17, 0.17, 0.15], uv: 'keep' }),
  ];
  const fade = canvasTexture(64, (g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#6a6a6a');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  });
  fade.wrapT = THREE.ClampToEdgeWrapping;

  const mats = materials(k, { base: 215, spread: 8, seam: 0.55, metalness: 0.45, roughness: 0.34, glass: '#33557c' });
  mats.beam = k.own(new THREE.MeshBasicMaterial({ vertexColors: true, map: k.own(fade), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const group = (list, at) => {
    const g = new THREE.Group();
    g.position.set(...at);
    g.add(...Object.values(meshes(k, list, mats)));
    return g;
  };
  const spin = group(rotor, [0, 0.212, 0.04]);
  const tailSpin = group(tail, [0.03, 0.095, -0.44]);
  const sweep = group(lamp, lampAt);
  const made = finish(k, L, mats, (t, blink) => {
    spin.rotation.y = t * 14;
    tailSpin.rotation.x = t * 40;
    sweep.rotation.y = 0.32 * sin(t * 0.6);
    blink('beacon', pulse(t, 1.1, 0, 0.08) ? 1.4 : 0.15);
    blink('strobe', pulse(t, 1.6, 0.5, 0.04) ? 1.4 : 0.1);
  });
  made.root.push(spin, tailSpin, sweep);
  return made;
}

export const FLEET = { suv, suvace, lowrider, pollostruck, madrigal, pestvan, saulcaddy, mikesedan, cousins, pickup, gusvolvo, beater, balloon, deachopper };
