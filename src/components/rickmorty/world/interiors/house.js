// The Smith house inside, for ../interiors.js: the ground floor (the kitchen
// with Beth at the stove, the living room with Jerry on the couch in front of
// the TV playing interdimensional cable, the dining room's yellow table with
// the butter robot on it, the entry with its red rug and the front door, the
// hall, the den, the back room and the stairs) and upstairs (Summer on her
// phone in her room, Morty's room, the hall, Beth and Jerry's room and the
// balcony), drawn from rules.js's PLAN, INNER_WALLS, FURNITURE, RUGS and
// PEOPLE: cream walls with white skirting, wood floors, every piece of
// furniture on its collider.

import * as THREE from 'three';
import { AREAS, FURNITURE, INNER_WALLS, PEOPLE, PLAN, RUGS } from '../rules';
import { mergeParts, rng, speckle } from '../kit';
import {
  BALL,
  BOX,
  CYL8,
  DOOR_H,
  PLANE,
  TAU,
  casing,
  ceilings,
  doorAt,
  doorway,
  fitText,
  floors,
  framed,
  lathe,
  makeRoom,
  needCast,
  person,
  scribble,
  sitting,
  tiledPaint,
  wallLine,
  wallRun,
  win,
  windowView,
} from './shell';

const CREAM = 0xf4e5c2;
const TRIM = 0xf7f3ea;
const BROWN = 0x7a4a2a;
const WOOD_FLOOR = 0xc4a77a;
const INNER = 0.24; // the walls between rooms (rules' half-thickness, twice)
const HEIGHTS = { rick: 2.0, jerry: 1.95, beth: 1.88, summer: 1.8 };
// the show's people in shapes, if their models don't load
export const LOOKS = {
  rick: { skin: 0xd9c7b0, shirt: 0x9fc6d6, coat: 0xf2f2ee, pants: 0x6b4a32, hair: 0xa9c6d6, style: 'spiky' },
  jerry: { skin: 0xf2c9a0, shirt: 0x7d8a3c, pants: 0x9cc0dc, hair: 0x6b4126, belt: 0x5a3a22, sleeves: 'short' },
  beth: { skin: 0xf2c9a0, shirt: 0xc8362e, pants: 0x3a3f5a, hair: 0xf0d27a, style: 'bob' },
  summer: { skin: 0xf2c9a0, shirt: 0xf0559a, pants: 0x4a5a9a, hair: 0xe8762e, style: 'pony', sleeves: 'short' },
};

// ── paint ──

const woodFloor = (base = '#c4a77a') => (g, w, h) => {
  const r = rng(11);
  const c = new THREE.Color(base);
  const rows = 8;
  const ph = h / rows;
  for (let y = 0; y < rows; y++) {
    let x = -r() * w * 0.5;
    while (x < w) {
      const len = w * (0.35 + r() * 0.4);
      const k = 0.88 + r() * 0.2;
      g.fillStyle = `#${c.clone().multiplyScalar(k).getHexString()}`;
      g.fillRect(x, y * ph, len, ph);
      g.fillStyle = 'rgba(80,50,25,0.12)';
      for (let i = 0; i < 3; i++) g.fillRect(x + 4, y * ph + ph * (0.25 + i * 0.25) + (r() - 0.5) * 3, len - 8, 1);
      g.fillStyle = 'rgba(60,35,15,0.6)';
      g.fillRect(x, y * ph, 2, ph);
      x += len;
    }
    g.fillStyle = 'rgba(60,35,15,0.55)';
    g.fillRect(0, y * ph, w, 2);
  }
};
const lino = (g, w, h) => {
  const n = 4;
  const s = w / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? '#f3efe2' : '#d9d6c4';
      g.fillRect(x * s, y * s, s, s);
    }
  g.strokeStyle = 'rgba(120,110,90,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s, h);
    g.moveTo(0, i * s);
    g.lineTo(w, i * s);
    g.stroke();
  }
};
const carpet = (g, w, h) => speckle(g, w, h, { base: '#e9e9e9', specks: ['#d6d6d6', '#f7f7f7', '#cfcfcf'], n: 1400, size: 1.5, seed: 21 });

// The TV: interdimensional cable, a channel and some static between
const CHANNELS = [
  { title: 'Real Fake Doors', bg: '#f3c844', ink: '#5a2a12', art: 'door' },
  { title: 'Ball Fondlers', bg: '#d8452f', ink: '#fff2c0', art: 'balls' },
  { title: 'Two Brothers', bg: '#2f6fb0', ink: '#fff', art: 'van' },
  { title: 'Baby Legs', bg: '#3b3b46', ink: '#f2e05a', art: 'legs' },
  { title: 'Gazorpazorpfield', bg: '#f08a2a', ink: '#3a1a0a', art: 'cat' },
  { title: 'How They Do It: Plumbus', bg: '#8fd0e8', ink: '#a8326a', art: 'plumbus' },
];
function drawChannel(g, w, h, ch, t) {
  g.fillStyle = ch.bg;
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.47;
  g.save();
  g.lineWidth = 3;
  g.strokeStyle = '#1a1210';
  const bob = Math.sin(t * 3) * 3;
  if (ch.art === 'door') {
    g.fillStyle = '#8a4a26';
    g.fillRect(cx - 22, cy - 38 + bob, 44, 70);
    g.strokeRect(cx - 22, cy - 38 + bob, 44, 70);
    g.fillStyle = '#e8c45a';
    g.beginPath();
    g.arc(cx + 12, cy + bob, 4, 0, TAU);
    g.fill();
  } else if (ch.art === 'balls') {
    for (let i = 0; i < 3; i++) {
      g.fillStyle = ['#f2d23c', '#3fa0d8', '#7ac74f'][i];
      g.beginPath();
      g.arc(cx - 40 + i * 40, cy + Math.sin(t * 4 + i) * 6, 15, 0, TAU);
      g.fill();
      g.stroke();
    }
  } else if (ch.art === 'van') {
    const x = ((t * 40) % (w + 120)) - 80;
    g.fillStyle = '#e9e3d0';
    g.fillRect(x, cy - 18, 78, 34);
    g.strokeRect(x, cy - 18, 78, 34);
    g.fillStyle = '#7fc3e8';
    g.fillRect(x + 56, cy - 12, 18, 12);
    g.fillStyle = '#222';
    for (const wx of [x + 16, x + 60]) {
      g.beginPath();
      g.arc(wx, cy + 18, 8, 0, TAU);
      g.fill();
    }
  } else if (ch.art === 'legs') {
    g.fillStyle = '#c99a6e';
    g.beginPath();
    g.arc(cx, cy - 22, 14, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#6b5a3a';
    g.fillRect(cx - 18, cy - 8, 36, 34);
    g.strokeRect(cx - 18, cy - 8, 36, 34);
    g.fillStyle = '#c99a6e';
    g.fillRect(cx - 9, cy + 26, 6, 8 + Math.abs(Math.sin(t * 8)) * 2);
    g.fillRect(cx + 3, cy + 26, 6, 8 + Math.abs(Math.cos(t * 8)) * 2);
  } else if (ch.art === 'cat') {
    g.fillStyle = '#f7a83a';
    g.beginPath();
    g.ellipse(cx, cy, 34, 26, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 12, cy - 6, 9, 0, TAU);
      g.fill();
      g.stroke();
    }
    g.fillStyle = '#111';
    for (const s of [-1, 1]) g.fillRect(cx + s * 12 - 2, cy - 6, 4, 4);
  } else if (ch.art === 'plumbus') {
    g.fillStyle = '#f08fb4';
    g.beginPath();
    g.ellipse(cx, cy + 6, 26, 18, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(cx - 6, cy - 18 + bob, 10, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#c75a8a';
    g.fillRect(cx + 18, cy - 4, 22, 9);
    g.strokeRect(cx + 18, cy - 4, 22, 9);
  }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, h - 34, w, 34);
  fitText(g, ch.title, cx, h - 17, w - 16, 20, { color: ch.ink === '#5a2a12' ? '#fff' : ch.ink });
  // the cable's bug, top right
  g.fillStyle = 'rgba(160,255,120,0.85)';
  g.font = '900 11px Arial, sans-serif';
  g.textAlign = 'right';
  g.fillText('IDC', w - 8, 16);
}

// a live canvas on the TV's screen: static, then a channel, round and round
function cableTV(R, f, u, y, v, w, h) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  const tex = R.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = R.own(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
  const screen = new THREE.Mesh(PLANE, mat);
  screen.matrixAutoUpdate = false;
  screen.matrix.copy(f.mat(u, y, v, 0, w, h, 1));
  R.add(screen, { ink: false });
  const noise = g.createImageData(128, 80);
  const small = document.createElement('canvas');
  small.width = 128;
  small.height = 80;
  const sg = small.getContext('2d');
  let ch = 0;
  let phase = 'static';
  let until = 0.6;
  let next = 0;
  let drawn = -1;
  R.tick((t) => {
    if (t > until) {
      if (phase === 'static') {
        phase = 'channel';
        until = t + 3.2;
        ch = (ch + 1) % CHANNELS.length;
      } else {
        phase = 'static';
        until = t + 0.55;
      }
    }
    if (t < next) return;
    next = t + 1 / 12;
    if (phase === 'static') {
      const d = noise.data;
      for (let i = 0; i < d.length; i += 4) {
        const k = Math.random() * 255;
        d[i] = d[i + 1] = d[i + 2] = k;
        d[i + 3] = 255;
      }
      sg.putImageData(noise, 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage(small, 0, 0, c.width, c.height);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(0, ((t * 300) % c.height) | 0, c.width, 6);
    } else {
      drawChannel(g, c.width, c.height, CHANNELS[ch], t);
      // scanlines
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let yy = 0; yy < c.height; yy += 3) g.fillRect(0, yy, c.width, 1);
    }
    drawn = t;
    tex.needsUpdate = true;
  });
  return { screen, drawn: () => drawn };
}

// ── furniture ──

const at = (it, R) => R.frame(it.x, it.z, it.turn);

function counter(R, it) {
  const f = at(it, R);
  const { w, d } = it;
  const cab = 0xc99a62;
  const door = 0xd6aa72;
  f.box(0x5a4030, 0, 0, -0.1, w, 0.1, d - 0.2);
  f.box(cab, 0, 0.1, -0.05, w, 0.8, d - 0.1);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w / n) * (i + 0.5);
    f.box(door, u, 0.16, d / 2 - 0.09, w / n - 0.05, 0.66, 0.02);
    f.box(0x8a8f96, u + (i % 2 ? -1 : 1) * (w / n / 2 - 0.12), 0.68, d / 2 - 0.07, 0.03, 0.14, 0.03);
  }
  f.box(0xe9e2cf, 0, 0.9, 0, w, 0.05, d);
  // the sink, the tap
  f.box(0x9aa3ab, 0.7, 0.9, 0.02, 0.8, 0.052, 0.55).box(0x6f7880, 0.7, 0.9, 0.02, 0.7, 0.054, 0.45);
  f.cyl(0xb9c0c7, 0.7, 0.95, -0.38, 0.025, 0.28).cbox(0xb9c0c7, 0.7, 1.22, -0.28, 0.04, 0.04, 0.22);
  // the backsplash and the cupboards over it
  f.decal('tiles', 0, 1.2, -d / 2 + 0.012, w, 0.5);
  f.box(cab, 0, 1.5, -d / 2 + 0.17, w, 0.68, 0.34);
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w / n) * (i + 0.5);
    f.box(door, u, 1.53, -d / 2 + 0.345, w / n - 0.05, 0.62, 0.02);
  }
  // on the counter: a toaster, a coffee maker, a fruit bowl, a knife block
  f.box(0xc8cdd2, -1.4, 0.95, -0.2, 0.28, 0.2, 0.18).box(0x2a2a2e, -1.4, 1.15, -0.2, 0.2, 0.01, 0.05);
  f.box(0x2b2b30, -0.6, 0.95, -0.35, 0.22, 0.34, 0.24).cyl(0x7a4a2a, -0.6, 0.97, -0.24, 0.07, 0.14);
  f.part(new THREE.SphereGeometry(0.16, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0xe9e2cf, 1.5, 1.1, 0.1);
  for (const [du, dv, c] of [
    [-0.05, 0, 0xe0402a],
    [0.06, 0.04, 0xf2c23c],
    [0.01, -0.07, 0x7ac74f],
  ])
    f.ball(c, 1.5 + du, 1.02, 0.1 + dv, 0.06);
  f.box(0x6b4426, 1.05, 0.95, -0.4, 0.14, 0.24, 0.12, 0, -0.2);
}

function stove(R, it) {
  const f = at(it, R);
  const { d } = it;
  const cab = 0xc99a62;
  // cupboards either side of the range
  for (const s of [-1, 1]) {
    f.box(cab, s * 0.49, 0.1, -0.05, 0.22, 0.8, d - 0.1).box(0x5a4030, s * 0.49, 0, -0.1, 0.22, 0.1, d - 0.2);
    f.box(0xe9e2cf, s * 0.49, 0.9, 0, 0.22, 0.05, d);
  }
  f.box(0xf2f0e8, 0, 0, -0.05, 0.76, 0.92, d - 0.1);
  f.box(0x1d1d22, 0, 0.92, -0.05, 0.76, 0.03, d - 0.1);
  for (const [bu, bv] of [
    [-0.2, 0.15],
    [0.2, 0.15],
    [-0.2, -0.2],
    [0.2, -0.2],
  ])
    f.part(new THREE.TorusGeometry(0.08, 0.012, 6, 16), 0x4a4a52, bu, 0.955, bv, 0, 1, 1, 1, Math.PI / 2);
  // the oven door, its window and handle, the knobs, the backguard
  f.box(0xe6e3da, 0, 0.12, d / 2 - 0.1, 0.7, 0.6, 0.03).box(0x2a2a30, 0, 0.3, d / 2 - 0.08, 0.46, 0.26, 0.012);
  f.cbox(0xb9c0c7, 0, 0.7, d / 2 - 0.05, 0.5, 0.025, 0.025);
  f.box(0xf2f0e8, 0, 0.95, -d / 2 + 0.17, 0.76, 0.16, 0.06);
  for (let i = 0; i < 4; i++) f.cyl(0x2a2a30, -0.27 + i * 0.18, 1.0, -d / 2 + 0.205, 0.022, 0.03, Math.PI / 2);
  // a pot on the front burner, and the hood over it all
  f.cyl(0x9aa3ab, 0.2, 0.96, 0.15, 0.12, 0.16).cyl(0x9aa3ab, 0.2, 1.12, 0.15, 0.125, 0.015).cbox(0x2a2a30, 0.38, 1.09, 0.15, 0.14, 0.02, 0.025);
  f.box(0xd8d4c8, 0, 1.72, -d / 2 + 0.25, 0.86, 0.22, 0.5).box(0xcac5b8, 0, 1.94, -d / 2 + 0.12, 0.3, 0.66, 0.24);
}

function fridge(R, it) {
  const f = at(it, R);
  const { d, h } = it;
  const W = 0.96;
  const c = 0xf1ecd9;
  f.box(c, 0, 0, -0.04, W, h - 0.02, d - 0.18);
  f.box(c, 0, 1.25, d / 2 - 0.13, W - 0.02, h - 1.28, 0.05).box(c, 0, 0.04, d / 2 - 0.13, W - 0.02, 1.18, 0.05);
  f.box(0x2b2b30, 0, 1.225, d / 2 - 0.13, W - 0.02, 0.02, 0.052);
  for (const [y0, hh] of [
    [1.32, 0.42],
    [0.55, 0.55],
  ])
    f.box(0xb9c0c7, -W / 2 + 0.08, y0, d / 2 - 0.06, 0.03, hh, 0.04);
  // drawings and magnets on the door
  f.decal('fridgeart', 0.08, 0.92, d / 2 - 0.1 + 0.003, 0.62, 0.5);
  // a cereal box on top
  f.box(0xe8a83a, 0.2, h - 0.02, -0.1, 0.24, 0.32, 0.08, 0.2);
}

function tvStand(R, it) {
  const f = at(it, R);
  const { w, d } = it;
  const wood = 0x6b4426;
  f.box(wood, 0, 0.05, -0.08, w, 0.5, d - 0.16);
  for (const s of [-1, 1]) f.cyl(0x3a2414, s * (w / 2 - 0.1), 0, -0.08 + (d / 2 - 0.15), 0.025, 0.05).cyl(0x3a2414, s * (w / 2 - 0.1), 0, -0.08 - (d / 2 - 0.15), 0.025, 0.05);
  for (let i = 0; i < 3; i++) {
    const u = -w / 2 + (w / 3) * (i + 0.5);
    f.box(0x7c5232, u, 0.1, d / 2 - 0.16 + 0.005, w / 3 - 0.06, 0.4, 0.02).ball(0xd8b25a, u, 0.38, d / 2 - 0.14, 0.02);
  }
  // the flat TV on its foot, the screen goes on its front
  f.box(0x1d1d22, 0, 0.55, -0.1, 0.36, 0.03, 0.22).box(0x1d1d22, 0, 0.58, -0.12, 0.08, 0.1, 0.05);
  f.box(0x1d1d22, 0, 0.66, -0.12, 1.6, 0.92, 0.07);
  // a console and a stack of discs, a plant at one end, a lamp at the other
  f.box(0x2b2b30, 0.62, 0.55, 0.08, 0.36, 0.07, 0.24).box(0x5ab0e8, 0.75, 0.6, 0.2, 0.06, 0.012, 0.012);
  for (let i = 0; i < 5; i++) f.box([0x2f6fb0, 0xd8452f, 0x2b2b30, 0xf3c844, 0x7ac74f][i], -0.6, 0.55 + i * 0.016, 0.1, 0.14, 0.015, 0.19, i * 0.1);
  f.part(lathe([[0, 0], [0.11, 0], [0.13, 0.2], [0.12, 0.22]], 12), 0xb8603a, -w / 2 + 0.22, 0.55, 0, 0);
  for (let i = 0; i < 6; i++) f.part(new THREE.ConeGeometry(0.05, 0.38, 5), 0x4f9c3c, -w / 2 + 0.22 + Math.cos(i) * 0.06, 0.92, Math.sin(i * 2.1) * 0.06, 0, 1, 1, 1, Math.cos(i * 1.7) * 0.4, Math.sin(i * 1.3) * 0.4);
  f.cyl(0xc9b48a, w / 2 - 0.22, 0.55, 0, 0.07, 0.04).cyl(0x9a8a6a, w / 2 - 0.22, 0.59, 0, 0.012, 0.32);
  f.part(lathe([[0.16, 0], [0.09, 0.2]], 14), 0xf3e2b0, w / 2 - 0.22, 0.85, 0, 0);
  return f;
}

function couch(R, it, { body = 0x9b6f95, cushion = 0xb48aae } = {}) {
  const f = at(it, R);
  const { w, d } = it;
  f.box(body, 0, 0.1, 0.02, w - 0.4, 0.3, d - 0.08);
  for (const s of [-1, 1]) f.box(body, s * (w / 2 - 0.16), 0.1, 0, 0.32, 0.5, d).box(cushion, s * (w / 2 - 0.16), 0.6, 0, 0.34, 0.06, d + 0.02);
  f.box(body, 0, 0.1, -d / 2 + 0.15, w - 0.04, 0.78, 0.3);
  for (let i = 0; i < 3; i++) {
    const u = -(w - 0.64) / 2 + ((w - 0.64) / 3) * (i + 0.5);
    f.box(cushion, u, 0.4, 0.08, (w - 0.64) / 3 - 0.03, 0.15, d - 0.36);
    f.box(cushion, u, 0.52, -d / 2 + 0.34, (w - 0.64) / 3 - 0.05, 0.42, 0.16, 0, -0.18);
  }
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.cyl(0x3a2414, s * (w / 2 - 0.1), 0, t * (d / 2 - 0.1), 0.03, 0.1, 0, 0, CYL8);
  // a cushion thrown in the corner
  f.box(0xe8c45a, w / 2 - 0.5, 0.55, -0.12, 0.36, 0.34, 0.12, 0.3, -0.25);
}

function table(R, it) {
  const f = at(it, R);
  const { w, d } = it;
  const yellow = 0xf1c63a;
  f.box(yellow, 0, 0.7, 0, w, 0.05, d).box(0xd9ab22, 0, 0.6, 0, w - 0.16, 0.1, d - 0.16);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(0xd9ab22, s * (w / 2 - 0.1), 0, t * (d / 2 - 0.1), 0.07, 0.6, 0.07);
  // chairs tucked in along each side
  for (const t of [-1, 1])
    for (const s of [-0.62, 0.62]) {
      const c = f.sub(s, t * 0.6, t > 0 ? 0 : Math.PI);
      c.box(0x8a5a34, 0, 0.44, 0, 0.44, 0.04, 0.42).box(0xe8c45a, 0, 0.48, 0.01, 0.4, 0.03, 0.38);
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.box(0x6b4426, a * 0.18, 0, b * 0.17, 0.035, 0.44, 0.035);
      for (const a of [-1, 1]) c.box(0x6b4426, a * 0.18, 0.44, 0.19, 0.035, 0.5, 0.035);
      c.box(0x8a5a34, 0, 0.78, 0.19, 0.4, 0.12, 0.03);
    }
  // place mats, the butter dish, salt and pepper, a bowl of fruit
  for (const s of [-0.62, 0.62]) for (const t of [-1, 1]) f.box(0xf4ecd8, s, 0.751, t * 0.42, 0.42, 0.004, 0.3);
  f.box(0xf4f0e6, 0.18, 0.751, 0.16, 0.2, 0.025, 0.12).box(0xf7e27a, 0.18, 0.776, 0.16, 0.12, 0.035, 0.06).box(0xf4f0e6, 0.18, 0.79, 0.16, 0.18, 0.05, 0.1);
  f.cyl(0xf4f0e6, -0.15, 0.75, -0.02, 0.022, 0.08).cyl(0x3a3a3e, -0.09, 0.75, -0.02, 0.022, 0.08);
  f.part(new THREE.SphereGeometry(0.15, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0x5ab0c8, -0.7, 0.9, 0);
  for (const [du, dv, c] of [
    [0, 0, 0xe0402a],
    [0.08, 0.03, 0xf2c23c],
    [-0.06, 0.05, 0xf08a2a],
    [0.02, -0.07, 0x7ac74f],
  ])
    f.ball(c, -0.7 + du, 0.81, dv, 0.055);
}

// The butter robot: a little silver-grey robot on two arms, a red light;
// it looks round now and then, its light blinking
function butterRobot(R, x, y, z, face) {
  const parts = [];
  const f = R.frame(0, 0, 0, { list: parts });
  const silver = 0xb9c0c7;
  const dark = 0x6f7880;
  f.part(lathe([[0, 0], [0.07, 0], [0.085, 0.03], [0.085, 0.1], [0.06, 0.15], [0, 0.16]], 16), silver, 0, 0.05, 0, 0);
  f.cyl(dark, 0, 0.1, 0, 0.088, 0.012);
  for (const s of [-1, 1]) {
    // each arm: shoulder, upper arm down to the table, a little claw
    f.ball(dark, s * 0.08, 0.13, 0, 0.022);
    f.cyl(silver, s * 0.11, 0.09, 0.0, 0.013, 0.09, 0, s * 0.5);
    f.cyl(silver, s * 0.135, 0.03, 0.02, 0.012, 0.07, 0.2, 0);
    f.box(dark, s * 0.135, 0, 0.035, 0.03, 0.012, 0.05);
  }
  f.cyl(dark, 0, 0.21, -0.02, 0.008, 0.07);
  const robot = new THREE.Group();
  const body = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  body.castShadow = true;
  robot.add(body);
  const eye = new THREE.Mesh(BALL, R.kit.mats.glow(0xff2a20, 2.6));
  eye.scale.setScalar(0.04);
  eye.position.set(0, 0.17, 0.065);
  robot.add(eye);
  R.noInk.push(eye);
  robot.position.set(x, y, z);
  robot.rotation.y = face + Math.PI / 2;
  R.group.add(robot);
  const turn0 = robot.rotation.y;
  R.tick((t) => {
    robot.rotation.y = turn0 + Math.sin(t * 0.6) * 0.5 + Math.sin(t * 1.7) * 0.08;
    eye.visible = Math.sin(t * 3) > -0.6;
    body.position.y = Math.abs(Math.sin(t * 1.2)) * 0.008;
  });
  return robot;
}

function desk(R, it, { top = 0x9a6a3e, legs = 0x6b4426, pedestal = true } = {}) {
  const f = at(it, R);
  const { w, d, h } = it;
  f.box(top, 0, h - 0.04, 0, w, 0.04, d);
  if (pedestal) {
    f.box(legs, w / 2 - 0.25, 0, 0, 0.46, h - 0.04, d - 0.06);
    for (let i = 0; i < 3; i++) f.box(top, w / 2 - 0.25, 0.06 + i * 0.22, d / 2 - 0.02, 0.4, 0.19, 0.02).box(0xd8b25a, w / 2 - 0.25, 0.14 + i * 0.22, d / 2 - 0.005, 0.08, 0.02, 0.02);
    f.box(legs, -w / 2 + 0.03, 0, 0, 0.05, h - 0.04, d - 0.06);
  } else for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(legs, s * (w / 2 - 0.05), 0, t * (d / 2 - 0.05), 0.05, h - 0.04, 0.05);
  f.box(legs, 0, h - 0.4, -d / 2 + 0.03, w - 0.1, 0.35, 0.02);
  return f;
}
// a desk lamp with its shade over a glowing bulb
function deskLamp(f, u, y, v, color = 0x3a6fb0) {
  f.cyl(color, u, y, v, 0.07, 0.025).cyl(0x9aa3ab, u, y + 0.02, v, 0.01, 0.28, -0.25, 0);
  f.part(lathe([[0.03, 0], [0.09, -0.1]], 12), color, u, y + 0.33, v + 0.06, 0, 1, 1, 1, 0.4);
  f.glow(BALL, 0xfff2c0, 1.8, u, y + 0.25, v + 0.09, 0, 0.05);
}
function computer(f, u, y, v) {
  f.box(0xe8e3d6, u, y, v - 0.08, 0.42, 0.33, 0.36).box(0xe8e3d6, u, y + 0.33, v - 0.08, 0.38, 0.04, 0.3);
  f.decal('monitor', u, y + 0.17, v + 0.102, 0.32, 0.24, { bright: true });
  f.box(0xe8e3d6, u, y, v + 0.2, 0.44, 0.02, 0.14);
}
function shelf(R, it, { wood = 0x7c5232, seed = 3 } = {}) {
  const f = at(it, R);
  const { w, d, h } = it;
  const r = rng(seed);
  f.box(wood, 0, 0, -d / 2 + 0.01, w, h, 0.02);
  for (const s of [-1, 1]) f.box(wood, s * (w / 2 - 0.02), 0, 0, 0.04, h, d);
  const levels = 5;
  for (let i = 0; i <= levels; i++) f.box(wood, 0, i === levels ? h - 0.03 : 0.05 + i * ((h - 0.1) / levels), 0, w - 0.06, 0.03, d - 0.02);
  const colours = [0xb8342a, 0x2f6fb0, 0x3f8f3a, 0xe8c45a, 0x6b3a7a, 0xe8e3d6, 0x2b2b30, 0xd87a2a];
  for (let i = 0; i < levels; i++) {
    const y0 = 0.08 + i * ((h - 0.1) / levels);
    let u = -w / 2 + 0.08;
    while (u < w / 2 - 0.12) {
      if (r() < 0.12) {
        // an ornament or a gap
        if (r() < 0.5) f.ball([0x5ab0c8, 0xd8b25a, 0xe08a9a][Math.floor(r() * 3)], u + 0.08, y0 + 0.07, 0, 0.07);
        u += 0.2;
        continue;
      }
      const bw = 0.03 + r() * 0.04;
      const bh = 0.2 + r() * 0.12;
      f.box(colours[Math.floor(r() * colours.length)], u + bw / 2, y0, 0.02, bw, bh, d - 0.12, 0, 0, r() < 0.08 ? 0.2 : 0);
      u += bw + 0.004;
    }
  }
}
function bed(R, it, { frame = 0x7c5232, sheet = 0xf4f0e6, blanket = 0x5a7ab0, pillow = 0xf7f4ec, board = null } = {}) {
  const f = at(it, R);
  const { w, d } = it;
  // the head is at the back (against the wall), the foot is its front
  f.box(frame, 0, 0.1, 0, w, 0.2, d);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(frame, s * (w / 2 - 0.05), 0, t * (d / 2 - 0.05), 0.08, 0.12, 0.08);
  f.box(sheet, 0, 0.3, 0, w - 0.06, 0.2, d - 0.06);
  f.box(blanket, 0, 0.32, 0.18, w, 0.21, d - 0.42).box(blanket, 0, 0.12, d / 2 - 0.02, w, 0.4, 0.04);
  for (const s of [-1, 1]) f.box(blanket, s * (w / 2 + 0.005), 0.18, 0.18, 0.02, 0.32, d - 0.42);
  const np = w > 1.4 ? 2 : 1;
  for (let i = 0; i < np; i++) f.box(pillow, np === 1 ? 0 : (i - 0.5) * (w / 2), 0.5, -d / 2 + 0.25, w / np - 0.12, 0.12, 0.34, 0, 0.12);
  f.box(board ?? frame, 0, 0.1, -d / 2 + 0.03, w + 0.04, 0.9, 0.06);
  return f;
}
function dresser(R, it, { wood = 0x9a6a3e } = {}) {
  const f = at(it, R);
  const { w, d, h } = it;
  f.box(wood, 0, 0.06, 0, w, h - 0.06, d - 0.04).box(0x5a3a22, 0, 0, 0, w - 0.06, 0.06, d - 0.1);
  f.box(new THREE.Color(wood).multiplyScalar(1.12), 0, h - 0.03, 0, w + 0.04, 0.03, d);
  for (let r = 0; r < 3; r++)
    for (const s of [-1, 1]) {
      const y = 0.1 + r * ((h - 0.16) / 3);
      f.box(new THREE.Color(wood).multiplyScalar(1.06), (s * w) / 4, y, d / 2 - 0.02, w / 2 - 0.05, (h - 0.16) / 3 - 0.04, 0.02).ball(0xd8b25a, (s * w) / 4, y + (h - 0.16) / 6, d / 2, 0.02);
    }
  return f;
}

// ── the stairs ──

// steps rising north from the foot of the stairs (by the 'stairs-up' link),
// with a banister up their open side
function stairs(R) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  const x0 = -295.7;
  const x1 = -294.62;
  const foot = 2.15;
  const top = 0.5;
  const n = 7;
  const run = (foot - top) / n;
  const rise = 0.25;
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < n; i++) {
    const z1 = foot - i * run;
    const y = (i + 1) * rise;
    f.box(0xefdfb9, cx, 0, z1 - run / 2 - 0.01, x1 - x0, y - 0.03, run);
    f.box(0xb08a5a, cx, y - 0.03, z1 - run / 2 - 0.02, x1 - x0, 0.035, run + 0.03);
    f.box(TRIM, cx, y - rise, z1 - 0.005, x1 - x0 - 0.02, rise - 0.03, 0.01);
  }
  // the banister: newel posts, a rail up the slope, balusters
  const rail = 0.95;
  const post = (z, y) => f.box(0x8a5a34, x0 + 0.05, 0, z, 0.09, y + rail + 0.08, 0.09).box(0x8a5a34, x0 + 0.05, y + rail + 0.08, z, 0.12, 0.06, 0.12);
  post(foot + 0.02, 0);
  post(top + 0.05, n * rise - rise);
  const len = Math.hypot(foot - top, (n - 1) * rise);
  const slope = Math.atan2((n - 1) * rise, foot - top);
  f.cbox(0x8a5a34, x0 + 0.05, rail + ((n - 1) * rise) / 2 + 0.12, (foot + top) / 2, 0.07, 0.06, len, 0, slope);
  for (let i = 0; i < n * 2; i++) {
    const z = foot - (i + 0.5) * (run / 2);
    const step = Math.floor(i / 2) + 1;
    const y = step * rise;
    const yr = rail + ((foot - z) / (foot - top)) * (n - 1) * rise + 0.1;
    f.box(TRIM, x0 + 0.05, y, z, 0.03, Math.max(0.1, yr - y), 0.03);
  }
}

// ── the ground floor ──

export async function buildHouse(kit) {
  const R = makeRoom(kit, 'house');
  const m = kit.mats;
  const [, clip] = await Promise.all([needCast(kit, ['beth', 'jerry']), sitting()]);

  // floors: wood, the kitchen's lino, the back room's carpet
  const wood = tiledPaint(m, 'c137-in-wood', 256, 2.6, woodFloor());
  const linoM = tiledPaint(m, 'c137-in-lino', 128, 1.2, lino);
  floors(R, 'house', (r) => (r.id === 'kitchen' ? linoM : r.floor === WOOD_FLOOR ? wood : tiledPaint(m, `c137-in-carpet-${r.floor}`, 128, 1.6, carpet, { color: r.floor })), { den: 0.001 });

  // pictures: window views, the rug, posters and frames
  for (let i = 1; i <= 4; i++) R.cell(`view${i}`, 128, 128, windowView(i));
  R.cell('tiles', 256, 32, (g, w, h) => {
    for (let x = 0; x < w; x += 16)
      for (let y = 0; y < h; y += 16) {
        g.fillStyle = (x / 16 + y / 16) % 5 === 0 ? '#8fc0d8' : '#f4f2ea';
        g.fillRect(x, y, 16, 16);
        g.strokeStyle = '#c9c4b4';
        g.strokeRect(x + 0.5, y + 0.5, 15, 15);
      }
  });
  R.cell('fridgeart', 96, 80, (g) => {
    g.clearRect(0, 0, 96, 80);
    g.fillStyle = '#f1ecd9';
    g.fillRect(0, 0, 96, 80);
    g.fillStyle = '#fff';
    g.fillRect(6, 6, 38, 30);
    g.strokeStyle = '#3a6fb0';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(25, 22, 8, 0, TAU);
    g.stroke();
    g.fillStyle = '#e0402a';
    g.fillRect(14, 30, 22, 3);
    g.fillStyle = '#f7e27a';
    g.fillRect(52, 10, 34, 26);
    scribble(g, 55, 16, 28, 3, { gap: 6 });
    g.fillStyle = '#8fd0e8';
    g.fillRect(20, 46, 44, 28);
    g.fillStyle = '#e8762e';
    g.beginPath();
    g.arc(34, 58, 6, 0, TAU);
    g.fill();
    for (const [x, y, c] of [
      [24, 6, '#e0402a'],
      [68, 10, '#3f8f3a'],
      [42, 46, '#3a6fb0'],
    ]) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, 3.5, 0, TAU);
      g.fill();
    }
  });
  const rug = RUGS.find((r) => r.id === 'entry');
  R.cell('rug', 128, 168, (g, w, h) => {
    g.fillStyle = '#a23a2e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8c88a';
    g.lineWidth = 4;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 2;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#7a2420';
    g.beginPath();
    g.moveTo(w / 2, 32);
    g.lineTo(w - 30, h / 2);
    g.lineTo(w / 2, h - 32);
    g.lineTo(30, h / 2);
    g.fill();
    g.strokeStyle = '#e8c88a';
    g.stroke();
    g.fillStyle = '#e8c88a';
    for (let x = 4; x < w; x += 6) {
      g.fillRect(x, 0, 2, 3);
      g.fillRect(x, h - 3, 2, 3);
    }
  });
  R.cell('livingrug', 160, 112, (g, w, h) => {
    g.fillStyle = '#d9c9a0';
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#8a6a4a';
    g.lineWidth = 3;
    for (const k of [0.82, 0.62]) {
      g.beginPath();
      g.ellipse(w / 2, h / 2, (w / 2) * k, (h / 2) * k, 0, 0, TAU);
      g.stroke();
    }
  });
  R.cell('landscape', 160, 112, framed((g, w, h) => {
    g.fillStyle = '#9edcf5';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a8fb0';
    g.beginPath();
    g.moveTo(0, h * 0.7);
    g.lineTo(w * 0.3, h * 0.3);
    g.lineTo(w * 0.55, h * 0.62);
    g.lineTo(w * 0.75, h * 0.38);
    g.lineTo(w, h * 0.7);
    g.fill();
    g.fillStyle = '#5aa84a';
    g.fillRect(0, h * 0.7, w, h * 0.3);
  }, { border: '#c9a24a' }));
  R.cell('family', 112, 88, framed((g, w, h) => {
    g.fillStyle = '#e8dcc0';
    g.fillRect(0, 0, w, h);
    const heads = [
      ['#e8762e', '#f0559a'],
      ['#f0d27a', '#c8362e'],
      ['#6b4126', '#7d8a3c'],
      ['#6b3a1e', '#f2d23c'],
    ];
    heads.forEach(([hair, shirt], i) => {
      const x = 16 + i * (w - 32) / 3;
      g.fillStyle = shirt;
      g.fillRect(x - 9, h * 0.55, 18, h * 0.45);
      g.fillStyle = '#f2c9a0';
      g.beginPath();
      g.arc(x, h * 0.42, 9, 0, TAU);
      g.fill();
      g.fillStyle = hair;
      g.fillRect(x - 9, h * 0.42 - 11, 18, 6);
    });
  }));
  R.cell('mirror', 64, 112, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#dff2f6');
    gr.addColorStop(1, '#a9c9d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(w * 0.2, 0, 6, h);
  }, { border: '#c9a24a' }));
  R.cell('monitor', 64, 48, (g, w, h) => {
    g.fillStyle = '#2f6fb0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e3d6';
    g.fillRect(4, 4, 26, 18);
    g.fillRect(34, 4, 26, 30);
    g.fillStyle = '#7ac74f';
    g.fillRect(0, h - 6, w, 6);
  });
  R.cell('photo', 72, 56, framed((g, w, h) => {
    g.fillStyle = '#8fd0e8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7e27a';
    g.beginPath();
    g.arc(w * 0.7, h * 0.3, 7, 0, TAU);
    g.fill();
    g.fillStyle = '#d8b48a';
    g.fillRect(0, h * 0.65, w, h * 0.35);
  }, { border: '#2b2b30', inner: 4 }));

  // ── walls and ceilings ──
  ceilings(R, roomsOf('house'));
  const F = R.fixed;
  const wall = { color: CREAM, skirt: TRIM };
  const view = (i) => `view${i}`;
  // the outer walls on the area's edges (never between the camera and Morty)
  wallLine(R, F, [-312.2, -8], [-287.8, -8], { ...wall, into: [0, 1] }, [win(-309.45, 1.2, 1.05, 0.95, view(1)), win(-301.8, 2.6, 0.85, 1.25, view(2), { bars: [3, 2] }), win(-292.5, 1.5, 1.05, 1.0, view(3), { bars: [2, 1] })]);
  wallLine(R, F, [-288, -8.2], [-288, 8.7], { ...wall, into: [-1, 0] }, [win(-7.2, 0.9, 1.0, 1.0, view(4)), win(-0.55, 0.8, 1.0, 1.0, view(1)), win(5.6, 1.4, 0.95, 1.05, view(2), { bars: [2, 2] })]);
  wallLine(R, F, [-294.7, 8.5], [-287.8, 8.5], { ...wall, into: [0, -1] }, [win(-291.2, 1.2, 1.25, 0.8, view(3))]);
  wallLine(R, F, [-312, -8.2], [-312, 3.6], { ...wall, into: [1, 0] }, [doorAt(1.1, { color: 0x8a5a34, trim: TRIM })]);
  // the outer walls with the yard outside them, south-west: they sink when
  // they come between the camera and Morty
  wallLine(R, R.cutaway(-312.2, 3.4, -306.7, 3.4), [-312.2, 3.4], [-306.7, 3.4], { ...wall, into: [0, -1] }, [win(-309.45, 1.2, 1.05, 0.95, view(4))]);
  wallLine(R, R.cutaway(-306.7, 3.4, -299.5, 3.4), [-306.7, 3.4], [-299.5, 3.4], { ...wall, into: [0, -1] }, [win(-303.1, 2.9, 0.8, 1.25, view(2), { frame: 0x6b4426, bars: [4, 1] })]);
  wallLine(R, R.cutaway(-299.5, 3.4, -294.5, 3.4), [-299.5, 3.4], [-294.5, 3.4], { ...wall, into: [0, -1] }, [doorAt(-297.6, { w: 1.0, color: BROWN, trim: TRIM, glass: null })]);
  wallLine(R, R.cutaway(-294.5, 3.4, -294.5, 8.7), [-294.5, 3.4], [-294.5, 8.7], { ...wall, into: [1, 0] }, [win(6.0, 1.2, 1.0, 1.0, view(1))]);
  // between the rooms, and the doorways in them
  for (const [x0, z0, x1, z1, th] of INNER_WALLS.house) {
    // (run on into the wall each meets, its end just inside it)
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ex = ((x1 - x0) / L) * (th - 0.006);
    const ez = ((z1 - z0) / L) * (th - 0.006);
    wallRun(R, F, [x0 - ex, z0 - ez], [x1 + ex, z1 + ez], { centred: true, thick: th * 2, ...wall });
  }
  for (const [a, b] of HOUSE_DOORWAYS) doorway(R, a, b, { thick: INNER, color: CREAM, trim: TRIM });

  // ── what's on the floor and the walls ──
  const fl = R.frame(0, 0, 0, { list: 'fixed' });
  fl.decal('rug', rug.x, 0.006, rug.z, rug.w, rug.d, { rx: -Math.PI / 2 });
  fl.decal('livingrug', -300.2, 0.006, -3.5, 2.6, 3.0, { rx: -Math.PI / 2, ry: Math.PI / 2 });
  // pictures: over the couch, in the hall, the dining room, the den; a mirror in the entry
  R.fixed(-306.58, -3.6, Math.PI / 2).decal('landscape', 0, 1.6, 0, 1.1, 0.78);
  R.fixed(-293.2, -1.46, 0).decal('family', 0, 1.6, 0, 0.6, 0.46).decal('photo', 1.2, 1.55, 0, 0.42, 0.32);
  R.fixed(-303.1, -1.76, 0).decal('landscape', 0, 1.6, 0, 0.9, 0.62);
  R.fixed(-299.36, -1.0, Math.PI / 2).decal('mirror', 0, 1.5, 0, 0.42, 0.75);
  R.fixed(-296.76, -4.1, Math.PI / 2).decal('photo', 0, 1.7, 0, 0.36, 0.28);
  R.fixed(-288.14, 1.6, -Math.PI / 2).decal('family', 0, 1.6, 0, 0.5, 0.4);
  stairs(R);

  // ── furniture ──
  for (const it of FURNITURE.filter((f) => f.area === 'house')) {
    if (it.kind === 'counter') counter(R, it);
    else if (it.kind === 'stove') stove(R, it);
    else if (it.kind === 'fridge') fridge(R, it);
    else if (it.kind === 'tv') cableTV(R, tvStand(R, it), 0, 1.12, -0.084 + 0.001, 1.5, 0.82);
    else if (it.kind === 'couch') couch(R, it);
    else if (it.kind === 'table') table(R, it);
    else if (it.kind === 'desk') {
      const f = desk(R, it);
      computer(f, -0.3, it.h, -0.05);
      deskLamp(f, 0.75, it.h, -0.25);
      f.box(0xf4f0e6, 0.25, it.h, 0.1, 0.3, 0.01, 0.22, 0.2).cyl(0xc8362e, 0.6, it.h, 0.15, 0.04, 0.1);
    } else if (it.kind === 'shelf') shelf(R, it);
    else if (it.kind === 'bed') bed(R, it, { blanket: 0x7a7f8f, frame: 0x5a4a3a });
    else if (it.kind === 'dresser') {
      const f = dresser(R, it, { wood: 0x6b5a48 });
      f.box(0x9aa3ab, 0.5, it.h, 0, 0.12, 0.2, 0.12).decal('photo', -0.3, it.h + 0.14, 0, 0.3, 0.24, { rx: -0.2 });
    }
  }

  // ── people ──
  const P = (id) => PEOPLE.find((p) => p.id === id);
  const beth = P('beth');
  person(R, 'beth', { ...beth, h: HEIGHTS.beth, look: LOOKS.beth });
  // Jerry on the couch, facing the TV: Rick's sat clip on his skeleton, or a
  // stand-in lowered on to the cushions
  const jerry = P('jerry');
  const j = person(R, 'jerry', { ...jerry, h: HEIGHTS.jerry, look: LOOKS.jerry });
  if (j.cast?.mixer && clip) {
    const c = j.cast;
    const sit = c.mixer.clipAction(clip);
    sit.play();
    for (const a of Object.values(c.act)) a.setEffectiveWeight(0);
    sit.setEffectiveWeight(1);
    j.group.position.x -= JERRY_SIT.back;
    j.group.position.y = JERRY_SIT.y;
    DEBUG.jerry = j;
    let last = null;
    R.tick((t) => {
      c.mixer.update(last == null ? 0 : Math.min(0.1, t - last));
      last = t;
    });
    // (the tick person() added plays the idle; its weights stay at nought)
    c.update = () => {};
  } else {
    j.group.position.y = 0.32;
    j.group.position.x -= 0.1;
  }

  // the butter robot on the table by its hotspot
  butterRobot(R, -302.6, 0.75, 0.8, -Math.PI / 2 + 0.3);

  return R.build({ light: HOUSE_LIGHT });
}

// the rooms of a floor as [x0, x1, z0, z1], but for some
const roomsOf = (area, but = []) => PLAN.filter((p) => p.area === area && !but.includes(p.id)).map((p) => [p.x0, p.x1, p.z0, p.z1]);
const HOUSE_LIGHT = { sun: [0xfff1dc, 0.6], hemi: [0xfff6ea, 0xa8957c, 2.2], fog: null, background: 0x1e1712 };
// how far Jerry sits back from where he stands, and how low (the sat clip turns his bones only)
export const JERRY_SIT = { back: 0.12, y: -0.45 };
// the open doorways between the rooms (each a little in from the walls' ends)
const HOUSE_DOORWAYS = [
  [
    [-306.7, -5.88],
    [-306.7, -4.32],
  ],
  [
    [-306.7, 0.12],
    [-306.7, 1.68],
  ],
  [
    [-305.08, -1.9],
    [-302.32, -1.9],
  ],
  [
    [-296.9, -7.9],
    [-296.9, -6.32],
  ],
  [
    [-299.5, 0.42],
    [-299.5, 1.98],
  ],
  [
    [-293.28, -1.6],
    [-291.72, -1.6],
  ],
  [
    [-291.78, 0.5],
    [-290.22, 0.5],
  ],
  [
    [-295.7, -1.18],
    [-295.7, 0.38],
  ],
];

// ── upstairs ──

export async function buildUpstairs(kit) {
  const R = makeRoom(kit, 'upstairs');
  const m = kit.mats;
  await needCast(kit, ['summer']);
  const a = AREAS.upstairs;

  const wood = tiledPaint(m, 'c137-in-wood', 256, 2.6, woodFloor());
  const deck = tiledPaint(m, 'c137-in-deck', 256, 2.4, woodFloor('#9a7650'));
  floors(R, 'upstairs', (r) => (r.id === 'balcony' ? deck : r.floor === WOOD_FLOOR ? wood : tiledPaint(m, `c137-in-carpet-${r.floor}`, 128, 1.6, carpet, { color: r.floor })));

  for (let i = 1; i <= 3; i++) R.cell(`view${i}`, 128, 128, windowView(i + 4));
  posters(R);

  ceilings(R, [...roomsOf('upstairs', ['balcony']), [-306, -303.6, 401.7, 404]]);
  const F = R.fixed;
  const cream = { color: CREAM, skirt: TRIM };
  const pink = { color: 0xf3c6d6, skirt: TRIM };
  const blue = { color: 0xc6d8e6, skirt: TRIM };
  // Summer's walls pink, Morty's blue, the rest cream: the walls are split where the rooms are
  wallLine(R, F, [-306.2, 394], [-299.8, 394], { ...pink, into: [0, 1] }, [win(-302, 1.2, 1.05, 0.95, 'view1')]);
  wallLine(R, F, [-299.8, 394], [-294.5, 394], { ...blue, into: [0, 1] }, [win(-297.6, 1.2, 1.05, 0.95, 'view2', { bars: [2, 2] })]);
  wallLine(R, F, [-306, 393.8], [-306, 399.9], { ...pink, into: [1, 0] });
  wallLine(R, F, [-306, 399.9], [-306, 401.7], { ...cream, into: [1, 0] });
  wallLine(R, F, [-294.7, 393.8], [-294.7, 399.9], { ...blue, into: [-1, 0] });
  wallLine(R, F, [-294.7, 399.9], [-294.7, 408.8], { ...cream, into: [-1, 0] }, [win(407.4, 0.9, 1.05, 0.95, 'view3')]);
  // inner walls: Summer's side pink, Morty's blue, the hall cream
  for (const [x0, z0, x1, z1, th] of INNER_WALLS.upstairs) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const ex = ((x1 - x0) / L) * (th - 0.006);
    const ez = ((z1 - z0) / L) * (th - 0.006);
    const colour = z0 === z1 && z0 < 400 ? (x1 <= -299.8 ? 0xf3c6d6 : x0 >= -299.8 ? 0xc6d8e6 : CREAM) : x0 === -299.8 ? 0xdcc6dc : CREAM;
    wallRun(R, F, [x0 - ex, z0 - ez], [x1 + ex, z1 + ez], { centred: true, thick: th * 2, color: colour, skirt: TRIM });
  }
  for (const [p, q] of UP_DOORWAYS) doorway(R, p, q, { thick: INNER, color: CREAM, trim: TRIM });
  // the balcony's wide glass door: its frame over the gap, a pane slid aside
  const gd = wallRun(R, F, [-300.12, 408.8], [-296.88, 408.8], { centred: true, thick: INNER, color: CREAM, skirt: null, holes: [{ at: 1.62, w: 3.24, y0: 0, y1: DOOR_H }] });
  casing(gd.f, 1.62, 3.24, DOOR_H, gd.v0, gd.v1, 0xe9e4d8);
  const glass = new THREE.Mesh(BOX, m.glass);
  glass.position.set(-300.9, DOOR_H / 2, 408.62);
  glass.scale.set(1.5, DOOR_H - 0.05, 0.03);
  R.add(glass);
  F(-300.9, 408.62, 0).box(0xe9e4d8, 0, 0, 0, 1.56, 0.05, 0.05).box(0xe9e4d8, 0, DOOR_H - 0.05, 0, 1.56, 0.05, 0.05).box(0xe9e4d8, -0.76, 0, 0, 0.05, DOOR_H, 0.05).box(0xe9e4d8, 0.76, 0, 0, 0.05, DOOR_H, 0.05);
  // the stairwell and the yard side: these sink when they're in the way
  wallLine(R, R.cutaway(-302.4, 404, -302.4, 408.8), [-302.4, 403.88], [-302.4, 408.8], { ...cream, into: [1, 0] }, [win(406.6, 1.2, 1.05, 0.95, 'view1')]);
  wallLine(R, R.cutaway(-303.6, 404, -302.4, 404), [-303.72, 404], [-302.28, 404], { ...cream, into: [0, -1] });
  stairwell(R);
  balcony(R, a);

  // furniture
  for (const it of FURNITURE.filter((f) => f.area === 'upstairs')) {
    if (it.id === 'bed-summer') {
      const f = bed(R, it, { frame: 0xf4f0e6, blanket: 0x3fb5b0, sheet: 0xf7d6e2, pillow: 0xf0559a, board: 0xf4f0e6 });
      f.ball(0xf0559a, 0.18, 0.6, 0.45, 0.13, 0.55).ball(0xf7d6e2, -0.15, 0.58, 0.62, 0.1, 0.5);
    } else if (it.id === 'desk-summer') {
      const f = desk(R, it, { top: 0xf4f0e6, legs: 0xe8e3d6 });
      // a mirror, make-up, a laptop
      f.decal('mirror', 0.2, it.h + 0.45, -it.d / 2 + 0.04, 0.42, 0.62);
      f.box(0x3fb5b0, -0.45, it.h, -0.05, 0.36, 0.02, 0.25).box(0x3fb5b0, -0.45, it.h + 0.02, -0.17, 0.36, 0.24, 0.015, 0, -0.25);
      for (let i = 0; i < 4; i++) f.cyl([0xf0559a, 0xe0402a, 0xf2d23c, 0x6b3a7a][i], 0.45 + i * 0.06, it.h, 0.1, 0.018, 0.08 + (i % 2) * 0.04);
    } else if (it.id === 'bed-morty') bed(R, it, { frame: 0x7c5232, blanket: 0x3a5a8a, sheet: 0xd6e2ea });
    else if (it.id === 'desk-morty') {
      const f = desk(R, it, { top: 0x9a6a3e, legs: 0x6b4426 });
      deskLamp(f, -0.5, it.h, -0.2, 0x3a6fb0);
      f.box(0x2b2b30, 0.1, it.h, -0.05, 0.4, 0.025, 0.28).box(0x2b2b30, 0.1, it.h + 0.02, -0.19, 0.4, 0.27, 0.015, 0, -0.2);
      f.decal('monitor', 0.1, it.h + 0.15, -0.178, 0.34, 0.22, { bright: true, rx: -0.2 });
      for (let i = 0; i < 3; i++) f.box([0xd8452f, 0x2f6fb0, 0xf3c844][i], 0.5, it.h + i * 0.04, 0.05, 0.25, 0.035, 0.18, i * 0.15);
    } else if (it.id === 'bed-master') bed(R, it, { frame: 0x6b4426, blanket: 0xc8b07a, sheet: 0xf4f0e6 });
    else if (it.id === 'dresser-master') {
      const f = dresser(R, it, { wood: 0x8a5a34 });
      f.decal('mirrorwide', 0, it.h + 0.6, -it.d / 2 + 0.03, 1.2, 0.8);
      f.cyl(0xd8b25a, -0.6, it.h, 0, 0.06, 0.04).part(lathe([[0.14, 0], [0.08, 0.18]], 12), 0xf0e2c0, -0.6, it.h + 0.3, 0, 0);
      f.cyl(0x9aa3ab, -0.6, it.h + 0.04, 0, 0.012, 0.18);
    }
  }
  // posters and pictures on the walls
  R.fixed(-306, 396.4, Math.PI / 2).decal('summerposter', 0, 1.65, 0.01, 0.6, 0.84);
  R.fixed(-299.92, 396.4, -Math.PI / 2).decal('summerposter2', 0, 1.6, 0, 0.55, 0.75);
  R.fixed(-299.68, 397.1, Math.PI / 2).decal('mortyposter', 0, 1.6, 0, 0.6, 0.85);
  R.fixed(-294.7, 395.3, -Math.PI / 2).decal('mortyposter2', 0, 1.65, 0.01, 0.5, 0.7);
  R.fixed(-294.7, 405.3, -Math.PI / 2).decal('landscape2', 0, 1.6, 0.01, 1.1, 0.72);
  R.fixed(-304, 401.58, Math.PI).decal('photo2', 0, 1.6, 0, 0.42, 0.32);

  // Summer on her phone: a purple phone in her right hand
  const s = PEOPLE.find((p) => p.id === 'summer');
  const sum = person(R, 'summer', { ...s, h: HEIGHTS.summer, look: LOOKS.summer });
  phoneIn(R, sum);
  DEBUG.summer = sum;

  return R.build({ light: { ...HOUSE_LIGHT, background: 0x1e1712 } });
}

const UP_DOORWAYS = [
  [
    [-304.48, 399.9],
    [-302.92, 399.9],
  ],
  [
    [-298.28, 399.9],
    [-296.72, 399.9],
  ],
  [
    [-298.88, 401.7],
    [-297.32, 401.7],
  ],
];

function posters(R) {
  R.cell('summerposter', 96, 136, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f0559a');
    gr.addColorStop(1, '#6b3a9a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3fb5b0';
    g.beginPath();
    g.arc(w / 2, h * 0.42, w * 0.3, 0, TAU);
    g.fill();
    fitText(g, 'SUMMER', w / 2, h * 0.84, w - 10, 20, { color: '#fff' });
  }, { border: '#f4f0e6', inner: 3 }));
  R.cell('summerposter2', 88, 120, framed((g, w, h) => {
    g.fillStyle = '#3fb5b0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7e27a';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(14 + i * 15, 20 + (i % 2) * 14, 6, 0, TAU);
      g.fill();
    }
    fitText(g, 'LIVE', w / 2, h * 0.62, w - 10, 26, { color: '#f0559a' });
    fitText(g, 'TOUR', w / 2, h * 0.82, w - 10, 20, { color: '#fff' });
  }, { border: '#f4f0e6', inner: 3 }));
  R.cell('mortyposter', 96, 136, framed((g, w, h) => {
    g.fillStyle = '#1a2240';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = '#fff';
      g.fillRect((i * 37) % w, (i * 53) % h, 1.5, 1.5);
    }
    g.fillStyle = '#9dff5a';
    g.beginPath();
    g.ellipse(w / 2, h * 0.45, w * 0.32, h * 0.22, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#1a2240';
    g.beginPath();
    g.ellipse(w / 2, h * 0.45, w * 0.2, h * 0.13, 0, 0, TAU);
    g.fill();
    fitText(g, 'SPACE', w / 2, h * 0.85, w - 10, 22, { color: '#f2d23c' });
  }, { border: '#2b2b30', inner: 3 }));
  R.cell('mortyposter2', 80, 112, framed((g, w, h) => {
    g.fillStyle = '#d8452f';
    g.fillRect(0, 0, w, h);
    fitText(g, 'BALL', w / 2, h * 0.3, w - 10, 20, { color: '#fff2c0' });
    fitText(g, 'FONDLERS', w / 2, h * 0.48, w - 10, 16, { color: '#fff2c0' });
    for (let i = 0; i < 3; i++) {
      g.fillStyle = ['#f2d23c', '#3fa0d8', '#7ac74f'][i];
      g.beginPath();
      g.arc(18 + i * 22, h * 0.75, 9, 0, TAU);
      g.fill();
    }
  }, { border: '#2b2b30', inner: 3 }));
  R.cell('mirror', 64, 96, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#f2e6f0');
    gr.addColorStop(1, '#c9b2c9');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(w * 0.25, 0, 5, h);
  }, { border: '#f0559a', inner: 4 }));
  R.cell('mirrorwide', 120, 80, framed((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#dff2f6');
    gr.addColorStop(1, '#a9c9d2');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(w * 0.2, 0, 7, h);
  }, { border: '#8a5a34', inner: 5 }));
  R.cell('landscape2', 160, 104, framed((g, w, h) => {
    g.fillStyle = '#f2c48a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8762e';
    g.beginPath();
    g.arc(w * 0.5, h * 0.62, h * 0.24, 0, TAU);
    g.fill();
    g.fillStyle = '#3a5a8a';
    g.fillRect(0, h * 0.62, w, h * 0.38);
  }, { border: '#c9a24a' }));
  R.cell('photo2', 72, 56, framed((g, w, h) => {
    g.fillStyle = '#c9dbe6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c9a0';
    g.beginPath();
    g.arc(w * 0.35, h * 0.5, 9, 0, TAU);
    g.arc(w * 0.65, h * 0.5, 9, 0, TAU);
    g.fill();
  }, { border: '#2b2b30', inner: 4 }));
  R.cell('monitor', 64, 48, (g, w, h) => {
    g.fillStyle = '#1a2240';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#9dff5a';
    g.fillRect(6, 8, 30, 4);
    g.fillRect(6, 16, 44, 4);
    g.fillRect(6, 24, 22, 4);
  });
}

// the stairwell beside the hall: steps going down into it, a banister round it
function stairwell(R) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  const x0 = -306;
  const x1 = -303.6;
  const z0 = 401.7;
  const z1 = 404;
  // the pit's walls going down, and the flight
  f.box(CREAM, (x0 + x1) / 2, -2.6, z0 + 0.06, x1 - x0, 2.6, 0.12).box(CREAM, (x0 + x1) / 2, -2.6, z1 - 0.06, x1 - x0, 2.6, 0.12).box(CREAM, x0 + 0.06, -2.6, (z0 + z1) / 2, 0.12, 2.6, z1 - z0);
  const n = 9;
  const run = (x1 - x0 - 0.1) / n;
  for (let i = 0; i < n; i++) {
    const y = -(i + 1) * 0.24;
    f.box(0xb08a5a, x1 - (i + 0.5) * run, y - 0.6, (z0 + z1) / 2, run + 0.02, 0.6, z1 - z0 - 0.24);
  }
  // the banister: along the hall and the top of the stairs
  const rail = (a, b) => {
    const [ax, az] = a;
    const [bx, bz] = b;
    const len = Math.hypot(bx - ax, bz - az);
    const turn = Math.atan2(-(bz - az), bx - ax);
    const s = R.frame(ax, az, turn, { list: 'fixed' });
    s.box(0x8a5a34, len / 2, 0.92, 0, len + 0.06, 0.07, 0.08);
    for (let u = 0.06; u < len; u += 0.14) s.box(TRIM, u, 0, 0, 0.03, 0.92, 0.03);
    s.box(0x8a5a34, 0, 0, 0, 0.1, 1.05, 0.1).box(0x8a5a34, len, 0, 0, 0.1, 1.05, 0.1);
  };
  rail([x0, z0 + 0.06], [x1, z0 + 0.06]);
  rail([x1 + 0.04, z0 + 0.06], [x1 + 0.04, z1 - 0.1]);
  // the roof of the single-storey middle outside, south of the stairwell
  const roof = R.kit.mats.painted('c137-in-shingle', 128, 128, (g, w, h) => {
    const r = rng(4);
    g.fillStyle = '#6f452b';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++)
      for (let x = -1; x < 6; x++) {
        g.fillStyle = r() < 0.2 ? '#5a3721' : r() < 0.35 ? '#7b4f33' : '#6f452b';
        g.fillRect(x * 24 + (y % 2) * 12 + 1, y * 16 + 1, 22, 14);
        g.fillStyle = '#4b2d1a';
        g.fillRect(x * 24 + (y % 2) * 12, y * 16 + 13, 24, 3);
      }
  });
  roof.userData.tile = 1.8;
  R.tiled.add(BOX, roof, new THREE.Matrix4().compose(new THREE.Vector3(-304.5, -0.75, 407.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0, 0)), new THREE.Vector3(4.2, 0.08, 7.2)));
}

// The balcony: a wooden railing round it, and the street beyond, painted
function balcony(R, a) {
  const f = R.frame(0, 0, 0, { list: 'solid' });
  const wood = 0x8a5a34;
  const z = a.z1;
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const turn = Math.atan2(-(bz - az), bx - ax);
    const s = R.frame(ax, az, turn);
    s.box(wood, len / 2, 0.96, 0, len + 0.1, 0.07, 0.12).box(wood, len / 2, 0.08, 0, len, 0.05, 0.06);
    for (let u = 0.1; u < len; u += 0.16) s.box(0x9a6a3e, u, 0.1, 0, 0.04, 0.86, 0.04);
    s.box(wood, 0, 0, 0, 0.1, 1.05, 0.1).box(wood, len, 0, 0, 0.1, 1.05, 0.1);
  };
  rail(-302.4, z + 0.04, -294.7, z + 0.04);
  rail(-294.66, 408.8, -294.66, z + 0.04);
  rail(-302.44, 408.8, -302.44, z + 0.04);
  f.box(0x6b4426, (-302.4 - 294.7) / 2, -0.2, z - 0.7, 7.8, 0.2, 1.62);
  // the view: the front lawn, the street and the houses across it
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 200);
  gr.addColorStop(0, '#79c6ef');
  gr.addColorStop(1, '#d6f1fb');
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 320);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [x, y, r] of [
    [160, 60, 26],
    [190, 50, 34],
    [225, 62, 24],
    [700, 80, 22],
    [728, 70, 30],
    [760, 82, 20],
  ]) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  // houses across the street
  const r = rng(7);
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 170 + r() * 30;
    g.fillStyle = ['#f0c9a8', '#c9dbe6', '#e9c9a1', '#f0dd9a', '#d9bfd8', '#b7d3c6'][i];
    g.fillRect(x, 160, 130, 60);
    g.fillStyle = ['#7a4038', '#56606e', '#6e4a36'][i % 3];
    g.beginPath();
    g.moveTo(x - 10, 162);
    g.lineTo(x + 65, 118);
    g.lineTo(x + 140, 162);
    g.fill();
    g.fillStyle = '#8fc4dc';
    g.fillRect(x + 16, 178, 26, 20);
    g.fillRect(x + 88, 178, 26, 20);
    g.fillStyle = '#7a4a2a';
    g.fillRect(x + 56, 186, 18, 34);
    g.fillStyle = '#3f8f3a';
    g.beginPath();
    g.arc(x + 150, 175, 22, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#7cc35a';
  g.fillRect(0, 220, 1024, 16);
  g.fillStyle = '#d8d4cb';
  g.fillRect(0, 236, 1024, 8);
  g.fillStyle = '#5a5d63';
  g.fillRect(0, 244, 1024, 34);
  g.fillStyle = '#f2d23c';
  for (let x = 0; x < 1024; x += 60) g.fillRect(x, 260, 30, 3);
  g.fillStyle = '#d8d4cb';
  g.fillRect(0, 278, 1024, 8);
  g.fillStyle = '#7cc35a';
  g.fillRect(0, 286, 1024, 34);
  const tex = R.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = R.own(new THREE.CylinderGeometry(26, 26, 22, 32, 1, true, Math.PI * 0.5, Math.PI));
  const back = new THREE.Mesh(geo, R.own(new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  back.position.set(-299, 3, 404);
  R.add(back, { ink: false });
  // the lawn below, out to the painting
  const lawn = new THREE.Mesh(R.own(new THREE.CircleGeometry(26, 32, Math.PI, Math.PI)), R.kit.mats.toon(0x7cc35a));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(-299, -3.2, 404);
  R.add(lawn);
}

// A purple phone in Summer's right hand, the arm bent to hold it up where
// she can see it (or in front of her, if she's in shapes)
function phoneIn(R, fig) {
  const phone = new THREE.Group();
  const body = new THREE.Mesh(BOX, R.kit.mats.toon(0x7a3fc0));
  body.scale.set(0.075, 0.15, 0.012);
  phone.add(body);
  const glow = new THREE.Mesh(PLANE, R.kit.mats.glow(0xbfe8ff, 1.3));
  glow.scale.set(0.064, 0.13, 1);
  glow.position.z = 0.0065;
  phone.add(glow);
  R.noInk.push(glow);
  const c = fig.cast;
  const bones = c ? Object.fromEntries(['RightArm', 'RightForeArm', 'RightHand', 'Head', 'neck'].map((n) => [n, c.group.getObjectByName(n)])) : {};
  if (c && bones.RightHand && bones.RightForeArm && bones.RightArm) {
    bones.RightHand.add(phone);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    R.tick(() => {
      // after the idle has set the bones: the arm in, the elbow bent up
      bones.RightArm.quaternion.multiply(q.setFromEuler(e.set(...PHONE_POSE.arm)));
      bones.RightForeArm.quaternion.multiply(q.setFromEuler(e.set(...PHONE_POSE.fore)));
      bones.RightHand.quaternion.multiply(q.setFromEuler(e.set(...PHONE_POSE.hand)));
      if (bones.Head) bones.Head.quaternion.multiply(q.setFromEuler(e.set(...PHONE_POSE.head)));
    });
    // the hand's own scale is the model's: undo it, so the phone is its size in metres
    fig.group.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    bones.RightHand.getWorldScale(s);
    phone.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    phone.position.set(...PHONE_POSE.at).divide(s);
    phone.rotation.set(...PHONE_POSE.turn);
  } else {
    phone.position.set(0.12, 1.15, 0.28);
    phone.rotation.x = -0.5;
    fig.group.add(phone);
  }
}
export const DEBUG = {};
if (import.meta.env.DEV) window.__C137_ROOMS__ = DEBUG;
DEBUG.pose = null;
export const PHONE_POSE = (DEBUG.pose = { arm: [0.3, 0.9, 0], fore: [0, 0, -1.9], hand: [0, 0, 0], head: [0, 0, 0], at: [0, 0.07, 0], turn: [1.5, 0.75, 0] });
