// Pictures to judge a model by: four views of each GLB named, side by side
// in one sheet, each row a model, with its triangles and size written in.
// The renders come from scripts/glb-shot.mjs (headless Chromium; set CHROME
// to Edge on Windows) through a dev server (BASE, default :5188) serving the
// repository root, so the files must be under the project.
//
//   CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" BASE=http://127.0.0.1:5299 \
//     node scripts/gen3d/judge.mjs out.png a.glb b.glb …

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shoot } from '../glb-shot.mjs';

export const VIEWS = ['three', 'front', 'side', 'top'];
export const W = 640;
export const H = 480;

// Where each view and label goes on the sheet: row per model, a view per column.
export function layout(models, views = VIEWS, w = W, h = H) {
  return {
    width: w * views.length,
    height: h * models,
    cells: Array.from({ length: models }, (_, row) => views.map((view, col) => ({ row, view, left: col * w, top: row * h }))),
  };
}

// The caption under a model's row: name, triangles, file size.
export const caption = (file, stats, bytes) => `${basename(file)}  ${Math.round(stats?.tris ?? 0).toLocaleString('en-US')} tris  ${(bytes / 1024).toFixed(0)} KB`;

const svgLabel = (text, w) =>
  Buffer.from(`<svg width="${w}" height="28"><rect width="${w}" height="28" fill="#000a"/><text x="8" y="20" font-family="Segoe UI, sans-serif" font-size="16" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

export async function sheet(out, files) {
  const { width, height, cells } = layout(files.length);
  // GEN3D_SHEET=fake: a blank sheet of the right size and no browser, for the
  // contract tests, which judge the pipeline's plumbing and not the renders
  if (process.env.GEN3D_SHEET === 'fake') {
    await sharp({ create: { width, height, channels: 3, background: '#111' } }).png().toFile(out);
    return out;
  }
  const composite = [];
  for (const [row, file] of files.entries()) {
    const shots = await shoot(file, VIEWS);
    const bytes = (await readFile(file)).length;
    cells[row].forEach((c, i) => composite.push({ input: shots[i], left: c.left, top: c.top }));
    composite.push({ input: svgLabel(caption(file, shoot.last, bytes), width), left: 0, top: row * H });
    console.log(caption(file, shoot.last, bytes));
  }
  await sharp({ create: { width, height, channels: 3, background: '#111' } }).composite(composite).png().toFile(out);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [out, ...files] = process.argv.slice(2);
  if (!out || !files.length) throw new Error('usage: node scripts/gen3d/judge.mjs out.png a.glb [b.glb …]');
  await sheet(out, files.map((f) => join(process.cwd(), f)));
  console.log(out);
}
