// The secret world's painted textures, drawn on canvases: the kolam on the
// gateway's courtyard, the island's inlaid floor, the exhibits' plaques, the
// laptop's blue screen, the speech bubble's word, the red sandalwood's bark
// and heartwood, and a soft glow for flames and sparks.

import * as THREE from 'three';

const GOLD = '#e8b44c';
const INK = '#120806';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

// a seeded random, so the textures come out the same every visit
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the courtyard: sandstone flags, worn, with a big white kolam in front of the
// gate (a grid of dots, loops drawn round them) and a ring of petals
export function courtyardTexture() {
  const N = 2048;
  const [c, g] = canvas(N);
  const r = rng(7);
  g.fillStyle = '#8a6a4c';
  g.fillRect(0, 0, N, N);
  const tile = N / 16;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const l = 38 + r() * 12;
      g.fillStyle = `hsl(${24 + r() * 10}, ${28 + r() * 10}%, ${l}%)`;
      g.fillRect(x * tile + 3, y * tile + 3, tile - 6, tile - 6);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '40,24,12' : '220,190,150'},${0.04 + r() * 0.06})`;
        g.beginPath();
        g.arc(x * tile + r() * tile, y * tile + r() * tile, 2 + r() * 10, 0, Math.PI * 2);
        g.fill();
      }
    }
  // the kolam, in the middle
  const cx = N / 2;
  const cy = N / 2;
  const step = 52;
  const n = 7;
  g.save();
  g.translate(cx, cy);
  g.rotate(Math.PI / 4);
  g.strokeStyle = 'rgba(250,246,236,0.95)';
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      if (Math.abs(i) + Math.abs(j) > n) continue;
      const x = i * step;
      const y = j * step;
      g.beginPath();
      g.arc(x, y, step * 0.5, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(250,246,236,0.95)';
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
    }
  g.restore();
  // petals round it: marigold and rose
  for (let ring = 0; ring < 2; ring++) {
    const rad = step * n * 1.08 + ring * 46;
    const count = 72 + ring * 16;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      g.fillStyle = ring === 0 ? (k % 2 ? '#ff9a1a' : '#ffc21a') : k % 3 ? '#d0213a' : '#ff6a1a';
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 16, 9, a, 0, Math.PI * 2);
      g.fill();
    }
  }
  return texture(c);
}

// the island's floor: black stone, polished, inlaid with gold rings and a
// kolam-like lattice, the kind of floor a villain's palace has
export function islandFloorTexture() {
  const N = 2048;
  const [c, g] = canvas(N);
  const r = rng(11);
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0, '#2a1410');
  grd.addColorStop(1, '#0d0605');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  for (let k = 0; k < 2600; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    const x = r() * N;
    const y = r() * N;
    g.moveTo(x, y);
    g.bezierCurveTo(x + (r() - 0.5) * 200, y + (r() - 0.5) * 200, x + (r() - 0.5) * 300, y + (r() - 0.5) * 300, x + (r() - 0.5) * 400, y + (r() - 0.5) * 400);
    g.stroke();
  }
  g.translate(N / 2, N / 2);
  g.strokeStyle = GOLD;
  for (const [rad, w] of [
    [1000, 14],
    [960, 4],
    [700, 8],
    [672, 3],
    [330, 8],
    [180, 4],
  ]) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.stroke();
  }
  // petals between the rings
  g.lineWidth = 4;
  for (let k = 0; k < 40; k++) {
    g.save();
    g.rotate((k / 40) * Math.PI * 2);
    g.beginPath();
    g.moveTo(0, 700);
    g.quadraticCurveTo(70, 830, 0, 960);
    g.quadraticCurveTo(-70, 830, 0, 700);
    g.stroke();
    g.restore();
  }
  for (let k = 0; k < 16; k++) {
    g.save();
    g.rotate((k / 16) * Math.PI * 2);
    g.beginPath();
    g.moveTo(0, 180);
    g.bezierCurveTo(120, 260, 120, 420, 0, 672);
    g.bezierCurveTo(-120, 420, -120, 260, 0, 180);
    g.stroke();
    g.restore();
  }
  return texture(c);
}

async function fonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([document.fonts.load('700 64px Cinzel'), document.fonts.load('600 32px Cinzel')]);
  } catch {
    /* the fallback serif will do */
  }
}

function fit(g, text, max, size, weight = 700, family = 'Cinzel, Georgia, serif') {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (g.measureText(text).width > max && s > 12);
}

// an exhibit's plaque: brass on black, the wing, the title, its number
export async function plaqueTexture({ wing, title, number }) {
  await fonts();
  const [c, g] = canvas(1024, 512);
  g.fillStyle = INK;
  g.fillRect(0, 0, 1024, 512);
  const grd = g.createLinearGradient(0, 0, 1024, 512);
  grd.addColorStop(0, '#f6d27a');
  grd.addColorStop(0.5, '#b8862e');
  grd.addColorStop(1, '#f2c562');
  g.strokeStyle = grd;
  g.lineWidth = 14;
  g.strokeRect(18, 18, 988, 476);
  g.lineWidth = 3;
  g.strokeRect(44, 44, 936, 424);
  g.fillStyle = grd;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(g, number.toUpperCase(), 820, 34, 600);
  g.fillText(number.toUpperCase(), 512, 112);
  fit(g, title, 860, 92);
  g.fillText(title, 512, 250);
  g.fillStyle = '#e9d9b8';
  fit(g, wing.toUpperCase(), 860, 36, 600);
  g.fillText(wing.toUpperCase(), 512, 380);
  return texture(c);
}

// the laptop's screen: the blue screen of death
export function bsodTexture() {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#0a5fd6';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#fff';
  g.font = '700 96px system-ui, sans-serif';
  g.fillText(':(', 36, 120);
  g.font = '500 22px system-ui, sans-serif';
  g.fillText('Your PC ran into a problem and', 36, 175);
  g.fillText('needs to restart. We’re just', 36, 205);
  g.fillText('collecting some error info.', 36, 235);
  g.font = '500 16px system-ui, sans-serif';
  g.fillText('0% complete', 36, 280);
  return texture(c);
}

// a word, big, for the speech bubble
export async function wordTexture(word, { bg = '#fff7e6', fg = '#b3122e' } = {}) {
  await fonts();
  const [c, g] = canvas(1024, 512);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 512);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(g, word, 900, 190);
  g.fillText(word, 512, 270);
  return texture(c);
}

// red sandalwood: grey-brown bark down the log, blood-red heartwood at the cut
export function barkTexture() {
  const [c, g] = canvas(256, 512);
  const r = rng(3);
  g.fillStyle = '#4a2a1c';
  g.fillRect(0, 0, 256, 512);
  for (let k = 0; k < 220; k++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '20,10,6' : '120,80,56'},${0.25 + r() * 0.4})`;
    g.lineWidth = 1 + r() * 4;
    const x = r() * 256;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (r() - 0.5) * 30, 170, x + (r() - 0.5) * 30, 340, x + (r() - 0.5) * 20, 512);
    g.stroke();
  }
  return texture(c, { repeat: null });
}

export function heartwoodTexture() {
  const [c, g] = canvas(256);
  const r = rng(5);
  g.fillStyle = '#3a1a10';
  g.fillRect(0, 0, 256, 256);
  for (let rad = 118; rad > 0; rad -= 3 + r() * 4) {
    g.fillStyle = `hsl(${2 + r() * 8}, ${70 + r() * 15}%, ${22 + (1 - rad / 118) * 16 + r() * 4}%)`;
    g.beginPath();
    g.arc(128 + (r() - 0.5) * 3, 128 + (r() - 0.5) * 3, rad, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

// a soft round glow, for flames, sparks and stars
export function glowTexture() {
  const [c, g] = canvas(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,240,200,0.8)');
  grd.addColorStop(0.6, 'rgba(255,160,60,0.18)');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return texture(c);
}

// a flame: a teardrop of light, white at the heart, saffron at the edge
export function flameTexture() {
  const [c, g] = canvas(64, 128);
  const grd = g.createRadialGradient(32, 92, 2, 32, 80, 52);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.35, 'rgba(255,200,80,0.95)');
  grd.addColorStop(0.7, 'rgba(255,110,20,0.5)');
  grd.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(52, 50, 62, 80, 56, 100);
  g.bezierCurveTo(48, 124, 16, 124, 8, 100);
  g.bezierCurveTo(2, 80, 12, 50, 32, 4);
  g.fill();
  return texture(c);
}
