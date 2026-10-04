// The arena floors, painted in code in the show's flat style: the Smiths'
// lawn in mowing stripes, Cronenberg World's veined flesh, Gazorpazorp's
// cracked orange dirt, the Citadel's deck plating. Each is a square the
// circular floor is cut from; `size` pixels across `span` metres.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, rgb, smooth } from '../../../lib/paint';

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
    const a = rgb('#5fb446');
    const b = rgb('#4f9e3a');
    const dry = rgb('#9bbd55');
    const flower = [rgb('#ffffff'), rgb('#ffd34a'), rgb('#ff8fb1')];
    paintPixels(c, (u, v, out) => {
      // mowing stripes, slightly wavy
      const stripe = Math.sin((u + v * 0.35 + (n(u * k, v * k) - 0.5) * 0.02) * span * 0.9) > 0 ? 1 : 0;
      const patch = fbm(n, u * k, v * k, { octaves: 4 });
      lerp3(a, b, stripe * 0.55 + patch * 0.3, out);
      const d = smooth(0.62, 0.75, fbm(n, u * k * 0.5 + 9, v * k * 0.5, { octaves: 3 }));
      lerp3(out, dry, d * 0.6, out);
      // blades: fine flecks
      const f = n(u * size * 0.35, v * size * 0.35);
      const shade = 0.9 + f * 0.18;
      out[0] *= shade;
      out[1] *= shade;
      out[2] *= shade;
      // the odd flower
      const fl = cells(u * span * 1.4, v * span * 1.4);
      if (fl.f1 < 0.07 && fl.id < 0.09) lerp3(out, flower[Math.floor(fl.id * 300) % 3], 1, out);
    });
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
