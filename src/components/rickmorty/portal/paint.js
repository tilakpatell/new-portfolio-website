// The arena floors, painted in code in the show's flat style: the Smiths'
// lawn (mowing stripes, clover, daisies), Cronenberg World's veined flesh, Gazorpazorp's
// cracked orange dirt, the Citadel's deck plating. Each is a square the
// circular floor is cut from; `size` pixels across `span` metres.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, rgb, smooth } from '../../../lib/paint';
import { rng } from './rules';

const lerp3 = (a, b, t, out) => {
  out[0] = mix(a[0], b[0], t);
  out[1] = mix(a[1], b[1], t);
  out[2] = mix(a[2], b[2], t);
  return out;
};

export function paintFloor(dim, { size = 1024, span = 34, seed = 3 } = {}) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 7);
  const c = makeCanvas(size, size);
  const k = span / 8; // noise periods across the floor
  if (dim === 'backyard') {
    lawn(c, { n, size, span, seed });
  } else if (dim === 'cronenberg') {
    const base = rgb('#c66d84');
    const deep = rgb('#8e3a5a');
    const vein = rgb('#5b1730');
    const pus = rgb('#f0c2a0');
    paintPixels(c, (u, v, out) => {
      const f = fbm(n, u * k, v * k, { octaves: 5 });
      lerp3(base, deep, smooth(0.35, 0.7, f), out);
      // veins: thin ridges in the noise
      const r = 1 - Math.abs(fbm(n, u * k * 0.8 + 3, v * k * 0.8, { octaves: 4 }) * 2 - 1);
      lerp3(out, vein, smooth(0.9, 0.97, r) * 0.85, out);
      // pustules, ringed darker
      const cc = cells(u * span * 0.6, v * span * 0.6);
      if (cc.id < 0.2) {
        const rr = cc.f1;
        if (rr < 0.16) lerp3(out, pus, smooth(0.16, 0.08, rr), out);
        else if (rr < 0.2) lerp3(out, vein, 0.6, out);
      }
    });
  } else if (dim === 'gazorpazorp') {
    const sand = rgb('#e08a45');
    const dark = rgb('#b45a2c');
    const crack = rgb('#6a2a1a');
    const gem = rgb('#b26be8');
    paintPixels(c, (u, v, out) => {
      const f = fbm(n, u * k, v * k, { octaves: 4 });
      lerp3(sand, dark, smooth(0.4, 0.75, f), out);
      // dried-mud cracks: the edges between cells
      const cc = cells(u * span * 0.45, v * span * 0.45);
      const edge = cc.f2 - cc.f1;
      lerp3(out, crack, smooth(0.06, 0.015, edge) * 0.9, out);
      // ripples
      const rip = Math.sin((v + n(u * k, v * k) * 0.05) * span * 3);
      const s = 1 + rip * 0.035;
      out[0] *= s;
      out[1] *= s;
      out[2] *= s;
      const g = cells(u * span * 2.2, v * span * 2.2);
      if (g.f1 < 0.05 && g.id < 0.08) lerp3(out, gem, 1, out);
    });
  } else {
    // the Citadel: deck plates, seams, rivets, a ring of light
    const plate = rgb('#5d6c86');
    const plate2 = rgb('#4f5d76');
    const seam = rgb('#262d3c');
    const glow = rgb('#7cf2ff');
    paintPixels(c, (u, v, out) => {
      const x = (u - 0.5) * span;
      const y = (v - 0.5) * span;
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      // rings of plates, cut radially
      const ring = Math.floor(r / 2.4);
      const seg = Math.floor(((a / (Math.PI * 2)) + 0.5) * (8 + ring * 6));
      lerp3(plate, plate2, ((ring + seg) % 2) * 0.6 + fbm(n, u * k, v * k, { octaves: 3 }) * 0.3, out);
      const fr = (r / 2.4) % 1;
      const fa = (((a / (Math.PI * 2)) + 0.5) * (8 + ring * 6)) % 1;
      const sm = Math.min(Math.min(fr, 1 - fr) * 2.4, Math.min(fa, 1 - fa) * ((r * Math.PI * 2) / (8 + ring * 6)));
      lerp3(out, seam, smooth(0.08, 0.02, sm), out);
      if (sm > 0.12 && sm < 0.2 && (Math.floor(fa * 6) % 2 === 0)) lerp3(out, seam, 0.5, out);
      // a lit ring round the middle, and one near the edge
      const lit = smooth(0.25, 0, Math.abs(r - 4.8)) + smooth(0.25, 0, Math.abs(r - 13.6));
      lerp3(out, glow, clamp01(lit), out);
      const grime = fbm(n, u * k * 2, v * k * 2, { octaves: 3 });
      const s = 0.88 + grime * 0.2;
      out[0] *= s;
      out[1] *= s;
      out[2] *= s;
    });
  }
  return c;
}

// The Smiths' lawn. Broad tones pixel by pixel (warm and deep greens
// drifting across it, soft mowing stripes, clumpy turf, a darker unmown strip
// along the fence), then the detail in strokes, which is far cheaper than
// working it out per pixel: blades leaning one way on a light stripe and the
// other on a dark one, clover, daisies and dandelions.
function lawn(c, { n, size, span, seed }) {
  const k = span / 8;
  const deep = rgb('#3f8a36');
  const mid = rgb('#5aa83f');
  const warm = rgb('#86c04a');
  const dry = rgb('#aab85c');
  // metres from the floor's edge (the fence stands half a metre in)
  const edgeOf = (u, v) => span / 2 - Math.hypot(u - 0.5, v - 0.5) * span;
  const stripeOf = (u, v) => Math.sin((u + v * 0.35 + (n(u * k, v * k) - 0.5) * 0.02) * span * 0.9);
  paintPixels(c, (u, v, out) => {
    const edge = edgeOf(u, v);
    const mown = smooth(0.9, 1.9, edge); // the mower doesn't reach the fence
    const stripe = smooth(-0.4, 0.4, stripeOf(u, v)) * mown;
    const turf = fbm(n, u * k * 1.6, v * k * 1.6 + 5, { octaves: 3 });
    lerp3(deep, mid, clamp01(0.15 + stripe * 0.7 + (turf - 0.5) * 0.55 + mown * 0.1), out);
    const drift = fbm(n, u * k * 0.35 + 17, v * k * 0.35, { octaves: 2 });
    lerp3(out, warm, smooth(0.45, 0.75, drift) * 0.5, out);
    const d = smooth(0.64, 0.78, fbm(n, u * k * 0.5 + 9, v * k * 0.5, { octaves: 2 }));
    lerp3(out, dry, d * 0.45 * mown, out);
    // grain along the blades, and the fence's shade
    const s = (0.94 + n(u * size * 0.9, v * size * 0.22) * 0.12) * (0.8 + 0.2 * smooth(0.15, 0.95, edge));
    out[0] *= s;
    out[1] *= s;
    out[2] *= s;
  });

  const ctx = c.getContext('2d');
  const r = rng(seed * 7919 + 13);
  const px = size / 1024;
  const area = (size / 1024) ** 2;
  ctx.lineCap = 'round';
  // blades, longer and thicker in the unmown strip
  const blades = (count, colour, width, lean) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width * px;
    ctx.beginPath();
    for (let i = 0; i < count * area; i++) {
      const u = r();
      const v = r();
      const edge = edgeOf(u, v);
      if (edge < 0) continue;
      const wild = 1 - smooth(0.9, 1.9, edge);
      const a = -Math.PI / 2 + Math.sign(stripeOf(u, v)) * lean * (1 - wild) + (r() - 0.5) * 0.9;
      const l = (4 + r() * 5) * (1 + wild * 0.8) * px;
      const x = u * size;
      const y = v * size;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    ctx.stroke();
  };
  blades(42000, 'rgba(38, 92, 30, 0.32)', 1.1, 0.45);
  blades(26000, 'rgba(176, 226, 112, 0.28)', 0.8, -0.45);
  // things growing in patches: where(u, v) says how likely, draw(x, y, s) one
  const scatter = (count, where, draw) => {
    for (let i = 0; i < count * area; i++) {
      const u = r();
      const v = r();
      if (edgeOf(u, v) > 0.6 && r() < where(u, v)) draw(u * size, v * size, px * (0.8 + r() * 0.5));
    }
  };
  const dot = (x, y, rad, colour) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  const patch = (off, lo, hi) => (u, v) => smooth(lo, hi, fbm(n, u * k * 0.9 + off, v * k * 0.9, { octaves: 2 }));
  const clover = patch(40, 0.6, 0.72);
  scatter(9000, clover, (x, y, s) => {
    const t = r() * 6.3;
    for (let j = 0; j < 3; j++) dot(x + Math.cos(t + j * 2.1) * 1.3 * s, y + Math.sin(t + j * 2.1) * 1.3 * s, 1.25 * s, 'rgba(52, 128, 50, 0.9)');
  });
  scatter(900, clover, (x, y, s) => dot(x, y, 1.7 * s, r() < 0.3 ? '#f2d2dc' : '#f6f3ea'));
  const daisies = patch(70, 0.62, 0.7);
  scatter(1300, daisies, (x, y, s) => {
    const t = r() * 6.3;
    for (let j = 0; j < 6; j++) dot(x + Math.cos(t + j * 1.05) * 1.5 * s, y + Math.sin(t + j * 1.05) * 1.5 * s, 0.95 * s, '#fbfbf2');
    dot(x, y, 0.95 * s, '#f2c230');
  });
  scatter(260, () => 1, (x, y, s) => (r() < 0.8 ? dot(x, y, 1.6 * s, '#ffd23a') : dot(x, y, 2 * s, 'rgba(246, 246, 238, 0.8)')));
}

// the glow of the Citadel floor's light rings, for the emissive map
export function paintFloorGlow({ size = 512, span = 34 } = {}) {
  const c = makeCanvas(size, size);
  paintPixels(c, (u, v, out) => {
    const r = Math.hypot((u - 0.5) * span, (v - 0.5) * span);
    const lit = smooth(0.25, 0, Math.abs(r - 4.8)) + smooth(0.25, 0, Math.abs(r - 13.6));
    const g = clamp01(lit);
    out[0] = 124 * g;
    out[1] = 242 * g;
    out[2] = 255 * g;
  });
  return c;
}

// A Mega Seed's glow and a soft spark, for sprites
export function glowDot(size = 64) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

// a cartoon puff of smoke: a few overlapping circles, flat, with an edge
export function puff(size = 64) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const blobs = [
    [0.5, 0.55, 0.3],
    [0.32, 0.5, 0.2],
    [0.68, 0.48, 0.22],
    [0.5, 0.36, 0.22],
  ];
  x.fillStyle = 'rgba(30,24,40,1)';
  for (const [bx, by, r] of blobs) {
    x.beginPath();
    x.arc(bx * size, by * size, r * size + 2, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,1)';
  for (const [bx, by, r] of blobs) {
    x.beginPath();
    x.arc(bx * size, by * size, r * size, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}
