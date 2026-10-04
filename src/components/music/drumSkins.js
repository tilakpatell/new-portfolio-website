// The tabla's surfaces, painted once on canvases (nothing to download): the
// goatskin heads, the black syahi with its sheen and the bayan's hammered
// copper. The dayan's shell is photographed rosewood (Poly Haven). Used as
// images inside the drum's SVG, so strokes and ripples animate over them
// without repainting the grain.

import { rng } from '../../lib/texture';

const cache = new Map();

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Goatskin: warm parchment with fine fibres and a darker, worn ring where the
// fingers land.
function skin(size, seed, tone) {
  const c = canvas(size);
  const x = c.getContext('2d');
  const r = rng(seed);
  const m = size / 2;
  const base = x.createRadialGradient(m * 0.85, m * 0.8, m * 0.1, m, m, m);
  base.addColorStop(0, tone[0]);
  base.addColorStop(0.7, tone[1]);
  base.addColorStop(1, tone[2]);
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  // fibres: short strokes at every angle, light and dark
  for (let i = 0; i < size * 9; i++) {
    const px = r() * size;
    const py = r() * size;
    const a = r() * Math.PI;
    const l = 2 + r() * 7;
    x.strokeStyle = r() < 0.5 ? `rgba(90,60,30,${0.03 + r() * 0.05})` : `rgba(255,248,230,${0.03 + r() * 0.06})`;
    x.lineWidth = 0.6 + r() * 0.8;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    x.stroke();
  }
  // mottling
  for (let i = 0; i < 60; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    const px = r() * size;
    const py = r() * size;
    const rad = size * (0.04 + r() * 0.1);
    g.addColorStop(0, `rgba(120,80,40,${0.04 + r() * 0.05})`);
    g.addColorStop(1, 'rgba(120,80,40,0)');
    x.save();
    x.translate(px, py);
    x.scale(rad, rad);
    x.fillStyle = g;
    x.fillRect(-1, -1, 2, 2);
    x.restore();
  }
  // where the hand plays: a soft darker band
  const worn = x.createRadialGradient(m, m, m * 0.55, m, m, m * 0.95);
  worn.addColorStop(0, 'rgba(80,50,25,0)');
  worn.addColorStop(0.6, 'rgba(80,50,25,0.12)');
  worn.addColorStop(1, 'rgba(80,50,25,0.02)');
  x.fillStyle = worn;
  x.fillRect(0, 0, size, size);
  return c;
}

// Syahi: layered black paste, matte with a soft sheen and faint rings from
// the layers it is built up in.
function syahi(size, seed) {
  const c = canvas(size);
  const x = c.getContext('2d');
  const r = rng(seed);
  const m = size / 2;
  const g = x.createRadialGradient(m * 0.78, m * 0.72, 0, m, m, m);
  g.addColorStop(0, '#3b3836');
  g.addColorStop(0.35, '#1f1d1c');
  g.addColorStop(1, '#0e0d0d');
  x.fillStyle = g;
  x.beginPath();
  x.arc(m, m, m, 0, Math.PI * 2);
  x.fill();
  for (let k = 1; k < 7; k++) {
    x.strokeStyle = `rgba(255,255,255,${0.025 + r() * 0.02})`;
    x.lineWidth = 1;
    x.beginPath();
    x.arc(m, m, (m * k) / 7, 0, Math.PI * 2);
    x.stroke();
  }
  for (let i = 0; i < size * 4; i++) {
    x.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * m;
    x.fillRect(m + Math.cos(a) * d, m + Math.sin(a) * d, 1, 1);
  }
  return c;
}

// Hammered copper: warm metal with dimples catching the light.
function copper(size, seed) {
  const c = canvas(size);
  const x = c.getContext('2d');
  const r = rng(seed);
  const m = size / 2;
  const g = x.createRadialGradient(m * 0.62, m * 0.55, m * 0.1, m, m, m);
  g.addColorStop(0, '#e2a372');
  g.addColorStop(0.45, '#b46a3c');
  g.addColorStop(0.85, '#7c4020');
  g.addColorStop(1, '#4e260f');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 520; i++) {
    const px = r() * size;
    const py = r() * size;
    const rad = 3 + r() * 6;
    const d = x.createRadialGradient(px - rad * 0.3, py - rad * 0.3, 0, px, py, rad);
    d.addColorStop(0, `rgba(255,214,170,${0.12 + r() * 0.18})`);
    d.addColorStop(0.6, 'rgba(255,214,170,0)');
    d.addColorStop(1, `rgba(40,15,5,${0.1 + r() * 0.12})`);
    x.fillStyle = d;
    x.beginPath();
    x.arc(px, py, rad, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

const PAINTERS = {
  dayanSkin: () => skin(256, 11, ['#f6ead0', '#e8d6b0', '#cdb68c']),
  bayanSkin: () => skin(320, 23, ['#f1e2c2', '#dfc9a0', '#c3a77a']),
  syahi: () => syahi(160, 5),
  copper: () => copper(320, 13),
};

// A painted surface as a data URL, painted the first time it is asked for.
export function surface(name) {
  if (typeof document === 'undefined') return '';
  if (!cache.has(name)) {
    try {
      cache.set(name, PAINTERS[name]().toDataURL('image/jpeg', 0.86));
    } catch {
      cache.set(name, '');
    }
  }
  return cache.get(name);
}
