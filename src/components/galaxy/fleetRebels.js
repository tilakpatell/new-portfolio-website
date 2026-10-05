// The Rebel Alliance's and the Galactic Empire's ships and stations that the
// universe map's traffic doesn't have (see universe/trafficModels.js for how a
// model is put together and what it returns, universe/trafficKit.js for the
// pieces).
//
// moncal: an MC80 Mon Calamari star cruiser (Home One's type), one long
// lumpy hull with no straight line on it, swelling into overlapping bulges
// and blisters along its flanks and back, mottled grey-blue and cream, with
// curving rows of tiny lit viewports and a cluster of big blue-white engines
// round the blunt stern.
// executor: the Super Star Destroyer, an arrowhead nearly seven times longer
// than it's wide, its flat dark deck carrying a long raised spine of city-like
// superstructure that widens toward the stern, the command tower at the back
// with its bridge and twin sensor globes, and thirteen blue engines in two
// rows across the stern.
// deathstar2: the second Death Star, half built: a plated grey sphere with
// its equatorial trench, the superlaser's dish sunk into the northern
// hemisphere, and a ragged, stepped bite out of its upper right where the
// plating stops and the skeleton shows: girders, decks and the lit core.
// awing: an RZ-1 A-wing, a small flat wedge with a red nose and red stripes
// over white, its cockpit forward on the ridge, two big engines out at the
// back corners with their fins, and a cannon on each side.
// ywing: a BTL Y-wing, the rounded cockpit head with its yellow stripes and
// ion turret, the bare skeleton behind it, and the two long engine nacelles on
// their crossbar, each ending in a round glowing exhaust inside four vanes.
// bwing: an A/SF-01 B-wing, flying the way it does with its long main foil
// upright: the cockpit pod at the top, the engine block below it with its
// four exhausts, the S-foils open across it in a cross, cannons on their tips
// and the heavy weapons pod at the foil's lower end; grey with orange-red.
// nebulon: an EF76 Nebulon-B escort frigate, the long upper forward hull with
// its command tower, the lower hull hung below it on a thin dropping spar,
// and the thin boom back to the tall engine block; white-grey.
// hammerhead: a Sphyrna-class corvette, the flat hammerhead bridge across the
// bow on a long thin neck, a tall boxy main hull and three engines, off-white
// with red stripes.
// uwing: a UT-60D U-wing, the blunt troop compartment with its big canopy and
// side doors, two engines at the back and the wings swept forward from them
// in a U; blue-grey.
// gate: the Shield Gate over Scarif, a vast flat ring of segmented plating
// between dark ribs, turbolaser towers on both faces and its inner rim lit,
// the hole in the middle the only way through the shield. It lies flat in
// x-z (the scene stands it facing the planet).
// cloudcity: Cloud City, a wide saucer packed with white towers that rise
// toward the tall central spire, warm lights in every window, on a long thin
// stalk down to the reactor bulb and its vanes. The disc lies flat in x-z,
// the stalk hangs down -y.
//
// Every model points its nose along +z with +y up, so starboard is -x.

import * as THREE from 'three';
import { part, place, mirror, rod, between, meshes, blinker, loft, box8, trap8, plateXZ, plateZY, turned, upright, ball, canvasTexture, grey, panelTexture, standard, glowMaterial, flicker, pulse } from '../universe/trafficKit';

const { PI, sin, cos, sqrt, exp, abs, max } = Math;
const TAU = PI * 2;
const wrap = (a) => ((((a + PI) % TAU) + TAU) % TAU) - PI;

// ── Shared pieces ──

// A smooth body round z (a hull, a nacelle, a bulb): f(u, a) → [x, y, z] for u
// from 0 (the stern) to 1 (the bow) and a the angle round (0 is +x, PI / 2 is
// +y); closed at both ends, its normals smooth (unlike loft()'s). Its uv runs
// along it (u, times su) and round it (v, times sv), the seam under its belly,
// for a part drawn with uv: 'keep'.
function hull(f, nu = 32, na = 24, [su, sv] = [1, 1]) {
  const pos = [];
  const uv = [];
  const A = (j) => -PI / 2 + (j / na) * TAU;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= na; j++) {
      pos.push(...f(i / nu, A(j % na)));
      uv.push((i / nu) * su, (j / na) * sv);
    }
  }
  const C = na + 1;
  const mid = (i) => {
    const c = [0, 0, 0];
    for (let j = 0; j < na; j++) for (let d = 0; d < 3; d++) c[d] += pos[(i * C + j) * 3 + d] / na;
    return c;
  };
  const [tail, nose] = [mid(0), mid(nu)];
  const T = pos.length / 3;
  pos.push(...tail, ...nose);
  uv.push(0, 0, su, 0);
  const v = (i, j) => i * C + j;
  const idx = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < na; j++) idx.push(v(i, j), v(i, j + 1), v(i + 1, j + 1), v(i, j), v(i + 1, j + 1), v(i + 1, j));
  for (let j = 0; j < na; j++) idx.push(T, v(0, j + 1), v(0, j), v(nu, j), v(nu, j + 1), T + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam's two copies of each point share one normal
  const n = g.attributes.normal;
  for (let i = 0; i <= nu; i++) {
    const [a0, a1] = [v(i, 0), v(i, na)];
    const m = new THREE.Vector3(n.getX(a0) + n.getX(a1), n.getY(a0) + n.getY(a1), n.getZ(a0) + n.getZ(a1)).normalize();
    n.setXYZ(a0, m.x, m.y, m.z);
    n.setXYZ(a1, m.x, m.y, m.z);
  }
  return g;
}

// Turned about y through only part of a turn, from phi0 for span (phi 0 is +z,
// PI / 2 is +x): a segment of a ring, a slice of a deck.
const arc = (profile, phi0, span, seg = 8) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, phi0, span);

// An engine at [x, y] with its mouth at z, pointing astern: a housing len
// long, a lip turned in round its mouth and the glow just inside it.
function nozzle(L, [x, y], z, r, len, { glow = [1.6, 2.4, 4.2], color = '#3c3f44', to = 'metal', seg = 14, mark } = {}) {
  L.push(part(turned([[r * 0.72, z + len * 0.14], [r * 0.95, z], [r, z + len * 0.05], [r * 1.03, z + len * 0.55], [r * 0.92, z + len]], seg), { at: [x, y, 0], to, color }));
  L.push(part(new THREE.CircleGeometry(r * 0.8, seg), { at: [x, y, z + len * 0.11], rot: [0, PI, 0], to: 'glow', color: glow, mark }));
}

// Plating with rows of small windows, for a hull that's lived in: the panels
// with the windows dark on them, and the same windows lit on black for the
// material's emissiveMap (a few in each run left dark).
function windowed(k, plating, { rows = 14, often = 0.5, size = [3, 2], lit = 0.7, gap = 2 } = {}) {
  const S = 256;
  const map = k.own(panelTexture(k.rand, plating));
  const emissiveMap = k.own(
    canvasTexture(S, (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, S, S);
    }),
  );
  const a = map.image.getContext('2d');
  const b = emissiveMap.image.getContext('2d');
  const [w, h] = size;
  for (let r = 0; r < rows; r++) {
    const y = Math.floor(((r + 0.5) * S) / rows);
    for (let x = 0; x < S; ) {
      const run = 8 + Math.floor(k.rand() * 50);
      if (k.rand() < often) {
        for (let xx = x; xx < Math.min(S - w, x + run); xx += w + gap) {
          a.fillStyle = 'rgba(28,30,34,0.85)';
          a.fillRect(xx, y, w, h);
          if (k.rand() < lit) {
            b.fillStyle = grey(140 + k.rand() * 115);
            b.fillRect(xx, y, w, h);
          }
        }
      }
      x += run + 6;
    }
  }
  map.needsUpdate = true;
  emissiveMap.needsUpdate = true;
  return { map, emissiveMap };
}

// The four materials most models are drawn with: painted plating (with lit
// windows where `windows` is given), bare metal, glass and the glow.
function materials(k, { plating = {}, windows = null, emissive = '#ffd9a8', glow = 1.2, paint = {}, metal = {}, glass = '#1d2c38', density = 4 } = {}) {
  const tex = windows ? windowed(k, plating, windows) : { map: k.own(panelTexture(k.rand, plating)) };
  const mats = {
    paint: standard(k, { ...tex, ...(windows ? { emissive, emissiveIntensity: glow } : {}), metalness: 0.25, roughness: 0.6, ...paint }),
    metal: standard(k, { metalness: 0.7, roughness: 0.42, ...metal }),
    glass: standard(k, { color: glass, metalness: 0.85, roughness: 0.1 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = density;
  return mats;
}

function finish(k, L, mats, update) {
  const M = meshes(k, L, mats);
  const blink = M.glow ? blinker(M.glow.geometry) : () => {};
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 3));
      update?.(t, blink);
    },
  };
}

// ── MC80 Mon Calamari star cruiser ──

// Mon Calamari plating: mottled grey, grey-blue and cream with no panel grid,
// soft curving seams, and the viewports in wavy rows (dark on the map, lit on
// the emissive map).
function calamariTexture(k) {
  const S = 256;
  const R = k.rand;
  const ports = [];
  for (let row = 0; row < 12; row++) {
    const y0 = R() * S;
    const amp = 3 + R() * 9;
    const m = 1 + Math.floor(R() * 3);
    const ph = R() * TAU;
    for (let x = 0; x < S; ) {
      const run = 10 + R() * 50;
      if (R() < 0.45) for (let xx = x; xx < Math.min(S, x + run); xx += 4) ports.push([xx, (y0 + amp * sin((xx / S) * TAU * m + ph) + S) % S, R() < 0.78]);
      x += run + 8;
    }
  }
  const map = k.own(
    canvasTexture(S, (g) => {
      g.fillStyle = '#939ca5';
      g.fillRect(0, 0, S, S);
      // soft blotches of grey-blue, cream and darker grey, wrapped so the tile repeats
      for (let i = 0; i < 90; i++) {
        const x = R() * S;
        const y = R() * S;
        const r = 8 + R() * 46;
        const c = R() < 0.4 ? '112,134,160' : R() < 0.55 ? '206,198,176' : R() < 0.6 ? '88,96,106' : '160,168,174';
        const a = 0.25 + R() * 0.4;
        for (const dx of [-S, 0, S]) {
          for (const dy of [-S, 0, S]) {
            const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
            gr.addColorStop(0, `rgba(${c},${a})`);
            gr.addColorStop(1, `rgba(${c},0)`);
            g.fillStyle = gr;
            g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
          }
        }
      }
      // broad soft bands of plating flowing along the hull
      for (let i = 0; i < 10; i++) {
        const y0 = R() * S;
        const amp = 6 + R() * 16;
        const ph = R() * TAU;
        g.strokeStyle = R() < 0.5 ? 'rgba(70,80,92,0.22)' : 'rgba(222,216,200,0.2)';
        g.lineWidth = 3 + R() * 7;
        g.beginPath();
        for (let x = 0; x <= S; x += 8) g.lineTo(x, y0 + amp * sin((x / S) * TAU + ph));
        g.stroke();
      }
      g.fillStyle = 'rgba(30,34,40,0.9)';
      for (const [x, y] of ports) g.fillRect(x, y, 2, 2);
    }),
  );
  const emissiveMap = k.own(
    canvasTexture(S, (g) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, S, S);
      for (const [x, y, on] of ports) {
        if (!on) continue;
        g.fillStyle = grey(150 + R() * 105);
        g.fillRect(x, y, 2, 2);
      }
    }),
  );
  return { map, emissiveMap };
}

function moncal(k) {
  const L = [];
  // bulges on the hull: [u along it, angle round it, how long, how wide, how high]
  const bulges = [
    [0.8, PI / 2, 0.09, 0.55, 0.14],
    [0.6, PI / 2 + 0.2, 0.08, 0.5, 0.08],
    [0.42, PI / 2, 0.13, 0.5, 0.11],
    [0.18, PI / 2, 0.1, 0.6, 0.09],
    [0.55, 0.12, 0.2, 0.42, 0.13],
    [0.55, PI - 0.12, 0.2, 0.42, 0.13],
    [0.28, -0.3, 0.12, 0.45, 0.1],
    [0.3, PI + 0.32, 0.11, 0.45, 0.1],
    [0.7, -0.45, 0.08, 0.5, 0.08],
    [0.72, PI + 0.42, 0.09, 0.5, 0.09],
    [0.45, -PI / 2, 0.25, 0.8, -0.1],
    [0.08, 0.5, 0.06, 0.5, 0.09],
    [0.08, PI - 0.5, 0.06, 0.5, 0.09],
  ];
  const R = (u) => {
    const bow = u > 0.7 ? sqrt(max(0, 1 - ((u - 0.7) / 0.3) ** 2)) ** 0.7 : 1;
    const stern = u < 0.07 ? 0.72 + 0.28 * sin(((u / 0.07) * PI) / 2) : 1;
    return 0.12 * bow * stern * (1 + 0.06 * sin(u * 13 + 1) + 0.035 * sin(u * 31 + 2));
  };
  const shape = (u, a) => {
    let r = R(u) * (1 + 0.06 * sin(3 * a + 5 * u) + 0.045 * sin(5 * a - 11 * u + 1) + 0.03 * sin(8 * a + 23 * u + 2));
    for (const [u0, a0, du, da, h] of bulges) r *= 1 + h * exp(-(((u - u0) / du) ** 2) - (wrap(a - a0) / da) ** 2);
    return [cos(a) * r * 1.12, sin(a) * r * 0.8 + 0.01 * sin(u * PI), -0.5 + u];
  };
  L.push(part(hull(shape, 72, 44, [3, 2.5]), { uv: 'keep' }));
  // blisters along the flanks and back, overlapping the hull
  const blister = (x, y, z, rx, ry, rz) =>
    L.push(part(hull((u, a) => {
      const r = sin(u * PI) ** 0.8;
      return [x + cos(a) * r * rx, y + sin(a) * r * ry, z + (u - 0.5) * 2 * rz];
    }, 10, 16, [rz * 6, (rx + ry) * 8]), { uv: 'keep' }));
  for (const s of [-1, 1]) {
    blister(s * 0.118, 0.0, 0.12, 0.034, 0.045, 0.12);
    blister(s * 0.112, -0.022, -0.17, 0.03, 0.04, 0.1);
    blister(s * 0.098, 0.04, -0.33, 0.03, 0.036, 0.08);
    blister(s * 0.075, -0.06, 0.3, 0.026, 0.03, 0.09);
  }
  blister(0.02, 0.105, 0.26, 0.04, 0.032, 0.1);
  blister(-0.03, 0.1, -0.02, 0.034, 0.03, 0.12);
  blister(0.01, 0.085, -0.3, 0.05, 0.03, 0.09);
  // the bridge dome high up forward, and a ridge of small humps along the back
  blister(0, 0.118, 0.12, 0.028, 0.02, 0.05);
  for (let i = 0; i < 6; i++) blister(0.008 * sin(i * 2), 0.098 + 0.004 * sin(i), -0.42 + i * 0.075, 0.012, 0.012, 0.03);
  // the engines: one great one in the middle of the stern, six round it, two
  // smaller ones out at the sides
  const Z = -0.488;
  nozzle(L, [0, 0], Z - 0.05, 0.032, 0.065, { glow: [1.5, 2.3, 4], seg: 18 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + PI / 6;
    nozzle(L, [cos(a) * 0.066, sin(a) * 0.046], Z - 0.04 + 0.006 * abs(sin(a)), 0.021, 0.06, { glow: [1.4, 2.1, 3.8] });
  }
  for (const s of [-1, 1]) nozzle(L, [s * 0.098, 0.004], Z + 0.004, 0.015, 0.05, { glow: [1.5, 2.3, 4] });
  // running lights: red to port, green to starboard, white on the back
  L.push(ball(0.005, [0.152, 0.0, 0.1], 1, { to: 'glow', color: [6, 0.5, 0.4], mark: 'lights' }, 6));
  L.push(ball(0.005, [-0.152, 0.0, 0.1], 1, { to: 'glow', color: [0.5, 4, 1.2], mark: 'lights' }, 6));
  L.push(ball(0.004, [0, 0.14, 0.12], 1, { to: 'glow', color: [4, 4, 4], mark: 'beacon' }, 6));
  const mats = materials(k, { metal: { color: '#8a9096' }, density: 3 });
  const tex = calamariTexture(k);
  mats.paint.map.dispose();
  Object.assign(mats.paint, { map: tex.map, emissiveMap: tex.emissiveMap, emissive: new THREE.Color('#d8e6ff'), emissiveIntensity: 1.1, metalness: 0.35, roughness: 0.48 });
  return finish(k, L, mats, (t, blink) => {
    blink('lights', pulse(t, 2.2, 0, 0.12) ? 1 : 0.2);
    blink('beacon', pulse(t, 1.3, 0.5, 0.1) ? 1 : 0.1);
  });
}

// ── Executor-class Super Star Destroyer ──

function executor(k) {
  const L = [];
  const HULL = '#80858c';
  const DECK = '#8d9198';
  const DARK = '#3b3e43';
  // the hull: a flat deck on top, short sides, the belly sloping to a keel
  const W = (z) => 0.003 + 0.071 * (0.5 - z);
  const D = (z) => 0.003 + 0.022 * (0.5 - z);
  const sec = (z) => {
    const [w, d] = [W(z), D(z)];
    return { z, pts: [[w * 0.2, -d], [w, -d * 0.3], [w, 0], [-w, 0], [-w, -d * 0.3], [-w * 0.2, -d]] };
  };
  L.push(part(loft([sec(-0.5), sec(-0.1), sec(0.3), sec(0.5)]), { color: HULL }));
  // a darker trench along each side, just under the deck's edge
  for (const s of [-1, 1]) L.push(rod([s * W(-0.49), -0.0035, -0.49], [s * W(0.46), -0.0015, 0.46], 0.0011, 0.0011, { to: 'metal', color: DARK }, 4));
  // the spine: a raised band down the middle, wider toward the stern
  const SW = (z) => 0.006 + 0.044 * ((0.38 - z) / 0.84);
  const SH = (z) => 0.0015 + 0.0045 * ((0.38 - z) / 0.84);
  L.push(part(loft([-0.46, -0.2, 0.1, 0.38].map((z) => ({ z, pts: trap8(SW(z), SW(z) * 0.82, SH(z), SH(z) * 0.2, SH(z) / 2) }))), { color: DECK }));
  // the city on it: hundreds of blocks, packed tightest and tallest astern
  for (let i = 0; i < 520; i++) {
    const z = -0.455 + k.rand() ** 1.3 * 0.82;
    const half = SW(z) * 0.55;
    const x = (k.rand() * 2 - 1) * half;
    const w = 0.0015 + k.rand() * 0.0045 * (1 - (z + 0.45) * 0.6);
    const d = 0.002 + k.rand() * 0.012;
    const h = 0.001 + k.rand() * k.rand() * 0.007 * (1.2 - (z + 0.46));
    const dark = k.rand() < 0.25;
    L.push(part(new THREE.BoxGeometry(w, h, d), { at: [x, SH(z) + h / 2, z], to: dark ? 'metal' : 'paint', color: dark ? '#55595f' : grey(126 + k.rand() * 30) }));
  }
  // smaller blocks scattered out over the deck to its edges
  for (let i = 0; i < 160; i++) {
    const z = -0.47 + k.rand() * 0.86;
    const x = (k.rand() * 2 - 1) * W(z) * 0.92;
    const h = 0.0006 + k.rand() * 0.0018;
    L.push(part(new THREE.BoxGeometry(0.002 + k.rand() * 0.006, h, 0.003 + k.rand() * 0.012), { at: [x, h / 2, z], color: grey(120 + k.rand() * 26) }));
  }
  // the command tower astern: stepped blocks up to the bridge, its wide flat
  // command deck on a neck, and the twin sensor globes on top
  const TZ = -0.43;
  const top = SH(TZ);
  L.push(part(loft([{ z: TZ - 0.026, pts: trap8(0.05, 0.034, 0.012, 0.002, top + 0.006) }, { z: TZ + 0.03, pts: trap8(0.04, 0.026, 0.01, 0.002, top + 0.005) }]), { color: DECK }));
  L.push(part(loft([{ z: TZ - 0.018, pts: trap8(0.03, 0.02, 0.01, 0.002, top + 0.017) }, { z: TZ + 0.012, pts: trap8(0.024, 0.016, 0.01, 0.002, top + 0.017) }]), { color: HULL }));
  L.push(part(new THREE.BoxGeometry(0.009, 0.012, 0.011), { at: [0, top + 0.027, TZ - 0.006], color: HULL }));
  L.push(part(loft([{ z: TZ - 0.012, pts: box8(0.05, 0.0065, 0.0015, top + 0.035) }, { z: TZ + 0.002, pts: box8(0.052, 0.0065, 0.0015, top + 0.035) }, { z: TZ + 0.006, pts: box8(0.044, 0.004, 0.001, top + 0.0345) }]), { color: DECK }));
  L.push(part(new THREE.BoxGeometry(0.046, 0.0012, 0.0008), { at: [0, top + 0.0352, TZ + 0.0064], to: 'glow', color: [2.2, 2.4, 2.6] }));
  for (const s of [-1, 1]) {
    L.push(rod([s * 0.017, top + 0.038, TZ - 0.006], [s * 0.017, top + 0.041, TZ - 0.006], 0.0018, 0.0018, { color: HULL }, 6));
    L.push(ball(0.0042, [s * 0.017, top + 0.0445, TZ - 0.006], 1, { color: '#9a9ea4' }, 12));
  }
  // the engine block across the stern and its thirteen engines in two rows
  L.push(part(loft([{ z: -0.505, pts: trap8(0.15, 0.138, 0.032, 0.006, -0.006) }, { z: -0.47, pts: trap8(0.15, 0.138, 0.032, 0.006, -0.006) }]), { color: HULL }));
  for (let i = 0; i < 7; i++) nozzle(L, [(i - 3) * 0.0205, -0.0135], -0.517, 0.0074, 0.016, { glow: [1.7, 2.6, 4.6], seg: 12 });
  for (let i = 0; i < 6; i++) nozzle(L, [(i - 2.5) * 0.0205, 0.0025], -0.515, i === 2 || i === 3 ? 0.0074 : 0.0066, 0.014, { glow: [1.7, 2.6, 4.6], seg: 12 });
  // lights down the edges, and red ones at the bow
  for (let i = 0; i < 18; i++) {
    const z = -0.46 + i * 0.05;
    for (const s of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.0012, 0.0012, 0.003), { at: [s * (W(z) + 0.0004), -0.0012, z], to: 'glow', color: [2.6, 2.4, 2], mark: i % 2 ? 'a' : 'b' }));
  }
  L.push(ball(0.0018, [0, 0.0015, 0.497], 1, { to: 'glow', color: [7, 0.6, 0.4], mark: 'bow' }, 6));
  const mats = materials(k, { plating: { min: 10, base: 200, spread: 14, seam: 0.58, detail: 0.4 }, windows: { rows: 22, often: 0.45, size: [2, 1], lit: 0.65 }, emissive: '#d6e4ff', glow: 1.15, paint: { metalness: 0.35, roughness: 0.55 }, density: 9 });
  return finish(k, L, mats, (t, blink) => {
    blink('a', pulse(t, 3, 0, 0.5) ? 1 : 0.35);
    blink('b', pulse(t, 3, 0.5, 0.5) ? 1 : 0.35);
    blink('bow', pulse(t, 1.5, 0, 0.12) ? 1 : 0.1);
  });
}

// ── The second Death Star ──

function deathstar2(k) {
  const L = [];
  const R = 0.5;
  // where a point on the sphere is: th down from the north pole, ph round from
  // +z toward +x
  const dir = (th, ph) => [sin(th) * sin(ph), cos(th), sin(th) * cos(ph)];
  const at = (r, th, ph) => dir(th, ph).map((c) => c * r);
  // the rows of plating, with the trench's two edges just either side of the equator
  const ROWS = 46;
  const COLS = 92;
  const TR = 0.011;
  const ths = [...Array(ROWS + 1).keys()].map((i) => (i / ROWS) * PI).filter((th) => abs(th - PI / 2) > TR * 1.5);
  ths.push(PI / 2 - TR, PI / 2 + TR);
  ths.sort((a, b) => a - b);
  // the superlaser's dish, up in the north and round to the left
  const DISH = [0.3 * PI, -0.42];
  const D = new THREE.Vector3(...dir(...DISH));
  const RHO = 0.25;
  const near = (th, ph, v, r) => new THREE.Vector3(...dir(th, ph)).angleTo(v) < r;
  // the unfinished part, up on the right: each row of it its own width, so
  // its edge is ragged and stepped
  const [HA, HB, HC] = [0.08 * PI, 0.6 * PI, 1.25];
  const jag = ths.map(() => (k.rand() - 0.5) * 0.36);
  const open = (i, th, ph) => {
    if (th < HA || th > HB) return false;
    const f = (th - HA) / (HB - HA);
    const half = 1.05 * sin(PI * f ** 0.8) ** 0.7 + jag[i] + 0.12 * sin(ph * 5);
    return abs(wrap(ph - HC)) < half;
  };
  // the plating in sectors, each its own shade with its panels laid a little
  // differently (so the surface doesn't repeat), and the trench dark
  const SHADES = ['#a4a8ad', '#9a9ea4', '#acb0b4', '#93979d', '#a0a5aa'];
  const groups = {};
  const sector = [...Array(64)].map(() => [Math.floor(k.rand() * SHADES.length), k.rand(), k.rand()]);
  const holed = new Set();
  for (let i = 0; i < ths.length - 1; i++) {
    const [t0, t1] = [ths[i], ths[i + 1]];
    const tc = (t0 + t1) / 2;
    const trench = abs(tc - PI / 2) < TR;
    for (let j = 0; j < COLS; j++) {
      const [p0, p1] = [(j / COLS) * TAU, ((j + 1) / COLS) * TAU];
      const pc = (p0 + p1) / 2;
      if (open(i, tc, pc)) {
        holed.add(`${i},${j}`);
        continue;
      }
      if (near(tc, pc, D, RHO)) continue;
      const [shade, du, dv] = sector[(Math.floor(i / 4) * 7 + Math.floor(j / 5) * 13) % 64];
      const key = trench ? 'trench' : `s${shade}`;
      const r = trench ? R - 0.006 : R;
      const G = (groups[key] ??= { pos: [], nrm: [], uv: [], to: trench ? 'metal' : 'paint', color: trench ? '#4a4e54' : SHADES[shade] });
      for (const [th, ph] of [[t0, p0], [t1, p1], [t0, p1], [t0, p0], [t1, p0], [t1, p1]]) {
        G.pos.push(...at(r, th, ph));
        G.nrm.push(...dir(th, ph));
        G.uv.push((ph / TAU) * 30 + du, (th / PI) * 15 + dv);
      }
    }
  }
  for (const G of Object.values(groups)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(G.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
    L.push(part(g, { to: G.to, uv: 'keep', color: G.color }));
  }
  // the dish: a shallow bowl, with a flat collar round it to meet the plating
  {
    const e1 = new THREE.Vector3(0, 1, 0).cross(D).normalize();
    const e2 = D.clone().cross(e1);
    const N = 44;
    const ss = [0, 0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.225, RHO, RHO + 0.002, RHO + 0.05, RHO + 0.1];
    const depth = (s) => (s <= RHO ? 0.05 * (1 - (s / RHO) ** 2) : 0) + (s > RHO ? 0.0012 : 0);
    const p = [];
    const uv = [];
    for (const s of ss) {
      for (let n = 0; n < N; n++) {
        const b = (n / N) * TAU;
        uv.push((n / N) * 12, s * 22);
        const v = D.clone().multiplyScalar(cos(s)).addScaledVector(e1, sin(s) * cos(b)).addScaledVector(e2, sin(s) * sin(b));
        p.push(...v.multiplyScalar(R - depth(s)).toArray());
      }
    }
    const idx = [];
    for (let m = 0; m < ss.length - 1; m++) {
      for (let n = 0; n < N; n++) {
        const [a, b2, c, d] = [m * N + n, m * N + ((n + 1) % N), (m + 1) * N + ((n + 1) % N), (m + 1) * N + n];
        idx.push(a, d, c, a, c, b2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // turned the right way out (facing away from the middle)
    const nrm = g.attributes.normal;
    if (nrm.getX(N * 11) * D.x + nrm.getY(N * 11) * D.y + nrm.getZ(N * 11) * D.z < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    L.push(part(g, { uv: 'keep', color: '#8f9398' }));
    // the focusing lens in the middle, and the eight tributary emitters round it
    const c = D.clone().multiplyScalar(R - 0.05);
    L.push(ball(0.014, c.toArray(), 1, { to: 'metal', color: '#3a3e44' }, 12));
    L.push(ball(0.007, D.clone().multiplyScalar(R - 0.038).toArray(), 1, { to: 'glow', color: [0.5, 2.6, 0.7], mark: 'laser' }, 8));
    for (let n = 0; n < 8; n++) {
      const b = (n / 8) * TAU;
      const s = RHO * 0.62;
      const v = D.clone().multiplyScalar(cos(s)).addScaledVector(e1, sin(s) * cos(b)).addScaledVector(e2, sin(s) * sin(b));
      L.push(ball(0.009, v.multiplyScalar(R - depth(s) + 0.001).toArray(), 1, { to: 'metal', color: '#5a5e64' }, 8));
    }
  }
  // inside the unfinished part: the lit core, decks and girders
  L.push(ball(0.43, [0, 0, 0], 1, { color: '#6c7076' }, 32));
  const inHole = (i, j) => holed.has(`${i},${((j % COLS) + COLS) % COLS}`);
  const cell = (i, j) => [ths[i], (j / COLS) * TAU];
  const girder = (a, b, r) => L.push(between(new THREE.CylinderGeometry(r, r, 1, 3, 1, true), a, b, { to: 'metal', color: '#7d8188' }));
  for (let i = 0; i < ths.length - 1; i++) {
    for (let j = 0; j < COLS; j++) {
      const here = inHole(i, j) || inHole(i - 1, j) || inHole(i, j - 1) || inHole(i - 1, j - 1);
      if (!here) continue;
      const [th, ph] = cell(i, j);
      const [th2, ph2] = [ths[i + 1], ((j + 1) / COLS) * TAU];
      // the outer frame where the plating would go: every other line each way
      if (i % 2 === 0 && (inHole(i, j) || inHole(i - 1, j))) girder(at(R - 0.003, th, ph), at(R - 0.003, th, ph2), 0.0022);
      if (j % 2 === 0 && (inHole(i, j) || inHole(i, j - 1))) girder(at(R - 0.003, th, ph), at(R - 0.003, th2, ph), 0.0022);
      // a deeper frame, sparser, and struts down to it
      if (i % 3 === 0 && j % 3 === 0 && inHole(i, j)) {
        girder(at(R - 0.03, th, ph), at(R - 0.03, th, ((j + 3) / COLS) * TAU), 0.0028);
        if (ths[i + 3]) girder(at(R - 0.03, th, ph), at(R - 0.03, ths[i + 3], ph), 0.0028);
        girder(at(R - 0.003, th, ph), at(R - 0.03, th, ph), 0.0018);
      }
    }
  }
  // decks: flat floors across the open part, between the core and the shell
  for (let i = 2; i < ths.length - 1; i += 3) {
    const th = ths[i];
    const y = R * cos(th);
    if (abs(y) > 0.42) continue;
    const cols = [];
    for (let j = 0; j < COLS; j++) if (inHole(i, j)) cols.push(j);
    if (!cols.length) continue;
    // the run of open columns round HC
    const ph0 = HC + wrap(((cols.reduce((m, j) => (wrap((j / COLS) * TAU - HC) < wrap((m / COLS) * TAU - HC) ? j : m), cols[0])) / COLS) * TAU - HC);
    const ph1 = HC + wrap(((cols.reduce((m, j) => (wrap((j / COLS) * TAU - HC) > wrap((m / COLS) * TAU - HC) ? j : m), cols[0]) + 1) / COLS) * TAU - HC);
    const ri = sqrt(max(0, 0.43 ** 2 - y * y));
    const ro = sqrt(R * R - y * y) - 0.006;
    if (ro - ri < 0.01) continue;
    L.push(part(arc([[ri, y - 0.002], [ro, y - 0.002], [ro, y + 0.002], [ri, y + 0.002], [ri, y - 0.002]], ph0, ph1 - ph0, 12), { to: 'metal', color: '#8d9197' }));
    // lights along the deck's edge
    for (let n = 0; n < 10; n++) {
      const ph = ph0 + ((n + 0.5) / 10) * (ph1 - ph0);
      const rr = ri + (ro - ri) * (0.3 + 0.6 * k.rand());
      L.push(part(new THREE.BoxGeometry(0.003, 0.0016, 0.003), { at: [sin(ph) * rr, y + 0.0028, cos(ph) * rr], to: 'glow', color: [3, 2.6, 1.9], mark: n % 3 ? undefined : 'work' }));
    }
  }
  const mats = materials(k, { plating: { min: 12, base: 205, spread: 16, seam: 0.6, detail: 0.45 }, windows: { rows: 18, often: 0.35, size: [2, 1], lit: 0.6 }, emissive: '#ffe2b8', glow: 1.0, paint: { metalness: 0.3, roughness: 0.62 }, density: 1 });
  return finish(k, L, mats, (t, blink) => {
    blink('work', pulse(t, 1.7, 0.3, 0.5) ? 1 : 0.3);
    const f = (t % 24) / 24;
    blink('laser', f > 0.9 ? 0.5 + 1.5 * ((f - 0.9) / 0.1) : 0.25);
  });
}

// ── The Shield Gate over Scarif ──

function gate(k) {
  const L = [];
  const RI = 0.335;
  const RO = 0.5;
  const N = 28;
  const PLATE = '#a6abb1';
  const DARK = '#3c4046';
  // the ring's section, from the inner rim out and round
  const prof = [[RI, -0.014], [0.37, -0.026], [0.45, -0.024], [RO - 0.004, -0.012], [RO, 0], [RO - 0.004, 0.012], [0.45, 0.024], [0.37, 0.026], [RI, 0.014], [RI - 0.004, 0], [RI, -0.014]];
  // plated segments with a gap between each, a dark rib standing in each gap
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU;
    L.push(part(arc(prof, a0 + 0.008, TAU / N - 0.016, 5), { color: i % 2 ? PLATE : '#b3b7bc' }));
    L.push(...place([part(new THREE.BoxGeometry(0.018, 0.056, RO - RI - 0.012), { at: [0, 0, (RO + RI) / 2], to: 'metal', color: '#5d6269' })], [0, 0, 0], [0, a0, 0]));
    // raised blocks on both faces of each segment
    for (const s of [-1, 1]) {
      for (let n = 0; n < 3; n++) {
        const r = 0.36 + k.rand() * 0.1;
        const a = a0 + (0.2 + k.rand() * 0.6) * (TAU / N);
        const [w, d, h] = [0.01 + k.rand() * 0.025, 0.008 + k.rand() * 0.02, 0.003 + k.rand() * 0.006];
        const y = s * (0.026 - ((r - 0.37) / 0.08) * 0.002 + h / 2);
        L.push(part(new THREE.BoxGeometry(w, h, d), { at: [sin(a) * r, y, cos(a) * r], rot: [0, a, 0], color: grey(150 + k.rand() * 40) }));
      }
    }
  }
  // turbolaser towers on both faces, round the middle of the ring
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * TAU;
    const s = i % 2 ? 1 : -1;
    const r = 0.415;
    const tower = [
      part(new THREE.CylinderGeometry(0.009, 0.013, 0.03, 8), { at: [0, 0.015, 0], color: PLATE }),
      part(new THREE.BoxGeometry(0.018, 0.009, 0.02), { at: [0, 0.034, 0], color: '#8d9298' }),
      rod([0.004, 0.035, 0.008], [0.004, 0.036, 0.034], 0.0018, 0.0015, { to: 'metal', color: DARK }, 5),
      rod([-0.004, 0.035, 0.008], [-0.004, 0.036, 0.034], 0.0018, 0.0015, { to: 'metal', color: DARK }, 5),
      part(new THREE.BoxGeometry(0.003, 0.003, 0.003), { at: [0, 0.04, -0.006], to: 'glow', color: [6, 0.6, 0.4], mark: 'tower' }),
    ];
    L.push(...place(tower, [sin(a) * r, s * 0.024, cos(a) * r], [s < 0 ? PI : 0, a + PI / 2 + (s < 0 ? PI : 0), 0]));
  }
  // the inner rim: a band of light looking into the hole, and brighter
  // lamps along it; red lights round the outer edge
  L.push(part(new THREE.LatheGeometry([new THREE.Vector2(RI - 0.0045, 0.006), new THREE.Vector2(RI - 0.0045, -0.006)], 96), { to: 'glow', color: [0.9, 1.3, 1.7] }));
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    L.push(part(new THREE.BoxGeometry(0.008, 0.003, 0.002), { at: [sin(a) * (RI - 0.006), 0, cos(a) * (RI - 0.006)], rot: [0, a, 0], to: 'glow', color: [2.4, 2.9, 3.4], mark: i % 2 ? 'rimA' : 'rimB' }));
  }
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) / 24) * TAU;
    L.push(part(new THREE.BoxGeometry(0.004, 0.004, 0.003), { at: [sin(a) * (RO + 0.001), 0, cos(a) * (RO + 0.001)], rot: [0, a, 0], to: 'glow', color: [6, 0.6, 0.4], mark: 'edge' }));
  }
  const mats = materials(k, { plating: { min: 12, base: 214, spread: 14, seam: 0.58, detail: 0.4 }, windows: { rows: 16, often: 0.4, size: [3, 1], lit: 0.6 }, emissive: '#dcecff', glow: 1.0, paint: { metalness: 0.35, roughness: 0.5 }, density: 5 });
  return finish(k, L, mats, (t, blink) => {
    const on = pulse(t, 1.2, 0, 0.5);
    blink('rimA', on ? 1 : 0.55);
    blink('rimB', on ? 0.55 : 1);
    blink('edge', pulse(t, 2, 0, 0.15) ? 1 : 0.15);
    blink('tower', pulse(t, 2.6, 0.4, 0.12) ? 1 : 0.2);
  });
}

// ── Cloud City ──

function cloudcity(k) {
  const L = [];
  const WHITE = '#e4e0d6';
  const CREAM = '#d8cfbd';
  const GREY = '#9a9a98';
  // the disc: its underside a shallow bowl down to the stalk, a lip round the
  // rim, and its top rising gently to the middle
  L.push(part(upright([[0.0001, -0.13], [0.045, -0.13], [0.07, -0.115], [0.2, -0.075], [0.36, -0.04], [0.47, -0.018], [0.5, -0.008], [0.502, 0.004], [0.494, 0.012], [0.46, 0.014], [0.3, 0.022], [0.1, 0.03], [0.0001, 0.032]], 72), { color: CREAM }));
  // rings of darker structure under the disc
  for (const [r, y] of [[0.43, -0.026], [0.3, -0.052], [0.17, -0.088]]) L.push(part(upright([[r + 0.006, y - 0.004], [r + 0.006, y + 0.004], [r - 0.004, y + 0.006]], 72), { to: 'metal', color: '#7d7a74' }));
  // the towers, packed in rings and rising toward the middle
  const top = (r) => 0.03 - (r / 0.5) * 0.016;
  const tall = (r) => 0.012 + 0.11 * max(0, 1 - r / 0.47) ** 1.7;
  for (let r = 0.085; r < 0.48; r += 0.026) {
    const n = Math.floor((TAU * r) / 0.024);
    for (let i = 0; i < n; i++) {
      const a = ((i + k.rand() * 0.6) / n) * TAU;
      const rr = r + (k.rand() - 0.5) * 0.012;
      const h = tall(rr) * (0.45 + k.rand() * 0.75);
      const w = 0.008 + k.rand() * 0.01;
      const x = sin(a) * rr;
      const z = cos(a) * rr;
      const c = k.rand() < 0.7 ? WHITE : CREAM;
      if (k.rand() < 0.45) {
        L.push(part(new THREE.CylinderGeometry(w * 0.5, w * 0.6, h, 7, 1, true), { at: [x, top(rr) + h / 2 - 0.002, z], color: c }));
        L.push(part(new THREE.ConeGeometry(w * 0.52, w * 0.5, 7, 1, true), { at: [x, top(rr) + h + w * 0.25 - 0.002, z], color: c }));
      } else {
        L.push(part(new THREE.BoxGeometry(w, h, w * (0.7 + k.rand() * 0.6)), { at: [x, top(rr) + h / 2 - 0.002, z], rot: [0, a, 0], color: c }));
      }
    }
  }
  // the central spire, with its flanges
  L.push(part(upright([[0.075, 0.025], [0.07, 0.07], [0.055, 0.1], [0.045, 0.13], [0.04, 0.17], [0.03, 0.19], [0.026, 0.23], [0.016, 0.25], [0.009, 0.28], [0.0001, 0.3]], 20), { color: WHITE }));
  for (const [r, y] of [[0.085, 0.06], [0.06, 0.12], [0.046, 0.175], [0.032, 0.225]]) L.push(part(new THREE.CylinderGeometry(r, r, 0.005, 24), { at: [0, y, 0], color: CREAM }));
  // the stalk down to the reactor bulb, and the vanes round it
  L.push(part(new THREE.CylinderGeometry(0.016, 0.026, 0.3, 12, 1, true), { at: [0, -0.27, 0], to: 'metal', color: GREY }));
  for (const y of [-0.17, -0.22, -0.27, -0.32]) L.push(part(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 12), { at: [0, y, 0], to: 'metal', color: '#7a7874' }));
  L.push(part(upright([[0.0001, -0.47], [0.02, -0.465], [0.04, -0.45], [0.052, -0.43], [0.05, -0.41], [0.038, -0.395], [0.02, -0.39]], 18), { color: CREAM }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    L.push(...place([part(plateZY([[-0.01, -0.36], [0.01, -0.36], [0.08, -0.44], [0.075, -0.455], [-0.005, -0.42]], 0.004), { color: WHITE })], [0, 0, 0], [0, a, 0]));
  }
  // lights: a ring of beacons round the rim and one on the spire's tip
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    L.push(part(new THREE.BoxGeometry(0.004, 0.003, 0.004), { at: [sin(a) * 0.5, 0.006, cos(a) * 0.5], to: 'glow', color: [3.2, 2.2, 1.2], mark: i % 2 ? 'a' : 'b' }));
  }
  L.push(ball(0.003, [0, 0.302, 0], 1, { to: 'glow', color: [6, 0.6, 0.4], mark: 'tip' }, 6));
  const mats = materials(k, { plating: { min: 10, base: 228, spread: 10, seam: 0.72, detail: 0.25 }, windows: { rows: 26, often: 0.65, size: [2, 2], lit: 0.75, gap: 2 }, emissive: '#ffc77a', glow: 1.25, paint: { metalness: 0.15, roughness: 0.55 }, density: 9 });
  return finish(k, L, mats, (t, blink) => {
    const on = pulse(t, 2.4, 0, 0.5);
    blink('a', on ? 1 : 0.3);
    blink('b', on ? 0.3 : 1);
    blink('tip', pulse(t, 1.6, 0, 0.12) ? 1 : 0.1);
  });
}

// ── EF76 Nebulon-B escort frigate ──

function nebulon(k) {
  const L = [];
  const WHITE = '#d5d4cf';
  const GREY = '#a7a9ab';
  const DARK = '#3d4045';
  const beam = (a, b, w, d, o) => L.push(between(new THREE.BoxGeometry(w, 1, d), a, b, o));
  // the upper forward hull, slab-sided, tapering to its bow, a ledge along
  // each flank
  L.push(part(loft([
    { z: -0.03, pts: box8(0.08, 0.06, 0.012, 0.03) },
    { z: 0.34, pts: box8(0.096, 0.066, 0.014, 0.03) },
    { z: 0.45, pts: box8(0.082, 0.054, 0.014, 0.032) },
    { z: 0.5, pts: box8(0.046, 0.03, 0.008, 0.034) },
  ]), { color: WHITE }));
  for (const s of [-1, 1]) L.push(part(loft([{ z: 0.02, pts: box8(0.012, 0.012, 0.003, 0.004) }, { z: 0.42, pts: box8(0.012, 0.012, 0.003, 0.004) }]), { at: [s * 0.05, 0, 0], color: GREY }));
  // the command tower forward on top: stepped blocks up to the bridge
  L.push(part(loft([{ z: 0.2, pts: trap8(0.07, 0.05, 0.026, 0.006, 0.074) }, { z: 0.43, pts: trap8(0.064, 0.044, 0.026, 0.006, 0.074) }]), { color: WHITE }));
  L.push(part(loft([{ z: 0.28, pts: trap8(0.046, 0.032, 0.026, 0.005, 0.1) }, { z: 0.41, pts: trap8(0.042, 0.028, 0.022, 0.005, 0.099) }]), { color: GREY }));
  L.push(part(new THREE.BoxGeometry(0.03, 0.006, 0.002), { at: [0, 0.103, 0.411], to: 'glass' }));
  L.push(rod([0, 0.11, 0.34], [0, 0.15, 0.33], 0.0015, 0.0008, { to: 'metal', color: DARK }, 4));
  // the thin spar dropping from under it, down and forward, to the lower hull
  beam([0, 0.004, 0.02], [0, -0.09, 0.2], 0.018, 0.032, { color: GREY });
  beam([0, -0.004, 0.03], [0, -0.085, 0.18], 0.022, 0.012, { to: 'metal', color: DARK });
  // the lower hull: a long pod hung below and forward
  L.push(part(loft([
    { z: 0.14, pts: box8(0.05, 0.05, 0.012, -0.12) },
    { z: 0.21, pts: box8(0.074, 0.066, 0.016, -0.12) },
    { z: 0.44, pts: box8(0.072, 0.062, 0.016, -0.12) },
    { z: 0.52, pts: box8(0.036, 0.03, 0.008, -0.12) },
  ]), { color: WHITE }));
  L.push(part(new THREE.BoxGeometry(0.077, 0.008, 0.2), { at: [0, -0.12, 0.32], color: GREY }));
  // the boom back to the engines
  L.push(part(loft([{ z: -0.37, pts: box8(0.018, 0.022, 0.005, 0.032) }, { z: -0.01, pts: box8(0.018, 0.022, 0.005, 0.032) }]), { color: GREY }));
  for (const s of [-1, 1]) L.push(rod([s * 0.01, 0.022, -0.36], [s * 0.01, 0.022, -0.02], 0.002, 0.002, { to: 'metal', color: DARK }, 4));
  // the engine block: tall, with fins above and below, five engines astern
  L.push(part(loft([
    { z: -0.48, pts: box8(0.09, 0.12, 0.02, 0.025) },
    { z: -0.38, pts: box8(0.09, 0.12, 0.02, 0.025) },
    { z: -0.34, pts: box8(0.05, 0.07, 0.012, 0.03) },
  ]), { color: WHITE }));
  L.push(part(plateZY([[-0.47, 0.08], [-0.39, 0.08], [-0.42, 0.12], [-0.465, 0.12]], 0.008), { color: GREY }));
  L.push(part(plateZY([[-0.47, -0.03], [-0.39, -0.03], [-0.43, -0.07], [-0.465, -0.07]], 0.008), { color: GREY }));
  for (const [x, y, r] of [[0, 0.058, 0.021], [-0.027, 0.025, 0.017], [0.027, 0.025, 0.017], [-0.02, -0.008, 0.015], [0.02, -0.008, 0.015]]) nozzle(L, [x, y], -0.5, r, 0.03, { glow: [1.7, 2.4, 4.2] });
  L.push(ball(0.004, [0.05, 0.04, 0.3], 1, { to: 'glow', color: [6, 0.5, 0.4], mark: 'lights' }, 6));
  L.push(ball(0.004, [-0.05, 0.04, 0.3], 1, { to: 'glow', color: [0.5, 4, 1.2], mark: 'lights' }, 6));
  const mats = materials(k, { plating: { min: 12, base: 222, spread: 12, seam: 0.6, detail: 0.35 }, windows: { rows: 18, often: 0.35, size: [2, 1], lit: 0.7 }, emissive: '#ffe6c4', glow: 1.0, density: 6 });
  return finish(k, L, mats, (t, blink) => blink('lights', pulse(t, 2, 0, 0.12) ? 1 : 0.2));
}

// ── Sphyrna-class Hammerhead corvette ──

function hammerhead(k) {
  const L = [];
  const WHITE = '#d9d6cd';
  const RED = '#a8382d';
  const GREY = '#9b9d9f';
  const DARK = '#3d4045';
  // the main hull: tall and boxy, its top stepped up in the middle
  L.push(part(loft([
    { z: -0.47, pts: box8(0.12, 0.12, 0.02, 0) },
    { z: -0.1, pts: box8(0.13, 0.13, 0.024, 0) },
    { z: 0.04, pts: box8(0.1, 0.1, 0.02, 0.005) },
    { z: 0.12, pts: box8(0.05, 0.05, 0.012, 0.012) },
  ]), { color: WHITE }));
  L.push(part(loft([{ z: -0.4, pts: trap8(0.08, 0.05, 0.03, 0.006, 0.075) }, { z: -0.05, pts: trap8(0.07, 0.04, 0.026, 0.006, 0.072) }, { z: 0.06, pts: trap8(0.04, 0.026, 0.012, 0.004, 0.064) }]), { color: GREY }));
  // red stripes along each flank and over the top
  for (const s of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.002, 0.014, 0.36), { at: [s * 0.0655, 0.022, -0.26], color: RED }));
    L.push(part(new THREE.BoxGeometry(0.002, 0.006, 0.36), { at: [s * 0.0655, 0.002, -0.26], color: RED }));
  }
  // the long thin neck
  L.push(part(loft([{ z: 0.08, pts: box8(0.036, 0.04, 0.008, 0.012) }, { z: 0.43, pts: box8(0.03, 0.032, 0.007, 0.012) }]), { color: WHITE }));
  L.push(part(new THREE.BoxGeometry(0.031, 0.005, 0.33), { at: [0, 0.03, 0.25], color: RED }));
  // the hammerhead: a flat bridge right across the bow, red along its front
  L.push(part(loft([
    { z: 0.41, pts: box8(0.2, 0.026, 0.008, 0.012) },
    { z: 0.46, pts: box8(0.27, 0.03, 0.01, 0.012) },
    { z: 0.5, pts: box8(0.25, 0.022, 0.008, 0.012) },
  ]), { color: WHITE }));
  L.push(part(new THREE.BoxGeometry(0.24, 0.006, 0.006), { at: [0, 0.0255, 0.48], color: RED }));
  L.push(part(new THREE.BoxGeometry(0.2, 0.005, 0.002), { at: [0, 0.014, 0.5005], to: 'glass' }));
  for (const s of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.008, 0.032, 0.05), { at: [s * 0.135, 0.012, 0.462], color: RED }));
  // the engines: one big one and two beside it, under a cowl
  nozzle(L, [0, 0.01], -0.5, 0.04, 0.04, { glow: [1.7, 2.5, 4.4], seg: 16 });
  for (const s of [-1, 1]) nozzle(L, [s * 0.042, -0.025], -0.495, 0.026, 0.035, { glow: [1.7, 2.5, 4.4] });
  L.push(rod([0, 0.07, -0.3], [0, 0.11, -0.32], 0.002, 0.001, { to: 'metal', color: DARK }, 4));
  L.push(ball(0.004, [0.14, 0.012, 0.462], 1, { to: 'glow', color: [6, 0.5, 0.4], mark: 'lights' }, 6));
  L.push(ball(0.004, [-0.14, 0.012, 0.462], 1, { to: 'glow', color: [0.5, 4, 1.2], mark: 'lights' }, 6));
  const mats = materials(k, { plating: { min: 12, base: 222, spread: 12, seam: 0.6, detail: 0.35 }, windows: { rows: 14, often: 0.35, size: [2, 1], lit: 0.65 }, emissive: '#ffe6c4', glow: 0.9, density: 6 });
  return finish(k, L, mats, (t, blink) => blink('lights', pulse(t, 2, 0.3, 0.12) ? 1 : 0.2));
}

// ── RZ-1 A-wing ──

function awing(k) {
  const L = [];
  const WHITE = '#dcd9d1';
  const RED = '#b0322a';
  const GREY = '#8c8f93';
  const DARK = '#36393e';
  // the wedge: flat underneath, its top sloping up to a low ridge
  const sec = (z, w, h) => ({ z, pts: [[w * 0.5, -h * 0.25], [w * 0.47, 0], [w * 0.14, h * 0.6], [-w * 0.14, h * 0.6], [-w * 0.47, 0], [-w * 0.5, -h * 0.25], [-w * 0.4, -h * 0.4], [w * 0.4, -h * 0.4]] });
  L.push(part(loft([sec(-0.34, 0.46, 0.1), sec(-0.1, 0.4, 0.1), sec(0.1, 0.29, 0.085)]), { color: WHITE }));
  L.push(part(loft([sec(0.1, 0.29, 0.085), sec(0.3, 0.17, 0.06), sec(0.46, 0.06, 0.03), sec(0.5, 0.02, 0.014)]), { color: RED }));
  // red stripes back along the wedge, and a dark vent in its tail
  for (const s of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.022, 0.004, 0.3), { at: [s * 0.13, 0.028, -0.12], rot: [0, s * -0.17, s * -0.18], color: RED }));
  L.push(part(new THREE.BoxGeometry(0.16, 0.03, 0.01), { at: [0, 0.01, -0.344], to: 'metal', color: DARK }));
  // the cockpit: a canopy on the ridge, framed, and the hump behind it
  L.push(ball(1, [0, 0.036, 0.13], [0.06, 0.04, 0.12], { to: 'glass' }, 16));
  L.push(rod([0, 0.075, 0.07], [0, 0.06, 0.24], 0.004, 0.004, { color: GREY }, 5));
  L.push(ball(1, [0, 0.04, -0.04], [0.07, 0.035, 0.12], { color: WHITE }, 12));
  // the engines out at the back corners, with their fins and the cannons
  const side = [
    part(turned([[0.045, -0.46], [0.056, -0.42], [0.06, -0.3], [0.058, -0.16], [0.045, -0.11], [0.0001, -0.1]], 16), { at: [0.26, 0, 0], color: WHITE }),
    part(turned([[0.0605, -0.3], [0.0605, -0.25]], 16), { at: [0.26, 0, 0], color: RED }),
    part(plateZY([[-0.44, 0.04], [-0.33, 0.04], [-0.42, 0.13], [-0.47, 0.13]], 0.008, 0.002), { at: [0.26, 0.02, 0], color: WHITE }),
    part(plateZY([[-0.44, -0.04], [-0.33, -0.04], [-0.42, -0.12], [-0.47, -0.12]], 0.008, 0.002), { at: [0.26, -0.02, 0], color: RED }),
    part(new THREE.BoxGeometry(0.03, 0.03, 0.08), { at: [0.33, 0, -0.17], color: GREY }),
    rod([0.335, 0, -0.14], [0.335, 0, 0.12], 0.009, 0.007, { to: 'metal', color: DARK }, 6),
    rod([0.335, 0, 0.12], [0.335, 0, 0.18], 0.004, 0.004, { to: 'metal', color: DARK }, 5),
  ];
  nozzle(side, [0.26, 0], -0.5, 0.046, 0.05, { glow: [1.7, 2.5, 4.6], seg: 16 });
  L.push(...side, ...mirror(side));
  const mats = materials(k, { plating: { min: 16, base: 228, spread: 10, seam: 0.62, detail: 0.3 }, metal: { color: '#c0c3c7' }, density: 6 });
  return finish(k, L, mats);
}

// ── BTL Y-wing ──

function ywing(k) {
  const L = [];
  const HULL = '#d2cec4';
  const GOLD = '#d4a634';
  const GREY = '#8f9195';
  const DARK = '#3a3d42';
  // the cockpit head, sloping down to its nose, a collar behind it
  L.push(part(loft([
    { z: 0.1, pts: box8(0.12, 0.1, 0.035, 0.002) },
    { z: 0.3, pts: box8(0.115, 0.088, 0.032, -0.004) },
    { z: 0.42, pts: box8(0.092, 0.06, 0.024, -0.014) },
    { z: 0.5, pts: box8(0.05, 0.026, 0.01, -0.024) },
  ]), { color: HULL }));
  L.push(part(turned([[0.07, 0.08], [0.074, 0.09], [0.074, 0.11], [0.066, 0.12]], 14), { to: 'metal', color: GREY }));
  // Gold Squadron's stripes on the nose
  for (const x of [-0.013, 0.013]) L.push(part(new THREE.BoxGeometry(0.01, 0.004, 0.11), { at: [x, 0.023, 0.392], rot: [0.21, 0, 0], color: GOLD }));
  // the canopy, and the ion turret behind it
  L.push(ball(1, [0, 0.04, 0.29], [0.045, 0.03, 0.07], { to: 'glass' }, 14));
  L.push(part(new THREE.CylinderGeometry(0.018, 0.022, 0.012, 12), { at: [0, 0.056, 0.18], color: GREY }));
  L.push(ball(0.016, [0, 0.064, 0.18], [1, 0.7, 1], { color: HULL }, 10));
  for (const s of [-1, 1]) L.push(rod([s * 0.006, 0.068, 0.18], [s * 0.006, 0.07, 0.26], 0.0028, 0.0022, { to: 'metal', color: DARK }, 5));
  // the twin cannons under the nose
  for (const s of [-1, 1]) L.push(rod([s * 0.03, -0.02, 0.42], [s * 0.03, -0.024, 0.52], 0.005, 0.004, { to: 'metal', color: DARK }, 5));
  // the bare skeleton between head and crossbar: spars, pipes and tanks
  for (const [x, y] of [[0.032, 0.026], [-0.032, 0.026], [0.032, -0.026], [-0.032, -0.026]]) L.push(rod([x, y, -0.15], [x, y, 0.1], 0.0045, 0.0045, { to: 'metal', color: GREY }, 5));
  for (let z = -0.12; z < 0.1; z += 0.055) {
    L.push(rod([0.032, 0.026, z], [-0.032, -0.026, z + 0.05], 0.003, 0.003, { to: 'metal', color: DARK }, 4));
    L.push(rod([0.032, -0.026, z], [-0.032, 0.026, z + 0.05], 0.003, 0.003, { to: 'metal', color: DARK }, 4));
  }
  L.push(rod([0, 0, -0.16], [0, 0, 0.1], 0.013, 0.013, { color: GREY }, 8));
  L.push(rod([0.014, 0.012, -0.1], [0.014, 0.012, 0.06], 0.009, 0.009, { to: 'metal', color: '#6d7075' }, 8));
  L.push(rod([-0.016, -0.01, -0.08], [-0.016, -0.01, 0.05], 0.008, 0.008, { color: HULL }, 8));
  for (const s of [-1, 1]) L.push(part(turned([[0.0001, -0.04], [0.006, -0.032], [0.006, 0.012], [0.0001, 0.02]], 6), { at: [s * 0.022, 0.03, 0.01], color: GOLD }));
  // the rear of the body on the crossbar, with the astromech in its socket
  L.push(part(loft([{ z: -0.29, pts: box8(0.09, 0.07, 0.02, 0) }, { z: -0.14, pts: box8(0.1, 0.075, 0.022, 0) }]), { color: HULL }));
  L.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), { at: [0, 0.046, -0.2], color: '#e6e6e8' }));
  L.push(ball(0.02, [0, 0.062, -0.2], [1, 0.8, 1], { color: '#5b7fb8' }, 10));
  L.push(part(new THREE.BoxGeometry(0.27, 0.02, 0.12), { at: [0, 0, -0.21], color: HULL }));
  // the nacelles: rounded intakes, a gold band, and four vanes round each exhaust
  const nacelle = [
    part(turned([[0.026, -0.43], [0.036, -0.41], [0.04, -0.36], [0.041, 0.06], [0.038, 0.12], [0.026, 0.155], [0.0001, 0.17]], 18), { color: HULL }),
    part(turned([[0.0418, 0.04], [0.0418, 0.08]], 18), { color: GOLD }),
    part(turned([[0.0418, -0.32], [0.0418, -0.3]], 18), { to: 'metal', color: GREY }),
    part(turned([[0.0418, -0.08], [0.0418, -0.06]], 18), { to: 'metal', color: GREY }),
  ];
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i * PI) / 2;
    nacelle.push(...place([part(new THREE.BoxGeometry(0.003, 0.03, 0.13), { at: [0, 0.048, -0.43], color: GREY })], [0, 0, 0], [0, 0, a]));
  }
  nozzle(nacelle, [0, 0], -0.5, 0.027, 0.07, { glow: [1.8, 2.6, 4.6], seg: 16 });
  L.push(...place(nacelle, [0.135, 0, 0]), ...place(nacelle, [-0.135, 0, 0]));
  const mats = materials(k, { plating: { min: 14, base: 226, spread: 12, seam: 0.6, detail: 0.35 }, density: 6 });
  return finish(k, L, mats);
}

// ── A/SF-01 B-wing ──

function bwing(k) {
  const L = [];
  const GREY = '#b3b1aa';
  const RED = '#c0532c';
  const DARK = '#3a3d42';
  const MID = '#8d8f92';
  // the main foil, upright: thin, its chord narrowing toward the lower end
  L.push(part(plateZY([[0.3, 0.92], [0.33, 0.3], [0.22, -1.38], [-0.12, -1.38], [-0.3, 0.3], [-0.26, 0.92]], 0.075, 0.015), { color: GREY }));
  L.push(part(plateZY([[0.31, 0.5], [0.33, 0.3], [0.23, -1.3], [0.19, -1.3], [0.28, 0.3], [0.27, 0.5]], 0.08, 0.01), { color: RED }));
  for (const y of [-0.9, -1.1]) L.push(part(new THREE.BoxGeometry(0.064, 0.04, 0.3), { at: [0, y, 0.06 - (y + 0.9) * 0.1], color: RED }));
  L.push(part(new THREE.BoxGeometry(0.062, 1.6, 0.03), { at: [0, -0.5, -0.18], rot: [-0.04, 0, 0], to: 'metal', color: MID }));
  // the weapons pod at its lower end: a heavy cannon and two lighter ones
  L.push(part(loft([{ z: -0.26, pts: box8(0.16, 0.26, 0.04, -1.48) }, { z: 0.24, pts: box8(0.16, 0.26, 0.04, -1.48) }, { z: 0.31, pts: box8(0.1, 0.18, 0.025, -1.48) }]), { color: GREY }));
  L.push(part(new THREE.BoxGeometry(0.165, 0.05, 0.2), { at: [0, -1.4, -0.05], color: RED }));
  L.push(rod([0, -1.48, 0.28], [0, -1.48, 0.5], 0.03, 0.024, { to: 'metal', color: DARK }, 8));
  for (const y of [-1.42, -1.54]) L.push(rod([0.04, y, 0.2], [0.04, y, 0.46], 0.012, 0.01, { to: 'metal', color: DARK }, 6));
  // the engine block across the foil below the cockpit, its four exhausts
  L.push(part(loft([{ z: -0.42, pts: box8(0.26, 0.3, 0.05, 0.62) }, { z: 0.1, pts: box8(0.28, 0.32, 0.05, 0.62) }, { z: 0.22, pts: box8(0.18, 0.22, 0.04, 0.62) }]), { color: GREY }));
  L.push(part(new THREE.BoxGeometry(0.29, 0.05, 0.26), { at: [0, 0.62, -0.05], color: RED }));
  for (const [x, y] of [[0.065, 0.69], [-0.065, 0.69], [0.065, 0.55], [-0.065, 0.55]]) nozzle(L, [x, y], -0.5, 0.055, 0.09, { glow: [1.7, 2.5, 4.6], seg: 16 });
  // the S-foils, open across it, with a cannon on each tip
  const foil = [
    part(plateXZ([[0.12, -0.32], [0.78, -0.14], [0.8, 0.08], [0.12, 0.18]], 0.055, 0.012), { at: [0, 0.62, 0], color: GREY }),
    part(new THREE.BoxGeometry(0.12, 0.06, 0.2), { at: [0.7, 0.62, -0.02], color: RED }),
    part(loft([{ z: -0.2, pts: box8(0.07, 0.1, 0.02, 0) }, { z: 0.14, pts: box8(0.07, 0.1, 0.02, 0) }, { z: 0.2, pts: box8(0.04, 0.06, 0.012, 0) }]), { at: [0.83, 0.62, 0], color: MID }),
    rod([0.83, 0.62, 0.18], [0.83, 0.62, 0.46], 0.016, 0.012, { to: 'metal', color: DARK }, 6),
  ];
  L.push(...foil, ...mirror(foil));
  // the cockpit pod at the top, on its gyro collar
  L.push(part(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 14), { at: [0, 0.82, -0.05], color: MID }));
  L.push(part(turned([[0.0001, -0.42], [0.08, -0.4], [0.13, -0.32], [0.14, 0.1], [0.12, 0.28], [0.08, 0.4], [0.0001, 0.44]], 16), { at: [0, 1.0, 0], scale: [0.9, 1, 1], color: GREY }));
  L.push(ball(1, [0, 1.02, 0.3], [0.09, 0.09, 0.12], { to: 'glass' }, 14));
  L.push(part(turned([[0.142, -0.1], [0.142, -0.02]], 16), { at: [0, 1.0, 0], scale: [0.9, 1, 1], color: RED }));
  for (const s of [-1, 1]) L.push(rod([s * 0.08, 0.95, 0.2], [s * 0.08, 0.95, 0.44], 0.008, 0.006, { to: 'metal', color: DARK }, 5));
  const mats = materials(k, { plating: { min: 14, base: 222, spread: 12, seam: 0.6, detail: 0.35 }, density: 4 });
  return finish(k, L, mats);
}

// ── UT-60D U-wing ──

function uwing(k) {
  const L = [];
  const HULL = '#97a2ad';
  const LIGHT = '#b8c0c7';
  const DARK = '#3a3e44';
  const MID = '#6c7680';
  // the troop compartment: a blunt, chamfered box, wide and deep, its big
  // doors dark on the flanks
  L.push(part(loft([
    { z: -0.34, pts: box8(0.15, 0.13, 0.035, 0) },
    { z: 0.24, pts: box8(0.16, 0.14, 0.036, 0) },
    { z: 0.38, pts: box8(0.14, 0.11, 0.032, -0.014) },
    { z: 0.46, pts: box8(0.1, 0.06, 0.02, -0.03) },
  ]), { color: HULL }));
  for (const s of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.003, 0.08, 0.2), { at: [s * 0.0805, -0.004, 0.04], to: 'metal', color: MID }));
    L.push(part(new THREE.BoxGeometry(0.004, 0.012, 0.5), { at: [s * 0.078, -0.06, -0.04], color: LIGHT }));
  }
  L.push(part(new THREE.BoxGeometry(0.09, 0.008, 0.46), { at: [0, 0.071, -0.06], color: LIGHT }));
  // the canopy wrapped round the blunt nose
  L.push(part(loft([{ z: 0.3, pts: box8(0.126, 0.07, 0.024, 0.026) }, { z: 0.39, pts: box8(0.12, 0.05, 0.02, 0.012) }, { z: 0.465, pts: box8(0.085, 0.022, 0.009, -0.012) }]), { to: 'glass' }));
  // the engines at the back, the wings swept forward from them in a U, a
  // cannon on each tip
  const side = [
    part(turned([[0.042, -0.47], [0.052, -0.44], [0.055, -0.22], [0.048, -0.17], [0.03, -0.15], [0.0001, -0.145]], 16), { at: [0.1, 0.05, 0], color: LIGHT }),
    part(turned([[0.0555, -0.36], [0.0555, -0.32]], 16), { at: [0.1, 0.05, 0], to: 'metal', color: MID }),
    part(plateXZ([[0.13, -0.47], [0.2, -0.47], [0.31, 0.08], [0.31, 0.27], [0.255, 0.29], [0.13, -0.2]], 0.016, 0.004), { at: [0, 0.05, 0], color: HULL }),
    part(plateXZ([[0.205, -0.16], [0.225, -0.16], [0.288, 0.14], [0.268, 0.14]], 0.018, 0.002), { at: [0, 0.05, 0], color: MID }),
    part(new THREE.BoxGeometry(0.02, 0.032, 0.14), { at: [0.31, 0.05, 0.21], color: LIGHT }),
    rod([0.31, 0.05, 0.28], [0.31, 0.05, 0.38], 0.0065, 0.005, { to: 'metal', color: DARK }, 5),
  ];
  nozzle(side, [0.1, 0.05], -0.5, 0.044, 0.05, { glow: [1.7, 2.5, 4.6], seg: 16 });
  L.push(...side, ...mirror(side));
  const mats = materials(k, { plating: { min: 14, base: 220, spread: 13, seam: 0.6, detail: 0.35 }, density: 6 });
  return finish(k, L, mats);
}

export const FLEET = { moncal, nebulon, awing, ywing, bwing, uwing, executor, hammerhead, deathstar2, gate, cloudcity };
export const INFO = {
  moncal: { name: 'Mon Calamari cruiser', meters: 1200, side: 'rebel' },
  nebulon: { name: 'Nebulon-B frigate', meters: 300, side: 'rebel' },
  awing: { name: 'A-wing', meters: 9.6, side: 'rebel' },
  ywing: { name: 'Y-wing', meters: 23.4, side: 'rebel' },
  bwing: { name: 'B-wing', meters: 16.9, side: 'rebel' },
  uwing: { name: 'U-wing', meters: 25, side: 'rebel' },
  executor: { name: 'Super Star Destroyer', meters: 19000, side: 'empire' },
  hammerhead: { name: 'Hammerhead corvette', meters: 315, side: 'rebel' },
  deathstar2: { name: 'Death Star II', meters: 160000, side: 'empire' },
  gate: { name: 'Scarif Shield Gate', meters: 1700, side: 'empire' },
  cloudcity: { name: 'Cloud City', meters: 16000, side: 'neutral' },
};
