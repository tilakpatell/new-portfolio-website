// The Smiths' TV, for ./house.js: interdimensional cable on a live canvas,
// a channel's card (the shows the page's Cable has) between bursts of static.

import * as THREE from 'three';
import { fitText, PLANE, TAU } from './shell';

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
export function cableTV(R, f, u, y, v, w, h) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  const tex = R.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  // (redrawn a dozen times a second: no mipmaps to rebuild each time)
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
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
