// More of the Star Wars galaxy's traffic (see trafficModels.js for how a
// model is put together and what it returns): the ordinary ships going about
// their business, and the Empire's best hunting you.
//
// freighter: a YT-2400 light freighter (the Outrider's type), a round disc
// of a hull in weathered cream plating with a few patches of other paint,
// its cockpit tube out to starboard on a short connector, a turret on its
// back and the engines glowing blue-white across the stern.
// transport: a GR-75 medium transport (the Rebels' at Hoth), a long shell of
// a hull open on top along the middle and packed with cargo pods, its bridge
// up at the bow and a row of blue engines astern.
// corvette: a CR90 corvette (Tantive IV), the wide flat hammerhead of a bow
// on a narrow neck, the long midsection with its turrets and the great engine
// block with its eleven engines; off-white, striped red.
// tieadvanced: Darth Vader's TIE Advanced x1, the ball cockpit on a longer
// fuselage, its wings bent in toward it, two engines glowing red-orange and a
// slow red light at the back.
//
// Every model points its nose along +z with +y up, so starboard is -x.

import * as THREE from 'three';
import { part, place, mirror, rod, meshes, blinker, loft, box8, scaled, plateZY, turned, upright, ball, inset, canvasTexture, grey, panelTexture, solarTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';

const { PI, sin, cos, atan2, hypot } = Math;

// Turned about y through only part of a turn, from phi0 for span (phi 0 is
// the nose, +z; PI / 2 is +x): a band of plating on a disc, an engine
// housing round its stern. The profile is [[r, y], …] bottom to top.
const arc = (profile, phi0, span, seg = 8) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, phi0, span);

// A quarter of a circle, r across and h tall, for a dome turned on upright().
function domeProfile(r, h, base = 0) {
  const pts = [[r, 0]];
  if (base) pts.push([r, base]);
  for (let i = 1; i <= 6; i++) pts.push([r * cos((i / 6) * (PI / 2)), base + h * sin((i / 6) * (PI / 2))]);
  return pts;
}

// Grime over a plating texture: dark smudges, thin streaks and a few
// scorch marks, drawn on the texture's own canvas.
function weather(tex, rand, amount = 1) {
  const g = tex.image.getContext('2d');
  const S = tex.image.width;
  for (let i = 0; i < 30 * amount; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 5 + rand() * 18;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(50,42,32,${0.16 + rand() * 0.2})`);
    grad.addColorStop(1, 'rgba(50,42,32,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 40 * amount; i++) {
    g.fillStyle = `rgba(56,46,36,${0.05 + rand() * 0.1})`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 10 + rand() * 40);
  }
  for (let i = 0; i < 4 * amount; i++) {
    g.fillStyle = `rgba(24,20,18,${0.2 + rand() * 0.2})`;
    g.beginPath();
    g.ellipse(rand() * S, rand() * S, 3 + rand() * 8, 2 + rand() * 5, rand() * PI, 0, PI * 2);
    g.fill();
  }
  tex.needsUpdate = true;
}

// ── YT-2400 light freighter ──

function freighter(k) {
  const CREAM = '#d6cfba';
  const GREY = '#a3a199';
  const DARK = '#383b40';
  const PATCH = ['#9c7a60', '#7f8c98', '#a8756a', '#8f957c', '#c9bfa2'];
  const L = [];
  const R = 0.42;
  // the disc, turned about y from the middle of the belly out to the rim and
  // back in over the deck, which slopes up to a raised ring, then the hump
  L.push(part(upright([[0, -0.086], [0.1, -0.086], [0.13, -0.073], [0.33, -0.047], [0.4, -0.031], [R, -0.018], [R, 0.018], [0.4, 0.031], [0.34, 0.045], [0.2, 0.07], [0.19, 0.082], [0.125, 0.09], [0.115, 0.102], [0.06, 0.109], [0, 0.11]], 44), { color: CREAM }));
  // the deck's height at radius r (two slopes, either side of r 0.34)
  const deck = (r) => (r > 0.34 ? 0.031 + (0.4 - r) * (0.014 / 0.06) : 0.045 + (0.34 - r) * (0.025 / 0.14));
  // the dark trench round the rim
  L.push(part(arc([[R + 0.0015, -0.006], [R + 0.0015, 0.006]], 0, PI * 2, 44), { to: 'metal', color: DARK }));
  // patches of other paint, where plates have been replaced
  for (const [phi, span, r0, r1, c] of [
    [0.45, 0.32, 0.22, 0.32, 0],
    [2.1, 0.5, 0.24, 0.33, 1],
    [3.55, 0.28, 0.21, 0.3, 2],
    [1.35, 0.24, 0.345, 0.395, 3],
    [5.75, 0.36, 0.345, 0.395, 4],
    [4.3, 0.26, 0.23, 0.31, 0],
  ]) {
    L.push(part(arc([[r1, deck(r1) + 0.0016], [r0, deck(r0) + 0.0016]], phi, span, 4), { color: PATCH[c] }));
  }
  // ribs radiating over the deck, and hatches and vents between them
  for (let i = 0; i < 10; i++) {
    const phi = (i + 0.5) * (PI / 5);
    L.push(...place([part(new THREE.BoxGeometry(0.009, 0.007, 0.135), { at: [0, deck(0.27) + 0.002, 0.27], rot: [0.17, 0, 0], color: GREY })], undefined, [0, phi, 0]));
  }
  for (let i = 0; i < 16; i++) {
    const phi = k.rand() * PI * 2;
    const r = 0.22 + k.rand() * 0.16;
    const [w, d] = [0.02 + k.rand() * 0.03, 0.02 + k.rand() * 0.04];
    const dark = k.rand() < 0.4;
    L.push(...place([part(new THREE.BoxGeometry(w, 0.005, d), { at: [0, deck(r) + 0.001, r], rot: [r > 0.34 ? 0.23 : 0.17, 0, 0], to: dark ? 'metal' : 'paint', color: dark ? '#5a5d61' : GREY })], undefined, [0, phi, 0]));
  }
  // the hump's ring of vents, and the boarding hatches on the belly
  for (let i = 0; i < 12; i++) {
    const phi = (i / 12) * PI * 2;
    L.push(part(new THREE.BoxGeometry(0.018, 0.006, 0.004), { at: [sin(phi) * 0.158, 0.076, cos(phi) * 0.158], rot: [0, phi, 0], to: 'metal', color: '#2c2f33' }));
  }
  for (const z of [0.18, -0.2]) L.push(part(new THREE.BoxGeometry(0.07, 0.004, 0.06), { at: [0, -0.078, z], to: 'metal', color: '#55585c' }));

  // the dorsal turret, up on a mount on the hump: its dome and twin cannons
  L.push(part(new THREE.CylinderGeometry(0.04, 0.056, 0.036, 16), { at: [0, 0.124, 0], color: GREY }));
  L.push(part(upright(domeProfile(0.048, 0.036, 0.008), 18), { at: [0, 0.14, 0], color: CREAM }));
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.014, 0.016, 0.03), { at: [sx * 0.019, 0.158, 0.04], color: GREY }));
    L.push(rod([sx * 0.019, 0.158, 0.05], [sx * 0.019, 0.158, 0.155], 0.0062, 0.0048, { to: 'metal', color: DARK }, 6));
  }
  L.push(part(new THREE.BoxGeometry(0.03, 0.01, 0.004), { at: [0, 0.172, 0.03], rot: [-0.6, 0, 0], to: 'glass' }));
  // and the ventral one under the belly
  L.push(part(new THREE.CylinderGeometry(0.03, 0.036, 0.014, 14), { at: [0, -0.092, 0.03], color: GREY }));
  L.push(part(upright(domeProfile(0.028, 0.02), 14), { at: [0, -0.098, 0.03], rot: [PI, 0, 0], color: CREAM }));
  for (const sx of [-1, 1]) L.push(rod([sx * 0.011, -0.108, 0.04], [sx * 0.011, -0.108, 0.12], 0.0045, 0.0035, { to: 'metal', color: DARK }, 6));

  // the cockpit: a tube out to starboard, its windows round the nose
  const CX = -0.58;
  const tube = [[0, -0.17], [0.03, -0.16], [0.052, -0.12], [0.062, -0.07], [0.066, -0.02], [0.066, 0.28], [0.064, 0.32], [0.058, 0.36], [0.046, 0.395], [0.028, 0.42], [0, 0.43]];
  L.push(part(turned(tube, 18), { at: [CX, 0, 0], color: CREAM }));
  L.push(part(turned([[0.0592, 0.352], [0.047, 0.396], [0.0288, 0.4215], [0, 0.4315]], 18), { at: [CX, 0, 0], to: 'glass' }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    const p = (r, z) => [CX + cos(a) * r, sin(a) * r, z];
    L.push(rod(p(0.06, 0.35), p(0.048, 0.396), 0.003, 0.003, { color: CREAM }, 4), rod(p(0.048, 0.396), p(0.008, 0.43), 0.003, 0.003, { color: CREAM }, 4));
  }
  L.push(part(turned([[0.0605, 0.344], [0.0605, 0.356]], 18), { at: [CX, 0, 0], color: GREY }));
  // bands round the tube, and its tail cone with a vent at the tip
  for (const z of [0.05, 0.2]) L.push(part(turned([[0.0675, z], [0.0675, z + 0.016]], 18), { at: [CX, 0, 0], color: GREY }));
  L.push(part(turned([[0.0001, -0.172], [0.018, -0.168], [0.03, -0.162], [0.04, -0.148]], 18), { at: [CX, 0, 0], color: GREY }));
  L.push(part(new THREE.CircleGeometry(0.012, 10), { at: [CX, 0, -0.1715], rot: [0, PI, 0], to: 'metal', color: DARK }));
  // the connector from the hull's starboard side to the tube
  L.push(part(loft([{ z: 0.37, pts: box8(0.17, 0.074, 0.018) }, { z: 0.46, pts: box8(0.13, 0.064, 0.015) }, { z: 0.535, pts: box8(0.11, 0.06, 0.014) }]).rotateY(-PI / 2), { at: [0, 0, 0.12], color: GREY }));
  L.push(part(new THREE.BoxGeometry(0.1, 0.004, 0.07), { at: [-0.46, 0.032, 0.12], color: '#8e8c86' }));

  // the engines: a dark housing round the back of the rim, the glow along it
  const back = PI - 0.8;
  L.push(part(arc([[0.395, -0.036], [0.429, -0.027], [0.431, 0.027], [0.395, 0.036]], back, 1.6, 20), { to: 'metal', color: DARK }));
  L.push(part(arc([[0.4325, -0.017], [0.4325, 0.017]], back + 0.04, 1.52, 20), { to: 'glow', color: [1.9, 2.9, 5.6] }));
  // running lights: red to port on the rim, green on the cockpit's flank
  L.push(ball(0.007, [R + 0.004, 0, 0.02], 1, { to: 'glow', color: [7.5, 0.6, 0.45], mark: 'lights' }, 6));
  L.push(ball(0.007, [CX - 0.066, 0, 0.1], 1, { to: 'glow', color: [0.5, 3.2, 1], mark: 'lights' }, 6));

  const tex = k.own(panelTexture(k.rand, { min: 16, base: 216, spread: 11, seam: 0.64, detail: 0.3 }));
  weather(tex, k.rand, 0.45);
  const mats = {
    paint: standard(k, { map: tex, metalness: 0.2, roughness: 0.62 }),
    metal: standard(k, { metalness: 0.75, roughness: 0.4 }),
    glass: standard(k, { color: '#2a4458', metalness: 0.7, roughness: 0.16 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 7));
      blink('lights', pulse(t, 1.8, 0, 0.1) ? 1 : 0.15);
    },
  };
}

// ── GR-75 medium transport ──

// Cargo pods' plating: corrugated ribs, a seam at the edge and a stencilled
// block or two. Grey, so each pod's colour shows through.
function cargoTexture(rand) {
  return canvasTexture(128, (g, S) => {
    g.fillStyle = grey(212);
    g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 8) {
      g.fillStyle = grey(176);
      g.fillRect(x, 0, 2, S);
      g.fillStyle = grey(236);
      g.fillRect(x + 2, 0, 1, S);
    }
    g.fillStyle = grey(110);
    g.fillRect(0, 0, S, 3);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = grey(rand() < 0.5 ? 90 : 240);
      g.fillRect(rand() * S, 8 + rand() * (S - 20), 6 + rand() * 18, 3 + rand() * 5);
    }
  });
}

function transport(k) {
  const HULL = '#b8b2a3';
  const BAND = '#857f73';
  const DARK = '#3b3e43';
  const PODS = ['#b3ab98', '#8d9a8e', '#a68b70', '#8593a3', '#c4bdac', '#b0905f', '#9a938a', '#a1785e'];
  const L = [];
  // the hull's cross-section at z: an ellipse w × h (half-sizes) centred at
  // y, its top cut away into the cargo bay as far as `open` says (0 closed,
  // 1 open), leaving the shell's walls standing up either side
  const LIP = 0.42;
  const K = 8;
  const N = 14;
  const sec = (z, w, h, y, open) => {
    const pts = [];
    for (let i = 0; i <= K; i++) {
      const a = -PI / 2 + (i / K) * (LIP + PI / 2);
      pts.push([w * cos(a), y + h * sin(a)]);
    }
    const yr = y + h * sin(LIP);
    const xi = w * cos(LIP) * 0.88;
    const D = (yr - y + h) * 0.78;
    for (let j = 1; j < N; j++) {
      const a = LIP + (j / N) * (PI - 2 * LIP);
      const f = ((j - 1) / (N - 2)) * PI;
      const [cx, cy] = [w * cos(a), y + h * sin(a)];
      const [bx, by] = [xi * cos(f), yr - D * sin(f)];
      pts.push([cx + (bx - cx) * open, cy + (by - cy) * open]);
    }
    for (let i = 0; i < K; i++) {
      const a = PI - LIP + (i / K) * (LIP + PI / 2);
      pts.push([w * cos(a), y + h * sin(a)]);
    }
    return { z, pts };
  };
  L.push(
    part(
      loft([
        sec(-0.44, 0.1, 0.07, 0.004, 0),
        sec(-0.37, 0.135, 0.09, 0.002, 0),
        sec(-0.335, 0.142, 0.097, 0.001, 0.22),
        sec(-0.305, 0.147, 0.102, 0, 0.58),
        sec(-0.28, 0.149, 0.105, 0, 0.88),
        sec(-0.265, 0.15, 0.106, 0, 1),
        sec(0.14, 0.15, 0.106, 0, 1),
        sec(0.16, 0.148, 0.105, 0.001, 0.86),
        sec(0.19, 0.144, 0.102, 0.002, 0.56),
        sec(0.225, 0.137, 0.098, 0.004, 0.24),
        sec(0.27, 0.128, 0.094, 0.006, 0),
        sec(0.37, 0.1, 0.078, 0.01, 0),
        sec(0.44, 0.07, 0.058, 0.013, 0),
        sec(0.48, 0.042, 0.037, 0.015, 0),
        sec(0.5, 0.016, 0.015, 0.016, 0),
      ]),
      { color: HULL },
    ),
  );
  // a dark lip along the top of each wall, a band along each flank and
  // the keel
  const rim = (sx, z) => [sx * 0.15 * cos(LIP), 0.106 * sin(LIP) + 0.002, z];
  for (const sx of [-1, 1]) {
    L.push(rod(rim(sx, -0.27), rim(sx, 0.14), 0.005, 0.005, { color: BAND }, 6));
    L.push(part(new THREE.BoxGeometry(0.004, 0.012, 0.38), { at: [sx * 0.1505, -0.012, -0.065], rot: [0, 0, sx * 0.1], color: BAND }));
  }
  L.push(part(new THREE.BoxGeometry(0.03, 0.01, 0.44), { at: [0, -0.104, -0.06], color: BAND }));

  // the cargo pods, packed into the bay two abreast, a second tier on them
  // and a few more up the middle
  const pod = (w, h, d) =>
    loft([
      { z: -d / 2, pts: box8(w * 0.8, h * 0.8, h * 0.24) },
      { z: -d / 2 + 0.01, pts: box8(w, h, h * 0.3) },
      { z: d / 2 - 0.01, pts: box8(w, h, h * 0.3) },
      { z: d / 2, pts: box8(w * 0.8, h * 0.8, h * 0.24) },
    ]);
  const colour = () => PODS[Math.floor(k.rand() * PODS.length)];
  for (const z of [-0.22, -0.115, -0.01, 0.095]) {
    for (const sx of [-1, 1]) {
      L.push(part(pod(0.11, 0.07, 0.1), { at: [sx * 0.058, -0.025, z], to: 'cargo', color: colour() }));
      const h = 0.07 + k.rand() * 0.02;
      L.push(part(pod(0.108, h, 0.1), { at: [sx * 0.058, 0.012 + h / 2, z + (k.rand() - 0.5) * 0.008], to: 'cargo', color: colour() }));
    }
  }
  for (const [z, d] of [
    [-0.19, 0.1],
    [-0.065, 0.12],
    [0.065, 0.1],
  ]) {
    L.push(part(pod(0.09, 0.05, d), { at: [0, 0.112, z], to: 'cargo', color: colour() }));
  }

  // the bridge up on the bow: a rounded cabin with windows round its front
  const cab = [
    { z: 0.2, pts: box8(0.07, 0.04, 0.012, 0.09) },
    { z: 0.24, pts: box8(0.1, 0.064, 0.02, 0.1) },
    { z: 0.34, pts: box8(0.1, 0.064, 0.02, 0.098) },
    { z: 0.39, pts: box8(0.08, 0.046, 0.014, 0.09) },
    { z: 0.41, pts: box8(0.05, 0.026, 0.008, 0.085) },
  ];
  L.push(part(loft(cab), { color: HULL }));
  const win = (s, z) => ({ z, pts: scaled([s.pts[0], s.pts[1], s.pts[2], s.pts[3], s.pts[4], s.pts[5]], 1.03, 1.06, 0.092) });
  L.push(part(loft([win(cab[2], 0.342), win(cab[3], 0.392)]), { to: 'glass' }));
  L.push(rod([0, 0.13, 0.28], [0, 0.176, 0.25], 0.003, 0.0015, { color: DARK }, 4));
  L.push(part(new THREE.BoxGeometry(0.03, 0.008, 0.05), { at: [0, 0.133, 0.28], color: BAND }));

  // the engine block astern, wrapped round the hull's tail, and its row of
  // engines
  L.push(
    part(
      loft([
        { z: -0.5, pts: box8(0.21, 0.12, 0.034, 0.01) },
        { z: -0.485, pts: box8(0.24, 0.15, 0.045, 0.01) },
        { z: -0.36, pts: box8(0.24, 0.15, 0.045, 0.01) },
        { z: -0.31, pts: box8(0.18, 0.1, 0.03, 0.008) },
      ]),
      { color: HULL },
    ),
  );
  L.push(part(new THREE.BoxGeometry(0.244, 0.016, 0.026), { at: [0, 0.01, -0.43], color: BAND }));
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.038;
    const r = i === 2 ? 0.018 : 0.016;
    L.push(part(turned([[r * 0.8, -0.506], [r, -0.512], [r * 1.25, -0.507], [r * 1.25, -0.49]], 12), { at: [x, 0.01, 0], color: DARK }));
    L.push(part(new THREE.CircleGeometry(r * 0.84, 12), { at: [x, 0.01, -0.507], rot: [0, PI, 0], to: 'glow', color: [0.7, 2.2, 6.2] }));
  }
  // running lights on the shell's rims, and a white beacon on the bridge
  for (const sx of [-1, 1]) L.push(ball(0.006, [sx * 0.138, 0.05, 0.15], 1, { to: 'glow', color: sx > 0 ? [7.5, 0.6, 0.45] : [0.5, 3.2, 1], mark: 'lights' }, 6));
  L.push(ball(0.005, [0, 0.178, 0.248], 1, { to: 'glow', color: [4, 4, 4.2], mark: 'beacon' }, 6));

  const tex = k.own(panelTexture(k.rand, { base: 218, spread: 16, seam: 0.62, detail: 0.3 }));
  weather(tex, k.rand, 0.7);
  const mats = {
    paint: standard(k, { map: tex, metalness: 0.25, roughness: 0.55 }),
    cargo: standard(k, { map: k.own(cargoTexture(k.rand)), metalness: 0.2, roughness: 0.6 }),
    glass: standard(k, { color: '#26404f', metalness: 0.7, roughness: 0.16 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  mats.cargo.userData.density = 8;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 8));
      blink('lights', pulse(t, 1.6, 0, 0.1) ? 1 : 0.15);
      blink('beacon', pulse(t, 2.3, 0.4, 0.06) ? 1 : 0.1);
    },
  };
}

// ── CR90 corvette ──

function corvette(k) {
  const WHITE = '#dedcd5';
  const LIGHT = '#c3c2bc';
  const RED = '#a8302a';
  const DARK = '#363a41';
  const L = [];
  // the engine block: a great box astern, its front corners cut back
  L.push(
    part(
      loft([
        { z: -0.5, pts: box8(0.29, 0.19, 0.035) },
        { z: -0.27, pts: box8(0.3, 0.2, 0.036) },
        { z: -0.2, pts: box8(0.21, 0.155, 0.03) },
      ]),
      { color: WHITE },
    ),
  );
  // the midsection, narrowing forward into the neck
  L.push(
    part(
      loft([
        { z: -0.22, pts: box8(0.17, 0.14, 0.045) },
        { z: 0.02, pts: box8(0.14, 0.115, 0.038) },
        { z: 0.17, pts: box8(0.11, 0.085, 0.028) },
        { z: 0.21, pts: box8(0.08, 0.06, 0.02) },
        { z: 0.3, pts: box8(0.08, 0.06, 0.02) },
      ]),
      { color: WHITE },
    ),
  );
  // the hammerhead: a wide flat slab, its front corners cut
  const head = [
    { z: 0.27, pts: box8(0.12, 0.05, 0.015) },
    { z: 0.31, pts: box8(0.235, 0.066, 0.02) },
    { z: 0.44, pts: box8(0.235, 0.066, 0.02) },
    { z: 0.485, pts: box8(0.18, 0.054, 0.016) },
    { z: 0.5, pts: box8(0.13, 0.04, 0.012) },
  ];
  L.push(part(loft(head), { color: WHITE }));
  // the bridge's windows across the top of its nose
  const win = (z, w, y) => ({ z, pts: [[w / 2, y - 0.008], [w / 2 - 0.006, y], [-w / 2 + 0.006, y], [-w / 2, y - 0.008]] });
  L.push(part(loft([win(0.444, 0.08, 0.0345), win(0.484, 0.06, 0.0285)]), { to: 'glass' }));
  // red down the hammerhead's flanks and along its top and belly, and round
  // the back of the engine block
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.003, 0.026, 0.13), { at: [sx * 0.1185, 0, 0.375], color: RED }));
    for (const sy of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.02, 0.003, 0.15), { at: [sx * 0.085, sy * 0.0335, 0.37], color: RED }));
    L.push(part(new THREE.BoxGeometry(0.004, 0.13, 0.03), { at: [sx * 0.15, 0, -0.42], color: RED }));
  }
  for (const sy of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.23, 0.004, 0.03), { at: [0, sy * 0.1, -0.42], color: RED }));
  // the bridge module on the head, and a dish behind it
  L.push(part(loft([{ z: 0.33, pts: box8(0.05, 0.02, 0.006, 0.042) }, { z: 0.4, pts: box8(0.06, 0.02, 0.006, 0.042) }, { z: 0.42, pts: box8(0.04, 0.012, 0.004, 0.039) }]), { color: LIGHT }));
  L.push(part(new THREE.BoxGeometry(0.04, 0.004, 0.004), { at: [0, 0.048, 0.41], rot: [0.6, 0, 0], to: 'glow', color: [1.6, 1.55, 1.4] }));
  L.push(rod([0.05, 0.033, 0.32], [0.05, 0.056, 0.32], 0.002, 0.002, { to: 'metal', color: DARK }, 4));
  L.push(part(upright([[0.0001, 0], [0.012, 0.004], [0.016, 0.009]], 10), { at: [0.05, 0.056, 0.32], rot: [0.5, 0, 0], color: LIGHT }));

  // turrets: twin turbolasers on the midsection's back and belly, smaller
  // ones on the head
  const turret = (x, y, z, up, s = 1) => [
    part(new THREE.CylinderGeometry(0.017 * s, 0.021 * s, 0.01 * s, 12), { at: [x, y + up * 0.005 * s, z], color: LIGHT }),
    part(new THREE.BoxGeometry(0.024 * s, 0.011 * s, 0.022 * s), { at: [x, y + up * 0.014 * s, z], color: WHITE }),
    rod([x - 0.006 * s, y + up * 0.014 * s, z + 0.008 * s], [x - 0.006 * s, y + up * 0.014 * s, z + 0.05 * s], 0.0024 * s, 0.002 * s, { to: 'metal', color: DARK }, 5),
    rod([x + 0.006 * s, y + up * 0.014 * s, z + 0.008 * s], [x + 0.006 * s, y + up * 0.014 * s, z + 0.05 * s], 0.0024 * s, 0.002 * s, { to: 'metal', color: DARK }, 5),
  ];
  for (const z of [-0.13, -0.03]) {
    const y = 0.07 - (z + 0.22) * (0.0125 / 0.24);
    L.push(...turret(0, y, z, 1), ...turret(0, -y, z, -1));
  }
  for (const sx of [-1, 1]) L.push(...turret(sx * 0.07, 0.033, 0.43, 1, 0.6), ...turret(sx * 0.07, -0.033, 0.43, -1, 0.6));

  // panel work: a dark trench down each of the midsection's flanks with
  // lighter plates over it, the escape pods' hatches along the neck, grooves
  // and vents on the engine block
  const taper = atan2(0.015, 0.24);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -0.17 + i * 0.05;
      const x = 0.085 - (z + 0.22) * (0.015 / 0.24) + 0.0008;
      L.push(part(new THREE.BoxGeometry(0.004, 0.009, 0.046), { at: [sx * x, -0.008, z], rot: [0, sx * taper, 0], to: 'metal', color: DARK }));
      if (i % 2 === 0) L.push(part(new THREE.BoxGeometry(0.004, 0.022, 0.04), { at: [sx * x, 0.014, z + 0.02], rot: [0, sx * taper, 0], color: LIGHT }));
    }
    for (let i = 0; i < 4; i++) L.push(part(new THREE.BoxGeometry(0.004, 0.016, 0.016), { at: [sx * 0.0405, 0.006, 0.217 + i * 0.022], to: 'metal', color: '#5b6068' }));
    for (const y of [0.05, 0.02, -0.02, -0.05]) L.push(part(new THREE.BoxGeometry(0.004, 0.006, 0.17), { at: [sx * 0.1505, y, -0.345], to: 'metal', color: DARK }));
    L.push(part(new THREE.BoxGeometry(0.004, 0.024, 0.09), { at: [sx * 0.1505, 0.0, -0.3], color: LIGHT }));
  }
  for (const sy of [-1, 1]) {
    for (const z of [-0.29, -0.315, -0.34, -0.365]) L.push(part(new THREE.BoxGeometry(0.2, 0.003, 0.007), { at: [0, sy * 0.1005, z], to: 'metal', color: DARK }));
    for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.06, 0.006, 0.08), { at: [sx * 0.07, sy * 0.1, -0.46], color: LIGHT }));
    L.push(part(new THREE.BoxGeometry(0.022, 0.008, 0.22), { at: [0, sy * 0.063, -0.1], color: LIGHT }));
  }
  // the engines: two rows across the back, six above and five below
  const engines = [];
  for (let i = 0; i < 6; i++) engines.push([(i - 2.5) * 0.046, 0.045]);
  for (let i = 0; i < 5; i++) engines.push([(i - 2) * 0.046, -0.042]);
  for (const [x, y] of engines) {
    const r = 0.02;
    L.push(part(turned([[r * 0.78, -0.533], [r, -0.538], [r * 1.18, -0.53], [r * 1.18, -0.512], [r * 1.05, -0.508], [r * 1.05, -0.495]], 14), { at: [x, y, 0], to: 'metal', color: '#4a4f57' }));
    L.push(part(new THREE.CircleGeometry(r * 0.82, 14), { at: [x, y, -0.533], rot: [0, PI, 0], to: 'glow', color: [2.2, 3.4, 6.6] }));
  }
  // running lights at the hammerhead's corners
  for (const sx of [-1, 1]) L.push(ball(0.005, [sx * 0.119, 0, 0.445], 1, { to: 'glow', color: sx > 0 ? [7.5, 0.6, 0.45] : [0.5, 3.2, 1], mark: 'lights' }, 6));

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { min: 8, base: 226, spread: 14, seam: 0.62, detail: 0.35 })), metalness: 0.2, roughness: 0.5 }),
    metal: standard(k, { metalness: 0.75, roughness: 0.38 }),
    glass: standard(k, { color: '#26404f', metalness: 0.7, roughness: 0.16 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(1 + 0.06 * sin(t * 2.4) + 0.03 * sin(t * 15));
      blink('lights', pulse(t, 2, 0, 0.1) ? 1 : 0.15);
    },
  };
}

// ── TIE Advanced x1 ──

const X1_GREY = '#6b727c';
const X1_DARK = '#434851';

// One of the x1's wing panels in its own plane (z, y): the frame round the
// outline, the solar panel inside, and (if it has a hub) spars from the hub
// out to every corner.
function x1Panel(outline, uv, hub) {
  const frame = 0.028;
  const thick = 0.026;
  const L = [];
  const inner = inset(outline, frame);
  L.push(part(plateZY(outline, thick, 0.006, [inner]), { color: X1_GREY }));
  L.push(part(plateZY(inset(outline, frame * 0.5), thick * 0.3), { to: 'panel', uv }));
  if (!hub) return L;
  for (const [z, y] of inner) {
    const dz = z - hub[0];
    const dy = y - hub[1];
    const len = hypot(dz, dy);
    if (len < 0.05) continue;
    L.push(part(new THREE.BoxGeometry(thick * 0.8, frame * 0.45, len), { at: [0, hub[1] + dy / 2, hub[0] + dz / 2], rot: [atan2(-dy, dz), 0, 0], color: X1_DARK }));
  }
  return L;
}

// Darth Vader's TIE Advanced x1: the ball cockpit on a longer fuselage that
// runs back to its engines, and on each side a wing folded in toward it: a
// short upright panel where the pylon meets it, and long solar panels above
// and below bent in from its edges.
function tieadvanced(k) {
  const R = 0.13;
  const C = [0, 0, 0.04];
  const L = [];
  // the ball, as on every TIE: the round window at the front with its hub
  // and spokes, the hatch on top tipped back, collars for the pylons
  const top = Math.asin(0.76);
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const a = -PI / 2 + (i / 12) * (top + PI / 2);
    prof.push([R * cos(a), R * sin(a)]);
  }
  const rim = R * cos(top);
  prof.push([rim * 1.02, R * 0.8], [rim * 0.88, R * 0.83], [rim * 0.84, R * 0.77]);
  L.push(part(turned(prof, 28), { at: C, color: X1_GREY }));
  const zw = C[2] + R * 0.77;
  L.push(part(new THREE.CircleGeometry(rim * 0.86, 28), { at: [0, 0, zw], to: 'glass' }));
  L.push(part(turned([[rim * 0.3, zw - 0.002], [rim * 0.3, zw + R * 0.06], [rim * 0.19, zw + R * 0.06], [rim * 0.19, zw - 0.002]], 8), { color: X1_GREY }));
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4;
    const r = rim * 0.58;
    L.push(part(new THREE.BoxGeometry(R * 0.05, rim * 0.56, R * 0.05), { at: [-sin(a) * r, cos(a) * r, zw + R * 0.03], rot: [0, 0, a], color: X1_GREY }));
  }
  L.push(part(new THREE.CylinderGeometry(R * 0.33, R * 0.38, R * 0.14, 16), { at: [0, R * 0.95, C[2] - R * 0.24], rot: [-0.25, 0, 0], color: X1_DARK }));
  L.push(part(new THREE.CylinderGeometry(R * 0.2, R * 0.24, R * 0.1, 12), { at: [0, R * 1.03, C[2] - R * 0.26], rot: [-0.25, 0, 0], color: X1_GREY }));
  for (const sx of [-1, 1]) L.push(part(new THREE.CylinderGeometry(R * 0.5, R * 0.54, R * 0.22, 12), { at: [sx * R * 0.92, 0, C[2]], rot: [0, 0, PI / 2], color: X1_DARK }));

  // the fuselage behind the ball, tapering back to the engines, with a
  // spine along its top and dark panels down its flanks
  L.push(
    part(
      loft([
        { z: -0.34, pts: box8(0.1, 0.07, 0.022, -0.004) },
        { z: -0.325, pts: box8(0.125, 0.09, 0.028, -0.004) },
        { z: -0.16, pts: box8(0.17, 0.12, 0.04) },
        { z: -0.06, pts: box8(0.18, 0.13, 0.044) },
        { z: 0.02, pts: box8(0.15, 0.11, 0.036) },
      ]),
      { color: X1_GREY },
    ),
  );
  L.push(part(loft([{ z: -0.32, pts: box8(0.04, 0.02, 0.006, 0.05) }, { z: -0.08, pts: box8(0.05, 0.026, 0.008, 0.066) }, { z: -0.04, pts: box8(0.03, 0.01, 0.003, 0.062) }]), { color: X1_DARK }));
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.004, 0.05, 0.14), { at: [sx * 0.086, 0, -0.18], rot: [0, sx * -0.12, 0], color: X1_DARK }));
  // the engines at its tail, in their housings
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.044, 0.04, 0.02), { at: [sx * 0.026, -0.004, -0.342], color: X1_DARK }));
    L.push(part(new THREE.PlaneGeometry(0.034, 0.03), { at: [sx * 0.026, -0.004, -0.3525], rot: [0, PI, 0], to: 'glow', color: [5.8, 1.45, 0.3] }));
  }
  // the hunter's red light, pulsing slowly on its back
  L.push(ball(0.011, [0, 0.076, -0.24], 1, { to: 'glow', color: [7.5, 0.5, 0.35], mark: 'beacon' }, 8));

  // the wings: an upright middle panel on the pylon, the long panels bent
  // in from its top and bottom edges
  const H = 0.042;
  const half = [[-0.28, 0], [0.28, 0], [0.13, 0.22], [-0.13, 0.22]];
  const hub = [0, 0];
  const uv = (x, y, z) => [(z + 0.28) / 0.56, y / 0.22];
  const middle = [[-0.28, -H], [0.28, -H], [0.28, H], [-0.28, H]];
  const blade = x1Panel(half, uv, hub);
  const bend = 0.58;
  const wing = [
    ...x1Panel(middle, (x, y, z) => [(z + 0.28) / 0.56, ((y + H) / (2 * H)) * 0.2]),
    ...place(blade, [0, H, 0], [0, 0, bend]),
    ...place(place(blade, undefined, undefined, [1, -1, 1]), [0, -H, 0], [0, 0, -bend]),
    part(new THREE.CylinderGeometry(0.045, 0.045, 0.036, 6), { rot: [PI / 6, 0, PI / 2], color: X1_GREY }),
    part(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 10), { rot: [0, 0, PI / 2], color: X1_DARK }),
  ];
  const pylon = loft([
    { z: 0.1, pts: box8(0.07, 0.05, 0.016) },
    { z: 0.18, pts: box8(0.075, 0.054, 0.016) },
    { z: 0.27, pts: box8(0.11, 0.08, 0.026) },
    { z: 0.3, pts: box8(0.11, 0.08, 0.026) },
  ]).rotateY(PI / 2);
  const right = [part(pylon, { at: [0, 0, C[2]], color: X1_GREY }), ...place(wing, [0.31, 0, 0.02])];
  L.push(...right, ...mirror(right));

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 210, spread: 12, seam: 0.6, detail: 0.3 })), metalness: 0.4, roughness: 0.42 }),
    panel: standard(k, { map: k.own(solarTexture(k.rand, half, hub, uv)), metalness: 0.4, roughness: 0.32 }),
    glass: standard(k, { color: '#11161b', metalness: 0.9, roughness: 0.06 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 9));
      const s = Math.max(0, sin(t * 1.3));
      blink('beacon', Math.round((0.1 + 0.9 * s * s) * 24) / 24);
    },
  };
}

export const FLEET = { freighter, transport, corvette, tieadvanced };
