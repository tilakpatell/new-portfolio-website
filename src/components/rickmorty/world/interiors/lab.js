// Rick's garage lab, for ../interiors.js, as the show's stills have it: dark
// wood-plank walls under a dark beamed ceiling with a long fluorescent light,
// a pale grey-green concrete floor; the L-shaped workbench (pale grey top,
// dark cupboards, one door open) under a pegboard of tools, reels and coils,
// with the round-bottomed flask on its stand and its glass tubing, conical
// flasks and beakers of glowing orange, green and pink, the green radio, the
// magnifier lamp, a teal gadget, a coil-wrapped gizmo, a plumbus and the
// Meeseeks box on it, the red office chair, and Rick at it; the corkboard of
// notes and red string, the round clock over the mountain calendar; the grey
// metal shelving ("Time travel stuff", jars, a spiky ball, a green alien
// head) under the orange floral wall lamp; the pinkish-tan machine on its
// stand (the plumbus factory); the cream washer and dryer; the Portal panic
// cabinet; and the portal, swirling green on the east wall.

import * as THREE from 'three';
import { AREAS, FURNITURE, LINKS, PEOPLE } from '../rules';
import { rng, speckle } from '../kit';
import { BALL, BALL8, BOX, CYL, CYL8, DOOR_H, TAU, door, fitText, lathe, makeRoom, needCast, person, scribble, tiledPaint, tube, wallLine } from './shell';
import { LOOKS } from './house';

const H = 2.9; // the lab's walls, to its ceiling
const TOP = 0xc9ccc6; // the bench top
const CAB = 0x35312d; // its cupboards
const GREY = 0x8d949a; // the shelving

const planks = (base, seed, across = false) => (g, w, h) => {
  const r = rng(seed);
  const n = 10;
  const bw = (across ? h : w) / n;
  const c = new THREE.Color(base);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `#${c.clone().multiplyScalar(0.82 + r() * 0.3).getHexString()}`;
    if (across) g.fillRect(0, i * bw, w, bw);
    else g.fillRect(i * bw, 0, bw, h);
    g.fillStyle = 'rgba(20,10,4,0.18)';
    for (let k = 0; k < 4; k++) {
      const o = r() * bw;
      if (across) g.fillRect(0, i * bw + o, w, 1);
      else g.fillRect(i * bw + o, 0, 1, h);
    }
    if (r() < 0.35) {
      g.fillStyle = 'rgba(25,12,5,0.45)';
      g.beginPath();
      if (across) g.ellipse(r() * w, i * bw + bw / 2, 4, 2.5, 0, 0, TAU);
      else g.ellipse(i * bw + bw / 2, r() * h, 2.5, 4, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(15,8,3,0.85)';
    if (across) g.fillRect(0, i * bw, w, 2);
    else g.fillRect(i * bw, 0, 2, h);
  }
};

// where the corkboard's pins are (0..1 across, 0..1 down), linked by red string
const PINS = [
  [0.1, 0.2],
  [0.34, 0.14],
  [0.6, 0.24],
  [0.86, 0.16],
  [0.2, 0.62],
  [0.48, 0.55],
  [0.74, 0.7],
  [0.9, 0.52],
];
const STRINGS = [
  [0, 1],
  [1, 5],
  [5, 2],
  [2, 3],
  [5, 4],
  [5, 6],
  [6, 7],
  [3, 7],
  [0, 4],
];

function paintCells(R) {
  R.cell('pegboard', 512, 146, (g, w, h) => {
    g.fillStyle = '#b8895a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a3a20';
    for (let y = 6; y < h; y += 9) for (let x = 6; x < w; x += 9) g.fillRect(x - 1, y - 1, 2.2, 2.2);
    // tool outlines, the way a tidy garage paints them
    g.strokeStyle = 'rgba(60,30,10,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) g.strokeRect(40 + i * 14, 30, 6, 60 + i * 6);
    g.strokeStyle = '#1a1210';
    g.strokeRect(1, 1, w - 2, h - 2);
  });
  R.cell('corkboard', 300, 144, (g, w, h) => {
    speckle(g, w, h, { base: '#b98a55', specks: ['#a5763f', '#c99a66', '#8f6434'], n: 2600, size: 1.6, seed: 5 });
    const r = rng(8);
    // notes, pages and photos, pinned
    for (const [i, [px, py]] of PINS.entries()) {
      const x = px * w;
      const y = py * h;
      const kind = i % 4;
      g.save();
      g.translate(x, y);
      g.rotate((r() - 0.5) * 0.3);
      if (kind === 0) {
        g.fillStyle = '#f4f0e0';
        g.fillRect(-22, -4, 44, 54);
        scribble(g, -18, 4, 36, 6, { seed: i + 3 });
      } else if (kind === 1) {
        g.fillStyle = '#f7e27a';
        g.fillRect(-16, -4, 32, 30);
        scribble(g, -13, 3, 26, 3, { seed: i + 9, color: '#a33' });
      } else if (kind === 2) {
        g.fillStyle = '#fff';
        g.fillRect(-18, -4, 36, 30);
        g.fillStyle = '#7ab0c8';
        g.fillRect(-15, -1, 30, 18);
        g.fillStyle = '#3f8f3a';
        g.beginPath();
        g.arc(-4, 9, 6, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = '#e8f2f6';
        g.fillRect(-20, -4, 40, 46);
        g.strokeStyle = '#3a6fb0';
        g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(0, 18, 4 + k * 4, 0, TAU);
          g.stroke();
        }
      }
      g.restore();
    }
    // the red string, pin to pin
    g.strokeStyle = '#d0201c';
    g.lineWidth = 1.6;
    for (const [a, b] of STRINGS) {
      g.beginPath();
      g.moveTo(PINS[a][0] * w, PINS[a][1] * h);
      g.lineTo(PINS[b][0] * w, PINS[b][1] * h);
      g.stroke();
    }
    g.strokeStyle = '#1a1210';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  });
  R.cell('clock', 128, 128, (g, w, h) => {
    g.fillStyle = '#2b2b30';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7f4ea';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 6, 0, TAU);
    g.fill();
    g.fillStyle = '#1a1210';
    g.font = '700 13px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * TAU;
      g.fillText(String(i), w / 2 + Math.sin(a) * (w / 2 - 20), h / 2 - Math.cos(a) * (w / 2 - 20));
    }
    g.strokeStyle = '#1a1210';
    g.lineCap = 'round';
    g.lineWidth = 4;
    const hand = (a, l) => {
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.lineTo(w / 2 + Math.sin(a) * l, h / 2 - Math.cos(a) * l);
      g.stroke();
    };
    hand(TAU * (10.2 / 12), 26);
    g.lineWidth = 3;
    hand(TAU * (2 / 12), 40);
    g.strokeStyle = '#c8302a';
    g.lineWidth = 1.5;
    hand(TAU * 0.55, 44);
  });
  R.cell('calendar', 96, 136, (g, w, h) => {
    g.fillStyle = '#f7f4ea';
    g.fillRect(0, 0, w, h);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.5);
    sky.addColorStop(0, '#5aa8e0');
    sky.addColorStop(1, '#bfe4f6');
    g.fillStyle = sky;
    g.fillRect(4, 4, w - 8, h * 0.48);
    g.fillStyle = '#6f7f9a';
    g.beginPath();
    g.moveTo(4, h * 0.44);
    g.lineTo(w * 0.32, h * 0.14);
    g.lineTo(w * 0.52, h * 0.34);
    g.lineTo(w * 0.72, h * 0.1);
    g.lineTo(w - 4, h * 0.44);
    g.fill();
    g.fillStyle = '#fff';
    for (const [x, y] of [
      [0.32, 0.14],
      [0.72, 0.1],
    ]) {
      g.beginPath();
      g.moveTo(w * x - 9, h * y + 9);
      g.lineTo(w * x, h * y);
      g.lineTo(w * x + 9, h * y + 9);
      g.fill();
    }
    g.fillStyle = '#4f9c3c';
    g.fillRect(4, h * 0.44, w - 8, h * 0.08);
    g.fillStyle = '#c8302a';
    g.fillRect(4, h * 0.54, w - 8, 10);
    g.strokeStyle = '#9a9a9a';
    g.lineWidth = 1;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 7; c++) {
        g.strokeRect(5 + c * ((w - 10) / 7), h * 0.62 + r * 9.5, (w - 10) / 7, 9.5);
        if ((r * 7 + c) % 9 === 4) {
          g.fillStyle = '#c8302a';
          g.fillRect(7 + c * ((w - 10) / 7), h * 0.62 + r * 9.5 + 2, 6, 5);
        }
      }
    g.strokeStyle = '#1a1210';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  });
  R.cell('timetravel', 128, 64, (g, w, h) => {
    g.fillStyle = '#c9a46a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#a8844c';
    g.fillRect(0, h * 0.42, w, 3);
    g.save();
    g.rotate(-0.04);
    fitText(g, 'Time travel', w / 2, h * 0.3, w - 14, 20, { font: 'Comic Sans MS, Marker Felt, cursive', weight: '700', color: '#1a1a1a' });
    fitText(g, 'stuff', w / 2, h * 0.68, w - 14, 22, { font: 'Comic Sans MS, Marker Felt, cursive', weight: '700', color: '#1a1a1a' });
    g.restore();
  });
  R.cell('label', 64, 32, (g, w, h) => {
    g.fillStyle = '#c9a46a';
    g.fillRect(0, 0, w, h);
    scribble(g, 8, 10, w - 16, 2, { gap: 9, color: '#222', seed: 4 });
  });
  R.cell('floral', 128, 64, (g, w, h) => {
    g.fillStyle = '#f08a2a';
    g.fillRect(0, 0, w, h);
    const r = rng(12);
    for (let i = 0; i < 14; i++) {
      const x = r() * w;
      const y = r() * h;
      g.fillStyle = r() < 0.5 ? '#ffd24a' : '#f7f0d0';
      for (let p = 0; p < 5; p++) {
        g.beginPath();
        g.arc(x + Math.cos((p / 5) * TAU) * 5, y + Math.sin((p / 5) * TAU) * 5, 3.5, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#c8501a';
      g.beginPath();
      g.arc(x, y, 2.5, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#b8501e';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, h - 3, w, 3);
  });
  R.cell('ppscreen', 128, 96, (g, w, h) => {
    g.fillStyle = '#0a0c12';
    g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h * 0.45, 2, w / 2, h * 0.45, 30);
    gr.addColorStop(0, '#e7ffd0');
    gr.addColorStop(0.5, '#97ce4c');
    gr.addColorStop(1, 'rgba(47,138,42,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(w / 2, h * 0.45, 30, 24, 0, 0, TAU);
    g.fill();
    fitText(g, 'PORTAL PANIC', w / 2, h * 0.14, w - 12, 15, { color: '#45c5e8' });
    g.fillStyle = '#f2d23c';
    g.fillRect(w * 0.2, h * 0.68, 6, 9);
    g.fillStyle = '#9fc6d6';
    g.fillRect(w * 0.75, h * 0.66, 7, 11);
    g.fillStyle = '#fff';
    g.font = '700 9px monospace';
    g.textAlign = 'center';
    g.fillText('INSERT COIN', w / 2, h * 0.9);
  });
  R.cell('ppmarquee', 128, 32, (g, w, h) => {
    g.fillStyle = '#1b1424';
    g.fillRect(0, 0, w, h);
    fitText(g, 'PORTAL PANIC', w / 2 + 1, h / 2 + 1, w - 10, 20, { color: '#c3e053' });
    fitText(g, 'PORTAL PANIC', w / 2, h / 2, w - 10, 20, { color: '#45c5e8' });
  });
  R.cell('ppside', 64, 128, (g, w, h) => {
    g.fillStyle = '#1b1424';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#97ce4c';
    g.lineWidth = 5;
    g.beginPath();
    for (let a = 0; a < TAU * 2.5; a += 0.1) {
      const r = 3 + a * 3.2;
      g.lineTo(w / 2 + Math.cos(a) * r, h * 0.45 + Math.sin(a) * r * 1.3);
    }
    g.stroke();
  });
  R.cell('gauges', 128, 48, (g, w, h) => {
    g.fillStyle = '#d8a890';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 42;
      g.fillStyle = '#f7f4ea';
      g.beginPath();
      g.arc(x, h / 2, 16, 0, TAU);
      g.fill();
      g.strokeStyle = '#2b2b30';
      g.lineWidth = 2.5;
      g.stroke();
      g.strokeStyle = '#c8302a';
      g.beginPath();
      g.moveTo(x, h / 2);
      g.lineTo(x + Math.cos(-0.6 - i) * 12, h / 2 + Math.sin(-0.6 - i) * 12);
      g.stroke();
    }
  });
  R.cell('notes', 64, 80, (g, w, h) => {
    g.fillStyle = '#f4f0e0';
    g.fillRect(0, 0, w, h);
    scribble(g, 6, 10, w - 12, 8, { gap: 8, seed: 21 });
  });
}

// ── the bench and what's on it ──

function bench(R, it, glass) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.box(TOP, 0, h - 0.06, 0, w, 0.06, d);
  f.box(0x1e1b18, 0, 0, -0.1, w - 0.04, 0.08, d - 0.2);
  // the cupboards: two doors to each metre, one of them standing open on a
  // cupboard with things in it
  const front = d / 2 - 0.1;
  const OPEN = 13;
  const uo = -w / 2 + 0.25 + OPEN * 0.5;
  const body = (u0, u1, v0, v1) => f.box(CAB, (u0 + u1) / 2, 0.08, (v0 + v1) / 2, u1 - u0, h - 0.14, v1 - v0);
  body(-w / 2 + 0.02, uo - 0.25, -d / 2, front);
  body(uo + 0.25, w / 2 - 0.02, -d / 2, front);
  body(uo - 0.25, uo + 0.25, -d / 2, front - 0.5);
  f.box(0x161310, uo, 0.08, front - 0.25, 0.5, 0.06, 0.5).box(0x161310, uo, 0.48, front - 0.25, 0.5, 0.025, 0.5);
  for (let i = 0; i < 16; i++) {
    const u = -w / 2 + 0.25 + i * 0.5;
    if (i === OPEN) {
      // inside: a can, a box, a coil of cable
      f.cyl(0x9aa3ab, u - 0.1, 0.14, front - 0.2, 0.06, 0.16).box(0xc9a46a, u + 0.1, 0.14, front - 0.28, 0.16, 0.14, 0.2);
      f.part(new THREE.TorusGeometry(0.07, 0.02, 6, 14), 0xd87a2a, u, 0.505, front - 0.25, 0, 1, 1, 1, Math.PI / 2);
      f.box(0x3a6fb0, u + 0.05, 0.505, front - 0.3, 0.12, 0.22, 0.08);
      const dr = f.sub(u - 0.23, front + 0.01, -1.25);
      dr.box(0x433e38, 0.23, 0.14, 0.012, 0.46, 0.72, 0.022).box(0x9aa3ab, 0.4, 0.42, 0.04, 0.025, 0.16, 0.025);
      continue;
    }
    f.box(0x433e38, u, 0.14, front + 0.012, 0.46, 0.72, 0.02);
    f.box(0x9aa3ab, u + (i % 2 ? -0.17 : 0.17), 0.66, front + 0.035, 0.025, 0.12, 0.025);
  }
  const y = h; // the bench top
  const back = -d / 2;
  // the pegboard over the bench, framed, with its tools
  f.decal('pegboard', -1.8, 1.82, back + 0.022, 4.4, 1.25);
  for (const [u0, y0, ww, hh] of [
    [-1.8, 2.45, 4.5, 0.05],
    [-1.8, 1.15, 4.5, 0.05],
    [-4.02, 1.8, 0.05, 1.3],
    [0.42, 1.8, 0.05, 1.3],
  ])
    f.cbox(0x5a3a20, u0, y0, back + 0.03, ww, hh, 0.04);
  pegTools(f, back + 0.04);
  // the corkboard over the east end, its pins
  const cb = { u: 1.95, y: 1.82, w: 2.5, h: 1.2 };
  f.decal('corkboard', cb.u, cb.y, back + 0.024, cb.w, cb.h);
  f.cbox(0x6b4426, cb.u, cb.y + cb.h / 2 + 0.03, back + 0.03, cb.w + 0.12, 0.06, 0.04).cbox(0x6b4426, cb.u, cb.y - cb.h / 2 - 0.03, back + 0.03, cb.w + 0.12, 0.06, 0.04);
  for (const s of [-1, 1]) f.cbox(0x6b4426, cb.u + s * (cb.w / 2 + 0.03), cb.y, back + 0.03, 0.06, cb.h + 0.12, 0.04);
  for (const [px, py] of PINS) f.ball(0xd0201c, cb.u - cb.w / 2 + px * cb.w, cb.y + cb.h / 2 - py * cb.h, back + 0.045, 0.018);

  // the flask on its ring stand over a burner, its tubing over to a conical flask
  const fu = -3.35;
  const fv = -0.2;
  f.box(0x2b2b30, fu, y, fv - 0.05, 0.24, 0.02, 0.32).cyl(0x9aa3ab, fu - 0.08, y, fv - 0.15, 0.012, 0.8);
  f.part(new THREE.TorusGeometry(0.1, 0.008, 6, 20), 0x9aa3ab, fu, y + 0.36, fv, 0, 1, 1, 1, Math.PI / 2).cbox(0x9aa3ab, fu - 0.06, y + 0.36, fv - 0.08, 0.04, 0.012, 0.14, 0.6);
  f.cyl(0x2b2b30, fu, y + 0.02, fv, 0.03, 0.12).part(new THREE.ConeGeometry(0.025, 0.08, 8), 0x000000, fu, y + 0.19, fv);
  f.glow(new THREE.ConeGeometry(0.022, 0.07, 8), 0x58a8ff, 2.2, fu, y + 0.19, fv);
  glass.add(BALL, glass.mat, f.mat(fu, y + 0.47, fv, 0, 0.24));
  glass.add(CYL, glass.mat, f.mat(fu, y + 0.65, fv, 0, 0.05, 0.22, 0.05));
  f.glow(new THREE.SphereGeometry(0.105, 16, 8, 0, TAU, Math.PI * 0.42, Math.PI * 0.58), 0x6dff4a, 1.6, fu, y + 0.47, fv);
  glass.add(tube([[fu, y + 0.76, fv], [fu + 0.12, y + 0.86, fv + 0.02], [fu + 0.38, y + 0.62, fv + 0.06], [fu + 0.55, y + 0.3, fv + 0.08]], 0.009), glass.mat, f.mat(0, 0, 0));
  // conical flasks, beakers and a measuring cylinder, liquids glowing
  const conical = lathe([[0, 0], [0.09, 0], [0.095, 0.01], [0.03, 0.16], [0.025, 0.24], [0.028, 0.25]], 16);
  const coneLiquid = lathe([[0, 0], [0.085, 0], [0.088, 0.01], [0.05, 0.1], [0, 0.1]], 16);
  const beaker = lathe([[0, 0], [0.06, 0], [0.062, 0.16], [0.07, 0.165]], 16);
  for (const [u, v, k, colour, kind] of [
    [-2.8, 0.08, 1, 0xff8a1e, 'cone'],
    [-2.52, -0.18, 1, 0xff5ab0, 'beaker'],
    [-2.32, 0.12, 0.75, 0x6dff4a, 'cone'],
    [-2.12, -0.22, 1, 0xff8a1e, 'tall'],
    [-1.92, 0.05, 0.8, 0xff5ab0, 'cone'],
  ]) {
    if (kind === 'cone') {
      glass.add(conical, glass.mat, f.mat(u, y, v, 0, k));
      f.glow(coneLiquid, colour, 1.5, u, y + 0.005, v, 0, k);
    } else if (kind === 'beaker') {
      glass.add(beaker, glass.mat, f.mat(u, y, v, 0, 1));
      f.glow(CYL, colour, 1.5, u, y + 0.055, v, 0, 0.11, 0.1, 0.11);
    } else {
      glass.add(CYL, glass.mat, f.mat(u, y + 0.16, v, 0, 0.06, 0.32, 0.06));
      f.glow(CYL, colour, 1.5, u, y + 0.1, v, 0, 0.05, 0.19, 0.05);
      f.cyl(0x2b2b30, u, y, v, 0.045, 0.012);
    }
  }
  // the green radio-like box: speaker, dial, knobs, aerial and handle
  const ru = -1.2;
  const rv = -0.2;
  f.box(0x5b8a44, ru, y, rv, 0.46, 0.27, 0.24).box(0x4a7236, ru, y + 0.27, rv, 0.44, 0.02, 0.22);
  f.cyl(0x22261e, ru - 0.1, y + 0.135, rv + 0.12, 0.085, 0.012, Math.PI / 2);
  f.glow(BOX, 0xd8ff8a, 1.4, ru + 0.12, y + 0.18, rv + 0.121, 0, 0.16, 0.05, 0.004);
  for (const du of [0.06, 0.18]) f.cyl(0xe8e3d6, ru + du, y + 0.07, rv + 0.12, 0.022, 0.03, Math.PI / 2);
  f.cyl(0x9aa3ab, ru + 0.18, y + 0.29, rv - 0.06, 0.006, 0.5, 0, -0.45);
  f.cbox(0x2b2b30, ru, y + 0.33, rv, 0.24, 0.025, 0.03);
  // the magnifier lamp: a clamp at the back, two arms, a ring and its lens
  const lu = -0.6;
  f.box(0x9aa3ab, lu, y, back + 0.1, 0.08, 0.06, 0.08).cyl(0x9aa3ab, lu, y + 0.265, back + 0.152, 0.012, 0.42, 0.25, 0);
  f.cyl(0x9aa3ab, lu, y + 0.46, back + 0.35, 0.012, 0.3, 1.64, 0);
  f.part(new THREE.TorusGeometry(0.1, 0.022, 8, 24), 0xe8e3d6, lu, y + 0.45, back + 0.55, 0, 1, 1, 1, 1.25);
  f.glow(new THREE.TorusGeometry(0.085, 0.008, 6, 24), 0xf4fff0, 1.6, lu, y + 0.44, back + 0.55, 0, 1, 1, 1, 1.25);
  glass.add(CYL, glass.mat, f.mat(lu, y + 0.45, back + 0.55, 0, 0.17, 0.01, 0.17, -0.32));
  // a teal gadget with buttons and a little screen
  const tu = 0.15;
  f.box(0x2fb5a8, tu, y, -0.12, 0.32, 0.14, 0.22).box(0x239086, tu, y + 0.14, -0.16, 0.3, 0.06, 0.12, 0, -0.5);
  f.glow(BOX, 0x8affe8, 1.5, tu - 0.05, y + 0.175, -0.13, 0, 0.12, 0.004, 0.05, -0.5);
  for (let i = 0; i < 3; i++) f.cyl([0xe0402a, 0xf2d23c, 0xe8e3d6][i], tu - 0.08 + i * 0.08, y + 0.14, 0.0, 0.016, 0.02, 0, 0, CYL8);
  // the coil-wrapped gizmo: a post with copper wound round it, a glowing tip
  const gu = 0.7;
  f.cyl(0x3a3d42, gu, y, -0.1, 0.09, 0.04).cyl(0x9aa3ab, gu, y + 0.04, -0.1, 0.035, 0.36);
  const helix = [];
  for (let i = 0; i <= 60; i++) helix.push([gu + Math.cos(i * 0.6) * 0.05, y + 0.08 + i * 0.0045, -0.1 + Math.sin(i * 0.6) * 0.05]);
  f.part(tube(helix, 0.008, 120), 0xc8743a, 0, 0, 0);
  f.glow(BALL, 0x8affe8, 2, gu, y + 0.42, -0.1, 0, 0.05);
  // a plumbus, pink, on a stand
  plumbus(f, 1.25, y, 0.0, 1);
  // the Meeseeks box: blue, a big button on top
  const mx = -297.5 - it.x;
  f.box(0x2f6fd0, mx, y, -0.05, 0.4, 0.26, 0.4).box(0x2459a8, mx, y + 0.26, -0.05, 0.42, 0.02, 0.42);
  f.cyl(0xe8eef8, mx, y + 0.28, -0.05, 0.11, 0.03).part(new THREE.SphereGeometry(0.1, 16, 8, 0, TAU, 0, Math.PI / 2), 0x9fd0ff, mx, y + 0.31, -0.05, 0, 1, 0.55, 1);
  // a vice on the end, a soldering iron, screws, papers, Rick's mug and flask
  f.box(0x3a5a8a, 3.55, y, 0.35, 0.22, 0.12, 0.16).box(0x3a5a8a, 3.55, y + 0.12, 0.35, 0.12, 0.1, 0.12).cyl(0x9aa3ab, 3.55, y + 0.17, 0.48, 0.012, 0.2, Math.PI / 2);
  f.cyl(0x2b2b30, 3.0, y, -0.25, 0.05, 0.04).cyl(0xd8452f, 3.0, y + 0.1, -0.22, 0.018, 0.16, 0.8, 0).cyl(0x9aa3ab, 3.0, y + 0.18, -0.12, 0.006, 0.1, 0.8, 0);
  f.decal('notes', 2.0, y + 0.004, 0.25, 0.28, 0.36, { rx: -Math.PI / 2, ry: 0.3 }).decal('notes', -0.2, y + 0.004, 0.3, 0.26, 0.32, { rx: -Math.PI / 2, ry: -0.2 });
  f.cyl(0xe8e3d6, 1.75, y, -0.25, 0.045, 0.1).cyl(0x9aa3ab, -1.6, y, 0.3, 0.035, 0.14).box(0x9aa3ab, -1.6, y + 0.14, 0.3, 0.02, 0.02, 0.02);
  const r = rng(31);
  for (let i = 0; i < 14; i++) f.box(0x9aa3ab, -3.8 + r() * 7.4, y, 0.2 + r() * 0.35, 0.012, 0.012, 0.035, r() * 3);
}

// tools on the pegboard: wrenches, hammers, screwdrivers, pliers, a saw, a
// level, reels of wire and coils
function pegTools(f, v) {
  for (let i = 0; i < 6; i++) {
    const u = -3.7 + i * 0.1;
    const len = 0.16 + i * 0.03;
    f.cbox(0xa3acb5, u, 1.95 - len / 2, v + 0.01, 0.022, len, 0.008);
    f.part(new THREE.TorusGeometry(0.02, 0.007, 6, 12), 0xa3acb5, u, 1.95, v + 0.01);
  }
  for (const [u, c] of [
    [-2.95, 0x6b4426],
    [-2.7, 0xc8302a],
  ]) {
    f.cbox(c, u, 1.78, v + 0.02, 0.03, 0.32, 0.03).cbox(0x3a3d42, u, 1.95, v + 0.03, 0.13, 0.045, 0.045);
  }
  for (let i = 0; i < 6; i++) {
    const u = -2.35 + i * 0.07;
    f.cyl([0xc8302a, 0xf2d23c, 0x2f6fb0, 0xc8302a, 0x3f8f3a, 0xf2d23c][i], u, 2.12, v + 0.03, 0.017, 0.1).cyl(0xa3acb5, u, 1.96, v + 0.03, 0.005, 0.16);
  }
  for (const s of [-1, 1]) f.cbox(0xc8302a, -1.75 + s * 0.02, 1.72, v + 0.02, 0.022, 0.18, 0.015, 0, 0, s * 0.12);
  f.cbox(0x3a3d42, -1.75, 1.84, v + 0.02, 0.04, 0.07, 0.02);
  // a saw, a level
  f.cbox(0xb9c0c7, -1.35, 1.45, v + 0.01, 0.42, 0.13, 0.006, 0, 0, 0.08).cbox(0x6b4426, -1.1, 1.45, v + 0.02, 0.1, 0.12, 0.03);
  f.cbox(0xf2c23c, -0.75, 1.32, v + 0.02, 0.62, 0.05, 0.03).glow(BOX, 0x9dff5a, 1.2, -0.75, 1.32, v + 0.036, 0, 0.05, 0.02, 0.004);
  // reels of wire: copper, red, green; coils and a coiled cable
  for (const [u, c] of [
    [-1.25, 0xc8743a],
    [-0.95, 0xc8302a],
    [-0.65, 0x3f8f3a],
  ]) {
    f.cyl(c, u, 1.72, v + 0.05, 0.075, 0.06, Math.PI / 2).cyl(0x3a3d42, u, 1.72, v + 0.05, 0.1, 0.012, Math.PI / 2, 0).cyl(0x3a3d42, u, 1.72, v + 0.085, 0.1, 0.012, Math.PI / 2, 0);
  }
  f.part(new THREE.TorusGeometry(0.11, 0.018, 8, 24), 0xc8743a, -0.28, 2.12, v + 0.03).part(new THREE.TorusGeometry(0.075, 0.014, 8, 20), 0xc8743a, -0.28, 2.12, v + 0.05);
  f.part(new THREE.TorusGeometry(0.13, 0.02, 8, 24), 0xd87a2a, 0.12, 1.6, v + 0.03).part(new THREE.TorusGeometry(0.11, 0.02, 8, 24), 0xd87a2a, 0.13, 1.58, v + 0.05);
  f.part(new THREE.TorusGeometry(0.09, 0.012, 6, 20), 0x2b2b30, -3.3, 1.52, v + 0.03).part(new THREE.TorusGeometry(0.07, 0.012, 6, 20), 0x2b2b30, -3.3, 1.5, v + 0.05);
  f.cbox(0xf2c23c, -2.0, 1.38, v + 0.04, 0.09, 0.09, 0.05);
}

// a plumbus: pink body, a knobbly top, a fleeb, a darker grip
function plumbus(f, u, y, v, k = 1) {
  f.cyl(0x8a5a34, u, y, v, 0.07 * k, 0.02);
  f.part(lathe([[0, 0], [0.05, 0.01], [0.07, 0.06], [0.06, 0.12], [0.035, 0.16], [0, 0.17]], 14), 0xf08fb4, u, y + 0.02, v, 0, k);
  f.ball(0xf6a8c8, u - 0.02 * k, y + 0.2 * k, v + 0.01, 0.045 * k);
  f.ball(0xd86a98, u + 0.05 * k, y + 0.12 * k, v + 0.03, 0.025 * k).ball(0xd86a98, u - 0.05 * k, y + 0.09 * k, v - 0.02, 0.02 * k);
  f.cyl(0xc75a8a, u + 0.07 * k, y + 0.07 * k, v, 0.018 * k, 0.12 * k, 0, Math.PI / 2);
}

// the L's other arm: a shallow counter round the north-east corner and down
// the east wall, as far as the door to the kitchen
function benchArm(R) {
  const f = R.frame(0, 0, 0);
  const runs = [
    [-295.95, -294, 94, 94.4],
    [-294.4, -294, 94.4, 96.3],
  ];
  for (const [x0, x1, z0, z1] of runs) {
    f.box(CAB, (x0 + x1) / 2, 0.08, (z0 + z1) / 2, x1 - x0, 0.86, z1 - z0).box(TOP, (x0 + x1) / 2, 0.94, (z0 + z1) / 2, x1 - x0 + 0.02, 0.06, z1 - z0 + 0.02);
  }
  for (let i = 0; i < 4; i++) f.box(0x433e38, -294.38, 0.14, 94.62 + i * 0.42, 0.02, 0.72, 0.38);
  // an old monitor on it, green text; a toolbox
  f.box(0xd8d4c8, -294.25, 1.0, 95.0, 0.36, 0.34, 0.38).glow(BOX, 0x9dff5a, 1.25, -294.43, 1.17, 95.0, 0, 0.004, 0.22, 0.28);
  f.box(0xc8302a, -294.2, 1.0, 95.9, 0.28, 0.16, 0.42).cbox(0x2b2b30, -294.2, 1.2, 95.9, 0.03, 0.03, 0.2);
  f.box(0x8d949a, -295.4, 1.0, 94.2, 0.3, 0.12, 0.2).box(0xc9a46a, -294.9, 1.0, 94.2, 0.3, 0.24, 0.24);
}

// the grey metal shelving, its boxes, jars and curios
function shelving(R, it, glass) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(GREY, s * (w / 2 - 0.03), 0, t * (d / 2 - 0.03), 0.04, h, 0.04);
  const levels = [0.1, 0.55, 1.0, 1.45, h - 0.03];
  for (const y of levels) f.box(0x9aa1a7, 0, y, 0, w, 0.03, d).box(0x7d848a, 0, y - 0.04, d / 2 - 0.02, w, 0.04, 0.02);
  const top = (i) => levels[i] + 0.03;
  // boxes
  f.box(0xc9a46a, -1.0, top(0), 0, 0.7, 0.4, 0.75).box(0xb8925a, -0.15, top(0), 0.05, 0.6, 0.36, 0.7).box(0xc9a46a, 0.85, top(0), 0, 0.8, 0.4, 0.78);
  f.decal('label', -0.15, top(0) + 0.2, 0.401, 0.3, 0.15);
  // "Time travel stuff"
  f.box(0xc9a46a, -0.8, top(1), 0, 0.82, 0.4, 0.8).decal('timetravel', -0.8, top(1) + 0.2, 0.401, 0.62, 0.3);
  f.box(0xb8925a, 0.3, top(1), 0.05, 0.6, 0.3, 0.7).box(0x8a6a4a, 1.05, top(1), 0, 0.5, 0.25, 0.6);
  // jars
  for (const [u, c, s] of [
    [-1.2, 0x6dff4a, 1],
    [-0.95, 0xff8a1e, 0.8],
    [-0.72, 0x9a5ab0, 1.1],
    [-0.5, 0xd8e8a0, 0.9],
  ]) {
    glass.add(CYL, glass.mat, f.mat(u, top(2) + 0.11 * s, 0.1, 0, 0.16, 0.22 * s, 0.16));
    f.cyl(c, u, top(2) + 0.005, 0.1, 0.07, 0.17 * s).cyl(0x9aa3ab, u, top(2) + 0.22 * s, 0.1, 0.082, 0.025);
  }
  // the spiky ball
  const su = 0.15;
  const sy = top(2) + 0.16;
  f.part(new THREE.IcosahedronGeometry(0.12, 0), 0x7a2a5a, su, sy, 0.1);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pts = ico.attributes.position;
  const seen = new Set();
  for (let i = 0; i < pts.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pts, i).normalize();
    const key = p.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p);
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    f.part(new THREE.ConeGeometry(0.03, 0.12, 6), 0xd8d0b0, su + p.x * 0.15, sy + p.y * 0.15, 0.1 + p.z * 0.15, e.y, 1, 1, 1, e.x, e.z);
  }
  // the green alien head: big black eyes, a little mouth
  const au = 0.8;
  const ay = top(2) + 0.17;
  f.ball(0x7ac74f, au, ay, 0.1, 0.15, 1.2).ball(0x6ab03f, au, ay - 0.14, 0.12, 0.08, 0.7);
  for (const s of [-1, 1]) f.part(BALL, 0x111111, au + s * 0.065, ay + 0.02, 0.22, s * 0.35, 0.09, 0.05, 0.04, 0, s * 0.5);
  f.box(0x2a4a1a, au, ay - 0.1, 0.235, 0.05, 0.01, 0.01);
  // the top shelf: an old gadget, a coil, a box
  f.box(0x6f7880, -0.9, top(3), 0, 0.5, 0.3, 0.5).glow(BOX, 0xff3a2a, 1.6, -0.75, top(3) + 0.22, 0.251, 0, 0.04, 0.04, 0.004).glow(BOX, 0x9dff5a, 1.6, -0.65, top(3) + 0.22, 0.251, 0, 0.04, 0.04, 0.004);
  f.part(new THREE.TorusGeometry(0.12, 0.03, 8, 20), 0xc8743a, 0.0, top(3) + 0.03, 0.05, 0, 1, 1, 1, Math.PI / 2);
  f.box(0xc9a46a, 0.85, top(3), 0, 0.7, 0.36, 0.7);
  f.box(0xb8925a, -0.5, top(4), 0, 0.8, 0.3, 0.7).box(0xc9a46a, 0.6, top(4), 0, 0.6, 0.25, 0.6);
}

// the orange floral lampshade on a wall arm, lit
function wallLamp(R, x, y, z, turn) {
  const f = R.frame(x, z, turn);
  f.cbox(0xb08a3a, 0, y, 0.02, 0.12, 0.18, 0.04).cyl(0xb08a3a, 0, y, 0.18, 0.012, 0.34, Math.PI / 2, 0).cyl(0xb08a3a, 0, y + 0.07, 0.35, 0.012, 0.14);
  const shade = lathe([[0.17, 0], [0.09, 0.22]], 20);
  f.decal('floral', 0, y - 0.04, 0.35, 1, 1, { geo: shade, bright: true });
  f.glow(BALL, 0xffc070, 2.0, 0, y + 0.02, 0.35, 0, 0.08);
  f.glow(new THREE.CircleGeometry(0.165, 20), 0xffb050, 1.6, 0, y - 0.035, 0.35, 0, 1, 1, 1, Math.PI / 2);
}

// the pinkish-tan machine on its stand: the plumbus factory, a fresh plumbus in its tray
function machine(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const tan = 0xd8a890;
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(0x6f7880, s * (w / 2 - 0.08), 0, t * (d / 2 - 0.06), 0.05, 0.7, 0.05);
  f.box(0x7d848a, 0, 0.2, 0, w - 0.1, 0.03, d - 0.06).box(0x7d848a, 0, 0.68, 0, w - 0.06, 0.04, d - 0.02);
  f.box(tan, -0.15, 0.72, -0.02, w - 0.5, 0.62, d - 0.08);
  f.part(new THREE.CylinderGeometry(0.21, 0.21, w - 0.5, 20, 1, false, 0, Math.PI), tan, -0.15, 1.34, -0.02, 0, 1, 1, 1, 0, Math.PI / 2);
  f.decal('gauges', -0.25, 1.15, d / 2 - 0.035, 0.84, 0.3);
  for (let i = 0; i < 5; i++) f.cyl(0x3a3d42, -0.6 + i * 0.18, 0.86, d / 2 - 0.04, 0.025, 0.03, Math.PI / 2);
  for (const [du, c] of [
    [0.3, 0xff3a2a],
    [0.42, 0x9dff5a],
    [0.54, 0xffc04a],
  ])
    f.glow(BALL, c, 1.8, -0.55 + du, 0.95, d / 2 - 0.035, 0, 0.04);
  // the hopper on top, the chute and its tray, the plumbus in it
  f.part(new THREE.CylinderGeometry(0.16, 0.06, 0.24, 14), 0xc99a82, -0.6, 1.68, -0.02);
  f.box(0xc99a82, w / 2 - 0.28, 0.82, 0, 0.36, 0.32, 0.3).box(0x9aa3ab, w / 2 - 0.2, 0.72, 0.05, 0.38, 0.04, 0.34);
  plumbus(f, w / 2 - 0.2, 0.76, 0.05, 0.85);
  f.cyl(0x6f7880, -0.15 + (w - 0.5) / 2 - 0.05, 1.3, -0.1, 0.03, 0.4);
}

// the Portal panic cabinet, its screen lit
function cabinet(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  const body = 0x1b1424;
  for (const s of [-1, 1]) {
    f.box(body, s * (w / 2 - 0.03), 0, 0, 0.06, h, d);
    f.decal('ppside', s * (w / 2 + 0.001), 1.0, 0, d - 0.06, 1.0, { ry: s * (Math.PI / 2) });
  }
  f.box(0x2a2236, 0, 0, -0.03, w - 0.1, 0.85, d - 0.08).box(0x2a2236, 0, 0.85, -0.12, w - 0.1, h - 0.85, d - 0.26);
  f.box(0x352c44, 0, 0.85, 0.08, w - 0.08, 0.06, 0.34, 0, -0.25);
  f.decal('ppscreen', 0, 1.3, 0.02, w - 0.3, 0.62, { bright: true, rx: -0.18 });
  f.decal('ppmarquee', 0, h - 0.13, d / 2 - 0.08, w - 0.12, 0.22, { bright: true });
  f.cyl(0x2b2b30, -0.3, 0.92, 0.14, 0.012, 0.12).ball(0xd0201c, -0.3, 1.06, 0.14, 0.035);
  for (let i = 0; i < 3; i++) f.cyl([0x97ce4c, 0x45c5e8, 0xf2d23c][i], 0.05 + i * 0.12, 0.9, 0.12 - i * 0.01, 0.028, 0.03, -0.25, 0);
  f.box(0x0f0b14, 0, 0.3, d / 2 - 0.035, 0.24, 0.12, 0.02).glow(BOX, 0xff8a1e, 1.4, 0, 0.36, d / 2 - 0.02, 0, 0.06, 0.03, 0.004);
}

// the cream washer and dryer, side by side, by the garage door
function laundry(R, it, glass) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const cream = 0xf0e8d0;
  const uw = w / 2 - 0.02;
  for (const s of [-1, 1]) {
    const u = (s * w) / 4;
    f.box(cream, u, 0.02, 0, uw, 0.88, d - 0.04).box(0xe2d9bf, u, 0.9, -d / 2 + 0.07, uw, 0.14, 0.1);
    f.part(new THREE.TorusGeometry(0.17, 0.035, 8, 24), 0xb9c0c7, u, 0.48, d / 2 - 0.01);
    f.cyl(0x3a3d42, u, 0.48, d / 2 - 0.03, 0.15, 0.02, Math.PI / 2);
    glass.add(CYL, glass.mat, f.mat(u, 0.48, d / 2 - 0.005, 0, 0.3, 0.02, 0.3, Math.PI / 2));
    for (let i = 0; i < 2; i++) f.cyl(0x9aa3ab, u - 0.15 + i * 0.1, 0.97, -d / 2 + 0.125, 0.025, 0.03, Math.PI / 2);
    f.glow(BOX, 0x9dff5a, 1.2, u + 0.15, 0.97, -d / 2 + 0.121, 0, 0.08, 0.03, 0.004);
  }
  f.box(0x3a6fb0, -w / 4, 0.9, 0.05, 0.42, 0.22, 0.32);
  f.box(0xe8f0f6, -w / 4, 1.05, 0.05, 0.36, 0.08, 0.26);
  f.cyl(0xf08a2a, w / 4 + 0.1, 0.9, 0.08, 0.06, 0.2).cyl(0xd8452f, w / 4 + 0.1, 1.1, 0.08, 0.025, 0.04);
}

// the red office chair, pushed in at the bench
function chair(R, x, z, turn) {
  const f = R.frame(x, z, turn);
  const red = 0xc8302a;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    f.cbox(0x2b2b30, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, 0.3, 0.035, 0.04, -a);
    f.ball(0x1a1a1e, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, 0.03, 1, BALL8);
  }
  f.cyl(0x9aa3ab, 0, 0.07, 0, 0.025, 0.36).cyl(0x2b2b30, 0, 0.3, 0, 0.04, 0.14);
  f.box(red, 0, 0.44, 0, 0.5, 0.09, 0.48).box(0x9a2420, 0, 0.44, 0, 0.46, 0.02, 0.44);
  f.box(0x2b2b30, 0, 0.47, 0.22, 0.06, 0.2, 0.04);
  f.box(red, 0, 0.62, 0.27, 0.46, 0.48, 0.08, 0, 0.12);
  for (const s of [-1, 1]) f.box(0x2b2b30, s * 0.25, 0.5, 0.0, 0.04, 0.18, 0.04).box(0x2b2b30, s * 0.25, 0.68, -0.02, 0.06, 0.03, 0.3);
}

// the garage door from inside: four panels, its rails and the opener
function garageDoor(f, u, v1, thick) {
  const w = 5.4;
  const h = 2.5;
  for (let i = 0; i < 4; i++) {
    const y = i * (h / 4);
    f.box(0xcdb58b, u, y + 0.01, v1 - thick / 2, w, h / 4 - 0.02, 0.05);
    for (const s of [-1, 1]) f.box(0xbfa67a, u + s * (w / 4), y + 0.08, v1 - thick / 2 + 0.03, w / 2 - 0.2, h / 4 - 0.16, 0.012);
  }
  f.box(0x9aa3ab, u, 0.12, v1 - thick / 2 + 0.05, 0.3, 0.04, 0.04);
  for (const s of [-1, 1]) f.box(0x7d848a, u + s * (w / 2 + 0.06), 0, v1 + 0.04, 0.06, h + 0.1, 0.08);
  f.glow(BOX, 0xfff4d8, 1.25, u, 0.015, v1 - thick / 2, 0, w - 0.04, 0.02, 0.04);
}

export async function buildGarage(kit) {
  const R = makeRoom(kit, 'garage');
  const m = kit.mats;
  const a = AREAS.garage;
  await needCast(kit, ['rick']);
  paintCells(R);
  const glass = { add: (geo, mat, matrix) => R.tiled.add(geo, mat, matrix), mat: m.glass };

  // concrete floor, plank walls, the beamed ceiling
  const concrete = tiledPaint(m, 'c137-lab-concrete', 256, 3.2, (g, w, h) => {
    speckle(g, w, h, { base: '#b5c0ad', specks: ['#a7b29f', '#c3ccbb', '#9da896', '#bcc6b3'], n: 4200, size: 2, seed: 17 });
    const r = rng(23);
    for (let i = 0; i < 4; i++) {
      const x = r() * w;
      const y = r() * h;
      const gr = g.createRadialGradient(x, y, 2, x, y, 30 + r() * 40);
      gr.addColorStop(0, 'rgba(70,80,60,0.18)');
      gr.addColorStop(1, 'rgba(70,80,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = 'rgba(80,90,75,0.5)';
    g.fillRect(0, h - 2, w, 2);
    g.fillRect(w - 2, 0, 2, h);
  });
  R.tiled.add(BOX, concrete, new THREE.Matrix4().compose(new THREE.Vector3((a.x0 + a.x1) / 2, -0.05, (a.z0 + a.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(a.x1 - a.x0 + 0.4, 0.1, a.z1 - a.z0 + 0.4)));
  const plank = tiledPaint(m, 'c137-lab-planks', 256, 2.2, planks('#5e3d26', 3));
  const ceiling = tiledPaint(m, 'c137-lab-ceiling', 256, 2.4, planks('#3e2a1c', 9, true));
  const wall = { mat: plank, skirt: 0x3a2618, h: H };
  const F = R.fixed;
  wallLine(R, F, [a.x0 - 0.2, a.z0], [a.x1 + 0.2, a.z0], { ...wall, into: [0, 1] });
  wallLine(R, F, [a.x0, a.z0 - 0.2], [a.x0, a.z1 + 0.2], { ...wall, into: [1, 0] });
  const kd = LINKS.find((l) => l.id === 'garage-kitchen');
  wallLine(R, F, [a.x1, a.z0 - 0.2], [a.x1, a.z1 + 0.2], { ...wall, into: [-1, 0] }, [{ c: kd.z, w: 0.92, y0: 0, y1: DOOR_H, draw: (f, u, wl) => door(f, u, { v1: wl.v1, thick: wl.thick, color: 0x8a5a34, trim: 0x4a2e1c }) }]);
  const exit = LINKS.find((l) => l.id === 'garage-exit');
  wallLine(R, F, [a.x0 - 0.2, a.z1], [a.x1 + 0.2, a.z1], { ...wall, into: [0, -1] }, [{ c: exit.x, w: 5.4, y0: 0, y1: 2.5, draw: (f, u, wl) => garageDoor(f, u, wl.v1, wl.thick) }]);
  const ceil = new THREE.Matrix4().compose(new THREE.Vector3((a.x0 + a.x1) / 2, H + 0.05, (a.z0 + a.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(a.x1 - a.x0 + 0.4, 0.1, a.z1 - a.z0 + 0.4));
  R.tiled.add(BOX, ceiling, ceil);
  const top = R.frame(0, 0, 0, { list: 'fixed' });
  for (let z = a.z0 + 1.2; z < a.z1; z += 2.1) top.box(0x2e1f14, (a.x0 + a.x1) / 2, H - 0.24, z, a.x1 - a.x0, 0.24, 0.16);
  // the long fluorescent light, on chains
  const lx = (a.x0 + a.x1) / 2 + 0.6;
  const lz = (a.z0 + a.z1) / 2 - 0.5;
  top.box(0xd8dcd6, lx, 2.5, lz, 0.32, 0.08, 3.6).box(0xc2c7c0, lx, 2.47, lz, 0.28, 0.03, 3.5);
  for (const s of [-1, 1]) top.cyl(0x6f7880, lx, 2.58, lz + s * 1.4, 0.008, H - 2.58);
  for (const s of [-1, 1]) top.glow(CYL, 0xf2fff2, 2.4, lx + s * 0.07, 2.45, lz, 0, 0.04, 3.4, 0.04, Math.PI / 2);
  // the garage door's opener and its rails
  top.box(0x7d848a, -300, H - 0.3, 103.2, 0.3, 0.14, 0.36).box(0x9aa3ab, -300, H - 0.22, 104.7, 0.05, 0.04, 2.6);
  for (const s of [-1, 1]) top.box(0x7d848a, -300 + s * 2.76, 2.55, 104.4, 0.06, 0.08, 3.2);

  // the bench, its arm round the corner, the chair, the clock and the calendar
  const it = (id) => FURNITURE.find((f) => f.id === id);
  bench(R, it('workbench'), glass);
  benchArm(R);
  chair(R, -300.45, 95.12, 0.25);
  const nw = R.fixed(-295.05, a.z0, 0);
  nw.decal('calendar', 0, 1.55, 0.012, 0.42, 0.6).box(0x9aa3ab, 0, 1.86, 0.01, 0.02, 0.02, 0.02);
  nw.cyl(0x2b2b30, 0, 2.36, 0.025, 0.2, 0.05, Math.PI / 2).decal('clock', 0, 2.36, 0.052, 0.36, 0.36);
  shelving(R, it('shelf-garage'), glass);
  wallLamp(R, a.x0, 2.25, 96.9, Math.PI / 2);
  machine(R, it('plumbus'));
  cabinet(R, it('portalpanic'));
  laundry(R, it('toolchest'), glass);
  // on the east wall past the portal: a shelf of paint cans, a coiled cable, the fuse box
  const ew = R.fixed(a.x1, 103.6, -Math.PI / 2);
  ew.box(0x5a3a20, 0, 1.45, 0.14, 1.3, 0.04, 0.28);
  for (let i = 0; i < 4; i++) ew.cyl([0xe8e3d6, 0x3a6fb0, 0xc8302a, 0xe8e3d6][i], -0.48 + i * 0.3, 1.49, 0.14, 0.09, 0.2);
  ew.part(new THREE.TorusGeometry(0.16, 0.025, 8, 24), 0xd87a2a, 0.9, 1.1, 0.05).part(new THREE.TorusGeometry(0.14, 0.025, 8, 24), 0xd87a2a, 0.92, 1.08, 0.08);
  ew.box(0x8d949a, -0.95, 1.4, 0.06, 0.4, 0.55, 0.12).box(0x7d848a, -0.95, 1.43, 0.125, 0.36, 0.49, 0.01);

  // the portal, swirling, on the east wall where Morty steps through
  const pl = LINKS.find((l) => l.id === 'garage-portal');
  const pm = R.own(kit.portal());
  const portal = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.0, 2.6)), pm);
  portal.position.set(a.x1 - 0.06, 1.42, pl.z);
  portal.rotation.y = -Math.PI / 2;
  portal.renderOrder = 2;
  R.add(portal, { ink: false });
  // its green light on the floor and the walls about it
  const spill = new THREE.Mesh(R.own(new THREE.PlaneGeometry(1, 1)), R.own(new THREE.MeshBasicMaterial({ map: R.own(glowSpot()), color: new THREE.Color(0x6dff4a).multiplyScalar(0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(a.x1 - 0.9, 0.012, pl.z);
  spill.scale.set(2.2, 3.4, 1);
  R.add(spill, { ink: false });
  R.tick((t) => {
    pm.uniforms.t.value = t;
    spill.material.opacity = 0.55 + Math.sin(t * 2.3) * 0.12;
  });

  // Rick at the bench
  const rick = PEOPLE.find((p) => p.id === 'rick');
  person(R, 'rick', { ...rick, h: 2.0, look: LOOKS.rick });

  return R.build({ light: { sun: [0xffe9c8, 0.42], hemi: [0xf3ecdc, 0x5e5a4a, 1.6], fog: null, background: 0x0e0b09 } });
}

// a soft round spot, for the portal's light
function glowSpot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
