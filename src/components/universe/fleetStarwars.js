// More of the Star Wars galaxy's traffic (see trafficModels.js for how a
// model is put together and what it returns): the ordinary ships going about
// their business, the Empire's best hunting you, and the bounty hunters and
// pirates who'd like what's on your head, or in your hold.
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
// tiebomber: a TIE/sa bomber, two pods side by side between the TIE line's
// hexagonal wings (bent in toward them along the top and bottom), the
// cockpit with its round window to starboard and the longer ordnance pod to
// port; an engine glowing red-orange at the tail of each.
// gunboat: an Alpha-class Xg-1 Star Wing, the assault gunboat, a heavy
// armoured fuselage with its canopy up front and an upper and a lower wing
// on each side, short and swept, so it's an X from the front, with a cannon
// pod at every tip; Imperial grey, two engines glowing blue-white.
// ig2000: IG-88's IG-2000, a broad flat stern carrying its engines and two
// long mandibles reaching forward either side of the cockpit, none of it
// quite symmetrical; dark grey-green, its paint chipped.
// houndstooth: Bossk's Hound's Tooth, a YT-2000 rebuilt, the YT line's thick
// disc with the cockpit pod out at the front in the middle and a big raised
// block over its back running out into the engines; white with dull red
// trim, scarred by blaster fire.
// punishingone: Dengar's Punishing One, a JumpMaster 5000, a long narrow
// fuselage with the cockpit's glazed bulb at its nose and one great wing out
// to starboard that turns slowly up and back down about the fuselage as it
// flies; worn brown and orange.
// skiff: a Weequay pirate's skiff, a boxy junk fighter patched together in
// rust and faded paint, odd stubby wings, a crude cannon bolted on top and a
// far too big engine behind, its glow coughing.
//
// Every model points its nose along +z with +y up, so starboard is -x.

import * as THREE from 'three';
import { part, place, mirror, rod, meshes, blinker, loft, box8, trap8, scaled, plateXZ, plateZY, turned, upright, ball, inset, canvasTexture, grey, panelTexture, solarTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';

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

// A loft's cross-section at z, between the sections either side of it, and
// grown by s about its middle (for a band or a window that has to sit snug
// on the hull there).
function sectionAt(sections, z, s = 1) {
  const i = Math.max(1, sections.findIndex((sec) => sec.z >= z));
  const [a, b] = [sections[i - 1], sections[i]];
  const f = (z - a.z) / (b.z - a.z);
  const pts = a.pts.map(([x, y], j) => [x + (b.pts[j][0] - x) * f, y + (b.pts[j][1] - y) * f]);
  return scaled(pts, s, s, pts.reduce((sum, [, y]) => sum + y, 0) / pts.length);
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

// Chipped paint over a plating texture drawn dark for it: flecks and
// scrapes of bare metal showing through, paler than the paint round them
// (the paint's colour multiplies the texture, so chips can only come out
// lighter where the plating is darker). They come in clusters, where
// something has knocked it.
function chip(tex, rand, amount = 1) {
  const g = tex.image.getContext('2d');
  const S = tex.image.width;
  for (let i = 0; i < 14 * amount; i++) {
    const cx = rand() * S;
    const cy = rand() * S;
    const spread = 4 + rand() * 12;
    for (let n = 3 + rand() * 9; n > 0; n--) {
      const x = cx + (rand() - 0.5) * 2 * spread;
      const y = cy + (rand() - 0.5) * 2 * spread;
      const r = 0.7 + rand() * 2.2;
      g.fillStyle = grey(196 + rand() * 50);
      g.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * PI * 2;
        const rr = r * (0.45 + rand());
        g[j ? 'lineTo' : 'moveTo'](x + cos(a) * rr, y + sin(a) * rr);
      }
      g.fill();
    }
  }
  for (let i = 0; i < 14 * amount; i++) {
    g.fillStyle = grey(180 + rand() * 50);
    g.fillRect(rand() * S, rand() * S, 3 + rand() * 16, 1);
  }
  tex.needsUpdate = true;
}

// Blaster scars over a plating texture: a dark core fading out through
// brown, a few short splashes thrown out from it, and long scratches, pale
// and dark.
function scorch(tex, rand, amount = 1) {
  const g = tex.image.getContext('2d');
  const S = tex.image.width;
  for (let i = 0; i < 9 * amount; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 7 + rand() * 12;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(16,13,11,0.7)');
    grad.addColorStop(0.3, 'rgba(46,36,28,0.4)');
    grad.addColorStop(1, 'rgba(80,62,44,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.strokeStyle = 'rgba(30,24,18,0.25)';
    g.lineWidth = 1;
    for (let j = 0; j < 3; j++) {
      const a = rand() * PI * 2;
      const len = r * (0.6 + rand() * 0.6);
      g.beginPath();
      g.moveTo(x + cos(a) * r * 0.3, y + sin(a) * r * 0.3);
      g.lineTo(x + cos(a) * len, y + sin(a) * len);
      g.stroke();
    }
  }
  for (let i = 0; i < 16 * amount; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const a = rand() * PI;
    const len = 10 + rand() * 40;
    g.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(30,26,22,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + cos(a) * len, y + sin(a) * len);
    g.stroke();
  }
  tex.needsUpdate = true;
}

// Rust over a plating texture: orange-brown blooms, and streaks running
// down from them.
function rust(tex, rand, amount = 1) {
  const g = tex.image.getContext('2d');
  const S = tex.image.width;
  for (let i = 0; i < 18 * amount; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 5 + rand() * 16;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(122,60,26,${0.3 + rand() * 0.3})`);
    grad.addColorStop(1, 'rgba(122,60,26,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.fillStyle = `rgba(110,54,24,${0.15 + rand() * 0.2})`;
    g.fillRect(x - 1, y, 1 + rand() * 2, 8 + rand() * 30);
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

// One panel of a bent TIE wing (the x1's, the bomber's) in its own plane
// (z, y): the frame round the outline, the solar panel inside, and (if it
// has a hub) spars from the hub out to every corner, or to the points given.
function x1Panel(outline, uv, hub, { frame = 0.028, thick = 0.026, grey = X1_GREY, dark = X1_DARK, spars } = {}) {
  const L = [];
  const inner = inset(outline, frame);
  L.push(part(plateZY(outline, thick, 0.006, [inner]), { color: grey }));
  L.push(part(plateZY(inset(outline, frame * 0.5), thick * 0.3), { to: 'panel', uv }));
  if (!hub) return L;
  for (const [z, y] of spars ?? inner) {
    const dz = z - hub[0];
    const dy = y - hub[1];
    const len = hypot(dz, dy);
    if (len < 0.05) continue;
    L.push(part(new THREE.BoxGeometry(thick * 0.8, frame * 0.45, len), { at: [0, hub[1] + dy / 2, hub[0] + dz / 2], rot: [atan2(-dy, dz), 0, 0], color: dark }));
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

// ── TIE/sa bomber ──

const BOMBER_GREY = '#868f9b';
const BOMBER_DARK = '#5c6470';

// A pod's raised band: a ring standing a little proud of a pod r across, with
// sloped edges so it doesn't show a gap from the side.
const band = (r, z, w = 0.014, d = 0.004) => turned([[r - 0.001, z], [r + d, z + 0.003], [r + d, z + w - 0.003], [r - 0.001, z + w]], 18);

// A pylon out along x from x0 to x1, flaring as it nears the wing (w along
// z, h tall).
const pylonX = (x0, x1, [w0, h0], [w1, h1]) =>
  loft([
    { z: x0, pts: box8(w0, h0, w0 * 0.22) },
    { z: x0 + (x1 - x0) * 0.45, pts: box8(w0 * 1.06, h0 * 1.06, w0 * 0.22) },
    { z: x1 - 0.03, pts: box8(w1, h1, w1 * 0.25) },
    { z: x1, pts: box8(w1, h1, w1 * 0.25) },
  ]).rotateY(PI / 2);

// TIE/sa bomber: two pods side by side, the cockpit with its round window
// to starboard and the longer ordnance pod to port, joined between the TIE
// line's hexagonal wings, each bent in toward them along the top and bottom
// of its middle panel.
function tiebomber(k) {
  const L = [];
  // the cockpit pod: turned about z, its round window in front (a hub and
  // eight spokes, as the fighter's), the hatch on top, tapering back to the
  // engine
  const CX = -0.115;
  const R = 0.1;
  L.push(part(turned([[0.056, -0.458], [0.07, -0.42], [0.088, -0.35], [R, -0.27], [R, 0.13], [0.097, 0.17], [0.089, 0.205], [0.078, 0.232], [0.08, 0.242], [0.07, 0.248], [0.066, 0.241]], 18), { at: [CX, 0, 0], color: BOMBER_GREY }));
  const zw = 0.241;
  L.push(part(new THREE.CircleGeometry(0.067, 18), { at: [CX, 0, zw], to: 'glass' }));
  L.push(part(turned([[0.021, zw - 0.002], [0.021, zw + 0.007], [0.013, zw + 0.007], [0.013, zw - 0.002]], 8), { at: [CX, 0, 0], color: BOMBER_GREY }));
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4;
    L.push(part(new THREE.BoxGeometry(0.005, 0.04, 0.005), { at: [CX - sin(a) * 0.041, cos(a) * 0.041, zw + 0.003], rot: [0, 0, a], color: BOMBER_GREY }));
  }
  L.push(part(new THREE.CylinderGeometry(0.036, 0.042, 0.03, 14), { at: [CX, R - 0.003, -0.03], color: BOMBER_DARK }));
  L.push(part(new THREE.CylinderGeometry(0.022, 0.026, 0.012, 12), { at: [CX, R + 0.016, -0.03], color: BOMBER_GREY }));
  for (const z of [-0.2, 0.05]) L.push(part(band(R, z), { at: [CX, 0, 0], color: BOMBER_DARK }));

  // the ordnance pod: longer, out ahead of the cockpit on a rounded nose,
  // with the bomb bay's doors along its belly
  const PX = 0.11;
  const r = 0.084;
  L.push(part(turned([[0.048, -0.438], [0.062, -0.4], [0.076, -0.34], [r, -0.28], [r, 0.2], [0.081, 0.26], [0.074, 0.32], [0.063, 0.375], [0.048, 0.425], [0.031, 0.462], [0.016, 0.485], [0.0001, 0.494]], 18), { at: [PX, 0, 0], color: BOMBER_GREY }));
  for (const z of [-0.23, -0.04, 0.16]) L.push(part(band(r, z), { at: [PX, 0, 0], color: BOMBER_DARK }));
  for (const sx of [-1, 1]) L.push(part(new THREE.BoxGeometry(0.026, 0.01, 0.3), { at: [PX + sx * 0.0145, -r + 0.004, 0.02], rot: [0, 0, sx * 0.18], to: 'metal', color: '#3c4148' }));
  L.push(part(new THREE.BoxGeometry(0.03, 0.008, 0.16), { at: [PX, r - 0.002, -0.1], color: BOMBER_DARK }));

  // an engine at each pod's tail, in its housing
  for (const [x, rr] of [
    [CX, 0.056],
    [PX, 0.048],
  ]) {
    L.push(part(turned([[rr * 0.5, -0.497], [rr * 0.72, -0.5], [rr * 0.94, -0.484], [rr * 1.04, -0.455], [rr * 0.98, -0.448]], 16), { at: [x, 0, x > 0 ? 0.024 : 0], to: 'metal', color: '#3a3f46' }));
    L.push(part(new THREE.CircleGeometry(rr * 0.52, 16), { at: [x, 0, (x > 0 ? 0.024 : 0) - 0.497], rot: [0, PI, 0], to: 'glow', color: [2.6, 0.62, 0.22] }));
  }

  // the bridge between the pods
  L.push(part(loft([{ z: CX, pts: box8(0.13, 0.055, 0.016) }, { z: PX, pts: box8(0.13, 0.055, 0.016) }]).rotateY(PI / 2), { at: [0, 0, -0.07], color: BOMBER_GREY }));

  // the wings: the upright middle panel on its pylon, the tips bent in from
  // its top and bottom edges; one solar texture for the whole hexagon laid
  // flat, so the grooves run on across the bends
  const a = 0.29;
  const h = 0.15;
  const T = 0.22;
  const F = 0.026;
  const hexagon = [[0, h + T], [-a, h], [-a, -h], [0, -h - T], [a, -h], [a, h]];
  const uv = (x, y, z) => [(z + a) / (2 * a), (y + h + T) / (2 * (h + T))];
  const middle = [[-a, -h], [a, -h], [a, h], [-a, h]];
  const o = { frame: F, thick: 0.024, grey: BOMBER_GREY, dark: BOMBER_DARK };
  const tip = x1Panel([[-a, 0], [a, 0], [0, T]], (x, y, z) => uv(x, y + h, z), [0, 0], { ...o, spars: [[0, T * 0.84]] });
  const bend = 0.72;
  const wing = [
    ...x1Panel(middle, uv, [0, 0], { ...o, spars: [...inset(middle, F), [0, h - F], [0, F - h]] }),
    ...place(tip, [0, h, 0], [0, 0, bend]),
    ...place(place(tip, undefined, undefined, [1, -1, 1]), [0, -h, 0], [0, 0, -bend]),
    part(new THREE.CylinderGeometry(0.044, 0.044, 0.034, 6), { rot: [PI / 6, 0, PI / 2], color: BOMBER_GREY }),
    part(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 10), { rot: [0, 0, PI / 2], color: BOMBER_DARK }),
  ];
  const W = 0.345;
  const ZW = -0.07;
  const port = place(wing, [W, 0, ZW]);
  L.push(...port, ...mirror(port));
  L.push(part(pylonX(PX + r * 0.7, W - 0.01, [0.07, 0.052], [0.11, 0.084]), { at: [0, 0, ZW], color: BOMBER_GREY }));
  L.push(part(pylonX(-CX + R * 0.7, W - 0.01, [0.075, 0.056], [0.11, 0.084]), { at: [0, 0, ZW], scale: [-1, 1, 1], color: BOMBER_GREY }));

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 222, spread: 10, seam: 0.66, detail: 0.25 })), metalness: 0.3, roughness: 0.45 }),
    panel: standard(k, { map: k.own(solarTexture(k.rand, hexagon, [0, 0], uv)), metalness: 0.35, roughness: 0.34 }),
    metal: standard(k, { metalness: 0.75, roughness: 0.4 }),
    glass: standard(k, { color: '#0d1916', metalness: 0.9, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 10));
    },
  };
}

// ── Assault gunboat ──

// Alpha-class Xg-1 Star Wing, the assault gunboat: a heavy armoured
// fuselage, deep and blunt, with its canopy up at the front, and on each side
// an upper and a lower wing, short and thick, swept back from the hull's
// flanks and carrying a cannon pod at the tip, so it's an X from the front;
// two big engines astern.
function gunboat(k) {
  const GREY = '#9198a1';
  const LIGHT = '#b2b7bd';
  const DARK = '#454a52';
  const L = [];
  // the fuselage: a deep box with its corners cut, narrowing forward to a
  // blunt armoured nose
  const body = [
    { z: -0.462, pts: box8(0.17, 0.14, 0.036) },
    { z: -0.44, pts: box8(0.22, 0.18, 0.05) },
    { z: -0.1, pts: box8(0.235, 0.19, 0.054) },
    { z: 0.12, pts: trap8(0.222, 0.17, 0.176, 0.05, -0.006) },
    { z: 0.3, pts: trap8(0.18, 0.12, 0.14, 0.04, -0.016) },
    { z: 0.41, pts: trap8(0.13, 0.08, 0.1, 0.03, -0.024) },
    { z: 0.46, pts: trap8(0.084, 0.05, 0.066, 0.02, -0.027) },
    { z: 0.478, pts: trap8(0.046, 0.026, 0.034, 0.01, -0.028) },
  ];
  L.push(part(loft(body), { color: GREY }));
  // armour cheeks either side of the cockpit, and a collar where the nose
  // meets the body
  for (const sx of [-1, 1]) {
    L.push(part(loft([{ z: 0.0, pts: box8(0.03, 0.09, 0.01) }, { z: 0.2, pts: box8(0.03, 0.08, 0.01) }, { z: 0.33, pts: box8(0.016, 0.05, 0.006) }]), { at: [sx * 0.097, -0.012, 0], rot: [0, sx * 0.1, 0], color: LIGHT }));
  }
  L.push(part(loft([scaled(trap8(0.222, 0.17, 0.176, 0.05, -0.006), 1.04, 1.04, -0.006), scaled(trap8(0.222, 0.17, 0.176, 0.05, -0.006), 1.04, 1.04, -0.006)].map((pts, i) => ({ z: 0.1 + i * 0.03, pts }))), { color: DARK }));
  // the canopy, its sides sunk into the hull so it sits down on the plating,
  // and the heavy bars of its frame
  const canopy = (z, yb, w, h) => ({ z, pts: [[w / 2, yb], [w / 2 - 0.01, yb + h * 0.66], [w * 0.24, yb + h], [-w * 0.24, yb + h], [-w / 2 + 0.01, yb + h * 0.66], [-w / 2, yb]] });
  L.push(part(loft([canopy(0.15, 0.06, 0.08, 0.034), canopy(0.19, 0.05, 0.112, 0.06), canopy(0.29, 0.03, 0.1, 0.058), canopy(0.37, 0.008, 0.074, 0.04), canopy(0.41, 0.0, 0.05, 0.02)]), { to: 'glass' }));
  for (const [z, yb, w, h] of [
    [0.2, 0.048, 0.116, 0.065],
    [0.29, 0.028, 0.104, 0.062],
    [0.36, 0.01, 0.082, 0.045],
  ]) {
    L.push(part(loft([canopy(z - 0.006, yb, w, h), canopy(z + 0.006, yb, w, h)]), { color: LIGHT }));
  }
  L.push(rod([0, 0.113, 0.19], [0, 0.1, 0.29], 0.005, 0.005, { color: LIGHT }, 4), rod([0, 0.1, 0.29], [0, 0.072, 0.37], 0.005, 0.005, { color: LIGHT }, 4));
  // the armoured spine behind the canopy, over the engines, with a sensor
  // housing on it
  L.push(part(loft([{ z: -0.45, pts: trap8(0.11, 0.076, 0.044, 0.012, 0.098) }, { z: -0.04, pts: trap8(0.11, 0.076, 0.044, 0.012, 0.098) }, { z: 0.15, pts: trap8(0.076, 0.044, 0.02, 0.006, 0.09) }]), { color: LIGHT }));
  L.push(part(new THREE.CylinderGeometry(0.018, 0.022, 0.02, 10), { at: [0, 0.128, -0.2], color: DARK }));
  // intakes behind the cheeks, the missile tubes in the nose and the twin
  // cannons under its chin
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.012, 0.06, 0.1), { at: [sx * 0.113, 0.0, -0.06], to: 'metal', color: '#2b2f35' }));
    L.push(part(new THREE.CircleGeometry(0.01, 10), { at: [sx * 0.032, -0.034, 0.468], to: 'metal', color: '#16181c' }));
    L.push(rod([sx * 0.034, -0.084, 0.16], [sx * 0.034, -0.084, 0.43], 0.01, 0.009, { to: 'metal', color: DARK }, 6));
    L.push(rod([sx * 0.034, -0.084, 0.43], [sx * 0.034, -0.084, 0.5], 0.005, 0.005, { to: 'metal', color: '#2b2f35' }, 5));
  }
  L.push(part(new THREE.BoxGeometry(0.06, 0.016, 0.16), { at: [0, -0.084, 0.26], to: 'metal', color: '#5a5f66' }));
  L.push(part(plateZY([[-0.43, 0], [-0.1, 0], [-0.18, -0.05], [-0.41, -0.05]], 0.02, 0.005), { at: [0, -0.09, 0], color: DARK }));

  // one wing, root at the origin and reaching out along x: a short, thick
  // swept plate, the dark radiator along its trailing edge, its root block
  // and the cannon pod at its tip
  const S = 0.25;
  const wing = [
    part(plateXZ([[0, -0.43], [S, -0.465], [S, -0.33], [0, -0.05]], 0.032, 0.007), { color: GREY }),
    part(plateXZ([[0.05, -0.434], [S - 0.02, -0.462], [S - 0.02, -0.42], [0.05, -0.37]], 0.037), { color: DARK }),
    part(loft([{ z: -0.44, pts: box8(0.07, 0.06, 0.016) }, { z: -0.07, pts: box8(0.07, 0.06, 0.016) }, { z: -0.02, pts: box8(0.044, 0.036, 0.01) }]), { at: [0.026, 0, 0], color: LIGHT }),
  ];
  const pod = [S + 0.018, 0, 0];
  wing.push(part(turned([[0.008, -0.49], [0.02, -0.484], [0.027, -0.46], [0.027, -0.3], [0.022, -0.26], [0.014, -0.25]], 10), { at: pod, color: LIGHT }));
  wing.push(part(turned([[0.0275, -0.42], [0.0275, -0.38]], 10), { at: pod, to: 'metal', color: DARK }));
  wing.push(rod([pod[0], 0, -0.255], [pod[0], 0, -0.1], 0.009, 0.009, { to: 'metal', color: '#3c4047' }, 6));
  wing.push(rod([pod[0], 0, -0.13], [pod[0], 0, -0.07], 0.013, 0.013, { to: 'metal', color: '#2b2f35' }, 6));
  const lift = 0.55;
  const root = [0.1, 0.036, 0];
  const upper = place(wing, root, [0, 0, lift]);
  const lower = place(place(wing, undefined, undefined, [1, -1, 1]), [root[0], -root[1], 0], [0, 0, -lift]);
  L.push(...upper, ...lower, ...mirror([...upper, ...lower]));

  // the engines astern, in their housings
  for (const sx of [-1, 1]) {
    const at = [sx * 0.046, 0.004, 0];
    L.push(part(turned([[0.029, -0.49], [0.034, -0.5], [0.04, -0.494], [0.04, -0.455], [0.036, -0.45]], 14), { at, to: 'metal', color: '#3b4047' }));
    L.push(part(new THREE.CircleGeometry(0.0295, 14), { at: [at[0], at[1], -0.49], rot: [0, PI, 0], to: 'glow', color: [1.0, 2.2, 6.0] }));
  }
  // running lights on the upper wings' pods
  for (const sx of [-1, 1]) {
    const x = sx * (root[0] + pod[0] * cos(lift) - 0.027 * sin(lift));
    L.push(ball(0.006, [x, root[1] + pod[0] * sin(lift) + 0.027 * cos(lift), -0.38], 1, { to: 'glow', color: sx > 0 ? [7.5, 0.6, 0.45] : [0.5, 3.2, 1], mark: 'lights' }, 6));
  }

  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { min: 10, base: 222, spread: 16, seam: 0.58, detail: 0.4 })), metalness: 0.3, roughness: 0.46 }),
    metal: standard(k, { metalness: 0.75, roughness: 0.38 }),
    glass: standard(k, { color: '#0f1a22', metalness: 0.9, roughness: 0.07 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 11));
      blink('lights', pulse(t, 1.7, 0, 0.1) ? 1 : 0.15);
    },
  };
}

// ── IG-2000 ──

// IG-88's IG-2000, a modified Aggressor: a broad flat stern carrying the
// engines, and from it two long mandibles reaching forward either side of
// the cockpit section, none of it quite symmetrical: the port mandible a tall
// blade, the starboard one lower and rounder with an ion cannon in its nose,
// the cockpit set a little to port, a fin to starboard.
function ig2000(k) {
  // (the plating is drawn dark, so these come out a dark grey-green with
  // paler chips)
  const GREEN = '#a6b39d';
  const LIGHT = '#bcc4b4';
  const DARK = '#6f786b';
  const METAL = '#3a3f3a';
  const L = [];
  // the stern: a wide, flat octagon, its edges bevelled, a little fuller to
  // starboard
  const stern = (z, w, h, c, dx = 0) => ({ z, pts: box8(w, h, c).map(([x, y]) => [x + dx + (x < 0 ? x * 0.06 : 0), y]) });
  L.push(part(loft([stern(-0.5, 0.36, 0.08, 0.03), stern(-0.475, 0.42, 0.1, 0.036), stern(-0.3, 0.46, 0.11, 0.042), stern(-0.16, 0.44, 0.1, 0.04), stern(-0.06, 0.36, 0.084, 0.032, 0.01), stern(0.0, 0.25, 0.068, 0.026, 0.012)]), { color: GREEN }));
  // a raised deck over the middle of it, and vents in the deck
  L.push(part(loft([{ z: -0.47, pts: trap8(0.2, 0.15, 0.036, 0.01, 0.062) }, { z: -0.12, pts: trap8(0.2, 0.15, 0.036, 0.01, 0.062) }, { z: -0.04, pts: trap8(0.12, 0.08, 0.02, 0.005, 0.054) }]), { color: DARK }));
  for (let i = 0; i < 4; i++) L.push(part(new THREE.BoxGeometry(0.12, 0.004, 0.012), { at: [0, 0.081, -0.42 + i * 0.03], to: 'metal', color: '#1f2320' }));

  // the mandibles: lofted through octagons w × h centred at (cx, cy),
  // curving in toward each other as they reach forward
  const oct = (z, w, h, cx, cy) => ({ z, pts: [[cx + w / 2, cy - h * 0.25], [cx + w / 2, cy + h * 0.25], [cx + w * 0.2, cy + h / 2], [cx - w * 0.2, cy + h / 2], [cx - w / 2, cy + h * 0.25], [cx - w / 2, cy - h * 0.25], [cx - w * 0.2, cy - h / 2], [cx + w * 0.2, cy - h / 2]] });
  L.push(part(loft([oct(-0.3, 0.084, 0.12, 0.17, 0.006), oct(0.04, 0.078, 0.17, 0.184, 0.012), oct(0.3, 0.062, 0.14, 0.162, 0.004), oct(0.44, 0.04, 0.09, 0.138, -0.006), oct(0.5, 0.012, 0.034, 0.128, -0.01)]), { color: GREEN }));
  L.push(part(loft([oct(-0.3, 0.088, 0.09, -0.172, -0.008), oct(0.04, 0.096, 0.1, -0.186, -0.01), oct(0.26, 0.078, 0.084, -0.166, -0.014), oct(0.37, 0.056, 0.06, -0.15, -0.016), oct(0.405, 0.028, 0.03, -0.146, -0.016)]), { color: GREEN }));
  // dark plating down the blade's flanks, a strake along the round one
  // (the blade's flanks run from x 0.223 and 0.145 at z 0.04 to 0.193 and
  // 0.131 at z 0.3)
  for (const [x0, x1, out] of [
    [0.223, 0.193, 1],
    [0.145, 0.131, -1],
  ]) {
    const turn = atan2(x1 - x0, 0.26);
    L.push(part(new THREE.BoxGeometry(0.004, 0.04, 0.22), { at: [(x0 + x1) / 2 + out * 0.0022, 0.008, 0.17], rot: [0, turn, 0], color: DARK }));
  }
  L.push(part(new THREE.BoxGeometry(0.03, 0.006, 0.3), { at: [-0.178, 0.04, 0.08], rot: [0, 0.06, 0], color: DARK }));
  // the port blade's twin cannons, the ion cannon in the starboard nose
  for (const y of [0.034, -0.034]) L.push(rod([0.162, y, 0.3], [0.136, y, 0.47], 0.0045, 0.0045, { to: 'metal', color: METAL }, 5));
  L.push(rod([-0.146, -0.016, 0.39], [-0.146, -0.016, 0.47], 0.008, 0.006, { to: 'metal', color: METAL }, 6));
  L.push(part(turned([[0.0001, 0.462], [0.011, 0.466], [0.011, 0.478], [0.006, 0.482]], 8), { at: [-0.146, -0.016, 0], to: 'metal', color: '#2a2e2a' }));

  // the cockpit section between them, set a little to port: a raised
  // module on a neck from the stern, its dark window wrapped round the nose
  // and the droid's red sensor eye under it
  const CX = 0.016;
  const cab = [
    { z: -0.14, pts: trap8(0.12, 0.08, 0.09, 0.024, 0.036) },
    { z: 0.0, pts: trap8(0.13, 0.09, 0.11, 0.028, 0.04) },
    { z: 0.16, pts: trap8(0.12, 0.08, 0.1, 0.026, 0.036) },
    { z: 0.22, pts: trap8(0.09, 0.06, 0.076, 0.02, 0.032) },
    { z: 0.25, pts: trap8(0.05, 0.03, 0.04, 0.012, 0.028) },
  ];
  L.push(part(loft(cab), { at: [CX, 0, 0], color: LIGHT }));
  const win = (sec, z) => ({ z, pts: scaled(sec.pts.slice(1, 5), 1.04, 1.06, 0.036) });
  L.push(part(loft([win(cab[2], 0.16), win(cab[3], 0.222)]), { at: [CX, 0, 0], to: 'glass' }));
  L.push(ball(0.008, [CX, 0.004, 0.25], [1.4, 1, 1], { to: 'glow', color: [6.5, 0.35, 0.25], mark: 'eye' }, 8));
  // a sensor dome on the cockpit, a mast to starboard
  L.push(part(upright(domeProfile(0.022, 0.014, 0.004), 12), { at: [CX + 0.03, 0.09, 0.02], to: 'metal', color: '#59615a' }));
  L.push(rod([CX - 0.04, 0.085, -0.06], [CX - 0.05, 0.16, -0.1], 0.0028, 0.0018, { to: 'metal', color: METAL }, 4));
  L.push(ball(0.005, [CX - 0.05, 0.16, -0.1], 1, { to: 'glow', color: [6, 0.6, 0.4], mark: 'tip' }, 6));

  // the fin, leaning out to starboard over the stern
  L.push(part(plateZY([[-0.47, 0], [-0.24, 0], [-0.36, 0.11], [-0.46, 0.12]], 0.014, 0.004), { at: [-0.13, 0.04, 0], rot: [0, 0, 0.32], color: GREEN }));
  L.push(part(plateZY([[-0.46, 0.09], [-0.34, 0.09], [-0.355, 0.11], [-0.46, 0.12]], 0.018), { at: [-0.13, 0.04, 0], rot: [0, 0, 0.32], color: DARK }));

  // the engines: a big one to starboard and a smaller pair to port, half
  // sunk into the stern
  for (const [x, y, r] of [
    [-0.11, 0.012, 0.052],
    [0.08, 0.008, 0.036],
    [0.16, 0.004, 0.03],
  ]) {
    L.push(part(turned([[r * 0.78, -0.515], [r, -0.52], [r * 1.12, -0.51], [r * 1.12, -0.36], [r * 0.9, -0.3], [r * 0.6, -0.28]], 14), { at: [x, y, 0], to: 'metal', color: '#525a52' }));
    L.push(part(turned([[r * 1.14, -0.47], [r * 1.14, -0.44]], 14), { at: [x, y, 0], color: DARK }));
    L.push(part(new THREE.CircleGeometry(r * 0.8, 14), { at: [x, y, -0.514], rot: [0, PI, 0], to: 'glow', color: [1.2, 2.4, 5.8] }));
  }

  const tex = k.own(panelTexture(k.rand, { min: 12, base: 150, spread: 14, seam: 0.62, detail: 0.35 }));
  chip(tex, k.rand, 1.2);
  weather(tex, k.rand, 0.4);
  const mats = {
    paint: standard(k, { map: tex, metalness: 0.35, roughness: 0.55 }),
    metal: standard(k, { metalness: 0.7, roughness: 0.45 }),
    glass: standard(k, { color: '#1c1210', metalness: 0.85, roughness: 0.1 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 12));
      // (in steps, so the colours are only sent again when it changes)
      blink('eye', 0.7 + 0.3 * (Math.round(sin(t * 0.9) * 8) / 8));
      blink('tip', pulse(t, 2.2, 0.3, 0.08) ? 1 : 0.15);
    },
  };
}

// ── Hound's Tooth ──

// Bossk's Hound's Tooth, a YT-2000 rebuilt to his own taste: a thick disc of
// a hull like the rest of the YT line's, the cockpit pod out at the front in
// the middle, and a big raised block over its back that runs out past the
// rim into the engines astern; white, trimmed in a dull red, and scarred.
function houndstooth(k) {
  const WHITE = '#dcdbd3';
  const RED = '#8e3b30';
  const GREY = '#a7a69f';
  const DARK = '#393b3f';
  const L = [];
  const R = 0.4;
  // the disc, turned about y: the belly, the rim and the deck
  L.push(part(upright([[0, -0.072], [0.16, -0.066], [0.33, -0.044], [0.385, -0.029], [R, -0.017], [R, 0.017], [0.385, 0.031], [0.33, 0.046], [0.16, 0.064], [0, 0.068]], 34), { color: WHITE }));
  // the deck's height at radius r
  const deck = (r) => (r > 0.33 ? 0.046 - (r - 0.33) * (0.015 / 0.055) : 0.064 - (r - 0.16) * (0.018 / 0.17));
  // the trench round the rim, dark astern and red round the bow
  L.push(part(arc([[R + 0.0015, -0.007], [R + 0.0015, 0.007]], PI - 1.1, 2.2, 14), { to: 'metal', color: DARK }));
  L.push(part(arc([[R + 0.0015, -0.007], [R + 0.0015, 0.007]], 1.1 - PI, 2 * PI - 2.2, 26), { color: RED }));
  // a red band over the deck either side of the bow, and patches where
  // plates have been replaced
  for (const sx of [-1, 1]) L.push(part(arc([[0.36, deck(0.36) + 0.0018], [0.27, deck(0.27) + 0.0018]], sx > 0 ? 0.3 : -0.3 - 0.75, 0.75, 5), { color: RED }));
  for (const [phi, span, r0, r1, c] of [
    [2.1, 0.32, 0.22, 0.31, GREY],
    [4.3, 0.24, 0.3, 0.37, '#b9b2a2'],
    [1.25, 0.2, 0.33, 0.38, GREY],
    [5.0, 0.28, 0.2, 0.29, '#c4bfb2'],
  ]) {
    L.push(part(arc([[r1, deck(r1) + 0.0018], [r0, deck(r0) + 0.0018]], phi, span, 4), { color: c }));
  }

  // the dorsal block: high and square, its front sloping down to the deck,
  // its back out over the rim; a red stripe down each flank
  const back = -0.385;
  L.push(
    part(
      loft([
        { z: back, pts: trap8(0.3, 0.22, 0.1, 0.024, 0.074) },
        { z: back + 0.03, pts: trap8(0.34, 0.25, 0.13, 0.03, 0.088) },
        { z: 0.04, pts: trap8(0.34, 0.25, 0.13, 0.03, 0.088) },
        { z: 0.17, pts: trap8(0.25, 0.16, 0.09, 0.024, 0.072) },
        { z: 0.25, pts: trap8(0.15, 0.09, 0.044, 0.012, 0.052) },
      ]),
      { color: WHITE },
    ),
  );
  // (the flank runs from x 0.1596 at y 0.053 in to 0.1354 at y 0.123)
  const lean = atan2(0.1596 - 0.1354, 0.07);
  const flank = (y, out) => [0.1596 - (y - 0.053) * Math.tan(lean) + out * cos(lean), y + out * sin(lean)];
  for (const sx of [-1, 1]) {
    const [x1, y1] = flank(0.09, 0.0025);
    const [x2, y2] = flank(0.062, 0.0025);
    L.push(part(new THREE.BoxGeometry(0.004, 0.032, 0.38), { at: [sx * x1, y1, -0.16], rot: [0, 0, sx * lean], color: RED }));
    L.push(part(new THREE.BoxGeometry(0.004, 0.012, 0.3), { at: [sx * x2, y2, -0.16], rot: [0, 0, sx * lean], to: 'metal', color: DARK }));
  }
  // on its top: a red panel, vents, a hatch and the sensor dish
  L.push(part(new THREE.BoxGeometry(0.11, 0.004, 0.16), { at: [0, 0.154, -0.26], color: RED }));
  for (let i = 0; i < 5; i++) L.push(part(new THREE.BoxGeometry(0.08, 0.005, 0.01), { at: [0, 0.154, -0.06 - i * 0.024], to: 'metal', color: '#2e3034' }));
  L.push(part(new THREE.BoxGeometry(0.05, 0.006, 0.05), { at: [0.07, 0.154, 0.0], color: GREY }));
  L.push(rod([-0.075, 0.152, -0.05], [-0.075, 0.18, -0.05], 0.004, 0.004, { to: 'metal', color: DARK }, 5));
  L.push(part(upright([[0.0001, 0], [0.018, 0.004], [0.03, 0.012]], 12), { at: [-0.075, 0.178, -0.05], rot: [0.5, 0, 0.2], color: GREY }));

  // the engines: two ports in the dorsal block's stern, a long one along
  // the rim below them
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.BoxGeometry(0.1, 0.05, 0.02), { at: [sx * 0.068, 0.08, back - 0.002], to: 'metal', color: DARK }));
    L.push(part(new THREE.PlaneGeometry(0.084, 0.036), { at: [sx * 0.068, 0.08, back - 0.013], rot: [0, PI, 0], to: 'glow', color: [1.4, 2.6, 6.0] }));
  }
  L.push(part(arc([[0.392, -0.03], [0.43, -0.022], [0.432, 0.02], [0.392, 0.028]], PI - 0.62, 1.24, 14), { to: 'metal', color: DARK }));
  L.push(part(arc([[0.4335, -0.012], [0.4335, 0.012]], PI - 0.58, 1.16, 14), { to: 'glow', color: [1.4, 2.6, 6.0] }));

  // the cockpit pod at the front, its windows round the top of its nose,
  // a red band round it
  const pod = [
    { z: 0.28, pts: box8(0.15, 0.085, 0.028, 0.004) },
    { z: 0.42, pts: box8(0.14, 0.082, 0.027, 0.006) },
    { z: 0.475, pts: box8(0.11, 0.066, 0.022, 0.004) },
    { z: 0.5, pts: box8(0.064, 0.038, 0.013, 0.0) },
  ];
  L.push(part(loft(pod), { color: WHITE }));
  const win = (sec, z) => ({ z, pts: scaled(sec.pts.slice(1, 5), 1.03, 1.06, 0.005) });
  L.push(part(loft([win(pod[1], 0.42), win(pod[2], 0.476)]), { to: 'glass' }));
  L.push(part(loft([pod[1], pod[1]].map((sec, i) => ({ z: 0.37 + i * 0.03, pts: scaled(sec.pts, 1.04, 1.07, 0.006) }))), { color: RED }));
  // the gun turret under the belly, its twin cannons forward
  L.push(part(new THREE.CylinderGeometry(0.034, 0.04, 0.016, 14), { at: [0, -0.076, 0.06], color: GREY }));
  L.push(part(upright(domeProfile(0.032, 0.022), 14), { at: [0, -0.082, 0.06], rot: [PI, 0, 0], color: WHITE }));
  for (const sx of [-1, 1]) L.push(rod([sx * 0.012, -0.094, 0.07], [sx * 0.012, -0.094, 0.15], 0.0045, 0.0035, { to: 'metal', color: DARK }, 6));
  // running lights at the rim's widest
  for (const sx of [-1, 1]) L.push(ball(0.007, [sx * (R + 0.004), 0, 0.0], 1, { to: 'glow', color: sx > 0 ? [7.5, 0.6, 0.45] : [0.5, 3.2, 1], mark: 'lights' }, 6));

  const tex = k.own(panelTexture(k.rand, { min: 14, base: 220, spread: 12, seam: 0.64, detail: 0.3 }));
  weather(tex, k.rand, 0.45);
  scorch(tex, k.rand, 0.3);
  const mats = {
    paint: standard(k, { map: tex, metalness: 0.2, roughness: 0.6 }),
    metal: standard(k, { metalness: 0.75, roughness: 0.4 }),
    glass: standard(k, { color: '#2a3c48', metalness: 0.7, roughness: 0.16 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 5;
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 13));
      blink('lights', pulse(t, 1.9, 0.2, 0.1) ? 1 : 0.15);
    },
  };
}

// ── Punishing One ──

// Dengar's Punishing One, a JumpMaster 5000: a long narrow fuselage with
// the cockpit's glazed bulb at its nose and a big engine in its tail, and
// out to starboard its one great wing, which turns about the fuselage in
// flight, carrying its own engine and a fin at its tip; worn brown and
// orange.
function punishingone(k) {
  const ORANGE = '#a86c40';
  const BROWN = '#76523a';
  const TAN = '#c4a982';
  const DARK = '#3b3530';
  const L = [];
  // the fuselage, its corners cut, narrowing to the cockpit and to the
  // engine
  const hull = [
    { z: -0.47, pts: box8(0.082, 0.078, 0.022) },
    { z: -0.44, pts: box8(0.112, 0.104, 0.03) },
    { z: -0.12, pts: box8(0.124, 0.11, 0.034) },
    { z: 0.16, pts: box8(0.104, 0.094, 0.03, -0.004) },
    { z: 0.31, pts: box8(0.09, 0.084, 0.026, -0.006) },
  ];
  L.push(part(loft(hull), { color: ORANGE }));
  // a brown saddle over its back, tan bands round it, a ridge along its
  // belly
  L.push(part(loft([{ z: -0.4, pts: trap8(0.1, 0.07, 0.03, 0.01, 0.054) }, { z: 0.04, pts: trap8(0.1, 0.07, 0.03, 0.01, 0.054) }, { z: 0.14, pts: trap8(0.06, 0.04, 0.014, 0.004, 0.048) }]), { color: BROWN }));
  for (const z of [-0.3, 0.1]) L.push(part(loft([z, z + 0.024].map((zz) => ({ z: zz, pts: sectionAt(hull, zz, 1.04) }))), { color: TAN }));
  L.push(part(new THREE.BoxGeometry(0.03, 0.014, 0.5), { at: [0, -0.056, -0.12], color: BROWN }));
  // the cockpit: a bulb turned about z, glazed over its top and front, with
  // the frame's ribs across the glass
  const nose = [0, -0.004, 0];
  L.push(part(turned([[0.044, 0.29], [0.05, 0.33], [0.051, 0.38], [0.047, 0.43], [0.038, 0.47], [0.024, 0.495], [0.0001, 0.505]], 16), { at: nose, color: TAN }));
  const visor = new THREE.LatheGeometry([[0.0525, 0.355], [0.0525, 0.38], [0.0485, 0.43], [0.0395, 0.47], [0.0255, 0.495], [0.004, 0.5055]].map(([r, z]) => new THREE.Vector2(r, z)), 14, PI * 0.58, PI * 0.84).rotateX(PI / 2);
  L.push(part(visor, { at: nose, to: 'glass' }));
  for (const a of [-0.62, 0, 0.62]) {
    const p = (r, z) => [sin(a) * r, cos(a) * r - 0.004, z];
    L.push(rod(p(0.054, 0.36), p(0.05, 0.43), 0.0032, 0.0032, { color: TAN }, 4), rod(p(0.05, 0.43), p(0.041, 0.47), 0.0032, 0.0032, { color: TAN }, 4), rod(p(0.041, 0.47), p(0.026, 0.496), 0.0032, 0.0032, { color: TAN }, 4));
  }
  // twin cannons under the chin
  for (const sx of [-1, 1]) L.push(rod([sx * 0.026, -0.05, 0.22], [sx * 0.026, -0.05, 0.42], 0.0055, 0.0045, { to: 'metal', color: DARK }, 6));
  // the tail engine, a stubby fin over it and a small counter-fin to port
  L.push(part(turned([[0.03, -0.5], [0.036, -0.506], [0.046, -0.5], [0.05, -0.47], [0.05, -0.43], [0.046, -0.42]], 14), { at: [0, 0.002, 0], to: 'metal', color: '#4a4440' }));
  L.push(part(new THREE.CircleGeometry(0.031, 14), { at: [0, 0.002, -0.5], rot: [0, PI, 0], to: 'glow', color: [1.0, 2.2, 6.0] }));
  L.push(part(plateZY([[-0.44, 0], [-0.24, 0], [-0.36, 0.08], [-0.44, 0.09]], 0.012, 0.003), { at: [0, 0.064, 0], color: ORANGE }));
  L.push(part(plateXZ([[0, -0.36], [0.08, -0.4], [0.08, -0.34], [0, -0.22]], 0.014, 0.004), { at: [0.058, -0.01, 0], rot: [0, 0, -0.2], color: BROWN }));

  // the wing, round its hinge on the starboard flank: the plate, a tan
  // spar along its leading edge, the dark radiator at its trailing edge,
  // its engine at the root and the fin standing up from its tip
  const S = 0.46;
  const W = [
    part(plateXZ([[0, -0.44], [-S, -0.47], [-S, -0.33], [-0.12, -0.04], [0, 0.02]], 0.026, 0.006), { color: ORANGE }),
    part(plateXZ([[-0.06, -0.06], [-0.12, -0.065], [-S + 0.02, -0.355], [-S + 0.02, -0.33], [-0.12, -0.035], [-0.04, 0.0]], 0.031), { color: TAN }),
    part(plateXZ([[-0.2, -0.448], [-S + 0.03, -0.465], [-S + 0.03, -0.42], [-0.2, -0.405]], 0.031), { to: 'metal', color: '#4d4640' }),
    part(plateZY([[-0.5, 0], [-0.33, 0], [-0.4, 0.13], [-0.49, 0.14]], 0.014, 0.004), { at: [-S, 0.0, 0], color: BROWN }),
    part(plateZY([[-0.48, -0.0], [-0.36, 0], [-0.42, -0.06], [-0.48, -0.06]], 0.014, 0.004), { at: [-S, 0.0, 0], color: BROWN }),
    part(loft([{ z: -0.43, pts: box8(0.05, 0.05, 0.014) }, { z: -0.02, pts: box8(0.05, 0.05, 0.014) }]), { at: [-0.012, 0, 0], color: BROWN }),
  ];
  const eng = [-0.15, 0.006, 0];
  W.push(part(turned([[0.026, -0.505], [0.032, -0.51], [0.04, -0.5], [0.042, -0.45], [0.042, -0.26], [0.034, -0.22], [0.022, -0.21]], 14), { at: eng, color: TAN }));
  W.push(part(turned([[0.0425, -0.4], [0.0425, -0.37]], 14), { at: eng, color: BROWN }));
  W.push(part(new THREE.CircleGeometry(0.027, 14), { at: [eng[0], eng[1], -0.505], rot: [0, PI, 0], to: 'glow', color: [1.0, 2.2, 6.0] }));
  W.push(ball(0.006, [-S, 0.142, -0.49], 1, { to: 'glow', color: [0.5, 3.2, 1], mark: 'tip' }, 6));

  const tex = k.own(panelTexture(k.rand, { min: 12, base: 214, spread: 16, seam: 0.6, detail: 0.35 }));
  weather(tex, k.rand, 0.5);
  scorch(tex, k.rand, 0.25);
  const mats = {
    paint: standard(k, { map: tex, metalness: 0.25, roughness: 0.62 }),
    metal: standard(k, { metalness: 0.7, roughness: 0.45 }),
    glass: standard(k, { color: '#2c3b44', metalness: 0.75, roughness: 0.14 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  const WM = meshes(k, W, mats);
  // the wing on its hinge, turning slowly up and back down
  const hinge = new THREE.Group();
  hinge.position.set(-0.058, 0, 0);
  hinge.add(...Object.values(WM));
  const blink = blinker(WM.glow.geometry);
  return {
    root: [...Object.values(M), hinge],
    update(t) {
      mats.glow.color.setScalar(flicker(t, 14));
      hinge.rotation.z = -0.3 - 0.3 * sin(t * 0.35);
      blink('tip', pulse(t, 1.8, 0, 0.1) ? 1 : 0.15);
    },
  };
}

// ── Weequay pirate skiff ──

// A Weequay pirate's skiff: a boxy junk fighter patched together from
// whatever was to hand, its plating in mismatched rust and faded paint, odd
// stubby wings, a crude cannon bolted on top and an engine far too big for
// it at the back, coughing as it goes.
function skiff(k) {
  const RUST = '#8c5132';
  const PAINT = ['#7e8a74', '#7f8a99', '#b2a37f', '#9c6c4a', '#a7a59c', '#6e7c86', '#a4473a'];
  const DARK = '#36322e';
  const L = [];
  const colour = () => PAINT[Math.floor(k.rand() * PAINT.length)];
  // the hull: a box, its corners cut, with a blunt wedge of a nose
  const W = 0.19;
  const H = 0.15;
  const hull = [
    { z: -0.25, pts: box8(0.17, 0.14, 0.03, 0.004) },
    { z: -0.22, pts: box8(W, H, 0.034) },
    { z: 0.1, pts: box8(W, H, 0.034) },
    { z: 0.27, pts: trap8(0.18, 0.12, 0.13, 0.028, -0.008) },
    { z: 0.38, pts: trap8(0.13, 0.08, 0.085, 0.018, -0.02) },
    { z: 0.41, pts: trap8(0.09, 0.05, 0.05, 0.012, -0.024) },
  ];
  L.push(part(loft(hull), { color: '#8a8a80' }));
  // the window: a slit across the top of the nose
  L.push(part(loft([0.297, 0.352].map((z) => ({ z, pts: sectionAt(hull, z, 1.03).slice(1, 5) }))), { to: 'glass' }));
  // patches: plates riveted over the flanks and the top, each its own
  // colour, none quite square
  for (const sx of [-1, 1]) {
    for (let z = -0.19; z < 0.1; z += 0.07 + k.rand() * 0.03) {
      const d = 0.05 + k.rand() * 0.03;
      const h = 0.04 + k.rand() * 0.025;
      L.push(part(new THREE.BoxGeometry(0.006, h, d), { at: [sx * (W / 2 + 0.0015), (k.rand() - 0.5) * 0.02, z + d / 2], rot: [(k.rand() - 0.5) * 0.12, 0, 0], color: colour() }));
    }
  }
  for (let z = -0.2; z < 0.1; z += 0.08 + k.rand() * 0.03) {
    const d = 0.05 + k.rand() * 0.03;
    L.push(part(new THREE.BoxGeometry(0.07 + k.rand() * 0.02, 0.006, d), { at: [(k.rand() - 0.5) * 0.02, H / 2 + 0.0015, z + d / 2], rot: [0, (k.rand() - 0.5) * 0.2, 0], color: colour() }));
  }
  L.push(part(new THREE.BoxGeometry(0.06, 0.006, 0.08), { at: [0.02, -H / 2 - 0.0015, 0.0], rot: [0, 0.1, 0], color: colour() }));

  // the cannon on top: a box of a mount bolted off-centre, the barrel with
  // a muzzle brake and a strut holding it down
  const G = [0.03, H / 2, 0];
  L.push(part(new THREE.BoxGeometry(0.05, 0.036, 0.08), { at: [G[0], G[1] + 0.016, 0.02], color: '#6f6b62' }));
  L.push(part(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 8), { at: [G[0], G[1] + 0.04, 0.03], rot: [PI / 2, 0, 0], to: 'metal', color: DARK }));
  L.push(rod([G[0], G[1] + 0.04, 0.06], [G[0], G[1] + 0.04, 0.42], 0.0075, 0.0075, { to: 'metal', color: '#4a4540' }, 6));
  L.push(rod([G[0], G[1] + 0.04, 0.4], [G[0], G[1] + 0.04, 0.45], 0.012, 0.012, { to: 'metal', color: DARK }, 6));
  L.push(rod([G[0], 0.044, 0.3], [G[0], G[1] + 0.034, 0.27], 0.004, 0.004, { to: 'metal', color: DARK }, 4));
  // a fuel tank strapped to the starboard flank, and an aerial
  L.push(part(turned([[0.0001, -0.16], [0.018, -0.155], [0.024, -0.14], [0.024, 0.04], [0.018, 0.055], [0.0001, 0.06]], 10), { at: [-W / 2 - 0.021, -0.02, 0], color: '#7f8a6e' }));
  for (const z of [-0.1, 0.0]) L.push(part(turned([[0.0255, z], [0.0255, z + 0.01]], 10), { at: [-W / 2 - 0.021, -0.02, 0], to: 'metal', color: DARK }));
  L.push(rod([-0.05, H / 2, -0.15], [-0.07, H / 2 + 0.13, -0.2], 0.003, 0.0015, { to: 'metal', color: DARK }, 4));

  // stubby wings that don't match: a plain slab to port, a shorter one bent
  // down to starboard, and a fin bolted on crooked
  L.push(part(plateXZ([[0, -0.2], [0.17, -0.23], [0.17, -0.13], [0, 0.04]], 0.016, 0.004), { at: [W / 2 - 0.01, -0.03, 0], rot: [0, 0, -0.08], color: colour() }));
  L.push(part(plateXZ([[0, -0.21], [-0.1, -0.2], [-0.1, -0.08], [0, 0.0]], 0.016, 0.004), { at: [-W / 2 + 0.01, -0.035, 0], rot: [0, 0, 0.1], color: colour() }));
  L.push(part(plateXZ([[0, -0.2], [-0.06, -0.19], [-0.06, -0.12], [0, -0.08]], 0.014, 0.004), { at: [-W / 2 - 0.088, -0.045, 0], rot: [0, 0, 0.5], color: colour() }));
  L.push(part(plateZY([[-0.22, 0], [-0.08, 0], [-0.17, 0.09], [-0.22, 0.1]], 0.012, 0.003), { at: [-0.035, H / 2 - 0.002, 0], rot: [0, 0.05, 0.12], color: colour() }));

  // the engine: far too big for the hull, slung on behind it on brackets,
  // banded where it's been patched, its nozzle glowing
  const E = [0, 0.012, 0];
  const ER = 0.134;
  L.push(part(turned([[0.078, -0.5], [0.1, -0.505], [0.118, -0.49], [0.132, -0.46], [ER, -0.32], [0.125, -0.28], [0.1, -0.245], [0.067, -0.225], [0.034, -0.22]], 16), { at: E, color: RUST }));
  for (const [z, c] of [
    [-0.43, '#6e7c86'],
    [-0.36, '#4a4540'],
    [-0.31, '#9c6c4a'],
  ]) {
    L.push(part(turned([[ER, z], [ER + 0.0035, z + 0.003], [ER + 0.0035, z + 0.017], [ER, z + 0.02]], 16), { at: E, color: c }));
  }
  L.push(part(turned([[0.058, -0.49], [0.078, -0.5]], 16), { at: E, to: 'metal', color: DARK }));
  L.push(part(new THREE.CircleGeometry(0.06, 16), { at: [E[0], E[1], -0.49], rot: [0, PI, 0], to: 'glow', color: [3.6, 1.6, 0.5] }));
  L.push(part(new THREE.ConeGeometry(0.048, 0.034, 12, 1, true), { at: [E[0], E[1], -0.507], rot: [-PI / 2, 0, 0], to: 'glow', color: [3.0, 1.2, 0.4] }));
  for (const [x, y] of [
    [0.07, 0.055],
    [-0.07, 0.055],
    [0.07, -0.055],
    [-0.07, -0.055],
  ]) {
    L.push(rod([x, y, -0.2], [x * 1.3, y * 1.3 + E[1], -0.27], 0.007, 0.007, { to: 'metal', color: DARK }, 5));
  }
  // exhaust stacks up its back
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.045, 0.128, -0.29], [sx * 0.047, 0.146, -0.4], 0.008, 0.008, { to: 'metal', color: '#4a4540' }, 6));
    L.push(rod([sx * 0.047, 0.146, -0.4], [sx * 0.048, 0.148, -0.47], 0.008, 0.009, { to: 'metal', color: DARK }, 6));
  }

  const tex = k.own(panelTexture(k.rand, { min: 10, base: 214, spread: 24, seam: 0.55, detail: 0.45 }));
  rust(tex, k.rand, 1);
  weather(tex, k.rand, 0.6);
  const mats = {
    paint: standard(k, { map: tex, metalness: 0.25, roughness: 0.7 }),
    metal: standard(k, { metalness: 0.65, roughness: 0.5 }),
    glass: standard(k, { color: '#2c3a34', metalness: 0.7, roughness: 0.2 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 7;
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      // it coughs: now and then the glow all but dies
      const cough = pulse(t, 1.9, 0, 0.09) || pulse(t, 3.3, 0.45, 0.06);
      mats.glow.color.setScalar(flicker(t, 15) * (cough ? 0.25 : 1) * (1 + 0.12 * sin(t * 61)));
    },
  };
}

export const FLEET = { freighter, transport, corvette, tieadvanced, tiebomber, gunboat, ig2000, houndstooth, punishingone, skiff };
