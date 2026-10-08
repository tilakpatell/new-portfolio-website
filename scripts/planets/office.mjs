// The Office's planet: a sheet of Dunder Mifflin's letterhead, crumpled
// into a ball (the paper Jim and Dwight throw at the bin) and smoothed out
// a little, so it reads. The page faces the front: "Dunder Mifflin" across
// it in the wordmark's bold serif, the title block about a sixth of the
// ball's height so it reads from the ship, "Paper Company, Inc." and the
// Scranton address under it in navy, fourteen ruled lines below, a coffee
// ring and the ring the World's Best Boss mug left. Eight long folds cross
// the ball (great circles, each running part way round), splitting it into
// big flat facets, each tilted its own way in the normal map, so the light
// breaks across them as it does across crumpled paper; the print shifts a
// little at each fold. Round the back, the blank side of the sheet.
//
// Makes office at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// office-normal at 2048, 1024 and 512; office-rough at 1024.

import sharp from 'sharp';
import { clamp, eachTexel, fbm, hex, perlin, rand, sampler, save, smooth, bakeSize } from './sphere.mjs';

// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = bakeSize();
const PAGE = { w: 1000, h: 1150 }; // the page, in its own units (its foot short of the pole)
const SCALE = 3; // the page's raster, px a unit
// page units a radian: the page wraps the front, the title across the face
// seen from parking (about 105°, foreshortened toward the limb)
const K = 520;
const FRONT = [500, 640]; // the page point at the ball's front: the title above it, the ruled lines and the rings below
const PAPER = '#f1ead8';
const INK = '#1f2d5a';
const FOLDS = 8;

function pageSvg() {
  const r = rand(5);
  const ruled = [];
  // fourteen ruled lines, a margin line, and a few lines of Michael's hand on them
  for (let k = 0; k < 14; k++) {
    const y = 615 + k * 33;
    ruled.push(`<rect x="70" y="${y}" width="860" height="3" fill="#6f87b8" fill-opacity="0.7"/>`);
  }
  ruled.push(`<rect x="150" y="585" width="3" height="480" fill="#c0504d" fill-opacity="0.65"/>`);
  // Michael's hand on the first lines: words as a scrawl, up and down strokes joined
  const hand = [];
  for (let k = 0; k < 5; k++) {
    const y = 615 + k * 33 - 4;
    let x = 172;
    const end = k === 4 ? 430 : 840 - r() * 150;
    while (x < end) {
      const word = 30 + r() * 60;
      let d = `M${x.toFixed(1)} ${y}`;
      for (let wx = 0; wx < word; wx += 5 + r() * 3) d += ` L${(x + wx).toFixed(1)} ${(y - (r() < 0.18 ? 15 : 3 + r() * 5)).toFixed(1)} L${(x + wx + 2.5).toFixed(1)} ${y}`;
      hand.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.85"/>`);
      x += word + 14;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.w * SCALE}" height="${PAGE.h * SCALE}" viewBox="0 0 ${PAGE.w} ${PAGE.h}">
  <rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>
  <text x="500" y="440" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="108" font-weight="700" fill="${INK}" letter-spacing="2">Dunder Mifflin</text>
  <rect x="190" y="462" width="620" height="6" fill="${INK}"/>
  <text x="500" y="515" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" fill="${INK}" letter-spacing="7">PAPER COMPANY, INC.</text>
  <text x="500" y="560" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" fill="${INK}" letter-spacing="2">1725 Slough Avenue, Scranton, PA</text>
  ${ruled.join('')}
  ${hand.join('')}
  <g fill="none" stroke="#7a4a20">
    <circle cx="790" cy="860" r="78" stroke-width="9" stroke-opacity="0.38"/>
    <circle cx="790" cy="860" r="70" stroke-width="2.5" stroke-opacity="0.25"/>
    <path d="M 722 826 a 80 80 0 0 1 132 -28" stroke-width="14" stroke-opacity="0.2"/>
  </g>
  <circle cx="790" cy="860" r="74" fill="#8a5a2b" fill-opacity="0.07"/>
  <g transform="translate(300 960) rotate(-14)">
    <circle r="66" fill="none" stroke="#6b3f1c" stroke-width="6" stroke-opacity="0.3"/>
    <circle r="62" fill="#7a4a20" fill-opacity="0.06"/>
    <text y="-6" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#6b3f1c" fill-opacity="0.42">WORLD'S BEST</text>
    <text y="18" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#6b3f1c" fill-opacity="0.42">BOSS</text>
  </g>
  <text x="500" y="1120" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="18" fill="${INK}" fill-opacity="0.7" letter-spacing="3">LIMITLESS PAPER IN A PAPERLESS WORLD</text>
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
  // the folds: great circles (each a plane through the middle, its normal
  // `n`), each running part way round from its own middle `m`
  const rf = rand(51);
  const unit = (v) => {
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  };
  const folds = Array.from({ length: FOLDS }, () => {
    const n = unit([rf() - 0.5, rf() - 0.5, rf() - 0.5]);
    const m = unit([rf() - 0.5, rf() - 0.5, rf() - 0.5]);
    return { n, m, reach: 1.2 + rf() * 1.2, sharp: 0.018 + rf() * 0.02 };
  });
  const nf = perlin(53);
  const albedo = new Float32Array(W * H * 3);
  const normal = new Float32Array(W * H * 3);
  const rough = new Float32Array(W * H * 3);
  const paper = hex(PAPER);
  const back = hex('#e9e2cf');
  const jit = (id, k) => {
    const r = rand(id * 7 + k);
    return [r() - 0.5, r() - 0.5, r() - 0.5];
  };
  // the page laid round the front (+x): east is −z, north +y
  const toPage = (dx, dy, dz) => {
    const ang = Math.acos(clamp(dx, -1, 1));
    const tl = Math.hypot(dz, dy) || 1;
    return [FRONT[0] + (K * ang * -dz) / tl, FRONT[1] - (K * ang * dy) / tl];
  };

  eachTexel(W, H, (x, y, z, i) => {
    // which side of each fold this is (where the fold reaches), and how near the nearest crease
    let id = 0;
    let crease = 0;
    for (let f = 0; f < FOLDS; f++) {
      const { n, m, reach, sharp: w } = folds[f];
      const d = x * n[0] + y * n[1] + z * n[2];
      const along = Math.acos(clamp(x * m[0] + y * m[1] + z * m[2], -1, 1));
      const on = smooth(reach, reach * 0.7, along); // the fold dies out along its length
      if (d > 0 && on > 0.5) id |= 1 << f;
      crease = Math.max(crease, smooth(w, 0, Math.abs(d)) * on);
    }
    // the facet's tilt, sharp at its creases, and a soft wrinkle (not a crackle) over all of it
    const [ax, ay, aa] = jit(id + 1, 1);
    const wx = fbm(nf, x * 18, y * 18, z * 18, { octaves: 3 }) * 0.1 + fbm(nf, x * 300, y * 300, z * 300, { octaves: 2 }) * 0.03;
    const wy = fbm(nf, x * 18 + 9, y * 18, z * 18, { octaves: 3 }) * 0.1 + fbm(nf, x * 300 + 9, y * 300, z * 300, { octaves: 2 }) * 0.03;
    const nx = ax * 0.62 + wx;
    const ny = ay * 0.62 + wy;
    const len = Math.hypot(nx, ny, 1);
    normal[i * 3] = (nx / len) * 0.5 + 0.5;
    normal[i * 3 + 1] = (ny / len) * 0.5 + 0.5;
    normal[i * 3 + 2] = (1 / len) * 0.5 + 0.5;
    // the print, shifted a little on each facet
    const [px, py] = toPage(x, y, z);
    const ux = px + ax * 9;
    const uy = py + ay * 9;
    let col;
    if (x > -0.25 && ux > 0 && ux < PAGE.w && uy > 0 && uy < PAGE.h) col = [0, 1, 2].map((c) => (tint[c](ux * SCALE, uy * SCALE) / 1) * paper[c]);
    else col = back;
    // each facet a shade of its own, the creases a little darker
    const k = (0.975 + aa * 0.04) * (1 - crease * 0.07);
    col = col.map((v) => v * k);
    albedo.set(col, i * 3);
    rough[i * 3] = rough[i * 3 + 1] = rough[i * 3 + 2] = 0.88 - crease * 0.08;
  });

  await save(albedo, W, H, 3, 'office', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normal, W, H, 3, 'office-normal', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
  await save(rough, W, H, 3, 'office-rough', [[1024, '']], { quality: 84 });
}
