// Textures for Walt's Metherria, painted on canvases at start (nothing is
// downloaded). Surfaces come as sets: colour, a normal map from a painted
// height field, and roughness, so tile grout, plank grooves and brushed steel
// catch the light.
import { normalCanvas, rng } from '../../../lib/texture';

const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const grey = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;

// Soft value noise that tiles: `nx` by `ny` cells across the whole texture,
// wrapping at the edges, so a repeated texture shows no seams. Call it with
// (u, v) from 0 to 1.
function noise2(rand, nx = 64, ny = nx) {
  const g = Array.from({ length: nx * ny }, () => rand());
  const at = (x, y) => g[(((y % ny) + ny) % ny) * nx + (((x % nx) + nx) % nx)];
  return (u, v) => {
    const x = u * nx;
    const y = v * ny;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function finish(color, height, roughFrom, strength = 3) {
  const normal = normalCanvas(height, strength);
  const rough = canvas(height.width, height.height);
  const r = rough.getContext('2d');
  const src = height.getContext('2d').getImageData(0, 0, height.width, height.height).data;
  const img = r.createImageData(height.width, height.height);
  for (let i = 0; i < src.length; i += 4) {
    const v = roughFrom(src[i] / 255, i / 4);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v * 255));
    img.data[i + 3] = 255;
  }
  r.putImageData(img, 0, 0);
  return { color, normal, rough };
}

// White subway tile, the superlab's walls: 2:1 tiles, bevelled, in grey grout.
export function paintTile({ size = 1024, seed = 2 } = {}) {
  const rand = rng(seed);
  const color = canvas(size);
  const height = canvas(size);
  const c = color.getContext('2d');
  const h = height.getContext('2d');
  c.fillStyle = '#8e9093';
  c.fillRect(0, 0, size, size);
  h.fillStyle = grey(40);
  h.fillRect(0, 0, size, size);
  const cols = 4;
  const rows = 8;
  const tw = size / cols;
  const th = size / rows;
  const gap = size / 256;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? tw / 2 : 0;
    for (let i = -1; i <= cols; i++) {
      const x = i * tw + off + gap;
      const y = r * th + gap;
      const w = tw - gap * 2;
      const hh = th - gap * 2;
      const v = 232 + rand() * 18;
      c.fillStyle = `rgb(${v | 0},${(v + 1) | 0},${(v + 3) | 0})`;
      c.fillRect(x, y, w, hh);
      // a rounded bevel in the height map
      for (let b = 0; b < 6; b++) {
        h.fillStyle = grey(120 + b * 22);
        const k = b * (size / 1024) * 1.2;
        h.fillRect(x + k, y + k, w - 2 * k, hh - 2 * k);
      }
      // a soft highlight along the top of each tile
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x + w * 0.05, y + hh * 0.08, w * 0.9, hh * 0.08);
    }
  }
  // a little grime low down and in the grout
  const n = noise2(rand, 16);
  const img = c.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const d = (n(x / size, y / size) - 0.5) * 18;
      img.data[i] -= d;
      img.data[i + 1] -= d;
      img.data[i + 2] -= d * 1.2;
    }
  }
  c.putImageData(img, 0, 0);
  return finish(color, height, (v) => (v < 0.3 ? 0.85 : 0.18 + (1 - v) * 0.2), 4);
}

// The RV's wood panelling: vertical planks with grain and dark grooves.
export function paintWood({ size = 1024, seed = 5 } = {}) {
  const rand = rng(seed);
  const warp = noise2(rand, 6, 3); // the grain's slow sway along a plank
  const fibre = noise2(rand, 160, 6); // fine streaks
  const blotch = noise2(rand, 8, 4); // light and dark patches
  const color = canvas(size);
  const height = canvas(size);
  const c = color.getContext('2d');
  const hc = height.getContext('2d');
  const img = c.createImageData(size, size);
  const himg = hc.createImageData(size, size);
  const planks = 8;
  const pw = size / planks;
  // each plank its own tone, grain offset, and a butt joint somewhere
  const P = Array.from({ length: planks }, () => ({ tone: 0.88 + rand() * 0.24, warm: rand() * 0.08, off: rand() * 10, joint: 0.15 + rand() * 0.7 }));
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const p = P[Math.floor(x / pw)];
      const lx = (x % pw) / pw;
      const sway = warp(u, v) * 3.2 + p.off;
      const ring = Math.sin((lx * 7 + sway) * Math.PI) * 0.5 + 0.5;
      const grain = ring ** 3; // thin dark lines, wide light wood
      const f = fibre(u, v);
      const k = (0.74 - grain * 0.16 + (f - 0.5) * 0.1 + (blotch(u, v) - 0.5) * 0.14) * p.tone;
      const groove = lx < 0.014 || lx > 0.986;
      const joint = Math.abs(v - p.joint) < 1.5 / size;
      const i = (y * size + x) * 4;
      const dark = groove || joint;
      img.data[i] = dark ? 46 : 168 * k * (1 + p.warm);
      img.data[i + 1] = dark ? 30 : 110 * k;
      img.data[i + 2] = dark ? 20 : 66 * k * (1 - p.warm);
      img.data[i + 3] = 255;
      const hv = groove ? 40 : joint ? 120 : 176 - grain * 26 + f * 10;
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  hc.putImageData(himg, 0, 0);
  return finish(color, height, (h) => 0.5 + (1 - h) * 0.4, 2.2);
}

// Floors: grey epoxy for the superlab, a worn checker for the RV.
export function paintFloor({ size = 1024, seed = 9, kind = 'superlab' } = {}) {
  const rand = rng(seed);
  const n = noise2(rand, 12);
  const fine = noise2(rand, 72);
  const color = canvas(size);
  const height = canvas(size);
  const c = color.getContext('2d');
  const hc = height.getContext('2d');
  const img = c.createImageData(size, size);
  const himg = hc.createImageData(size, size);
  const cells = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const m = n(x / size, y / size) * 0.6 + fine(x / size, y / size) * 0.4;
      let r;
      let g;
      let b;
      let hv = 160 + m * 40;
      if (kind === 'superlab') {
        const v = 92 + m * 34 + (rand() < 0.004 ? 40 : 0);
        r = v;
        g = v + 2;
        b = v + 5;
        // the slab joints
        if (x % (size / 2) < 2 || y % (size / 2) < 2) {
          r = g = b = 48;
          hv = 60;
        }
      } else {
        const cx = Math.floor((x / size) * cells);
        const cy = Math.floor((y / size) * cells);
        const dark = (cx + cy) % 2;
        const v = (dark ? 78 : 196) * (0.9 + m * 0.2);
        r = v * (dark ? 1 : 1.0);
        g = v * (dark ? 0.86 : 0.95);
        b = v * (dark ? 0.7 : 0.82);
      }
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  hc.putImageData(himg, 0, 0);
  return finish(color, height, (v) => (kind === 'superlab' ? 0.35 + (1 - v) * 0.4 : 0.6), 1.5);
}

// Brushed stainless steel: fine streaks along the bench.
export function paintSteel({ size = 512, seed = 13 } = {}) {
  const rand = rng(seed);
  const color = canvas(size);
  const height = canvas(size);
  const c = color.getContext('2d');
  const hc = height.getContext('2d');
  c.fillStyle = '#c4c9ce';
  c.fillRect(0, 0, size, size);
  hc.fillStyle = grey(128);
  hc.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 40 + rand() * 260;
    const v = 170 + rand() * 70;
    c.strokeStyle = `rgba(${v | 0},${(v + 3) | 0},${(v + 6) | 0},0.35)`;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y + (rand() - 0.5) * 0.6);
    c.stroke();
    hc.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},0.25)`;
    hc.beginPath();
    hc.moveTo(x, y);
    hc.lineTo(x + len, y);
    hc.stroke();
  }
  return finish(color, height, (v) => 0.22 + Math.abs(v - 0.5) * 0.6, 0.8);
}

// Yellow and black hazard stripes, for the superlab's railings and the hatch.
export function paintHazard({ size = 256 } = {}) {
  const c = canvas(size, size / 4);
  const x = c.getContext('2d');
  x.fillStyle = '#f2c318';
  x.fillRect(0, 0, size, size / 4);
  x.fillStyle = '#1a1a1a';
  for (let i = -size; i < size * 2; i += size / 4) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + size / 8, 0);
    x.lineTo(i + size / 8 - size / 4, size / 4);
    x.lineTo(i - size / 4, size / 4);
    x.closePath();
    x.fill();
  }
  return c;
}

// A printed label: words on a coloured band.
export function paintLabel(text, { bg = '#e8ecef', fg = '#1a2a33', w = 512, h = 256, font = 'bold 92px "Archivo Variable", Arial, sans-serif', sub = '' } = {}) {
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = font;
  x.fillText(text, w / 2, sub ? h * 0.42 : h / 2);
  if (sub) {
    x.font = 'bold 34px "Archivo Variable", Arial, sans-serif';
    x.fillText(sub, w / 2, h * 0.78);
  }
  return c;
}

// The Los Pollos Hermanos box: yellow, the red name, the chicken's circle.
export function paintPollosBox() {
  const w = 512;
  const h = 512;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#ffd23a');
  gr.addColorStop(1, '#efb714');
  x.fillStyle = gr;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#b5281c';
  x.lineWidth = 14;
  x.strokeRect(18, 18, w - 36, h - 36);
  x.fillStyle = '#b5281c';
  x.beginPath();
  x.arc(w / 2, h * 0.38, 92, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#ffd23a';
  x.beginPath();
  x.ellipse(w / 2 - 6, h * 0.4, 46, 34, 0, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.arc(w / 2 + 34, h * 0.32, 20, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#b5281c';
  x.textAlign = 'center';
  x.font = 'italic bold 58px Georgia, serif';
  x.fillText('Los Pollos', w / 2, h * 0.72);
  x.font = 'italic bold 52px Georgia, serif';
  x.fillText('Hermanos', w / 2, h * 0.84);
  return c;
}

// A dial: ticks and numbers round a white face, an arc of green where wanted.
export function paintDial(c, { from = -120, to = 120, band = null, label = '' } = {}) {
  const s = c.width;
  const x = c.getContext('2d');
  x.clearRect(0, 0, s, s);
  x.fillStyle = '#f4f2ea';
  x.beginPath();
  x.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#3a3f45';
  x.lineWidth = s * 0.03;
  x.stroke();
  const ang = (v) => ((from + (to - from) * v - 90) * Math.PI) / 180;
  if (band) {
    x.strokeStyle = '#2f9e4f';
    x.lineWidth = s * 0.07;
    x.beginPath();
    x.arc(s / 2, s / 2, s * 0.36, ang(band[0]), ang(band[1]));
    x.stroke();
  }
  x.strokeStyle = '#26292d';
  for (let i = 0; i <= 20; i++) {
    const a = ang(i / 20);
    const r1 = s * (i % 5 ? 0.41 : 0.38);
    x.lineWidth = i % 5 ? s * 0.008 : s * 0.016;
    x.beginPath();
    x.moveTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1);
    x.lineTo(s / 2 + Math.cos(a) * s * 0.45, s / 2 + Math.sin(a) * s * 0.45);
    x.stroke();
  }
  if (label) {
    x.fillStyle = '#4a5058';
    x.textAlign = 'center';
    x.font = `bold ${Math.round(s * 0.08)}px "JetBrains Mono", monospace`;
    x.fillText(label, s / 2, s * 0.72);
  }
  return c;
}
