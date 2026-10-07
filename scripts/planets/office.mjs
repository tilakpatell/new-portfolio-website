// The Office's planet: a sheet of Dunder Mifflin's letterhead, crumpled
// into a ball (the paper Jim and Dwight throw at the bin). The ball's
// surface is a few hundred flat facets with sharp creases between them and
// finer creases inside, worked out as cells on the sphere; each facet is
// tilted its own way in the normal map, so the light breaks across it as
// it does across crumpled paper. The page's print (the letterhead with the
// Slough Avenue address, a memo from Michael, his signature, a coffee
// ring) runs on across the folds, shifted a little at each crease; round
// the back, the blank side of the sheet.
//
// Makes office and office-normal at 2048 (-hq), 1024 and 512 (-sm), and
// office-rough at 1024.

import sharp from 'sharp';
import { cells, clamp, eachTexel, fbm, hex, perlin, rand, sampler, save, smooth } from './sphere.mjs';

const W = 4096;
const H = 2048;
const PAGE = { w: 850, h: 1100 }; // US letter, a unit a hundredth of an inch
const SCALE = 2; // the page's raster, px a unit

function pageSvg() {
  const lines = [];
  const r = rand(5);
  // the memo's body: lines of type, as grey runs of words
  let y = 470;
  for (let para = 0; para < 4; para++) {
    const n = 3 + Math.floor(r() * 3);
    for (let l = 0; l < n; l++) {
      let x = 100;
      const end = l === n - 1 ? 300 + r() * 300 : 740;
      while (x < end) {
        const w = 10 + r() * 46;
        lines.push(`<rect x="${x.toFixed(1)}" y="${y - 6}" width="${Math.min(w, end - x).toFixed(1)}" height="6" rx="1.5" fill="#333" fill-opacity="0.62"/>`);
        x += w + 6;
      }
      y += 17;
    }
    y += 18;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.w * SCALE}" height="${PAGE.h * SCALE}" viewBox="0 0 ${PAGE.w} ${PAGE.h}">
  <rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#111">
    <text x="100" y="128" font-size="56" font-weight="700" letter-spacing="1">Dunder Mifflin</text>
    <text x="104" y="160" font-family="Arial, Helvetica, sans-serif" font-size="17" letter-spacing="5" fill="#333">PAPER COMPANY, INC.</text>
  </g>
  <rect x="100" y="178" width="650" height="3" fill="#111"/>
  <text x="100" y="204" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#444" letter-spacing="1">Scranton Business Park · 1725 Slough Avenue · Scranton, PA 18505</text>
  <g font-family="Arial, Helvetica, sans-serif" fill="#111">
    <text x="100" y="270" font-size="30" font-weight="700" letter-spacing="6">MEMORANDUM</text>
    <text x="100" y="320" font-size="17"><tspan font-weight="700">TO:</tspan> All Staff</text>
    <text x="100" y="348" font-size="17"><tspan font-weight="700">FROM:</tspan> Michael Scott, Regional Manager</text>
    <text x="100" y="376" font-size="17"><tspan font-weight="700">RE:</tspan> The Dundies</text>
    <text x="100" y="404" font-size="17"><tspan font-weight="700">DATE:</tspan> Thursday</text>
  </g>
  <rect x="100" y="422" width="650" height="1.5" fill="#777"/>
  ${lines.join('')}
  <path d="M120 ${y + 60} c 20 -40 40 30 60 -10 s 30 -30 40 10 s 10 20 30 -15 c 15 -20 25 30 50 0 s 20 -10 60 -5" fill="none" stroke="#1d2b6b" stroke-width="3" stroke-linecap="round"/>
  <text x="120" y="${y + 100}" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#333">Michael Scott</text>
  <text x="120" y="${y + 120}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#666">Regional Manager, Scranton Branch</text>
  <g fill="none" stroke="#8a5a2b">
    <circle cx="640" cy="${y + 40}" r="62" stroke-width="7" stroke-opacity="0.32"/>
    <circle cx="640" cy="${y + 40}" r="56" stroke-width="2" stroke-opacity="0.22"/>
    <path d="M 586 ${y + 10} a 64 64 0 0 1 100 -24" stroke-width="10" stroke-opacity="0.18"/>
  </g>
  <circle cx="640" cy="${y + 40}" r="58" fill="#a0703c" fill-opacity="0.06"/>
  <text x="${PAGE.w / 2}" y="${PAGE.h - 50}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#888" letter-spacing="2">LIMITLESS PAPER IN A PAPERLESS WORLD</text>
</svg>`;
}

export async function bake() {
  console.log('office: setting the page');
  const pw = PAGE.w * SCALE;
  const ph = PAGE.h * SCALE;
  const { data: colour } = await sharp(Buffer.from(pageSvg())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tint = [0, 1, 2].map((c) => {
    const ch = new Uint8Array(pw * ph);
    for (let i = 0; i < ch.length; i++) ch[i] = colour[i * 3 + c];
    return sampler(ch, pw, ph);
  });

  console.log('office: crumpling');
  const big = cells(51, 240); // the facets
  const small = cells(52, 1600); // the creases inside them
  const nf = perlin(53);
  const albedo = new Float32Array(W * H * 3);
  const normal = new Float32Array(W * H * 3);
  const rough = new Float32Array(W * H * 3);
  const paper = hex('#f3f0e8');
  const back = hex('#ebe7dd');
  // the page faces +x (the side three's sphere has at u = 0.5): east and north there
  const K = PAGE.w / 1.9; // page units a radian: the page wraps a good way round
  const jit = (id, k) => {
    const r = rand(id * 7 + k);
    return [r() - 0.5, r() - 0.5, r() - 0.5];
  };
  const P = big.points;

  eachTexel(W, H, (x, y, z, i) => {
    const A = big(x, y, z);
    const B = small(x, y, z);
    // the facet's tilt (sharp at its edges), and the finer creases' tilt
    const [ax, ay, aa] = jit(A.id, 1);
    const [bx, by] = jit(B.id, 2);
    const fiber = fbm(nf, x * 300, y * 300, z * 300, { octaves: 2 });
    const nx = ax * 0.55 + bx * 0.16 + fiber * 0.04;
    const ny = ay * 0.55 + by * 0.16 + fbm(nf, x * 300 + 9, y * 300, z * 300, { octaves: 2 }) * 0.04;
    const len = Math.hypot(nx, ny, 1);
    normal[i * 3] = nx / len * 0.5 + 0.5;
    normal[i * 3 + 1] = ny / len * 0.5 + 0.5;
    normal[i * 3 + 2] = 1 / len * 0.5 + 0.5;
    // the print: the page laid round the front, each facet shifted and
    // turned a little about its own middle
    const cx = P[A.id * 3];
    const cy = P[A.id * 3 + 1];
    const cz = P[A.id * 3 + 2];
    const toPage = (dx, dy, dz) => {
      // azimuthal about the front (+x): east is −z, north +y
      const ang = Math.acos(clamp(dx, -1, 1));
      const tl = Math.hypot(dz, dy) || 1;
      return [PAGE.w / 2 + (K * ang * -dz) / tl, PAGE.h * 0.42 - (K * ang * dy) / tl];
    };
    const [px, py] = toPage(x, y, z);
    const [qx, qy] = toPage(cx, cy, cz);
    const turn = aa * 0.35;
    const ca = Math.cos(turn);
    const sa = Math.sin(turn);
    const ux = qx + (px - qx) * ca - (py - qy) * sa + ax * 14;
    const uy = qy + (px - qx) * sa + (py - qy) * ca + ay * 14;
    let col;
    if (x > -0.2 && ux > 0 && ux < PAGE.w && uy > 0 && uy < PAGE.h) {
      col = [0, 1, 2].map((c) => tint[c](ux * SCALE, uy * SCALE));
      col = col.map((v, c) => v * paper[c]);
    } else col = back;
    // a crease's shadow and its lit side, and each facet a shade of its own
    const crease = smooth(0.012, 0.0, A.f2 - A.f1);
    const fine = smooth(0.004, 0.0, B.f2 - B.f1);
    const k = (0.97 + aa * 0.04) * (1 - crease * 0.05) * (1 - fine * 0.025);
    col = col.map((v) => v * k);
    albedo.set(col, i * 3);
    rough[i * 3] = rough[i * 3 + 1] = rough[i * 3 + 2] = 0.88 - crease * 0.08;
  });

  await save(albedo, W, H, 3, 'office', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normal, W, H, 3, 'office-normal', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
  await save(rough, W, H, 3, 'office-rough', [[1024, '']], { quality: 84 });
}
