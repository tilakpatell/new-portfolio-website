// Rick's garage lab's paint, for ./lab.js: the plank walls, and the
// pictures for its atlas (the pegboard, the corkboard of notes and red
// string, the clock, the mountain calendar, the "Time travel stuff" box, the
// floral lampshade, Portal panic's screen and marquee, the machine's gauges).

import * as THREE from 'three';
import { rng, speckle } from '../kit';
import { fitText, scribble, TAU } from './shell';

export const planks = (base, seed, across = false) => (g, w, h) => {
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
export const PINS = [
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

export function paintCells(R) {
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
