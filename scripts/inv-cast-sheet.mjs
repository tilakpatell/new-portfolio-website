// The Invincible cast on one sheet, for judging it as one show: every
// figure and prop in src/components/invincible/cast.js from the front, the side and
// the back as the game draws it (scripts/glb-shot.mjs, look=toon), each
// column scaled to the height it stands, so the same line, the same
// saturation and the same height ratios can be seen at a glance.
// Needs the dev server: npx vite --port 5188.
//
//   node scripts/inv-cast-sheet.mjs [out.webp]   (default docs/gen3d/invincible/cast-sheet.webp)

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shoot } from './glb-shot.mjs';
import { CAST } from '../src/components/invincible/cast.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? join(ROOT, 'docs', 'gen3d', 'invincible', 'cast-sheet.webp');
const VIEWS = ['front', 'side', 'back'];
const W = 220; // a view's width
const H = 360; // the tallest figure's height
const LABEL = 28;

const names = Object.keys(CAST);
// figures to the tallest figure; a prop fills its column (it isn't to scale)
const tallest = Math.max(...names.filter((n) => CAST[n].rig).map((n) => CAST[n].h));
const tiles = [];
for (const [col, n] of names.entries()) {
  const shots = await shoot(join(ROOT, 'public', CAST[n].file), VIEWS, { w: 480, h: 640, look: 'toon' });
  const h = CAST[n].rig ? Math.round((H * CAST[n].h) / tallest) : H;
  for (const [row, png] of shots.entries()) {
    // the figure fills the shot's height, so scaled to its own height it stands to the others'
    const input = await sharp(png).trim({ threshold: 6 }).resize({ height: h, width: W, fit: 'inside' }).png().toBuffer();
    const meta = await sharp(input).metadata();
    tiles.push({ input, left: col * W + Math.round((W - meta.width) / 2), top: LABEL + row * (H + 12) + (H - meta.height) });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LABEL}"><text x="${W / 2}" y="20" font-family="sans-serif" font-size="15" fill="#e8e6df" text-anchor="middle">${n} · ${CAST[n].h} m</text></svg>`;
  tiles.push({ input: Buffer.from(svg), left: col * W, top: 0 });
  console.log(`${n.padEnd(8)} ${JSON.stringify(shoot.last)}`);
}
await mkdir(dirname(OUT), { recursive: true });
await sharp({ create: { width: W * names.length, height: LABEL + VIEWS.length * (H + 12), channels: 3, background: '#1a2029' } })
  .composite(tiles)
  .webp({ quality: 82 })
  .toFile(OUT);
console.log(OUT);
