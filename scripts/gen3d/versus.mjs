// Models of one thing side by side, unnamed, for judging which is better
// (Meshy's against the gen3d runner's, say) without knowing which is which:
// the picture they were made from in the top row, then a row a model,
// labelled A, B, C … in the order given (shuffle them first and keep the
// key), every row in the same views. Renders through scripts/glb-shot.mjs
// (a dev server, BASE, serving the repository).
//
//   node scripts/gen3d/versus.mjs out.png --ref concept.jpg [--views front,three,rear,face] [--look toon] [--w 480 --h 560] a.glb b.glb …
//   versus(out, files, { ref, views, look, w, h })

import sharp from 'sharp';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shoot } from '../glb-shot.mjs';

export const LETTERS = 'ABCDEFGH';

const label = (text, w, size = 28) =>
  Buffer.from(`<svg width="${w}" height="${size + 16}"><rect width="${w}" height="${size + 16}" fill="#000b"/><text x="12" y="${size + 4}" font-family="Segoe UI, DejaVu Sans, sans-serif" font-weight="bold" font-size="${size}" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

export async function versus(out, files, { ref, views = ['front', 'three', 'rear', 'face'], look, w = 480, h = 560 } = {}) {
  const width = w * views.length;
  const top = ref ? h : 0;
  const composite = [];
  if (ref) {
    composite.push({ input: await sharp(ref).resize(w * 2, h, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), left: 0, top: 0 });
    composite.push({ input: label('the picture they were made from', w * 2, 20), left: 0, top: 0 });
  }
  for (const [row, file] of files.entries()) {
    const shots = await shoot(file, views, { look, w, h });
    shots.forEach((input, i) => composite.push({ input, left: i * w, top: top + row * h }));
    composite.push({ input: label(LETTERS[row], 56), left: 0, top: top + row * h });
  }
  await sharp({ create: { width, height: top + h * files.length, channels: 3, background: '#111' } }).composite(composite).png().toFile(out);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const ref = flag('ref');
  const views = flag('views', 'front,three,rear,face').split(',');
  const look = flag('look');
  const [w, h] = [Number(flag('w', 480)), Number(flag('h', 560))];
  const [out, ...files] = args;
  if (!out || !files.length) throw new Error('usage: node scripts/gen3d/versus.mjs out.png [--ref picture] [--views …] [--look toon] a.glb b.glb …');
  await versus(out, files.map((f) => join(process.cwd(), f)), { ref: ref && join(process.cwd(), ref), views, look, w, h });
  console.log(out);
}
