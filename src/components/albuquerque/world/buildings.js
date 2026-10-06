// The rest of town, built in code: the buildings rules.js lists in TOWN, each
// to exactly its footprint there (so the wall you see is the wall the car
// stops at), with painted fronts whose windows light up at night and signs
// that glow like neon. Real Albuquerque: the KiMo Theatre's Pueblo Deco
// front, the Dog House and its dachshund, Loyola's diner, the Route 66
// arches over Central. And the shows': the DEA's field office, the
// Crossroads Motel, a house under Vamonos Pest's striped tent, Jesse's
// place, Hank and Marie's, Old Joe's junkyard, the water tower, two
// billboards, and the freight train that crosses north of town.
//
// createTown({ aniso, small }) → { object, train, floors, update(dt, clock,
// night), dispose }: `train` the freight's cars (they move: a blob each, and
// out of the way while the floor's shadows are baked), `floors` the track
// bed (floor, for those shadows).

import * as THREE from 'three';
import { RAIL, TOWN, groundHeight, surfaceHeight } from './rules';

const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The buildings Meshy has made (public/models/albuquerque/world/<name>.glb,
// scripts/meshy-albuquerque.mjs), by TOWN id, and which way each one's front
// faces as it was made (turned to +z here, like the code-built ones).
// Saul's car and the water tank are from Sketchfab (CC Attribution: public/cc0/README.md).
export const TOWN_MODELS = { kimo: 'kimo', doghouse: 'doghouse', dea: 'dea', motel: 'motel', pest: 'pest', jesse: 'jesse-house', diner: 'diner', hank: 'hank-house', esteem: 'esteem', watertank: 'watertank' };
const MODEL_FRONT = { kimo: 0, doghouse: 0, dea: 0, motel: 0, pest: 0, jesse: 0, diner: 0, hank: 0 };

export function createTown({ aniso = 8, small = false, models = {}, tankCar = null } = {}) {
  const root = new THREE.Group();
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const lit = []; // materials whose windows or letters glow after dark: { m, k }
  const floors = []; // materials that are floor (the track bed)
  const cap = small ? 256 : 512;

  const canvasOf = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(8, Math.round(w));
    c.height = Math.max(8, Math.round(h));
    return c;
  };
  const texOf = (c, repeat) => {
    const t = own(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  };
  const flat = (color, o = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o }));
  const add = (parent, geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(own(geo), mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // A wall, painted: wM by hM metres. Returns a material whose windows light at night.
  // o: base, trim, floors, bay (metres a window), win [w, h] as a share of its bay and floor,
  // glass, brick, ribs (corrugated), stripes [colours], door, band (a painted strip under the top)
  const wall = (wM, hM, o, seed) => {
    const ppm = Math.min(36, cap / wM);
    const W = wM * ppm;
    const H = hM * ppm;
    const c = canvasOf(W, H);
    const g = c.getContext('2d');
    const e = canvasOf(W, H);
    const eg = e.getContext('2d');
    eg.fillStyle = '#000';
    eg.fillRect(0, 0, W, H);
    const r = seeded(seed);
    g.fillStyle = o.base;
    g.fillRect(0, 0, W, H);
    if (o.stripes) {
      const sw = (o.stripeW ?? 0.9) * ppm;
      for (let x = 0, i = 0; x < W; x += sw, i++) {
        g.fillStyle = o.stripes[i % o.stripes.length];
        g.fillRect(x, 0, sw + 1, H);
      }
    }
    if (o.brick) {
      const bh = 0.09 * ppm * 2.2;
      g.strokeStyle = 'rgba(40, 22, 14, 0.35)';
      g.lineWidth = 1;
      for (let y = 0, row = 0; y < H; y += bh, row++) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
        for (let x = (row % 2) * bh * 1.3; x < W; x += bh * 2.6) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + bh);
          g.stroke();
          if (r() < 0.25) {
            g.fillStyle = `rgba(${r() < 0.5 ? '30,14,8' : '255,210,170'}, ${0.06 + r() * 0.1})`;
            g.fillRect(x, y, bh * 2.6, bh);
          }
        }
      }
    }
    if (o.ribs) {
      const rw = 0.22 * ppm;
      for (let x = 0; x < W; x += rw) {
        g.fillStyle = 'rgba(0, 0, 0, 0.16)';
        g.fillRect(x, 0, rw * 0.45, H);
        g.fillStyle = 'rgba(255, 255, 255, 0.1)';
        g.fillRect(x + rw * 0.5, 0, rw * 0.2, H);
      }
    }
    // weather: blotches, streaks down from the top, dust thrown up at the foot
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,215'}, ${0.02 + r() * 0.05})`;
      const s = (0.4 + r() * 2.2) * ppm;
      g.beginPath();
      g.ellipse(r() * W, r() * H, s, s * (0.4 + r()), 0, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const grad = g.createLinearGradient(0, 0, 0, H * (0.2 + r() * 0.5));
      grad.addColorStop(0, 'rgba(40, 28, 18, 0.2)');
      grad.addColorStop(1, 'rgba(40, 28, 18, 0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 1 + r() * 3, H);
    }
    const foot = g.createLinearGradient(0, H * 0.86, 0, H);
    foot.addColorStop(0, 'rgba(190, 150, 100, 0)');
    foot.addColorStop(1, 'rgba(190, 150, 100, 0.4)');
    g.fillStyle = foot;
    g.fillRect(0, H * 0.86, W, H * 0.14);
    // windows, floor by floor
    const floors = o.floors ?? 0;
    const fh = H / Math.max(1, floors);
    const bays = Math.max(1, Math.floor(wM / (o.bay ?? 3)));
    const bw = W / bays;
    const [kw, kh] = o.win ?? [0.55, 0.5];
    const doorBay = o.door ? Math.floor(bays / 2) : -1;
    for (let f = 0; f < floors; f++)
      for (let b = 0; b < bays; b++) {
        const ground = f === floors - 1;
        const isDoor = ground && b === doorBay;
        if (ground && o.blank && !isDoor) continue;
        const ww = bw * (isDoor ? Math.min(0.5, 1.5 / (bw / ppm)) : kw);
        const wh = fh * (isDoor ? 0.72 : kh);
        const x = b * bw + (bw - ww) / 2;
        const y = f * fh + (isDoor ? fh - wh : (fh - wh) * 0.45);
        g.fillStyle = o.trim ?? '#3a3028';
        g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
        const on = !isDoor && r() < (o.lit ?? 0.55);
        const glass = g.createLinearGradient(0, y, 0, y + wh);
        glass.addColorStop(0, isDoor ? o.doorCol ?? '#5a3a26' : o.glass ?? '#2b3d4f');
        glass.addColorStop(1, isDoor ? o.doorCol ?? '#3f2819' : '#141c26');
        g.fillStyle = glass;
        g.fillRect(x, y, ww, wh);
        if (!isDoor) {
          g.fillStyle = 'rgba(255, 255, 255, 0.14)';
          g.fillRect(x, y, ww * 0.42, wh * 0.5);
          g.fillStyle = o.trim ?? '#3a3028';
          g.fillRect(x + ww / 2 - 1, y, 2, wh);
          if (o.arch) {
            g.fillStyle = o.base;
            g.beginPath();
            g.moveTo(x - 2, y - 2);
            g.lineTo(x + ww + 2, y - 2);
            g.lineTo(x + ww + 2, y + ww * 0.25);
            g.quadraticCurveTo(x + ww / 2, y - ww * 0.28, x - 2, y + ww * 0.25);
            g.fill();
          }
        }
        if (on) {
          eg.fillStyle = r() < 0.2 ? '#bfe0ff' : '#ffd9a0';
          eg.globalAlpha = 0.55 + r() * 0.45;
          eg.fillRect(x, y, ww, wh);
          eg.globalAlpha = 1;
        }
      }
    if (o.band) {
      const y = H * 0.03;
      const bh = Math.max(4, 0.55 * ppm);
      const n = Math.ceil(W / bh);
      for (let i = 0; i < n; i++) {
        g.fillStyle = o.band[i % o.band.length];
        g.beginPath();
        g.moveTo(i * bh, y + bh);
        g.lineTo(i * bh + bh / 2, y);
        g.lineTo(i * bh + bh, y + bh);
        g.fill();
      }
    }
    const m = own(new THREE.MeshStandardMaterial({ map: texOf(c), emissiveMap: texOf(e), emissive: 0xffffff, emissiveIntensity: 0, roughness: o.rough ?? 0.92, metalness: o.metal ?? 0 }));
    lit.push({ m, k: 0.85 });
    return m;
  };

  // Lettering on a board: dark by day, neon after dark. Both faces read.
  const sign = (parent, text, { w, h, x = 0, y = 0, z = 0, ry = 0, bg = '#1c1a17', fg = '#ffe9b0', neon = '#ffb347', font = 'Georgia, serif', weight = 800, draw } = {}) => {
    const ppm = Math.min(96, cap / w);
    const c = canvasOf(w * ppm, h * ppm);
    const e = canvasOf(w * ppm, h * ppm);
    for (const [ctx, isGlow] of [
      [c.getContext('2d'), false],
      [e.getContext('2d'), true],
    ]) {
      ctx.fillStyle = isGlow ? '#000' : bg;
      ctx.fillRect(0, 0, c.width, c.height);
      if (!isGlow) {
        ctx.strokeStyle = fg;
        ctx.lineWidth = Math.max(2, c.height * 0.04);
        ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, c.width - ctx.lineWidth * 2, c.height - ctx.lineWidth * 2);
      }
      ctx.fillStyle = isGlow ? neon : fg;
      ctx.strokeStyle = isGlow ? neon : fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = String(text).split('\n');
      let size = (c.height * 0.72) / lines.length;
      ctx.font = `${weight} ${size}px ${font}`;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (widest > c.width * 0.86) size *= (c.width * 0.86) / widest;
      ctx.font = `${weight} ${size}px ${font}`;
      lines.forEach((l, i) => ctx.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.08));
      draw?.(ctx, c.width, c.height, isGlow);
    }
    const m = own(new THREE.MeshStandardMaterial({ map: texOf(c), emissiveMap: texOf(e), emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.6 }));
    lit.push({ m, k: 1.2, base: 0.15 });
    const board = new THREE.Group();
    const geo = own(new THREE.PlaneGeometry(w, h));
    const front = new THREE.Mesh(geo, m);
    front.position.z = 0.06;
    const back = new THREE.Mesh(geo, m);
    back.rotation.y = Math.PI;
    back.position.z = -0.06;
    const slab = new THREE.Mesh(own(B(w + 0.16, h + 0.16, 0.1)), dark);
    board.add(front, back, slab);
    board.position.set(x, y, z);
    board.rotation.y = ry;
    parent.add(board);
    return board;
  };
  const dark = flat(0x1b1a18, { roughness: 0.7 });
  const steel = flat(0x70757c, { roughness: 0.45, metalness: 0.7 });
  const pole = (parent, x, z, h, r = 0.14) => add(parent, new THREE.CylinderGeometry(r, r * 1.2, h, 8), steel, x, h / 2, z);
  const poleSign = (parent, text, x, z, h, o) => {
    pole(parent, x, z, h - o.h / 2);
    return sign(parent, text, { ...o, x, y: h, z });
  };

  // A box of four painted walls and a roof: front on +z.
  const shell = (parent, W, H, D, front, side, roofCol = 0x6b6259, back = side) => {
    const roof = flat(roofCol);
    return add(parent, B(W, H, D), [side, side, roof, roof, front, back], 0, H / 2, 0);
  };
  // A pitched roof: ridge along x, eaves on ±z.
  const gable = (parent, W, H, D, mat, y) => {
    const g = new THREE.BufferGeometry();
    const [w, d] = [W / 2, D / 2];
    // two slopes, then the two ends
    const p = [-w, 0, d, w, 0, d, w, H, 0, -w, 0, d, w, H, 0, -w, H, 0, w, 0, -d, -w, 0, -d, -w, H, 0, w, 0, -d, -w, H, 0, w, H, 0, -w, 0, -d, -w, 0, d, -w, H, 0, w, 0, d, w, 0, -d, w, H, 0];
    const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return add(parent, g, mat, 0, y, 0);
  };
  const striped = (cols, n, o = {}) => {
    const c = canvasOf(64, 64);
    const g = c.getContext('2d');
    cols.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect((i * 64) / cols.length, 0, 64 / cols.length + 1, 64);
    });
    return own(new THREE.MeshStandardMaterial({ map: texOf(c, [n, 1]), roughness: 0.85, side: THREE.DoubleSide, ...o }));
  };

  const KINDS = {
    // the KiMo: Pueblo Deco, a stepped top, a band of tile, a marquee and a blade sign
    deco(b, t, W, D) {
      const o = { base: '#c9a57a', trim: '#6b3b2a', floors: 3, bay: 3.3, win: [0.42, 0.56], band: ['#2a9d8f', '#c8452c', '#e9c46a', '#2a6f97'], lit: 0.5 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true, blank: true }, 11), wall(D, t.h, o, 12));
      const st = flat(0xc9a57a);
      add(b, B(W * 0.7, 1.1, D), st, 0, t.h + 0.55, 0);
      add(b, B(W * 0.36, 0.9, D), st, 0, t.h + 1.55, 0);
      const z = D / 2;
      add(b, B(8.4, 0.9, 2.6), flat(0x7a2e22), 0, 3.5, z + 1.3);
      sign(b, 'KiMo', { w: 8.2, h: 0.85, y: 3.5, z: z + 2.62, bg: '#f4ead2', fg: '#7a2e22', neon: '#ff6a3d' });
      sign(b, 'K\ni\nM\no', { w: 1.2, h: 6.2, x: -W / 2 + 2.2, y: 7.6, z: z + 0.9, ry: Math.PI / 2, bg: '#1f4f5a', fg: '#f6d67a', neon: '#39d6c8' });
    },
    // the Dog House: a little white drive-in under a neon dachshund
    hotdog(b, t, W, D) {
      const o = { base: '#efe9dc', trim: '#b3261e', floors: 1, bay: 2.2, win: [0.62, 0.42], stripes: null, lit: 0.9 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true }, 21), wall(D, t.h, o, 22), 0xb3261e);
      add(b, B(W + 5, 0.22, 4.6), flat(0xb3261e), 0, t.h + 0.02, D / 2 + 2.1);
      for (const s of [-1, 1]) pole(b, s * (W / 2 + 2), D / 2 + 4, t.h, 0.08);
      const dog = (g, w, h, glow) => {
        // a long dog, wagging: body, head, ears, legs, tail
        g.strokeStyle = glow ? '#ff7a2e' : '#ffb347';
        g.lineWidth = h * 0.045;
        g.lineCap = 'round';
        const y = h * 0.8;
        g.beginPath();
        g.roundRect(w * 0.22, y - h * 0.09, w * 0.5, h * 0.12, h * 0.06);
        g.moveTo(w * 0.72, y - h * 0.04);
        g.lineTo(w * 0.8, y - h * 0.13);
        g.roundRect(w * 0.78, y - h * 0.19, w * 0.09, h * 0.09, h * 0.03);
        g.moveTo(w * 0.22, y - h * 0.06);
        g.lineTo(w * 0.16, y - h * 0.17);
        for (const lx of [0.28, 0.34, 0.6, 0.66]) {
          g.moveTo(w * lx, y + h * 0.03);
          g.lineTo(w * lx, y + h * 0.1);
        }
        g.stroke();
      };
      poleSign(b, 'THE\nDOG HOUSE', W / 2 + 3.4, D / 2 + 3, 8.4, { w: 4.6, h: 3.4, bg: '#101010', fg: '#fff3d6', neon: '#ffe26a', font: 'Georgia, serif', draw: dog });
    },
    // Big Chief: a shop, a canopy over the pumps, a sign you can see from the road
    gas(b, t, W, D) {
      const o = { base: '#d9d2c1', trim: '#1f5d8c', floors: 1, bay: 2.4, win: [0.7, 0.5], lit: 0.9 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true }, 31), wall(D, t.h, { ...o, bay: 4 }, 32), 0x8c2f22);
      // the canopy stands over the forecourt; its posts are thin enough to pass
      add(b, B(W + 2, 0.5, 5.2), flat(0xf3efe6), 0, 5.2, D / 2 + 3.4);
      add(b, B(W + 2.1, 0.22, 5.3), flat(0xc0392b), 0, 4.9, D / 2 + 3.4);
      for (const s of [-1, 1]) {
        pole(b, s * (W / 2), D / 2 + 3.4, 4.9, 0.11);
        add(b, B(0.7, 1.5, 0.45), flat(0xc0392b, { roughness: 0.5 }), s * 2.2, 0.75, D / 2 + 3.4);
      }
      poleSign(b, 'BIG CHIEF\nGAS  2.89⁹', -W / 2 - 2.4, D / 2 + 4.4, 9, { w: 4.2, h: 2.6, bg: '#8c2f22', fg: '#fff4d8', neon: '#ff5a3a' });
    },
    // the Crossroads: one long row of doors, and VACANCY
    motel(b, t, W, D) {
      const o = { base: '#d7b98c', trim: '#2f6f73', floors: 1, bay: 2.1, win: [0.5, 0.46], doorCol: '#2f6f73', lit: 0.45 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true }, 41), wall(D, t.h, { ...o, bay: 5 }, 42), 0x7a4a32);
      add(b, B(W + 0.6, 0.18, 2.4), flat(0x7a4a32), 0, t.h - 0.5, D / 2 + 1.1);
      for (let i = 0; i <= 8; i++) pole(b, -W / 2 + (i * W) / 8, D / 2 + 2.1, t.h - 0.5, 0.06);
      poleSign(b, 'CROSSROADS\nMOTEL', W / 2 - 3, D / 2 + 4, 9.5, { w: 5.6, h: 2.6, bg: '#14323a', fg: '#ffe8a8', neon: '#ff4fa3' });
      sign(b, 'VACANCY', { w: 3, h: 0.7, x: W / 2 - 3, y: 7.3, z: D / 2 + 4, bg: '#101010', fg: '#ff5a5a', neon: '#ff3030', font: 'Courier New, monospace' });
    },
    // Loyola's: glass all round, red and white, the name on the roof
    diner(b, t, W, D) {
      const o = { base: '#f1ece2', trim: '#a8231c', floors: 1, bay: 1.9, win: [0.82, 0.5], stripes: ['#f1ece2', '#f1ece2', '#f1ece2', '#b3261e'], stripeW: 0.5, lit: 1 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true }, 51), wall(D, t.h, o, 52), 0xa8231c);
      add(b, B(W + 1, 0.25, D + 1), flat(0xa8231c), 0, t.h + 0.1, 0);
      sign(b, 'LOYOLA’S\nFAMILY RESTAURANT', { w: 8.5, h: 1.9, y: t.h + 1.3, z: 0, bg: '#fdf6e3', fg: '#a8231c', neon: '#ff4a3a' });
    },
    // brick, two or three floors, awnings over the shopfront
    brick(b, t, W, D) {
      const floors = Math.max(2, Math.round(t.h / 3.6));
      const o = { base: t.id === 'bank' ? '#8f4a36' : '#7b5a45', trim: '#e9dcc3', floors, bay: 2.9, win: [0.46, 0.58], arch: true, brick: true, lit: 0.5 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true }, 61 + W), wall(D, t.h, o, 62 + W), 0x4a4038);
      add(b, B(W + 0.5, 0.45, D + 0.5), flat(0xe9dcc3), 0, t.h + 0.2, 0);
      add(b, B(W * 0.86, 0.14, 1.5), flat(t.id === 'bank' ? 0x1f5d3a : 0x7a2e22), 0, t.h / floors - 0.25, D / 2 + 0.75, [0.22, 0, 0]);
      sign(b, t.name.toUpperCase(), { w: Math.min(W * 0.8, 11), h: 0.9, y: t.h / floors + 0.5, z: D / 2 + 0.12, bg: '#161412', fg: '#f6e7bf', neon: t.id === 'bank' ? '#7dffb0' : '#ffb347' });
    },
    // the DEA's field office: concrete and ribbon glass, a flag out front
    office(b, t, W, D) {
      const o = { base: '#b9b4a8', trim: '#8a857a', floors: 5, bay: 1.7, win: [0.9, 0.5], glass: '#3f6f8f', lit: 0.4, rough: 0.6 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true, doorCol: '#22303a' }, 71), wall(D, t.h, o, 72), 0x55524c);
      add(b, B(W * 0.4, 1.8, D * 0.4), flat(0x7d7a72), W * 0.15, t.h + 0.9, 0);
      add(b, B(7, 0.3, 3), flat(0x8a857a), 0, 3.6, D / 2 + 1.5);
      sign(b, 'DRUG ENFORCEMENT\nADMINISTRATION', { w: 6.6, h: 1.2, y: 4.5, z: D / 2 + 0.2, bg: '#11243a', fg: '#e8d9a0', neon: '#9cc8ff', font: 'Georgia, serif' });
      pole(b, -W / 2 - 2, D / 2 + 3, 10, 0.07);
      add(b, B(2.2, 1.3, 0.04), striped(['#b22234', '#ffffff', '#b22234', '#ffffff', '#3c3b6e'], 1), -W / 2 - 0.85, 9.2, D / 2 + 3);
    },
    // a house being fumigated, and not only fumigated
    tent(b, t, W, D) {
      const cols = ['#e8c21a', '#2f9e58', '#e8c21a', '#c0392b'];
      const body = t.h * 0.58;
      const cloth = striped(cols, 7);
      add(b, B(W, body, D), cloth, 0, body / 2, 0);
      gable(b, W + 0.3, t.h - body, D + 0.3, striped(cols, 7), body);
      sign(b, 'VAMONOS PEST', { w: 6, h: 1, y: 1.3, z: D / 2 + 1.6, bg: '#f4f0e4', fg: '#2f6f3a', neon: '#baff6a' });
      for (const s of [-1, 1]) pole(b, s * 2.8, D / 2 + 1.6, 0.9, 0.05);
    },
    // Hank and Marie's: adobe, vigas, and a purple front door
    adobe(b, t, W, D) {
      const o = { base: '#b88a62', trim: '#4a3526', floors: 1, bay: 3, win: [0.42, 0.42], doorCol: '#6b3fa0', lit: 0.6 };
      shell(b, W, t.h, D, wall(W, t.h, { ...o, door: true }, 81), wall(D, t.h, o, 82), 0xa57a55);
      add(b, B(W + 0.3, 0.5, D + 0.3), flat(0xb88a62), 0, t.h + 0.1, 0);
      for (let i = 0; i < 7; i++) add(b, new THREE.CylinderGeometry(0.1, 0.1, 0.9, 6), flat(0x5a4030), -W / 2 + 1 + (i * (W - 2)) / 6, t.h - 0.55, D / 2 + 0.3, [Math.PI / 2, 0, 0]);
      add(b, B(W * 0.5, 0.2, 2.6), flat(0x5a4030), W * 0.15, 2.9, D / 2 + 1.3);
      for (const s of [-1, 1]) pole(b, W * 0.15 + s * W * 0.22, D / 2 + 2.4, 2.9, 0.09);
    },
    // Jesse's: two floors of white stucco under red tile
    spanish(b, t, W, D) {
      const body = t.h - 2;
      const o = { base: '#efe6d4', trim: '#5b3a26', floors: 2, bay: 2.9, win: [0.44, 0.52], arch: true, lit: 0.45 };
      shell(b, W, body, D, wall(W, body, { ...o, door: true }, 91), wall(D, body, o, 92), 0x9a4a30);
      gable(b, W + 0.9, 2, D + 0.9, striped(['#a8442b', '#c25a3a', '#8f3a24'], 22, { roughness: 0.8 }), body);
      add(b, B(3.4, 0.14, 1.2), flat(0x5b3a26), 0, body / 2 + 0.1, D / 2 + 0.6);
      add(b, B(3.4, 0.7, 0.08), flat(0x2a2320), 0, body / 2 + 0.5, D / 2 + 1.16);
    },
    // Old Joe's: a rusted fence right round, and cars stacked three high inside
    junkyard(b, t, W, D) {
      const rust = wall(W, t.h, { base: '#7a4a2c', ribs: true, floors: 0 }, 101);
      const rustS = wall(D, t.h, { base: '#70452b', ribs: true, floors: 0 }, 102);
      for (const s of [-1, 1]) {
        add(b, B(W, t.h, 0.16), rust, 0, t.h / 2, s * (D / 2 - 0.08));
        add(b, B(0.16, t.h, D), rustS, s * (W / 2 - 0.08), t.h / 2, 0);
      }
      const r = seeded(7);
      const cols = [0x8a2f22, 0x2f5f8a, 0xd9c46a, 0x4a6b3a, 0x8c8c8c, 0xe8e2d2, 0x3a3a3a, 0xb5651d];
      const carGeo = own(new THREE.BoxGeometry(4.2, 1.15, 1.85));
      const cabGeo = own(new THREE.BoxGeometry(2.1, 0.7, 1.7));
      for (let i = 0; i < 9; i++) {
        const x = -W / 2 + 3.4 + (i % 4) * 5.6;
        const z = -D / 2 + 3 + Math.floor(i / 4) * 5.2;
        const high = 1 + Math.floor(r() * 3);
        for (let k = 0; k < high; k++) {
          const m = flat(cols[Math.floor(r() * cols.length)], { roughness: 0.75, metalness: 0.3 });
          const car = new THREE.Mesh(carGeo, m);
          car.position.set(x + (r() - 0.5) * 0.5, 0.6 + k * 1.22, z + (r() - 0.5) * 0.5);
          car.rotation.y = (r() - 0.5) * 0.3;
          const cab = new THREE.Mesh(cabGeo, m);
          cab.position.set(-0.2, 0.75, 0);
          car.add(cab);
          b.add(car);
        }
      }
      // the crane, over the fence
      add(b, B(0.5, 9, 0.5), flat(0xd9a521, { metalness: 0.4 }), W / 2 - 3, 4.5, D / 2 - 3);
      add(b, B(9, 0.4, 0.4), flat(0xd9a521, { metalness: 0.4 }), W / 2 - 6.5, 8.8, D / 2 - 3, [0, 0, 0.12]);
      sign(b, 'OLD JOE’S\nSALVAGE', { w: 6, h: 1.9, y: t.h + 1.2, z: D / 2 + 0.1, bg: '#2a2622', fg: '#e8c21a', neon: '#ffd23a', font: 'Courier New, monospace' });
    },
    // the water tower, with the town's name round the tank
    tower(b, t, W) {
      const r = W / 2 - 0.4;
      const legs = flat(0x8c9096, { metalness: 0.6, roughness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        add(b, new THREE.CylinderGeometry(0.16, 0.2, t.h - 6, 8), legs, Math.cos(a) * r * 0.82, (t.h - 6) / 2, Math.sin(a) * r * 0.82);
      }
      add(b, new THREE.CylinderGeometry(0.4, 0.4, t.h - 6, 10), legs, 0, (t.h - 6) / 2, 0);
      const c = canvasOf(cap * 2, cap / 2);
      const g = c.getContext('2d');
      g.fillStyle = '#e6e1d5';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#2f6f73';
      g.fillRect(0, c.height * 0.82, c.width, c.height * 0.08);
      g.fillStyle = '#a8231c';
      g.font = `800 ${c.height * 0.36}px Georgia, serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const k of [0.25, 0.75]) g.fillText('ALBUQUERQUE', c.width * k, c.height * 0.45);
      const tankMat = own(new THREE.MeshStandardMaterial({ map: texOf(c), roughness: 0.6, metalness: 0.2 }));
      add(b, new THREE.CylinderGeometry(r, r, 5, 28), [tankMat, legs, legs], 0, t.h - 3.5, 0);
      add(b, new THREE.ConeGeometry(r + 0.1, 1.4, 28), flat(0x8a2f22), 0, t.h - 0.3, 0);
    },
    // a parked car, if its model can't be had: a body and a cabin
    car(b, t, W, D) {
      const paint = flat(0xe8d36a, { roughness: 0.5, metalness: 0.3 });
      add(b, B(W, t.h * 0.5, D), paint, 0, t.h * 0.42, 0);
      add(b, B(W * 0.9, t.h * 0.42, D * 0.5), flat(0x2a3036, { roughness: 0.3 }), 0, t.h * 0.82, -D * 0.05);
    },
    // Beneke Fabricators: a long tin shed with roller doors
    warehouse(b, t, W, D) {
      const body = t.h - 2;
      const o = { base: '#8c9aa3', ribs: true, floors: 1, bay: 7.5, win: [0.62, 0.7], glass: '#39424a', trim: '#4a545c', lit: 0.15, metal: 0.4, rough: 0.6 };
      shell(b, W, body, D, wall(W, body, o, 111), wall(D, body, { ...o, floors: 0 }, 112), 0x6f7b84);
      gable(b, W + 0.4, 2, D + 0.4, flat(0x77848d, { metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide }), body);
      sign(b, 'BENEKE FABRICATORS', { w: 12, h: 1.2, y: body - 0.9, z: D / 2 + 0.12, bg: '#1b2a36', fg: '#e8eef2', neon: '#8fd0ff', font: 'Arial, sans-serif' });
    },
  };

  // the names on the Meshy buildings (their own signs are blank)
  const NAMES = {
    kimo: (b, t, W, D) => sign(b, 'KiMo', { w: 5, h: 0.9, y: 3.9, z: D / 2 + 0.25, bg: '#f4ead2', fg: '#7a2e22', neon: '#ff6a3d' }),
    doghouse: (b, t, W, D) => poleSign(b, 'THE\nDOG HOUSE', W / 2 + 2.6, D / 2 + 1.5, 7, { w: 4, h: 2.2, bg: '#101010', fg: '#fff3d6', neon: '#ffe26a' }),
    dea: (b, t, W, D) => sign(b, 'DRUG ENFORCEMENT\nADMINISTRATION', { w: 6.6, h: 1.2, y: 4.6, z: D / 2 + 0.3, bg: '#11243a', fg: '#e8d9a0', neon: '#9cc8ff' }),
    motel: (b, t, W, D) => poleSign(b, 'CROSSROADS\nMOTEL', W / 2 + 3, D / 2 + 2, 9.5, { w: 5.6, h: 2.6, bg: '#14323a', fg: '#ffe8a8', neon: '#ff4fa3' }),
    pest: (b, t, W, D) => poleSign(b, 'VAMONOS PEST', 0, D / 2 + 1.8, 2, { w: 6, h: 1, bg: '#f4f0e4', fg: '#2f6f3a', neon: '#baff6a' }),
    diner: (b, t, W, D) => poleSign(b, 'LOYOLA’S\nFAMILY RESTAURANT', -W / 2 - 2.6, D / 2 + 2, 8, { w: 6, h: 2, bg: '#fdf6e3', fg: '#a8231c', neon: '#ff4a3a' }),
  };
  const YAW = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
  const fits = {}; // (for the QA scripts: each Meshy building as it stands, front on +z)
  for (const t of TOWN) {
    const b = new THREE.Group();
    const turned = t.face === 'e' || t.face === 'w';
    // built with its front on +z, then turned to face its street
    const [W, D] = turned ? [t.d, t.w] : [t.w, t.d];
    const model = models[t.id];
    if (model) {
      // Meshy's model, turned front-forward and fitted to the footprint the car stops at
      const holder = new THREE.Group();
      model.rotation.y = MODEL_FRONT[t.id] ?? 0;
      holder.add(model);
      holder.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(holder);
      const size = box.getSize(new THREE.Vector3());
      // (rules.js gives each of these the model's own proportions, so one scale fits both ways)
      const k = Math.min(W / Math.max(size.x, 1e-3), D / Math.max(size.z, 1e-3));
      holder.scale.setScalar(k);
      holder.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
      fits[t.id] = { w: +(size.x * k).toFixed(2), d: +(size.z * k).toFixed(2), h: +(size.y * k).toFixed(2), ratio: +(size.x / size.z).toFixed(3) };
      b.add(holder);
      NAMES[t.id]?.(b, t, W, D);
    } else KINDS[t.kind]?.(b, t, W, D);
    b.position.set(t.at.x, surfaceHeight(t.at.x, t.at.z), t.at.z);
    b.rotation.y = YAW[t.face] ?? 0;
    root.add(b);
  }

  // ── on the road in: Route 66's arches over Central where it leaves town, and two billboards ──
  for (const x of [-254, 254]) {
    const arch = new THREE.Group();
    for (const s of [-1, 1]) pole(arch, 0, s * 8.2, 7.2, 0.22);
    add(arch, B(0.4, 0.5, 16.8), steel, 0, 7.2, 0);
    sign(arch, 'ROUTE 66', { w: 9, h: 1.7, y: 8.4, ry: Math.PI / 2, bg: '#101418', fg: '#ffffff', neon: x < 0 ? '#ff3b6b' : '#39d6ff', font: 'Arial Black, Arial, sans-serif' });
    arch.position.set(x, 0, 0);
    root.add(arch);
  }
  const billboard = (text, x, z, ry, o) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) pole(g, s * 3.6, 0, 7, 0.16);
    sign(g, text, { w: 10, h: 4.4, y: 8.4, ...o });
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
  };
  billboard('BETTER CALL SAUL!\n(505) 503-4455', 272, 16, Math.PI, { bg: '#f6cf1d', fg: '#b3151b', neon: '#ffe14a', font: 'Arial Black, Arial, sans-serif' });
  billboard('LOS POLLOS HERMANOS\nThe finest ingredients', -272, -16, 0, { bg: '#f4e9c8', fg: '#c0392b', neon: '#ffb347' });

  // ── the tracks north of town, and the freight ──
  const span = 900;
  {
    const c = canvasOf(64, 128);
    const g = c.getContext('2d');
    const r = seeded(5);
    g.fillStyle = '#7d756a';
    g.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '40,36,30' : '190,180,165'}, ${0.2 + r() * 0.3})`;
      g.fillRect(r() * 64, r() * 128, 1.5, 1.5);
    }
    g.fillStyle = '#4a3a2c';
    for (let y = 6; y < 128; y += 32) g.fillRect(8, y, 48, 12);
    g.fillStyle = '#a9aaa8';
    g.fillRect(17, 0, 3, 128);
    g.fillRect(44, 0, 3, 128);
    const n = 180;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const x = -span + (i / n) * span * 2;
      for (const s of [-1, 1]) {
        const z = RAIL.z + s * 2.3;
        pos.push(x, groundHeight(x, RAIL.z) + 0.1, z);
        uv.push(s < 0 ? 0 : 1, (i / n) * span * 2);
      }
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const bed = new THREE.BufferGeometry();
    bed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bed.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    bed.setIndex(idx);
    bed.computeVertexNormals();
    const m = own(new THREE.MeshStandardMaterial({ map: texOf(c, [1, 1 / 2.6]), roughness: 0.95 }));
    const mesh = new THREE.Mesh(own(bed), m);
    floors.push(m);
    root.add(mesh);
  }
  const cars = [];
  {
    const r = seeded(19);
    const loco = flat(0xe0a020, { roughness: 0.5, metalness: 0.3 });
    const black = flat(0x1c1c1e, { roughness: 0.6, metalness: 0.4 });
    const tints = [0x7a3b26, 0x2f4f6f, 0x5a5f58, 0x8a6a3c, 0x3a3a3c, 0x9a2f22];
    const head = own(new THREE.SpriteMaterial({ map: null, color: new THREE.Color(0xfff2c8).multiplyScalar(5), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    const bodyGeo = own(B(13.2, 3, 2.9));
    const tankGeo = own(new THREE.CylinderGeometry(1.45, 1.45, 12.6, 14).rotateZ(Math.PI / 2));
    const baseGeo = own(B(13.6, 0.5, 2.6));
    for (let i = 0; i < (small ? 12 : 20); i++) {
      const car = new THREE.Group();
      const base = new THREE.Mesh(baseGeo, black);
      base.position.y = 0.9;
      car.add(base);
      if (i < 2) {
        // the engines: a long hood, a cab, a stripe
        const hood = new THREE.Mesh(bodyGeo, loco);
        hood.position.y = 2.6;
        hood.scale.set(1, 0.9, 0.86);
        const cab = new THREE.Mesh(own(B(2.6, 1.3, 2.9)), loco);
        cab.position.set(4.2, 4.3, 0);
        const stripe = new THREE.Mesh(own(B(13.3, 0.4, 2.55)), black);
        stripe.position.y = 1.6;
        car.add(hood, cab, stripe);
        if (i === 0) {
          const lamp = new THREE.Sprite(head);
          lamp.position.set(6.9, 3.4, 0);
          lamp.scale.setScalar(2.6);
          car.add(lamp);
        }
      } else if (r() < 0.45) {
        // a tank car, the kind with methylamine in it: the model if it came, a plain tank if not
        if (tankCar) {
          car.remove(base);
          const m = tankCar.clone();
          m.rotation.y = Math.PI / 2; // made lengthways along z; the train runs along x
          car.add(m);
        } else {
          const tank = new THREE.Mesh(tankGeo, r() < 0.5 ? black : flat(0xdad6cc, { roughness: 0.5, metalness: 0.3 }));
          tank.position.y = 2.6;
          car.add(tank);
        }
      } else {
        const box = new THREE.Mesh(bodyGeo, flat(tints[Math.floor(r() * tints.length)], { roughness: 0.8, metalness: 0.2 }));
        box.position.y = 2.7;
        car.add(box);
      }
      root.add(car);
      cars.push(car);
    }
  }
  const length = cars.length * 14.6;

  return {
    object: root,
    fits,
    train: cars,
    floors,
    // night: 0 by day, 1 after dark. The freight comes through every minute and a half.
    update(dt, clock, night) {
      for (const l of lit) l.m.emissiveIntensity = (l.base ?? 0) + night * l.k;
      const lead = -span + ((clock * 17) % (span * 2 + length + 500));
      cars.forEach((car, i) => {
        const x = lead - i * 14.6;
        car.visible = x > -span && x < span;
        if (car.visible) car.position.set(x, groundHeight(x, RAIL.z) + 0.1, RAIL.z);
      });
    },
    dispose() {
      for (const o of owned) o.dispose?.();
    },
  };
}
