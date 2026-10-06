// The Rick and Morty universe's hunters, built (see trafficModels.js for how
// a model is put together and what it returns; fleetRickmortyKit.js for what's
// shared): the Federation's gunships and the cruisers they come out of, Evil
// Morty and his guard, a Zigerion scam ship and Krombopulos Michael's.
//
// gunship: a Galactic Federation gunship, the patrol fighter's heavy
// cousin in the same white and blue: a deep, blunt, armoured hull banded
// blue at the nose, a twin cannon on each shoulder, a rotary cannon under
// the chin, rocket pods under short thick wings, two big engines; its
// muzzles glow as they charge.
// fedcruiser: a Galactic Federation cruiser, a capital ship: a long white
// hull with a blade of a prow banded blue, rows of lit windows down its
// flanks, turrets along its deck, the superstructure stepping up at its
// back to a blue bridge, engine nacelles on short wings, and in its keel
// the hangar its gunships drop out of, guide lights chasing along it.
// mortyfighter: one of Evil Morty's guard's fighters: a fat little bullet
// in Morty yellow and blue-grey, a Morty under the bubble canopy, stubby
// wings with a cannon pod at each tip.
// evilmortyship: Evil Morty's own: longer and sharper than his guard's,
// black with yellow down its flanks, Evil Morty under a long canopy that
// wears a black eye patch over its starboard side, the strap and all.
// zigerion: a Zigerion scam ship: angular and dark green-grey, wrapped in
// places in a cyan holographic grid (the simulation it keeps its marks in)
// that carries its blunt nose on to a point it hasn't got; the grid
// shimmers and creeps, and now and then glitches out.
// krombopulos: Krombopulos Michael's ship, a Gromflomite assassin's: an
// insect in dark chitin, the abdomen in rings behind, red compound eyes for
// windows, smoky wings buzzing over its back, red lights running down its
// sides, and a long steel knife for a prow.

import * as THREE from 'three';
import { part, place, mirror, rod, between, ball, meshes, blinker, flapper, loft, box8, trap8, hex6, scaled, plateXZ, plateZY, turned, canvasTexture, grey, panelTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';
import { bubble, bead, smoothLoft, oval, roundOf, measure, painted, mortyPilot, FED, FED_BLUE, FED_JET, fedMaterials } from './fleetRickmortyKit';

const { PI, sin, cos, abs, min, atan2 } = Math;

// ── The Federation's gunship ──

// A Galactic Federation gunship: the patrol fighter's family (the white
// flattened hexagon of a hull, blue-lit seams, fins canted out at the wing
// tips, blue glass) built heavy: a deep, blunt hull banded blue at the nose,
// an armoured spine, a twin cannon on each shoulder in a housing sunk into
// the flank, a rotary cannon in a ball under the chin, short thick wings
// angled down with a rocket pod under each, and two big engines behind. It
// sits back and pours fire, its muzzles glowing as they charge.
function gunship(k) {
  const L = [];
  // the hull: rows of [z, width, height, y]
  const HULL = [
    [-0.42, 0.17, 0.1, 0.005],
    [-0.37, 0.25, 0.16, 0.005],
    [-0.05, 0.29, 0.19, 0.01],
    [0.17, 0.25, 0.16, 0],
    [0.32, 0.15, 0.1, -0.012],
    [0.37, 0.09, 0.055, -0.016],
  ];
  const ring = (z, grow = 1) => {
    const [, w, h, y] = measure(HULL, z);
    return { z, pts: scaled(hex6(w, h, y, 0.34), grow, grow, y) };
  };
  L.push(part(loft(HULL.map(([z]) => ring(z))), { color: FED.white }));
  L.push(part(loft([ring(0.235, 1.03), ring(0.265, 1.03)]), { color: FED.blue }));
  L.push(part(loft([ring(0.282, 1.03), ring(0.294, 1.03)]), { color: FED.blue }));
  // the canopy, a long blue bubble, a frame down its middle
  L.push(part(new THREE.SphereGeometry(0.05, 18, 8, 0, PI * 2, 0, PI * 0.66), { at: [0, 0.075, 0.15], scale: [1.05, 0.75, 2.0], to: 'glass' }));
  L.push(rod([0, 0.11, 0.1], [0, 0.104, 0.2], 0.0035, 0.0035, { color: FED.grey }, 4));
  // the armoured spine along its back, vents down it and a sensor
  // blister at its end
  L.push(
    part(
      loft([
        { z: -0.41, pts: trap8(0.09, 0.06, 0.02, 0.006, 0.07) },
        { z: -0.37, pts: trap8(0.12, 0.08, 0.05, 0.012, 0.098) },
        { z: -0.06, pts: trap8(0.12, 0.08, 0.05, 0.012, 0.105) },
        { z: 0.04, pts: trap8(0.07, 0.04, 0.016, 0.005, 0.096) },
      ]),
      { color: FED.grey },
    ),
  );
  for (const z of [-0.3, -0.24, -0.18]) L.push(part(new THREE.BoxGeometry(0.06, 0.006, 0.03), { at: [0, 0.13, z], to: 'metal', color: FED.dark }));
  L.push(ball(0.016, [0, 0.12, -0.37], [1, 0.8, 1.3], { to: 'metal', color: FED.dark }, 10));
  // the heavy guns: on each shoulder a twin cannon, its housing half sunk
  // into the flank, the barrels in cooling sleeves, muzzle brakes at the ends
  const gun = [];
  gun.push(
    part(
      loft([
        { z: -0.08, pts: box8(0.044, 0.05, 0.012) },
        { z: -0.02, pts: box8(0.066, 0.084, 0.02) },
        { z: 0.2, pts: box8(0.066, 0.084, 0.02) },
        { z: 0.25, pts: box8(0.05, 0.064, 0.014) },
      ]),
      { color: FED.grey },
    ),
  );
  gun.push(part(loft([0.12, 0.165].map((z) => ({ z, pts: box8(0.07, 0.088, 0.021) }))), { color: FED.blue }));
  for (const dy of [0.019, -0.019]) {
    gun.push(part(turned([[0.017, 0.24], [0.017, 0.33], [0.012, 0.345]], 8), { at: [0, dy, 0], to: 'metal', color: FED.dark }));
    gun.push(rod([0, dy, 0.34], [0, dy, 0.45], 0.0085, 0.0085, { to: 'metal', color: '#4a5059' }, 6));
    gun.push(part(turned([[0.0085, 0.445], [0.015, 0.448], [0.015, 0.478], [0.006, 0.482], [0.006, 0.47]], 8), { at: [0, dy, 0], to: 'metal', color: FED.dark }));
    gun.push(part(new THREE.CircleGeometry(0.0062, 8), { at: [0, dy, 0.471], to: 'glow', color: FED_BLUE, mark: 'muzzle' }));
  }
  for (const sx of [-1, 1]) L.push(...place(gun, [sx * 0.135, 0, 0]));
  // the chin turret: a ball under the nose, a rotary cannon out of it
  const cy = -0.062;
  L.push(ball(0.036, [0, cy, 0.22], [1, 0.85, 1], { to: 'metal', color: FED.dark }, 10));
  L.push(part(turned([[0.0001, 0.24], [0.017, 0.24], [0.019, 0.27], [0.015, 0.29], [0.0001, 0.29]], 10), { at: [0, cy, 0], to: 'metal', color: '#4a5059' }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    L.push(rod([0.0085 * cos(a), cy + 0.0085 * sin(a), 0.285], [0.0085 * cos(a), cy + 0.0085 * sin(a), 0.39], 0.003, 0.003, { to: 'metal', color: '#2e333a' }, 5));
  }
  L.push(part(turned([[0.0001, 0.36], [0.0135, 0.36], [0.0135, 0.372], [0.0001, 0.372]], 10), { at: [0, cy, 0], to: 'metal', color: '#4a5059' }));
  // the wings, short and thick and angled down: a blue stripe, the fin at
  // the tip with its light, a running light along the front, and a rocket
  // pod slung under each (red-tipped rockets in its mouth)
  const wing = [];
  wing.push(part(plateXZ([[0, -0.34], [0.17, -0.37], [0.2, -0.33], [0.2, -0.22], [0, -0.02]], 0.03, 0.008), { color: FED.white }));
  wing.push(part(plateXZ([[0.07, -0.335], [0.15, -0.352], [0.17, -0.335], [0.17, -0.25], [0.07, -0.18]], 0.034), { color: FED.blue }));
  wing.push(part(plateZY([[-0.37, 0], [-0.24, 0], [-0.31, 0.11], [-0.37, 0.11]], 0.016, 0.004), { at: [0.2, 0, 0], rot: [0, 0, -0.35], color: FED.white }));
  wing.push(ball(0.008, [0.2 + sin(0.35) * 0.112, cos(0.35) * 0.112, -0.34], 1, { to: 'glow', color: FED_BLUE, mark: 'tips' }, 6));
  wing.push(rod([0.02, 0.016, -0.055], [0.18, 0.016, -0.215], 0.003, 0.003, { to: 'glow', color: FED_BLUE }, 4));
  wing.push(part(turned([[0.0001, -0.31], [0.016, -0.305], [0.022, -0.29], [0.022, -0.125], [0.02, -0.11]], 10), { at: [0.11, -0.036, 0], color: FED.grey }));
  wing.push(part(new THREE.CircleGeometry(0.02, 10), { at: [0.11, -0.036, -0.112], to: 'metal', color: FED.dark }));
  for (const [dx, dy] of [
    [-0.008, 0.008],
    [0.008, 0.008],
    [-0.008, -0.008],
    [0.008, -0.008],
  ]) {
    wing.push(part(new THREE.ConeGeometry(0.0055, 0.016, 6), { at: [0.11 + dx, -0.036 + dy, -0.106], rot: [PI / 2, 0, 0], color: '#c23a2e' }));
  }
  wing.push(part(new THREE.BoxGeometry(0.008, 0.02, 0.07), { at: [0.11, -0.018, -0.2], color: FED.dark }));
  const right = place(wing, [0.095, -0.035, 0], [0, 0, -0.16]);
  L.push(...right, ...mirror(right));
  // the engines, big, blue-banded, glowing blue behind
  for (const sx of [-1, 1]) {
    const at = [sx * 0.07, 0.012, 0];
    L.push(part(turned([[0.03, -0.488], [0.042, -0.495], [0.05, -0.475], [0.053, -0.43], [0.053, -0.33], [0.045, -0.29], [0.03, -0.27]], 16), { at, color: FED.white }));
    L.push(part(turned([[0.0545, -0.455], [0.0545, -0.44]], 16), { at, color: FED.blue }));
    L.push(part(new THREE.CircleGeometry(0.034, 16), { at: [at[0], at[1], -0.484], rot: [0, PI, 0], to: 'glow', color: FED_JET }));
    L.push(part(new THREE.ConeGeometry(0.03, 0.06, 14, 1, true), { at: [at[0], at[1], -0.515], rot: [-PI / 2, 0, 0], to: 'glow', color: [0.6, 2.1, 5.6] }));
    // the running light down each flank, along its edge
    const edge = (z) => {
      const [, w, , y] = measure(HULL, z);
      return [sx * (w / 2 + 0.002), y, z];
    };
    L.push(rod(edge(-0.37), edge(-0.1), 0.003, 0.003, { to: 'glow', color: FED_BLUE }, 4));
  }
  L.push(ball(0.007, [0, -0.016, 0.372], 1, { to: 'glow', color: [3, 3, 3.2], mark: 'nose' }, 6));

  const mats = fedMaterials(k);
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 13));
      blink('tips', pulse(t, 1.2, 0, 0.1) || pulse(t, 1.2, 0.85, 0.1) ? 1.4 : 0.25);
      blink('nose', pulse(t, 2.1, 0.5, 0.06) ? 1.2 : 0.1);
      // the guns charging, and letting go
      blink('muzzle', Math.round((0.3 + 0.9 * ((t * 0.8) % 1) ** 3) * 10) / 10);
    },
  };
}

// ── The Federation's cruiser ──

// A Galactic Federation cruiser, the capital ship the gunships come out
// of: long and white, a blade of a prow banded blue, the flanks straight up
// and down with rows of lit windows along them and blue-lit seams above,
// a deck down its back with turrets on it and the bridge tower at its end
// (the bridge painted blue, its windows lit, masts with red lights), short
// wings at the stern out to engine nacelles, three engines in the stern
// and, in the keel underneath, the hangar: open, dark, lit along its walls,
// guide lights chasing along its ceiling.
function fedcruiser(k) {
  const L = [];
  // the hull: rows of [z, width, height, y]; its section a hexagon stood on
  // a flat keel, the flanks straight up and down where the windows run
  const HULL = [
    [-0.47, 0.18, 0.1, 0.005],
    [-0.45, 0.23, 0.13, 0],
    [-0.1, 0.25, 0.14, 0],
    [0.14, 0.2, 0.115, -0.005],
    [0.36, 0.1, 0.065, -0.012],
    [0.5, 0.012, 0.012, -0.018],
  ];
  const sec = (w, h, y) => [[w * 0.3, y - h / 2], [w / 2, y - h * 0.18], [w / 2, y + h * 0.14], [w * 0.29, y + h / 2], [-w * 0.29, y + h / 2], [-w / 2, y + h * 0.14], [-w / 2, y - h * 0.18], [-w * 0.3, y - h / 2]];
  const ring = (z, grow = 1) => {
    const [, w, h, y] = measure(HULL, z);
    return { z, pts: scaled(sec(w, h, y), grow, grow, y) };
  };
  L.push(part(loft(HULL.map(([z]) => ring(z))), { color: FED.white }));
  L.push(part(loft([ring(0.255, 1.025), ring(0.3, 1.025)]), { color: FED.blue }));
  L.push(part(loft([ring(0.315, 1.03), ring(0.33, 1.03)]), { color: FED.blue }));
  // the keel under its middle, the hangar between its halves: behind it,
  // sloping up into the hull; before, tapering into the prow
  const KW = 0.15;
  const KH = 0.066;
  const KY = -0.078;
  const keel = (z, w, h, y) => ({ z, pts: box8(w, h, min(w, h) * 0.18, y) });
  L.push(part(loft([keel(-0.39, KW * 0.7, 0.02, -0.058), keel(-0.33, KW, KH, KY), keel(-0.13, KW, KH, KY)]), { color: FED.white }));
  L.push(part(loft([keel(0.13, KW, KH, KY), keel(0.21, KW * 0.86, KH * 0.7, KY + KH * 0.15), keel(0.27, KW * 0.4, 0.012, -0.052)]), { color: FED.white }));
  // the hangar: walls down its sides, a dark ceiling and dark ends, lights
  // down the walls and round the mouth, and guide lights along the ceiling
  // that chase forward (what it launches drops out of it, nose first)
  const c = min(KW, KH) * 0.18;
  const [xo, xi, yb, yt] = [KW / 2, KW / 2 - 0.024, KY - KH / 2, KY + KH / 2];
  const wall = [part(loft([-0.13, 0.13].map((z) => ({ z, pts: [[xo, yb + c], [xo, yt], [xi, yt], [xi, yb], [xo - c, yb]] }))), { color: FED.white })];
  wall.push(part(new THREE.BoxGeometry(0.003, 0.004, 0.24), { at: [xi - 0.0012, KY - 0.006, 0], to: 'glow', color: FED_BLUE }));
  wall.push(rod([xi, yb - 0.001, -0.13], [xi, yb - 0.001, 0.13], 0.0025, 0.0025, { to: 'glow', color: FED_BLUE }, 4));
  L.push(...wall, ...mirror(wall));
  L.push(part(new THREE.BoxGeometry(xi * 2 + 0.002, 0.014, 0.262), { at: [0, -0.067, 0], to: 'metal', color: '#1a1e24' }));
  for (const sz of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(xi * 2 + 0.002, 0.036, 0.004), { at: [0, -0.091, sz * 0.129], to: 'metal', color: '#1a1e24' }));
    L.push(rod([-xi, yb - 0.001, sz * 0.13], [xi, yb - 0.001, sz * 0.13], 0.0025, 0.0025, { to: 'glow', color: FED_BLUE }, 4));
  }
  const GUIDES = 7;
  for (let i = 0; i < GUIDES; i++) {
    for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.01, 0.003, 0.014), { at: [sx * 0.026, -0.0745, -0.105 + i * 0.035], to: 'glow', color: [3.2, 2.2, 0.8], mark: `guide${i}` }));
  }
  // rows of windows down the flanks, lit (a few dark), and a row along the keel
  for (const sx of [-1, 1]) {
    for (let z = -0.43; z < 0.24; z += 0.026) {
      const [, w, h, y] = measure(HULL, z);
      const s = (measure(HULL, z + 0.005)[1] - measure(HULL, z - 0.005)[1]) / 0.02;
      for (const dy of [-0.075, 0.05]) {
        if (k.rand() < 0.16) continue;
        L.push(part(new THREE.PlaneGeometry(0.013, 0.006), { at: [sx * (w / 2 + 0.002), y + dy * h, z], rot: [0, atan2(sx, -sx * s), 0], to: 'glow', color: [1.5, 1.9, 2.8] }));
      }
    }
    for (let z = -0.31; z < -0.14; z += 0.026) L.push(part(new THREE.PlaneGeometry(0.012, 0.005), { at: [sx * (KW / 2 + 0.002), KY, z], rot: [0, (sx * PI) / 2, 0], to: 'glow', color: [1.5, 1.9, 2.8] }));
    // the blue-lit seam along the top of each flank
    const corner = (z) => {
      const [, w, h, y] = measure(HULL, z);
      return [sx * (w / 2 + 0.0015), y + h * 0.14, z];
    };
    for (let i = 1; i < 4; i++) L.push(rod(corner(HULL[i][0]), corner(HULL[i + 1][0]), 0.0025, 0.0025, { to: 'glow', color: FED_BLUE }, 4));
  }
  // the deck down its back, sloping into the prow
  L.push(
    part(
      loft([
        { z: -0.44, pts: trap8(0.13, 0.11, 0.03, 0.006, 0.07) },
        { z: 0.05, pts: trap8(0.13, 0.11, 0.03, 0.006, 0.07) },
        { z: 0.2, pts: trap8(0.08, 0.06, 0.012, 0.004, 0.047) },
      ]),
      { color: FED.white },
    ),
  );
  // twin turrets along it
  for (const [x, z] of [
    [0.04, -0.17],
    [-0.04, -0.17],
    [0.04, -0.05],
    [-0.04, -0.05],
    [0, 0.08],
  ]) {
    const y = z < 0.05 ? 0.085 : 0.085 - ((z - 0.05) / 0.15) * 0.032;
    L.push(part(new THREE.CylinderGeometry(0.015, 0.018, 0.012, 10), { at: [x, y + 0.004, z], color: FED.grey }));
    for (const dx of [-0.005, 0.005]) L.push(rod([x + dx, y + 0.008, z], [x + dx, y + 0.008, z + 0.045], 0.0022, 0.0022, { to: 'metal', color: FED.dark }, 4));
  }
  // and kit along it: vents, hatches, aerials
  for (let i = 0; i < 18; i++) {
    const z = -0.42 + k.rand() * 0.42;
    if (z > -0.3 && z < -0.2) continue;
    const [sx, sz] = [0.01 + 0.02 * k.rand(), 0.01 + 0.03 * k.rand()];
    L.push(part(new THREE.BoxGeometry(sx, 0.006, sz), { at: [(k.rand() - 0.5) * 0.08, 0.087, z], to: 'metal', color: k.rand() < 0.5 ? '#5d646d' : '#9aa1aa' }));
  }
  // the superstructure at its back, stepping up: a broad block with a band
  // of windows round it, the tower on that, and the bridge across the top
  // in blue, its windows lit, masts with red lights over it. Each is rows
  // of [z, width at the foot, at the top, height, y], and a band of lit
  // windows round it at a height
  const tier = (rows, color, band) => {
    const at = (z, grow = 1, hh) => {
      const [, wb, wt, h, y] = measure(rows, z);
      return { z, pts: scaled(trap8(wb, wt, hh ?? h, min(wt, h) * 0.12, hh ? band : y), grow, 1) };
    };
    L.push(part(loft(rows.map(([z]) => at(z))), { color }));
    if (band) L.push(part(loft([at(rows[0][0] + 0.008, 1.02, 0.007), at(rows[1][0], 1.02, 0.007), at(rows[1][0] + (rows[2][0] - rows[1][0]) * 0.5, 1.02, 0.007)]), { to: 'glow', color: [1.6, 2.2, 3.2] }));
  };
  tier(
    [
      [-0.45, 0.13, 0.11, 0.05, 0.1],
      [-0.26, 0.13, 0.11, 0.05, 0.1],
      [-0.19, 0.11, 0.09, 0.012, 0.081],
    ],
    FED.white,
    0.106,
  );
  tier(
    [
      [-0.44, 0.09, 0.07, 0.07, 0.155],
      [-0.34, 0.09, 0.07, 0.07, 0.155],
      [-0.3, 0.07, 0.05, 0.03, 0.135],
    ],
    FED.white,
  );
  tier(
    [
      [-0.435, 0.12, 0.1, 0.026, 0.197],
      [-0.34, 0.15, 0.13, 0.034, 0.199],
      [-0.3, 0.11, 0.09, 0.012, 0.19],
    ],
    FED.blue,
    0.2,
  );
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.035, 0.212, -0.39], [sx * 0.035, 0.255, -0.4], 0.003, 0.0018, { color: FED.grey }, 5));
    L.push(ball(0.0055, [sx * 0.035, 0.257, -0.4], 1, { to: 'glow', color: [5.5, 0.7, 0.5], mark: 'mast' }, 6));
  }
  // the wings at the stern, out to the nacelles: blue stripes, the engine
  // nacelle (its intake glowing, bands round it, the engine behind) and a
  // light on top
  const side = [];
  side.push(part(plateXZ([[0, -0.44], [0.16, -0.44], [0.16, -0.27], [0, -0.13]], 0.024, 0.006), { color: FED.white }));
  side.push(part(plateXZ([[0.03, -0.425], [0.13, -0.425], [0.13, -0.33], [0.03, -0.23]], 0.028), { color: FED.blue }));
  const nac = [0.165, 0, 0];
  side.push(part(turned([[0.028, -0.5], [0.038, -0.505], [0.046, -0.49], [0.048, -0.44], [0.048, -0.25], [0.044, -0.21], [0.034, -0.19], [0.022, -0.185]], 16), { at: nac, color: FED.white }));
  for (const z of [-0.42, -0.3]) side.push(part(turned([[0.0495, z], [0.0495, z + 0.02]], 16), { at: nac, color: FED.blue }));
  side.push(part(turned([[0.022, -0.186], [0.018, -0.178], [0.01, -0.172], [0.0001, -0.17]], 12), { at: nac, to: 'glow', color: FED_BLUE }));
  side.push(part(new THREE.CircleGeometry(0.03, 16), { at: [nac[0], nac[1], -0.5], rot: [0, PI, 0], to: 'glow', color: FED_JET }));
  side.push(part(new THREE.ConeGeometry(0.026, 0.05, 14, 1, true), { at: [nac[0], nac[1], -0.528], rot: [-PI / 2, 0, 0], to: 'glow', color: [0.6, 2.1, 5.6] }));
  side.push(ball(0.006, [nac[0], 0.049, -0.36], 1, { to: 'glow', color: FED_BLUE, mark: 'tips' }, 6));
  const right = place(side, [0.09, -0.035, 0], [0, 0, -0.1]);
  L.push(...right, ...mirror(right));
  // the engines in the stern
  for (const [x, y, r] of [
    [0, 0.012, 0.03],
    [0.056, 0, 0.022],
    [-0.056, 0, 0.022],
  ]) {
    L.push(part(turned([[r * 0.8, -0.469], [r * 0.8, -0.488], [r, -0.495], [r * 1.15, -0.485], [r * 1.15, -0.466]], 16), { at: [x, y, 0], to: 'metal', color: FED.dark }));
    L.push(part(new THREE.CircleGeometry(r * 0.8, 16), { at: [x, y, -0.487], rot: [0, PI, 0], to: 'glow', color: FED_JET }));
  }
  L.push(ball(0.006, [0, -0.012, 0.497], 1, { to: 'glow', color: [3, 3, 3.2], mark: 'nose' }, 6));

  const mats = fedMaterials(k, 7);
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(1 + 0.05 * sin(t * 2.3) + 0.02 * sin(t * 17));
      blink('mast', pulse(t, 1.6, 0, 0.1) ? 1 : 0.1);
      blink('tips', pulse(t, 1.3, 0.5, 0.08) ? 1.3 : 0.25);
      blink('nose', pulse(t, 2.4, 0.2, 0.06) ? 1.2 : 0.1);
      // the guide lights: a pair at a time, chasing forward to the mouth's front
      const head = Math.floor(t * 9) % (GUIDES + 3);
      for (let i = 0; i < GUIDES; i++) blink(`guide${i}`, i === head ? 1.2 : i === head - 1 ? 0.55 : 0.15);
    },
  };
}

// ── Evil Morty's guard ──

// One of Evil Morty's guard's fighters: small and quick, a fat round
// bullet of a body in Morty yellow, blue-grey on its belly, its nose and a
// band behind the canopy; a Morty under the bubble canopy; stubby wings
// with a blue-grey cannon pod at each tip, twin fins canted out on its
// back, and two engines glowing blue.
function mortyfighter(k) {
  const YELLOW = '#f6d33a';
  const TRIM = '#5d7591';
  const DARK = '#2b323b';
  const JET = [1.1, 2.5, 5.2];
  const L = [];
  // the body, lofted round, then painted: blue-grey on its nose, in a band
  // behind the canopy and underneath, yellow over the rest
  const RINGS = [
    [-0.36, 0.04],
    [-0.33, 0.075],
    [-0.26, 0.108],
    [-0.16, 0.13],
    [-0.05, 0.138],
    [-0.01, 0.14],
    [0.1, 0.134],
    [0.19, 0.115],
    [0.26, 0.088],
    [0.31, 0.058],
    [0.34, 0.03],
    [0.352, 0.0005],
  ];
  const SHAPE = [1.08, 0.92, 0.8, 2.2];
  const body = smoothLoft(RINGS.map(([z, r]) => ({ z, pts: oval(r * 2 * SHAPE[0], r * SHAPE[1], r * SHAPE[2], 0, 22, SHAPE[3]) })));
  L.push(
    ...painted(
      body,
      [
        [(x, y, z) => z > 0.26, TRIM],
        [(x, y, z) => z > -0.05 && z < -0.01, TRIM],
        [(x, y) => roundOf(SHAPE, x, y) < -0.62, TRIM],
      ],
      YELLOW,
    ),
  );
  // the bubble canopy, and the Morty under it
  L.push(part(new THREE.SphereGeometry(0.072, 22, 10, 0, PI * 2, 0, PI * 0.64), { at: [0, 0.112, 0.1], to: 'glass' }));
  L.push(...mortyPilot([0, 0.142, 0.1], 0.031));
  // the wings, short and broad: a blue-grey panel on each, the cannon pod
  // at its tip (its muzzle lit) and a light on the pod
  const wing = [];
  wing.push(part(plateXZ([[0, -0.2], [0.13, -0.17], [0.17, -0.13], [0.17, -0.05], [0, 0.08]], 0.036, 0.012), { color: YELLOW }));
  wing.push(part(plateXZ([[0.07, -0.165], [0.125, -0.15], [0.148, -0.12], [0.148, -0.055], [0.07, 0.0]], 0.04), { color: TRIM }));
  const pod = [0.178, 0, 0];
  wing.push(part(turned([[0.0001, -0.19], [0.015, -0.185], [0.023, -0.16], [0.024, -0.04], [0.02, 0.0], [0.011, 0.025], [0.0001, 0.03]], 12), { at: pod, color: TRIM }));
  wing.push(rod([pod[0], 0, 0.02], [pod[0], 0, 0.12], 0.0058, 0.0058, { to: 'metal', color: DARK }, 6));
  wing.push(bead(0.0068, [pod[0], 0, 0.121], 1, { to: 'glow', color: JET }));
  wing.push(bead(0.007, [pod[0], 0.023, -0.15], 1, { to: 'glow', color: [3.4, 2.6, 0.6], mark: 'tips' }));
  const right = place(wing, [0.1, -0.035, -0.06], [0, 0, -0.08]);
  L.push(...right, ...mirror(right));
  // twin fins on its back, canted out
  const fin = part(plateZY([[-0.34, 0], [-0.22, 0], [-0.3, 0.085], [-0.35, 0.09]], 0.02, 0.007), { at: [0.035, 0.07, 0], rot: [0, 0, -0.45], color: TRIM });
  L.push(fin, ...mirror([fin]));
  // the engines, fat and close together
  for (const sx of [-1, 1]) {
    const at = [sx * 0.05, -0.008, 0];
    L.push(part(turned([[0.026, -0.44], [0.034, -0.447], [0.042, -0.434], [0.044, -0.37], [0.04, -0.3], [0.03, -0.27]], 14), { at, color: TRIM }));
    L.push(part(turned([[0.0447, -0.405], [0.0447, -0.39]], 14), { at, color: YELLOW }));
    L.push(part(new THREE.CircleGeometry(0.028, 14), { at: [at[0], at[1], -0.438], rot: [0, PI, 0], to: 'glow', color: JET }));
    L.push(part(new THREE.ConeGeometry(0.024, 0.05, 12, 1, true), { at: [at[0], at[1], -0.465], rot: [-PI / 2, 0, 0], to: 'glow', color: [0.8, 2.0, 4.6], mark: 'jet' }));
  }

  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 242, spread: 4, seam: 0.88, detail: 0, min: 28 })), metalness: 0.12, roughness: 0.4 });
  paint.userData.density = 4;
  const mats = { paint, metal: standard(k, { metalness: 0.75, roughness: 0.35 }), glass: bubble(k, '#d6ecff', 0.22), glow: glowMaterial(k) };
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 29));
      blink('tips', pulse(t, 0.9, 0, 0.12) ? 1.3 : 0.2);
      blink('jet', Math.round(flicker(t * 1.8, 3) * 10) / 10);
    },
  };
}

// ── Evil Morty's own ──

// Evil Morty's own ship: longer and sharper than his guards', black with
// yellow down its flanks, a long low canopy wearing a black eye patch over
// its starboard side (the strap across the top of it), and Evil Morty under
// it, patched the same; long swept wings striped yellow along the front
// with a cannon under each, canards at the nose, twin fins, and two engines
// burning yellow.
function evilmortyship(k) {
  const BLACK = '#33353e';
  const PATCH = '#0c0d10';
  const YELLOW = '#f3c330';
  const GREY = '#474a54';
  const JET = [3.8, 2.3, 0.45];
  const L = [];
  const RINGS = [
    [-0.44, 0.032],
    [-0.41, 0.058],
    [-0.32, 0.076],
    [-0.15, 0.084],
    [0.02, 0.079],
    [0.16, 0.064],
    [0.25, 0.049],
    [0.29, 0.042],
    [0.4, 0.022],
    [0.47, 0.009],
    [0.5, 0.0005],
  ];
  const SHAPE = [1.3, 0.78, 0.62, 2.6];
  const body = smoothLoft(RINGS.map(([z, r]) => ({ z, pts: oval(r * 2 * SHAPE[0], r * SHAPE[1], r * SHAPE[2], 0, 24, SHAPE[3]) })));
  // yellow down each flank, and the cockpit's tub grey under the glass (so
  // the patch shows black against it)
  L.push(
    ...painted(
      body,
      [
        [(x, y, z) => z > -0.41 && z < 0.4 && abs(roundOf(SHAPE, x, y)) < 0.2, YELLOW],
        [(x, y, z) => z > 0.02 && z < 0.25 && roundOf(SHAPE, x, y) > 1.3, '#8a8e9a'],
      ],
      BLACK,
    ),
  );
  // the canopy, long and low, and Evil Morty under it
  const C = [0, 0.048, 0.13];
  const CS = [0.82, 0.85, 2.5];
  const CR = 0.05;
  L.push(part(new THREE.SphereGeometry(CR, 20, 10, 0, PI * 2, 0, PI * 0.62), { at: C, scale: CS, to: 'glass' }));
  L.push(...mortyPilot([0, 0.062, 0.11], 0.019, true));
  // the eye patch: a black panel over the canopy's starboard side, and its
  // strap up over the top and away down the port side
  L.push(part(new THREE.SphereGeometry(CR * 1.035, 14, 8, -0.25, 1.72, 0.12, 1.35), { at: C, scale: CS, color: PATCH }));
  const onCanopy = (theta, phi) => [C[0] - CR * 1.05 * CS[0] * cos(phi) * sin(theta), C[1] + CR * 1.05 * CS[1] * cos(theta), C[2] + CR * 1.05 * CS[2] * sin(phi) * sin(theta)];
  const strap = Array.from({ length: 8 }, (_, i) => onCanopy(0.2 + 1.1 * (i / 7) ** 2, 1.3 + 1.3 * (i / 7)));
  for (let i = 0; i < strap.length - 1; i++) L.push(rod(strap[i], strap[i + 1], 0.0028, 0.0028, { color: PATCH }, 4));
  // the wings: a yellow stripe along each, near its front, a long cannon
  // under it and a light at its tip
  const wing = [];
  wing.push(part(plateXZ([[0, 0.04], [0.26, -0.3], [0.3, -0.42], [0.255, -0.39], [0, -0.3]], 0.016, 0.005), { color: BLACK }));
  wing.push(part(plateXZ([[0.02, 0.0], [0.24, -0.29], [0.258, -0.33], [0.02, -0.04]], 0.019), { color: YELLOW }));
  wing.push(rod([0.12, -0.014, -0.22], [0.12, -0.014, 0.08], 0.0065, 0.0065, { to: 'metal', color: GREY }, 6));
  wing.push(rod([0.12, -0.014, 0.08], [0.12, -0.014, 0.13], 0.0035, 0.0035, { to: 'metal', color: GREY }, 6));
  wing.push(bead(0.007, [0.298, 0.004, -0.415], 1, { to: 'glow', color: [3.6, 2.6, 0.5], mark: 'tips' }));
  const right = place(wing, [0.07, -0.012, -0.04], [0, 0, -0.06]);
  L.push(...right, ...mirror(right));
  // the canards at its nose
  const canard = part(plateXZ([[0, 0.3], [0.075, 0.22], [0.08, 0.2], [0, 0.22]], 0.01, 0.003), { at: [0.035, -0.005, 0], color: BLACK });
  L.push(canard, ...mirror([canard]));
  // twin fins, canted out, yellow at their tips
  const fin = [];
  fin.push(part(plateZY([[-0.45, 0], [-0.3, 0], [-0.4, 0.1], [-0.455, 0.1]], 0.012, 0.0035), { color: BLACK }));
  fin.push(part(plateZY([[-0.43, 0.075], [-0.38, 0.075], [-0.4, 0.1], [-0.455, 0.1]], 0.0145), { color: YELLOW }));
  const fins = place(fin, [0.03, 0.03, 0], [0, 0, -0.42]);
  L.push(...fins, ...mirror(fins));
  // the engines, burning yellow
  for (const sx of [-1, 1]) {
    const at = [sx * 0.042, -0.004, 0];
    L.push(part(turned([[0.017, -0.475], [0.024, -0.48], [0.03, -0.468], [0.031, -0.42], [0.028, -0.36], [0.02, -0.33]], 14), { at, color: GREY }));
    L.push(part(turned([[0.0318, -0.455], [0.0318, -0.44]], 14), { at, color: YELLOW }));
    L.push(part(new THREE.CircleGeometry(0.019, 14), { at: [at[0], at[1], -0.473], rot: [0, PI, 0], to: 'glow', color: JET }));
    L.push(part(new THREE.ConeGeometry(0.016, 0.05, 12, 1, true), { at: [at[0], at[1], -0.5], rot: [-PI / 2, 0, 0], to: 'glow', color: [3.2, 1.7, 0.3], mark: 'jet' }));
  }

  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 236, spread: 10, seam: 0.6, detail: 0.15, min: 16 })), metalness: 0.25, roughness: 0.36 });
  paint.userData.density = 6;
  const mats = { paint, metal: standard(k, { metalness: 0.8, roughness: 0.3 }), glass: bubble(k, '#fff1c4', 0.24), glow: glowMaterial(k) };
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 31));
      blink('tips', pulse(t, 1.5, 0, 0.08) ? 1.3 : 0.15);
      blink('jet', Math.round(flicker(t * 1.4, 5) * 10) / 10);
    },
  };
}

// ── The Zigerion scam ship ──

// A hologram's grid: bright lines along two edges (so it tiles), a soft
// glow beside them and a faint wash between, on black (it's added on, so
// black is nothing).
function gridTexture() {
  return canvasTexture(64, (g, S) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(0, 0, S, 6);
    g.fillRect(0, 0, 6, S);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 1, S, 3);
    g.fillRect(1, 0, 3, S);
  });
}

// A Zigerion scam ship: angular and dark green-grey, faceted like a cut
// stone, jagged wings, a band of dark glass across its brow, cyan lit along
// its edges and in its engines, and on its back a gem on a plinth that
// throws the hologram: a cyan grid (the simulation its marks are kept in)
// over its back, over the tips of its wings and over a prow it hasn't got,
// carrying its blunt nose on to a point. The grid shimmers and creeps, and
// now and then the simulation glitches out.
function zigerion(k) {
  const HULL = '#4e5d51';
  const DARK = '#2f3a33';
  const PALE = '#7e8f80';
  const CYAN = [0.35, 2.4, 2.7];
  const HOLO = [0.25, 1.25, 1.5];
  const L = [];
  // the hull: rows of [z, width, height, y], a flattened hexagon with a
  // narrow top, cut off blunt at the front
  const ROWS = [
    [-0.43, 0.16, 0.06, 0],
    [-0.38, 0.28, 0.11, 0],
    [-0.12, 0.32, 0.135, 0.006],
    [0.1, 0.2, 0.1, 0],
    [0.26, 0.09, 0.05, -0.008],
    [0.3, 0.05, 0.026, -0.01],
  ];
  const ring = (z, grow = 1) => {
    const [, w, h, y] = measure(ROWS, z);
    return { z, pts: scaled(hex6(w, h, y, 0.16), grow, grow, y) };
  };
  L.push(part(loft(ROWS.map(([z]) => ring(z))), { color: HULL }));
  // the brow: dark glass over the top of it, forward
  const brow = (z) => {
    const p = ring(z, 1.04).pts;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return { z, pts: [mid(p[0], p[1]), p[1], p[2], mid(p[2], p[3])] };
  };
  L.push(part(loft([brow(0.02), brow(0.1), brow(0.2)]), { to: 'glass' }));
  // the projector on its back: a six-sided plinth, the gem on it
  L.push(part(new THREE.CylinderGeometry(0.035, 0.06, 0.035, 6), { at: [0, 0.085, -0.14], color: PALE }));
  L.push(part(new THREE.OctahedronGeometry(0.026), { at: [0, 0.128, -0.14], scale: [1, 1.5, 1], to: 'glow', color: CYAN, mark: 'gem' }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    L.push(part(new THREE.BoxGeometry(0.012, 0.006, 0.006), { at: [0.05 * sin(a), 0.079, -0.14 + 0.05 * cos(a)], rot: [0, a, -0.55], to: 'glow', color: CYAN }));
  }
  // what's really at the front: two blunt prongs either side of its nose
  const diamond = (w, h, cx, y) => [[cx + w / 2, y], [cx, y + h / 2], [cx - w / 2, y], [cx, y - h / 2]];
  for (const sx of [-1, 1]) {
    L.push(
      part(
        loft([
          { z: 0.16, pts: diamond(0.05, 0.04, sx * 0.05, -0.008) },
          { z: 0.31, pts: diamond(0.032, 0.026, sx * 0.045, -0.012) },
          { z: 0.35, pts: diamond(0.01, 0.01, sx * 0.04, -0.014) },
        ]),
        { color: DARK },
      ),
    );
  }
  // a keel fin under it, and plates and vents along its back
  L.push(part(plateZY([[-0.42, 0.01], [-0.18, 0.01], [-0.3, -0.07], [-0.41, -0.075]], 0.014, 0.003), { at: [0, -0.04, 0], color: DARK }));
  for (const [x, z, w, d] of [
    [0.05, -0.3, 0.03, 0.05],
    [-0.05, -0.3, 0.03, 0.05],
    [0.04, -0.02, 0.026, 0.04],
    [-0.04, -0.02, 0.026, 0.04],
    [0, -0.36, 0.05, 0.02],
  ]) {
    const [, , h, y] = measure(ROWS, z);
    L.push(part(new THREE.BoxGeometry(w, 0.008, d), { at: [x, y + h / 2 - 0.002, z], color: x ? PALE : DARK }));
  }
  // the hologram over its back, and the prow it carries on
  L.push(part(loft([ring(-0.445, 1.12), ring(-0.38, 1.12), ring(-0.12, 1.12), ring(-0.06, 1.1)]), { to: 'holo', color: HOLO }));
  L.push(part(loft([ring(0.22, 1.1), ring(0.3, 1.1), { z: 0.5, pts: hex6(0.008, 0.005, -0.018, 0.16) }]), { to: 'holo', color: HOLO }));
  // the wings: a darker inlay, cyan along the leading edge, the grid over
  // the tip
  const wing = [];
  wing.push(part(plateXZ([[0, -0.37], [0.2, -0.43], [0.37, -0.36], [0.31, -0.28], [0.35, -0.19], [0.14, -0.08], [0, -0.02]], 0.02, 0.004), { color: HULL }));
  wing.push(part(plateXZ([[0.04, -0.34], [0.18, -0.39], [0.25, -0.34], [0.12, -0.13], [0.04, -0.08]], 0.024), { color: DARK }));
  wing.push(rod([0.02, 0.0105, -0.038], [0.14, 0.0105, -0.092], 0.0025, 0.0025, { to: 'glow', color: CYAN }, 4));
  wing.push(rod([0.14, 0.0105, -0.092], [0.34, 0.0105, -0.196], 0.0025, 0.0025, { to: 'glow', color: CYAN }, 4));
  wing.push(part(plateXZ([[0.23, -0.43], [0.383, -0.36], [0.322, -0.28], [0.363, -0.187], [0.23, -0.115]], 0.044), { to: 'holo', color: HOLO }));
  const right = place(wing, [0.07, -0.022, 0], [0, 0, 0.04]);
  L.push(...right, ...mirror(right));
  // two fins canted out on its back, a light at each tip
  const fin = [];
  fin.push(part(plateZY([[-0.38, 0], [-0.24, 0], [-0.34, 0.1], [-0.4, 0.1]], 0.014, 0.003), { color: HULL }));
  fin.push(rod([0, 0.1, -0.395], [0, 0.003, -0.24], 0.0022, 0.0022, { to: 'glow', color: CYAN }, 4));
  const fins = place(fin, [0.06, 0.028, 0], [0, 0, -0.5]);
  L.push(...fins, ...mirror(fins));
  // the engines, angular, glowing cyan; and cyan along the hull's edges
  for (const sx of [-1, 1]) {
    L.push(part(loft([{ z: -0.47, pts: box8(0.064, 0.036, 0.008) }, { z: -0.37, pts: box8(0.07, 0.042, 0.009) }, { z: -0.33, pts: box8(0.05, 0.03, 0.006) }]), { at: [sx * 0.055, 0, 0], color: DARK }));
    L.push(part(new THREE.PlaneGeometry(0.054, 0.028), { at: [sx * 0.055, 0, -0.4715], rot: [0, PI, 0], to: 'glow', color: CYAN, mark: 'jet' }));
    const side = (z) => {
      const [, w, , y] = measure(ROWS, z);
      return [sx * (w / 2 + 0.002), y, z];
    };
    for (let i = 1; i < ROWS.length - 2; i++) L.push(rod(side(ROWS[i][0]), side(ROWS[i + 1][0]), 0.0028, 0.0028, { to: 'glow', color: CYAN }, 4));
  }

  const grid = k.own(gridTexture());
  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 214, spread: 18, seam: 0.55, detail: 0.35, min: 10 })), metalness: 0.4, roughness: 0.48 }),
    glass: standard(k, { color: '#0c2422', metalness: 0.9, roughness: 0.08, emissive: '#0a3a38', emissiveIntensity: 0.6 }),
    glow: glowMaterial(k),
    holo: k.own(new THREE.MeshBasicMaterial({ vertexColors: true, map: grid, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
  };
  mats.paint.userData.density = 6;
  mats.holo.userData.density = 14;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      // the hologram shimmering, its grid creeping over it, and now and
      // then a glitch: the simulation dropping out for a moment
      const glitch = pulse(t, 5.3, 0.1, 0.02) || pulse(t, 5.3, 0.135, 0.012);
      mats.holo.color.setScalar(glitch ? 0.1 : 0.7 + 0.18 * sin(t * 1.3) + 0.08 * sin(t * 6.1 + 1));
      grid.offset.set(0, (t * 0.04) % 1);
      mats.glow.color.setScalar(flicker(t, 19));
      blink('gem', glitch ? 0.3 : Math.round((0.85 + 0.15 * sin(t * 2.6)) * 20) / 20);
    },
  };
}

// ── Krombopulos Michael's ship ──

// Krombopulos Michael's ship, a Gromflomite assassin's (the bug family of
// trafficModels.js's gromflomite, darker): an insect in dark chitin, its
// abdomen in rings behind, the thorax and the head, great red compound
// eyes for its windows, mandibles, feelers swept back, legs folded under
// it; smoky wings over its back, red-veined and buzzing; red lights down
// its sides coming on one after another and a red glow at the end of its
// abdomen; and out of its chin, the prow: a long steel knife.
function krombopulos(k) {
  const CHITIN = '#3c4423';
  const BROWN = '#3a2e1b';
  const DARK = '#15170c';
  const STEEL = '#b9c0c8';
  const RED = [4.4, 0.5, 0.28];
  const L = [];
  // the abdomen, in rings, each lapping over the next
  const rings = [
    [-0.07, 0.068, 0.006],
    [-0.13, 0.08, 0.004],
    [-0.2, 0.085, 0],
    [-0.27, 0.081, -0.004],
    [-0.34, 0.071, -0.008],
    [-0.4, 0.056, -0.012],
    [-0.45, 0.036, -0.016],
    [-0.48, 0.016, -0.019],
  ];
  for (let i = 0; i < rings.length - 1; i++) {
    const [za, ra, ya] = rings[i];
    const [zb, rb, yb] = rings[i + 1];
    const prof = [[rb * 0.8, zb - za], [rb * 1.02, zb - za + 0.012], [ra * 1.03, -0.008], [ra * 0.86, 0.004]];
    L.push(part(turned(prof, 14), { at: [0, ya, za], rot: [atan2(ya - yb, za - zb) * 0.6, 0, 0], scale: [1.1, 0.8, 1], color: i % 2 ? BROWN : CHITIN }));
    // a red light low on each side of the ring, for update() to run along
    if (i < 6) for (const sx of [-1, 1]) L.push(bead(0.007, [sx * ra * 1.05, ya - ra * 0.25, za - 0.03], 1, { to: 'glow', color: RED, mark: `side${i}` }));
  }
  L.push(part(new THREE.ConeGeometry(0.014, 0.04, 8, 1, true), { at: [0, -0.019, -0.5], rot: [-PI / 2, 0, 0], to: 'glow', color: [3.2, 0.35, 0.15], mark: 'jet' }));
  // the thorax, the head, the compound eyes (its windows)
  L.push(ball(0.088, [0, 0.008, 0.03], [1.05, 0.82, 1.25], { color: CHITIN }, 14));
  L.push(ball(0.062, [0, 0.014, 0.15], [1.05, 0.85, 0.9], { color: BROWN }, 14));
  for (const sx of [-1, 1]) {
    L.push(ball(0.05, [sx * 0.047, 0.03, 0.16], [0.8, 1, 1.05], { to: 'eyes', uv: 'keep' }, 14));
    // mandibles, feelers, and legs folded under
    L.push(between(new THREE.ConeGeometry(0.011, 1, 6), [sx * 0.035, -0.02, 0.19], [sx * 0.018, -0.048, 0.26], { color: DARK }));
    L.push(rod([sx * 0.02, 0.06, 0.17], [sx * 0.05, 0.1, 0.1], 0.0035, 0.003, { color: DARK }, 5));
    L.push(rod([sx * 0.05, 0.1, 0.1], [sx * 0.085, 0.105, -0.02], 0.003, 0.0018, { color: DARK }, 5));
    for (const z0 of [0.08, 0.03, -0.02]) {
      const hip = [sx * 0.05, -0.04, z0];
      const knee = [sx * 0.105, -0.075, z0 - 0.03];
      const foot = [sx * 0.08, -0.1, z0 - 0.13];
      L.push(rod(hip, knee, 0.01, 0.008, { color: DARK }, 5), rod(knee, foot, 0.008, 0.004, { color: DARK }, 5));
    }
    // an engine pod on each side of the thorax, glowing red behind
    const at = [sx * 0.088, 0.0, 0];
    L.push(part(turned([[0.012, -0.075], [0.018, -0.078], [0.022, -0.068], [0.022, 0.02], [0.016, 0.045], [0.0001, 0.05]], 10), { at, color: DARK }));
    L.push(part(new THREE.CircleGeometry(0.014, 10), { at: [at[0], at[1], -0.074], rot: [0, PI, 0], to: 'glow', color: RED, mark: 'jet' }));
  }
  // the knife: its blade out of its chin, the fuller dark, a guard where it
  // meets the head
  L.push(part(plateZY([[0.17, 0.012], [0.42, 0.008], [0.5, -0.004], [0.455, -0.017], [0.34, -0.028], [0.17, -0.026]], 0.013, 0.0055), { at: [0, -0.025, 0], to: 'metal', color: STEEL }));
  L.push(part(plateZY([[0.21, 0.001], [0.4, -0.001], [0.4, -0.006], [0.21, -0.006]], 0.016), { at: [0, -0.025, 0], to: 'metal', color: '#5a6068' }));
  L.push(part(new THREE.BoxGeometry(0.05, 0.026, 0.016), { at: [0, -0.03, 0.2], color: DARK }));
  // the wings over its back, one mesh, buzzed by moving its vertices
  const wingO = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * PI * 2;
    const x = 0.2 + 0.2 * cos(a);
    wingO.push([x, (0.035 + 0.025 * min(1, x / 0.15)) * sin(a)]);
  }
  const wing = [part(plateXZ(wingO, 0.004), { to: 'wings', uv: (x, y, z) => [x / 0.4, z / 0.13 + 0.5] })];
  const wings = place(wing, [0.035, 0.068, 0.05], [0, 1.28, 0.12]);
  L.push(...wings, ...mirror(wings));

  const veins = canvasTexture(128, (g, S) => {
    g.fillStyle = '#5a5046';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(120,26,18,0.7)';
    g.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(0, S / 2);
      g.bezierCurveTo(S * 0.3, S / 2 + i * 4, S * 0.6, S / 2 + i * 12, S, S / 2 + i * 16);
      g.stroke();
    }
    g.lineWidth = 1;
    for (let x = 14; x < S; x += 14 + k.rand() * 12) {
      g.beginPath();
      g.moveTo(x, S * 0.15);
      g.lineTo(x + 5, S * 0.85);
      g.stroke();
    }
  });
  const facets = canvasTexture(128, (g, S) => {
    g.fillStyle = '#1c0404';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) {
      for (let x = (y / 8) % 2 ? 4 : 0; x < S; x += 8) {
        g.fillStyle = `rgb(${110 + k.rand() * 40},${12 + k.rand() * 10},${10})`;
        g.beginPath();
        g.arc(x + 4, y + 4, 3, 0, PI * 2);
        g.fill();
      }
    }
  });
  facets.repeat.set(6, 3);
  const mats = {
    paint: standard(k, { map: k.own(chitin(k.rand)), metalness: 0.25, roughness: 0.4 }),
    metal: standard(k, { metalness: 0.9, roughness: 0.22 }),
    eyes: standard(k, { map: k.own(facets), metalness: 0.2, roughness: 0.22, emissive: '#3a0402', emissiveIntensity: 0.8 }),
    glow: glowMaterial(k),
    wings: k.own(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        map: k.own(veins),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        forceSinglePass: true, // (thin as a leaf: one pass draws the same)
        depthWrite: false,
        roughness: 0.3,
        metalness: 0,
        iridescence: 0.5,
        iridescenceIOR: 1.3,
      }),
    ),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  const flap = flapper(M.wings, 0.035, 0.068, 0.3);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      flap(0.05 + 0.05 * sin(t * PI * 2 * 11));
      mats.glow.color.setScalar(flicker(t, 23));
      // the lights down its sides, one after another toward the tail
      const head = Math.floor(t * 6) % 9;
      for (let i = 0; i < 6; i++) blink(`side${i}`, i === head ? 1.3 : i === head - 1 ? 0.5 : 0.15);
    },
  };
}

// Mottled chitin: a grey ground (the vertex colours tint it) with darker
// blotches and fine growth lines.
function chitin(rand) {
  return canvasTexture(128, (g, S) => {
    g.fillStyle = grey(215);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(30,25,15,${0.08 + rand() * 0.16})`;
      g.beginPath();
      g.arc(rand() * S, rand() * S, 2 + rand() * 9, 0, PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(25,20,10,0.35)';
    for (let y = 0; y < S; y += 9) g.fillRect(0, y, S, 1);
  });
}

export const FLEET = { gunship, fedcruiser, mortyfighter, evilmortyship, zigerion, krombopulos };
