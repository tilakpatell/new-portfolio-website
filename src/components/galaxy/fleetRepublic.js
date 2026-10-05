// The prequel era's ships: the Separatists' droid fleet, Naboo's, the
// Republic's and the Jedi's (see universe/trafficModels.js for how a model is
// put together and what it returns).
//
// vulture: a vulture droid starfighter in flight mode, the narrow head with
// its orange eye lights out in front of a short core, and the four long
// tapering wings (its legs, when it walks) splayed in an X seen from the
// front, a blaster cannon at each wing's root; tan plating, brown panels.
// trifighter: a droid tri-fighter, the round head with its glowing red
// sensor eye in front, a slim body behind it and three long blade-like arms
// at 120 degrees (one straight up), swept back, each with a cannon at its tip;
// dark grey-blue.
// lucrehulk: a Trade Federation battleship (a droid control ship), the huge
// flat ring open at the front between two arms that end in hangar mouths,
// the core sphere in the middle joined to the ring at the back, towers and
// antennas top and bottom of the sphere, lit hangar slits all along the
// inside of the arms and engines round the back of the ring; tan-grey.
// n1: a Naboo N-1 starfighter, bright yellow with chrome trim, the long
// chrome needle of a nose, the cockpit and the astromech behind it, two long
// thin engines out on short wings, each ending in a long spike behind.
// nubian: a J-type 327 Nubian royal starship, all mirror chrome: a long
// slim streamlined hull, swept-back wings each carrying a big engine pod and a
// long tapering tail.
// delta7: a Delta-7 Jedi starfighter, a flat arrowhead wedge with a raised
// spine, its cockpit off to starboard near the back and the astromech socket
// to port; red over white.
// arc170: an ARC-170, a long fuselage with the canopy forward, broad wings
// each carrying a long laser cannon out in front, and at the back of each wing
// the split tail fins open up and down; white with Republic red.
// acclamator: an Acclamator assault ship, a stubby, tall wedge with slab
// sides, the slab-sided command tower astern, the big hangar bays in its
// belly and four engines; grey with Republic red down its edges.
// coreship: a Separatist core ship, a great sphere banded with plating, a
// ring of thrusters round its underside, landing claws below and a small
// antenna on top; tan-grey.
// munificent: a Munificent-class frigate, a long thin hull standing on its
// edge, tall at the bow, where the great comms array bulges above and below,
// a spine all along and the engines astern; grey-blue.
//
// Every model points its nose along +z with +y up, so starboard is -x.

import * as THREE from 'three';
import { part, place, mirror, rod, meshes, blinker, loft, box8, trap8, plateXZ, plateZY, turned, upright, ball, panelTexture, standard, glowMaterial, flicker, pulse } from '../universe/trafficKit';

const { PI, sin, cos, atan2 } = Math;

// Turned about y through only part of a turn, from phi0 for span (phi 0 is
// the nose, +z; PI / 2 is +x). The profile is [[r, y], …] bottom to top.
const arc = (profile, phi0, span, seg = 8) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, phi0, span);

// The usual four materials: plated paint, bare metal, glass and the glow.
function kitMats(k, { plating = {}, paint = {}, metal = {}, glass = '#0d1a20', density = 4 } = {}) {
  const m = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 218, spread: 14, seam: 0.6, detail: 0.3, ...plating })), metalness: 0.3, roughness: 0.48, ...paint }),
    metal: standard(k, { metalness: 0.7, roughness: 0.4, ...metal }),
    glass: standard(k, { color: glass, metalness: 0.9, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
  m.paint.userData.density = density;
  return m;
}

// An engine facing back from z: its housing (a short tube with a lip) and
// the glow set into it.
function nozzle(L, x, y, z, r, glow, o = {}) {
  const d = r * (o.depth ?? 0.7);
  const seg = o.seg ?? 14;
  L.push(part(turned([[r * 0.8, z + d], [r * 0.8, z + r * 0.15], [r, z], [r * 1.15, z + r * 0.2], [r * 1.15, z + d]], seg), { at: [x, y, 0], to: 'metal', color: o.color ?? '#3b3e44' }));
  L.push(part(new THREE.CircleGeometry(r * 0.8, seg), { at: [x, y, z + r * 0.12], rot: [0, PI, 0], to: 'glow', color: glow, mark: o.mark }));
}

const finish = (k, L, mats, update) => {
  const M = meshes(k, L, mats);
  return { root: Object.values(M), update: (t) => update(t, M) };
};

// ── Separatists ──

// Vulture droid, in flight mode.
function vulture(k) {
  const TAN = '#bba585';
  const BROWN = '#7f6852';
  const DARK = '#3d362f';
  const L = [];
  // the body: the engine tail, the core the wings hinge on, the long narrow
  // head in front
  L.push(
    part(
      loft([
        { z: -0.5, pts: box8(0.07, 0.065, 0.02) },
        { z: -0.44, pts: box8(0.13, 0.12, 0.03) },
        { z: -0.3, pts: box8(0.2, 0.17, 0.045) },
        { z: 0.04, pts: box8(0.2, 0.17, 0.045) },
        { z: 0.16, pts: box8(0.13, 0.12, 0.03) },
        { z: 0.42, pts: box8(0.095, 0.085, 0.024, -0.006) },
        { z: 0.5, pts: box8(0.04, 0.035, 0.01, -0.016) },
      ]),
      { color: TAN },
    ),
  );
  // ribs across the head and the core, and the dark seam where they meet
  for (const z of [0.2, 0.25, 0.3, 0.35]) {
    const u = (z - 0.16) / 0.26;
    L.push(part(new THREE.BoxGeometry(0.07 - 0.03 * u, 0.006, 0.012), { at: [0, 0.06 * (1 - u) + 0.0365 * u + 0.002, z], to: 'metal', color: DARK }));
  }
  L.push(part(new THREE.BoxGeometry(0.202, 0.16, 0.012), { at: [0, 0, 0.1], to: 'metal', color: DARK }));
  for (const sy of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.08, 0.012, 0.24), { at: [0, sy * 0.086, -0.14], color: BROWN }));
  // the eyes: orange lights down each side of the head and two at its tip
  for (const sx of [-1, 1]) {
    for (const z of [0.34, 0.39]) L.push(part(new THREE.BoxGeometry(0.008, 0.016, 0.026), { at: [sx * 0.05, 0.008, z], to: 'glow', color: [4.4, 1.1, 0.18] }));
    L.push(part(new THREE.BoxGeometry(0.012, 0.012, 0.024), { at: [sx * 0.014, 0.002, 0.488], to: 'glow', color: [4.4, 1.1, 0.18] }));
  }
  // a wing, from its hinge out along x: tapering, its tip squared off, a
  // brown panel and a dark tip on both faces, a ridge out along it and the
  // blaster cannon at its root
  const outline = [[0, -0.3], [0, 0.14], [0.3, 0.1], [0.8, 0.02], [0.96, -0.04], [0.99, -0.09], [0.96, -0.18], [0.8, -0.21], [0.56, -0.22], [0.42, -0.27], [0.18, -0.3]];
  const wing = [
    part(plateXZ(outline, 0.026, 0.006), { color: TAN }),
    part(plateXZ([[0.16, -0.24], [0.16, 0.06], [0.74, 0.0], [0.74, -0.17], [0.5, -0.2]], 0.031), { color: BROWN }),
    part(plateXZ([[0.84, -0.01], [0.95, -0.05], [0.98, -0.09], [0.95, -0.17], [0.84, -0.19]], 0.03), { to: 'metal', color: DARK }),
    part(plateXZ([[0.6, -0.08], [0.88, -0.09], [0.88, -0.11], [0.6, -0.11]], 0.034), { to: 'metal', color: DARK }),
    rod([0.04, 0.014, -0.06], [0.92, 0.012, -0.1], 0.008, 0.005, { color: TAN }, 6),
    rod([0.04, -0.014, -0.06], [0.92, -0.012, -0.1], 0.008, 0.005, { color: TAN }, 6),
    part(new THREE.CylinderGeometry(0.034, 0.034, 0.07, 12), { at: [0.01, 0, -0.06], rot: [0, 0, PI / 2], to: 'metal', color: DARK }),
    part(new THREE.BoxGeometry(0.05, 0.042, 0.13), { at: [0.13, 0, 0.03], color: TAN }),
    rod([0.13, 0, 0.09], [0.13, 0, 0.27], 0.012, 0.009, { to: 'metal', color: DARK }, 8),
    rod([0.13, 0, 0.255], [0.13, 0, 0.275], 0.015, 0.015, { to: 'metal', color: DARK }, 8),
  ];
  const right = [...place(wing, [0.09, 0.034, -0.1], [0, 0, 0.44]), ...place(wing, [0.09, -0.034, -0.1], [0, 0, -0.44])];
  L.push(...right, ...mirror(right));
  nozzle(L, 0, 0, -0.5, 0.032, [3.4, 1.7, 0.7]);
  const mats = kitMats(k, { plating: { base: 214, spread: 18, seam: 0.56, detail: 0.4, min: 10 }, density: 6 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(flicker(t, 3)));
}

// Droid tri-fighter.
function trifighter(k) {
  const GREY = '#677487';
  const PALE = '#8893a2';
  const DARK = '#2b3139';
  const L = [];
  // the body: the engine at the back, the slim neck and the round head
  L.push(part(turned([[0.0001, -0.46], [0.045, -0.46], [0.058, -0.4], [0.068, -0.22], [0.09, -0.09], [0.135, -0.03], [0.158, 0.04], [0.162, 0.1], [0.152, 0.16], [0.125, 0.205], [0.08, 0.235], [0.0001, 0.245]], 22), { color: GREY }));
  L.push(part(turned([[0.163, 0.06], [0.163, 0.09]], 22), { to: 'metal', color: DARK }));
  L.push(part(turned([[0.072, -0.3], [0.072, -0.26]], 16), { to: 'metal', color: DARK }));
  // the sensor eye in its housing
  L.push(part(new THREE.CylinderGeometry(0.066, 0.078, 0.06, 22), { at: [0, 0, 0.235], rot: [PI / 2, 0, 0], to: 'metal', color: DARK }));
  L.push(part(new THREE.CircleGeometry(0.052, 22), { at: [0, 0, 0.2655], to: 'glow', color: [4.6, 0.4, 0.28] }));
  L.push(part(new THREE.CircleGeometry(0.022, 14), { at: [0, 0, 0.2665], to: 'glow', color: [6, 2.4, 1.6] }));
  // an arm, out along x: a blade swept back, a dark groove down it, and the
  // cannon at its tip
  const sec = (x, chord, zc, th) => ({ z: x, pts: box8(chord, th, th * 0.3).map(([u, v]) => [u - zc, v]) });
  const arm = [
    part(loft([sec(0.05, 0.3, -0.1, 0.055), sec(0.3, 0.21, -0.2, 0.042), sec(0.55, 0.13, -0.29, 0.034), sec(0.64, 0.07, -0.32, 0.03)]).rotateY(PI / 2), { color: GREY }),
    part(loft([sec(0.16, 0.08, -0.15, 0.06), sec(0.5, 0.05, -0.27, 0.04)]).rotateY(PI / 2), { to: 'metal', color: DARK }),
    ball(0.034, [0.63, 0, -0.31], [1, 1, 1.6], { color: PALE }, 10),
    rod([0.63, 0, -0.38], [0.63, 0, -0.03], 0.013, 0.01, { to: 'metal', color: DARK }, 8),
    rod([0.63, 0, -0.06], [0.63, 0, -0.02], 0.016, 0.016, { to: 'metal', color: DARK }, 8),
  ];
  for (let i = 0; i < 3; i++) L.push(...place(arm, [0, 0, 0], [0, 0, PI / 2 + (i * 2 * PI) / 3]));
  nozzle(L, 0, 0, -0.46, 0.042, [3.6, 1.0, 0.45]);
  const mats = kitMats(k, { plating: { base: 210, spread: 14, seam: 0.6, detail: 0.3, min: 10 }, paint: { metalness: 0.45, roughness: 0.42 }, density: 6 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(flicker(t, 5)));
}

// ── Trade Federation ──

// Lucrehulk-class battleship (a droid control ship).
function lucrehulk(k) {
  const TAN = '#a89d88';
  const GREY = '#8e887c';
  const DARK = '#3f3c37';
  const L = [];
  const G = 0.5; // half the gap's angle, at the front
  const R0 = 0.285;
  const R1 = 0.5;
  // the ring's section: a tall inner wall, sloping out to a thin rim
  const prof = [[R0, -0.05], [R0 + 0.03, -0.056], [0.4, -0.032], [R1 - 0.012, -0.012], [R1, 0], [R1 - 0.012, 0.012], [0.4, 0.032], [R0 + 0.03, 0.056], [R0, 0.05], [R0, -0.05]];
  L.push(part(arc(prof, G, 2 * PI - 2 * G, 64), { color: TAN }));
  // the deck's height at radius r
  const deck = (r) => (r < R0 + 0.03 ? 0.056 : r < 0.4 ? 0.056 - ((r - R0 - 0.03) / (0.4 - R0 - 0.03)) * 0.024 : 0.032 - ((r - 0.4) / (R1 - 0.012 - 0.4)) * 0.02);
  // a dark trench round the rim and raised bands round the deck
  L.push(part(arc([[R1 + 0.001, -0.004], [R1 + 0.001, 0.004]], G, 2 * PI - 2 * G, 64), { to: 'metal', color: DARK }));
  for (const sy of [-1, 1]) {
    for (const [r0, r1] of [[0.33, 0.345], [0.43, 0.445]]) {
      const p = [[r1, sy * (deck(r1) + 0.003)], [r0, sy * (deck(r0) + 0.003)]];
      L.push(part(arc(sy > 0 ? p : p.reverse(), G + 0.02, 2 * PI - 2 * G - 0.04, 64), { color: GREY }));
    }
  }
  // an arm's end (at phi = G, the gap toward local +x): a cap shaped to the
  // ring's section, and its jaws above and below the hangar mouth, which
  // juts toward the gap like a docking claw
  const across = (pts, x0, x1) => loft([{ z: x0, pts }, { z: x1, pts }]).rotateY(PI / 2);
  const toLocal = (pts) => pts.map(([r, y]) => [-r, y]).reverse();
  const jaw = [[0.296, 0.024], [0.462, 0.016], [0.47, 0.016], [0.4, 0.032], [0.315, 0.056], [0.296, 0.05]];
  const end = [
    part(across(toLocal(prof.slice(0, -1)), -0.004, 0.01), { color: GREY }),
    part(across(toLocal(jaw), -0.004, 0.05), { color: TAN }),
    part(across(jaw.map(([r, y]) => [-r, -y]), -0.004, 0.05), { color: TAN }),
    part(new THREE.BoxGeometry(0.004, 0.044, 0.17), { at: [0.012, 0, 0.38], to: 'metal', color: '#151412' }),
    part(new THREE.BoxGeometry(0.004, 0.006, 0.15), { at: [0.0145, -0.012, 0.38], to: 'glow', color: [3, 2.2, 1.3] }),
    part(new THREE.BoxGeometry(0.004, 0.004, 0.15), { at: [0.0145, 0.012, 0.38], to: 'glow', color: [2.2, 1.7, 1.1] }),
    part(new THREE.BoxGeometry(0.03, 0.008, 0.02), { at: [0.055, 0.03, 0.31], color: GREY }),
    part(new THREE.BoxGeometry(0.03, 0.008, 0.02), { at: [0.055, -0.03, 0.31], color: GREY }),
  ];
  // the hangar slits down the inside of the arm, and ribs across its deck
  for (let i = 0; i < 9; i++) {
    const phi = G + 0.16 + i * 0.13;
    end.push(...place([part(new THREE.BoxGeometry(0.075, 0.03, 0.006), { at: [0, 0.008, R0 - 0.001], to: 'metal', color: '#1c1b19' }), part(new THREE.BoxGeometry(0.068, 0.004, 0.004), { at: [0, -0.004, R0 - 0.003], to: 'glow', color: [2.4, 1.8, 1.1], mark: 'hangar' })], undefined, [0, phi - G, 0]));
  }
  for (let i = 0; i < 14; i++) {
    const phi = G + 0.12 + i * 0.19;
    for (const sy of [-1, 1]) end.push(...place([part(new THREE.BoxGeometry(0.008, 0.006, 0.1), { at: [0, sy * (deck(0.36) + 0.002), 0.36], rot: [sy * 0.2, 0, 0], color: GREY })], undefined, [0, phi - G, 0]));
  }
  const right = place(end, undefined, [0, G, 0]);
  L.push(...right, ...mirror(right));
  // engines round the back of the ring, in a raised band
  L.push(part(arc([[R1 - 0.03, -0.026], [R1 + 0.006, -0.02], [R1 + 0.006, 0.02], [R1 - 0.03, 0.026]], PI - 0.42, 0.84, 24), { color: GREY }));
  for (let i = 0; i < 14; i++) {
    const phi = PI - 0.37 + (i / 13) * 0.74;
    L.push(...place([part(new THREE.BoxGeometry(0.03, 0.022, 0.004), { at: [0, 0, R1 + 0.0065], to: 'metal', color: '#24221f' }), part(new THREE.PlaneGeometry(0.022, 0.013), { at: [0, 0, R1 + 0.0087], to: 'glow', color: [1.8, 2.5, 4] })], undefined, [0, phi, 0]));
  }
  // the core sphere, its belt and the neck to the ring at the back
  L.push(ball(0.2, [0, 0, 0], 1, { color: GREY }, 36));
  L.push(part(upright([[0.204, -0.02], [0.212, -0.012], [0.212, 0.012], [0.204, 0.02]], 36), { to: 'metal', color: DARK }));
  for (const y of [-0.11, 0.11]) L.push(part(upright([[0.172, y - 0.006], [0.175, y], [0.172, y + 0.006]], 36), { color: TAN }));
  L.push(part(loft([{ z: -0.31, pts: box8(0.15, 0.09, 0.02) }, { z: -0.16, pts: box8(0.11, 0.07, 0.015) }]), { color: TAN }));
  // the reactor tower on top (with its antennas) and the one below
  for (const sy of [-1, 1]) {
    L.push(part(upright([[0.07, 0], [0.065, 0.03], [0.05, 0.05], [0.045, 0.08], [0.06, 0.09], [0.06, 0.1], [0.03, 0.115], [0.0001, 0.118]], 18), { at: [0, sy * 0.17, 0], scale: [1, sy, 1], color: TAN }));
    L.push(rod([0.02, sy * 0.28, 0], [0.02, sy * (sy > 0 ? 0.36 : 0.32), 0], 0.003, 0.002, { to: 'metal', color: DARK }, 5));
    L.push(rod([-0.025, sy * 0.28, 0.01], [-0.025, sy * 0.33, 0.01], 0.003, 0.002, { to: 'metal', color: DARK }, 5));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    L.push(part(new THREE.BoxGeometry(0.006, 0.006, 0.006), { at: [sin(a) * 0.062, 0.268, cos(a) * 0.062], to: 'glow', color: [2.2, 1.9, 1.4], mark: 'beacon' }));
  }
  const mats = kitMats(k, { plating: { min: 8, base: 216, spread: 16, seam: 0.6, detail: 0.22 }, paint: { metalness: 0.25, roughness: 0.55 }, density: 11 });
  let blink;
  return finish(k, L, mats, (t, M) => {
    blink ??= blinker(M.glow.geometry);
    blink('beacon', pulse(t, 2.4, 0, 0.15) ? 1.5 : 0.35);
    mats.glow.color.setScalar(1 + 0.04 * sin(t * 1.7));
  });
}

// ── Naboo ──

// A flattened ellipse of n points, anticlockwise from +x, for loft().
const oval = (w, h, y = 0, n = 12) => Array.from({ length: n }, (_, i) => [(w / 2) * cos((i / n) * PI * 2), y + (h / 2) * sin((i / n) * PI * 2)]);

// N-1 starfighter.
function n1(k) {
  const YEL = '#f2be1a';
  const CHROME = '#e2e6ea';
  const DARK = '#33363b';
  const L = [];
  // the fuselage, yellow, and the chrome needle of its nose
  L.push(part(turned([[0.0001, -0.36], [0.014, -0.34], [0.03, -0.28], [0.048, -0.19], [0.06, -0.1], [0.064, 0.0], [0.059, 0.09], [0.046, 0.17], [0.031, 0.235]], 20), { scale: [1, 0.78, 1], color: YEL }));
  L.push(part(turned([[0.031, 0.235], [0.024, 0.28], [0.015, 0.35], [0.008, 0.42], [0.003, 0.48], [0.0001, 0.5]], 16), { scale: [1, 0.78, 1], to: 'metal', color: CHROME }));
  L.push(part(turned([[0.0001, -0.375], [0.008, -0.37], [0.015, -0.345], [0.016, -0.335]], 14), { scale: [1, 0.78, 1], to: 'metal', color: CHROME }));
  // chrome trim: a band round the waist and the strip down the spine
  L.push(part(turned([[0.0655, -0.03], [0.0655, -0.01]], 20), { scale: [1, 0.78, 1], to: 'metal', color: CHROME }));
  L.push(part(new THREE.BoxGeometry(0.012, 0.006, 0.3), { at: [0, 0.048, -0.17], rot: [-0.12, 0, 0], to: 'metal', color: CHROME }));
  // the cockpit canopy and the astromech behind it
  L.push(ball(0.036, [0, 0.036, 0.1], [0.85, 0.75, 2.1], { to: 'glass' }, 16));
  L.push(part(upright([[0.024, 0], [0.024, 0.012], [0.021, 0.022], [0.014, 0.03], [0.0001, 0.033]], 14), { at: [0, 0.04, -0.045], to: 'metal', color: '#c9ced4' }));
  L.push(part(new THREE.BoxGeometry(0.012, 0.01, 0.006), { at: [0, 0.064, -0.027], rot: [0.5, 0, 0], color: '#2f5ab0' }));
  L.push(part(new THREE.BoxGeometry(0.006, 0.006, 0.004), { at: [0.004, 0.06, -0.024], rot: [0.5, 0, 0], to: 'glow', color: [3, 0.6, 0.4] }));
  // a wing out to its engine, the engine, its chrome cone in front and the
  // long spike behind
  const side = [
    part(plateXZ([[0.03, -0.2], [0.03, 0.02], [0.24, -0.06], [0.24, -0.16]], 0.012, 0.003), { at: [0, -0.008, 0], color: YEL }),
    part(plateXZ([[0.08, -0.17], [0.08, -0.02], [0.2, -0.07], [0.2, -0.14]], 0.015), { at: [0, -0.008, 0], to: 'metal', color: CHROME }),
    part(turned([[0.016, -0.17], [0.024, -0.15], [0.027, -0.1], [0.027, 0.06], [0.024, 0.13], [0.018, 0.17]], 14), { at: [0.245, -0.008, 0], color: YEL }),
    part(turned([[0.018, 0.17], [0.011, 0.2], [0.004, 0.225], [0.0001, 0.23]], 14), { at: [0.245, -0.008, 0], to: 'metal', color: CHROME }),
    part(turned([[0.0275, -0.03], [0.0275, 0.0]], 14), { at: [0.245, -0.008, 0], to: 'metal', color: CHROME }),
    rod([0.245, -0.008, -0.17], [0.245, -0.008, -0.5], 0.006, 0.0008, { to: 'metal', color: CHROME }, 8),
    rod([0.245, -0.008, -0.2], [0.245, -0.008, -0.17], 0.012, 0.007, { to: 'metal', color: DARK }, 10),
  ];
  L.push(...side, ...mirror(side));
  for (const sx of [-1, 1]) {
    L.push(part(turned([[0.0001, -0.002], [0.014, -0.002], [0.016, 0.004]], 14), { at: [sx * 0.245, -0.008, -0.172], to: 'glow', color: [1.8, 2.6, 4.8] }));
    // the twin cannons under the nose
    L.push(rod([sx * 0.022, -0.04, 0.08], [sx * 0.022, -0.04, 0.24], 0.005, 0.004, { to: 'metal', color: DARK }, 6));
  }
  const mats = kitMats(k, { plating: { base: 232, spread: 8, seam: 0.72, detail: 0.15 }, paint: { metalness: 0.35, roughness: 0.3 }, metal: { metalness: 1, roughness: 0.12 }, glass: '#0b141c', density: 6 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(flicker(t, 7)));
}

// J-type 327 Nubian royal starship.
function nubian(k) {
  const CHROME = '#eef1f4';
  const DARK = '#3a3e44';
  const L = [];
  // the hull: a slim spindle, flattened, the nose long and fine, a long
  // tapering tail
  const hull = [
    [-0.5, 0.004, 0.004, 0.006],
    [-0.4, 0.03, 0.022, 0.006],
    [-0.25, 0.07, 0.048, 0.004],
    [-0.08, 0.11, 0.07, 0],
    [0.08, 0.12, 0.075, 0],
    [0.22, 0.1, 0.064, -0.002],
    [0.34, 0.068, 0.044, -0.004],
    [0.43, 0.036, 0.024, -0.006],
    [0.48, 0.014, 0.01, -0.007],
    [0.5, 0.002, 0.002, -0.007],
  ];
  L.push(part(loft(hull.map(([z, w, h, y]) => ({ z, pts: oval(w, h, y, 16) }))), { color: CHROME }));
  // the raised cockpit fairing and its windows, the dorsal ridge
  L.push(part(loft([{ z: 0.12, pts: oval(0.004, 0.004, 0.034, 10) }, { z: 0.2, pts: oval(0.05, 0.03, 0.03, 10) }, { z: 0.3, pts: oval(0.044, 0.022, 0.022, 10) }, { z: 0.36, pts: oval(0.02, 0.01, 0.014, 10) }]), { color: CHROME }));
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.004, 0.008, 0.04), { at: [sx * 0.021, 0.034, 0.275], rot: [0.12, sx * 0.25, 0], to: 'glass' }));
  L.push(part(new THREE.BoxGeometry(0.03, 0.004, 0.012), { at: [0, 0.04, 0.3], rot: [0.5, 0, 0], to: 'glass' }));
  L.push(part(loft([{ z: -0.3, pts: box8(0.008, 0.01, 0.002, 0.026) }, { z: 0.06, pts: box8(0.012, 0.014, 0.003, 0.04) }]), { color: CHROME }));
  // a wing, swept far back, its engine pod and the long fin at its tip
  const side = [
    part(plateXZ([[0.03, 0.12], [0.03, -0.14], [0.3, -0.35], [0.33, -0.37], [0.33, -0.31], [0.2, -0.16]], 0.016, 0.005), { color: CHROME }),
    part(turned([[0.018, -0.33], [0.037, -0.31], [0.044, -0.26], [0.046, -0.12], [0.04, -0.02], [0.026, 0.05], [0.01, 0.09], [0.0001, 0.1]], 18), { at: [0.17, 0, 0], color: CHROME }),
    part(turned([[0.0465, -0.2], [0.0465, -0.18]], 18), { at: [0.17, 0, 0], to: 'metal', color: DARK }),
  ];
  L.push(...side, ...mirror(side));
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.CircleGeometry(0.034, 18), { at: [sx * 0.17, 0, -0.3305], rot: [0, PI, 0], to: 'glow', color: [1.6, 2.4, 4.6] }));
  }
  L.push(part(new THREE.BoxGeometry(0.02, 0.004, 0.05), { at: [0, -0.035, -0.02], to: 'metal', color: DARK }));
  const mats = kitMats(k, { plating: { base: 240, spread: 6, seam: 0.8, detail: 0.1 }, paint: { metalness: 0.95, roughness: 0.14 }, metal: { metalness: 0.8, roughness: 0.3 }, glass: '#06090d', density: 5 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(flicker(t, 4)));
}

// ── The Republic ──

// Delta-7 Aethersprite.
function delta7(k) {
  const RED = '#b8262a';
  const WHITE = '#e6e3dd';
  const GREY = '#8c9096';
  const DARK = '#303338';
  const L = [];
  // the wedge: red above, white below, both meeting along a thin edge
  const half = (z) => 0.25 * (0.5 - z) + 0.002;
  const top = (z) => 0.006 + 0.05 * (0.5 - z);
  const bot = (z) => 0.004 + 0.022 * (0.5 - z);
  const zs = [-0.5, -0.4, 0.2, 0.5];
  L.push(part(loft(zs.map((z) => ({ z, pts: [[half(z), 0], [half(z) * 0.32, top(z)], [-half(z) * 0.32, top(z)], [-half(z), 0]] }))), { color: RED }));
  L.push(part(loft(zs.map((z) => ({ z, pts: [[-half(z), 0], [-half(z) * 0.3, -bot(z)], [half(z) * 0.3, -bot(z)], [half(z), 0]] }))), { color: WHITE }));
  // white stripes along the edges and up the spine
  for (const sx of [-1, 1]) {
    L.push(rod([sx * half(-0.495), 0.002, -0.495], [sx * half(0.47), 0.002, 0.47], 0.006, 0.003, { color: WHITE }, 5));
    L.push(rod([sx * half(-0.3) * 0.32, top(-0.3) + 0.001, -0.3], [sx * half(0.4) * 0.32, top(0.4) + 0.001, 0.4], 0.004, 0.002, { color: WHITE }, 5));
  }
  L.push(part(loft([{ z: -0.48, pts: trap8(0.07, 0.03, 0.016, 0.003, top(-0.48)) }, { z: 0.1, pts: trap8(0.04, 0.016, 0.01, 0.002, top(0.1)) }, { z: 0.3, pts: trap8(0.012, 0.006, 0.004, 0.001, top(0.3)) }]), { color: WHITE }));
  // the cockpit, off to starboard near the back
  const cx = -0.11;
  L.push(part(loft([{ z: -0.42, pts: oval(0.07, 0.04, top(-0.42) - 0.02, 12) }, { z: -0.3, pts: oval(0.075, 0.05, top(-0.3) - 0.015, 12) }, { z: -0.16, pts: oval(0.04, 0.03, top(-0.16) - 0.015, 12) }, { z: -0.12, pts: oval(0.006, 0.006, top(-0.12) - 0.018, 12) }].map((s) => ({ ...s, pts: s.pts.map(([x, y]) => [x + cx, y]) }))), { color: RED }));
  L.push(ball(0.04, [cx, top(-0.27) + 0.014, -0.25], [1, 0.8, 2.2], { to: 'glass' }, 18));
  L.push(part(new THREE.BoxGeometry(0.004, 0.026, 0.006), { at: [cx, top(-0.27) + 0.02, -0.23], rot: [0.5, 0, 0], color: GREY }));
  // the astromech in its socket to port
  const ax = 0.12;
  L.push(part(new THREE.CylinderGeometry(0.03, 0.032, 0.02, 14), { at: [ax, top(-0.3) - 0.004, -0.3], to: 'metal', color: DARK }));
  L.push(part(upright([[0.024, 0], [0.024, 0.012], [0.02, 0.022], [0.012, 0.028], [0.0001, 0.03]], 14), { at: [ax, top(-0.3) + 0.004, -0.3], to: 'metal', color: '#c9ced4' }));
  L.push(part(new THREE.BoxGeometry(0.012, 0.01, 0.006), { at: [ax, top(-0.3) + 0.026, -0.282], rot: [0.5, 0, 0], color: RED }));
  // the engines across the stern, and the laser cannons in the leading edges
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.07, 0.03, 0.03), { at: [sx * 0.055, 0.012, -0.49], to: 'metal', color: GREY }));
    nozzle(L, sx * 0.055, 0.012, -0.51, 0.016, [1.6, 2.5, 4.8], { color: DARK });
    nozzle(L, sx * 0.03, 0.006, -0.51, 0.009, [1.6, 2.5, 4.8], { color: DARK });
    L.push(rod([sx * half(-0.05) * 0.9, 0, -0.05], [sx * half(0.05) * 0.88, 0, 0.05], 0.004, 0.003, { to: 'metal', color: DARK }, 6));
  }
  const mats = kitMats(k, { plating: { base: 226, spread: 12, seam: 0.6, detail: 0.25, min: 10 }, paint: { metalness: 0.3, roughness: 0.42 }, density: 7 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(flicker(t, 6)));
}

// ARC-170 starfighter.
function arc170(k) {
  const WHITE = '#e7e5df';
  const RED = '#a82e28';
  const GREY = '#8a8f96';
  const DARK = '#303338';
  const L = [];
  // the fuselage, long, the canopy forward and the tail gunner's bubble
  L.push(
    part(
      loft([
        { z: -0.47, pts: box8(0.05, 0.05, 0.012) },
        { z: -0.38, pts: box8(0.085, 0.075, 0.018) },
        { z: 0.0, pts: box8(0.09, 0.08, 0.02) },
        { z: 0.25, pts: box8(0.075, 0.065, 0.018, -0.004) },
        { z: 0.42, pts: box8(0.05, 0.04, 0.012, -0.008) },
        { z: 0.5, pts: box8(0.02, 0.016, 0.005, -0.012) },
      ]),
      { color: WHITE },
    ),
  );
  L.push(ball(0.032, [0, 0.036, 0.2], [1, 0.75, 4.6], { to: 'glass' }, 16));
  for (const z of [0.12, 0.2, 0.28]) L.push(part(new THREE.BoxGeometry(0.056, 0.006, 0.006), { at: [0, 0.058, z], color: WHITE }));
  L.push(ball(0.022, [0, 0.03, -0.42], [1, 0.8, 1.4], { to: 'glass' }, 12));
  L.push(part(new THREE.BoxGeometry(0.092, 0.03, 0.08), { at: [0, 0.01, 0.34], color: RED }));
  // a wing: broad, a red panel on it, the big engine at its root, the long
  // laser cannon out in front and the split tail fins at its back
  const side = [
    part(plateXZ([[0.04, -0.38], [0.04, -0.02], [0.44, -0.12], [0.46, -0.16], [0.46, -0.3], [0.44, -0.33]], 0.026, 0.006), { color: WHITE }),
    part(plateXZ([[0.3, -0.31], [0.3, -0.07], [0.44, -0.12], [0.44, -0.3]], 0.03), { color: RED }),
    part(turned([[0.034, -0.46], [0.044, -0.44], [0.05, -0.36], [0.05, -0.06], [0.04, 0.02], [0.02, 0.05]], 14), { at: [0.1, -0.004, 0], color: WHITE }),
    part(turned([[0.051, -0.3], [0.051, -0.27]], 14), { at: [0.1, -0.004, 0], color: RED }),
    part(loft([{ z: -0.12, pts: box8(0.05, 0.045, 0.012) }, { z: 0.08, pts: box8(0.044, 0.04, 0.012) }, { z: 0.12, pts: box8(0.026, 0.026, 0.008) }]), { at: [0.25, 0, 0], color: GREY }),
    rod([0.25, 0, 0.1], [0.25, 0, 0.47], 0.009, 0.007, { to: 'metal', color: DARK }, 8),
    rod([0.25, 0, 0.44], [0.25, 0, 0.475], 0.012, 0.012, { to: 'metal', color: DARK }, 8),
    rod([0.25, 0, 0.2], [0.25, 0, 0.26], 0.012, 0.012, { to: 'metal', color: DARK }, 8),
  ];
  // the fins: tall, sharp, one up and one down, splayed apart
  const fin = (sy) => part(plateZY([[-0.42, 0], [-0.26, 0], [-0.2, 0.03], [-0.36, 0.2], [-0.43, 0.2]], 0.014, 0.004), { at: [0.39, sy * 0.012, 0], rot: [0, 0, sy * -0.3], scale: [1, sy, 1], color: WHITE });
  const finRed = (sy) => part(plateZY([[-0.43, 0.15], [-0.4, 0.15], [-0.36, 0.2], [-0.43, 0.2]], 0.017), { at: [0.39, sy * 0.012, 0], rot: [0, 0, sy * -0.3], scale: [1, sy, 1], color: RED });
  side.push(fin(1), fin(-1), finRed(1), finRed(-1));
  L.push(...side, ...mirror(side));
  for (const sx of [-1, 1]) nozzle(L, sx * 0.1, -0.004, -0.465, 0.032, [1.6, 2.4, 4.8], { color: DARK });
  const mats = kitMats(k, { plating: { base: 228, spread: 12, seam: 0.6, detail: 0.3, min: 10 }, density: 7 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(flicker(t, 8)));
}

// Acclamator-class assault ship.
function acclamator(k) {
  const GREY = '#a9adb3';
  const RED = '#a52b26';
  const DARK = '#2a2d32';
  const L = [];
  // the wedge: a flat belly, slab sides and the upper hull sloping up to a
  // ridge down the middle
  const W = 0.29;
  const dims = (z) => {
    const f = 0.5 - z;
    return { f, w: W * f + 0.004, yb: -0.072 * f - 0.002, ys: 0.012 * f, yt: 0.088 * f + 0.002, s: 0.045 * f + 0.002 };
  };
  const sec = (z) => {
    const { w, yb, ys, yt, s } = dims(z);
    return { z, pts: [[w, yb * 0.55], [w, ys], [s, yt], [-s, yt], [-w, ys], [-w, yb * 0.55], [-w * 0.78, yb], [w * 0.78, yb]] };
  };
  L.push(part(loft([sec(-0.5), sec(0), sec(0.497)]), { color: GREY }));
  // Republic red down the edges where the sides meet the upper hull, across
  // the bow and round the stern
  const edge = (sx, z) => {
    const { w, ys } = dims(z);
    return [sx * (w + 0.001), ys + 0.001, z];
  };
  for (const sx of [-1, 1]) L.push(rod(edge(sx, -0.5), edge(sx, 0.47), 0.0045, 0.0015, { color: RED }, 4));
  L.push(part(loft([{ z: 0.32, pts: sec(0.32).pts.slice(1, 5).concat([[-dims(0.32).w, dims(0.32).ys - 0.01], [dims(0.32).w, dims(0.32).ys - 0.01]]).map(([x, y]) => [x * 1.01, y + 0.0015]) }, { z: 0.36, pts: sec(0.36).pts.slice(1, 5).concat([[-dims(0.36).w, dims(0.36).ys - 0.01], [dims(0.36).w, dims(0.36).ys - 0.01]]).map(([x, y]) => [x * 1.01, y + 0.0015]) }]), { color: RED }));
  // lines down the slopes, and turbolaser turrets along them
  for (const sx of [-1, 1]) {
    for (const phi of [0.35, 0.7]) {
      const at = (z) => {
        const { w, ys, yt, s } = dims(z);
        return [sx * (w + (s - w) * phi), ys + (yt - ys) * phi + 0.001, z];
      };
      L.push(rod(at(-0.49), at(0.4), 0.0016, 0.0016, { to: 'metal', color: '#6f747b' }, 4));
    }
    for (let i = 0; i < 6; i++) {
      const z = -0.25 + i * 0.09;
      const { w, ys, yt, s } = dims(z);
      const x = sx * (w + (s - w) * 0.5);
      const y = ys + (yt - ys) * 0.5;
      L.push(part(new THREE.CylinderGeometry(0.009, 0.011, 0.008, 10), { at: [x, y + 0.004, z], color: '#8d9198' }));
      L.push(rod([x - 0.003, y + 0.008, z], [x - 0.003, y + 0.008, z + 0.022], 0.0014, 0.0014, { to: 'metal', color: DARK }, 4));
      L.push(rod([x + 0.003, y + 0.008, z], [x + 0.003, y + 0.008, z + 0.022], 0.0014, 0.0014, { to: 'metal', color: DARK }, 4));
    }
  }
  // the command tower: a tall slab on a broad base, the bridge across its top
  L.push(part(loft([{ z: -0.47, pts: trap8(0.15, 0.1, 0.05, 0.008, 0.095) }, { z: -0.33, pts: trap8(0.11, 0.07, 0.04, 0.008, 0.09) }]), { color: GREY }));
  L.push(part(loft([{ z: -0.43, pts: box8(0.05, 0.13, 0.006, 0.16) }, { z: -0.36, pts: box8(0.05, 0.13, 0.006, 0.16) }, { z: -0.35, pts: box8(0.042, 0.12, 0.006, 0.157) }]), { color: GREY }));
  L.push(part(loft([{ z: -0.445, pts: box8(0.15, 0.03, 0.006, 0.235) }, { z: -0.37, pts: box8(0.15, 0.03, 0.006, 0.235) }, { z: -0.355, pts: box8(0.13, 0.016, 0.004, 0.23) }]), { color: GREY }));
  L.push(part(new THREE.BoxGeometry(0.152, 0.008, 0.06), { at: [0, 0.236, -0.41], color: RED }));
  L.push(part(new THREE.BoxGeometry(0.052, 0.09, 0.012), { at: [0, 0.16, -0.41], color: RED }));
  L.push(part(new THREE.BoxGeometry(0.12, 0.004, 0.003), { at: [0, 0.232, -0.3575], rot: [0.5, 0, 0], to: 'glow', color: [1.6, 1.55, 1.4] }));
  for (const sx of [-1, 1]) L.push(rod([sx * 0.06, 0.25, -0.42], [sx * 0.06, 0.29, -0.42], 0.0022, 0.0012, { to: 'metal', color: DARK }, 4));
  // the hangar bays in the belly, lit inside
  for (const [x, z, w, d] of [[0, 0.12, 0.09, 0.14], [0, -0.1, 0.16, 0.12], [-0.16, -0.26, 0.09, 0.14], [0.16, -0.26, 0.09, 0.14], [0, -0.3, 0.11, 0.1]]) {
    const yb = dims(z + d / 2).yb;
    L.push(part(new THREE.BoxGeometry(w, 0.004, d), { at: [x, yb - 0.001, z], to: 'metal', color: '#16181b' }));
    L.push(part(new THREE.BoxGeometry(w * 0.85, 0.002, 0.004), { at: [x, yb - 0.003, z + d * 0.3], to: 'glow', color: [2.2, 2, 1.6] }));
    L.push(part(new THREE.BoxGeometry(w * 0.85, 0.002, 0.004), { at: [x, yb - 0.003, z - d * 0.3], to: 'glow', color: [2.2, 2, 1.6] }));
  }
  // the four engines, two great and two lesser, in a block across the stern
  L.push(part(new THREE.BoxGeometry(0.42, 0.075, 0.03), { at: [0, -0.012, -0.505], color: '#8e9298' }));
  for (const [x, r] of [[-0.075, 0.034], [0.075, 0.034], [-0.17, 0.026], [0.17, 0.026]]) nozzle(L, x, -0.012, -0.535, r, [1.5, 2.4, 5], { color: DARK, depth: 1 });
  // greebles on the upper hull
  for (let i = 0; i < 40; i++) {
    const z = -0.48 + k.rand() * 0.8;
    const { w, ys, yt, s } = dims(z);
    const phi = 0.15 + k.rand() * 0.8;
    const sx = k.rand() < 0.5 ? -1 : 1;
    const [bx, by, bz] = [0.008 + 0.018 * k.rand(), 0.004 + 0.006 * k.rand(), 0.01 + 0.03 * k.rand()];
    L.push(part(new THREE.BoxGeometry(bx, by, bz), { at: [sx * (w + (s - w) * phi), ys + (yt - ys) * phi, z], rot: [0, 0, sx * atan2(yt - ys, w - s)], to: 'metal', color: k.rand() < 0.5 ? '#7d8189' : '#989ca3' }));
  }
  const mats = kitMats(k, { plating: { min: 6, base: 222, spread: 22, seam: 0.55, detail: 0.4 }, paint: { metalness: 0.25, roughness: 0.5 }, density: 8 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(1 + 0.05 * sin(t * 2.6) + 0.03 * sin(t * 15)));
}

// ── Separatist capital ships ──

// Core ship.
function coreship(k) {
  const TAN = '#aea590';
  const GREY = '#8c877c';
  const DARK = '#3a3833';
  const L = [];
  const R = 0.42;
  L.push(ball(R, [0, 0, 0], 1, { color: TAN }, 40));
  // bands of plating round it, and ribs down it between them
  for (const y of [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3]) {
    const r = Math.sqrt(R * R - y * y);
    L.push(part(upright([[r + 0.001, y - 0.012], [r + 0.008, y - 0.006], [r + 0.008, y + 0.006], [r + 0.001, y + 0.012]], 40), { color: y === 0.06 || y === -0.06 ? DARK : GREY }));
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    L.push(part(new THREE.TorusGeometry(R + 0.002, 0.004, 4, 24, PI * 0.5), { rot: [0, a, -PI * 0.25], color: GREY }));
  }
  // the antenna on top and its little dish
  L.push(part(upright([[0.06, 0], [0.05, 0.02], [0.03, 0.03], [0.0001, 0.032]], 16), { at: [0, R - 0.012, 0], color: GREY }));
  L.push(rod([0, R + 0.01, 0], [0, R + 0.12, 0], 0.004, 0.002, { to: 'metal', color: DARK }, 6));
  L.push(part(upright([[0.0001, 0], [0.02, 0.008], [0.026, 0.014]], 12), { at: [0.0, R + 0.09, 0], rot: [0.5, 0, 0], to: 'metal', color: '#9a978f' }));
  L.push(ball(0.006, [0, R + 0.125, 0], 1, { to: 'glow', color: [3.2, 0.6, 0.4], mark: 'tip' }, 6));
  // the thruster ring underneath, and its nozzles glowing down
  L.push(part(upright([[0.3, -0.32], [0.33, -0.36], [0.31, -0.4], [0.22, -0.42], [0.16, -0.41], [0.15, -0.38]], 32), { color: GREY }));
  L.push(part(upright([[0.0001, -0.4], [0.15, -0.4], [0.15, -0.38]], 24), { to: 'metal', color: DARK }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    const [x, z] = [sin(a) * 0.26, cos(a) * 0.26];
    L.push(part(new THREE.CylinderGeometry(0.03, 0.036, 0.025, 12), { at: [x, -0.425, z], to: 'metal', color: DARK }));
    L.push(part(new THREE.CircleGeometry(0.026, 12), { at: [x, -0.4385, z], rot: [PI / 2, 0, 0], to: 'glow', color: [1.7, 2.4, 4.4] }));
  }
  // the landing claws: four legs, each a strut out from the sphere, a leg
  // down from the knee and a claw of a foot
  const leg = [
    rod([0, -0.18, 0.36], [0, -0.3, 0.5], 0.016, 0.012, { color: GREY }, 8),
    rod([0, -0.3, 0.5], [0, -0.5, 0.47], 0.012, 0.009, { color: GREY }, 8),
    ball(0.02, [0, -0.3, 0.5], 1, { to: 'metal', color: DARK }, 8),
    rod([0, -0.3, 0.33], [0, -0.3, 0.49], 0.008, 0.008, { to: 'metal', color: DARK }, 6),
    part(new THREE.BoxGeometry(0.05, 0.014, 0.06), { at: [0, -0.505, 0.47], color: DARK }),
    rod([0, -0.5, 0.47], [0, -0.52, 0.53], 0.006, 0.002, { to: 'metal', color: DARK }, 5),
    rod([0.02, -0.5, 0.47], [0.035, -0.52, 0.52], 0.005, 0.002, { to: 'metal', color: DARK }, 5),
    rod([-0.02, -0.5, 0.47], [-0.035, -0.52, 0.52], 0.005, 0.002, { to: 'metal', color: DARK }, 5),
  ];
  for (let i = 0; i < 4; i++) L.push(...place(leg, undefined, [0, PI / 4 + (i * PI) / 2, 0]));
  // ports and hatches round the waist
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * PI * 2;
    L.push(part(new THREE.BoxGeometry(0.016, 0.007, 0.004), { at: [sin(a) * (R - 0.012), 0.12, cos(a) * (R - 0.012)], rot: [0, a, 0], to: 'glow', color: [1.5, 1.25, 0.85] }));
  }
  const mats = kitMats(k, { plating: { min: 8, base: 214, spread: 24, seam: 0.55, detail: 0.45 }, paint: { metalness: 0.3, roughness: 0.55 }, density: 8 });
  let blink;
  return finish(k, L, mats, (t, M) => {
    blink ??= blinker(M.glow.geometry);
    blink('tip', pulse(t, 1.8, 0, 0.2) ? 1.4 : 0.25);
    mats.glow.color.setScalar(flicker(t, 9));
  });
}

// Munificent-class star frigate.
function munificent(k) {
  const HULL = '#7f8a99';
  const PALE = '#9aa4b1';
  const DARK = '#2c3139';
  const L = [];
  // the slab: long and thin, standing on its edge, tall at the bow
  const slab = [[-0.47, -0.07], [-0.47, 0.07], [0.04, 0.085], [0.15, 0.14], [0.23, 0.25], [0.29, 0.29], [0.37, 0.29], [0.42, 0.2], [0.445, 0.0], [0.42, -0.2], [0.37, -0.29], [0.29, -0.29], [0.23, -0.25], [0.15, -0.14], [0.04, -0.085]];
  L.push(part(plateZY(slab, 0.03, 0.006), { color: HULL }));
  // ribs across both faces of it
  for (let i = 0; i < 7; i++) {
    const z = -0.4 + i * 0.07;
    const h = 0.07 + ((z + 0.47) / 0.51) * 0.015;
    L.push(part(new THREE.BoxGeometry(0.036, h * 1.9, 0.01), { at: [0, 0, z], color: i % 2 ? PALE : '#6d7886' }));
  }
  for (const sy of [-1, 1]) L.push(part(plateZY([[0.17, 0.15], [0.24, 0.24], [0.29, 0.265], [0.36, 0.265], [0.39, 0.2], [0.2, 0.13]].map(([z, y]) => [z, sy * y]), 0.036), { color: '#6d7886' }));
  // the spine: the core of the hull all along, wider than the slab
  L.push(
    part(
      loft([
        { z: -0.5, pts: box8(0.07, 0.08, 0.02) },
        { z: -0.1, pts: box8(0.09, 0.1, 0.025) },
        { z: 0.3, pts: box8(0.08, 0.09, 0.022) },
        { z: 0.47, pts: box8(0.05, 0.06, 0.016) },
        { z: 0.5, pts: box8(0.03, 0.036, 0.01) },
      ]),
      { color: PALE },
    ),
  );
  for (const sy of [-1, 1]) L.push(part(loft([{ z: -0.48, pts: box8(0.03, 0.02, 0.006, sy * 0.055) }, { z: 0.3, pts: box8(0.03, 0.02, 0.006, sy * 0.05) }]), { color: HULL }));
  // the comms array: great bulbs at the top and bottom of the bow, a dish
  // on each
  for (const sy of [-1, 1]) {
    L.push(ball(0.07, [0, sy * 0.29, 0.32], [0.85, 0.85, 1.5], { color: PALE }, 18));
    L.push(part(turned([[0.0738, -0.01], [0.0738, 0.01]], 18), { at: [0, sy * 0.29, 0.32], scale: [0.86, 0.86, 1], to: 'metal', color: DARK }));
    L.push(part(upright([[0.0001, 0], [0.02, 0.006], [0.032, 0.014]], 14), { at: [0, sy * 0.355, 0.33], scale: [1, sy, 1], to: 'metal', color: '#9aa2ad' }));
    L.push(rod([0, sy * 0.355, 0.33], [0, sy * 0.395, 0.33], 0.003, 0.002, { to: 'metal', color: DARK }, 5));
  }
  // the twin heavy turbolasers in the bow
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.03, 0.03, 0.06), { at: [sx * 0.03, 0, 0.45], color: HULL }));
    L.push(rod([sx * 0.03, 0, 0.47], [sx * 0.03, 0, 0.54], 0.007, 0.006, { to: 'metal', color: DARK }, 8));
  }
  // engines astern: a block with five nozzles
  L.push(part(new THREE.BoxGeometry(0.1, 0.15, 0.04), { at: [0, 0, -0.49], color: HULL }));
  for (const [x, y, r] of [[0, 0, 0.03], [0.025, 0.05, 0.02], [-0.025, 0.05, 0.02], [0.025, -0.05, 0.02], [-0.025, -0.05, 0.02]]) nozzle(L, x, y, -0.53, r, [1.6, 2.4, 5], { color: DARK, depth: 1.2 });
  // lit ports in rows down the slab
  for (let i = 0; i < 26; i++) {
    const z = -0.4 + k.rand() * 0.7;
    const y = (k.rand() - 0.5) * 0.12;
    const sx = k.rand() < 0.5 ? -1 : 1;
    L.push(part(new THREE.BoxGeometry(0.002, 0.004, 0.012), { at: [sx * 0.0505, y, z], to: 'glow', color: [2, 1.8, 1.3] }));
  }
  const mats = kitMats(k, { plating: { min: 8, base: 218, spread: 20, seam: 0.55, detail: 0.4 }, paint: { metalness: 0.35, roughness: 0.5 }, density: 8 });
  return finish(k, L, mats, (t) => mats.glow.color.setScalar(1 + 0.05 * sin(t * 2.2) + 0.03 * sin(t * 17)));
}

export const FLEET = { lucrehulk, coreship, munificent, vulture, trifighter, n1, nubian, delta7, arc170, acclamator };
export const INFO = {
  lucrehulk: { name: 'Droid control ship', meters: 3170, side: 'separatist' },
  coreship: { name: 'Separatist core ship', meters: 900, side: 'separatist' },
  munificent: { name: 'Munificent-class frigate', meters: 825, side: 'separatist' },
  vulture: { name: 'Vulture droid', meters: 3.5, side: 'separatist' },
  trifighter: { name: 'Droid tri-fighter', meters: 5.4, side: 'separatist' },
  n1: { name: 'N-1 starfighter', meters: 11, side: 'naboo' },
  nubian: { name: 'Naboo royal starship', meters: 76, side: 'naboo' },
  delta7: { name: 'Delta-7 Jedi starfighter', meters: 8, side: 'republic' },
  arc170: { name: 'ARC-170 starfighter', meters: 12.7, side: 'republic' },
  acclamator: { name: 'Acclamator assault ship', meters: 752, side: 'republic' },
};
